// Projects feature module entry point
export { KanbanBoard } from '../../components/KanbanBoard';
export { TasksPage } from '../../pages/TasksPage';
export { ResourceManagementPage } from '../../pages/ResourceManagementPage';
export { CreateProjectModal } from '../../components/CreateProjectModal';
export { CreateTaskModal } from '../../components/CreateTaskModal';
export { CreateTaskPage } from '../../pages/CreateTaskPage';
export { TaskDetailsModal } from '../../components/TaskDetailsModal';

// Redux projects state re-exports
export {
  default as projectReducer,
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
} from '../../state/slices/projectSlice';
