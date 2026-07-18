import React from 'react';
import { Project, User, Column } from '../types';
import { UsersIcon, Share2Icon, ExternalLinkIcon } from './Icons';
import { UserAvatar } from './UserAvatar';

interface ProjectListRowProps {
  project: Project;
  users: Record<string, User>;
  onlineUsers: Set<string>;
  onSelect: (projectId: string) => void;
  onManageMembers: (projectId: string) => void;
  onShare: () => void;
  onOpenPopup?: (projectId: string) => void;
}

export const ProjectListRow: React.FC<ProjectListRowProps> = ({ project, users, onlineUsers, onSelect, onManageMembers, onShare, onOpenPopup }) => {
  // Defensive checks for nested board data
  const board = project.board;
  const tasks = board?.tasks || {};
  const columns = board?.columns || {};

  const totalTasks = Object.keys(tasks).length;
  const doneColumn = (Object.values(columns || {}) as Column[]).find(c => c.title.toLowerCase() === 'done');
  const completedTasks = doneColumn ? doneColumn.taskIds.length : 0;
  
  const progress = project.meshSyncProgress !== undefined 
    ? project.meshSyncProgress 
    : (totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0);

  const membersList = React.useMemo(() => {
    return (project.members || []).map(m => {
      if (typeof m === 'string') {
        return users[m];
      }
      return m; // m is a PaginatedProjectMember
    }).filter(Boolean) as User[];
  }, [project.members, users]);

  return (
    <div
      onClick={() => onSelect(project.id)}
      className="grid grid-cols-12 gap-4 items-center px-6 py-4 border-b border-white/5 hover:bg-white/[0.03] transition-all duration-300 group cursor-pointer"
    >
      <div className="col-span-4 min-w-0">
        <h3 className="font-bold text-white text-[11px] truncate group-hover:text-emerald-400 group-hover:translate-x-1 transition-all">
          {project.name}
        </h3>
        <p className="text-[9px] text-gray-500 truncate mt-0.5 opacity-50 group-hover:opacity-100 transition-opacity">
          {project.description || 'No description provided.'}
        </p>
      </div>

      <div className="col-span-2">
        <div className="flex items-center gap-3">
            <div className="flex-grow bg-white/5 rounded-full h-1 overflow-hidden">
                <div className="bg-emerald-500 h-full transition-all duration-1000" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-[9px] font-black font-mono text-white min-w-[2.5rem] text-right">{progress}%</span>
        </div>
      </div>

      <div className="col-span-2 text-center">
        <span className="text-[10px] font-black text-white">{completedTasks} <span className="text-gray-600">/ {totalTasks}</span></span>
        <span className="block text-[8px] uppercase tracking-[0.2em] text-gray-600 font-black mt-0.5">COMPLETED</span>
      </div>

      <div className="col-span-2 flex items-center justify-end -space-x-2">
        {membersList.slice(0, 4).map(u => (
          <UserAvatar
            key={u.id}
            user={u}
            isOnline={onlineUsers.has(u.id)}
            className="w-5 h-5 rounded-full ring-1 ring-[#131C1B]"
          />
        ))}
        {membersList.length > 4 && (
          <div className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center text-[7px] font-black ring-1 ring-[#131C1B] text-gray-500 uppercase">
            +{membersList.length - 4}
          </div>
        )}
      </div>

      <div className="col-span-2 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
        {onOpenPopup && (
          <button 
              onClick={(e) => { e.stopPropagation(); onOpenPopup(project.id); }}
              className="p-1.5 rounded-lg text-gray-500 hover:text-emerald-400 hover:bg-white/5 transition-colors"
              title="Open in Floating Window"
          >
            <ExternalLinkIcon className="w-3 h-3" />
          </button>
        )}
        <button 
            onClick={(e) => { e.stopPropagation(); onShare(); }}
            className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
        >
          <Share2Icon className="w-3 h-3" />
        </button>
        <button 
            onClick={(e) => { e.stopPropagation(); onManageMembers(project.id); }}
            className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
        >
          <UsersIcon className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};