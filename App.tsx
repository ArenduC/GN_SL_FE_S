
import React, { useState, useEffect, useRef, createContext, useContext, useCallback, useMemo } from 'react';
import { AppState, User, Project, Task, NewTaskData, Subtask, ChatMessage, TaskPriority, AiGeneratedTaskFromFile, Sprint, FilterSegment, FeedbackType } from './types';
import { useAppState } from './hooks/useAppState';
import { api, generateProjectCode } from './services/api';
import { LandingPage } from './components/LandingPage';
import { DashboardPage } from './pages/DashboardPage';
import { KanbanBoard } from './components/KanbanBoard';
import { TasksPage } from './pages/TasksPage';
import { ResourceManagementPage } from './pages/ResourceManagementPage';
import { ResourceMeshPage } from './pages/ResourceMeshPage';
import { SettingsModal } from './components/SettingsModal';
import { CreateProjectModal } from './components/CreateProjectModal';
import { CreateTaskModal } from './components/CreateTaskModal';
import { CreateTaskPage } from './pages/CreateTaskPage';
import { TaskDetailsModal } from './components/TaskDetailsModal';
import { TaskDetailsPage } from './pages/TaskDetailsPage';
import { ManageMembersModal } from './components/ManageMembersModal';
import { ManageInviteLinksModal } from './components/ManageInviteLinksModal';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { VoiceAssistantModal } from './components/VoiceAssistantModal';
import { FeedbackFab } from './components/FeedbackFab';
import { FeedbackModal } from './components/FeedbackModal';
import { InfoHubModal } from './components/InfoHubModal';
import { NotificationToast } from './components/NotificationToast';
import { UserAvatar } from './components/UserAvatar';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import { AppLogo, SearchIcon, BotMessageSquareIcon, LogOutIcon, SettingsIcon, MessageSquareIcon, RotateCwIcon, ArrowLeftIcon, HelpCircleIcon, CheckSquareIcon, PlusIcon, UsersIcon, BellIcon, LayoutDashboardIcon, TableIcon, GitBranchIcon, RocketIcon, ExternalLinkIcon } from './components/Icons';
import { Session } from '@supabase/supabase-js';
import { interpretVoiceCommand } from './services/geminiService';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from './state/store';
import { setSession as setReduxSession, setCurrentUser as setReduxUser } from './state/slices/authSlice';
import { setActiveProjectId as setReduxActiveProjectId, setOnlineUsers as setReduxOnlineUsers, setInitialData as setReduxInitialData } from './state/slices/projectSlice';

const viewOptions = [
  { id: 'board', label: 'Board', icon: LayoutDashboardIcon },
  { id: 'table', label: 'Table', icon: TableIcon },
  { id: 'graph', label: 'Graph', icon: GitBranchIcon },
  { id: 'sprints', label: 'Sprints', icon: RocketIcon },
];

// --- CONTEXT ---
interface ConfirmationContextType {
  confirm: (options: { title: string; message: React.ReactNode; onConfirm: () => void; confirmText?: string }) => void;
}
const ConfirmationContext = createContext<ConfirmationContextType | undefined>(undefined);
export const useConfirmation = () => {
  const context = useContext(ConfirmationContext);
  if (!context) throw new Error('useConfirmation must be used within a ConfirmationProvider');
  return context.confirm;
};

type View = 'dashboard' | 'tasks' | 'resources' | 'resource-mesh' | 'project' | 'create-task' | 'task-details' | 'invite';

interface AppProps {
  view?: View;
}

