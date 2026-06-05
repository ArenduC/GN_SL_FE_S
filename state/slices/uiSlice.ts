import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface UiState {
  currentView: 'dashboard' | 'tasks' | 'resources';
  isSettingsOpen: boolean;
  isCreateProjectOpen: boolean;
  isCreateTaskOpen: boolean;
  isSearchOpen: boolean;
  isVoiceOpen: boolean;
  isFeedbackOpen: boolean;
  isInfoHubOpen: boolean;
  selectedTaskId: string | null;
  isChatOpen: boolean;
  notification: { message: string; type: 'success' | 'error' | 'info' } | null;
}

const initialState: UiState = {
  currentView: 'dashboard',
  isSettingsOpen: false,
  isCreateProjectOpen: false,
  isCreateTaskOpen: false,
  isSearchOpen: false,
  isVoiceOpen: false,
  isFeedbackOpen: false,
  isInfoHubOpen: false,
  selectedTaskId: null,
  isChatOpen: false,
  notification: null,
};

export const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setView: (state, action: PayloadAction<'dashboard' | 'tasks' | 'resources'>) => {
      state.currentView = action.payload;
    },
    setSettingsOpen: (state, action: PayloadAction<boolean>) => {
      state.isSettingsOpen = action.payload;
    },
    setCreateProjectOpen: (state, action: PayloadAction<boolean>) => {
      state.isCreateProjectOpen = action.payload;
    },
    setCreateTaskOpen: (state, action: PayloadAction<boolean>) => {
      state.isCreateTaskOpen = action.payload;
    },
    setSearchOpen: (state, action: PayloadAction<boolean>) => {
      state.isSearchOpen = action.payload;
    },
    setVoiceOpen: (state, action: PayloadAction<boolean>) => {
      state.isVoiceOpen = action.payload;
    },
    setFeedbackOpen: (state, action: PayloadAction<boolean>) => {
      state.isFeedbackOpen = action.payload;
    },
    setInfoHubOpen: (state, action: PayloadAction<boolean>) => {
      state.isInfoHubOpen = action.payload;
    },
    setSelectedTaskId: (state, action: PayloadAction<string | null>) => {
      state.selectedTaskId = action.payload;
    },
    setChatOpen: (state, action: PayloadAction<boolean>) => {
      state.isChatOpen = action.payload;
    },
    showNotification: (state, action: PayloadAction<{ message: string; type: 'success' | 'error' | 'info' }>) => {
      state.notification = action.payload;
    },
    clearNotification: (state) => {
      state.notification = null;
    }
  },
});

export const {
  setView,
  setSettingsOpen,
  setCreateProjectOpen,
  setCreateTaskOpen,
  setSearchOpen,
  setVoiceOpen,
  setFeedbackOpen,
  setInfoHubOpen,
  setSelectedTaskId,
  setChatOpen,
  showNotification,
  clearNotification,
} = uiSlice.actions;

export default uiSlice.reducer;
