
export enum UserRole {
  ADMIN = 'Admin',
  MANAGER = 'Manager',
  MEMBER = 'Member',
}

export interface Subtask {
  id: string;
  ticketId: string;
  title: string;
  completed: boolean;
  creatorId: string;
  createdAt: string;
  assigneeId?: string;
  assignee?: User;
}

export enum TaskPriority {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
  URGENT = 'Urgent'
}

export interface User {
  id: string;
  name: string;
  avatarUrl?: string;
  role: UserRole;
}

export interface Comment {
    id: string;
    author: User;
    text: string;
    createdAt: string;
}

export interface TaskHistory {
  id: string;
  user: User;
  changeDescription: string;
  createdAt: string;
}

export interface Sprint {
  id: string;
  projectId: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  goal: string | null;
  isDefault: boolean;
  createdAt: string;
  status: 'active' | 'completed';
}

export interface Task {
  id: string;
  ticketId: string;
  title: string;
  description: string;
  priority: TaskPriority;
  assignee?: User;
  subtasks: Subtask[];
  tags: string[];
  comments: Comment[];
  history: TaskHistory[];
  dueDate?: string;
  creatorId: string;
  createdAt: string;
  updatedAt: string;
  sprintId?: string | null;
  taskType?: 'task' | 'bug';
  parentId?: string | null;
  referenceNo?: string;
  columnId?: string;
  currentColumnId?: string;
}

export interface Column {
  id:string;
  title: string;
  taskIds: string[];
}

export interface BoardData {
  tasks: Record<string, Task>;
  columns: Record<string, Column>;
  columnOrder: string[];
}

export type NewTaskData = {
  title: string;
  description: string;
  priority: TaskPriority;
  columnId: string;
  assigneeId?: string;
  dueDate?: string;
  sprintId?: string | null;
  taskType?: 'task' | 'bug';
  parentId?: string | null;
  projectId?: string;
  referenceNo?: string;
  tags?: string[];
};

export interface ChatMessage {
  id: string;
  author: User;
  text: string;
  createdAt: string;
}

export interface ProjectLink {
  id: string;
  title: string;
  url: string;
  projectId: string;
  creatorId: string;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  board?: BoardData;
  members: (string | PaginatedProjectMember)[];
  creatorId: string;
  createdAt: string;
  updatedAt: string;
  chatMessages?: ChatMessage[];
  links?: ProjectLink[];
  sprints?: Sprint[];
  filterSegments?: FilterSegment[];
  meshSyncProgress?: number;
  videoMeetingActive?: boolean;
}

export interface AppState {
  projects: Record<string, Project>;
  users: Record<string, User>;
  projectOrder: string[];
}

export interface FilterSegment {
  id: string;
  name: string;
  projectId: string;
  creatorId: string;
  filters: {
    searchTerm: string;
    priorityFilter: string[];
    assigneeFilter: string[];
    statusFilter: string[];
    tagFilter: string[];
    startDate: string;
    endDate: string;
    sprintFilter: string[];
    relativeTimeValue?: string;
    relativeTimeUnit?: 'seconds' | 'minutes' | 'hours' | 'days' | 'months' | 'years';
    relativeTimeCondition?: 'within' | 'older_than';
    reporterFilter?: string[];
  };
}

export interface AugmentedTask extends Task {
  projectId: string;
  projectName: string;
  columnId: string;
  columnName: string;
}

// FIX: Add missing Notification type definition for NotificationToast component.
export interface Notification {
  id: string;
  project: {
    id: string;
    name: string;
  };
  author: User;
  message: string;
}

export enum InviteAccessType {
    OPEN = 'open',
}

export interface ProjectInviteLink {
  id: string;
  project_id: string;
  token: string;
  created_by: string;
  created_at: string;
  role: UserRole;
  access_type: InviteAccessType;
  expires_at: string | null;
  max_uses: number | null;
  current_uses: number;
  is_active: boolean;
}

// Types for AI-generated project from CSV
export interface AiGeneratedTask {
  title: string;
  description: string;
  priority: TaskPriority;
  subtasks: { title: string }[];
}

export interface AiGeneratedColumn {
  title: string;
  tasks: AiGeneratedTask[];
}

export interface AiGeneratedProjectPlan {
  name: string;
  description: string;
  columns: AiGeneratedColumn[];
}

// Type for AI-generated tasks from file
export interface AiGeneratedTaskFromFile {
  title: string;
  description: string;
  priority: TaskPriority;
  status: string; // The name of the column/status
}


export enum FeedbackType {
  BUG = 'Bug Report',
  FEATURE = 'Feature Request',
  GENERAL = 'General Feedback',
}

