import React, { useState, useEffect, useCallback, FormEvent, useMemo, useRef } from 'react';
import { Task, Subtask, User, TaskPriority, Sprint, TaskHistory, NewTaskData, Column } from '../types';
import { generateSubtasks as generateSubtasksFromApi } from '../services/geminiService';
import { XIcon, BotMessageSquareIcon, LoaderCircleIcon, SparklesIcon, CheckSquareIcon, MessageSquareIcon, PlusIcon, UserIcon, TagIcon, TrashIcon, HistoryIcon, CopyIcon, CheckIcon, ArrowLeftIcon } from '../components/Icons';
import { UserAvatar } from '../components/UserAvatar';
import { useConfirmation } from '../App';
import { JsonSyntaxHighlighter } from '../components/JsonSyntaxHighlighter';
import { api } from '../services/api';
import { RichTextEditor } from '../components/RichTextEditor';
import { TaskHierarchyVisualizer } from '../components/TaskHierarchyVisualizer';
import { TaskSchemaGraphVisualizer } from '../components/TaskSchemaGraphVisualizer';
import { useNavigate } from 'react-router-dom';

interface TaskDetailsPageProps {
  task: Task;
  currentUser: User;
  users: User[];
  projectMembers: User[];
  allProjectTags: string[];
  sprints: Sprint[];
  onlineUsers: Set<string>;
  projectName?: string;
  onClose: () => void;
  onUpdateTask: (task: Task) => Promise<void>;
  onUpdateSubtask: (taskId: string, subtaskId: string, updates: Partial<Subtask>) => Promise<void>;
  onDeleteSubtask: (taskId: string, subtaskId: string) => Promise<void>;
  onAddSubtasks: (taskId: string, subtasks: Partial<Subtask>[]) => Promise<void>;
  onAddComment: (taskId: string, commentText: string) => Promise<void>;
  aiFeaturesEnabled: boolean;
  onAddTask?: (taskData: NewTaskData) => Promise<void>;
  columns?: Column[];
  allTasks?: Task[];
  projectId?: string;
}

type AIGenerationState = 'idle' | 'loading' | 'success' | 'error';

const CopyButton: React.FC<{ text: string; className?: string }> = ({ text, className }) => {
    const [copied, setCopied] = useState(false);
    
    const handleCopy = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <button 
            type="button"
            onClick={handleCopy} 
            className={`p-1 rounded hover:bg-white/10 transition-colors flex-shrink-0 cursor-pointer ${className}`}
            title="Copy to clipboard"
        >
            {copied ? <CheckIcon className="w-3.5 h-3.5 text-emerald-500" /> : <CopyIcon className="w-3.5 h-3.5 text-gray-400" />}
        </button>
    );
};

const isJsonContent = (text: string): boolean => {
    if (!text) return false;
    const trimmed = text.trim();
    if (!((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']')))) {
        return false;
    }
    try {
        JSON.parse(trimmed);
        return true;
    } catch {
        return false;
    }
};

