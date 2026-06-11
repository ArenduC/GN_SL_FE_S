
import { supabase } from './supabase';
import { User, Project, NewTaskData, Task, AppState, ChatMessage, ProjectInviteLink, UserRole, Subtask, Sprint, FilterSegment, Column, TaskHistory } from '../types';
import { Session, RealtimeChannel, AuthChangeEvent, User as SupabaseUser } from '@supabase/supabase-js';
import { taskService } from './task.service';
import client from '../api/client';
import { ENDPOINTS } from '../api/endpoints';
import { sendSocketChatMessage } from './socketService';

/**
 * Helper to convert an array of objects with an 'id' property into a Record (dictionary).
 */
const arrayToRecord = <T extends { id: string }>(arr: T[]): Record<string, T> => {
    if (!arr || !Array.isArray(arr)) return {};
    return arr.reduce((acc, item) => {
        acc[item.id] = item;
        return acc;
    }, {} as Record<string, T>);
};

/**
 * Helper to generate a project code (prefix) from a project name.
 * e.g., "JavaScript Library" -> "JSL"
 */
export const generateProjectCode = (name: string): string => {
    if (!name) return 'TSK';
    const clean = name.replace(/[^a-zA-Z0-9\s]/g, '').trim();
    const words = clean.split(/\s+/);
    if (words.length >= 2) {
        return words.map(w => w[0]).join('').toUpperCase().slice(0, 4);
    }
    return clean.substring(0, 3).toUpperCase();
};

export const getTicketId = (id: string, prefix: string = 'TSK') => {
    // Stable ticket ID from UUID
    const shortId = id.split('-')[0].toUpperCase();
    return `${prefix}-${shortId}`;
};

// --- AUTH FUNCTIONS ---

type AuthListener = (event: AuthChangeEvent, session: Session | null) => void;
let authListeners: AuthListener[] = [];

const onAuthStateChange = (callback: AuthListener) => {
    authListeners.push(callback);
    return {
        data: {
            subscription: {
                unsubscribe: () => {
                    authListeners = authListeners.filter(l => l !== callback);
                }
            }
        }
    };
};

const triggerAuthChange = (event: AuthChangeEvent, session: Session | null) => {
    authListeners.forEach(listener => {
        try {
            listener(event, session);
        } catch (e) {
            console.error("Error in auth listener:", e);
        }
    });
};

const getSession = async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
        return { data: { session: null }, error: null };
    }
    try {
        const response = await client.get(ENDPOINTS.AUTH.me);
        const userData = response.data.user || response.data;
        const session: Session = {
            access_token: token,
            refresh_token: '',
            expires_in: 3600,
            token_type: 'bearer',
            user: {
                id: userData.id,
                email: userData.email,
                user_metadata: { name: userData.name || '' },
                app_metadata: { recovery: !!userData.is_recovering }
            } as any
        };
        return { data: { session }, error: null };
    } catch (err: any) {
        console.error("getSession failed:", err.message || err);
        if (err.response?.status === 401) {
            localStorage.removeItem('auth_token');
            triggerAuthChange('SIGNED_OUT', null);
        }
        return { data: { session: null }, error: err };
    }
};

const getUserProfile = async (userId: string): Promise<User | null> => {
    try {
        const response = await client.get(ENDPOINTS.USER.profile(userId), { silent: true } as any);
        return response.data as User;
    } catch (err: any) {
        if (err.response?.status !== 404) {
            console.error(`[API Error] getUserProfile(${userId}):`, err.message || err);
        } else {
            console.log(`[API Info] getUserProfile(${userId}) returned 404 (expected on first login).`);
        }
        return null; // Return null to allow fallback guest logic in App.tsx
    }
};

const createUserProfile = async (supabaseUser: SupabaseUser): Promise<User> => {
    const name = supabaseUser.user_metadata?.name || supabaseUser.email?.split('@')[0] || 'New User';
    try {
        const response = await client.post(`/users/${supabaseUser.id}/profile`, {
            name,
            role: UserRole.MEMBER
        });
        return response.data as User;
    } catch (err: any) {
        console.warn("Failed to create profile via explicit API path, using fallback", err.message);
        return {
            id: supabaseUser.id,
            name,
            role: UserRole.MEMBER,
            avatarUrl: ''
        };
    }
};

const updateUserProfile = async (userId: string, updates: { name: string }): Promise<User> => {
    try {
        const response = await client.put(ENDPOINTS.USER.profile(userId), updates);
        return response.data as User;
    } catch (err: any) {
        console.error("updateUserProfile failed via API:", err.message || err);
        throw err;
    }
};