const App: React.FC<AppProps> = ({ view = 'dashboard' }) => {
  const { projectId, taskId, token: inviteRouteToken } = useParams<{ projectId: string; taskId: string; token: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  // Redux connected variables
  const session = useAppSelector((state) => state.auth.session);
  const currentUser = useAppSelector((state) => state.auth.currentUser);

  // Sync state helpers
  const setSession = (sess: Session | null) => dispatch(setReduxSession(sess));
  const setCurrentUser = (user: User | null) => dispatch(setReduxUser(user));

  const activeProjectId = (view === 'project' || view === 'create-task' || view === 'task-details' || view === 'resource-mesh') ? projectId || null : null;
  const currentView = (view === 'project' || view === 'create-task' || view === 'task-details' || view === 'invite') ? 'dashboard' : view;
  const [onlineUsers, setOnlineUsersLocal] = useState<Set<string>>(new Set());

  const setOnlineUsers = useCallback((users: Set<string>) => {
    setOnlineUsersLocal(users);
    dispatch(setReduxOnlineUsers(Array.from(users)));
  }, [dispatch]);

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isJoiningProject, setIsJoiningProject] = useState(false);
  const [inviteStatus, setInviteStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const processingInviteTokenRef = useRef<string | null>(null);
  const [isRecoveringPassword, setIsRecoveringPassword] = useState(false);
  
  // AI features strictly depend on user provided key
  const [featureFlags, setFeatureFlags] = useState({
    ai: !!localStorage.getItem('user_gemini_api_key'),
    voice: !!localStorage.getItem('user_gemini_api_key'),
  });

  const [prefCounter, setPrefCounter] = useState(0);

  const [alwaysOpenInPopup, setAlwaysOpenInPopup] = useState<boolean>(() => {
    return localStorage.getItem('user_project_always_popup') === 'true';
  });

  const toggleAlwaysOpenInPopup = useCallback(() => {
    const nextVal = !alwaysOpenInPopup;
    setAlwaysOpenInPopup(nextVal);
    localStorage.setItem('user_project_always_popup', String(nextVal));
  }, [alwaysOpenInPopup]);

  const activeTheme = useMemo(() => {
    return localStorage.getItem('user_project_theme') || 'dark';
  }, [prefCounter]);

  const activeTimezone = useMemo(() => {
    return localStorage.getItem('user_project_timezone') || 'UTC';
  }, [prefCounter]);

  const visibleSidebarPanels = useMemo<string[]>(() => {
    try {
      const stored = localStorage.getItem('user_project_sidebar_panels');
      return stored ? JSON.parse(stored) : ['dashboard', 'tasks', 'calendar', 'meetings', 'resources'];
    } catch {
      return ['dashboard', 'tasks', 'calendar', 'meetings', 'resources'];
    }
  }, [prefCounter]);

  useEffect(() => {
    setAlwaysOpenInPopup(localStorage.getItem('user_project_always_popup') === 'true');
  }, [prefCounter]);

  useEffect(() => {
    const fetchRemoteSettings = async () => {
      if (!currentUser) return;
      try {
        const fetched = await api.auth.getUserSettings();
        if (fetched) {
          if (fetched.defaultView) localStorage.setItem('user_project_default_view', fetched.defaultView);
          if (fetched.theme) {
            localStorage.setItem('user_project_theme', fetched.theme);
            window.dispatchEvent(new Event('themechange'));
          }
          if (fetched.timezone) localStorage.setItem('user_project_timezone', fetched.timezone);
          if (fetched.aiMode) localStorage.setItem('user_project_ai_mode', fetched.aiMode);
          if (fetched.defaultProject !== undefined) localStorage.setItem('user_project_default_project', fetched.defaultProject);
          if (fetched.chat) {
            localStorage.setItem('user_project_chat_enabled', String(fetched.chat.enabled));
            localStorage.setItem('user_project_chat_sound', String(fetched.chat.soundEnabled));
          }
          if (fetched.notifications) {
            localStorage.setItem('user_project_notif_subscribed', String(fetched.notifications.subscribed));
            localStorage.setItem('user_project_notif_email', String(fetched.notifications.email));
            localStorage.setItem('user_project_notif_push', String(fetched.notifications.push));
          }
          if (fetched.sidebar) {
            if (fetched.sidebar.visiblePanels) {
              localStorage.setItem('user_project_sidebar_panels', JSON.stringify(fetched.sidebar.visiblePanels));
            }
            if (fetched.sidebar.isCollapsed !== undefined) {
              localStorage.setItem('user_project_sidebar_collapsed', String(fetched.sidebar.isCollapsed));
            }
          }
          // Increment preference counter to update responsive views & layouts
          setPrefCounter(prev => prev + 1);
        }
      } catch (err) {
        console.warn("[App Info] Failed to preload settings from remote server, utilizing local cache", err);
      }
    };
    fetchRemoteSettings();
  }, [currentUser]);

  const { state, loading, fetchData, onDragEnd, updateTask, addSubtasks, updateSubtask, deleteSubtask, addComment, addAiTask, addTask, duplicateTask, addTasksBatch, deleteTask, addColumn, deleteColumn, addProject, addProjectFromPlan, deleteProject, updateUserProfile, updateProjectMembers, sendChatMessage, addProjectLink, deleteProjectLink, addSprint, updateSprint, deleteSprint, bulkUpdateTaskSprint, completeSprint, addFilterSegment, updateFilterSegment, deleteFilterSegment, fetchChatMessagesForProject, updateTasksFromBoard } = useAppState(session, currentUser, activeProjectId, setOnlineUsers);

  useEffect(() => {
    const defaultProjId = localStorage.getItem('user_project_default_project');
    if (defaultProjId && state.projects && Object.keys(state.projects).length > 0) {
      const currentPath = window.location.pathname;
      if (!activeProjectId && currentPath === '/') {
        if (state.projects[defaultProjId]) {
          handleSelectProject(defaultProjId);
        }
      }
    }
  }, [state.projects, activeProjectId, prefCounter]);

  // Modals
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isManageMembersOpen, setIsManageMembersOpen] = useState(false);
  const [memberProjectId, setMemberProjectId] = useState<string | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareProject, setShareProject] = useState<Project | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isInfoHubOpen, setIsInfoHubOpen] = useState(false);
  const [confirmation, setConfirmation] = useState<{ title: string; message: React.ReactNode; onConfirm: () => void; confirmText: string } | null>(null);

  // SaaS Navigation States
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isControlDeckOpen, setIsControlDeckOpen] = useState(false);
  const [projectView, setProjectView] = useState<'board' | 'table' | 'graph' | 'sprints'>(() => {
    return (localStorage.getItem('user_project_default_view') || 'board') as 'board' | 'table' | 'graph' | 'sprints';
  });

  useEffect(() => {
    const preferredView = (localStorage.getItem('user_project_default_view') || 'board') as 'board' | 'table' | 'graph' | 'sprints';
    setProjectView(preferredView);
  }, [prefCounter, activeProjectId]);
  const [isWorkspaceDropdownOpen, setIsWorkspaceDropdownOpen] = useState(false);
  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);
  const [isBillingOpen, setIsBillingOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [sidebarSearch, setSidebarSearch] = useState('');

  const taskProject = useMemo(() => {
    const targetProjectId = projectId || activeProjectId;
    if (targetProjectId && state.projects?.[targetProjectId]) {
      return state.projects[targetProjectId];
    }
    if (taskId) {
      return (Object.values(state.projects || {}) as Project[]).find(p => p.board?.tasks?.[taskId]) || null;
    }
    if (!selectedTaskId) return null;
    return (Object.values(state.projects || {}) as Project[]).find(p => p.board?.tasks?.[selectedTaskId]) || null;
  }, [selectedTaskId, taskId, projectId, activeProjectId, state.projects]);

  const normalizeTaskTicketId = useCallback((t: any, proj: any) => {
    if (!t) return null;
    const originalTicketId = t.ticketId || t.ticket_id;
    const projectCode = proj ? generateProjectCode(proj.name) : 'TSK';
    
    let ticketId = originalTicketId;
    if (!ticketId) {
      const ticketTag = (t.tags || []).find((tagStr: string) => tagStr && tagStr.startsWith('ticket:'));
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
      return { ...t, ticketId };
    }
    
    if (proj) {
      if (projectCode === 'SLO') {
        return { ...t, ticketId: 'SLO00001' };
      }
      return { ...t, ticketId: `${projectCode}-${t.id.substring(0, 4)}` };
    }
    return t;
  }, []);

  const selectedTask = useMemo(() => {
    if (taskId) {
      if (taskProject?.board?.tasks?.[taskId]) {
        return normalizeTaskTicketId(taskProject.board.tasks[taskId], taskProject);
      }
      const foundProject = (Object.values(state.projects || {}) as Project[]).find(p => p.board?.tasks?.[taskId]);
      if (foundProject) {
        return normalizeTaskTicketId(foundProject.board.tasks[taskId], foundProject);
      }
      return null;
    }
    if (!selectedTaskId || !taskProject) return null;
    if (taskProject.board?.tasks?.[selectedTaskId]) {
      return normalizeTaskTicketId(taskProject.board.tasks[selectedTaskId], taskProject);
    }
    const foundProject = (Object.values(state.projects || {}) as Project[]).find(p => p.board?.tasks?.[selectedTaskId]);
    if (foundProject) {
      return normalizeTaskTicketId(foundProject.board.tasks[selectedTaskId], foundProject);
    }
    return null;
  }, [selectedTaskId, taskId, taskProject, state.projects, normalizeTaskTicketId]);

  const taskProjectMembers = useMemo(() => {
    if (!taskProject) return [];
    return (taskProject.members || [])
      .map(id => state.users[id])
      .filter((u): u is User => !!u);
  }, [taskProject, state.users]);

  const taskProjectSprints = useMemo(() => taskProject?.sprints || [], [taskProject]);
  
  const taskProjectTags = useMemo(() => {
    if (!taskProject?.board?.tasks) return [];
    const tags = new Set<string>();
    (Object.values(taskProject.board.tasks || {}) as Task[]).forEach(t => {
      (t.tags || []).forEach(tag => {
        if (tag && !tag.startsWith('ticket:') && !tag.startsWith('type:') && !tag.startsWith('ref:')) {
          tags.add(tag);
        }
      });
    });
    return Array.from(tags).sort();
  }, [taskProject]);

  const handleTaskClick = useCallback((task: Task) => {
    const projId = activeProjectId || (Object.values(state.projects || {}) as Project[]).find(p => p.board?.tasks?.[task.id])?.id;
    if (projId) {
      navigate(`/project/${projId}/task/${task.id}`);
    } else {
      setSelectedTaskId(task.id);
    }
  }, [state.projects, navigate, activeProjectId]);

  useEffect(() => {
    // Immediate check for recovery flow in URL fragment
    const hash = window.location.hash;
    if (hash && hash.includes('type=recovery')) {
      setIsRecoveringPassword(true);
    }

    api.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      // Double check if recovery mode is persistent in session metadata
      if (session?.user?.app_metadata?.recovery) {
        setIsRecoveringPassword(true);
      }
    });

    const { data: { subscription } } = api.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecoveringPassword(true);
      }
      if (event === 'SIGNED_OUT') {
        setIsRecoveringPassword(false);
        setCurrentUser(null);
        dispatch(setReduxActiveProjectId(null));
      }
    });

    return () => subscription.unsubscribe();
  }, [dispatch]);

  useEffect(() => {
    if (session?.user) {
      const fetchProfile = async (retries = 2) => {
        try {
          const profile = await api.auth.getUserProfile(session.user.id);
          if (profile) {
            const sessionAvatar = session.user.user_metadata?.avatar_url || (session.user as any).avatarUrl || '';
            if (!profile.avatarUrl && sessionAvatar) {
              const updatedProfile = { ...profile, avatarUrl: sessionAvatar };
              setCurrentUser(updatedProfile);
              // Save the session avatar back to database profile
              api.auth.updateUserProfile(profile.id, { name: profile.name, avatarUrl: sessionAvatar })
                 .catch(err => console.warn("[Background Profile Sync] Failed to save retrieved session avatar to DB:", err));
            } else {
              setCurrentUser(profile);
            }
          } else {
            const newProfile = await api.auth.createUserProfile(session.user);
            setCurrentUser(newProfile);
          }
        } catch (error) {
          console.error("Critical error fetching profile:", error);
          if (retries > 0) {
            console.log(`Retrying profile fetch... (${retries} attempts left)`);
            setTimeout(() => fetchProfile(retries - 1), 2000);
          } else {
            // If all retries fail, set a fallback guest profile based on session data
            console.warn("All profile fetch retries failed. Using session fallback.");
            setCurrentUser({
              id: session.user.id,
              name: session.user.email?.split('@')[0] || 'Member',
              role: UserRole.MEMBER,
              avatarUrl: ''
            });
          }
        }
      };
      fetchProfile();
    } else {
      setCurrentUser(null);
    }
  }, [session]);

  // Persist route invite token immediately so it survives sign-in / sign-up
  useEffect(() => {
    if (inviteRouteToken) {
      const cleanToken = inviteRouteToken.trim();
      if (cleanToken) {
        localStorage.setItem('project_invite_token', cleanToken);
      }
    } else if (window.location.pathname.startsWith('/invite/')) {
      const rawToken = window.location.pathname.split('/invite/')[1] || '';
      const cleanToken = rawToken.split('/')[0].split('?')[0].trim();
      if (cleanToken) {
        localStorage.setItem('project_invite_token', cleanToken);
      }
    }
  }, [inviteRouteToken]);

  useEffect(() => {
    const processInvite = async () => {
        if (!currentUser) return;
        const token = (inviteRouteToken || localStorage.getItem('project_invite_token') || '').trim();
        if (!token || processingInviteTokenRef.current === token) return;

        processingInviteTokenRef.current = token;
        setIsJoiningProject(true);
        try {
            const result = await api.data.acceptInvite(token);
            localStorage.removeItem('project_invite_token');
            await fetchData(true);
            const joinedProjectId = result?.projectId || result?.project_id || result?.project?.id;
            setInviteStatus({
              type: 'success',
              message: 'Invitation accepted! You now have access to the project workspace.'
            });
            if (joinedProjectId) {
              navigate(`/project/${joinedProjectId}`, { replace: true });
            } else if (view === 'invite') {
              navigate('/dashboard', { replace: true });
            }
        } catch (err: any) {
            localStorage.removeItem('project_invite_token');
            const errMsg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Invitation link is invalid or has expired.';
            setInviteStatus({
              type: 'error',
              message: errMsg
            });
            if (view === 'invite') {
              navigate('/dashboard', { replace: true });
            }
        } finally {
            setIsJoiningProject(false);
        }
    };
    processInvite();
  }, [currentUser, fetchData, inviteRouteToken, view, navigate]);

  useEffect(() => {
    if (!inviteStatus) return;
    const timer = setTimeout(() => setInviteStatus(null), 6000);
    return () => clearTimeout(timer);
  }, [inviteStatus]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchData(false);
    setIsRefreshing(false);
  };

  const confirm = (options: { title: string; message: React.ReactNode; onConfirm: () => void; confirmText?: string }) => {
    setConfirmation({ ...options, confirmText: options.confirmText || 'Confirm', onConfirm: () => { options.onConfirm(); setConfirmation(null); } });
  };

  const handleLogoutClick = () => {
    confirm({
      title: 'Terminate Session',
      message: 'Are you sure you want to disconnect from the neural mesh?',
      confirmText: 'Logout',
      onConfirm: () => api.auth.signOut()
    });
  };

  const handleVoiceCommand = async (command: string) => {
    try {
      const result = await interpretVoiceCommand(command, { currentView, activeProjectId });
      return `Executed: ${result.action}`;
    } catch (e) {
      return "Neural link failed to interpret command.";
    }
  };

  const handleOpenProjectPopup = useCallback((projId: string) => {
    api.data.touchProject(projId).catch(console.warn);
    const url = `/project/${projId}?popup=true`;
    const winName = `ProjectWindow_${projId}`;
    const features = 'width=1280,height=800,scrollbars=yes,resizable=yes,status=yes,location=no,toolbar=no,menubar=no';
    const win = window.open(url, winName, features);
    if (win) {
      win.focus();
    } else {
      // If blocked, fallback to normal navigation in current tab
      dispatch(setReduxActiveProjectId(projId));
      const preferredView = (localStorage.getItem('user_project_default_view') || 'board') as 'board' | 'table' | 'graph' | 'sprints';
      setProjectView(preferredView);
      navigate(`/project/${projId}`);
    }
  }, [navigate, dispatch]);

  const handleSelectProject = useCallback((projectId: string) => {
    // Perform server-side touch to ensure sorting persists across browsers/sessions
    api.data.touchProject(projectId).catch(console.warn);

    // Check if we are already inside a popup window
    const isCurrentPopup = window.opener !== null || window.name.startsWith('ProjectWindow_') || window.location.search.includes('popup=true');

    if (alwaysOpenInPopup && !isCurrentPopup) {
      handleOpenProjectPopup(projectId);
    } else {
      dispatch(setReduxActiveProjectId(projectId));
      const preferredView = (localStorage.getItem('user_project_default_view') || 'board') as 'board' | 'table' | 'graph' | 'sprints';
      setProjectView(preferredView);
      if (isCurrentPopup) {
        navigate(`/project/${projectId}?popup=true`);
      } else {
        navigate(`/project/${projectId}`);
      }
    }
  }, [alwaysOpenInPopup, handleOpenProjectPopup, navigate, dispatch]);

  const project = activeProjectId ? state.projects[activeProjectId] : null;

  const isRightSidebarActive = !!(activeProjectId && project && projectView !== 'sprints');
  const headerMarginRight = isRightSidebarActive ? (isControlDeckOpen ? '368px' : '48px') : '0px';

  const currProjectMembers = useMemo(() => {
    if (!project) return [];
    return (project.members || [])
      .map(id => state.users[id])
      .filter((u): u is User => !!u);
  }, [project, state.users]);

  const activeOnlineUsers = useMemo(() => {
    const candidates = Object.values(state.users || {});
    const onlineCandidates = candidates.filter(u => u && u.id !== currentUser?.id && onlineUsers.has(u.id));
    if (activeProjectId && project) {
      const memberIds = new Set((project.members || []).map(m => typeof m === 'string' ? m : m.id));
      return onlineCandidates.filter(u => memberIds.has(u.id));
    }
    return onlineCandidates;
  }, [state.users, onlineUsers, currentUser?.id, activeProjectId, project]);

  // Recovery flow takes absolute priority
  if (isRecoveringPassword) {
    return <ResetPasswordPage onResetSuccess={() => {
        setIsRecoveringPassword(false);
        // Refresh session to clear recovery metadata
        api.auth.getSession().then(({ data: { session } }) => setSession(session));
    }} />;
  }

  if (!session || !currentUser) return <LandingPage onShowPrivacy={() => {}} />;
  
  if (isJoiningProject || (loading && Object.keys(state.projects || {}).length === 0)) {
      return (
          <div className="min-h-screen bg-[#1C2326] flex flex-col items-center justify-center font-mono text-emerald-500 uppercase tracking-[0.3em] text-[10px]">
              <div className="w-12 h-12 mb-6 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
              <div>{isJoiningProject ? 'Reconfiguring Mesh Clusters...' : 'Initializing Neural Link...'}</div>
              {!isJoiningProject && (
                <div className="text-gray-400 text-[11px] tracking-normal normal-case mt-3 text-center max-w-xs px-4 leading-relaxed font-sans font-normal lowercase">
                  Establishing secure uplink. This first request can take up to 30 seconds matching node latency. Please do not close.
                </div>
              )}
          </div>
      );
  }

  const isRoutingStandalone = view === 'create-task' || view === 'task-details' || view === 'resource-mesh';

  // Quick helper to download current analytics report
  const handleGenerateReport = () => {
    // Collect all tasks across all projects
    const allTasksList: AugmentedTask[] = Object.values(state.projects || {}).flatMap(project => {
      const board = project.board;
      if (!board?.tasks) return [];
      const tasks = Object.values(board.tasks || {}) as Task[];
      const columns = board.columns ? (Object.values(board.columns || {}) as Column[]) : [];
      return tasks.map(task => {
        const column = columns.find(c => c.taskIds.includes(task.id));
        return {
          ...task,
          projectId: project.id,
          projectName: project.name,
          columnId: column?.id || '',
          columnName: column?.title || 'Uncategorized',
        };
      });
    });
    exportTasksToPdf(allTasksList, project ? project.name : "Global Workspace");
  };

  return (
    <ConfirmationContext.Provider value={{ confirm }}>
      <div className="min-h-screen bg-[#0E1314] text-gray-100 flex flex-col font-sans selection:bg-emerald-500/30 overflow-hidden">
        
        {isRoutingStandalone ? (
          // Standalone page layout for create task and detail view mapping to "hide main header"
          <main className="flex-grow h-screen flex flex-col overflow-hidden bg-[#0D1112]">
            {view === 'create-task' && project ? (
              <CreateTaskPage 
                project={project}
                projectMembers={currProjectMembers}
                onSubmit={async (taskData) => {
                  await addTask(project.id, taskData, currentUser.id);
                  navigate(`/project/${project.id}`);
                }}
                onCancel={() => navigate(`/project/${project.id}`)}
                onAddSprint={(sd) => addSprint(project.id, sd)}
              />
            ) : view === 'resource-mesh' ? (
              <ResourceMeshPage 
                projects={state.projects} 
                users={state.users} 
                onlineUsers={onlineUsers} 
                currentUser={currentUser} 
                onTaskClick={handleTaskClick} 
                addProjectLink={addProjectLink} 
                deleteProjectLink={deleteProjectLink} 
              />
            ) : (
              selectedTask && taskProject && (
                <TaskDetailsPage 
                  task={selectedTask} 
                  currentUser={currentUser} 
                  users={Object.values(state.users || {})} 
                  projectMembers={taskProjectMembers} 
                  allProjectTags={taskProjectTags} 
                  sprints={taskProjectSprints} 
                  onlineUsers={onlineUsers} 
                  projectName={taskProject.name}
                  onClose={() => navigate(`/project/${taskProject.id}`)} 
                  onUpdateTask={(t) => updateTask(taskProject.id, t)} 
                  onUpdateSubtask={(tid, sid, up) => updateSubtask(taskProject.id, tid, sid, up)}
                  onDeleteSubtask={(tid, sid) => deleteSubtask(taskProject.id, tid, sid)}
                  onAddSubtasks={(tid, sts) => addSubtasks(taskProject.id, tid, sts, currentUser.id)} 
                  onAddComment={(tid, text) => addComment(taskProject.id, tid, text, currentUser)} 
                  aiFeaturesEnabled={featureFlags.ai}
                  onAddTask={(td) => addTask(taskProject.id, td, currentUser.id)}
                  columns={taskProject.board?.columnOrder?.map(cid => taskProject.board.columns[cid]) || []}
                  allTasks={Object.values(taskProject.board.tasks || {})}
                  projectId={taskProject.id}
                />
              )
            )}
          </main>
        ) : (
          <div className="flex h-screen w-screen overflow-hidden">
            {/* Sidebar Navigation */}
            <aside className={`flex-shrink-0 border-r border-white/5 bg-[#0B0E0F] flex flex-col transition-all duration-300 z-40 relative group/sidebar ${isSidebarCollapsed ? 'w-16' : 'w-64'}`}>
              
              {/* Sidebar Header with Workspace Selector */}
              <div className="h-14 border-b border-white/5 px-4 flex items-center justify-between gap-2.5">
                {!isSidebarCollapsed ? (
                  <div className="relative flex-grow">
                    <button 
                      onClick={() => setIsWorkspaceDropdownOpen(!isWorkspaceDropdownOpen)}
                      className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-left transition-all border border-white/5 group"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <AppLogo className="w-5 h-5 flex-shrink-0 rounded-md overflow-hidden bg-emerald-500/10 p-0.5" />
                        <div className="min-w-0">
                          <p className="text-[10px] font-black uppercase text-emerald-500/70 tracking-widest leading-none mb-0.5">Workspace</p>
                          <p className="text-xs font-bold text-white truncate leading-none">{project ? project.name : 'Global Nexus'}</p>
                        </div>
                      </div>
                      <svg className={`w-3.5 h-3.5 text-gray-500 group-hover:text-white transition-transform ${isWorkspaceDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                      </svg>
                    </button>

                    {isWorkspaceDropdownOpen && (
                      <div className="absolute top-11 left-0 w-[240px] max-h-60 overflow-y-auto bg-[#0E1314] border border-white/10 rounded-xl shadow-2xl p-1.5 z-50 custom-scrollbar">
                        <button 
                          onClick={() => {
                            dispatch(setReduxActiveProjectId(null));
                            setIsWorkspaceDropdownOpen(false);
                            navigate('/dashboard');
                          }}
                          className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-between hover:bg-white/5 ${!project ? 'bg-[#101918] text-emerald-400' : 'text-gray-400 hover:text-white'} min-w-0`}
                        >
                          <span className="truncate pr-2">Global Nexus (All Projects)</span>
                          {!project && <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full flex-shrink-0" />}
                        </button>
                        <div className="h-px bg-white/5 my-1" />
                        {Object.values(state.projects || {}).map((p) => (
                          <div key={p.id} className="relative group/workspacerow flex items-center w-full min-w-0">
                            <button 
                              onClick={() => {
                                handleSelectProject(p.id);
                                setIsWorkspaceDropdownOpen(false);
                              }}
                              className={`flex-grow min-w-0 text-left px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-between hover:bg-white/5 ${project?.id === p.id ? 'bg-[#101918] text-emerald-400' : 'text-gray-400 hover:text-white'}`}
                            >
                              <span className="truncate pr-8">{p.name}</span>
                              {project?.id === p.id && <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full flex-shrink-0" />}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenProjectPopup(p.id);
                                setIsWorkspaceDropdownOpen(false);
                              }}
                              className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover/workspacerow:opacity-100 p-1.5 rounded hover:bg-white/10 text-gray-550 hover:text-emerald-400 transition-all z-10"
                              title="Open in Floating Window"
                            >
                              <ExternalLinkIcon className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <button 
                    onClick={() => {
                      dispatch(setReduxActiveProjectId(null));
                      navigate('/dashboard');
                    }}
                    className="w-full flex justify-center py-1 bg-white/5 hover:bg-white/10 rounded-lg border border-white/5"
                    title="Switch Workspace"
                  >
                    <AppLogo className="w-6 h-6 rounded bg-emerald-500/10 p-0.5" />
                  </button>
                )}

                <button 
                  onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                  className="p-1 rounded-md hover:bg-white/5 text-gray-400 hover:text-white lg:flex hidden"
                >
                  <svg className={`w-4 h-4 transition-transform ${isSidebarCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.75 19.5l-7.5-7.5 7.5-7.5" />
                  </svg>
                </button>
              </div>

              {/* Sidebar Menu Filters & Items */}
              <div className="flex-grow flex flex-col p-3 gap-1 overflow-y-auto custom-scrollbar">
                
                {/* Search Menu Input */}
                {!isSidebarCollapsed && (
                  <div className="relative mb-3">
                    <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                    <input 
                      type="text" 
                      placeholder="Filter nodes..." 
                      value={sidebarSearch}
                      onChange={(e) => setSidebarSearch(e.target.value)}
                      className="w-full bg-white/5 text-xs text-white placeholder-gray-500 py-1.5 pl-8 pr-3 border border-white/5 rounded-lg focus:outline-none focus:border-emerald-500/30 transition-all"
                    />
                  </div>
                )}

                {/* Dashboard Nav */}
                {visibleSidebarPanels.includes('dashboard') && (
                  <button 
                    onClick={() => {
                      dispatch(setReduxActiveProjectId(null));
                      navigate('/dashboard');
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium uppercase tracking-wider transition-all ${
                      currentView === 'dashboard' && !activeProjectId 
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold shadow-[0_0_15px_rgba(16,185,129,0.05)]' 
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                    title="Dashboard"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                    </svg>
                    {!isSidebarCollapsed && <span>Dashboard</span>}
                  </button>
                )}

                {/* Tasks Page Nav */}
                {visibleSidebarPanels.includes('tasks') && (
                  <button 
                    onClick={() => {
                      dispatch(setReduxActiveProjectId(null));
                      navigate('/tasks');
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium uppercase tracking-wider transition-all ${
                      currentView === 'tasks' 
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold shadow-[0_0_15px_rgba(16,185,129,0.05)]' 
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                    title="All Tasks"
                  >
                    <CheckSquareIcon className="w-4 h-4" />
                    {!isSidebarCollapsed && <span>Tasks</span>}
                  </button>
                )}

                {/* Calendar Nav */}
                {visibleSidebarPanels.includes('calendar') && (
                  <button 
                    onClick={() => {
                      alert("Calendar Nexus Module: Loaded successfully. All active sprints & project events synced.");
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium uppercase tracking-wider transition-all text-gray-400 hover:text-white hover:bg-white/5"
                    title="Calendar Sync"
                  >
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    {!isSidebarCollapsed && <span>Calendar</span>}
                  </button>
                )}

                {/* Meetings Nav */}
                {visibleSidebarPanels.includes('meetings') && (
                  <button 
                    onClick={() => {
                      alert("Meetings Active Broadcast Module: Operational. (No current ongoing video conferences)");
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium uppercase tracking-wider transition-all text-gray-400 hover:text-white hover:bg-white/5"
                    title="Meetings Hub"
                  >
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    {!isSidebarCollapsed && <span>Meetings</span>}
                  </button>
                )}

                {/* Mesh / Resource Navigation */}
                {visibleSidebarPanels.includes('resources') && (
                  <div className="space-y-1">
                    <button 
                      onClick={() => {
                        dispatch(setReduxActiveProjectId(null));
                        navigate('/resources');
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium uppercase tracking-wider transition-all ${
                        (currentView === 'resources' || currentView === 'resource-mesh')
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold shadow-[0_0_15px_rgba(16,185,129,0.05)]' 
                          : 'text-gray-400 hover:text-white hover:bg-white/5'
                      }`}
                      title="Mesh & Reports"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0h.5m-1.5 0h-8.5m.5 0h-.5" />
                      </svg>
                      {!isSidebarCollapsed && <span>Mesh & Reports</span>}
                    </button>

                    {/* Sub-navigation for SaaS design */}
                    {!isSidebarCollapsed && (currentView === 'resources' || currentView === 'resource-mesh') && (
                      <div className="pl-6 pr-2 py-1 flex flex-col gap-1 ml-[11px]">
                        <button
                          onClick={() => {
                            dispatch(setReduxActiveProjectId(null));
                            navigate('/resources');
                          }}
                          className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-[0.1em] transition-all ${
                            currentView === 'resources' 
                              ? 'text-emerald-400 bg-white/5 font-black' 
                              : 'text-gray-400 hover:text-white hover:bg-white/5'
                          }`}
                        >
                          • Cluster Members
                        </button>
                        <button
                          onClick={() => {
                            dispatch(setReduxActiveProjectId(null));
                            navigate('/resources/mesh');
                          }}
                          className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-[0.1em] transition-all ${
                            currentView === 'resource-mesh' 
                              ? 'text-emerald-400 bg-white/5 font-black' 
                              : 'text-gray-400 hover:text-white hover:bg-white/5'
                          }`}
                        >
                          • Neural Mesh
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Active Projects Divider Section */}
                {!isSidebarCollapsed && (
                  <div className="mt-4 mb-2 px-3 flex items-center justify-between text-[10px] font-black text-gray-500 tracking-widest uppercase">
                    <span className="flex items-center gap-1.5 cursor-help" title="To open in separate floating windows instead: toggle popup mode">
                      Project Nodes
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={toggleAlwaysOpenInPopup}
                        className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase transition-all tracking-widest leading-none ${alwaysOpenInPopup ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'text-gray-500 hover:text-white bg-white/5 border border-white/5'}`}
                        title={alwaysOpenInPopup ? "Popup Mode Enabled: Clicking project opens floating window" : "Popup Mode Disabled: Click row to switch page"}
                      >
                        {alwaysOpenInPopup ? "Popup: ON" : "Popup: OFF"}
                      </button>
                      <button 
                        onClick={() => setIsCreateProjectOpen(true)}
                        className="p-0.5 hover:text-white hover:bg-white/5 rounded transition-all"
                        title="Add Project"
                      >
                        <PlusIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Projects Section */}
                {!isSidebarCollapsed && (
                  <div className="space-y-0.5 max-h-[220px] overflow-y-auto no-scrollbar">
                    {Object.values(state.projects || {})
                      .filter(p => !sidebarSearch || p.name.toLowerCase().includes(sidebarSearch.toLowerCase()))
                      .map((p) => {
                        const isActive = activeProjectId === p.id;
                        return (
                          <div key={p.id} className="space-y-1 group/projrow relative">
                            <div className="flex items-center w-full">
                              <button 
                                onClick={() => handleSelectProject(p.id)}
                                className={`flex-grow flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-all ${
                                  isActive 
                                    ? 'bg-[#101918] text-emerald-400 border-l-2 border-emerald-500 pl-2 font-bold' 
                                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                                }`}
                                title={p.name}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isActive ? 'bg-emerald-500' : 'bg-gray-600'}`} />
                                  <span className="truncate text-[11px] font-semibold max-w-[125px]">{p.name}</span>
                                </div>
                                {isActive && (
                                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0 mr-4" />
                                )}
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenProjectPopup(p.id);
                                }}
                                className="absolute right-2 opacity-0 group-hover/projrow:opacity-100 p-1 rounded hover:bg-white/10 text-gray-500 hover:text-emerald-400 transition-all z-10"
                                title="Open in Floating Window"
                              >
                                <ExternalLinkIcon className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            
                            {/* Inner view options vertical sidebar item submenu */}
                            {isActive && (
                              <div className="flex flex-col gap-1 pl-6 pr-2 py-1 ml-[11px]">
                                {viewOptions.map(option => (
                                  <button
                                    key={option.id}
                                    onClick={() => setProjectView(option.id as 'board' | 'table' | 'graph' | 'sprints')}
                                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-[0.1em] transition-all ${
                                      projectView === option.id 
                                        ? 'bg-emerald-500 text-black font-black shadow-[0_0_12px_rgba(16,185,129,0.3)]' 
                                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                                    }`}
                                    title={option.label}
                                  >
                                    <option.icon className={`w-3.5 h-3.5 ${projectView === option.id ? 'text-black' : 'text-gray-400'}`} />
                                    <span className="truncate">{option.label}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}

                {/* Management / Settings Utilities */}
                <div className="h-px bg-white/5 my-3" />

                <button 
                  onClick={() => {
                    const targetProjectId = activeProjectId || Object.keys(state.projects || {})[0] || null;
                    if (targetProjectId) {
                      setMemberProjectId(targetProjectId);
                      setIsManageMembersOpen(true);
                    }
                  }}
                  disabled={!activeProjectId && Object.keys(state.projects || {}).length === 0}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all text-gray-400 disabled:opacity-40 hover:text-white hover:bg-white/5`}
                  title="User Management"
                >
                  <UsersIcon className="w-4 h-4" />
                  {!isSidebarCollapsed && <span>User Management</span>}
                </button>

                <button 
                  onClick={() => setIsBillingOpen(true)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all text-gray-400 hover:text-white hover:bg-white/5`}
                  title="Billing Dashboard"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
                  </svg>
                  {!isSidebarCollapsed && <span>Billing</span>}
                </button>

                <button 
                  onClick={() => setIsSettingsOpen(true)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all text-gray-400 hover:text-white hover:bg-white/5`}
                  title="Workspace Settings"
                >
                  <SettingsIcon className="w-4 h-4" />
                  {!isSidebarCollapsed && <span>Settings</span>}
                </button>

                {/* Notifications Panel Trigger */}
                <button 
                  onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all text-gray-400 hover:text-white hover:bg-white/5"
                  title="Recent System Notifications"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <BellIcon className="w-4 h-4" />
                      <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                      <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-500" />
                    </div>
                    {!isSidebarCollapsed && <span>Notifications</span>}
                  </div>
                  {!isSidebarCollapsed && (
                    <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[9px] font-black border border-emerald-500/20">3</span>
                  )}
                </button>

                <div className="pt-2">
                  <PWAInstallButton variant="sidebar" isCollapsed={isSidebarCollapsed} />
                </div>

              </div>

              {/* Sidebar Footer with current session user detail */}
              <div className="p-3 border-t border-white/5 bg-black/10">
                <div className="flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <UserAvatar user={currentUser} className="w-8 h-8 text-xs font-bold" isOnline={true} />
                    {!isSidebarCollapsed && (
                      <div className="min-w-0">
                        <p className="text-[11px] font-black text-white truncate leading-none mb-0.5">{currentUser.name}</p>
                        <p className="text-[9px] font-medium text-gray-500 truncate leading-none">{currentUser.email}</p>
                      </div>
                    )}
                  </div>
                  {!isSidebarCollapsed && (
                    <button 
                      onClick={handleLogoutClick}
                      className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400 hover:text-red-400 transition-colors"
                      title="Uplink Termination (Logout)"
                    >
                      <LogOutIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex-grow flex flex-col min-w-0 h-full overflow-hidden bg-[#0D1112]">
              
              {/* Top Navigation Bar */}
              <header 
                className="h-14 min-h-[56px] max-h-14 flex-shrink-0 overflow-visible flex-nowrap border-b border-white/5 bg-[#0E1314]/85 backdrop-blur-xl px-6 flex items-center justify-between sticky top-0 z-35 transition-all duration-300 ease-in-out"
                style={{ marginRight: headerMarginRight }}
              >
                <div className="flex items-center gap-3 min-w-0 flex-shrink-0">
                  {/* Toggle button on small devices */}
                  <button 
                    onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                    className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white md:hidden flex-shrink-0"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                    </svg>
                  </button>

                  {/* Breadcrumb path tracker */}
                  <div className="flex items-center gap-1.5 text-xs text-gray-400 font-semibold truncate whitespace-nowrap min-w-0">
                    <span className="text-gray-500 truncate hidden sm:inline">Enterprise Workspace</span>
                    <span className="text-gray-700 hidden sm:inline">/</span>
                    <button 
                      onClick={() => { dispatch(setReduxActiveProjectId(null)); navigate('/dashboard'); }} 
                      className="text-gray-400 hover:text-white transition-all uppercase tracking-wider text-[11px] truncate flex-shrink-0"
                    >
                      {project ? 'Projects' : 'Global Network'}
                    </button>
                    {project && (
                      <>
                        <span className="text-gray-700">/</span>
                        <span className="text-white bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 text-[11px] font-bold truncate max-w-[120px]">{project.name}</span>
                      </>
                    )}
                    <span className="text-gray-700">/</span>
                    <span className="text-gray-400 text-[11px] uppercase tracking-widest truncate">{currentView}</span>
                  </div>
                </div>

                {/* Search Bar Shortcut mimicking Linear/Notion command menu */}
                <div className="hidden md:flex items-center flex-grow max-w-sm justify-center mx-6 min-w-0">
                  <button 
                    onClick={() => setIsSearchOpen(true)}
                    className="w-full flex items-center justify-between px-3 py-1.5 bg-white/5 border border-white/5 hover:border-white/10 rounded-xl text-left text-gray-500 hover:bg-white/[0.08] hover:text-gray-300 transition-all text-xs truncate"
                  >
                    <div className="flex items-center gap-2 min-w-0 truncate">
                      <SearchIcon className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                      <span className="truncate">Search Canvas workspace...</span>
                    </div>
                    <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded border border-white/10 font-mono flex-shrink-0">⌘K</span>
                  </button>
                </div>

                {/* Right utility alignment */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  
                  {/* Latency feedback pulse */}
                  <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-xl bg-emerald-500/5 border border-emerald-500/10 text-[10px] text-emerald-400 font-mono tracking-widest">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                    <span>● 8ms online</span>
                  </div>

                  {/* Sync mesh button */}
                  <button 
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className={`p-2 rounded-xl bg-white/5 border border-white/5 text-gray-400 hover:bg-white/10 hover:text-white transition-all ${isRefreshing ? 'animate-spin text-emerald-500' : ''}`}
                    title="Synchronize Global Mesh"
                  >
                    <RotateCwIcon className="w-4 h-4" />
                  </button>

                  {/* Active project chat drawer selector */}
                  {activeProjectId && (
                    <button 
                      onClick={() => setIsChatOpen(!isChatOpen)} 
                      className={`p-2 rounded-xl border border-white/5 transition-all relative ${isChatOpen ? 'bg-white text-black shadow-lg shadow-white/5' : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'}`}
                      title="Project Neural Chat"
                    >
                      <MessageSquareIcon className="w-4 h-4" />
                      <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                    </button>
                  )}

                  {/* AI voice assistance overlay */}
                  {featureFlags.ai && (
                    <button 
                      onClick={() => setIsVoiceOpen(true)} 
                      className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all"
                      title="Launch Matrix Voice AI"
                    >
                      <BotMessageSquareIcon className="w-4 h-4" />
                    </button>
                  )}

                  {/* Quick Actions Dropdown Selector */}
                  <div className="relative">
                    <button 
                      onClick={() => setIsQuickActionsOpen(!isQuickActionsOpen)}
                      className="p-2 bg-gradient-to-br from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-black rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center"
                      title="Matrix Actions"
                    >
                      <PlusIcon className="w-4 h-4" />
                    </button>

                    {isQuickActionsOpen && (
                      <div className="absolute right-0 mt-2 w-52 bg-[#0E1314] border border-white/10 rounded-xl shadow-2xl p-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                        <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest px-3 py-1 leading-none mb-1">Quick Action Network</p>
                        <button 
                          onClick={() => { setIsCreateProjectOpen(true); setIsQuickActionsOpen(false); }}
                          className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold text-gray-300 hover:text-white hover:bg-white/5 flex items-center gap-2"
                        >
                          <span className="w-2 h-2 rounded bg-emerald-500" />
                          <span>Create Project</span>
                        </button>
                        <button 
                          onClick={() => {
                            if (activeProjectId) {
                              navigate(`/project/${activeProjectId}`);
                              setIsCreateTaskOpen(true);
                            } else {
                              alert("Please select a project node workspace from the sidebar list first.");
                            }
                            setIsQuickActionsOpen(false);
                          }}
                          className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold text-gray-300 hover:text-white hover:bg-white/5 flex items-center gap-2"
                        >
                          <span className="w-2 h-2 rounded bg-violet-500" />
                          <span>Create Task Node</span>
                        </button>
                        <button 
                          onClick={() => {
                            const targetProjectId = activeProjectId || Object.keys(state.projects || {})[0] || null;
                            if (targetProjectId) {
                              setMemberProjectId(targetProjectId);
                              setIsManageMembersOpen(true);
                            }
                            setIsQuickActionsOpen(false);
                          }}
                          className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold text-gray-300 hover:text-white hover:bg-white/5 flex items-center gap-2"
                        >
                          <span className="w-2 h-2 rounded bg-blue-500" />
                          <span>Add Team Member</span>
                        </button>
                        <button 
                          onClick={() => { handleGenerateReport(); setIsQuickActionsOpen(false); }}
                          className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold text-gray-300 hover:text-white hover:bg-white/5 flex items-center gap-2"
                        >
                          <span className="w-2 h-2 rounded bg-rose-500" />
                          <span>Generate PDF Report</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Install Desktop Web App (Windows / Linux) */}
                  <PWAInstallButton variant="header" />

                  {/* Help Info Hub */}
                  <button onClick={() => setIsInfoHubOpen(true)} className="p-2 text-gray-500 hover:text-white transition-colors">
                    <HelpCircleIcon className="w-4 h-4" />
                  </button>

                  {/* Neural Presence / Online Project Members Avatar Stack */}
                  {activeOnlineUsers.length > 0 && (
                    <div className="flex items-center -space-x-2 mr-1 relative overflow-visible" id="project-presence-group">
                      {activeOnlineUsers.slice(0, 4).map((onlineUser) => (
                        <div 
                          key={onlineUser.id} 
                          className="relative group/avatar cursor-help transition-all duration-200 hover:-translate-y-0.5 hover:z-30"
                        >
                          <UserAvatar 
                            user={onlineUser} 
                            className="w-7 h-7 text-[9px] font-bold ring-2 ring-[#0E1314] hover:ring-emerald-400 transition-all rounded-full" 
                            isOnline={true} 
                          />
                          {/* Rich interactive tooltip */}
                          <div className="absolute top-9 left-1/2 -translate-x-1/2 hidden group-hover/avatar:flex flex-col bg-[#0E1314] border border-white/10 rounded-lg p-2 shadow-2xl z-50 whitespace-nowrap text-left text-[10px] pointer-events-none animate-in fade-in slide-in-from-top-1 duration-100">
                            <p className="font-bold text-white leading-none mb-0.5">{onlineUser.name}</p>
                            <p className="text-gray-400 text-[9px] lowercase leading-none mb-1">{onlineUser.email || `${onlineUser.name.toLowerCase().replace(/\s+/g, '')}@workspace.net`}</p>
                            <div className="flex">
                              <span className="px-1 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[8px] font-black uppercase tracking-[0.1em] border border-emerald-500/20">{onlineUser.role || 'Member'}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                      {activeOnlineUsers.length > 4 && (
                        <div 
                          className="w-7 h-7 rounded-full bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 text-[9px] font-black flex items-center justify-center text-emerald-400 ring-2 ring-[#0E1314] cursor-help relative group/avgore transition-all duration-200 z-10"
                        >
                          +{activeOnlineUsers.length - 4}
                          {/* Tooltip listing extra online members */}
                          <div className="absolute top-9 right-0 hidden group-hover/avgore:flex flex-col bg-[#0E1314] border border-white/10 rounded-lg p-2 shadow-2xl z-50 whitespace-nowrap text-left text-[10px] pointer-events-none animate-in fade-in slide-in-from-top-1 duration-100 min-w-[120px]">
                            <p className="font-black text-gray-400 text-[8px] uppercase tracking-wider mb-1 border-b border-white/5 pb-1 select-none">Also Online:</p>
                            <div className="flex flex-col gap-0.5">
                              {activeOnlineUsers.slice(4).map(ou => (
                                <p key={ou.id} className="text-white font-semibold truncate">{ou.name}</p>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Profile Menu Settings trigger */}
                  <button 
                    onClick={() => setIsSettingsOpen(true)}
                    className="w-7 h-7 rounded-full overflow-hidden border border-white/10 hover:border-white/20 hover:scale-105 transition-all flex items-center justify-center text-[10px] font-bold text-white uppercase"
                    title="User Profile Profile Node"
                  >
                    <UserAvatar user={currentUser} className="w-full h-full text-[10px]" />
                  </button>
                </div>
              </header>

              {/* Main Contents Board Area (Render dynamic screen views) */}
              <main className="flex-grow p-6 overflow-y-auto custom-scrollbar relative">
                
                {activeProjectId && project ? (
                  <KanbanBoard 
                    project={project} projects={Object.values(state.projects || {})} currentUser={currentUser} users={Object.values(state.users || {})} onlineUsers={onlineUsers} aiFeaturesEnabled={featureFlags.ai}
                    projectView={projectView} setProjectView={setProjectView}
                    isControlDeckOpen={isControlDeckOpen}
                    setIsControlDeckOpen={setIsControlDeckOpen}
                    onDragEnd={(r, fd) => onDragEnd(project.id, r, fd)} updateTask={(t) => updateTask(project.id, t)} addSubtasks={(tid, sts) => addSubtasks(project.id, tid, sts, currentUser.id)}
                    addComment={(tid, text) => addComment(project.id, tid, text, currentUser)} addAiTask={(p) => addAiTask(project.id, p)}
                    addTask={(td) => addTask(project.id, td, currentUser.id)} deleteTask={(tid, cid) => deleteTask(project.id, tid, cid)}
                    duplicateTask={(tid) => duplicateTask(project.id, tid)}
                    addColumn={(t) => addColumn(project.id, t)} deleteColumn={(cid) => deleteColumn(project.id, cid)} isChatOpen={isChatOpen} onCloseChat={() => setIsChatOpen(false)} chatMessages={project.chatMessages}
                    onSendMessage={(projectId, txt) => sendChatMessage(projectId, txt, currentUser)} onTaskClick={handleTaskClick} addProjectLink={(t, u) => addProjectLink(project.id, t, u, currentUser.id)}
                    deleteProjectLink={deleteProjectLink} 
                    addTasksBatch={(ts, sid) => addTasksBatch(project.id, ts, sid)} addSprint={(sd) => addSprint(project.id, sd)} updateSprint={(sid, up) => updateSprint(project.id, sid, up)}
                    deleteSprint={(sid) => deleteSprint(project.id, sid)} bulkUpdateTaskSprint={bulkUpdateTaskSprint} completeSprint={completeSprint}
                    addFilterSegment={(n, f) => addFilterSegment(project.id, n, f, currentUser.id)} updateFilterSegment={updateFilterSegment} deleteFilterSegment={deleteFilterSegment}
                    fetchChatMessagesForProject={fetchChatMessagesForProject}
                    updateTasksFromBoard={(tasksList) => updateTasksFromBoard(project.id, tasksList)}
                  />
                ) : currentView === 'dashboard' ? (
                  <DashboardPage projects={Object.values(state.projects || {})} users={state.users || {}} currentUser={currentUser} onlineUsers={onlineUsers} onSelectProject={handleSelectProject} onCreateProject={() => setIsCreateProjectOpen(true)} onManageMembers={(id) => {setMemberProjectId(id); setIsManageMembersOpen(true);}} onShareProject={(p) => {setShareProject(p); setIsShareModalOpen(true);}} addProjectFromPlan={addProjectFromPlan} aiFeaturesEnabled={featureFlags.ai} onOpenProjectPopup={handleOpenProjectPopup} />
                ) : currentView === 'tasks' ? (
                  <TasksPage projects={state.projects} users={state.users} currentUser={currentUser} onTaskClick={handleTaskClick} />
                ) : (
                  <ResourceManagementPage projects={state.projects} users={state.users} onlineUsers={onlineUsers} onTaskClick={handleTaskClick} />
                )}

              </main>

            </div>
          </div>
        )}

        <SettingsModal 
          isOpen={isSettingsOpen} 
          onClose={() => setIsSettingsOpen(false)} 
          currentUser={currentUser} 
          onUpdateUser={updateUserProfile} 
          featureFlags={featureFlags} 
          onFlagsChange={setFeatureFlags} 
          projects={Object.values(state.projects || {})} 
          onDeleteProject={deleteProject} 
          onShowPrivacy={() => {}} 
          onPreferencesChange={() => setPrefCounter(c => c + 1)}
        />
        {activeTheme === 'light' && (
          <style>{`
            html, body {
              background-color: #F3F4F6 !important;
              color: #111827 !important;
            }
            /* Universal Background Hex Color Mappings */
            [class*="bg-[#0E1314]"], [class*="bg-[#0e1314]"], .bg-\\[\\#0E1314\\], .bg-\\[\\#0e1314\\] { background-color: #FFFFFF !important; }
            [class*="bg-[#0D1112]"], [class*="bg-[#0d1112]"], .bg-\\[\\#0D1112\\], .bg-\\[\\#0d1112\\] { background-color: #F9FAFB !important; }
            [class*="bg-[#0B0E0F]"], [class*="bg-[#0b0e0f]"], .bg-\\[\\#0B0E0F\\], .bg-\\[\\#0b0e0f\\] { background-color: #FFFFFF !important; border-color: #E2E8F0 !important; }
            [class*="bg-[#090D0E]"], [class*="bg-[#090d0e]"], .bg-\\[\\#090D0E\\], .bg-\\[\\#090d0e\\] { background-color: #F3F4F6 !important; }
            [class*="bg-[#131C1B]"], [class*="bg-[#131c1b]"], .bg-\\[\\#131C1B\\], .bg-\\[\\#131c1b\\] { background-color: #F8FAFC !important; border-color: #E2E8F0 !important; }
            [class*="bg-[#1C2326]"], [class*="bg-[#1c2326]"], .bg-\\[\\#1C2326\\], .bg-\\[\\#1c2326\\] { background-color: #E2E8F0 !important; }
            [class*="bg-[#0F1517]"], [class*="bg-[#0f1517]"] { background-color: #F1F5F9 !important; }
            [class*="bg-[#0D1117]"], [class*="bg-[#0d1117]"] { background-color: #F8FAFC !important; }
            [class*="bg-[#0C1012]"], [class*="bg-[#0c1012]"] { background-color: #FFFFFF !important; }
            [class*="bg-[#101918]"], [class*="bg-[#101918]"] { background-color: #D1FAE5 !important; }
            [class*="bg-[#141B1C]"], [class*="bg-[#141b1c]"] { background-color: #F1F5F9 !important; }
            [class*="bg-[#121819]"], [class*="bg-[#121819]"] { background-color: #F1F5F9 !important; }
            .bg-black\\/10 { background-color: #F1F5F9 !important; }
            .bg-[#0B0E0F] { background-color: #FFFFFF !important; }

            /* Graph Schema Visualizer light theme mapping */
            [class*="bg-[#0B0F11]"], [class*="bg-[#0b0f11]"] { background-color: #E2E8F0 !important; }
            [class*="bg-[#101618]"], [class*="bg-[#101618]"] { background-color: #FFFFFF !important; border-color: rgba(0, 0, 0, 0.08) !important; }
            [class*="bg-[#0E1315]"], [class*="bg-[#0e1315]"] { background-color: #FFFFFF !important; border-color: rgba(0, 0, 0, 0.08) !important; }
            [class*="bg-[#0F1C1C]"], [class*="bg-[#0f1c1c]"] { background-color: #ECFDF5 !important; border-color: #10B981 !important; }
            [class*="bg-[#141A1C]"], [class*="bg-[#141a1c]"] { background-color: #F1F5F9 !important; border-color: rgba(0, 0, 0, 0.06) !important; }
            [class*="bg-[#111719]"], [class*="bg-[#111719]"] { background-color: #F8FAFC !important; border-color: rgba(0, 0, 0, 0.06) !important; }
            [class*="bg-[#131C1B]/"], [class*="bg-[#131c1b]/"], [class*="bg-[#131C1B]\\/"], [class*="bg-[#131c1b]\\/"] {
              background-color: rgba(255, 255, 255, 0.85) !important;
              backdrop-filter: blur(12px) !important;
            }

            /* Gray background elements adjusted for light theme */
            .bg-gray-800 { background-color: #E2E8F0 !important; color: #1F2937 !important; border-color: #CBD5E1 !important; }
            .bg-gray-700 { background-color: #F1F5F9 !important; color: #374151 !important; }
            .hover\\:bg-gray-700:hover { background-color: #E2E8F0 !important; }
            .hover\\:bg-gray-800:hover, [class*="hover:bg-gray-800"]:hover, .hover\\:bg-gray-800 { background-color: rgba(0, 0, 0, 0.05) !important; }

            /* Translucent/Slash bg-gray-800 overrides to avoid muddy overlays in light mode */
            [class*="bg-gray-800/"], [class*="bg-gray-800\\/"] { background-color: #F8FAFC !important; border: 1px solid #E2E8F0 !important; }
            [class*="bg-gray-800/50"], [class*="bg-gray-800\\/50"], .bg-gray-800\\/50 { background-color: #F1F5F9 !important; border: 1px solid #CBD5E1 !important; }
            [class*="bg-gray-800/40"], [class*="bg-gray-800\\/40"], .bg-gray-800\\/40 { background-color: #F8FAFC !important; border: 1px solid #CBD5E1 !important; }
            [class*="bg-gray-800/30"], [class*="bg-gray-800\\/30"], .bg-gray-800\\/30 { background-color: #F8FAFC !important; border: 1px solid #CBD5E1 !important; }
            [class*="bg-gray-800/20"], [class*="bg-gray-800\\/20"], .bg-gray-800\\/20 { background-color: rgba(0, 0, 0, 0.03) !important; }

            /* Translucent Active/Badge Background Adjustments for light theme */
            .bg-white\/5, [class~="bg-white/5"] { background-color: rgba(0, 0, 0, 0.04) !important; }
            .bg-white\/10, [class~="bg-white/10"] { background-color: rgba(0, 0, 0, 0.08) !important; }
            .bg-white\/15, [class~="bg-white/15"] { background-color: rgba(0, 0, 0, 0.12) !important; }
            .bg-white\/20, [class~="bg-white/20"] { background-color: rgba(0, 0, 0, 0.16) !important; }

            /* Dynamic Hover Background Adjustments */
            .hover\:bg-white\/5:hover, [class~="hover:bg-white/5"]:hover,
            .group-hover\:bg-white\/5:hover, [class~="group-hover:bg-white/5"]:hover { background-color: rgba(0, 0, 0, 0.05) !important; }
            .hover\:bg-white\/10:hover, [class~="hover:bg-white/10"]:hover { background-color: rgba(0, 0, 0, 0.08) !important; }
            .hover\\:text-white:hover, [class*="hover:text-white"]:hover { color: #111827 !important; }

            /* Text & Font Contrast Overrides */
            .text-white, [class*="text-slate-100"], [class*="text-slate-50"] { color: #111827 !important; }
            [class*="text-gray-100"], [class*="text-gray-200"], [class*="text-gray-300"], [class*="text-gray-200"] { color: #1F2937 !important; }
            [class*="text-slate-200"], [class*="text-slate-300"] { color: #1F2937 !important; }
            [class*="text-gray-400"], [class*="text-slate-400"] { color: #4B5563 !important; }
            [class*="text-gray-500"], [class*="text-slate-500"], [class*="text-gray-600"] { color: #6B7280 !important; }
            [class*="text-emerald-400"] { color: #047857 !important; }
            [class*="text-sky-400"] { color: #0284C7 !important; }
            [class*="text-amber-400"] { color: #D97706 !important; }
            [class*="text-rose-400"] { color: #E11D48 !important; }
            [class*="text-purple-400"] { color: #7C3AED !important; }
            [class*="text-cyan-400"] { color: #0891B2 !important; }
            [class*="text-emerald-500/70"], .text-emerald-500\/70, [class*="text-emerald-500/"], [class*="text-emerald-500\\/"] { color: #047857 !important; }

            /* Universal Border Overlay Settings */
            [class*="border-white/"], [class*="border-white\\/"] { border-color: rgba(0, 0, 0, 0.08) !important; }
            .border-white\\/5 { border-color: rgba(0, 0, 0, 0.06) !important; }
            .border-white\\/10 { border-color: rgba(0, 0, 0, 0.12) !important; }
            .border-white\\/20 { border-color: rgba(0, 0, 0, 0.18) !important; }
            [class*="border-emerald-500/"] { border-color: rgba(4, 120, 87, 0.25) !important; }
            .border-gray-700, [class*="border-gray-700"] { border-color: #CBD5E1 !important; }
            .border-gray-800, [class*="border-gray-800"] { border-color: #CBD5E1 !important; }

            /* Inputs, Drops, Selects & Direct Visual Modifiers */
            button, select, select option, input, textarea { color: #1F2937 !important; }
            
            /* Make inputs and selects have pristine white backgrounds with elegant soft borders */
            select, select option, input, textarea,
            [class*="bg-[#1C2326]"] select, [class*="bg-[#1c2326]"] select,
            select[class*="bg-[#1C2326]"], select[class*="bg-[#1c2326]"],
            input[class*="bg-[#1C2326]"], input[class*="bg-[#1c2326]"],
            textarea[class*="bg-[#1C2326]"], textarea[class*="bg-[#1c2326]"] {
              background-color: #FFFFFF !important;
              background: #FFFFFF !important;
              color: #1F2937 !important;
              border-color: #CBD5E1 !important;
            }
            input::placeholder, textarea::placeholder { color: #9CA3AF !important; }
            .text-emerald-500 { color: #047857 !important; }
            
            /* Green Badges/Pills and Alerts styling */
            [class*="bg-emerald-500/5"], .bg-emerald-500\/5 { background-color: #ECFDF5 !important; border: 1px solid #D1FAE5 !important; }
            [class*="bg-emerald-500/10"], [class*="bg-emerald-500\\/10"] { background-color: #D1FAE5 !important; color: #065F46 !important; }
            [class*="bg-rose-500/10"], [class*="bg-rose-500\\/10"] { background-color: #FFE4E6 !important; color: #9F1239 !important; }
            [class*="bg-sky-500/10"], [class*="bg-sky-500\\/10"] { background-color: #E0F2FE !important; color: #075985 !important; }
            [class*="bg-red-500/10"], [class*="bg-red-500\\/10"] { background-color: #FFE4E6 !important; color: #9F1239 !important; }
            [class*="bg-orange-500/10"], [class*="bg-orange-500\\/10"] { background-color: #FFEDD5 !important; color: #9A3412 !important; }
            [class*="bg-amber-500/10"], [class*="bg-amber-500\\/10"] { background-color: #FEF3C7 !important; color: #92400E !important; }
            [class*="bg-blue-500/10"], [class*="bg-blue-500\\/10"] { background-color: #DBEAFE !important; color: #1E40AF !important; }

            /* Avatar & Online status ring override for light mode */
            [class*="ring-[#131C1B]"], [class*="ring-[#131c1b]"] { --tw-ring-color: #FFFFFF !important; }
            [class*="ring-white/10"], [class*="ring-white\\/10"] { --tw-ring-color: rgba(0, 0, 0, 0.1) !important; }

            /* Dropdown lists: Ensure they have white backgrounds, gray boundaries, and dark texts */
            [class*="bg-[#0E1314]"], [class*="bg-[#0e1314]"] {
              background-color: #FFFFFF !important;
              border: 1px solid rgba(0, 0, 0, 0.1) !important;
              color: #111827 !important;
            }
            [class*="bg-[#0E1314]"] p, [class*="bg-[#0e1314]"] p {
              color: #6B7280 !important;
              border-color: rgba(0, 0, 0, 0.06) !important;
            }
            [class*="bg-[#0E1314]"] button, [class*="bg-[#0e1314]"] button {
              color: #374151 !important;
            }
            [class*="bg-[#0E1314]"] button:hover, [class*="bg-[#0e1314]"] button:hover {
              background-color: rgba(0, 0, 0, 0.04) !important;
              color: #111827 !important;
            }
            [class*="bg-[#0E1314]"] label, [class*="bg-[#0e1314]"] label {
              color: #374151 !important;
            }
            [class*="bg-[#0E1314]"] label:hover, [class*="bg-[#0e1314]"] label:hover {
              background-color: rgba(0, 0, 0, 0.04) !important;
              color: #111827 !important;
            }

            /* Tooltips overrides: ensure tooltip absolute overlays match light styling rules */
            [class*="absolute"][class*="bg-black"][class*="text-[9px]"],
            [class*="absolute"][class*="bg-black"][class*="text-gray-300"] {
              background-color: #FFFFFF !important;
              color: #111827 !important;
              border-color: rgba(0, 0, 0, 0.1) !important;
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08) !important;
            }

            /* Scrollbar Refinement */
            .custom-scrollbar::-webkit-scrollbar-thumb {
              background-color: rgba(0, 0, 0, 0.15) !important;
            }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover {
              background-color: rgba(0, 0, 0, 0.25) !important;
            }

            /* Quill Rich Text Editor Light theme Overrides */
            .rich-text-editor-container {
              background-color: #FFFFFF !important;
              border-color: rgba(0, 0, 0, 0.12) !important;
              color: #111827 !important;
            }
            .rich-text-editor-container .ql-toolbar.ql-snow {
              background-color: #F3F4F6 !important;
              border-bottom: 1px solid rgba(0, 0, 0, 0.08) !important;
            }
            .rich-text-editor-container .ql-editor {
              color: #111827 !important;
            }
            .rich-text-editor-container .ql-editor.ql-blank::before {
              color: rgba(0, 0, 0, 0.38) !important;
            }
            .rich-text-editor-container .ql-snow .ql-stroke {
              stroke: #4B5563 !important;
            }
            .rich-text-editor-container .ql-snow .ql-fill {
              fill: #4B5563 !important;
            }
            .rich-text-editor-container .ql-snow .ql-picker {
              color: #4B5563 !important;
            }
            .rich-text-editor-container .ql-snow .ql-picker-options {
              background-color: #FFFFFF !important;
              border: 1px solid rgba(0, 0, 0, 0.1) !important;
            }
            .rich-text-editor-container .ql-snow .ql-picker-item {
              color: #4B5563 !important;
            }

            /* Light theme Quill / Rich text table rules */
            .ql-editor table {
              border: 2px solid rgba(0, 0, 0, 0.15) !important;
              background-color: rgba(0, 0, 0, 0.01) !important;
            }
            .ql-editor th {
              border: 2px solid rgba(0, 0, 0, 0.15) !important;
              background-color: rgba(16, 185, 129, 0.08) !important;
              color: #065f46 !important;
            }
            .ql-editor td {
              border: 1px solid rgba(0, 0, 0, 0.12) !important;
              color: #1f2937 !important;
            }
            .ql-editor tr:nth-child(even) {
              background-color: rgba(0, 0, 0, 0.03) !important;
            }
          `}</style>
        )}
        {activeTheme === 'gray' && (
          <style>{`
            html, body {
              background-color: #1F2426 !important;
              color: #F3F4F6 !important;
            }
            .bg-\\[\\#0E1314\\], .bg-\\[\\#0D1112\\], .bg-\\[\\#0e1314\\] { background-color: #1F2426 !important; }
            .bg-\\[\\#0B0E0F\\], .bg-\\[\\#0b0e0f\\] { background-color: #181C1E !important; border-color: #2D3538 !important; }
            .bg-\\[\\#131C1B\\], .bg-\\[\\#131c1b\\] { background-color: #262D30 !important; border-color: #313C40 !important; }
            .bg-\\[\\#1C2326\\], .bg-\\[\\#1c2326\\] { background-color: #2D3639 !important; }
            .border-white\\/5 { border-color: #2D3538 !important; }
            .border-white\\/10 { border-color: #384246 !important; }
            select, select option {
              background-color: #181C1E !important;
              background: #181C1E !important;
              color: #F3F4F6 !important;
            }
            input, textarea {
              background-color: #181C1E !important;
              color: #F3F4F6 !important;
            }
          `}</style>
        )}
        {isCreateProjectOpen && <CreateProjectModal onClose={() => setIsCreateProjectOpen(false)} onAddProject={(n, d) => addProject(n, d, currentUser.id)} />}
        {isManageMembersOpen && memberProjectId && state.projects?.[memberProjectId] && (
          <ManageMembersModal
            project={state.projects[memberProjectId]}
            projects={Object.values(state.projects || {})}
            onSelectProject={(id) => setMemberProjectId(id)}
            onOpenInviteLinks={(proj) => {
              setIsManageMembersOpen(false);
              setShareProject(proj);
              setIsShareModalOpen(true);
            }}
            allUsers={Object.values(state.users || {})}
            onlineUsers={onlineUsers}
            onClose={() => setIsManageMembersOpen(false)}
            onSave={(mids) => updateProjectMembers(memberProjectId, mids)}
          />
        )}
        {isShareModalOpen && shareProject && <ManageInviteLinksModal project={shareProject} currentUser={currentUser} onClose={() => setIsShareModalOpen(false)} />}
        <GlobalSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} projects={state.projects} users={state.users} onSelectProject={handleSelectProject} onSelectTask={handleTaskClick} />
        <VoiceAssistantModal isOpen={isVoiceOpen} onClose={() => setIsVoiceOpen(false)} onCommand={handleVoiceCommand} />
        <FeedbackFab onClick={() => setIsFeedbackOpen(true)} />
        <FeedbackModal 
          isOpen={isFeedbackOpen} 
          onClose={() => setIsFeedbackOpen(false)} 
          onSubmit={async (feedbackData) => {
            await api.data.submitFeedback({
              ...feedbackData,
              userId: currentUser?.id,
            });
          }} 
          />
        <InfoHubModal isOpen={isInfoHubOpen} onClose={() => setIsInfoHubOpen(false)} />
        <OfflineIndicator />

        {inviteStatus && (
          <div className="fixed bottom-5 right-5 z-[110] max-w-sm animate-in fade-in slide-in-from-bottom-3 duration-200">
            <div className={`px-4 py-3 rounded-xl border shadow-2xl flex items-start gap-3 backdrop-blur-md ${
              inviteStatus.type === 'success'
                ? 'bg-[#0F1C1C]/95 border-emerald-500/40 text-emerald-300'
                : 'bg-[#1C1214]/95 border-rose-500/40 text-rose-300'
            }`}>
              <span className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
                inviteStatus.type === 'success' ? 'bg-emerald-500' : 'bg-rose-500'
              }`} />
              <p className="text-xs font-medium leading-relaxed flex-grow">{inviteStatus.message}</p>
              <button
                type="button"
                onClick={() => setInviteStatus(null)}
                className="text-xs font-bold opacity-70 hover:opacity-100 cursor-pointer ml-1"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Floating Mock Billing subscription slider panel */}
        {isBillingOpen && (
          <div className="fixed inset-0 z-[100] flex justify-end bg-black/60 backdrop-blur-xs">
            <div className="w-full max-w-md h-full bg-[#0E1314] border-l border-white/5 p-6 flex flex-col justify-between shadow-2xl relative animate-in slide-in-from-right duration-200">
              <div>
                <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-6">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
                    </svg>
                    <h2 className="text-sm font-black uppercase text-white tracking-widest">Enterprise Billing</h2>
                  </div>
                  <button onClick={() => setIsBillingOpen(false)} className="text-gray-400 hover:text-white text-xs font-bold uppercase p-1 hover:bg-white/5 rounded-lg">Close</button>
                </div>

                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-gradient-to-br from-[#121918] to-[#0A0F0E] border border-emerald-500/15">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#10B981] mb-1">Current Plan Tier</p>
                    <h3 className="text-lg font-black text-white">SCOPE LOG Scale Core</h3>
                    <p className="text-xs text-gray-400 mt-1">Automatic workload synchronization, up to 10 project nodes.</p>
                    <div className="flex items-baseline gap-1 mt-3">
                      <span className="text-xl font-bold text-white">$49</span>
                      <span className="text-[10px] text-gray-500 font-mono">/ Month / Node</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Resource Quotas Usage</h4>
                    <div className="bg-white/5 p-3.5 rounded-xl border border-white/5 space-y-3">
                      <div>
                        <div className="flex justify-between text-[11px] mb-1.5">
                          <span className="text-gray-400 font-semibold">Active Node Connections</span>
                          <span className="text-white font-bold">{Object.keys(state.projects || {}).length} / 10 Nodes</span>
                        </div>
                        <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                          <div className="bg-emerald-500 h-full rounded-full transition-all" style={{ width: `${Math.min(100, (Object.keys(state.projects || {}).length / 10) * 100)}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-[11px] mb-1.5">
                          <span className="text-gray-400 font-semibold">AI Assistant Executions</span>
                          <span className="text-white font-bold">128 / 500 Credits</span>
                        </div>
                        <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                          <div className="bg-violet-500 h-full rounded-full transition-all" style={{ width: '25.6%' }} />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Billing History</h4>
                    <div className="bg-white/5 rounded-xl border border-white/5 divide-y divide-white/5 text-[11px]">
                      <div className="flex justify-between items-center p-3 text-gray-400 font-medium">
                        <span>INV-2026-004 (Pending)</span>
                        <span className="text-emerald-400 font-bold">$49.00</span>
                      </div>
                      <div className="flex justify-between items-center p-3 text-gray-400 font-medium">
                        <span>INV-2026-003 (Succeeded)</span>
                        <span className="text-gray-300 font-semibold">$49.00</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <button 
                  onClick={() => alert("Enterprise custom plan upgrade requested. An account executive will reach under 24 Latency cycles.")}
                  className="w-full py-3 bg-white text-black font-black text-xs uppercase tracking-widest rounded-xl hover:bg-emerald-400 transition-all shadow-xl"
                >
                  Upgrade Framework Core
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Interactive Mock Notifications Panel */}
        {isNotificationsOpen && (
          <div className="fixed inset-0 z-[100] flex justify-end bg-black/40 backdrop-blur-xs">
            <div className="w-full max-w-sm h-full bg-[#0E1314] border-l border-white/5 p-6 flex flex-col shadow-2xl relative animate-in slide-in-from-right duration-200">
              <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
                <div className="flex items-center gap-2">
                  <BellIcon className="text-emerald-400 w-4 h-4" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-white">Workspace Alerts</h3>
                </div>
                <button onClick={() => setIsNotificationsOpen(false)} className="text-gray-500 hover:text-white text-[10px] font-black uppercase tracking-wider p-1">Close</button>
              </div>

              <div className="flex-grow space-y-2 overflow-y-auto no-scrollbar">
                <div className="p-3 bg-emerald-500/5 col-span-3 border border-emerald-500/10 rounded-xl">
                  <div className="flex items-center gap-1.5 text-emerald-400 text-[10px] font-bold uppercase tracking-wider mb-1">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> Live Latency Optimal
                  </div>
                  <p className="text-[11px] text-gray-300 font-medium">Neural mesh routing resolved under 8ms. All 5 global edge worker pipelines running optimal cycle speed.</p>
                  <span className="text-[9px] text-gray-500 font-mono mt-2 block">1 minute ago</span>
                </div>

                <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                  <div className="flex items-center gap-1.5 text-violet-400 text-[10px] font-bold uppercase tracking-wider mb-1">
                    <span className="w-1.5 h-1.5 bg-violet-400 rounded-full" /> Auto-Plan Resolved
                  </div>
                  <p className="text-[11px] text-gray-300 font-medium">CSV structure successfully transformed into a full interactive 8-node kanban backlog blueprint.</p>
                  <span className="text-[9px] text-gray-500 font-mono mt-2 block">35 minutes ago</span>
                </div>

                <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                  <div className="flex items-center gap-1.5 text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">
                    <span className="w-1.5 h-1.5 bg-gray-500 rounded-full" /> Synchronization Succeeded
                  </div>
                  <p className="text-[11px] text-gray-300 font-semibold">Active tasks list compiled and downloaded safely into CSV/PDF ledger output blocks.</p>
                  <span className="text-[9px] text-gray-500 font-mono mt-2 block">2 hours ago</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {confirmation && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-[#131C1B] border border-gray-800 rounded-xl p-6 max-w-sm w-full shadow-2xl">
              <h2 className="text-white font-bold text-lg mb-2">{confirmation.title}</h2>
              <div className="text-gray-400 text-sm mb-6">{confirmation.message}</div>
              <div className="flex justify-end gap-3">
                <button onClick={() => setConfirmation(null)} className="px-4 py-2 text-gray-400 hover:text-white text-sm font-semibold">Cancel</button>
                <button onClick={confirmation.onConfirm} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700">{confirmation.confirmText}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ConfirmationContext.Provider>
  );
};

export default App;
