
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { DragDropContext, Draggable, DropResult } from 'react-beautiful-dnd';
import { StrictModeDroppable } from './StrictModeDroppable';
import { Column as ColumnType, BoardData, Task, Subtask, User, ChatMessage, FilterSegment, Project, TaskPriority, AiGeneratedTaskFromFile, Sprint, NewTaskData } from '../types';
import { Column } from './Column';
import { Filters } from './Filters';
import { api, generateProjectCode } from '../services/api';
import { RefreshCw, Bug, FileText, ChevronLeft, ChevronRight, Hash, FolderTree } from 'lucide-react';
import { RightControlDeck } from './RightControlDeck';
import { PlusIcon, LayoutDashboardIcon, GitBranchIcon, TableIcon, LifeBuoyIcon, RocketIcon, DownloadIcon, XIcon, SparklesIcon, ZapIcon, LinkIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon } from './Icons';
import { ProjectChat } from './ProjectChat';
import { AiTaskCreator } from './AiTaskCreator';
import { TaskGraphView } from './TaskGraphView';
import { ProjectLinksManager } from './ProjectLinksManager';
import { TaskTableView } from './TaskTableView';
import { Pagination } from './Pagination';
import { TaskImportDropzone } from './TaskImportDropzone';
import { generateTasksFromFile } from '../services/geminiService';
import { TaskConfirmationModal } from './TaskConfirmationModal';
import { SprintsPage } from './SprintsPage';
import { BulkActionsBar } from './BulkActionsBar';
import { UserAvatar } from './UserAvatar';
import { BulkUpdateSprintModal } from './BulkUpdateSprintModal';
import { CompleteSprintModal } from './CompleteSprintModal';
import { CreateTaskModal } from './CreateTaskModal';
import { exportAugmentedTasksToCsv, exportTasksToPdf } from '../utils/export';
import { AugmentedTask } from '../types';
import { useConfirmation } from '../App';


interface KanbanBoardProps {
  project: Project;
  projects?: Project[];
  currentUser: User;
  users: User[];
  onlineUsers: Set<string>;
  aiFeaturesEnabled: boolean;
  projectView: 'board' | 'table' | 'graph' | 'sprints';
  setProjectView: (view: 'board' | 'table' | 'graph' | 'sprints') => void;
  onDragEnd: (result: DropResult, filteredData?: BoardData) => Promise<void>;
  updateTask: (task: Task) => Promise<void>;
  addSubtasks: (taskId: string, subtasks: Partial<Subtask>[], creatorId: string) => Promise<void>;
  addComment: (taskId: string, commentText: string) => Promise<void>;
  addAiTask: (prompt: string) => Promise<void>;
  addTask: (taskData: NewTaskData) => Promise<void>;
  deleteTask: (taskId: string, columnId: string) => Promise<void>;
  addColumn: (title: string) => Promise<void>;
  deleteColumn: (columnId: string) => Promise<void>;
  isChatOpen: boolean;
  onCloseChat: () => void;
  chatMessages: ChatMessage[];
  onSendMessage: (projectId: string, text: string) => Promise<void>;
  onTaskClick: (task: Task) => void;
  addProjectLink: (title: string, url: string) => Promise<void>;
  deleteProjectLink: (linkId: string) => Promise<void>;
  addTasksBatch: (tasks: AiGeneratedTaskFromFile[], sprintId: string | null) => Promise<void>;
  addSprint: (sprintData: Omit<Sprint, 'id' | 'projectId' | 'createdAt' | 'status' | 'isDefault'> & { isDefault?: boolean }) => Promise<Sprint>;
  updateSprint: (sprintId: string, updates: Partial<Sprint>) => Promise<void>;
  deleteSprint: (sprintId: string) => Promise<void>;
  bulkUpdateTaskSprint: (taskIds: string[], sprintId: string | null) => Promise<void>;
  completeSprint: (sprintId: string, moveToSprintId: string | null) => Promise<void>;
  addFilterSegment: (name: string, filters: FilterSegment['filters']) => Promise<void>;
  updateFilterSegment: (segmentId: string, updates: { name?: string, filters?: FilterSegment['filters'] }) => Promise<void>;
  deleteFilterSegment: (segmentId: string) => Promise<void>;
  duplicateTask?: (taskId: string) => Promise<void>;
  isControlDeckOpen?: boolean;
  setIsControlDeckOpen?: (val: boolean) => void;
  fetchChatMessagesForProject: (projectId: string) => Promise<void>;
  updateTasksFromBoard?: (tasksList: Task[]) => void;
}