const EditableField: React.FC<{
  value: string;
  onSave: (value: string) => Promise<void> | void;
  onSaveFinished?: (finalValue: string) => void;
  isTextArea?: boolean;
  isRichText?: boolean;
  textClassName: string;
  inputClassName: string;
  placeholder?: string;
  type?: string;
  autoSave?: boolean;
}> = ({ value, onSave, onSaveFinished, isTextArea = false, isRichText = false, textClassName, inputClassName, placeholder, type = 'text', autoSave = false }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [currentValue, setCurrentValue] = useState(value);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const lastSavedValueRef = useRef(value);

  useEffect(() => {
    if (!isEditing) {
      setCurrentValue(value);
      lastSavedValueRef.current = value;
    }
  }, [value, isEditing]);

  const triggerSave = async (valToSave: string) => {
    if (valToSave === lastSavedValueRef.current) return;
    setSaveStatus('saving');
    try {
      await onSave(valToSave);
      lastSavedValueRef.current = valToSave;
      setSaveStatus('saved');
      setTimeout(() => {
        setSaveStatus((prev) => (prev === 'saved' ? 'idle' : prev));
      }, 2000);
    } catch (e) {
      console.error("Auto-save failed:", e);
      setSaveStatus('idle');
    }
  };

  useEffect(() => {
    if (autoSave && isEditing && currentValue !== lastSavedValueRef.current) {
      const timer = setTimeout(() => {
        const cleanedValue = isRichText || isTextArea ? currentValue.trim() : currentValue;
        triggerSave(cleanedValue);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [currentValue, autoSave, isEditing, isRichText, isTextArea]);

  const handleSave = async () => {
    const cleanedValue = isRichText || isTextArea ? currentValue.trim() : currentValue;
    if (cleanedValue !== lastSavedValueRef.current) {
      await triggerSave(cleanedValue);
    }
    if (onSaveFinished && cleanedValue !== value) {
      onSaveFinished(cleanedValue);
    }
    setIsEditing(false);
    setSaveStatus('idle');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isTextArea && !isRichText) {
      handleSave();
    } else if (e.key === 'Escape') {
      setCurrentValue(value);
      setIsEditing(false);
      setSaveStatus('idle');
    }
  };

  if (isEditing) {
    if (isRichText) {
      return (
        <div className="space-y-1 mt-1">
          <RichTextEditor value={currentValue} onChange={setCurrentValue} placeholder={placeholder} />
          <div className="flex gap-2 justify-between items-center">
            <div className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider pl-1">
              {saveStatus === 'saving' && (
                <span className="text-amber-400 flex items-center gap-1 animate-pulse">
                  <span className="w-1 h-1 rounded-full bg-amber-400" />
                  Saving...
                </span>
              )}
              {saveStatus === 'saved' && (
                <span className="text-emerald-400 flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-emerald-400 animate-ping" />
                  Saved
                </span>
              )}
            </div>

            <div className="flex gap-1.5 justify-end">
              <button 
                type="button"
                onClick={() => {
                  setCurrentValue(value);
                  setIsEditing(false);
                  setSaveStatus('idle');
                }} 
                className="px-2 py-1 text-[10px] font-semibold uppercase text-gray-400 bg-white/5 border border-white/5 hover:bg-white/10 rounded cursor-pointer transition-all"
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={handleSave} 
                className="px-2 py-1 text-[10px] font-semibold uppercase bg-emerald-500 text-black hover:bg-emerald-400 rounded cursor-pointer transition-all"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      );
    }

    const commonProps = {
        value: currentValue,
        onChange: (e: any) => setCurrentValue(e.target.value),
        onBlur: handleSave,
        onKeyDown: handleKeyDown,
        className: `w-full ${inputClassName}`,
        autoFocus: true,
        placeholder,
    }
    return isTextArea 
        ? <textarea {...commonProps} rows={3} /> 
        : <input type={type} {...commonProps} />;
  }
  
  if (isJsonContent(value)) {
      return (
          <div onClick={() => setIsEditing(true)} className="cursor-pointer group relative">
              <div className="absolute top-1 right-1 text-[9px] text-gray-500 opacity-0 group-hover:opacity-100 bg-[#0D1117] px-1 rounded border border-gray-800 z-10">Click to edit</div>
              <JsonSyntaxHighlighter data={value} />
          </div>
      );
  }

  if (isRichText) {
      if (!value) {
          return (
              <div 
                  onClick={() => setIsEditing(true)} 
                  className={`cursor-pointer hover:bg-white/[0.02] rounded px-2 py-1 border border-transparent hover:border-white/5 ${textClassName}`}
              >
                  <span className="text-gray-500">{placeholder}</span>
              </div>
          );
      }
      return (
          <div 
              onClick={() => setIsEditing(true)} 
              className={`cursor-pointer hover:bg-white/[0.02] rounded px-2 py-1 border border-transparent hover:border-white/5 ${textClassName}`}
          >
              <div 
                  className="ql-editor p-0 m-0 border-0 bg-transparent text-inherit text-xs"
                  dangerouslySetInnerHTML={{ __html: value }} 
              />
          </div>
      );
  }

  return <div onClick={() => setIsEditing(true)} className={`cursor-pointer hover:text-emerald-400 rounded transition-colors ${textClassName}`}>{value || <span className="text-gray-500">{placeholder}</span>}</div>;
}

const CommentText: React.FC<{ text: string, renderWithMentions: (text: string) => React.ReactNode }> = ({ text, renderWithMentions }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const lines = text.split('\n');
    const hasMoreThan10Lines = lines.length > 10;

    return (
        <div>
            <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">
                {renderWithMentions(
                    isExpanded || !hasMoreThan10Lines
                        ? text
                        : lines.slice(0, 10).join('\n') + ' ...'
                )}
            </p>
            {hasMoreThan10Lines && (
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    type="button"
                    className="mt-1 text-[9px] font-bold uppercase tracking-wider block text-emerald-400 hover:text-emerald-300 hover:underline cursor-pointer"
                >
                    {isExpanded ? 'Show Less' : 'Read More'}
                </button>
            )}
        </div>
    );
}

interface ActivitySectionProps {
  task: Task;
  onAddComment: (taskId: string, commentText: string) => Promise<void>;
  currentUser: User;
  projectMembers: User[];
  onlineUsers: Set<string>;
  users: User[];
}

const ActivitySection: React.FC<ActivitySectionProps> = ({ task, onAddComment, currentUser, projectMembers, onlineUsers, users }) => {
  const [activeTab, setActiveTab2] = useState<'comments' | 'history'>('comments');
  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting2] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionSuggestions, setMentionSuggestions] = useState<User[]>([]);
  const [activeMentionIndex, setActiveMentionIndex] = useState(0);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setCommentText(value);

    const cursor = e.target.selectionStart;
    const textBeforeCursor = value.substring(0, cursor);
    const lastAtIdx = textBeforeCursor.lastIndexOf('@');

    if (lastAtIdx !== -1 && (lastAtIdx === 0 || /\s/.test(textBeforeCursor.charAt(lastAtIdx - 1)))) {
      const query = textBeforeCursor.substring(lastAtIdx + 1);
      if (!/\s/.test(query)) {
        setMentionQuery(query);
        setShowMentions(true);
        const filtered = projectMembers.filter(member => 
          member.name.toLowerCase().includes(query.toLowerCase()) || 
          member.email.toLowerCase().includes(query.toLowerCase())
        );
        setMentionSuggestions(filtered);
        setActiveMentionIndex(0);
        return;
      }
    }
    setShowMentions(false);
  };

  const handleMentionSelect = (user: User) => {
    if (!commentInputRef.current) return;
    const cursor = commentInputRef.current.selectionStart;
    const value = commentText;
    const textBeforeCursor = value.substring(0, cursor);
    const lastAtIdx = textBeforeCursor.lastIndexOf('@');
    
    const newVal = value.substring(0, lastAtIdx) + `@${user.name} ` + value.substring(cursor);
    setCommentText(newVal);
    setShowMentions(false);
    
    setTimeout(() => {
        if (commentInputRef.current) {
            commentInputRef.current.focus();
            const newCursorPos = lastAtIdx + user.name.length + 2;
            commentInputRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }
    }, 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentions && mentionSuggestions.length > 0) {
        if (e.key === 'ArrowDown') { e.preventDefault(); setActiveMentionIndex(prev => (prev + 1) % mentionSuggestions.length); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveMentionIndex(prev => (prev - 1 + mentionSuggestions.length) % mentionSuggestions.length); }
        else if (e.key === 'Enter') { e.preventDefault(); handleMentionSelect(mentionSuggestions[activeMentionIndex]); }
        else if (e.key === 'Escape') { e.preventDefault(); setShowMentions(false); }
    }
  };

  const handlePostComment = async (e: FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setIsSubmitting2(true);
    try {
      await onAddComment(task.id, commentText.trim());
      setCommentText('');
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting2(false);
    }
  };

  const renderWithMentions = (text: string) => {
    if (!text) return '';
    const parts = text.split(/(@[a-zA-Z0-9\s._-]+)/g);
    return parts.map((part, idx) => {
        if (part.startsWith('@')) {
            const name = part.substring(1).trim();
            const matchedUser = projectMembers.find(m => m.name.toLowerCase() === name.toLowerCase());
            if (matchedUser) {
                return (
                    <span key={idx} className="font-extrabold text-emerald-400 bg-emerald-500/10 px-1 py-0.5 rounded border border-emerald-500/20 text-[10px]">
                        @{matchedUser.name}
                    </span>
                );
            }
        }
        return part;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex border-b border-white/5 pb-1 gap-4 text-[10px] font-bold uppercase tracking-wider">
        <button 
          type="button"
          onClick={() => setActiveTab2('comments')} 
          className={`pb-1 border-b-2 transition-all ${activeTab === 'comments' ? 'border-emerald-500 text-white' : 'border-transparent text-gray-500 hover:text-white'}`}
        >
          Discussion ({task.comments?.length || 0})
        </button>
        <button 
          type="button"
          onClick={() => setActiveTab2('history')} 
          className={`pb-1 border-b-2 transition-all ${activeTab === 'history' ? 'border-emerald-500 text-white' : 'border-transparent text-gray-500 hover:text-white'}`}
        >
          Telemetry trace ({task.history?.length || 0})
        </button>
      </div>

      {activeTab === 'comments' ? (
        <div className="space-y-4">
          <div className="space-y-2.5 max-h-64 overflow-y-auto custom-scrollbar pr-1">
            {(!task.comments || task.comments.length === 0) ? (
              <p className="text-[11px] text-gray-500 py-2 text-center font-mono italic">No commentary logged.</p>
            ) : (
              [...task.comments].sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()).map(c => {
                const commentUser = users.find(u => u.id === c.userId);
                return (
                  <div key={c.id} className="flex gap-2.5 items-start py-2 border-b border-white/5 bg-transparent">
                    <UserAvatar 
                      user={commentUser} 
                      className="w-5 h-5 text-[8px] flex-shrink-0" 
                      isOnline={commentUser ? onlineUsers.has(commentUser.id) : false} 
                    />
                    <div className="flex-grow min-w-0 space-y-0.5">
                      <div className="flex justify-between items-center text-[9px] uppercase font-bold text-gray-500">
                        <span className="text-gray-300 truncate">{commentUser?.name || 'Inscriber'}</span>
                        <span className="text-[8px] font-mono whitespace-nowrap">{new Date(c.createdAt).toLocaleDateString()} {new Date(c.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      </div>
                      <CommentText text={c.text} renderWithMentions={renderWithMentions} />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <form onSubmit={handlePostComment} className="space-y-2 relative">
            <div className="relative">
                <textarea
                  ref={commentInputRef}
                  value={commentText}
                  onChange={handleTextChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Inscribe contribution..."
                  rows={2}
                  className="w-full px-3 py-2 bg-[#1C2326]/50 border border-white/5 hover:border-white/10 focus:border-emerald-500/30 rounded focus:outline-none text-xs text-white placeholder-gray-500 leading-relaxed font-medium transition-all"
                />
                
                {showMentions && mentionSuggestions.length > 0 && (
                    <div className="absolute left-0 bottom-full mb-1 z-30 bg-[#1C2326] border border-white/10 rounded shadow-2xl max-h-40 overflow-y-auto custom-scrollbar overflow-hidden w-56">
                        <div className="bg-black/40 px-2 py-1 border-b border-white/5 text-[8px] font-black text-gray-500 uppercase tracking-widest">
                            Members
                        </div>
                        {mentionSuggestions.map((member, index) => (
                            <button
                                key={member.id}
                                type="button"
                                onClick={() => handleMentionSelect(member)}
                                onMouseEnter={() => setActiveMentionIndex(index)}
                                className={`w-full flex items-center gap-1.5 px-2 py-1.5 text-left font-bold text-[9px] uppercase tracking-wider ${index === activeMentionIndex ? 'bg-emerald-500 text-black' : 'text-gray-300 hover:bg-white/5'}`}
                            >
                                <UserAvatar user={member} className="w-4 h-4 text-[7px]" isOnline={onlineUsers.has(member.id)} />
                                <div className="truncate">
                                    <div className="truncate">{member.name}</div>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="flex justify-end">
              <button 
                type="submit" 
                disabled={isSubmitting || !commentText.trim()} 
                className="px-3 py-1.5 bg-white text-black text-[9px] font-bold uppercase tracking-wider rounded hover:bg-gray-200 transition-colors disabled:opacity-40 cursor-pointer"
              >
                Comment
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-64 overflow-y-auto custom-scrollbar pr-1">
          {(!task.history || task.history.length === 0) ? (
            <p className="text-[11px] text-gray-500 py-2 text-center font-mono italic">No telemetry traces logged.</p>
          ) : (
            task.history.map(h => (
              <div key={h.id} className="flex gap-2 items-center py-1.5 border-b border-white/5 text-[11px] text-gray-300">
                <UserAvatar user={h.user} className="w-4 h-4 text-[7px]" isOnline={h.user ? onlineUsers.has(h.user.id) : false} />
                <span className="font-bold text-gray-400 uppercase tracking-wide text-[9px] select-none truncate max-w-[80px]">{h.user?.name || 'Agent'}</span>
                <span className="text-gray-500 truncate flex-grow text-left pl-1">{h.changeDescription}</span>
                <span className="text-[9px] text-gray-600 font-mono flex-shrink-0 select-none">{new Date(h.createdAt).toLocaleDateString()}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export const TaskDetailsPage: React.FC<TaskDetailsPageProps> = ({ 
  task, currentUser, users, projectMembers, allProjectTags, sprints, onlineUsers, projectName, onClose, onUpdateTask, onUpdateSubtask, onDeleteSubtask, onAddSubtasks, onAddComment, aiFeaturesEnabled, onAddTask, columns, allTasks = [], projectId 
}) => {
  const navigate = useNavigate();
  const [editedTask, setEditedTask] = useState<Task>(task);
  const [aiState, setAiState] = useState<AIGenerationState>('idle');
  const [aiError, setAiError] = useState<string | null>(null);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newSubtaskAssigneeId, setNewSubtaskAssigneeId] = useState('');
  const [newTag, setNewTag] = useState('');
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const [isTagInputFocused, setIsTagInputFocused] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showVisualizer, setShowVisualizer] = useState(false);
  const [activeTab, setActiveTab] = useState<'context' | 'reference'>('context');
  const [visualizerMode, setVisualizerMode] = useState<'graph' | 'spawner'>('graph');
  const requestConfirmation = useConfirmation();

  useEffect(() => {
    setEditedTask(task);
  }, [task]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const handleUpdateField = (field: keyof Task, value: any) => {
    const updatedTask = { ...editedTask, [field]: value };
    setEditedTask(updatedTask);
    onUpdateTask(updatedTask);
  };

  const handleConvertType = async () => {
    const nextType = editedTask.taskType === 'bug' ? 'task' : 'bug';
    const updated = {
      ...editedTask,
      taskType: nextType,
    };
    
    const conversationLog: TaskHistory = {
      id: `temp-h-conv-${Date.now()}`,
      user: currentUser,
      createdAt: new Date().toISOString(),
      changeDescription: `converted type to ${nextType === 'bug' ? 'Bug' : 'Task'}`
    };
    updated.history = [conversationLog, ...(editedTask.history || [])];
    
    setEditedTask(updated);
    await onUpdateTask(updated);
    showToast(`Converted to ${nextType === 'bug' ? 'Bug' : 'Task'}!`);
  };

  const handleCreateDerivation = () => {
    if (!projectId) return;
    const targetType = editedTask.taskType === 'bug' ? 'task' : 'bug';
    
    const derivedTitle = `${targetType === 'bug' ? 'Bug' : 'Task'} derived from ${editedTask.ticketId}: ${editedTask.title.substring(0, 30)}`;
    const derivedDesc = `**References parent:** [${editedTask.ticketId}]\n\n**Parent Description:**\n${editedTask.description || 'None'}`;
    
    const query = new URLSearchParams({
      parentId: editedTask.id,
      taskType: targetType,
      title: derivedTitle,
      description: derivedDesc,
      priority: editedTask.priority,
      assigneeId: editedTask.assignee?.id || '',
      sprintId: editedTask.sprintId || '',
    }).toString();

    navigate(`/project/${projectId}/create-task?${query}`);
    showToast(`Redirecting to full form for linked ${targetType === 'bug' ? 'Bug' : 'Task'}...`);
  };

  const taskCreator = users.find(u => u.id === task.creatorId);

  const handleAssigneeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const assigneeId = e.target.value;
    const assignee = projectMembers.find(u => u.id === assigneeId);
    handleUpdateField('assignee', assignee);
  };

  const handlePriorityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const priority = e.target.value as TaskPriority;
    handleUpdateField('priority', priority);
  };
  
  const handleSprintChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sprintId = e.target.value;
    handleUpdateField('sprintId', sprintId || null);
  };

  const handleSubtaskToggle = (subtaskId: string) => {
    const subtask = editedTask.subtasks.find(s => s.id === subtaskId);
    if (subtask) {
        onUpdateSubtask(editedTask.id, subtaskId, { completed: !subtask.completed });
    }
  };
  
  const handleSubtaskTitleChange = (subtaskId: string, newTitle: string) => {
    onUpdateSubtask(editedTask.id, subtaskId, { title: newTitle });
  };

  const handleGenerateSubtasks = useCallback(async () => {
    setAiState('loading');
    setAiError(null);
    try {
        const generated = await generateSubtasksFromApi(editedTask.title, editedTask.description);
        if (generated && generated.length > 0) {
            await onAddSubtasks(editedTask.id, generated.map(s => ({ title: s.title })));
        }
        setAiState('success');
    } catch(err) {
        setAiState('error');
        setAiError(err instanceof Error ? err.message : 'Neural decomposition failure.');
    }
  }, [editedTask, onAddSubtasks]);

  const handleAddManualSubtask = async (e: FormEvent) => {
    e.preventDefault();
    if (newSubtaskTitle.trim()) {
        const newSubtask: Partial<Subtask> = { 
          title: newSubtaskTitle.trim(),
          assigneeId: newSubtaskAssigneeId || undefined,
        };
        await onAddSubtasks(editedTask.id, [newSubtask]);
        setNewSubtaskTitle('');
        setNewSubtaskAssigneeId('');
    }
  }

  const handleSubtaskAssigneeChange = (subtaskId: string, assigneeId: string) => {
    onUpdateSubtask(editedTask.id, subtaskId, { assigneeId: assigneeId || null });
  };

  const handleNewTagChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewTag(value);
    if (value) {
        const filtered = allProjectTags.filter(
            tag => tag.toLowerCase().includes(value.toLowerCase()) && !editedTask.tags.includes(tag)
        );
        setTagSuggestions(filtered);
        setActiveSuggestionIndex(0);
    } else {
        setTagSuggestions([]);
    }
  };

  const addTag = (tagToAdd: string) => {
    if (tagToAdd && !editedTask.tags.includes(tagToAdd)) {
        const newTags = [...new Set([...editedTask.tags, tagToAdd.trim()])];
        handleUpdateField('tags', newTags);
        setNewTag('');
        setTagSuggestions([]);
    }
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isTagInputFocused && tagSuggestions.length > 0) {
        if (e.key === 'ArrowDown') { e.preventDefault(); setActiveSuggestionIndex(prev => (prev + 1) % tagSuggestions.length); return; }
        if (e.key === 'ArrowUp') { e.preventDefault(); setActiveSuggestionIndex(prev => (prev - 1 + tagSuggestions.length) % tagSuggestions.length); return; }
    }
    if (e.key === 'Enter') {
        e.preventDefault();
        let tagToAdd = newTag.trim();
        if (isTagInputFocused && tagSuggestions.length > 0 && tagSuggestions[activeSuggestionIndex]) {
            tagToAdd = tagSuggestions[activeSuggestionIndex];
        }
        addTag(tagToAdd);
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
      const newTags = editedTask.tags.filter(tag => tag !== tagToRemove);
      handleUpdateField('tags', newTags);
  };

  const handleDeleteSubtask = (subtaskId: string) => {
    const subtaskToDelete = editedTask.subtasks.find(s => s.id === subtaskId);
    if (subtaskToDelete) {
      requestConfirmation({
        title: 'Delete Subtask',
        message: <>Remove subtask <strong>"{subtaskToDelete.title}"</strong>?</>,
        onConfirm: () => {
          onDeleteSubtask(editedTask.id, subtaskId);
        },
        confirmText: 'Delete',
      });
    }
  };

  const completedSubtasks = (editedTask.subtasks || []).filter(st => st.completed).length;
  const totalSubtasks = (editedTask.subtasks || []).length;
  const progress = totalSubtasks > 0 ? (completedSubtasks / totalSubtasks) * 100 : 0;

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-[#0D1112]">
      {/* Header breadcrumbs */}
      <header className="h-14 min-h-[56px] max-h-14 flex-shrink-0 border-b border-white/5 bg-[#0E1314]/85 backdrop-blur-xl px-6 flex items-center justify-between sticky top-0 z-35">
        <div className="flex items-center gap-3">
          <button 
            type="button" 
            onClick={onClose}
            className="p-1 px-2 text-xs rounded bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-all flex items-center gap-1 cursor-pointer"
          >
            <ArrowLeftIcon className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Back</span>
          </button>
          
          <div className="flex items-center gap-1.5 text-xs text-gray-400 font-semibold truncate whitespace-nowrap">
            <span className="text-gray-500 truncate">{projectName || "Workspace"}</span>
            <span className="text-gray-700">/</span>
            <span className="text-white bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 text-[11px] font-bold truncate">{editedTask.ticketId}</span>
            <span className="text-gray-700">/</span>
            <span className="text-gray-400 text-[11px] uppercase tracking-widest">Details</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {editedTask.taskType === 'bug' ? (
            <span className="text-[10px] uppercase tracking-wider bg-red-400/10 text-red-400 border border-red-500/10 px-2 py-0.5 rounded">
              Bug
            </span>
          ) : (
            <span className="text-[10px] uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded">
              Task
            </span>
          )}
          {editedTask.referenceNo && (
            <span className="text-[10px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded">
              Ref: {editedTask.referenceNo}
            </span>
          )}
        </div>
      </header>

      {/* Main Page scrollable body */}
      <div className="flex-grow overflow-y-auto custom-scrollbar p-6">
        <div className="max-w-6xl mx-auto w-full space-y-4">

      {toastMessage && (
        <div className="bg-emerald-500 text-black font-bold text-[10px] uppercase tracking-wider px-3 py-1 rounded max-w-max mx-auto shadow animate-pulse">
          {toastMessage}
        </div>
      )}

      {/* Main Grid View - Exactly 70% Left, 30% Right column */}
      <div className="grid grid-cols-1 lg:grid-cols-[70%_30%] gap-4 lg:gap-6 items-start">
        
        {/* Left column (Main Details & Discussion) */}
        <div className="space-y-4 min-w-0">
          {/* Node Graph Toggle Option */}
          <div id="visualizer-toggle-header" className="flex items-center justify-between bg-black/20 px-4 py-2.5 rounded-lg border border-white/5 shadow-inner">
            <div className="flex items-center gap-2">
              <span className={`h-1.5 w-1.5 rounded-full ${showVisualizer ? 'bg-emerald-400 animate-pulse' : 'bg-gray-650'}`} />
              <span className="text-[10px] font-mono uppercase font-black tracking-wider text-gray-400">Dependency & Connection Spawner</span>
            </div>
            <button
              onClick={() => setShowVisualizer(!showVisualizer)}
              className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase transition-all tracking-wider cursor-pointer ${
                showVisualizer 
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20' 
                  : 'bg-emerald-500 text-black border-emerald-500 hover:bg-emerald-600'
              }`}
            >
              {showVisualizer ? 'Hide spawner form' : 'Spawn Linked Node / Graph'}
            </button>
          </div>

          {showVisualizer && (
            <div className="space-y-3">
              {/* Visualizer Mode tabs */}
              <div className="flex items-center gap-1.5 p-1 bg-black/40 rounded-lg border border-white/5 inline-flex select-none">
                <button
                  type="button"
                  onClick={() => setVisualizerMode('graph')}
                  className={`text-[9.5px] font-mono font-bold uppercase tracking-wider px-3 py-1 rounded transition-all cursor-pointer ${
                    visualizerMode === 'graph'
                      ? 'bg-emerald-500 text-black shadow-md font-black'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  🕸️ Relational Schema Graph
                </button>
                <button
                  type="button"
                  onClick={() => setVisualizerMode('spawner')}
                  className={`text-[9.5px] font-mono font-bold uppercase tracking-wider px-3 py-1 rounded transition-all cursor-pointer ${
                    visualizerMode === 'spawner'
                      ? 'bg-emerald-500 text-black shadow-md font-black'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  🌱 Dependency Spawner Form
                </button>
              </div>

              {visualizerMode === 'graph' ? (
                <TaskSchemaGraphVisualizer
                  currentTask={editedTask}
                  allTasks={allTasks}
                  projectMembers={projectMembers}
                  onSelectTask={(targetTask) => {
                    if (projectId) {
                      navigate(`/project/${projectId}/task/${targetTask.id}`);
                    }
                  }}
                  onClose={() => setShowVisualizer(false)}
                />
              ) : (
                <TaskHierarchyVisualizer
                  currentTask={editedTask}
                  allTasks={allTasks}
                  projectMembers={projectMembers}
                  currentColumnId={columns?.find(c => c.taskIds.includes(editedTask.id))?.id || columns?.[0]?.id || ''}
                  sprintId={editedTask.sprintId}
                  onSelectTask={(targetTask) => {
                    if (projectId) {
                      navigate(`/project/${projectId}/task/${targetTask.id}`);
                    }
                  }}
                  onAddTask={async (td) => {
                    if (projectId) {
                      const query = new URLSearchParams({
                        parentId: td.parentId || '',
                        taskType: td.taskType || 'task',
                        title: td.title || '',
                        description: td.description || '',
                        priority: td.priority || 'MEDIUM',
                        assigneeId: td.assigneeId || '',
                        sprintId: td.sprintId || '',
                      }).toString();
                      navigate(`/project/${projectId}/create-task?${query}`);
                      showToast("Redirecting to full form for linked child node...");
                    }
                  }}
                  onOpenFullCreatePage={() => {
                    if (projectId) {
                      navigate(`/project/${projectId}/create-task?parentId=${editedTask.id}`);
                    }
                  }}
                />
              )}
            </div>
          )}

          <div className="space-y-4 w-full">
            
            {/* Title display */}
            <div className="flex justify-between items-start my-1 pb-1">
              <div className="flex-grow group flex items-start gap-2 w-full">
                <div className="flex-grow min-w-0">
                  <EditableField 
                      value={editedTask.title}
                      onSave={(newTitle) => handleUpdateField('title', newTitle)}
                      textClassName="text-base font-semibold w-full cursor-pointer hover:text-emerald-400 rounded transition-colors text-white break-words block"
                      inputClassName="text-base font-semibold p-1 px-2 rounded border border-emerald-500/20 bg-black/40 focus:outline-none text-white w-full"
                      placeholder="Task Title"
                  />
                </div>
                <CopyButton text={`${editedTask.ticketId}: ${editedTask.title}`} className="opacity-0 group-hover:opacity-100 flex-shrink-0" />
              </div>
            </div>

            {/* Injected metadata */}
            <div className="flex flex-wrap items-center gap-4 text-[10px] text-gray-500 border-none py-1 block">
              <span className="flex items-center gap-1">
                <UserIcon className="w-3 h-3 text-emerald-400" />
                Origin: <span className="text-gray-300 font-medium ml-0.5">{taskCreator ? taskCreator.name : 'External Node'}</span>
              </span>
              <span className="text-gray-700">|</span>
              <span className="flex items-center gap-1">
                <HistoryIcon className="w-3 h-3 text-emerald-400" />
                Injected: <span className="text-gray-300 font-mono ml-0.5">{new Date(task.createdAt).toLocaleDateString()} {new Date(task.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
              </span>
            </div>

            {/* Contextual description */}
            <section className="space-y-1.5">
              <div className="flex items-center gap-1.5 pb-1 border-b border-white/5">
                  <MessageSquareIcon className="w-3.5 h-3.5 text-emerald-500" />
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Contextual Data</h4>
              </div>
              <div className="group relative">
                  <EditableField 
                      value={editedTask.description}
                      onSave={(newDesc) => handleUpdateField('description', newDesc)}
                      onSaveFinished={async (finalDesc) => {
                        const textContent = finalDesc ? finalDesc.replace(/<[^>]*>/g, '').trim() : '';
                        const preview = textContent 
                          ? (textContent.length > 80 ? `${textContent.substring(0, 80)}...` : textContent)
                          : 'empty';
                        try {
                          await onAddComment(task.id, `📝 Updated description: "${preview}"`);
                        } catch (err) {
                          console.warn("Auto description comment status: skipped.", err);
                        }
                      }}
                      isRichText
                      autoSave
                      textClassName="text-xs text-gray-300 w-full cursor-pointer hover:bg-white/[0.02] rounded p-2.5 min-h-[70px] leading-relaxed border border-white/5 block bg-black/10"
                      inputClassName="text-xs p-2.5 rounded border border-emerald-500/25 bg-[#0C1012] focus:outline-none text-white w-full"
                      placeholder="No context provided. Click to insert description..."
                  />
                  {!isJsonContent(editedTask.description) && (
                      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <CopyButton text={editedTask.description} className="bg-black/60 p-1 rounded" />
                      </div>
                  )}
              </div>
            </section>

            {/* Sub-Nodes list */}
            <section className="space-y-2 pt-3 border-t border-white/5">
              <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                      <CheckSquareIcon className="w-3.5 h-3.5 text-emerald-500" />
                      <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Sub-Nodes</h4>
                  </div>
                  {totalSubtasks > 0 && (
                      <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-emerald-500/70">{Math.round(progress)}% Complete</span>
                          <div className="w-24 bg-white/5 rounded-full h-1 overflow-hidden">
                              <div className="bg-emerald-500 h-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
                          </div>
                      </div>
                  )}
              </div>

              <div className="divide-y divide-white/5 border-t border-b border-white/5">
                {(editedTask.subtasks || []).map(subtask => {
                  return (
                      <div key={subtask.id} className="flex items-center gap-3 py-1.5 hover:bg-white/[0.01] transition-all group">
                          <input
                              type="checkbox"
                              checked={subtask.completed}
                              onChange={() => handleSubtaskToggle(subtask.id)}
                              className="w-4 h-4 rounded border border-white/10 bg-[#1C2326] text-emerald-500 focus:ring-emerald-500/55 flex-shrink-0 cursor-pointer"
                          />
                          <div className="flex-grow min-w-0">
                               <div className="flex items-center gap-1 mb-px">
                                  <span className="text-[9px] font-mono text-emerald-500/40 font-bold uppercase">{subtask.ticketId}</span>
                               </div>
                               <EditableField
                                  value={subtask.title}
                                  onSave={(newTitle) => handleSubtaskTitleChange(subtask.id, newTitle)}
                                  textClassName={`text-xs ${subtask.completed ? 'line-through text-gray-600' : 'text-gray-300'} truncate block`}
                                  inputClassName="text-xs p-0.5 rounded bg-[#1C2326] border border-white/5 focus:outline-none text-white w-full"
                                  placeholder="Edit sub-node..."
                              />
                          </div>
                          <div className="ml-auto flex items-center gap-2 opacity-50 group-hover:opacity-100 transition-opacity flex-shrink-0">
                              <select
                                  value={subtask.assigneeId || ''}
                                  onChange={(e) => handleSubtaskAssigneeChange(subtask.id, e.target.value)}
                                  className="text-[9px] font-bold uppercase bg-[#1C2326] border border-white/5 text-white rounded py-0.5 px-1.5 focus:outline-none cursor-pointer"
                              >
                                  <option value="">Auto</option>
                                  {projectMembers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                              </select>
                              
                              <UserAvatar 
                                  user={subtask.assignee}
                                  className="w-5 h-5 text-[8px] flex-shrink-0" 
                                  isOnline={subtask.assignee ? onlineUsers.has(subtask.assignee.id) : false}
                              />
                              
                              <button 
                                  type="button"
                                  onClick={() => handleDeleteSubtask(subtask.id)}
                                  className="p-1 rounded text-gray-600 hover:text-red-400 hover:bg-red-400/10 transition-all cursor-pointer"
                              >
                                  <TrashIcon className="w-3.5 h-3.5" />
                              </button>
                          </div>
                      </div>
                  )
                })}
              </div>

              {/* Subtask Input */}
              <form onSubmit={handleAddManualSubtask} className="flex items-center gap-2 bg-black/10 p-1 rounded mt-1">
                  <input 
                      type="text"
                      value={newSubtaskTitle}
                      onChange={(e) => setNewSubtaskTitle(e.target.value)}
                      placeholder="+ Add manual sub-task..."
                      className="flex-grow px-2 py-0.5 bg-transparent text-xs text-white focus:outline-none placeholder-gray-650"
                  />
                  <div className="flex items-center gap-1.5">
                      <select
                          value={newSubtaskAssigneeId}
                          onChange={(e) => setNewSubtaskAssigneeId(e.target.value)}
                          className="px-1.5 py-0.5 bg-[#1C2326] border border-white/5 rounded text-[9px] text-gray-400 focus:text-white cursor-pointer"
                      >
                          <option value="">Assignee</option>
                          {projectMembers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                      <button type="submit" disabled={!newSubtaskTitle.trim()} className="p-1 px-2.5 bg-white text-black text-[9px] font-bold uppercase rounded hover:bg-gray-200 transition-all disabled:opacity-30 cursor-pointer">
                          Add
                      </button>
                  </div>
              </form>

              {/* Neural Decomposition widget */}
              {aiFeaturesEnabled && (
                  <div className="bg-emerald-500/5 border border-emerald-500/10 p-2.5 rounded mt-2 flex items-center justify-between gap-4">
                      <div className="flex items-start gap-1.5">
                          <SparklesIcon className="w-3.5 h-3.5 text-emerald-400 animate-pulse mt-0.5 flex-shrink-0"/>
                          <div>
                              <h4 className="text-[9px] font-bold uppercase tracking-wider text-emerald-400">Neural Decomposition</h4>
                              <p className="text-[10px] text-emerald-400/60 leading-tight">Apply AI to generate subtask mesh targets.</p>
                          </div>
                      </div>
                      <button
                          type="button"
                          onClick={handleGenerateSubtasks}
                          disabled={aiState === 'loading'}
                          className="flex items-center justify-center gap-1 px-2.5 py-1 bg-emerald-500 text-black font-semibold rounded hover:bg-emerald-400 transition-all text-[9px] disabled:opacity-50 cursor-pointer flex-shrink-0"
                      >
                      {aiState === 'loading' ? (
                          <>
                              <LoaderCircleIcon className="w-3 h-3 animate-spin mr-1" />
                              Working...
                          </>
                      ) : (
                          <>
                              <BotMessageSquareIcon className="w-3 h-3 mr-1" />
                              Decompose
                          </>
                      )}
                      </button>
                  </div>
              )}
            </section>

          </div>

          {/* Activity Logs without nesting borders */}
          <div className="pt-2">
            <ActivitySection 
                task={editedTask} 
                onAddComment={onAddComment} 
                currentUser={currentUser} 
                projectMembers={projectMembers} 
                onlineUsers={onlineUsers} 
                users={users} 
            />
          </div>
        </div>

        {/* Right properties Column - Name: "Contextual Data" (Exactly 30% width) */}
        <div className="space-y-4 lg:sticky lg:top-0 self-start">
          <div className="bg-white/[0.01] border border-white/5 rounded p-3 space-y-4">
            
            {/* Tab selection headers */}
            <div className="flex border-b border-white/5 pb-1 gap-4 select-none">
              <button
                type="button"
                onClick={() => setActiveTab('context')}
                className={`text-[10px] font-bold uppercase tracking-[0.1em] pb-1 cursor-pointer transition-colors relative ${
                  activeTab === 'context' 
                    ? 'text-white' 
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                Context Data
                {activeTab === 'context' && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-emerald-500" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('reference')}
                className={`text-[10px] font-bold uppercase tracking-[0.1em] pb-1 cursor-pointer transition-colors relative ${
                  activeTab === 'reference' 
                    ? 'text-white' 
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                Reference
                {activeTab === 'reference' && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-emerald-500" />
                )}
              </button>
            </div>
            
            {activeTab === 'context' ? (
              <div className="space-y-4 animate-fade-in">
                {/* Assignee */}
                <div>
                  <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5 select-none">Assignee</label>
                  <div className="relative">
                      <select
                        value={editedTask.assignee?.id || ''}
                        onChange={handleAssigneeChange}
                        className="w-full pl-2 pr-8 py-1 bg-[#1C2326] text-white text-xs border border-white/5 focus:ring-0 focus:outline-none appearance-none rounded cursor-pointer"
                      >
                        <option value="">Unassigned</option>
                        {projectMembers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                           <UserIcon className="w-3.5 h-3.5" />
                      </div>
                  </div>
                </div>

                {/* Priority */}
                <div>
                  <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5 select-none">Priority</label>
                  <select
                    value={editedTask.priority}
                    onChange={handlePriorityChange}
                    className="w-full px-2 py-1 bg-[#1C2326] text-white text-xs border border-white/5 focus:ring-0 focus:outline-none rounded cursor-pointer uppercase font-mono text-[10px]"
                  >
                    {Object.values(TaskPriority).map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>

                {/* Sprint */}
                <div>
                  <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5 select-none">Sprint</label>
                  <select
                    value={editedTask.sprintId || ''}
                    onChange={handleSprintChange}
                    className="w-full px-2 py-1 bg-[#1C2326] text-white text-xs border border-white/5 focus:ring-0 focus:outline-none rounded cursor-pointer"
                  >
                    <option value="">Backlog</option>
                    {(sprints || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>

                {/* Due date */}
                <div>
                  <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-1 select-none">Due Cycle</label>
                  <div className="bg-[#1C2326] border border-white/5 rounded p-0.5">
                      <EditableField
                          value={editedTask.dueDate || ''}
                          onSave={(newDate) => handleUpdateField('dueDate', newDate)}
                          type="date"
                          textClassName="text-xs text-white px-2 py-1 cursor-pointer hover:bg-white/5 rounded text-center block"
                          inputClassName="text-xs p-0.5 rounded bg-black/40 border-none text-white text-center w-full focus:outline-none"
                          placeholder="No Due Date"
                      />
                  </div>
                </div>

                {/* Converter and derivation actions */}
                <div className="pt-2 border-t border-white/5 space-y-2">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500 block">Actions</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleConvertType}
                      className="w-full text-[9px] font-bold uppercase bg-[#1C2326] border border-white/5 hover:bg-[#2A3438] hover:text-white px-2 py-1 rounded transition-all cursor-pointer text-center"
                    >
                      Type 🔄
                    </button>

                    {onAddTask && (
                      <button
                        type="button"
                        onClick={handleCreateDerivation}
                        className={`w-full text-[9px] font-bold uppercase px-2 py-1 rounded transition-all cursor-pointer text-center ${
                          editedTask.taskType === 'bug' 
                            ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20' 
                            : 'bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20'
                        }`}
                      >
                        Derive ➕
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 animate-fade-in">
                {/* Reference No / ID */}
                <div>
                  <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-1 select-none">Reference ID</label>
                  <div className="bg-[#1C2326] border border-white/5 rounded p-0.5">
                      <EditableField
                          value={editedTask.referenceNo || ''}
                          onSave={(newRef) => handleUpdateField('referenceNo', newRef)}
                          textClassName="text-xs text-white px-2 py-1 cursor-pointer hover:bg-white/5 rounded text-center block"
                          inputClassName="text-xs p-0.5 rounded bg-black/40 border-none text-white text-center w-full focus:outline-none"
                          placeholder="Set Reference"
                      />
                  </div>
                </div>

                {/* Parent Link Option styled elegantly */}
                <div>
                  <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-1 select-none">Linked Parent Task</label>
                  {(() => {
                    const parentTask = (allTasks || []).find(t => t.id === editedTask.parentId);
                    return parentTask ? (
                      <div className="flex items-center justify-between gap-2 bg-[#1C2326] p-2 rounded border border-white/5 mb-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (projectId) {
                              navigate(`/project/${projectId}/task/${parentTask.id}`);
                            }
                          }}
                          className="min-w-0 text-left text-xs text-emerald-300 hover:text-emerald-400 font-medium truncate flex-grow cursor-pointer"
                        >
                          {parentTask.ticketId ? `[${parentTask.ticketId}] ` : ''}{parentTask.title}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateField('parentId', null)}
                          className="text-gray-500 hover:text-red-400 text-[10px] font-bold uppercase px-1 transition-all"
                          title="Remove Parent Link"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <select
                        value={editedTask.parentId || ''}
                        onChange={(e) => handleUpdateField('parentId', e.target.value || null)}
                        className="w-full px-2 py-1 bg-[#1C2326] text-white text-xs border border-white/5 focus:ring-0 focus:outline-none rounded cursor-pointer truncate"
                      >
                        <option value="">No parent task linked</option>
                        {(allTasks || [])
                          .filter(t => t.id !== editedTask.id)
                          .map(t => (
                            <option key={t.id} value={t.id}>
                              {t.ticketId ? `[${t.ticketId}] ` : ''}{t.title}
                            </option>
                          ))}
                      </select>
                    );
                  })()}
                </div>

                {/* Children lists */}
                <div>
                  {(() => {
                    const childTasks = (allTasks || []).filter(t => t.parentId === editedTask.id);
                    return (
                      <>
                        <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5 select-none">Child Tasks / Dependencies ({childTasks.length})</label>
                        {childTasks.length === 0 ? (
                          <div className="text-[10px] text-gray-500 bg-[#1C2326]/30 p-2.5 rounded text-center border border-dashed border-white/5 select-none">
                            No active child dependencies linked.
                          </div>
                        ) : (
                          <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar">
                            {childTasks.map(child => (
                              <div key={child.id} className="flex items-center justify-between gap-1.5 bg-[#1C2326] p-1.5 rounded border border-white/5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (projectId) {
                                      navigate(`/project/${projectId}/task/${child.id}`);
                                    }
                                  }}
                                  className="min-w-0 text-left text-[11px] text-blue-400 hover:text-blue-300 font-medium truncate flex-grow cursor-pointer"
                                >
                                  {child.ticketId ? `[${child.ticketId}] ` : ''}{child.title}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const childToUpdate = { ...child, parentId: null };
                                    onUpdateTask(childToUpdate);
                                  }}
                                  className="text-gray-500 hover:text-red-400 text-[10px] px-1 transition-all"
                                  title="Unlink dependency"
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>

                {/* Show Relationship Visualization option */}
                <div className="pt-2 border-t border-white/5 space-y-2">
                  <div className="flex items-center justify-between bg-black/10 p-2 rounded border border-white/5">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider select-none">Hierarchy Graph Map</span>
                    <button
                      type="button"
                      onClick={() => setShowVisualizer(!showVisualizer)}
                      className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase transition-all tracking-wider cursor-pointer ${
                        showVisualizer 
                          ? 'bg-blue-500/15 text-blue-400 border-blue-500/30' 
                          : 'bg-[#1C2326] text-gray-400 border-white/5 hover:bg-[#2A3438]'
                      }`}
                    >
                      {showVisualizer ? 'Active 🕸️' : 'Show 🕸️'}
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Node Tags sidebar category */}
          <div className="bg-white/[0.01] border border-white/5 rounded p-3 space-y-2">
            <div className="flex items-center gap-1.5">
                <TagIcon className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Node Tags</span>
            </div>
            <div className="relative bg-[#1C2326] p-2 rounded border border-white/5">
                <div className="flex flex-wrap gap-1 items-center">
                    {editedTask.tags.filter(tag => tag && !tag.startsWith('ticket:') && !tag.startsWith('type:') && !tag.startsWith('ref:')).map(tag => (
                        <span key={tag} className="flex items-center gap-1 text-[9px] bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/20">
                            {tag}
                            <button type="button" onClick={() => handleRemoveTag(tag)} className="text-emerald-500/50 hover:text-emerald-400 cursor-pointer">
                                <XIcon className="w-3 h-3"/>
                            </button>
                        </span>
                    ))}
                     <input 
                        type="text"
                        value={newTag}
                        onChange={handleNewTagChange}
                        onKeyDown={handleTagInputKeyDown}
                        onFocus={() => setIsTagInputFocused(true)}
                        onBlur={() => setTimeout(() => setIsTagInputFocused(false), 200)}
                        placeholder="+ Label..."
                        className="flex-grow px-1.5 py-0.5 text-xs bg-transparent focus:outline-none text-white placeholder-gray-600 font-medium"
                    />
                </div>
                 {isTagInputFocused && tagSuggestions.length > 0 && (
                  <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-[#1C2326] border border-white/10 rounded shadow-2xl max-h-40 overflow-y-auto custom-scrollbar overflow-hidden">
                      {tagSuggestions.map((tag, index) => (
                          <button 
                              type="button"
                              key={tag}
                              onClick={() => addTag(tag)}
                              onMouseEnter={() => setActiveSuggestionIndex(index)}
                              className={`w-full text-left px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider ${index === activeSuggestionIndex ? 'bg-emerald-500 text-black' : 'text-white hover:bg-white/5'} cursor-pointer`}
                          >
                              {tag}
                          </button>
                      ))}
                  </div>
                )}
            </div>
          </div>

          <div className="pt-1">
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2 bg-white text-black font-bold rounded hover:bg-gray-200 text-xs uppercase tracking-wider transition-all text-center block cursor-pointer"
            >
              Return Home
            </button>
          </div>

        </div>

      </div>
        </div>
      </div>
    </div>
  );
};
