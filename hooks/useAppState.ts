import { useState, useEffect, useCallback } from 'react';
import { DropResult } from 'react-beautiful-dnd';
import { AppState, Task, NewTaskData, User, ChatMessage, AiGeneratedProjectPlan, TaskPriority, Subtask, AiGeneratedTaskFromFile, Sprint, FilterSegment, Project, TaskHistory } from '../types';
import { api, getTicketId } from '../services/api';
import { generateTaskFromPrompt } from '../services/geminiService';
import { Session } from '@supabase/supabase-js';
import { playSentSound, playReceiveSound } from '../utils/sound';
import { initSocket, joinProjectRoom, disconnectSocket, sendSocketChatMessage } from '../services/socketService';

const initialState: AppState = {
  projects: {},
  users: {},
  projectOrder: [],
};

export const useAppState = (session: Session | null, currentUser: User | null, activeProjectId?: string | null) => {
  const [state, setState] = useState<AppState>(initialState);
  const [loading, setLoading] = useState(true);
  const userId = session?.user?.id;

  const syncCache = (newState: AppState) => {
    if (!userId) return;
    const cacheKey = `gemini-board-cache-${userId}`;
    try {
        localStorage.setItem(cacheKey, JSON.stringify(newState));
    } catch (e) {
        console.warn("Could not sync cache:", e);
    }
  };

  const fetchData = useCallback(async (isInitial = false) => {
    if (!userId) {
      setState(initialState);
      setLoading(true);
      return;
    }
    
    if (isInitial) setLoading(true);

    try {
        const freshState = await api.data.fetchInitialData(userId);
        setState(freshState);
        syncCache(freshState);
    } catch (error: any) {
        console.error("An error occurred while fetching app data:", error);
        if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
            console.error("Network connectivity issue detected with Supabase.");
        }
        // Even on error, we stop loading so the UI can at least show cached data or empty state
        setLoading(false); 
    } finally {
        setLoading(false);
    }
  }, [userId]);
  
  useEffect(() => {
    if (!userId) {
      setState(initialState);
      setLoading(true);
      return;
    }
    
    const cacheKey = `gemini-board-cache-${userId}`;
    const cachedStateJSON = localStorage.getItem(cacheKey);
    let hasLoadedCache = false;
    if (cachedStateJSON) {
      try {
        const parsed = JSON.parse(cachedStateJSON);
        setState(parsed);
        hasLoadedCache = Object.keys(parsed.projects || {}).length > 0;
        if (hasLoadedCache) {
          setLoading(false); 
        }
      } catch (e) {
        localStorage.removeItem(cacheKey);
      }
    }
    fetchData(!hasLoadedCache);
  }, [userId, fetchData]);

  useEffect(() => {
    if (!activeProjectId || !session || !userId) return;

    const handleNewMessage = (payload: any) => {
      const newMessageData = payload.new;
      setState(prevState => {
        const author = prevState.users[newMessageData.author_id];
        if (!author) return prevState;
        const project = prevState.projects[activeProjectId];
        if (!project) return prevState;
        
        const finalMessage: ChatMessage = {
            id: newMessageData.id,
            text: newMessageData.text,
            createdAt: newMessageData.created_at,
            author: author,
        };
        
        const isSender = author.id === userId;
        let newMessages;

        if (isSender) {
          const optimisticIndex = project.chatMessages.findIndex(m => m.id.startsWith('temp-') && m.text === finalMessage.text);
          if (optimisticIndex > -1) {
            newMessages = [...project.chatMessages];
            newMessages[optimisticIndex] = finalMessage;
          } else {
            if (project.chatMessages.some(m => m.id === finalMessage.id)) return prevState;
            newMessages = [...project.chatMessages, finalMessage];
          }
        } else {
          if (project.chatMessages.some(m => m.id === finalMessage.id)) return prevState;
          newMessages = [...project.chatMessages, finalMessage];
          setTimeout(() => {
            playReceiveSound();
          }, 50);
        }

        const newState = {
            ...prevState,
            projects: {
                ...prevState.projects,
                [activeProjectId]: {
                    ...project,
                    chatMessages: newMessages.sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
                    updatedAt: new Date().toISOString()
                }
            }
        };
        syncCache(newState);
        return newState;
      });
    };

    const subscription = api.data.subscribeToProjectChat(activeProjectId, handleNewMessage);
    return () => { subscription.unsubscribe(); };
  }, [activeProjectId, session, userId]);

  // Socket.IO real-time chat sync
  useEffect(() => {
    if (!session || !session.access_token || !userId) {
      disconnectSocket();
      return;
    }

    const handleSocketMessage = (payload: any) => {
      const payloadId = payload.id;
      const payloadProjectId = payload.projectId || payload.project_id;
      const targetProjectId = payloadProjectId || activeProjectId;

      if (!targetProjectId) return;

      // Extremely defensive parsing for user/sender identifier
      const authorId = payload.senderId || 
                       payload.sender_id || 
                       payload.author_id || 
                       payload.authorId || 
                       payload.userId || 
                       payload.user_id || 
                       (payload.sender && typeof payload.sender === 'object' ? payload.sender.id : null) ||
                       (payload.author && typeof payload.author === 'object' ? payload.author.id : null) || 
                       'unknown-author';

      const messageText = payload.message || payload.text || payload.content;
      const createdAt = payload.createdAt || payload.created_at || new Date().toISOString();

      if (!messageText) return;

      setState(prevState => {
        const author = prevState.users[authorId];
        // Fallback user profile in case user list isn’t populated
        const finalAuthor: User = author || {
          id: authorId,
          name: 'Collaborator',
          email: 'collaborator@example.com',
          role: 'Member' as any,
        };

        const project = prevState.projects[targetProjectId];
        if (!project) return prevState;

        const finalMessage: ChatMessage = {
          id: payloadId || `socket-${Date.now()}`,
          text: messageText,
          createdAt: createdAt,
          author: finalAuthor,
        };

        const isSender = authorId === userId;
        let newMessages;

        if (isSender) {
          // Check for optimistic message and resolve it
          const optimisticIndex = project.chatMessages.findIndex(m => m.id.startsWith('temp-') && m.text === finalMessage.text);
          if (optimisticIndex > -1) {
            newMessages = [...project.chatMessages];
            newMessages[optimisticIndex] = finalMessage;
          } else {
            if (project.chatMessages.some(m => m.id === finalMessage.id)) return prevState;
            newMessages = [...project.chatMessages, finalMessage];
          }
        } else {
          if (project.chatMessages.some(m => m.id === finalMessage.id)) return prevState;
          newMessages = [...project.chatMessages, finalMessage];
          setTimeout(() => {
            playReceiveSound();
          }, 50);
        }

        const newState = {
          ...prevState,
          projects: {
            ...prevState.projects,
            [targetProjectId]: {
              ...project,
              chatMessages: newMessages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
              updatedAt: new Date().toISOString()
            }
          }
        };
        syncCache(newState);
        return newState;
      });
    };

    // Initialize Socket Connection with Supabase access token
    initSocket(session.access_token, handleSocketMessage);

    // If an active project ID exists, join its room immediately
    if (activeProjectId) {
      joinProjectRoom(activeProjectId);
    }

    return () => {
      // Keep background connection across active project room switches,
      // but we handles clean disconnects when session/user logs out.
    };
  }, [session, userId, activeProjectId]);

  /**
   * Optimistically "touches" a project in the local state.
   * This forces the project to the top of sorted lists immediately.
   */
  const optimisticTouch = (projectId: string, taskId?: string) => {
      const now = new Date().toISOString();
      setState(prevState => {
          const project = prevState.projects[projectId];
          if (!project) return prevState;
          
          let updatedTasks = project.board.tasks;
          if (taskId && project.board.tasks[taskId]) {
              updatedTasks = {
                  ...project.board.tasks,
                  [taskId]: { ...project.board.tasks[taskId], updatedAt: now }
              };
          }

          const updatedState = {
              ...prevState,
              projects: {
                  ...prevState.projects,
                  [projectId]: { 
                      ...project, 
                      updatedAt: now,
                      board: { ...project.board, tasks: updatedTasks }
                  }
              }
          };
          syncCache(updatedState);
          return updatedState;
      });
      // Synchronize with server
      api.data.touchProject(projectId).catch(console.warn);
  };


  const onDragEnd = useCallback(async (projectId: string, result: DropResult, filteredBoardData?: BoardData) => {
    const { destination, source, draggableId, type } = result;
    if (!destination || !currentUser || !userId) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;
    
    const project = state.projects[projectId];
    if (!project) return;

    // Trigger immediate re-sequence on dashboard
    optimisticTouch(projectId, type !== 'column' ? draggableId : undefined);

    if (type === 'column') {
        const newColumnOrder = Array.from(project.board.columnOrder) as string[];
        newColumnOrder.splice(source.index, 1);
        newColumnOrder.splice(destination.index, 0, draggableId);

        setState(prevState => {
            const updatedState = {
                ...prevState,
                projects: {
                    ...prevState.projects,
                    [projectId]: {
                        ...prevState.projects[projectId],
                        board: { ...prevState.projects[projectId].board, columnOrder: newColumnOrder }
                    }
                }
            };
            syncCache(updatedState);
            return updatedState;
        });

        try {
            await api.data.updateColumnOrder(projectId, newColumnOrder);
        } catch (error) {
            await fetchData();
        }
        return;
    }

    const startCol = project.board.columns[source.droppableId];
    const endCol = project.board.columns[destination.droppableId];
    if (!startCol || !endCol) return;

    // Handle index translation if filtered data is provided
    let finalSourceIndex = source.index;
    let finalDestinationIndex = destination.index;

    if (filteredBoardData) {
        const filteredStartCol = filteredBoardData.columns[source.droppableId];
        const filteredEndCol = filteredBoardData.columns[destination.droppableId];

        if (filteredStartCol) {
            const taskId = filteredStartCol.taskIds[source.index];
            finalSourceIndex = startCol.taskIds.indexOf(taskId);
        }

        if (filteredEndCol) {
            if (destination.index >= filteredEndCol.taskIds.length) {
                // Moving to the very end of the visible tasks
                finalDestinationIndex = endCol.taskIds.length;
            } else {
                const targetTaskId = filteredEndCol.taskIds[destination.index];
                finalDestinationIndex = endCol.taskIds.indexOf(targetTaskId);
                // If we are moving within the same column and moving "down", 
                // the index might need adjustment if we remove the item from before it.
                // But splice handles this if we do it in order.
            }
        }
    }

    const newStartTaskIds = Array.from(startCol.taskIds);
    newStartTaskIds.splice(finalSourceIndex, 1);
    const newEndTaskIds = startCol.id === endCol.id ? newStartTaskIds : Array.from(endCol.taskIds);
    
    if (startCol.id !== endCol.id) {
        newEndTaskIds.splice(finalDestinationIndex, 0, draggableId);
    } else {
        // Adjust destination index for same-column move
        let adjustedDestIndex = finalDestinationIndex;
        // If we removed an item from BEFORE the destination, the destination index shifted
        // No, wait. splice(finalSourceIndex, 1) removes it.
        // If finalSourceIndex < finalDestinationIndex, the list shortened before the dest.
        // But if we used indexOf on the ORIGINAL list, then finalDestinationIndex is still correct for the original list.
        // Actually, if we use the same list for start and end, we just splice it in.
        newStartTaskIds.splice(adjustedDestIndex, 0, draggableId);
    }

    setState(prevState => {
      const updatedTask = prevState.projects[projectId].board.tasks[draggableId];
      if (!updatedTask) return prevState;

      // Add optimistic history entry for column change
      const newHistoryItem: TaskHistory = {
        id: `temp-hist-${Date.now()}`,
        user: currentUser,
        changeDescription: `moved task from "${startCol.title}" to "${endCol.title}"`,
        createdAt: new Date().toISOString()
      };

      const updatedColumns = {
        ...prevState.projects[projectId].board.columns,
        [startCol.id]: { ...startCol, taskIds: newStartTaskIds },
        [endCol.id]: { ...endCol, taskIds: newEndTaskIds }
      };

      const updatedState = {
        ...prevState,
        projects: {
          ...prevState.projects,
          [projectId]: { 
            ...prevState.projects[projectId], 
            board: { 
                ...prevState.projects[projectId].board, 
                columns: updatedColumns,
                tasks: {
                    ...prevState.projects[projectId].board.tasks,
                    [draggableId]: {
                        ...updatedTask,
                        history: [newHistoryItem, ...(updatedTask.history || [])]
                    }
                }
            } 
          }
        }
      };
      syncCache(updatedState);
      return updatedState;
    });

    try {
        await api.data.moveTask(draggableId, destination.droppableId, destination.index + 1, currentUser.id);
        setTimeout(() => fetchData(), 1200);
    } catch (error) {
        await fetchData();
    }
  }, [state, currentUser, userId, fetchData]);
  
  const updateTask = useCallback(async (projectId: string, updatedTask: Task) => {
      if (!currentUser) return;
      optimisticTouch(projectId, updatedTask.id);
      
      const project = state.projects[projectId];
      const existingTask = project?.board.tasks[updatedTask.id];
      if (!existingTask) return;

      // Keep tags in sync with taskType and referenceNo
      const cleanTags = (updatedTask.tags || existingTask.tags || []).filter(
          (t: string) => t && !t.startsWith('type:') && !t.startsWith('ref:')
      );
      const resolvedType = updatedTask.taskType || existingTask.taskType || 'task';
      if (!cleanTags.includes(`type:${resolvedType}`)) {
          cleanTags.push(`type:${resolvedType}`);
      }
      
      const resolvedRef = updatedTask.referenceNo || existingTask.referenceNo;
      if (resolvedRef) {
          const refTag = `ref:${resolvedRef}`;
          if (!cleanTags.includes(refTag)) {
              cleanTags.push(refTag);
          }
      }

      setState(prevState => {
        const p = prevState.projects[projectId];
        if (!p) return prevState;

        const extTask = p.board.tasks[updatedTask.id];
        if (!extTask) return prevState;

        // Detect specific changes for history
        const historyEntries: TaskHistory[] = [];
        const now = new Date().toISOString();

        if (extTask.title !== updatedTask.title) {
            historyEntries.push({ id: `temp-h-${Date.now()}-1`, user: currentUser, createdAt: now, changeDescription: `changed title to "${updatedTask.title}"` });
        }
        if (extTask.priority !== updatedTask.priority) {
            historyEntries.push({ id: `temp-h-${Date.now()}-2`, user: currentUser, createdAt: now, changeDescription: `changed priority to ${updatedTask.priority}` });
        }
        if (extTask.assignee?.id !== updatedTask.assignee?.id) {
            historyEntries.push({ id: `temp-h-${Date.now()}-3`, user: currentUser, createdAt: now, changeDescription: `changed assignee to ${updatedTask.assignee?.name || 'Unassigned'}` });
        }
        if (extTask.sprintId !== updatedTask.sprintId) {
            historyEntries.push({ id: `temp-h-${Date.now()}-4`, user: currentUser, createdAt: now, changeDescription: `updated node sprint assignment` });
        }
        if ((extTask.taskType || 'task') !== (updatedTask.taskType || 'task')) {
            const fromType = extTask.taskType === 'bug' ? 'Bug' : 'Task';
            const toType = updatedTask.taskType === 'bug' ? 'Bug' : 'Task';
            historyEntries.push({ id: `temp-h-${Date.now()}-type`, user: currentUser, createdAt: now, changeDescription: `converted item from ${fromType} to ${toType}` });
        }
        if (extTask.referenceNo !== updatedTask.referenceNo) {
            historyEntries.push({ id: `temp-h-${Date.now()}-ref`, user: currentUser, createdAt: now, changeDescription: `updated reference identifier to "${updatedTask.referenceNo || 'None'}"` });
        }

        const mergedTask = {
            ...extTask,
            ...updatedTask,
            tags: cleanTags,
            taskType: resolvedType,
            referenceNo: resolvedRef,
            updatedAt: now,
            subtasks: updatedTask.subtasks && updatedTask.subtasks.length > 0 ? updatedTask.subtasks : (extTask?.subtasks || []),
            comments: updatedTask.comments && updatedTask.comments.length > 0 ? updatedTask.comments : (extTask?.comments || []),
            history: [...historyEntries, ...(extTask?.history || [])],
        };

        const newState = {
            ...prevState,
            projects: {
                ...prevState.projects,
                [projectId]: {
                    ...p,
                    board: {
                        ...p.board,
                        tasks: {
                            ...p.board.tasks,
                            [updatedTask.id]: mergedTask
                        }
                    }
                }
            }
        };
        syncCache(newState);
        return newState;
      });

      try {
        const syncUpdatedTask = {
          ...updatedTask,
          tags: cleanTags
        };
        await api.data.updateTask(syncUpdatedTask, currentUser.id, Object.values(state.users) as User[]);
        setTimeout(() => fetchData(), 1200);
      } catch (err) {
        await fetchData();
      }
  }, [fetchData, currentUser, state.users, state.projects]);

  const addSubtasks = useCallback(async (projectId: string, taskId: string, newSubtasksData: Partial<Subtask>[], creatorId: string) => {
    optimisticTouch(projectId, taskId);
    setState(prevState => {
        const project = prevState.projects[projectId];
        if (!project || !project.board.tasks[taskId]) return prevState;
        
        const task = project.board.tasks[taskId];
        const tempSubtasks: Subtask[] = newSubtasksData.map((s, idx) => {
            const id = `temp-st-${Date.now()}-${idx}`;
            return {
                id,
                ticketId: getTicketId(id, 'SUB'),
                title: s.title || '',
                completed: !!s.completed,
                creatorId,
                createdAt: new Date().toISOString(),
                assigneeId: s.assigneeId
            };
        });

        // Add history entry for subtask creation
        const historyEntry: TaskHistory = {
            id: `temp-h-${Date.now()}-st`,
            user: currentUser!,
            createdAt: new Date().toISOString(),
            changeDescription: `added ${newSubtasksData.length} sub-node(s)`
        };

        const newState = {
            ...prevState,
            projects: {
                ...prevState.projects,
                [projectId]: {
                    ...project,
                    board: {
                        ...project.board,
                        tasks: {
                            ...project.board.tasks,
                            [taskId]: {
                                ...task,
                                subtasks: [...(task.subtasks || []), ...tempSubtasks],
                                history: [historyEntry, ...(task.history || [])],
                                updatedAt: new Date().toISOString()
                            }
                        }
                    }
                }
            }
        };
        syncCache(newState);
        return newState;
    });

    try {
        await api.data.addSubtasks(taskId, newSubtasksData, creatorId);
        setTimeout(() => fetchData(), 500);
    } catch (err) {
        await fetchData();
    }
  }, [fetchData, currentUser]);

  const updateSubtask = useCallback(async (projectId: string, taskId: string, subtaskId: string, updates: Partial<Subtask>) => {
    optimisticTouch(projectId, taskId);
    setState(prevState => {
        const project = prevState.projects[projectId];
        if (!project || !project.board.tasks[taskId]) return prevState;
        const task = project.board.tasks[taskId];
        const updatedSubtasks = task.subtasks.map(s => s.id === subtaskId ? { ...s, ...updates } : s);
        return {
            ...prevState,
            projects: {
                ...prevState.projects,
                [projectId]: {
                    ...project,
                    board: {
                        ...project.board,
                        tasks: {
                            ...project.board.tasks,
                            [taskId]: { ...task, subtasks: updatedSubtasks, updatedAt: new Date().toISOString() }
                        }
                    }
                }
            }
        };
    });

    try {
        await api.data.updateSubtask(subtaskId, updates);
        setTimeout(() => fetchData(), 800);
    } catch (err) {
        await fetchData();
    }
  }, [fetchData]);

  const deleteSubtask = useCallback(async (projectId: string, taskId: string, subtaskId: string) => {
    optimisticTouch(projectId, taskId);
    setState(prevState => {
        const project = prevState.projects[projectId];
        if (!project || !project.board.tasks[taskId]) return prevState;
        const task = project.board.tasks[taskId];
        const updatedSubtasks = task.subtasks.filter(s => s.id !== subtaskId);
        return {
            ...prevState,
            projects: {
                ...prevState.projects,
                [projectId]: {
                    ...project,
                    board: {
                        ...project.board,
                        tasks: {
                            ...project.board.tasks,
                            [taskId]: { ...task, subtasks: updatedSubtasks, updatedAt: new Date().toISOString() }
                        }
                    }
                }
            }
        };
    });

    try {
        await api.data.deleteSubtask(subtaskId);
        setTimeout(() => fetchData(), 800);
    } catch (err) {
        await fetchData();
    }
  }, [fetchData]);

  const addComment = useCallback(async (projectId: string, taskId: string, commentText: string, author: User) => {
      optimisticTouch(projectId, taskId);
      setState(prevState => {
        const project = prevState.projects[projectId];
        if (!project || !project.board.tasks[taskId]) return prevState;
        
        const task = project.board.tasks[taskId];
        const newCommentObj = {
            id: `temp-comment-${Date.now()}`,
            text: commentText,
            author,
            createdAt: new Date().toISOString()
        };

        const newState = {
            ...prevState,
            projects: {
                ...prevState.projects,
                [projectId]: {
                    ...project,
                    board: {
                        ...project.board,
                        tasks: {
                            ...project.board.tasks,
                            [taskId]: {
                                ...task,
                                comments: [newCommentObj, ...(task.comments || [])],
                                updatedAt: new Date().toISOString()
                            }
                        }
                    }
                }
            }
        };
        syncCache(newState);
        return newState;
      });

      try {
        await api.data.addComment(taskId, commentText, author.id);
        setTimeout(() => fetchData(), 500);
      } catch (err) {
        await fetchData();
      }
  }, [fetchData]);

  const addTask = useCallback(async (projectId: string, taskData: NewTaskData, creatorId: string) => {
    optimisticTouch(projectId);
    const newTask = await api.data.addTask(taskData, creatorId);
    if (newTask && currentUser) {
      await api.data.moveTask(newTask.id, taskData.columnId, 1, currentUser.id);
    }
    await fetchData();
  }, [fetchData, currentUser]);

  const addTasksBatch = useCallback(async (projectId: string, tasksToCreate: AiGeneratedTaskFromFile[], sprintId: string | null) => {
    if (!currentUser) return;
    const project = state.projects[projectId];
    if (!project) return;
    
    optimisticTouch(projectId);
    
    const columnMap = new Map<string, string>();
    for (const colId of project.board.columnOrder) {
        const col = project.board.columns[colId];
        if (col?.title) {
            columnMap.set(col.title.toLowerCase().trim(), col.id);
        }
    }
    
    const firstColumnId = project.board.columnOrder[0];
    const tasksData = tasksToCreate.map(task => {
        const statusKey = (task.status || '').toLowerCase().trim();
        return {
            title: task.title,
            description: task.description,
            priority: task.priority,
            column_id: columnMap.get(statusKey) || firstColumnId,
            creator_id: currentUser.id,
            sprint_id: sprintId, 
            tags: []
        };
    });

    if (tasksData.length > 0) {
        try {
            await api.data.addTasksBatch(tasksData);
            await fetchData();
        } catch (err) {
            await fetchData();
        }
    }
  }, [fetchData, currentUser, state.projects]);

  const addAiTask = useCallback(async (projectId: string, prompt: string) => {
    if (!currentUser) throw new Error("User must be logged in to create a task.");
    const project = state.projects[projectId];
    if (!project || project.board.columnOrder.length === 0) throw new Error("Cannot add AI task to a project with no columns.");

    optimisticTouch(projectId);
    const generatedData = await generateTaskFromPrompt(prompt);
    const taskData: NewTaskData = {
        title: generatedData.title,
        description: generatedData.description,
        priority: generatedData.priority,
        columnId: project.board.columnOrder[0], 
        dueDate: generatedData.dueDate,
    };

    const newTask = await api.data.addTask(taskData, currentUser.id);
    if (newTask) {
      await api.data.moveTask(newTask.id, taskData.columnId, 1, currentUser.id);
    }
    await fetchData();
  }, [fetchData, state.projects, currentUser]);


  const deleteTask = useCallback(async (projectId: string, taskId: string, columnId: string) => {
    optimisticTouch(projectId);
    setState(prevState => {
        const project = prevState.projects[projectId];
        if (!project) return prevState;
        
        const newTasks = { ...project.board.tasks };
        delete newTasks[taskId];

        const newColumns = { ...project.board.columns };
        if (newColumns[columnId]) {
            newColumns[columnId] = {
                ...newColumns[columnId],
                taskIds: newColumns[columnId].taskIds.filter(id => id !== taskId)
            };
        }

        const newState = {
            ...prevState,
            projects: {
                ...prevState.projects,
                [projectId]: {
                    ...project,
                    board: {
                        ...project.board,
                        tasks: newTasks,
                        columns: newColumns
                    }
                }
            }
        };
        syncCache(newState);
        return newState;
    });

    try {
        await api.data.deleteTask(taskId);
    } catch (err) {
        await fetchData();
    }
  }, [fetchData]);

  const addColumn = useCallback(async (projectId: string, title: string) => {
      optimisticTouch(projectId);
      await api.data.addColumn(projectId, title);
      await fetchData();
  }, [fetchData]);

  const deleteColumn = useCallback(async (projectId: string, columnId: string) => {
    optimisticTouch(projectId);
    await api.data.deleteColumn(columnId);
    await fetchData();
  }, [fetchData]);

  const addProject = useCallback(async (name: string, description: string, creatorId: string) => {
    await api.data.addProject(name, description, creatorId);
    await fetchData();
  }, [fetchData]);

  const addProjectFromPlan = useCallback(async (plan: AiGeneratedProjectPlan) => {
    if (!currentUser) throw new Error("User must be logged in.");
    const newProject = await api.data.createProjectShell(plan.name, plan.description, currentUser.id);

    for (const col of plan.columns) {
        const newColumn = await api.data.addColumn(newProject.id, col.title);
        if (newColumn) {
            for (const task of col.tasks) {
                const taskData: NewTaskData = {
                    title: task.title,
                    description: task.description,
                    priority: task.priority,
                    columnId: newColumn.id,
                };
                const newTask = await api.data.addTask(taskData, currentUser.id);
                if (newTask && task.subtasks && task.subtasks.length > 0) {
                    await api.data.addSubtasks(newTask.id, task.subtasks, currentUser.id);
                }
            }
        }
    }
    await fetchData();
  }, [fetchData, currentUser]);

  const deleteProject = useCallback(async (projectId: string) => {
    await api.data.deleteProject(projectId);
    await fetchData();
  }, [fetchData]);

  const updateUserProfile = useCallback(async (updates: { name: string }) => {
    if (!userId) return;
    await api.auth.updateUserProfile(userId, updates);
    await fetchData();
  }, [fetchData, userId]);

  const updateProjectMembers = useCallback(async (projectId: string, memberIds: string[]) => {
      optimisticTouch(projectId);
      await api.data.updateProjectMembers(projectId, memberIds);
      await fetchData();
  }, [fetchData]);
  
  const sendChatMessage = useCallback(async (projectId: string, text: string, author: User) => {
    playSentSound();
    optimisticTouch(projectId);
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: ChatMessage = {
        id: tempId,
        text,
        author,
        createdAt: new Date().toISOString(),
    };

    setState(prevState => {
        const project = prevState.projects[projectId];
        if (!project) return prevState;
        const newState = {
            ...prevState,
            projects: {
                ...prevState.projects,
                [projectId]: {
                    ...project,
                    chatMessages: [...project.chatMessages, optimisticMessage],
                    updatedAt: new Date().toISOString()
                }
            }
        };
        syncCache(newState);
        return newState;
    });

    try {
        sendSocketChatMessage(projectId, text);
    } catch (error) {
        setState(prevState => {
            const project = prevState.projects[projectId];
            if (!project) return prevState;
            return {
                ...prevState,
                projects: {
                    ...prevState.projects,
                    [projectId]: { ...project, chatMessages: project.chatMessages.filter(m => m.id !== tempId) }
                }
            }
        });
    }
  }, []);
  
  const addProjectLink = useCallback(async (projectId: string, title: string, url: string, creatorId: string) => {
    optimisticTouch(projectId);
    await api.data.addProjectLink(projectId, title, url, creatorId);
    await fetchData();
  }, [fetchData]);

  const deleteProjectLink = useCallback(async (linkId: string) => {
      // FIX: Cast Object.values to Project[] to avoid unknown type errors when searching for the project containing the link.
      const projectEntry = (Object.values(state.projects || {}) as Project[]).find(p => p.links.some(l => l.id === linkId));
      if (projectEntry) optimisticTouch(projectEntry.id);
      await api.data.deleteProjectLink(linkId);
      await fetchData();
  }, [fetchData, state.projects]);



  const addSprint = useCallback(async (projectId: string, sprintData: Omit<Sprint, 'id' | 'projectId' | 'createdAt' | 'status' | 'isDefault'> & { isDefault?: boolean }): Promise<Sprint> => {
    optimisticTouch(projectId);
    const newSprint = await api.data.addSprint({ ...sprintData, projectId });
    await fetchData();
    return newSprint;
  }, [fetchData]);

  const updateSprint = useCallback(async (projectId: string, sprintId: string, updates: Partial<Sprint>) => {
    optimisticTouch(projectId);
    await api.data.updateSprint(sprintId, updates);
    await fetchData();
  }, [fetchData]);

  const deleteSprint = useCallback(async (projectId: string, sprintId: string) => {
    optimisticTouch(projectId);
    await api.data.deleteSprint(sprintId);
    await fetchData();
  }, [fetchData]);

  const bulkUpdateTaskSprint = useCallback(async (taskIds: string[], sprintId: string | null) => {
    if (taskIds.length > 0) {
        // FIX: Cast Object.values to Project[] to avoid unknown type errors when searching for the project containing the tasks.
        const projectEntry = (Object.values(state.projects || {}) as Project[]).find(p => p.board.tasks[taskIds[0]]);
        if (projectEntry) optimisticTouch(projectEntry.id);
    }
    await api.data.bulkUpdateTaskSprint(taskIds, sprintId);
    await fetchData();
  }, [fetchData, state.projects]);

  const completeSprint = async (sprintId: string, moveToSprintId: string | null) => {
    // FIX: Cast Object.values to Project[] to avoid unknown type errors when searching for the project containing the sprint.
    const projectEntry = (Object.values(state.projects || {}) as Project[]).find(p => p.sprints.some(s => s.id === sprintId));
    if (projectEntry) optimisticTouch(projectEntry.id);
    
    const incompleteTaskIds: string[] = [];
    if (projectEntry) {
        const columns = Object.values(projectEntry.board.columns || {});
        for (const column of columns) {
            if (column.title.toLowerCase() !== 'done') {
                for (const taskId of column.taskIds) {
                    const task = projectEntry.board.tasks[taskId];
                    if (task && task.sprintId === sprintId) {
                        incompleteTaskIds.push(taskId);
                    }
                }
            }
        }
    }

    await api.data.completeSprint(sprintId, moveToSprintId, incompleteTaskIds);
    await fetchData();
  };

  const addFilterSegment = useCallback(async (projectId: string, name: string, filters: FilterSegment['filters'], creatorId: string) => {
    optimisticTouch(projectId);
    await api.data.addFilterSegment(projectId, name, filters, creatorId);
    await fetchData();
  }, [fetchData]);

  const updateFilterSegment = async (segmentId: string, updates: { name?: string, filters?: FilterSegment['filters'] }) => {
    // FIX: Cast Object.values to Project[] to avoid unknown type errors when searching for the project containing the filter segment.
    const projectEntry = (Object.values(state.projects || {}) as Project[]).find(p => p.filterSegments.some(s => s.id === segmentId));
    if (projectEntry) optimisticTouch(projectEntry.id);
    await api.data.updateFilterSegment(segmentId, updates);
    await fetchData();
  };

  const deleteFilterSegment = useCallback(async (segmentId: string) => {
    // FIX: Cast Object.values to Project[] to avoid unknown type errors when searching for the project containing the filter segment.
    const projectEntry = (Object.values(state.projects || {}) as Project[]).find(p => p.filterSegments.some(s => s.id === segmentId));
    if (projectEntry) optimisticTouch(projectEntry.id);
    await api.data.deleteFilterSegment(segmentId);
    await fetchData();
  }, [fetchData, state.projects]);

  const duplicateTask = useCallback(async (projectId: string, taskId: string) => {
    if (!currentUser) return;
    const project = state.projects[projectId];
    if (!project) return;
    const originalTask = project.board.tasks[taskId];
    if (!originalTask) return;

    optimisticTouch(projectId);
    
    const filteredTags = (originalTask.tags || []).filter(t => !t.startsWith('type:') && !t.startsWith('ref:'));

    const taskData: NewTaskData = {
      title: `${originalTask.title} (Copy)`,
      description: originalTask.description || '',
      priority: originalTask.priority,
      columnId: project.board.columnOrder[0],
      assigneeId: originalTask.assignee?.id || undefined,
      dueDate: originalTask.dueDate || undefined,
      sprintId: originalTask.sprintId || null,
      taskType: originalTask.taskType || 'task',
      referenceNo: originalTask.ticketId,
      tags: filteredTags
    };

    let foundColumnId = project.board.columnOrder[0];
    for (const colId of project.board.columnOrder) {
      const col = project.board.columns[colId];
      if (col && col.taskIds && col.taskIds.includes(taskId)) {
        foundColumnId = colId;
        break;
      }
    }
    taskData.columnId = foundColumnId;

    const newTask = await api.data.addTask(taskData, currentUser.id);
    if (newTask) {
      try {
        await api.data.moveTask(newTask.id, foundColumnId, 1, currentUser.id);
      } catch (moveErr) {
        console.warn("Graceful warning: moveTask failed during duplication:", moveErr);
      }
      try {
        await api.data.logTaskHistory(newTask.id, currentUser.id, `duplicated from item ${originalTask.ticketId}`);
      } catch (histErr) {
        console.warn("Graceful warning: logTaskHistory failed during duplication:", histErr);
      }
    }
    await fetchData();
  }, [state.projects, currentUser, fetchData]);


  return { state, loading, fetchData, onDragEnd, updateTask, addSubtasks, updateSubtask, deleteSubtask, addComment, addTask, duplicateTask, addAiTask, deleteTask, addColumn, deleteColumn, addProject, addProjectFromPlan, deleteProject, updateUserProfile, updateProjectMembers, sendChatMessage, addProjectLink, deleteProjectLink, addTasksBatch, addSprint, updateSprint, deleteSprint, bulkUpdateTaskSprint, completeSprint, addFilterSegment, updateFilterSegment, deleteFilterSegment };
};
