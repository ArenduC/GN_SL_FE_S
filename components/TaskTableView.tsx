import React, { useState, useEffect } from 'react';
import { Project, Task, User, TaskPriority, Column } from '../types';
import { UserAvatar } from './UserAvatar';
import { DropResult } from 'react-beautiful-dnd';
import { Settings, ChevronDown } from 'lucide-react';

const ALL_COLUMNS = [
  { id: 'ticketId', label: 'ID' },
  { id: 'title', label: 'Task Title' },
  { id: 'status', label: 'Status' },
  { id: 'priority', label: 'Priority' },
  { id: 'assignee', label: 'Assignee' },
  { id: 'dueDate', label: 'Due Date' },
  { id: 'creator', label: 'Creator' },
  { id: 'created', label: 'Created' },
  { id: 'lastUpdate', label: 'Last Update' },
  { id: 'assigned', label: 'Assigned' },
  { id: 'assignedBy', label: 'Assigned By' },
];

interface TaskTableViewProps {
  project: Project;
  tasks: Task[];
  users: User[];
  onUpdateTask: (task: Task) => Promise<void>;
  onDragEnd: (result: DropResult) => Promise<void>;
  onTaskClick: (task: Task) => void;
}

export const TaskTableView: React.FC<TaskTableViewProps> = ({ project, tasks, users, onUpdateTask, onDragEnd, onTaskClick }) => {
  const projectMembers = project.members.map(id => users.find(u => u.id === id)).filter((u): u is User => !!u);
  const columns = Object.values(project?.board?.columns || {}) as Column[];

  const [showColPicker, setShowColPicker] = useState(false);
  const [visibleColumnIds, setVisibleColumnIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('table_visible_columns_v2');
      return saved ? JSON.parse(saved) : ALL_COLUMNS.map(c => c.id);
    } catch {
      return ALL_COLUMNS.map(c => c.id);
    }
  });

  useEffect(() => {
    localStorage.setItem('table_visible_columns_v2', JSON.stringify(visibleColumnIds));
  }, [visibleColumnIds]);

  const handleStatusChange = (task: Task, newColumnId: string) => {
    const sourceColumn = columns.find(c => c.taskIds.includes(task.id));
    if (!sourceColumn || sourceColumn.id === newColumnId) return;

    const sourceIndex = sourceColumn.taskIds.indexOf(task.id);
    const destinationColumn = columns.find(c => c.id === newColumnId);
    const destinationIndex = destinationColumn ? destinationColumn.taskIds.length : 0;

    const result: DropResult = {
      draggableId: task.id,
      source: { droppableId: sourceColumn.id, index: sourceIndex },
      destination: { droppableId: newColumnId, index: destinationIndex },
      reason: 'DROP',
      type: 'DEFAULT',
      mode: 'FLUID',
      combine: null,
    };
    onDragEnd(result);
  };

  const handleAssigneeChange = (task: Task, newAssigneeId: string) => {
    const newAssignee = newAssigneeId ? projectMembers.find(m => m.id === newAssigneeId) : undefined;
    onUpdateTask({ ...task, assignee: newAssignee });
  };

  const handlePriorityChange = (task: Task, newPriority: TaskPriority) => {
    onUpdateTask({ ...task, priority: newPriority });
  };

  const handleDueDateChange = (task: Task, newDueDate: string) => {
    onUpdateTask({ ...task, dueDate: newDueDate || undefined });
  };

  const getTaskColumnId = (taskId: string): string | undefined => {
    return columns.find(c => c.taskIds.includes(taskId))?.id;
  };

  const getStatusDotColor = (columnId: string | undefined): string => {
    const column = columns.find(c => c.id === columnId);
    const title = (column?.title || '').toLowerCase();
    if (title.includes('done') || title.includes('complete')) return 'bg-emerald-500';
    if (title.includes('progress') || title.includes('current')) return 'bg-blue-500';
    if (title.includes('review') || title.includes('verify')) return 'bg-purple-500';
    return 'bg-gray-500';
  };

  const getPriorityTextColor = (priority: TaskPriority): string => {
    if (priority === TaskPriority.URGENT) return 'text-red-400 font-semibold';
    if (priority === TaskPriority.HIGH) return 'text-orange-400';
    if (priority === TaskPriority.MEDIUM) return 'text-blue-400';
    return 'text-gray-400';
  };

  return (
    <div className="w-full bg-transparent overflow-hidden">
      {/* Table Preferences Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/5 mb-4 relative z-30">
        <div>
          <span className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-400">Project Workspace Grid</span>
          <p className="text-[11px] text-gray-500 mt-0.5">Customize your landscape layout. Double-click or click cards to edit details.</p>
        </div>

        {/* Dynamic Column Picker Widget */}
        <div className="relative">
          <button 
            type="button"
            onClick={() => setShowColPicker(!showColPicker)}
            className="p-2 px-3.5 bg-white/5 border border-white/10 hover:border-white/20 hover:bg-white/10 text-gray-300 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5 text-emerald-450 animate-pulse" />
            <span>Visible Columns</span>
            <ChevronDown className="w-3 h-3 text-gray-500 transition-transform duration-200" style={{ transform: showColPicker ? 'rotate(180deg)' : 'none' }} />
          </button>
          
          {showColPicker && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowColPicker(false)} />
              <div className="absolute right-0 mt-2 w-56 bg-[#0E1314]/98 backdrop-blur border border-white/10 rounded-2xl shadow-2xl p-4 z-50 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-white/5">
                  <span className="text-[9px] font-black uppercase tracking-widest text-[#5EEAD4]">Grid Columns</span>
                  <button 
                    type="button"
                    onClick={() => setVisibleColumnIds(ALL_COLUMNS.map(c => c.id))}
                    className="text-[8px] font-black text-gray-500 hover:text-white uppercase tracking-widest transition-colors cursor-pointer"
                  >
                    Select All
                  </button>
                </div>
                <div className="space-y-1.5 max-h-64 overflow-y-auto custom-scrollbar pr-1">
                  {ALL_COLUMNS.map(col => {
                    const isChecked = visibleColumnIds.includes(col.id);
                    return (
                      <label key={col.id} className="flex items-center justify-between p-2 rounded-xl hover:bg-white/5 cursor-pointer text-[10.5px] text-gray-400 hover:text-white group transition-colors">
                        <span className="font-bold flex items-center gap-2.5">
                          <input 
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              if (isChecked) {
                                if (visibleColumnIds.length > 2) { // keep at least 2 columns visible
                                  setVisibleColumnIds(visibleColumnIds.filter(id => id !== col.id));
                                }
                              } else {
                                setVisibleColumnIds([...visibleColumnIds, col.id]);
                              }
                            }}
                            className="w-3.5 h-3.5 rounded border-white/10 bg-black/40 text-emerald-500 focus:ring-emerald-500/20"
                          />
                          {col.label}
                        </span>
                        <span className="text-[7px] font-mono text-gray-600 group-hover:text-gray-450 font-bold uppercase tracking-wider">
                          {isChecked ? 'ON' : 'OFF'}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="overflow-x-auto custom-scrollbar w-full border border-white/5 rounded-2xl bg-[#090D0E]/40">
        <table className="w-full text-left border-collapse min-w-[1500px] table-fixed">
          <thead>
            <tr className="border-b border-white/5 text-gray-500 font-bold text-[10px] uppercase tracking-widest bg-white/[0.01]">
              {visibleColumnIds.includes('ticketId') && <th className="py-3.5 px-4 w-24 whitespace-nowrap">ID</th>}
              {visibleColumnIds.includes('title') && <th className="py-3.5 px-4 w-[420px] whitespace-nowrap">Task Title</th>}
              {visibleColumnIds.includes('status') && <th className="py-3.5 px-4 w-44 whitespace-nowrap">Status</th>}
              {visibleColumnIds.includes('priority') && <th className="py-3.5 px-4 w-36 whitespace-nowrap">Priority</th>}
              {visibleColumnIds.includes('assignee') && <th className="py-3.5 px-4 w-52 whitespace-nowrap">Assignee</th>}
              {visibleColumnIds.includes('dueDate') && <th className="py-3.5 px-4 w-44 whitespace-nowrap">Due Date</th>}
              {visibleColumnIds.includes('creator') && <th className="py-3.5 px-4 w-44 whitespace-nowrap">Creator</th>}
              {visibleColumnIds.includes('created') && <th className="py-3.5 px-4 w-36 whitespace-nowrap">Created</th>}
              {visibleColumnIds.includes('lastUpdate') && <th className="py-3.5 px-4 w-56 whitespace-nowrap">Last Update</th>}
              {visibleColumnIds.includes('assigned') && <th className="py-3.5 px-4 w-36 whitespace-nowrap">Assigned</th>}
              {visibleColumnIds.includes('assignedBy') && <th className="py-3.5 px-4 w-44 whitespace-nowrap">Assigned By</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {tasks.map(task => {
              const currentColumnId = getTaskColumnId(task.id);
              const creatorName = users.find(u => u.id === task.creatorId)?.name || 'System';
              const createdDate = new Date(task.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
              
              const lastHistory = task.history && task.history.length > 0 ? task.history[0] : null;
              const lastUpdateBy = lastHistory ? lastHistory.user.name : creatorName;
              const lastUpdateAt = lastHistory 
                ? new Date(lastHistory.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) 
                : new Date(task.updatedAt || task.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

              const assignHistory = task.history && task.history.length > 0 
                ? [...task.history].reverse().find(h => h.changeDescription.toLowerCase().includes('assignee')) 
                : null;
              const assignedBy = assignHistory ? assignHistory.user.name : (task.assignee ? creatorName : 'Unassigned');
              const assignedAt = assignHistory 
                ? new Date(assignHistory.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) 
                : (task.assignee ? createdDate : 'N/A');

              return (
                <tr key={task.id} className="text-xs text-gray-300 hover:bg-white/[0.025] transition-colors">
                  {visibleColumnIds.includes('ticketId') && (
                    <td className="py-3 px-4 font-mono text-emerald-500/80 font-semibold whitespace-nowrap truncate">
                      {task.ticketId}
                    </td>
                  )}
                  {visibleColumnIds.includes('title') && (
                    <td className="py-3 px-4 whitespace-nowrap truncate max-w-[420px]" title={task.title}>
                      <button 
                        onClick={() => onTaskClick(task)} 
                        className="font-semibold text-white hover:text-emerald-400 text-left truncate w-full block transition-colors outline-none focus:outline-none cursor-pointer"
                      >
                        {task.title}
                      </button>
                    </td>
                  )}
                  {visibleColumnIds.includes('status') && (
                    <td className="py-3 px-4 whitespace-nowrap truncate">
                      <div className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${getStatusDotColor(currentColumnId)}`} />
                        <select
                          value={currentColumnId || ''}
                          onChange={e => handleStatusChange(task, e.target.value)}
                          className="bg-transparent border-none text-xs text-gray-300 hover:text-white focus:ring-0 p-0 cursor-pointer appearance-none outline-none font-medium truncate max-w-[150px]"
                        >
                          {columns.map(col => (
                            <option key={col.id} value={col.id} className="bg-[#0B0E0F] text-gray-300">{col.title}</option>
                          ))}
                        </select>
                      </div>
                    </td>
                  )}
                  {visibleColumnIds.includes('priority') && (
                    <td className="py-3 px-4 whitespace-nowrap truncate">
                      <select
                        value={task.priority}
                        onChange={e => handlePriorityChange(task, e.target.value as TaskPriority)}
                        className={`bg-transparent border-none text-xs focus:ring-0 p-0 cursor-pointer appearance-none outline-none truncate max-w-[100px] ${getPriorityTextColor(task.priority)}`}
                      >
                        {Object.values(TaskPriority).map(p => (
                          <option key={p} value={p} className="bg-[#0B0E0F] text-gray-300 font-normal">{p}</option>
                        ))}
                      </select>
                    </td>
                  )}
                  {visibleColumnIds.includes('assignee') && (
                    <td className="py-3 px-4 whitespace-nowrap truncate">
                      <div className="flex items-center gap-2">
                        <UserAvatar user={task.assignee} className="w-5 h-5 flex-shrink-0" />
                        <select
                          value={task.assignee?.id || ''}
                          onChange={e => handleAssigneeChange(task, e.target.value)}
                          className="bg-transparent border-none text-xs text-gray-300 hover:text-white focus:ring-0 p-0 cursor-pointer appearance-none outline-none truncate max-w-[150px]"
                        >
                          <option value="" className="bg-[#0B0E0F] text-gray-500">Unassigned</option>
                          {projectMembers.map(m => (
                            <option key={m.id} value={m.id} className="bg-[#0B0E0F] text-gray-300">{m.name}</option>
                          ))}
                        </select>
                      </div>
                    </td>
                  )}
                  {visibleColumnIds.includes('dueDate') && (
                    <td className="py-3 px-4 whitespace-nowrap truncate">
                      <input
                        type="date"
                        value={task.dueDate || ''}
                        onChange={e => handleDueDateChange(task, e.target.value)}
                        className="bg-transparent text-gray-300 hover:text-white border-none p-0 text-xs focus:ring-0 focus:outline-none w-full cursor-pointer font-mono"
                      />
                    </td>
                  )}
                  {visibleColumnIds.includes('creator') && (
                    <td className="py-3 px-4 text-gray-400 whitespace-nowrap truncate max-w-[150px]" title={creatorName}>
                      {creatorName}
                    </td>
                  )}
                  {visibleColumnIds.includes('created') && (
                    <td className="py-3 px-4 text-gray-500 font-mono whitespace-nowrap truncate text-[11px]">
                      {createdDate}
                    </td>
                  )}
                  {visibleColumnIds.includes('lastUpdate') && (
                    <td className="py-3 px-4 text-gray-450 whitespace-nowrap truncate max-w-[200px]" title={`${lastUpdateBy} (${lastUpdateAt})`}>
                      <span className="font-semibold text-gray-300">{lastUpdateBy}</span>
                      <span className="text-gray-500 font-mono text-[10px] ml-1.5">{lastUpdateAt}</span>
                    </td>
                  )}
                  {visibleColumnIds.includes('assigned') && (
                    <td className="py-3 px-4 text-gray-500 font-mono whitespace-nowrap truncate text-[11px]">
                      {assignedAt}
                    </td>
                  )}
                  {visibleColumnIds.includes('assignedBy') && (
                    <td className="py-3 px-4 text-gray-400 whitespace-nowrap truncate max-w-[150px]" title={assignedBy}>
                      {assignedBy}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {tasks.length === 0 && (
        <div className="text-center py-12 text-gray-500 font-mono text-xs italic uppercase tracking-wider">
          No records in table
        </div>
      )}
    </div>
  );
};