const signOut = async () => {
    try {
        await client.post(ENDPOINTS.AUTH.logout);
    } catch (err: any) {
        console.warn("API logout call failed, cleaning up local state", err.message || err);
    } finally {
        localStorage.removeItem('auth_token');
        delete client.defaults.headers.common['Authorization'];
        triggerAuthChange('SIGNED_OUT', null);
    }
    return { error: null };
};

const isValidToken = (value: any): boolean => {
    if (typeof value !== 'string') return false;
    const clean = value.trim().toLowerCase();
    if (!clean || clean === 'undefined' || clean === 'null') return false;
    return value.trim().length > 15;
};

const decodeGoogleCredential = (jwt: string) => {
    try {
        const base64Url = jwt.split('.')[1];
        if (!base64Url) return null;
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent((window.atob || atob)(base64).split('').map((c) => {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        console.error("Failed to decode google credential:", e);
        return null;
    }
};

const extractTokenAndUser = (resData: any) => {
    let token: string | null = null;
    let userRaw: any = null;

    const search = (obj: any) => {
        if (!obj || typeof obj !== 'object') return;

        // Common token key mappings
        const tokenKeys = ['token', 'access_token', 'accessToken', 'jwt', 'id_token', 'idToken', 'credential'];
        for (const key of tokenKeys) {
            if (isValidToken(obj[key])) {
                token = obj[key];
                break;
            }
        }

        // Common user mappings
        if (obj.user && typeof obj.user === 'object') {
            userRaw = obj.user;
        }

        // If we didn't find token/user here, recurse in nested objects
        for (const key in obj) {
            if (obj[key] && typeof obj[key] === 'object' && key !== 'user') {
                if (!token || !userRaw) {
                    search(obj[key]);
                }
            }
        }
    };

    search(resData);

    // If still no token found, look for any valid token string of the object keys
    if (!token) {
        const findAnyToken = (obj: any) => {
            if (!obj || typeof obj !== 'object') return;
            for (const key in obj) {
                if (isValidToken(obj[key])) {
                    token = obj[key];
                    return;
                }
                if (obj[key] && typeof obj[key] === 'object') {
                    findAnyToken(obj[key]);
                }
            }
        };
        findAnyToken(resData);
    }

    if (!userRaw) {
        userRaw = resData.data?.user || resData.session?.user || resData.data || resData;
    }

    return { token, userRaw };
};

const signInWithPassword = async ({ email, password }: { email: string, password: string }) => {
    try {
        const response = await client.post(ENDPOINTS.AUTH.login, { email, password });
        const resData = response.data || {};
        const { token, userRaw } = extractTokenAndUser(resData);
        
        if (!token) {
            throw new Error("No authentication token was returned from the server response.");
        }
        
        localStorage.setItem('auth_token', token);
        client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        
        const mappedUser = {
            id: userRaw?.id || userRaw?.userId || userRaw?.user_id || '',
            email: userRaw?.email || email,
            user_metadata: { name: userRaw?.name || userRaw?.user_metadata?.name || '' },
            app_metadata: { recovery: !!(userRaw?.is_recovering || userRaw?.app_metadata?.recovery) }
        };
        
        const session: Session = {
            access_token: token,
            refresh_token: '',
            expires_in: 3600,
            token_type: 'bearer',
            user: mappedUser as any
        };
        
        triggerAuthChange('SIGNED_IN', session);
        return { data: { session }, error: null };
    } catch (err: any) {
        console.error("signInWithPassword failed:", err.response?.data || err.message);
        const errorMessage = err.response?.data?.message || err.response?.data?.error || err.message || "Failed to sign in";
        return { data: { session: null }, error: { message: errorMessage } };
    }
};

const signInWithGoogle = async ({ credential }: { credential: string }) => {
    try {
        const response = await client.post(ENDPOINTS.AUTH.google, { credential });
        const resData = response.data || {};
        const { token, userRaw } = extractTokenAndUser(resData);
        
        if (!token) {
            throw new Error("Authentication token missing from Google login response.");
        }
        
        localStorage.setItem('auth_token', token);
        client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        
        const decoded = decodeGoogleCredential(credential);
        const fallbackEmail = decoded?.email || '';
        const fallbackName = decoded?.name || decoded?.given_name || '';
        const fallbackId = decoded?.sub || '';

        const mappedUser = {
            id: userRaw?.id || userRaw?.userId || userRaw?.user_id || fallbackId,
            email: userRaw?.email || fallbackEmail,
            user_metadata: { name: userRaw?.name || userRaw?.user_metadata?.name || fallbackName },
            app_metadata: { recovery: !!(userRaw?.is_recovering || userRaw?.app_metadata?.recovery || decoded?.is_recovering) }
        };
        
        const session: Session = {
            access_token: token,
            refresh_token: '',
            expires_in: 3600,
            token_type: 'bearer',
            user: mappedUser as any
        };
        
        triggerAuthChange('SIGNED_IN', session);
        return { data: { session }, error: null };
    } catch (err: any) {
        console.error("signInWithGoogle failed:", err.response?.data || err.message);
        const errorMessage = err.response?.data?.message || err.response?.data?.error || err.message || "Failed to sign in with Google";
        return { data: { session: null }, error: { message: errorMessage } };
    }
};

const signUp = async ({ email, password, name }: { email: string, password: string, name: string }) => {
    try {
        const response = await client.post(ENDPOINTS.AUTH.signUp, { email, password, name });
        const { user } = response.data;
        
        const mappedUser = user ? {
            id: user.id,
            email: user.email,
            user_metadata: { name: user.name || name },
            app_metadata: {}
        } : null;
        
        triggerAuthChange('INITIAL_SESSION', null);
        return { data: { user: mappedUser }, error: null };
    } catch (err: any) {
        console.error("signUp failed:", err.response?.data || err.message);
        const errorMessage = err.response?.data?.message || err.response?.data?.error || err.message || "Failed to sign up";
        return { data: null, error: { message: errorMessage } };
    }
};

const sendPasswordResetEmail = async (email: string) => {
    try {
        await client.post(ENDPOINTS.AUTH.forgotPassword, { email });
        return { data: {}, error: null };
    } catch (err: any) {
        console.error("sendPasswordResetEmail failed:", err.response?.data || err.message);
        const errorMessage = err.response?.data?.message || err.response?.data?.error || err.message || "Failed to send reset email";
        return { data: null, error: { message: errorMessage } };
    }
};

const resendConfirmationEmail = async (email: string) => {
    try {
        await client.post(ENDPOINTS.AUTH.resendConfirmation, { email });
        return { data: {}, error: null };
    } catch (err: any) {
        console.error("resendConfirmationEmail failed:", err.response?.data || err.message);
        const errorMessage = err.response?.data?.message || err.response?.data?.error || err.message || "Failed to resend confirmation email";
        return { data: null, error: { message: errorMessage } };
    }
};

const updateUserPassword = async (password: string) => {
    try {
        const response = await client.post(ENDPOINTS.AUTH.updatePassword, { password });
        return response.data;
    } catch (err: any) {
        console.error("updateUserPassword failed:", err.response?.data || err.message);
        throw new Error(err.response?.data?.message || err.response?.data?.error || err.message || "Failed to update password");
    }
};

// --- REALTIME FUNCTIONS ---

const isConfigured = () => !!supabase.realtime;

const getPresenceChannel = () => {
    return supabase.channel('online-users', {
      config: {
        presence: {
          key: '', 
        },
      },
    });
};

const removeChannel = (channel: RealtimeChannel) => {
    supabase.removeChannel(channel);
};

// --- DATA FUNCTIONS ---

const logTaskHistory = async (taskId: string, userId: string, description: string) => {
    try {
        await client.post(ENDPOINTS.TASKS.createHistory, {
            taskId,
            description
        });
    } catch (e) {
        console.warn("Failed to log history:", e);
    }
};

const fetchTaskHistory = async (taskId: string): Promise<TaskHistory[]> => {
    return await taskService.getTaskHistory(taskId);
};

const fetchChatMessages = async (projectId: string): Promise<ChatMessage[]> => {
    try {
        const response = await client.post(ENDPOINTS.CHAT.getMessages, {
            projectId
        });
        const payload = response.data;
        if (payload && payload.success && Array.isArray(payload.data)) {
            return payload.data.map((msg: any) => ({
                id: msg.id,
                text: msg.text || msg.message || '',
                createdAt: msg.createdAt || msg.created_at || new Date().toISOString(),
                author: {
                    id: msg.author?.id || msg.author_id || 'unknown-author',
                    name: msg.author?.name || 'Collaborator',
                    avatarUrl: msg.author?.avatarUrl || msg.author?.avatar_url || '',
                    role: msg.author?.role || 'Member'
                }
            }));
        }
        return [];
    } catch (error) {
        console.error("Failed to fetch chat messages:", error);
        return [];
    }
};

const fetchInitialData = async (userId: string): Promise<AppState> => {
    let rpcData: any = null;
    try {
        const response = await client.get(ENDPOINTS.DASHBOARD.initialData(userId));
        // Safely extract the inner data object if nested
        const payload = response.data;
        if (payload && typeof payload === 'object') {
            if ('data' in payload && payload.data && typeof payload.data === 'object') {
                rpcData = payload.data;
            } else {
                rpcData = payload;
            }
        } else {
            rpcData = payload;
        }
    } catch (error: any) {
        console.error("API direct call failed to fetch initial data:", error?.message || error);
        throw error;
    }

    if (!rpcData || typeof rpcData !== 'object') {
        return { projects: {}, users: {}, projectOrder: [] };
    }

    const rawProjects = Array.isArray(rpcData.projects)
        ? rpcData.projects
        : (rpcData.projects && typeof rpcData.projects === 'object' ? Object.values(rpcData.projects) : []);
    const usersData = Array.isArray(rpcData.users)
        ? rpcData.users
        : (rpcData.users && typeof rpcData.users === 'object' ? Object.values(rpcData.users) : []);
    
    const processedProjects = rawProjects.map((p: any) => {
        if (!p || typeof p !== 'object') return null;

        const id = p.id;
        const name = p.name || 'Unnamed Project';
        const description = p.description || '';
        const creatorId = p.creatorId || p.creator_id || '';
        const createdAt = p.createdAt || p.created_at || new Date().toISOString();
        const updatedAt = p.updatedAt || p.updated_at || createdAt;

        let board = p.board || { columns: {}, columnOrder: [], tasks: {} };
        if (typeof board === 'string') {
            try {
                board = JSON.parse(board);
            } catch (e) {
                console.error("Failed to parse board string:", e);
                board = { columns: {}, columnOrder: [], tasks: {} };
            }
        }

        // Ensure board basics
        const columnsRaw = board.columns || {};
        const tasksRaw = board.tasks || {};
        let columnOrder = Array.isArray(board.columnOrder) ? board.columnOrder : [];

        // Standardize columns structure to Record<string, Column>
        let columnsRecord: Record<string, Column> = {};
        if (Array.isArray(columnsRaw)) {
            columnsRaw.forEach((col: any) => {
                if (col && col.id) {
                    columnsRecord[col.id] = {
                        id: col.id,
                        title: col.title || '',
                        taskIds: Array.isArray(col.taskIds) ? col.taskIds : (Array.isArray(col.task_ids) ? col.task_ids : []),
                    };
                }
            });
            if (columnOrder.length === 0) {
                columnOrder = columnsRaw.map((c: any) => c.id).filter(Boolean);
            }
        } else if (columnsRaw && typeof columnsRaw === 'object') {
            Object.entries(columnsRaw).forEach(([colId, rawCol]) => {
                const col = rawCol as any;
                if (col) {
                    columnsRecord[colId] = {
                        id: col.id || colId,
                        title: col.title || '',
                        taskIds: Array.isArray(col.taskIds) ? col.taskIds : (Array.isArray(col.task_ids) ? col.task_ids : []),
                    };
                }
            });
            if (columnOrder.length === 0) {
                const colsArray = Object.values(columnsRecord);
                // Sort by position helper if it exists
                colsArray.sort((a: any, b: any) => (a.position || 0) - (b.position || 0));
                columnOrder = colsArray.map(c => c.id);
            }
        }

        // Standardize tasks structure to Record<string, Task>
        let tasksRecord: Record<string, Task> = {};
        if (Array.isArray(tasksRaw)) {
            tasksRaw.forEach((task: any) => {
                if (task && task.id) {
                    tasksRecord[task.id] = task;
                }
            });
        } else if (tasksRaw && typeof tasksRaw === 'object') {
            Object.entries(tasksRaw).forEach(([taskId, rawTask]) => {
                const task = rawTask as any;
                if (task) {
                    tasksRecord[task.id || taskId] = task;
                }
            });
        }

        // Project identification Prefix/Code
        const projectCode = generateProjectCode(name);

        // Normalize lists, dates, and nested models for each task
        const sortedTasks = Object.values(tasksRecord).sort((a: any, b: any) => 
            new Date(a.createdAt || a.created_at || 0).getTime() - new Date(b.createdAt || b.created_at || 0).getTime()
        );
        
        let maxTicketNum = 0;
        sortedTasks.forEach((task: any) => {
            if (task.tags && Array.isArray(task.tags)) {
                const ticketTag = task.tags.find((t: string) => t && t.startsWith('ticket:'));
                if (ticketTag) {
                    const num = parseInt(ticketTag.split(':')[1], 10);
                    if (!isNaN(num) && num > maxTicketNum) {
                        maxTicketNum = num;
                    }
                }
            }
        });

        sortedTasks.forEach((task: any, index: number) => {
            if (!task.tags || !Array.isArray(task.tags)) {
                task.tags = Array.isArray(task.tags_param) ? task.tags_param : [];
            }

            // Normalizing tags and taskType
            const tagTypeItem = task.tags.find((t: string) => t && t.startsWith('type:'));
            if (tagTypeItem) {
                task.taskType = tagTypeItem.split(':')[1] as 'task' | 'bug';
            } else {
                task.taskType = task.taskType || 'task';
            }

            // Normalizing other camelCase properties
            task.creatorId = task.creatorId || task.creator_id || creatorId;
            task.createdAt = task.createdAt || task.created_at || new Date().toISOString();
            task.updatedAt = task.updatedAt || task.updated_at || task.createdAt;
            task.sprintId = task.sprintId !== undefined ? task.sprintId : (task.sprint_id || null);
            task.dueDate = task.dueDate || task.due_date;

            let ticketTag = task.tags.find((t: string) => t && t.startsWith('ticket:'));
            let ticketNum = 0;
            let needsPersist = false;

            if (ticketTag) {
                ticketNum = parseInt(ticketTag.split(':')[1], 10);
            } else {
                if (maxTicketNum === 0) {
                    ticketNum = index + 1;
                } else {
                    maxTicketNum += 1;
                    ticketNum = maxTicketNum;
                }
                task.tags.push(`ticket:${ticketNum}`);
                needsPersist = true;
            }

            if (task.taskType === 'bug') {
                task.ticketId = `BUG-${projectCode}-${ticketNum}`;
            } else {
                task.ticketId = `${projectCode}-${ticketNum}`;
            }

            // Attempt to assign ticket number asynchronously to database if generated on fly
            if (needsPersist && task.id) {
                supabase
                    .from('tasks')
                    .update({ tags: task.tags })
                    .eq('id', task.id)
                    .then(({ error }) => {
                        if (error) {
                            console.error(`Failed to assign permanent ticket:${ticketNum} to task ${task.id}`, error);
                        }
                    });
            }

            const tagRefItem = task.tags.find((t: string) => t && t.startsWith('ref:'));
            if (tagRefItem) {
                task.referenceNo = tagRefItem.substring(4);
            }

            if (!task.history) task.history = [];
            if (!task.comments) task.comments = [];
            if (task.subtasks) {
                const sortedSubtasks = [...task.subtasks].sort((a: any, b: any) => 
                    new Date(a.createdAt || a.created_at || 0).getTime() - new Date(b.createdAt || b.created_at || 0).getTime()
                );
                sortedSubtasks.forEach((st: any, sIdx: number) => {
                    st.id = st.id || `subtask-${Date.now()}-${sIdx}`;
                    st.ticketId = st.ticketId || st.ticket_id || `${task.ticketId}-SUB-${sIdx + 1}`;
                    st.title = st.title || '';
                    st.completed = !!(st.completed !== undefined ? st.completed : st.completed);
                    st.creatorId = st.creatorId || st.creator_id || '';
                    st.createdAt = st.createdAt || st.created_at || new Date().toISOString();
                    st.assigneeId = st.assigneeId || st.assignee_id;
                });
                task.subtasks = sortedSubtasks;
            } else {
                task.subtasks = [];
            }
        });

        const finalBoard: BoardData = {
            columns: columnsRecord,
            columnOrder: columnOrder,
            tasks: tasksRecord,
        };

        // Standardize top-level relationships
        let chatMessages = p.chatMessages || p.chat_messages || p.project_chats || [];
        if (!Array.isArray(chatMessages)) chatMessages = [];

        let links = p.links || p.project_links || [];
        if (!Array.isArray(links)) links = [];
        const processedLinks = links.map((lnk: any) => ({
            id: lnk.id,
            title: lnk.title || '',
            url: lnk.url || '',
            projectId: lnk.projectId || lnk.project_id || id,
            creatorId: lnk.creatorId || lnk.creator_id || '',
            createdAt: lnk.createdAt || lnk.created_at || new Date().toISOString()
        }));

        let sprints = p.sprints || [];
        if (!Array.isArray(sprints)) sprints = [];
        const processedSprints = sprints.map((s: any) => ({
            id: s.id,
            projectId: s.projectId || s.project_id || id,
            name: s.name || '',
            startDate: s.startDate || s.start_date || null,
            endDate: s.endDate || s.end_date || null,
            goal: s.goal || null,
            isDefault: !!(s.isDefault !== undefined ? s.isDefault : s.is_default),
            createdAt: s.createdAt || s.created_at || new Date().toISOString(),
            status: s.status || 'active'
        }));

        let filterSegments = p.filterSegments || p.filter_segments || [];
        if (!Array.isArray(filterSegments)) filterSegments = [];
        const processedFilterSegments = filterSegments
            .filter((s: any) => s && s.name && s.name.toUpperCase() !== 'BLUEPRINT')
            .map((s: any) => ({
                id: s.id,
                name: s.name || '',
                projectId: s.projectId || s.project_id || id,
                creatorId: s.creatorId || s.creator_id || '',
                filters: s.filters || {}
            }));

        const rawMembers = p.members || p.project_members || [];
        const membersList = Array.isArray(rawMembers)
            ? rawMembers.map((m: any) => typeof m === 'object' ? (m.user_id || m.userId || m.id) : m).filter(Boolean)
            : [];

        return {
            id,
            name,
            description,
            board: finalBoard,
            creatorId,
            createdAt,
            updatedAt,
            members: membersList,
            chatMessages,
            links: processedLinks,
            sprints: processedSprints,
            filterSegments: processedFilterSegments
        };
    }).filter(Boolean) as Project[];

    const usersRecord = arrayToRecord(usersData as User[]);
    const projectsRecord = arrayToRecord(processedProjects);
    const projectOrder = Array.isArray(rpcData.projectOrder)
        ? rpcData.projectOrder
        : (Array.isArray(rpcData.project_order)
            ? rpcData.project_order
            : processedProjects.map((p: Project) => p.id));

    return {
        projects: projectsRecord,
        users: usersRecord,
        projectOrder,
    };
};

const subscribeToProjectChat = (projectId: string, callback: (payload: any) => void) => {
    const channel = supabase.channel(`project-chat-${projectId}`)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'project_chats',
            filter: `project_id=eq.${projectId}`
        }, callback)
        .subscribe();
    return channel;
};

const moveTask = async (taskId: string, newColumnId: string, newPosition: number, actorId: string) => {
    try {
        await client.patch(ENDPOINTS.TASKS.moveTask, {
            taskId,
            newColumnId,
            newPosition
        });
    } catch (e: any) {
        console.error("Error moving task:", e);
        throw e;
    }
};

const updateColumnOrder = async (projectId: string, newOrder: string[]) => {
    try {
        await client.patch(ENDPOINTS.PROJECTS.updateColumnOrder, {
            projectId,
            newOrder
        });
    } catch (e: any) {
        console.error("Error updating column order:", e);
        throw e;
    }
};

const updateTask = async (updatedTask: Task, actorId: string, allUsers: User[]) => {
    try {
        await client.patch(ENDPOINTS.TASKS.updateTask, {
            taskId: updatedTask.id,
            title: updatedTask.title,
            description: updatedTask.description,
            priority: updatedTask.priority,
            assigneeId: updatedTask.assignee?.id || null,
            dueDate: updatedTask.dueDate || null,
            sprintId: updatedTask.sprintId || null,
            tags: updatedTask.tags || [],
            actorId: actorId
        });
    } catch (e: any) {
        console.error("Error updating task:", e);
        throw e;
    }
};

const addSubtasks = async (taskId: string, subtasks: Partial<Subtask>[], creatorId: string) => {
    try {
        const response = await client.post(ENDPOINTS.TASKS.addSubtasks, {
            taskId,
            subtasks: subtasks.map(s => ({
                title: s.title,
                assigneeId: s.assigneeId || null,
                completed: !!s.completed
            })),
            creatorId
        });
        return response.data?.data;
    } catch (e: any) {
        console.error("Error adding subtasks:", e);
        throw e;
    }
};

const updateSubtask = async (subtaskId: string, updates: Partial<Subtask>) => {
    try {
        await client.patch(ENDPOINTS.TASKS.updateSubtask, {
            subtaskId,
            updates: {
                title: updates.title,
                completed: updates.completed,
                assigneeId: updates.assigneeId === undefined ? undefined : (updates.assigneeId || null)
            }
        });
    } catch (e: any) {
        console.error("Error updating subtask:", e);
        throw e;
    }
};

const deleteSubtask = async (subtaskId: string) => {
    try {
        await client.delete(ENDPOINTS.TASKS.deleteSubtask, {
            data: { subtaskId }
        });
    } catch (e: any) {
        console.error("Error deleting subtask:", e);
        throw e;
    }
};

const addComment = async (taskId: string, text: string, authorId: string) => {
    try {
        await client.post(ENDPOINTS.TASKS.addComment, {
            taskId,
            text,
            authorId
        });
    } catch (e: any) {
        console.error("Error adding comment:", e);
        throw e;
    }
};

const addTask = async (taskData: NewTaskData, creatorId: string) => {
    try {
        const response = await client.post(ENDPOINTS.TASKS.addTask, {
            taskData: {
                title: taskData.title,
                description: taskData.description,
                priority: taskData.priority,
                columnId: taskData.columnId,
                assigneeId: taskData.assigneeId || null,
                dueDate: taskData.dueDate || null,
                sprintId: taskData.sprintId || null,
                taskType: taskData.taskType || 'task',
                referenceNo: taskData.referenceNo || null,
                tags: taskData.tags || []
            },
            creatorId
        });
        return response.data?.data;
    } catch (e: any) {
        console.error("Error adding task:", e);
        throw e;
    }
};

const addTasksBatch = async (tasks: any[]) => {
    try {
        const response = await client.post(ENDPOINTS.TASKS.addTasksBatch, {
            tasks
        });
        return response.data?.data;
    } catch (e: any) {
        console.error("Error adding tasks batch:", e);
        throw e;
    }
};

const deleteTask = async (taskId: string) => {
    await supabase.from('tasks').delete().eq('id', taskId);
};

const addColumn = async (projectId: string, title: string) => {
    try {
        const response = await client.post(ENDPOINTS.TASKS.addColumn, {
            projectId,
            title
        });
        return response.data?.data;
    } catch (e: any) {
        console.error("Error adding column:", e);
        throw e;
    }
};

const deleteColumn = async (columnId: string) => {
    try {
        await client.delete(ENDPOINTS.TASKS.deleteColumn, {
            data: { columnId }
        });
    } catch (e: any) {
        console.error("Error deleting column:", e);
        throw e;
    }
};

const addProject = async (name: string, description: string, creatorId: string) => {
    try {
        const response = await client.post(ENDPOINTS.PROJECTS.addProject, {
            name,
            description
        });
        return response.data?.data;
    } catch (e: any) {
        console.error("Error adding project:", e);
        throw e;
    }
};

const createProjectShell = async (name: string, description: string, creatorId: string) => {
    try {
        const response = await client.post(ENDPOINTS.PROJECTS.createProjectShell, {
            name,
            description,
            creatorId
        });
        return response.data?.data;
    } catch (e: any) {
        console.error("Error creating project shell:", e);
        throw e;
    }
};

const deleteProject = async (projectId: string) => {
    try {
        await client.delete(ENDPOINTS.PROJECTS.deleteProject, {
            data: { projectId }
        });
    } catch (e: any) {
        console.error("Error deleting project:", e);
        throw e;
    }
};

const updateProjectMembers = async (projectId: string, memberIds: string[]) => {
    try {
        await client.post(ENDPOINTS.PROJECTS.updateProjectMembers, {
            projectId,
            memberIds
        });
    } catch (e: any) {
        console.error("Error updating project members:", e);
        throw e;
    }
};

const addProjectLink = async (projectId: string, title: string, url: string, creatorId: string) => {
    try {
        const response = await client.post(ENDPOINTS.PROJECTS.addProjectLink, {
            projectId,
            title,
            url,
            creatorId
        });
        return response.data?.data;
    } catch (e: any) {
        console.error("Error adding project link:", e);
        throw e;
    }
};

const deleteProjectLink = async (linkId: string) => {
    try {
        await client.delete(ENDPOINTS.PROJECTS.deleteProjectLink, {
            data: { linkId }
        });
    } catch (e: any) {
        console.error("Error deleting project link:", e);
        throw e;
    }
};



const addSprint = async (sprintData: any) => {
    try {
        const response = await client.post(ENDPOINTS.SPRINTS.addSprint, sprintData);
        return response.data?.data;
    } catch (e: any) {
        console.error("Error adding sprint:", e);
        throw e;
    }
};

const updateSprint = async (sprintId: string, updates: any) => {
    try {
        const response = await client.post(ENDPOINTS.SPRINTS.updateSprint, {
            sprintId,
            updates
        });
        return response.data?.data;
    } catch (e: any) {
        console.error("Error updating sprint:", e);
        throw e;
    }
};

const deleteSprint = async (sprintId: string) => {
    try {
        const response = await client.delete(ENDPOINTS.SPRINTS.deleteSprint, {
            data: { sprintId }
        });
        return response.data?.data;
    } catch (e: any) {
        console.error("Error deleting sprint:", e);
        throw e;
    }
};

const bulkUpdateTaskSprint = async (taskIds: string[], sprintId: string | null) => {
    try {
        const response = await client.post(ENDPOINTS.SPRINTS.bulkUpdateTaskSprint, {
            taskIds,
            sprintId
        });
        return response.data?.data;
    } catch (e: any) {
        console.error("Error bulk updating task sprint:", e);
        throw e;
    }
};

const completeSprint = async (sprintId: string, moveToSprintId: string | null, incompleteTaskIds: string[]) => {
    try {
        await bulkUpdateTaskSprint(incompleteTaskIds, moveToSprintId);
    } catch (e: any) {
        console.error("Error completing sprint:", e);
        throw e;
    }
};

const addFilterSegment = async (projectId: string, name: string, filters: any, creatorId: string) => {
    try {
        const response = await client.post(ENDPOINTS.FILTERS.addFilterSegment, {
            projectId,
            name,
            filters,
            creatorId
        });
        return response.data?.data;
    } catch (e: any) {
        console.error("Error adding filter segment:", e);
        throw e;
    }
};

const updateFilterSegment = async (segmentId: string, updates: any) => {
    try {
        const response = await client.post(ENDPOINTS.FILTERS.updateFilterSegment, {
            segmentId,
            updates
        });
        return response.data?.data;
    } catch (e: any) {
        console.error("Error updating filter segment:", e);
        throw e;
    }
};

const deleteFilterSegment = async (segmentId: string) => {
    try {
        await client.delete(ENDPOINTS.FILTERS.deleteFilterSegment, {
            data: { segmentId }
        });
    } catch (e: any) {
        console.error("Error deleting filter segment:", e);
        throw e;
    }
};

const acceptInvite = async (token: string) => {
    try {
        const response = await client.post(ENDPOINTS.PROJECTS.acceptInvite, { token });
        return response.data?.data;
    } catch (e: any) {
        console.error("Error accepting project invite:", e);
        throw e;
    }
};

const submitFeedback = async (feedbackData: any) => {
    try {
        const response = await client.post(ENDPOINTS.PROJECTS.submitFeedback, feedbackData);
        return response.data?.data;
    } catch (e: any) {
        console.error("Error submitting feedback:", e);
        throw e;
    }
};

const getInviteLinksForProject = async (projectId: string) => {
    try {
        const response = await client.post(ENDPOINTS.PROJECTS.getInviteLinks, { projectId });
        return response.data?.data;
    } catch (e: any) {
        console.error("Error getting project invite links:", e);
        throw e;
    }
};

const createInviteLink = async (projectId: string, creatorId: string, role: UserRole, expiresDays: number | null) => {
    try {
        const response = await client.post(ENDPOINTS.PROJECTS.createInviteLink, {
            projectId,
            creatorId,
            role,
            expiresDays
        });
        return response.data?.data;
    } catch (e: any) {
        console.error("Error creating project invite link:", e);
        throw e;
    }
};

const updateInviteLink = async (linkId: string, updates: any) => {
    try {
        const response = await client.post(ENDPOINTS.PROJECTS.updateInviteLink, { linkId, updates });
        return response.data?.data;
    } catch (e: any) {
        console.error("Error updating project invite link:", e);
        throw e;
    }
};

const touchProject = async (projectId: string) => {
    await supabase
        .from('projects')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', projectId);
};

/**
 * The central API object exported to the application.
 */
export const api = {
    auth: {
        onAuthStateChange,
        getSession,
        getUserProfile,
        createUserProfile,
        updateUserProfile,
        signOut,
        signInWithPassword,
        signInWithGoogle,
        signUp,
        sendPasswordResetEmail,
        resendConfirmationEmail,
        updateUserPassword
    },
    realtime: {
        isConfigured,
        getPresenceChannel,
        removeChannel
    },
    data: {
        fetchInitialData,
        fetchChatMessages,
        subscribeToProjectChat,
        moveTask,
        updateColumnOrder,
        updateTask,
        addSubtasks,
        updateSubtask,
        deleteSubtask,
        addComment,
        addTask,
        addTasksBatch,
        deleteTask,
        addColumn,
        deleteColumn,
        addProject,
        createProjectShell,
        deleteProject,
        updateProjectMembers,
        addProjectLink,
        deleteProjectLink,
        addSprint,
        updateSprint,
        deleteSprint,
        bulkUpdateTaskSprint,
        completeSprint,
        addFilterSegment,
        updateFilterSegment,
        deleteFilterSegment,
        acceptInvite,
        submitFeedback,
        getInviteLinksForProject,
        createInviteLink,
        updateInviteLink,
        fetchTaskHistory,
        touchProject,
        logTaskHistory
    }
};
