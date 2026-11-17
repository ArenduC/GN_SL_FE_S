import React, { useState, useEffect, useMemo } from 'react';
import { Project, User } from '../types';
import { XIcon, TrashIcon, LoaderCircleIcon, PlusIcon, SearchIcon, Share2Icon, UsersIcon } from './Icons';
import { UserAvatar } from './UserAvatar';
import { useConfirmation } from '../App';

interface ManageMembersModalProps {
  project: Project;
  projects?: Project[];
  onSelectProject?: (projectId: string) => void;
  onOpenInviteLinks?: (project: Project) => void;
  allUsers: User[];
  onlineUsers: Set<string>;
  onClose: () => void;
  onSave: (memberIds: string[]) => Promise<void>;
}

const normalizeMemberIds = (members: any[] | undefined, creatorId?: string): string[] => {
  const ids = (members || [])
    .map((m) => (typeof m === 'string' ? m : m?.user_id || m?.userId || m?.id))
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
  if (creatorId && !ids.includes(creatorId)) {
    ids.unshift(creatorId);
  }
  return Array.from(new Set(ids));
};

export const ManageMembersModal: React.FC<ManageMembersModalProps> = ({
  project,
  projects = [],
  onSelectProject,
  onOpenInviteLinks,
  allUsers,
  onlineUsers,
  onClose,
  onSave,
}) => {
  const [currentMemberIds, setCurrentMemberIds] = useState<string[]>(() =>
    normalizeMemberIds(project.members, project.creatorId)
  );
  const [userSearch, setUserSearch] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const requestConfirmation = useConfirmation();

  useEffect(() => {
    setCurrentMemberIds(normalizeMemberIds(project.members, project.creatorId));
    setError('');
  }, [project.id, project.members, project.creatorId]);

  const handleAddMember = (userIdToAdd: string) => {
    setCurrentMemberIds((current) =>
      current.includes(userIdToAdd) ? current : [...current, userIdToAdd]
    );
  };

  const handleRemoveMember = (userIdToRemove: string) => {
    if (userIdToRemove === project.creatorId) {
      console.warn('Attempted to remove the project creator.');
      return;
    }
    const userToRemove = allUsers.find((u) => u.id === userIdToRemove);
    requestConfirmation({
      title: 'Remove Member',
      message: (
        <>
          Are you sure you want to remove <strong>{userToRemove?.name || 'this member'}</strong> from the project?
        </>
      ),
      onConfirm: () => {
        setCurrentMemberIds((current) => current.filter((id) => id !== userIdToRemove));
      },
      confirmText: 'Remove',
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError('');
    try {
      const uniqueIds = Array.from(new Set(currentMemberIds.filter(Boolean)));
      await onSave(uniqueIds);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred while saving members.');
    } finally {
      setIsSaving(false);
    }
  };

  const memberDetails = useMemo(
    () =>
      currentMemberIds
        .map((id) => allUsers.find((u) => u.id === id))
        .filter((u): u is User => !!u),
    [currentMemberIds, allUsers]
  );

  const availableUsers = useMemo(() => {
    const query = userSearch.trim().toLowerCase();
    return allUsers
      .filter((u) => !currentMemberIds.includes(u.id))
      .filter((u) => !query || u.name.toLowerCase().includes(query) || (u.role || '').toLowerCase().includes(query));
  }, [allUsers, currentMemberIds, userSearch]);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#131C1B] rounded-xl border border-white/10 shadow-2xl w-full max-w-lg flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <header className="p-4 border-b border-white/10 flex justify-between items-center gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 flex-shrink-0">
              <UsersIcon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-white leading-tight">User Management</h2>
              <p className="text-xs text-gray-400 truncate">{project.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {onOpenInviteLinks && (
              <button
                type="button"
                onClick={() => onOpenInviteLinks(project)}
                className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-semibold text-emerald-400 flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Share Invite Links"
              >
                <Share2Icon className="w-3.5 h-3.5" />
                <span>Invite Links</span>
              </button>
            )}
            <button onClick={onClose} className="p-2 rounded-full text-gray-400 hover:bg-white/5 hover:text-white transition-colors cursor-pointer">
              <XIcon className="w-5 h-5" />
            </button>
          </div>
        </header>

        {projects.length > 1 && onSelectProject && (
          <div className="px-6 pt-4 pb-2 border-b border-white/5 bg-black/20">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
              Project Workspace
            </label>
            <select
              value={project.id}
              onChange={(e) => onSelectProject(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#1C2326] border border-white/10 text-xs font-semibold text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="p-6 overflow-y-auto max-h-[60vh] custom-scrollbar space-y-6">
          {/* Current Members */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                Current Members ({memberDetails.length})
              </h3>
            </div>
            <div className="space-y-1.5">
              {memberDetails.length === 0 ? (
                <p className="text-xs text-gray-500 py-3 text-center">No members assigned yet.</p>
              ) : (
                memberDetails.map((user) => (
                  <div key={user.id} className="flex items-center justify-between gap-3 p-2 rounded-lg bg-white/[0.02] hover:bg-white/5 border border-white/5 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <UserAvatar user={user} className="w-9 h-9 flex-shrink-0" isOnline={onlineUsers.has(user.id)} />
                      <div className="min-w-0">
                        <span className="font-medium text-sm text-white block truncate">{user.name}</span>
                        <span className="text-[11px] text-gray-400 block truncate">
                          {user.id === project.creatorId ? 'Creator • ' : ''}
                          {user.role || 'Member'}
                        </span>
                      </div>
                    </div>
                    {user.id !== project.creatorId && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(user.id)}
                        className="p-2 rounded-md text-gray-400 hover:bg-red-900/50 hover:text-red-400 transition-colors cursor-pointer"
                        aria-label={`Remove ${user.name}`}
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Add Existing Workspace Users */}
          <div className="pt-4 border-t border-white/5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white mb-2">
              Add Workspace Users
            </h3>
            <div className="relative mb-3">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search users by name..."
                className="w-full pl-9 pr-3 py-2 bg-[#1C2326] border border-white/10 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div className="space-y-1.5 max-h-44 overflow-y-auto custom-scrollbar">
              {availableUsers.length === 0 ? (
                <p className="text-xs text-gray-500 py-2 text-center">
                  {userSearch ? 'No matching users available to add.' : 'All workspace users are already members.'}
                </p>
              ) : (
                availableUsers.map((user) => (
                  <div key={user.id} className="flex items-center justify-between gap-3 p-2 rounded-lg bg-white/[0.01] hover:bg-white/5 border border-white/5 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <UserAvatar user={user} className="w-8 h-8 flex-shrink-0" isOnline={onlineUsers.has(user.id)} />
                      <div className="min-w-0">
                        <span className="font-medium text-xs text-white block truncate">{user.name}</span>
                        <span className="text-[10px] text-gray-400 block truncate">{user.role || 'Member'}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddMember(user.id)}
                      className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500 text-emerald-400 hover:text-black text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer flex-shrink-0"
                    >
                      <PlusIcon className="w-3.5 h-3.5" />
                      <span>Add</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <footer className="p-4 border-t border-white/10 flex justify-between items-center gap-3 bg-black/20">
          {error && <p className="text-xs text-red-400 flex-grow">{error}</p>}
          <div className="flex justify-end gap-3 ml-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 bg-[#1C2326] text-white font-semibold rounded-lg hover:bg-white/10 transition-all text-xs disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 bg-emerald-500 text-black font-bold rounded-lg shadow-md hover:bg-emerald-400 transition-all text-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
            >
              {isSaving && <LoaderCircleIcon className="w-4 h-4 animate-spin" />}
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};