const AddColumn: React.FC<{onAddColumn: (title: string) => void}> = ({ onAddColumn }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState('');
  const buttonRef = useRef<HTMLButtonElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const handleSubmit = () => {
    if (title.trim()) {
      onAddColumn(title.trim());
      setTitle('');
      setIsEditing(false);
    }
  };
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isEditing &&
        formRef.current &&
        !formRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsEditing(false);
        setTitle('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isEditing]);


  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setIsEditing(true)}
        className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 text-white text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-white/10 transition-all h-9"
      >
        <PlusIcon className="w-3.5 h-3.5" />
        Column
      </button>
      {isEditing && (
        <div ref={formRef} className="absolute top-full right-0 mt-2 p-3 bg-[#131C1B] border border-gray-800 rounded-xl shadow-2xl z-50 w-64">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="Enter column title..."
            className="w-full p-2 border border-gray-700 rounded-lg bg-[#1C2326] focus:outline-none focus:ring-2 focus:ring-gray-500 text-white text-xs"
          />
          <div className="mt-2 flex items-center gap-2">
            <button onClick={handleSubmit} className="flex-grow py-1.5 bg-gray-300 text-black font-bold rounded-lg text-[10px] uppercase tracking-wider hover:bg-gray-400">Add</button>
            <button onClick={() => setIsEditing(false)} className="px-3 py-1.5 text-gray-500 hover:text-white rounded-lg text-[10px] font-bold uppercase tracking-wider">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

const SelectHeadersModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  headers: string[];
  onConfirm: (selectedHeaders: string[]) => void;
}> = ({ isOpen, onClose, headers, onConfirm }) => {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const handleToggle = (header: string) => {
    setSelected(prev => {
      const newSet = new Set(prev);
      if (newSet.has(header)) {
        newSet.delete(header);
      } else {
        newSet.add(header);
      }
      return newSet;
    });
  };

  const handleSubmit = () => {
    onConfirm(Array.from(selected));
  };
  
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#131C1B] rounded-xl shadow-2xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <header className="p-4 border-b border-gray-800 flex justify-between items-center">
          <h2 className="text-lg font-bold text-white">Select Columns to Import</h2>
          <button onClick={onClose} className="p-2 rounded-full text-gray-400 hover:bg-gray-800"><XIcon className="w-6 h-6" /></button>
        </header>
        <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
          <p className="text-sm text-gray-400 mb-4">Choose which columns from your CSV to include in each task's description.</p>
          <div className="space-y-2">
            {headers.map((header, index) => (
              <label key={index} className="flex items-center gap-3 p-2 bg-gray-800/50 rounded-md cursor-pointer hover:bg-gray-800">
                <input type="checkbox" checked={selected.has(header)} onChange={() => handleToggle(header)} className="w-4 h-4 rounded text-gray-500 bg-gray-700 border-gray-600 focus:ring-gray-500" />
                <span className="text-sm text-white">{header}</span>
              </label>
            ))}
          </div>
        </div>
        <footer className="p-4 bg-[#1C2326]/50 rounded-b-xl flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-700 text-white font-semibold rounded-lg hover:bg-gray-600">Cancel</button>
          <button onClick={handleSubmit} className="px-4 py-2 bg-gray-300 text-black font-semibold rounded-lg hover:bg-gray-400 flex items-center gap-2">
            Continue
          </button>
        </footer>
      </div>
    </div>,
    document.body
  );
};

const viewOptions = [
  { id: 'board', label: 'Board', icon: LayoutDashboardIcon },
  { id: 'table', label: 'Table', icon: TableIcon },
  { id: 'graph', label: 'Graph', icon: GitBranchIcon },
  { id: 'sprints', label: 'Sprints', icon: RocketIcon },
];

export const KanbanBoard: React.FC<KanbanBoardProps> = ({ 
    project, projects = [], currentUser, users, onlineUsers, aiFeaturesEnabled,
    projectView, setProjectView,
    onDragEnd, 
    updateTask, addSubtasks, addComment, addAiTask, addTask, deleteTask, addColumn, 
    deleteColumn, isChatOpen, onCloseChat, chatMessages, onSendMessage, onTaskClick, 
    addProjectLink, deleteProjectLink,
    addTasksBatch, addSprint, updateSprint, deleteSprint, bulkUpdateTaskSprint, completeSprint,
    addFilterSegment, updateFilterSegment, deleteFilterSegment, duplicateTask,
    isControlDeckOpen: externalControlDeckOpen,
    setIsControlDeckOpen: setExternalControlDeckOpen,
    fetchChatMessagesForProject,
    updateTasksFromBoard
}) => {
  const navigate = useNavigate();
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string[]>([]);
  const [assigneeFilter, setAssigneeFilter] = useState<string[]>([]);
  const [reporterFilter, setReporterFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [sprintFilter, setSprintFilter] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [relativeTimeValue, setRelativeTimeValue] = useState('');
  const [relativeTimeUnit, setRelativeTimeUnit] = useState<FilterSegment['filters']['relativeTimeUnit']>('hours');
  const [relativeTimeCondition, setRelativeTimeCondition] = useState<FilterSegment['filters']['relativeTimeCondition']>('within');
  const [dateTarget, setDateTarget] = useState<'createdAt' | 'dueDate'>('createdAt');
  
  const [tableCurrentPage, setTableCurrentPage] = useState(1);
  const TABLE_ITEMS_PER_PAGE = 15;

  // Server-Side Paginated Board State
  const [tasksPage, setTasksPage] = useState(1);
  const [tasksLimit, setTasksLimit] = useState(20);
  const [columnPage, setColumnPage] = useState(1);
  const [columnLimit, setColumnLimit] = useState(10);
  const [taskTypeFilter, setTaskTypeFilter] = useState<'all' | 'task' | 'bug'>('all');
  const [parentIdFilter, setParentIdFilter] = useState<string | null>(null);

  const [boardLoading, setBoardLoading] = useState(false);
  const [apiBoardData, setApiBoardData] = useState<any | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const updateTasksRef = useRef(updateTasksFromBoard);
  useEffect(() => {
    updateTasksRef.current = updateTasksFromBoard;
  }, [updateTasksFromBoard]);

  const refreshBoard = useCallback(async () => {
    if (!project?.id) return;
    setBoardLoading(true);
    try {
      const response = await api.data.fetchBoardPaginated({
        projectId: project.id,
        page: tasksPage,
        limit: tasksLimit,
        columnPage,
        columnLimit,
        sort: {
          field: 'updatedAt',
          order: 'desc'
        },
        filters: {
          search: searchTerm || undefined,
          priority: priorityFilter.length > 0 ? priorityFilter[0] as TaskPriority : undefined,
          priorities: priorityFilter.length > 0 ? priorityFilter : undefined,
          taskType: taskTypeFilter === 'all' ? undefined : taskTypeFilter as 'task' | 'bug',
          taskTypes: taskTypeFilter === 'all' ? undefined : [taskTypeFilter as 'task' | 'bug'],
          parentId: parentIdFilter || undefined,
          savedFilterId: activeSegmentId && activeSegmentId !== 'all' ? activeSegmentId : undefined,
          assignees: assigneeFilter.length > 0 ? assigneeFilter : undefined,
          reporters: reporterFilter.length > 0 ? reporterFilter : undefined,
          columns: statusFilter.length > 0 ? statusFilter : undefined,
          tags: tagFilter.length > 0 ? tagFilter : undefined,
          sprints: sprintFilter.length > 0 ? sprintFilter : undefined,
          dateRange: (startDate || endDate) ? {
            field: dateTarget || 'createdAt',
            start: startDate || undefined,
            end: endDate || undefined,
          } : undefined,
          relativeDate: relativeTimeValue ? {
            condition: relativeTimeCondition || 'within',
            value: parseInt(relativeTimeValue) || 0,
            unit: relativeTimeUnit || 'hours',
          } : undefined,
        }
      });
      setApiBoardData(response);
      setApiError(null);
      if (response && response.tasks) {
        const rawTasks = Array.isArray(response.tasks) ? response.tasks : [];
        const projectCode = project ? generateProjectCode(project.name) : 'TSK';
        const normalizedTasks = rawTasks.map((task: any) => {
          const colId = task.columnId || task.column_id || task.currentColumnId;
          if (colId) {
            task.columnId = colId;
          }
          const originalTicketId = task.ticketId || task.ticket_id;
          let ticketId = originalTicketId;
          if (!ticketId) {
            const ticketTag = (task.tags || []).find((tagStr: string) => tagStr && tagStr.startsWith('ticket:'));
            if (ticketTag) {
              ticketId = ticketTag.split(':')[1];
            }
          }
          
          if (ticketId && projectCode === 'SLO') {
            const numMatch = ticketId.match(/\d+/);
            if (numMatch) {
              const num = parseInt(numMatch[0], 10);
              ticketId = `SLO${num.toString().padStart(5, '0')}`;
            }
          }
          
          if (ticketId) {
            task.ticketId = ticketId;
          } else {
            if (projectCode === 'SLO') {
              task.ticketId = `SLO00001`;
            } else {
              task.ticketId = `${projectCode}-${task.id.substring(0, 4)}`;
            }
          }
          return task;
        });
        if (updateTasksRef.current) {
          updateTasksRef.current(normalizedTasks);
        }
      }
    } catch (err: any) {
      console.error("Failed to load paginated board:", err);
      setApiError(err?.message || "Failed to fetch board data");
    } finally {
      setBoardLoading(false);
    }
  }, [
    project?.id,
    project?.name,
    tasksPage,
    tasksLimit,
    columnPage,
    columnLimit,
    searchTerm,
    priorityFilter,
    taskTypeFilter,
    parentIdFilter,
    activeSegmentId,
    assigneeFilter,
    reporterFilter,
    statusFilter,
    tagFilter,
    sprintFilter,
    startDate,
    endDate,
    relativeTimeValue,
    relativeTimeUnit,
    relativeTimeCondition,
    dateTarget,
  ]);

  useEffect(() => {
    refreshBoard();
  }, [refreshBoard]);

  // Interceptors to automatically refresh the server-side state upon updates
  const handleUpdateTask = async (t: Task) => {
    await updateTask(t);
    refreshBoard();
  };

  const handleAddTask = async (td: NewTaskData) => {
    await addTask(td);
    refreshBoard();
  };

  const handleDeleteTask = async (tid: string, cid: string) => {
    await deleteTask(tid, cid);
    refreshBoard();
  };

  const handleAddColumn = async (titleText: string) => {
    await addColumn(titleText);
    refreshBoard();
  };

  const handleDeleteColumn = async (cid: string) => {
    await deleteColumn(cid);
    refreshBoard();
  };

  const handleDuplicateTask = async (tid: string) => {
    await duplicateTask(tid);
    refreshBoard();
  };

  const [internalControlDeckOpen, setInternalControlDeckOpen] = useState(true);
  
  const isControlDeckOpen = externalControlDeckOpen !== undefined ? externalControlDeckOpen : internalControlDeckOpen;
  const setIsControlDeckOpen = setExternalControlDeckOpen || setInternalControlDeckOpen;
  
  const boardData = project.board;
  const requestConfirmation = useConfirmation();

  // Mouse wheel/scroller key click and drag scrolling logic
  const boardScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const isCenterDragging = useRef(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const startScrollLeft = useRef(0);
  const startScrollTop = useRef(0);

  // Auto scroll on item/column drag near edges logic
  const isDraggingHorizontal = useRef(false);
  const scrollSpeed = useRef(0);
  const scrollAnimationFrameId = useRef<number | null>(null);

  const startAutoScrollLoop = useCallback(() => {
    if (scrollAnimationFrameId.current) return;
    
    const scrollUpdate = () => {
      if (!isDraggingHorizontal.current) {
        scrollAnimationFrameId.current = null;
        return;
      }
      
      const container = boardScrollContainerRef.current;
      if (container && scrollSpeed.current !== 0) {
        container.scrollLeft += scrollSpeed.current;
      }
      
      scrollAnimationFrameId.current = requestAnimationFrame(scrollUpdate);
    };
    
    scrollAnimationFrameId.current = requestAnimationFrame(scrollUpdate);
  }, []);

  const stopAutoScrollLoop = useCallback(() => {
    if (scrollAnimationFrameId.current) {
      cancelAnimationFrame(scrollAnimationFrameId.current);
      scrollAnimationFrameId.current = null;
    }
    scrollSpeed.current = 0;
  }, []);

  const handleGlobalMouseMoveForDrag = useCallback((e: MouseEvent) => {
    if (!isDraggingHorizontal.current || !boardScrollContainerRef.current) {
      scrollSpeed.current = 0;
      return;
    }
    
    const container = boardScrollContainerRef.current;
    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX;
    const mouseY = e.clientY;
    
    // Check if vertical position is within or close to the container to avoid false positive triggers outside the board
    if (mouseY < rect.top - 100 || mouseY > rect.bottom + 100) {
      scrollSpeed.current = 0;
      return;
    }

    const leftThreshold = rect.left + 150; // 150px from left edge
    const rightThreshold = rect.right - 150; // 150px from right edge
    
    if (mouseX < leftThreshold && mouseX >= rect.left - 50) {
      // Scale scroll speed based on proximity to left boundary
      const ratio = (leftThreshold - mouseX) / 150;
      scrollSpeed.current = -Math.round(Math.max(3, ratio * 24));
    } else if (mouseX > rightThreshold && mouseX <= rect.right + 50) {
      // Scale scroll speed based on proximity to right boundary
      const ratio = (mouseX - rightThreshold) / 150;
      scrollSpeed.current = Math.round(Math.max(3, ratio * 24));
    } else {
      scrollSpeed.current = 0;
    }
  }, []);

  useEffect(() => {
    const onGlobalMouseMove = (e: MouseEvent) => {
      handleGlobalMouseMoveForDrag(e);
    };
    
    window.addEventListener('mousemove', onGlobalMouseMove, true);
    return () => {
      window.removeEventListener('mousemove', onGlobalMouseMove, true);
      if (scrollAnimationFrameId.current) {
        cancelAnimationFrame(scrollAnimationFrameId.current);
      }
    };
  }, [handleGlobalMouseMoveForDrag]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // 1 is the scroll wheel (middle click / scroller key)
    if (e.button === 1) {
      e.preventDefault();
      isCenterDragging.current = true;
      startX.current = e.pageX - (boardScrollContainerRef.current?.offsetLeft || 0);
      startY.current = e.pageY - (boardScrollContainerRef.current?.offsetTop || 0);
      startScrollLeft.current = boardScrollContainerRef.current?.scrollLeft || 0;
      startScrollTop.current = boardScrollContainerRef.current?.scrollTop || 0;
      if (boardScrollContainerRef.current) {
        boardScrollContainerRef.current.style.cursor = 'grabbing';
        boardScrollContainerRef.current.style.userSelect = 'none';
      }
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isCenterDragging.current || !boardScrollContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - boardScrollContainerRef.current.offsetLeft;
    const y = e.pageY - boardScrollContainerRef.current.offsetTop;
    const walkX = (x - startX.current) * 1.5;
    const walkY = (y - startY.current) * 1.5;
    boardScrollContainerRef.current.scrollLeft = startScrollLeft.current - walkX;
    boardScrollContainerRef.current.scrollTop = startScrollTop.current - walkY;
  }, []);

  const handleMouseUpOrLeave = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (isCenterDragging.current) {
      isCenterDragging.current = false;
      if (boardScrollContainerRef.current) {
        boardScrollContainerRef.current.style.cursor = '';
        boardScrollContainerRef.current.style.userSelect = '';
      }
    }
  }, []);

  const filteredBoardData: BoardData = useMemo(() => {
    // If we have API-loaded paginated board data, reconstruct the board object!
    if (apiBoardData && apiBoardData.columns) {
      const columns: Record<string, ColumnType> = {};
      const tasks: Record<string, Task> = {};
      
      apiBoardData.columns.forEach((col: any) => {
        columns[col.id] = {
          id: col.id,
          title: col.title,
          taskIds: [],
        };
      });
      
      const rawTasks = Array.isArray(apiBoardData.tasks) ? apiBoardData.tasks : [];
      rawTasks.forEach((task: any) => {
        const colId = task.columnId || task.column_id || task.currentColumnId;
        if (colId) {
          task.columnId = colId;
        }
        const originalTicketId = task.ticketId || task.ticket_id;
        const projectCode = project ? generateProjectCode(project.name) : 'TSK';
        let ticketId = originalTicketId;
        if (!ticketId) {
          const ticketTag = (task.tags || []).find((tagStr: string) => tagStr && tagStr.startsWith('ticket:'));
          if (ticketTag) {
            ticketId = ticketTag.split(':')[1];
          }
        }
        
        if (ticketId && projectCode === 'SLO') {
          const numMatch = ticketId.match(/\d+/);
          if (numMatch) {
            const num = parseInt(numMatch[0], 10);
            ticketId = `SLO${num.toString().padStart(5, '0')}`;
          }
        }
        
        if (ticketId) {
          task.ticketId = ticketId;
        } else {
          if (projectCode === 'SLO') {
            task.ticketId = `SLO00001`;
          } else {
            task.ticketId = `${projectCode}-${task.id.substring(0, 4)}`;
          }
        }
        tasks[task.id] = task;
        
        if (colId && columns[colId]) {
          columns[colId].taskIds.push(task.id);
        }
      });
      
      return {
        columns,
        tasks,
        columnOrder: apiBoardData.columnOrder || apiBoardData.columns.map((c: any) => c.id),
      };
    }

    const defaultBoard: BoardData = { tasks: {}, columns: {}, columnOrder: [] };
    if (!boardData?.tasks || !boardData?.columns) return defaultBoard;

    const taskIdToColumnIdMap = new Map<string, string>();
    const columns = boardData.columns || {};
    for (const column of Object.values(columns) as ColumnType[]) {
        if (column?.taskIds) {
            for (const taskId of column.taskIds) {
                taskIdToColumnIdMap.set(taskId, column.id);
            }
        }
    }

    const tasks = Object.values(boardData.tasks || {}) as Task[];
    let filteredTasks = tasks;

    if (searchTerm) {
      const search = (searchTerm || '').toLowerCase();
      filteredTasks = filteredTasks.filter(task => 
        (task.title || '').toLowerCase().includes(search) ||
        (task.description || '').toLowerCase().includes(search) ||
        (task.ticketId || '').toLowerCase().includes(search) ||
        (task.subtasks || []).some(st => (st.ticketId || '').toLowerCase().includes(search))
      );
    }

    if (priorityFilter.length > 0) {
      filteredTasks = filteredTasks.filter(task => priorityFilter.includes(task.priority));
    }

    if (assigneeFilter.length > 0) {
      filteredTasks = filteredTasks.filter(task => {
        const hasMainAssignee = task.assignee?.id ? assigneeFilter.includes(task.assignee.id) : false;
        const hasSubtaskAssignee = (task.subtasks || []).some(sub => 
          (sub.assignee?.id && assigneeFilter.includes(sub.assignee.id)) || 
          (sub.assigneeId && assigneeFilter.includes(sub.assigneeId))
        );
        return hasMainAssignee || hasSubtaskAssignee;
      });
    }

    if (reporterFilter.length > 0) {
      filteredTasks = filteredTasks.filter(task => reporterFilter.includes(task.creatorId));
    }
    
    if (statusFilter.length > 0) {
        filteredTasks = filteredTasks.filter(task => {
            const columnId = taskIdToColumnIdMap.get(task.id);
            if (!columnId) return false;
            const column = boardData.columns[columnId];
            return column && statusFilter.includes(column.title);
        });
    }

    if (tagFilter.length > 0) {
        filteredTasks = filteredTasks.filter(task => 
            task.tags && task.tags.some(tag => tagFilter.includes(tag))
        );
    }
    
    if (sprintFilter.length > 0) {
        filteredTasks = filteredTasks.filter(task => task.sprintId && sprintFilter.includes(task.sprintId));
    }

    if (startDate || endDate || relativeTimeValue) {
        const start = startDate ? (() => {
            const [y, m, d] = startDate.split('-').map(Number);
            return new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
        })() : null;
        
        const end = endDate ? (() => {
            const [y, m, d] = endDate.split('-').map(Number);
            return new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
        })() : null;
        
        filteredTasks = filteredTasks.filter(task => {
            const taskDate = dateTarget === 'dueDate' ? (task.dueDate ? new Date(task.dueDate).getTime() : 0) : new Date(task.createdAt).getTime();
            
            if (relativeTimeValue) {
                const now = new Date();
                const boundary = new Date();
                const relativeNum = parseInt(relativeTimeValue);
                if (isNaN(relativeNum)) return true;
                
                if (relativeTimeUnit === 'hours') boundary.setHours(now.getHours() - relativeNum);
                else if (relativeTimeUnit === 'days') boundary.setDate(now.getDate() - relativeNum);
                else if (relativeTimeUnit === 'months') boundary.setMonth(now.getMonth() - relativeNum);
                else if (relativeTimeUnit === 'years') boundary.setFullYear(now.getFullYear() - relativeNum);
                else if (relativeTimeUnit === 'minutes') boundary.setMinutes(now.getMinutes() - relativeNum);
                else if (relativeTimeUnit === 'seconds') boundary.setSeconds(now.getSeconds() - relativeNum);
                
                const boundaryTime = boundary.getTime();
                if (relativeTimeCondition === 'within') return taskDate >= boundaryTime;
                return taskDate < boundaryTime;
            }

            if (start && taskDate < start) return false;
            if (end && taskDate > end) return false;
            return true;
        });
    }

    // Sort tasks within columns if needed, but here we rebuild the board
    const newTasks: Record<string, Task> = {};
    filteredTasks.forEach(task => {
        newTasks[task.id] = task;
    });

    const newColumns: Record<string, ColumnType> = {};
    const filteredTaskIds = new Set(filteredTasks.map(t => t.id));

    boardData.columnOrder.forEach(colId => {
        const col = boardData.columns[colId];
        newColumns[colId] = {
            ...col,
            taskIds: col.taskIds.filter(tid => filteredTaskIds.has(tid))
        };
    });

    return {
        ...boardData,
        tasks: newTasks,
        columns: newColumns
    };
  }, [boardData, apiBoardData, searchTerm, priorityFilter, assigneeFilter, reporterFilter, statusFilter, tagFilter, sprintFilter, startDate, endDate, relativeTimeValue, relativeTimeUnit, relativeTimeCondition, dateTarget]);

  const allTasks = useMemo(() => {
    return Object.values(project?.board?.tasks || {}) as Task[];
  }, [project?.board?.tasks]);

  const filteredTasks = useMemo(() => {
    return Object.values(filteredBoardData?.tasks || {}) as Task[];
  }, [filteredBoardData?.tasks]);

  // FIX: Explicitly filter users to only those who are members of this project
  const projectMembers = useMemo(() => {
    return (project.members || []).map(id => users.find(u => u.id === id)).filter((u): u is User => !!u);
  }, [project.members, users]);

  const uniqueReporters = useMemo(() => {
    const tasks = boardData?.tasks ? Object.values(boardData.tasks) as Task[] : [];
    const creatorIds = Array.from(new Set(tasks.map(t => t.creatorId)));
    return creatorIds
      .map(id => users.find(u => u.id === id))
      .filter((u): u is User => !!u);
  }, [boardData?.tasks, users]);

  const handleDragStart = useCallback(() => {
    isDraggingHorizontal.current = true;
    startAutoScrollLoop();
  }, [startAutoScrollLoop]);

  const handleDragEnd = useCallback(async (result: DropResult) => {
    isDraggingHorizontal.current = false;
    stopAutoScrollLoop();
    await onDragEnd(result, filteredBoardData);
    refreshBoard();
  }, [onDragEnd, filteredBoardData, stopAutoScrollLoop, refreshBoard]);
  const [copiedViewId, setCopiedViewId] = useState<string | null>(null);
  
  const [tasksToConfirm, setTasksToConfirm] = useState<AiGeneratedTaskFromFile[] | null>(null);
  const [isAiParsing, setIsAiParsing] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [isBulkSprintModalOpen, setBulkSprintModalOpen] = useState(false);
  const [isCompleteSprintModalOpen, setCompleteSprintModalOpen] = useState(false);
  const [sprintToComplete, setSprintToComplete] = useState<Sprint | null>(null);

  const [isSelectHeadersModalOpen, setIsSelectHeadersModalOpen] = useState(false);
  const [headersToSelect, setHeadersToSelect] = useState<string[]>([]);
  const [fileForProcessing, setFileForProcessing] = useState<{ content: string; mimeType: string; name: string; } | null>(null);
  
  // Modals state
  const [isAiNexusOpen, setIsAiNexusOpen] = useState(false);
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  
  const handleSetProjectView = (view: 'board' | 'table' | 'graph' | 'sprints') => {
    setProjectView(view);
  };
  
  const applySegmentFilters = useCallback((segment: FilterSegment) => {
    setSearchTerm(segment.filters.searchTerm || '');
    setPriorityFilter(segment.filters.priorityFilter || []);
    setAssigneeFilter(segment.filters.assigneeFilter || []);
    setReporterFilter(segment.filters.reporterFilter || []);
    setStatusFilter(segment.filters.statusFilter || []);
    setTagFilter(segment.filters.tagFilter || []);
    setSprintFilter(segment.filters.sprintFilter || []);
    setStartDate(segment.filters.startDate || '');
    setEndDate(segment.filters.endDate || '');
    setRelativeTimeValue(segment.filters.relativeTimeValue || '');
    setRelativeTimeUnit(segment.filters.relativeTimeUnit || 'hours');
    setRelativeTimeCondition(segment.filters.relativeTimeCondition || 'within');
  }, []);

  // Handle shareable view links
  useEffect(() => {
    const hash = window.location.hash;
    const urlParams = new URLSearchParams(hash.split('?')[1]);
    const viewId = urlParams.get('view');

    if (viewId) {
        const segment = (project.filterSegments || []).find(s => s.id === viewId);
        if (segment) {
            applySegmentFilters(segment);
            setActiveSegmentId(segment.id);
        }
    }
  }, [project.filterSegments, applySegmentFilters]); 
  
  // Reset page when filters change
  useEffect(() => {
    setTableCurrentPage(1);
  }, [searchTerm, priorityFilter, assigneeFilter, statusFilter, tagFilter, sprintFilter, startDate, endDate, relativeTimeValue, relativeTimeUnit, relativeTimeCondition]);

  const handleApplySegment = (segmentId: string | null) => {
      setActiveSegmentId(segmentId);
      
      // Update URL hash to reflect the active view for sharing
      const currentPath = window.location.hash.split('?')[0];
      if (segmentId && segmentId !== 'all') {
          window.location.hash = `${currentPath}?view=${segmentId}`;
      } else {
          window.location.hash = currentPath;
      }

      if (segmentId === 'all' || segmentId === null) {
          setSearchTerm('');
          setPriorityFilter([]);
          setAssigneeFilter([]);
          setReporterFilter([]);
          setStatusFilter([]);
          setTagFilter([]);
          setSprintFilter([]);
          setStartDate('');
          setEndDate('');
          setRelativeTimeValue('');
          setRelativeTimeUnit('hours');
          setRelativeTimeCondition('within');
      } else {
          const segment = (project.filterSegments || []).find(s => s.id === segmentId);
          if (segment) {
            if (segment.name.toUpperCase() === 'NEURAL RESOURCE MESH') {
              navigate(`/project/${project.id}/mesh`);
              return;
            }
            applySegmentFilters(segment)
          }
      }
  };

  const handleCopyViewLink = (e: React.MouseEvent, segmentId: string) => {
    e.stopPropagation();
    const url = `${window.location.origin}${window.location.pathname}${window.location.hash}`;
    navigator.clipboard.writeText(url);
    setCopiedViewId(segmentId);
    setTimeout(() => setCopiedViewId(null), 2000);
  };

  const handleClearFilters = () => {
    handleApplySegment('all');
  }

  const handleDeleteSegmentConfirmation = (segment: FilterSegment) => {
    requestConfirmation({
        title: 'Delete Saved View',
        message: <>Are you sure you want to delete the saved view <strong>"{segment.name}"</strong>? This cannot be undone.</>,
        onConfirm: async () => {
            await deleteFilterSegment(segment.id);
            if (activeSegmentId === segment.id) {
                handleApplySegment('all');
            }
        },
        confirmText: 'Delete',
    });
  };

  const processFileWithAI = async (fileData: { content: string; mimeType: string }, headersToInclude: string[]) => {
    setIsAiParsing(true);
    try {
        const columnNames = project.board.columnOrder.map(id => project.board.columns[id]?.title || 'Unknown');
        const tasks = await generateTasksFromFile(fileData, columnNames, headersToInclude);
        if (tasks && tasks.length > 0) {
            setTasksToConfirm(tasks);
        } else {
            alert("AI could not find any tasks in the provided file.");
        }
    } catch (err) {
        alert(`AI Error: ${err instanceof Error ? err.message : "An unknown error occurred."}`);
    } finally {
        setIsAiParsing(false);
    }
  };

  const handleFileSelectedForImport = (fileData: { content: string; mimeType: string; name: string }) => {
    const isCsv = fileData.mimeType === 'text/csv' || fileData.name.toLowerCase().endsWith('.csv');

    if (isCsv && fileData.content) {
        try {
            const firstLine = fileData.content.split('\n')[0];
            const headers = firstLine.split(',').map(h => h.trim().replace(/"/g, ''));
            
            if (headers.length > 0 && headers[0]) {
                setHeadersToSelect(headers);
                setFileForProcessing(fileData);
                setIsSelectHeadersModalOpen(true);
                return;
            }
        } catch (e) {
            console.error("Could not parse headers from CSV file, processing as plain text.", e);
        }
    }
    
    processFileWithAI(fileData, []);
  };

  const handleConfirmTaskCreation = async (sprintId: string | null) => {
    if (!tasksToConfirm) return;
    await addTasksBatch(tasksToConfirm, sprintId);
    setTasksToConfirm(null); 
  };

  const handleTaskSelect = (task: Task, e?: React.MouseEvent) => {
    if (e?.ctrlKey || e?.metaKey) {
        setSelectedTaskIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(task.id)) {
                newSet.delete(task.id);
            } else {
                newSet.add(task.id);
            }
            return newSet;
        });
    } else {
        onTaskClick(task);
    }
  };

  const handleBulkUpdateSprint = async (sprintId: string | null) => {
    if (selectedTaskIds.size === 0) return;
    await bulkUpdateTaskSprint(Array.from(selectedTaskIds), sprintId);
    setSelectedTaskIds(new Set());
  };

  const handleOpenCompleteSprint = (sprint: Sprint) => {
    setSprintToComplete(sprint);
    setCompleteSprintModalOpen(true);
  };

  const handleConfirmCompleteSprint = async (moveToSprintId: string | null) => {
    if (!sprintToComplete) return;
    await completeSprint(sprintToComplete.id, moveToSprintId);
    setCompleteSprintModalOpen(false);
    setSprintToComplete(null);
  };

  const uniqueAssignees = useMemo(() => {
      if (!boardData?.tasks) return [];
      const unique = new Map<string, User>();
      const tasks = Object.values(boardData.tasks || {}) as Task[];
      tasks.forEach(task => {
          if (task.assignee) {
              unique.set(task.assignee.id, task.assignee);
          }
          (task.subtasks || []).forEach(sub => {
              if (sub.assignee) {
                  unique.set(sub.assignee.id, sub.assignee);
              }
          });
      });
      return Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [boardData?.tasks]);

  const uniqueStatuses = useMemo(() => {
      if (!boardData?.columns) return [];
      return [...new Set((Object.values(boardData.columns || {}) as ColumnType[]).map(c => c.title).filter(Boolean))];
  }, [boardData?.columns]);

  const uniqueTags = useMemo(() => {
    if (!boardData?.tasks) return [];
    const tags = new Set<string>();
    (Object.values(boardData.tasks || {}) as Task[]).forEach(task => {
        task.tags?.forEach(tag => {
            if (tag && !tag.startsWith('ticket:') && !tag.startsWith('type:') && !tag.startsWith('ref:')) {
                tags.add(tag);
            }
        });
    });
    return Array.from(tags).sort();
  }, [boardData?.tasks]);

  const filteredTasksForTable = useMemo(() => {
    if (!filteredBoardData?.columnOrder || !filteredBoardData?.columns || !filteredBoardData?.tasks) return [];
    return filteredBoardData.columnOrder.flatMap(columnId => {
        const column = filteredBoardData.columns[columnId];
        if (!column) return [];
        return column.taskIds.map(taskId => filteredBoardData.tasks[taskId]).filter(Boolean);
    });
  }, [filteredBoardData]);

  const tableTotalPages = Math.ceil(filteredTasksForTable.length / TABLE_ITEMS_PER_PAGE);
  const paginatedTasksForTable = filteredTasksForTable.slice(
    (tableCurrentPage - 1) * TABLE_ITEMS_PER_PAGE,
    tableCurrentPage * TABLE_ITEMS_PER_PAGE
  );

  const handleExport = () => {
    const augmentedTasks: AugmentedTask[] = filteredTasksForTable.map(task => {
        const columnsArray = project.board?.columns ? (Object.values(project.board.columns) as ColumnType[]) : [];
        const column = columnsArray.find(c => c.taskIds.includes(task.id));
        return {
            ...task,
            projectId: project.id,
            projectName: project.name,
            columnId: column?.id || '',
            columnName: column?.title || 'Uncategorized',
        };
    });

    const usersRecord = users.reduce((acc, user) => {
        acc[user.id] = user;
        return acc;
    }, {} as Record<string, User>);

    exportAugmentedTasksToCsv(augmentedTasks, usersRecord, project.name);
  };

  const handleExportPdf = () => {
    const augmentedTasks: AugmentedTask[] = filteredTasksForTable.map(task => {
        const columnsArray = project.board?.columns ? (Object.values(project.board.columns) as ColumnType[]) : [];
        const column = columnsArray.find(c => c.taskIds.includes(task.id));
        return {
            ...task,
            projectId: project.id,
            projectName: project.name,
            columnId: column?.id || '',
            columnName: column?.title || 'Uncategorized',
        };
    });
    exportTasksToPdf(augmentedTasks, project.name);
  };
  
  const currentFiltersCount = useMemo(() => {
    let count = 0;
    if (searchTerm) count++;
    if (priorityFilter.length > 0) count++;
    if (assigneeFilter.length > 0) count++;
    if (reporterFilter.length > 0) count++;
    if (statusFilter.length > 0) count++;
    if (tagFilter.length > 0) count++;
    if (sprintFilter.length > 0) count++;
    if (startDate || endDate) count++;
    if (relativeTimeValue) count++;
    return count;
  }, [searchTerm, priorityFilter, assigneeFilter, statusFilter, tagFilter, sprintFilter, startDate, endDate, relativeTimeValue]);

  return (
    <>
      {/* Main content stage */}
      <motion.div 
        animate={{ 
          marginLeft: '0px',
          paddingRight: isControlDeckOpen ? '368px' : '48px'
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="flex-grow min-w-0 w-full space-y-6"
      >
        {/* Row 1: Segment Tabs */}
        {projectView !== 'sprints' && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 px-1">
            <button 
              onClick={() => {
                handleApplySegment('all');
              }} 
              className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.15em] rounded-full transition-all flex-shrink-0 ${activeSegmentId === 'all' ? 'bg-white text-black shadow-lg shadow-white/5' : 'bg-white/5 text-gray-500 hover:bg-white/10 hover:text-gray-300'}`}
            >
              All Scope
            </button>
            {(project.filterSegments || [])
              .filter(segment => segment.name.toUpperCase() !== 'ADD')
              .map(segment => (
                <div key={segment.id} className="relative group flex-shrink-0">
                    <button 
                      onClick={() => {
                        handleApplySegment(segment.id);
                      }} 
                      className={`pl-3 ${activeSegmentId === segment.id ? 'pr-12' : 'pr-3'} py-1.5 text-[9px] font-black uppercase tracking-[0.15em] rounded-full transition-all ${activeSegmentId === segment.id ? 'bg-white text-black shadow-lg shadow-white/5' : 'bg-white/5 text-gray-500 hover:bg-white/10 hover:text-gray-300'}`}
                    >
                      {segment.name}
                    </button>
                    {activeSegmentId === segment.id && (
                      <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                          <button 
                              onClick={(e) => handleCopyViewLink(e, segment.id)}
                              className="w-4 h-4 flex items-center justify-center text-black hover:text-emerald-600 transition-colors"
                              title="Copy shareable link"
                          >
                              {copiedViewId === segment.id ? <CheckIcon className="w-2.5 h-2.5" /> : <LinkIcon className="w-2.5 h-2.5" />}
                          </button>
                          <button 
                              onClick={(e) => { e.stopPropagation(); handleDeleteSegmentConfirmation(segment); }}
                              className="w-4 h-4 flex items-center justify-center text-black hover:text-red-600 transition-colors"
                              title="Delete view"
                          >
                              <XIcon className="w-2.5 h-2.5" />
                          </button>
                      </div>
                    )}
                </div>
              ))}
          </div>
        )}

        
          {projectView === 'sprints' ? (
        <SprintsPage
            project={project}
            onAddSprint={addSprint}
            onUpdateSprint={updateSprint}
            onDeleteSprint={deleteSprint}
            onCompleteSprint={handleOpenCompleteSprint}
        />
      ) : projectView === 'board' ? (
        <DragDropContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <StrictModeDroppable droppableId="all-columns" direction="horizontal" type="column">
            {(provided) => (
                    <div
                        {...provided.droppableProps}
                        ref={(el) => {
                            provided.innerRef(el);
                            boardScrollContainerRef.current = el;
                        }}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUpOrLeave}
                        onMouseLeave={handleMouseUpOrLeave}
                        className="flex gap-6 items-start pb-4 -mx-4 sm:-mx-6 px-4 sm:px-6 overflow-x-auto custom-scrollbar select-none"
                    >
                        {filteredBoardData.columnOrder.map((columnId, index) => {
                            const column = filteredBoardData.columns[columnId];
                            if (!column) return null;
                            const tasks = column.taskIds.map((taskId) => filteredBoardData.tasks[taskId]).filter(Boolean);
                            return (
                                <Draggable draggableId={column.id} index={index} key={column.id}>
                                    {(provided) => (
                                        <div 
                                            {...provided.draggableProps} 
                                            ref={provided.innerRef}
                                            className="w-72 flex-shrink-0"
                                        >
                                            <Column 
                                                column={column} 
                                                tasks={tasks}
                                                sprints={project.sprints}
                                                users={users}
                                                onlineUsers={onlineUsers}
                                                selectedTaskIds={selectedTaskIds}
                                                onTaskClick={handleTaskSelect}
                                                deleteTask={handleDeleteTask}
                                                deleteColumn={handleDeleteColumn}
                                                dragHandleProps={provided.dragHandleProps}
                                                duplicateTask={handleDuplicateTask}
                                            />
                                        </div>
                                    )}
                                </Draggable>
                            );
                        })}
                        {provided.placeholder}
                    </div>
                )}
            </StrictModeDroppable>
        </DragDropContext>
      ) : projectView === 'table' ? (
        <>
          <TaskTableView
              project={project}
              tasks={apiBoardData ? filteredTasksForTable : paginatedTasksForTable}
              users={users}
              onUpdateTask={handleUpdateTask}
              onDragEnd={handleDragEnd}
              onTaskClick={onTaskClick}
          />
           <Pagination
              currentPage={apiBoardData ? tasksPage : tableCurrentPage}
              totalPages={apiBoardData ? (apiBoardData.pagination?.tasks?.totalPages || 1) : tableTotalPages}
              onPageChange={apiBoardData ? setTasksPage : setTableCurrentPage}
              itemsPerPage={apiBoardData ? tasksLimit : TABLE_ITEMS_PER_PAGE}
              totalItems={apiBoardData ? (apiBoardData.pagination?.tasks?.total || 0) : filteredTasksForTable.length}
          />
        </>
      ) : (
        <TaskGraphView boardData={filteredBoardData} users={users} onTaskClick={onTaskClick} />
      )}
      </motion.div>
      
       {isChatOpen && (
        <ProjectChat 
            project={project}
            projects={projects}
            users={users}
            currentUser={currentUser}
            onlineUsers={onlineUsers}
            onClose={onCloseChat}
            onSendMessage={onSendMessage}
            onFetchChat={fetchChatMessagesForProject}
        />
      )}



      {/* Neural Nexus AI Control Sidebar */}
      {isAiNexusOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden pointer-events-none">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] pointer-events-auto" onClick={() => setIsAiNexusOpen(false)} />
            <div className="absolute top-0 right-0 h-full w-full max-w-md bg-[#131C1B]/95 backdrop-blur-2xl border-l border-white/5 shadow-2xl pointer-events-auto flex flex-col transform transition-transform duration-500 ease-in-out">
                <header className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                            <SparklesIcon className="w-5 h-5 animate-pulse" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white">Neural Nexus</h3>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                                <p className="text-[9px] font-mono text-emerald-500/70 uppercase tracking-widest">System Latency: 4ms</p>
                            </div>
                        </div>
                    </div>
                    <button onClick={() => setIsAiNexusOpen(false)} className="p-2.5 rounded-xl text-gray-500 hover:text-white hover:bg-white/5 transition-all">
                        <XIcon className="w-6 h-6" />
                    </button>
                </header>

                <div className="flex-grow overflow-y-auto custom-scrollbar p-6 space-y-10">
                    <section>
                        <div className="flex items-center gap-2 mb-4">
                            <ZapIcon className="w-4 h-4 text-emerald-400" />
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Generative Logic</h4>
                        </div>
                        <p className="text-xs text-gray-500 mb-4 leading-relaxed font-medium">Describe a complex node cluster or simple task. Gemini will synthesize the requirements into your workflow.</p>
                        <AiTaskCreator onGenerateTask={async (prompt) => { await addAiTask(prompt); setIsAiNexusOpen(false); }} />
                    </section>

                    <section>
                        <div className="flex items-center gap-2 mb-4">
                            <LayoutDashboardIcon className="w-4 h-4 text-emerald-400" />
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Mesh Import</h4>
                        </div>
                        <p className="text-xs text-gray-500 mb-4 leading-relaxed font-medium">Upload external data arrays (.csv, .txt, .pdf, .doc). Neural parsing will map content to project columns.</p>
                        <TaskImportDropzone onFileProcessed={(fd) => { handleFileSelectedForImport(fd); setIsAiNexusOpen(false); }} isLoading={isAiParsing} />
                    </section>

                    <div className="p-5 rounded-2xl bg-white/5 border border-white/5 space-y-3">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Core Capabilities</p>
                        <ul className="space-y-2">
                            {['Contextual reasoning', 'Automatic prioritization', 'Semantic column mapping', 'Subtask expansion'].map(cap => (
                                <li key={cap} className="flex items-center gap-2 text-[11px] text-gray-500 font-medium">
                                    <div className="w-1 h-1 rounded-full bg-emerald-500/50" />
                                    {cap}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                <footer className="p-6 border-t border-white/5 text-center">
                    <p className="text-[9px] font-mono text-gray-600 uppercase tracking-widest italic">Authorized Session | User: {currentUser.name?.split(' ')[0] || 'Unknown'}</p>
                </footer>
            </div>
        </div>
      )}



      {isSelectHeadersModalOpen && fileForProcessing && (
          <SelectHeadersModal
              isOpen={isSelectHeadersModalOpen}
              headers={headersToSelect}
              onClose={() => setIsSelectHeadersModalOpen(false)}
              onConfirm={(selectedHeaders) => {
                  setIsSelectHeadersModalOpen(false);
                  processFileWithAI(fileForProcessing, selectedHeaders);
              }}
          />
      )}
      {tasksToConfirm && (
        <TaskConfirmationModal
            tasks={tasksToConfirm}
            sprints={project.sprints}
            onConfirm={handleConfirmTaskCreation}
            onCancel={() => setTasksToConfirm(null)}
        />
      )}
      {selectedTaskIds.size > 0 && (
        <BulkActionsBar
            selectedCount={selectedTaskIds.size}
            onClear={() => setSelectedTaskIds(new Set())}
            onChangeSprint={() => setBulkSprintModalOpen(true)}
        />
      )}
      <BulkUpdateSprintModal
        isOpen={isBulkSprintModalOpen}
        onClose={() => setBulkSprintModalOpen(false)}
        sprints={project.sprints}
        onConfirm={handleBulkUpdateSprint}
        taskCount={selectedTaskIds.size}
      />
      {sprintToComplete && (
          <CompleteSprintModal
            isOpen={isCompleteSprintModalOpen}
            onClose={() => { setCompleteSprintModalOpen(false); setSprintToComplete(null); }}
            sprint={sprintToComplete}
            projectTasks={Object.values(project?.board?.tasks || {})}
            projectColumns={project?.board?.columns || {}}
            projectSprints={project.sprints}
            onConfirm={handleConfirmCompleteSprint}
          />
      )}

      {projectView !== 'sprints' && (
        <RightControlDeck
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          assignees={projectMembers}
          sprints={project.sprints || []}
          statuses={uniqueStatuses}
          tags={uniqueTags}
          priorityFilter={priorityFilter}
          setPriorityFilter={setPriorityFilter}
          assigneeFilter={assigneeFilter}
          setAssigneeFilter={setAssigneeFilter}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          tagFilter={tagFilter}
          setTagFilter={setTagFilter}
          startDate={startDate}
          setStartDate={setStartDate}
          endDate={endDate}
          setEndDate={setEndDate}
          onClearFilters={handleClearFilters}
          onExportCsv={handleExport}
          onExportPdf={handleExportPdf}
          filteredCount={filteredTasks.length}
          totalCount={allTasks.length}
          isOpen={isControlDeckOpen}
          onToggleIsOpen={setIsControlDeckOpen}
          onNewTaskClick={() => navigate(`/project/${project.id}/create-task`)}
          onAddColumn={addColumn}
          onResourceMeshClick={() => navigate(`/project/${project.id}/mesh`)}
          linksCount={project.links?.length || 0}
          onNeuralNexusClick={() => setIsAiNexusOpen(true)}
          aiFeaturesEnabled={aiFeaturesEnabled}
          projectView={projectView}
          projectColumnsList={Object.values(project?.board?.columns || {}).map(col => ({
            id: col.id,
            name: col.title,
            taskIds: col.taskIds || []
          }))}
          filterSegments={project.filterSegments || []}
          addFilterSegment={addFilterSegment}
          deleteFilterSegment={deleteFilterSegment}

          // Server Scope Engine parameters
          refreshBoard={refreshBoard}
          boardLoading={boardLoading}
          apiBoardData={apiBoardData}
          tasksPage={tasksPage}
          setTasksPage={setTasksPage}
          tasksLimit={tasksLimit}
          setTasksLimit={setTasksLimit}
          taskTypeFilter={taskTypeFilter}
          setTaskTypeFilter={setTaskTypeFilter}
          parentIdFilter={parentIdFilter}
          setParentIdFilter={setParentIdFilter}
        />
      )}
    </>
  );
};
