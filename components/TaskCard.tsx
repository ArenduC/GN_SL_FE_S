import React, { useState, useEffect } from 'react';
import { Draggable } from 'react-beautiful-dnd';
import { Task, TaskPriority } from '../types';
import { CheckSquareIcon, TrashIcon, RocketIcon } from './Icons';
import { UserAvatar } from './UserAvatar';
import { useConfirmation } from '../App';

interface TaskCardProps {
  task: Task;
  index: number;
  sprintName?: string;
  isOnline: boolean;
  isSelected: boolean;
  onClick: (e: React.MouseEvent) => void;
  onDelete: () => Promise<void>;
  onDuplicate?: () => void;
}

const priorityStyles: Record<TaskPriority, string> = {
  [TaskPriority.URGENT]: 'bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold',
  [TaskPriority.HIGH]: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  [TaskPriority.MEDIUM]: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  [TaskPriority.LOW]: 'bg-white/5 text-gray-500 border border-white/5',
};

export const TaskCard: React.FC<TaskCardProps> = ({ task, index, sprintName, isOnline, isSelected, onClick, onDelete, onDuplicate }) => {
  const completedSubtasks = task.subtasks.filter(st => st.completed).length;
  const requestConfirmation = useConfirmation();
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number } | null>(null);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    requestConfirmation({
      title: 'Delete Task',
      message: (
        <>
          Are you sure you want to delete the task <strong>"{task.title}"</strong>?
        </>
      ),
      onConfirm: onDelete,
      confirmText: 'Delete',
    });
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (!onDuplicate) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setContextMenu({ x, y });
  };

  useEffect(() => {
    if (!contextMenu) return;
    const handleGlobalClick = () => setContextMenu(null);
    window.addEventListener('click', handleGlobalClick);
    window.addEventListener('contextmenu', handleGlobalClick);
    return () => {
      window.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('contextmenu', handleGlobalClick);
    };
  }, [contextMenu]);

  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={onClick}
          onContextMenu={handleContextMenu}
          className={`relative group bg-[#131C1B] rounded-md shadow-md border border-transparent mb-4 p-4 cursor-pointer hover:bg-gray-800 transition-all duration-200 transform hover:-translate-y-1 ${
            snapshot.isDragging ? 'shadow-2xl scale-105 ring-2 ring-gray-500' : ''
          } ${isSelected ? 'ring-2 ring-blue-500 border-blue-500/50' : ''}`}
        >
          {contextMenu && (
            <div 
              style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
              className="absolute bg-[#1C2326] border border-white/10 rounded-lg shadow-2xl py-1 z-[9999] text-xs w-40 font-semibold text-white animate-in zoom-in-95 duration-100"
              onClick={(ev) => {
                ev.stopPropagation();
                setContextMenu(null);
                onDuplicate?.();
              }}
            >
              <button 
                type="button"
                className="w-full text-left px-4 py-2 hover:bg-emerald-500 hover:text-black flex items-center gap-2 cursor-pointer transition-colors"
                onClick={(ev) => {
                  ev.stopPropagation();
                  setContextMenu(null);
                  onDuplicate?.();
                }}
              >
                Duplicate Item
              </button>
            </div>
          )}
          <div className="flex justify-between items-center mb-1.5 pr-5 relative">
            <span className="text-[10px] font-mono text-emerald-500/70 font-bold uppercase tracking-wider">{task.ticketId}</span>
            <div className="flex items-center">
              {task.taskType === 'bug' ? (
                <span className="text-[9px] font-black uppercase text-red-400 bg-red-500/15 px-1.5 py-0.5 rounded border border-red-500/25 animate-pulse">Bug</span>
              ) : (
                <span className="text-[9px] font-black uppercase text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded border border-emerald-500/25">Task</span>
              )}
            </div>
          </div>
          <div className="flex justify-between items-start mb-2 pr-4">
            <h4 className="font-semibold text-xs text-white leading-snug pr-8 flex flex-col gap-1">
              <span>{task.title}</span>
              {task.referenceNo && (
                <span className="text-[9px] font-mono text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20 max-w-max">
                  🔗 Ref: {task.referenceNo}
                </span>
              )}
            </h4>
          </div>

          <div className="flex items-center gap-2 flex-wrap mb-4">
            <div className={`flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full ${priorityStyles[task.priority]}`}>
              {task.priority}
            </div>
            {sprintName && (
              <div className="flex items-center gap-1 text-[11px] font-medium bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">
                <RocketIcon className="w-3 h-3" />
                {sprintName}
              </div>
            )}
            {task.tags.filter(tag => tag && !tag.startsWith('ticket:') && !tag.startsWith('type:') && !tag.startsWith('ref:')).map(tag => (
              <span key={tag} className="text-[11px] font-medium bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">{tag}</span>
            ))}
          </div>
          
          <div className="flex justify-between items-center text-gray-400">
            <div className="flex items-center gap-3">
              {task.subtasks.length > 0 && (
                <div className="flex items-center gap-1 text-[11px]" title={`${completedSubtasks}/${task.subtasks.length} subtasks completed`}>
                  <CheckSquareIcon className="w-4 h-4" />
                  <span>{completedSubtasks}/{task.subtasks.length}</span>
                </div>
              )}
            </div>

            {task.assignee && (
              <UserAvatar 
                user={task.assignee} 
                isOnline={isOnline}
                className="w-7 h-7 ring-2 ring-[#131C1B] text-xs"
                title={`Assigned to ${task.assignee.name}`}
              />
            )}
          </div>
        </div>
      )}
    </Draggable>
  );
};
