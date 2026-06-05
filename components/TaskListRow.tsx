import React from 'react';
import { AugmentedTask, Task, User, TaskPriority } from '../types';
import { UserAvatar } from './UserAvatar';

interface TaskListRowProps {
  task: AugmentedTask;
  onClick: (task: Task) => void;
  users: Record<string, User>;
  visibleColumns?: { id: boolean; title: boolean; project: boolean; priority: boolean; status: boolean; assignee: boolean };
  isSelected?: boolean;
  onToggleSelect?: (e: React.MouseEvent) => void;
}

const priorityStyles: Record<TaskPriority, string> = {
  [TaskPriority.URGENT]: 'bg-red-500/10 text-red-400 border-red-500/20 font-bold',
  [TaskPriority.HIGH]: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  [TaskPriority.MEDIUM]: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  [TaskPriority.LOW]: 'bg-white/5 text-gray-500 border-white/5',
};

export const TaskListRow: React.FC<TaskListRowProps> = ({ 
  task, 
  onClick, 
  users, 
  visibleColumns,
  isSelected = false,
  onToggleSelect
}) => {
  const { title, projectName, assignee, priority, columnName, ticketId } = task;

  const cols = visibleColumns || { id: true, title: true, project: true, priority: true, status: true, assignee: true };

  const getStatusStyle = (status: string): string => {
    const lowerCaseStatus = (status || '').toLowerCase();
    if (lowerCaseStatus.includes('done') || lowerCaseStatus.includes('resolved') || lowerCaseStatus.includes('closed') || lowerCaseStatus.includes('complete')) {
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    }
    if (lowerCaseStatus.includes('progress') || lowerCaseStatus.includes('review') || lowerCaseStatus.includes('testing')) {
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    }
    return 'bg-white/5 text-gray-400 border-white/5'; 
  };
  
  return (
    <div
      onClick={() => onClick(task)}
      className={`flex items-center gap-4 px-6 py-3 border-b border-white/5 cursor-pointer hover:bg-white/[0.03] transition-all duration-300 group ${
        isSelected ? 'bg-emerald-500/5 hover:bg-emerald-500/[0.07]' : ''
      }`}
    >
      {/* Checkbox column element */}
      <div className="w-10 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        <input 
          type="checkbox" 
          checked={isSelected}
          onChange={(e) => onToggleSelect?.(e as any)}
          className="w-4 h-4 rounded border-white/10 bg-black/40 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0 focus:outline-none cursor-pointer transition-all accent-emerald-500"
        />
      </div>

      {cols.id && (
        <div className="w-20 flex-shrink-0 font-mono text-emerald-500/60 font-bold text-[10px] uppercase truncate">
          {ticketId}
        </div>
      )}

      {cols.title && (
        <div className="flex-grow min-w-0 font-semibold text-white text-[11px] group-hover:text-emerald-400 group-hover:translate-x-1 transition-all truncate">
          {title}
        </div>
      )}

      {cols.project && (
        <div className="w-32 flex-shrink-0 text-[9px] text-gray-500 font-mono tracking-wider truncate uppercase">
          {projectName}
        </div>
      )}

      {cols.priority && (
        <div className="w-24 flex-shrink-0">
          <div className={`inline-flex items-center text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border ${priorityStyles[priority]}`}>
            {priority}
          </div>
        </div>
      )}

      {cols.status && (
        <div className="w-28 flex-shrink-0">
          <div className={`inline-flex items-center text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border ${getStatusStyle(columnName)}`}>
            {columnName}
          </div>
        </div>
      )}

      {cols.assignee && (
        <div className="w-36 flex-shrink-0 flex justify-end">
          <div className="flex items-center gap-2 bg-white/5 rounded-md p-0.5 pr-2 border border-white/5 group-hover:border-white/10 transition-colors">
            <UserAvatar
              user={assignee}
              className="w-5 h-5 ring-1 ring-white/10 group-hover:scale-110 transition-transform"
              title={assignee ? `Assigned to ${assignee.name}` : "Unassigned"}
            />
            <span className="text-[9px] text-gray-400 truncate max-w-[80px]">{assignee?.name || '---'}</span>
          </div>
        </div>
      )}
    </div>
  );
};