export interface UserSettings {
  defaultView: 'board' | 'table' | 'graph' | 'sprints';
  theme: string;
  timezone: string;
  aiMode: 'graphyAgent' | 'gemini' | 'noAgent';
  defaultProject: string;
  chat: {
    enabled: boolean;
    soundEnabled: boolean;
  };
  notifications: {
    subscribed: boolean;
    email: boolean;
    push: boolean;
  };
  sidebar: {
    visiblePanels: string[];
    isCollapsed: boolean;
  };
}

export interface Feedback {
  id: string;
  createdAt: string;
  userId: string;
  type: FeedbackType;
  title: string;
  description: string;
  contextData: {
    url: string;
    userAgent: string;
  };
  status: 'new' | 'seen' | 'in-progress' | 'done';
}

// ==========================================
// Paginated API Payload & Response Contracts
// ==========================================

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

// 1. Dashboard Project List Pagination
export interface ProjectPaginationMeta {
  currentPage: number;
  limit: number;
  totalPages: number;
  totalItems: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface GetProjectsPayload {
  page: number;
  limit: number;
  search?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'name' | 'meshSync';
  order?: 'asc' | 'desc';
}

export interface PaginatedProjectMember {
  id: string;
  name: string;
  avatarUrl: string | null;
  role: string;
}

export interface PaginatedProjectSummary {
  id: string;
  shortId?: string;
  name: string;
  description: string;
  creatorId: string;
  createdAt: string;
  updatedAt: string;
  meshSyncProgress: number;
  videoMeetingActive?: boolean;
  membersCount: number;
  members: PaginatedProjectMember[];
}

export interface PaginatedProjectsResponse {
  projects: PaginatedProjectSummary[];
  pagination: ProjectPaginationMeta;
}

// 2. Share / Active Invite Nodes Pagination
export interface GetInviteLinksPayload {
  projectId: string;
  page: number;
  limit: number;
}

export interface PaginatedInviteLink {
  id: string;
  projectId: string;
  creatorId: string;
  role: UserRole;
  code: string;
  inviteUrl: string;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedInviteLinksResponse {
  inviteLinks: PaginatedInviteLink[];
  pagination: PaginationMeta;
}

// 3. Project Columns Pagination
export interface GetColumnsPayload {
  projectId: string;
  page: number;
  limit: number; // default: 10
}

export interface PaginatedColumnSummary {
  id: string;
  title: string;
  position: number;
  totalTasksCount: number;
}

export interface PaginatedColumnsResponse {
  projectId: string;
  columns: PaginatedColumnSummary[];
  columnOrder: string[];
  pagination: PaginationMeta;
}

// 4. Column Tasks Pagination
export interface GetColumnTasksPayload {
  columnId: string;
  page: number;
  limit: number; // default: 20
  search?: string;
  priority?: TaskPriority;
}

export interface PaginatedColumnTasksResponse {
  columnId: string;
  tasks: Task[];
  pagination: PaginationMeta;
}

export interface BoardSort {
  field: string;
  order: 'asc' | 'desc';
}

export interface BoardFilters {
  search?: string;                      // Optional text search matching title, ticketId, tags, etc.
  priority?: TaskPriority;              // Optional single priority for backward compatibility/simplicity
  priorities?: string[];                // Optional: Array of multiple priorities selected
  taskType?: 'task' | 'bug';            // Optional single task type
  taskTypes?: ('task' | 'bug')[];       // Optional: Array of selected task types
  parentId?: string | null;             // Optional filter for child nodes of a given task
  savedFilterId?: string;               // Optional: Chosen filter segment ID
  assignees?: string[];                 // Optional: Array of selected assignee user IDs
  reporters?: string[];                 // Optional: Array of creator/reporter user IDs
  columns?: string[];                   // Optional: Array of selected column statuses
  tags?: string[];                      // Optional: Array of selected tags
  sprints?: string[];                   // Optional: Array of active sprint IDs
  dateRange?: {
    field: 'createdAt' | 'dueDate';
    start?: string;
    end?: string;
  };
  relativeDate?: {
    condition: 'within' | 'older_than';
    value: number;
    unit: 'seconds' | 'minutes' | 'hours' | 'days' | 'months' | 'years';
  };
}

export interface GetProjectBoardPaginatedPayload {
  projectId: string;
  page: number; // page index for tasks
  limit: number; // tasks limit, default: 20
  columnPage: number; // page index for columns, default: 1
  columnLimit: number; // columns limit, default: 10
  sort?: BoardSort; // Optional sort options
  filters?: BoardFilters; // Consolidated filter object
}

export interface PaginatedBoardResponse {
  projectId: string;
  columns: PaginatedColumnSummary[];
  columnOrder: string[];
  tasks: Task[];
  pagination: {
    tasks: PaginationMeta;
    columns: PaginationMeta;
  };
}


