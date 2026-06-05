import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { User } from '../../types';
import { Session } from '@supabase/supabase-js';

interface AuthState {
  session: Session | null;
  currentUser: User | null;
  isRecoveringPassword: boolean;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  session: null,
  currentUser: null,
  isRecoveringPassword: false,
  loading: false,
  error: null,
};

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setSession: (state, action: PayloadAction<Session | null>) => {
      state.session = action.payload;
    },
    setCurrentUser: (state, action: PayloadAction<User | null>) => {
      state.currentUser = action.payload;
    },
    setRecoveringPassword: (state, action: PayloadAction<boolean>) => {
      state.isRecoveringPassword = action.payload;
    },
    setAuthLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setAuthError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    logout: (state) => {
      state.session = null;
      state.currentUser = null;
      state.isRecoveringPassword = false;
      state.error = null;
    }
  },
});

export const {
  setSession,
  setCurrentUser,
  setRecoveringPassword,
  setAuthLoading,
  setAuthError,
  logout,
} = authSlice.actions;

export default authSlice.reducer;
