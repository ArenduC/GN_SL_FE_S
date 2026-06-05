import { create } from 'zustand';
import { AppState, Project, User, Task, Column, NewTaskData, Sprint } from '../../types';
import { api } from '../../services/api';

// Reusable Selectors and Business State Structure
interface ProjectState {
  // Business State
  projects: Record<string, Project>;
  users: Record<string, User>;
  projectOrder: string[];
  activeProjectId: string | null;
  currentUser: User | null;
  onlineUsers: Set<string>;
  
  // UI States
  loading: boolean;
  error: string | null;
  refreshing: boolean;

  // Actions / Mutations (State encapsulation / Single flow of responsibility)
  setCurrentUser: (user: User | null) => void;
  setActiveProjectId: (projectId: string | null) => void;
  setOnlineUsers: (users: Set<string>) => void;
  fetchInitialData: (userId: string) => Promise<void>;
  updateTaskState: (taskId: string, updates: Partial<Task>) => void;
  moveTaskOnBoard: (
    projectId: string,
    sourceColId: string,
    destColId: string,
    sourceIndex: number,
    destIndex: number,
    taskId: string
  ) => void;
  
  // Reusable Selectors helper
  getActiveProject: () => Project | null;
  getFilteredTasks: (searchTerm: string, priority: string, assignee: string) => Task[];
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  // Core Business State
  projects: {},
  users: {},
  projectOrder: [],
  activeProjectId: null,
  currentUser: null,
  onlineUsers: new Set<string>(),

  // UI / Meta States
  loading: false,
  error: null,
  refreshing: false,

  // Setters
  setCurrentUser: (user) => set({ currentUser: user }),
  setActiveProjectId: (projectId) => set({ activeProjectId: projectId }),
  setOnlineUsers: (users) => set({ onlineUsers: users }),

  // Central Async action flow
  fetchInitialData: async (userId: string) => {
    set({ loading: true, error: null });
    try {
      const freshState: AppState = await api.data.fetchInitialData(userId);
      set({
        projects: freshState.projects || {},
        users: freshState.users || {},
        projectOrder: freshState.projectOrder || [],
        loading: false,
      });

      // Synchronize with local cache
      const cacheKey = `gemini-board-cache-${userId}`;
      localStorage.setItem(cacheKey, JSON.stringify(freshState));
    } catch (err: any) {
      set({ error: err.message || 'Error sync uplink', loading: false });
    }
  },

  // Encapsulated state updates (SOLID presentation model)
  updateTaskState: (taskId, updates) => {
    set((state) => {
      const activeProjId = state.activeProjectId;
      if (!activeProjId) return state;

      const project = state.projects[activeProjId];
      if (!project || !project.board?.tasks?.[taskId]) return state;

      const currentTask = project.board.tasks[taskId];
      const updatedTask = { ...currentTask, ...updates, updatedAt: new Date().toISOString() };

      const updatedProjects = {
        ...state.projects,
        [activeProjId]: {
          ...project,
          board: {
            ...project.board,
            tasks: {
              ...project.board.tasks,
              [taskId]: updatedTask,
            },
          },
        },
      };

      return { projects: updatedProjects };
    });
  },

  moveTaskOnBoard: (projectId, sourceColId, destColId, sourceIndex, destIndex, taskId) => {
    set((state) => {
      const project = state.projects[projectId];
      if (!project || !project.board) return state;

      const { columns } = project.board;
      const sourceCol = columns[sourceColId];
      const destCol = columns[destColId];

      if (!sourceCol || !destCol) return state;

      // Handle reordering in same column
      if (sourceColId === destColId) {
        const newTaskIds = Array.from(sourceCol.taskIds);
        newTaskIds.splice(sourceIndex, 1);
        newTaskIds.splice(destIndex, 0, taskId);

        return {
          projects: {
            ...state.projects,
            [projectId]: {
              ...project,
              board: {
                ...project.board,
                columns: {
                  ...columns,
                  [sourceColId]: { ...sourceCol, taskIds: newTaskIds },
                },
              },
            },
          },
        };
      }

      // Handle moving to a different column
      const sourceTaskIds = Array.from(sourceCol.taskIds);
      sourceTaskIds.splice(sourceIndex, 1);

      const destTaskIds = Array.from(destCol.taskIds);
      destTaskIds.splice(destIndex, 0, taskId);

      return {
        projects: {
          ...state.projects,
          [projectId]: {
            ...project,
            board: {
              ...project.board,
              columns: {
                ...columns,
                [sourceColId]: { ...sourceCol, taskIds: sourceTaskIds },
                [destColId]: { ...destCol, taskIds: destTaskIds },
              },
            },
          },
        },
      };
    });
  },

  // Helper/Derived Selectors
  getActiveProject: () => {
    const { projects, activeProjectId } = get();
    return activeProjectId ? projects[activeProjectId] || null : null;
  },

  getFilteredTasks: (searchTerm, priority, assignee) => {
    const activeProject = get().getActiveProject();
    if (!activeProject || !activeProject.board) return [];

    const tasks = Object.values(activeProject.board.tasks);
    const searchLower = searchTerm.toLowerCase();

    return tasks.filter((task) => {
      const matchesSearch =
        task.title.toLowerCase().includes(searchLower) ||
        task.ticketId.toLowerCase().includes(searchLower) ||
        task.description.toLowerCase().includes(searchLower);

      const matchesPriority = priority === 'All' || task.priority === priority;
      const matchesAssignee = assignee === 'All' || task.assignee?.id === assignee;

      return matchesSearch && matchesPriority && matchesAssignee;
    });
  },
}));
