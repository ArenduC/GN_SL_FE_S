import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Project, User, Task, Column, AppState } from '../../types';

interface ProjectState {
  projects: Record<string, Project>;
  users: Record<string, User>;
  projectOrder: string[];
  activeProjectId: string | null;
  onlineUsers: string[];
  loading: boolean;
  error: string | null;
}

const initialState: ProjectState = {
  projects: {},
  users: {},
  projectOrder: [],
  activeProjectId: null,
  onlineUsers: [],
  loading: false,
  error: null,
};

export const projectSlice = createSlice({
  name: 'project',
  initialState,
  reducers: {
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    setActiveProjectId: (state, action: PayloadAction<string | null>) => {
      state.activeProjectId = action.payload;
    },
    setOnlineUsers: (state, action: PayloadAction<string[]>) => {
      state.onlineUsers = action.payload;
    },
    setProjectsOrder: (state, action: PayloadAction<string[]>) => {
      state.projectOrder = action.payload;
    },
    setInitialData: (state, action: PayloadAction<AppState>) => {
      state.projects = action.payload.projects || {};
      state.users = action.payload.users || {};
      state.projectOrder = action.payload.projectOrder || [];
    },
    updateTask: (state, action: PayloadAction<{ taskId: string; updates: Partial<Task>; activeProjectId: string }>) => {
      const { taskId, updates, activeProjectId } = action.payload;
      const project = state.projects[activeProjectId];
      if (project && project.board && project.board.tasks[taskId]) {
        project.board.tasks[taskId] = {
          ...project.board.tasks[taskId],
          ...updates,
          updatedAt: new Date().toISOString(),
        };
      }
    },
    moveTask: (
      state,
      action: PayloadAction<{
        projectId: string;
        sourceColId: string;
        destColId: string;
        sourceIndex: number;
        destIndex: number;
        taskId: string;
      }>
    ) => {
      const { projectId, sourceColId, destColId, sourceIndex, destIndex, taskId } = action.payload;
      const project = state.projects[projectId];
      if (!project || !project.board) return;

      const { columns } = project.board;
      const sourceCol = columns[sourceColId];
      const destCol = columns[destColId];

      if (!sourceCol || !destCol) return;

      // Handle reordering in same column
      if (sourceColId === destColId) {
        const newTaskIds = Array.from(sourceCol.taskIds);
        newTaskIds.splice(sourceIndex, 1);
        newTaskIds.splice(destIndex, 0, taskId);
        project.board.columns[sourceColId].taskIds = newTaskIds;
      } else {
        // Handle moving to a different column
        const sourceTaskIds = Array.from(sourceCol.taskIds);
        sourceTaskIds.splice(sourceIndex, 1);

        const destTaskIds = Array.from(destCol.taskIds);
        destTaskIds.splice(destIndex, 0, taskId);

        project.board.columns[sourceColId].taskIds = sourceTaskIds;
        project.board.columns[destColId].taskIds = destTaskIds;
      }
    },
    addProjectToState: (state, action: PayloadAction<Project>) => {
      const project = action.payload;
      state.projects[project.id] = project;
      if (!state.projectOrder.includes(project.id)) {
        state.projectOrder.push(project.id);
      }
    },
    deleteProjectFromState: (state, action: PayloadAction<string>) => {
      const projectId = action.payload;
      delete state.projects[projectId];
      state.projectOrder = state.projectOrder.filter((id) => id !== projectId);
      if (state.activeProjectId === projectId) {
        state.activeProjectId = state.projectOrder[0] || null;
      }
    },
    updateProjectMembersInState: (state, action: PayloadAction<{ projectId: string; members: string[] }>) => {
      const { projectId, members } = action.payload;
      if (state.projects[projectId]) {
        state.projects[projectId].members = members;
      }
    }
  },
});

export const {
  setLoading,
  setError,
  setActiveProjectId,
  setOnlineUsers,
  setProjectsOrder,
  setInitialData,
  updateTask,
  moveTask,
  addProjectToState,
  deleteProjectFromState,
  updateProjectMembersInState
} = projectSlice.actions;

export default projectSlice.reducer;
