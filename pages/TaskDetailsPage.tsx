import React, { useState, useEffect, useCallback, FormEvent, useMemo, useRef } from 'react';
import { Task, Subtask, User, TaskPriority, Sprint, TaskHistory, NewTaskData, Column } from '../types';
import { generateSubtasks as generateSubtasksFromApi } from '../services/geminiService';
import { XIcon, BotMessageSquareIcon, LoaderCircleIcon, SparklesIcon, CheckSquareIcon, MessageSquareIcon, PlusIcon, UserIcon, TagIcon, TrashIcon, HistoryIcon, CopyIcon, CheckIcon, ArrowLeftIcon } from '../components/Icons';
import { UserAvatar } from '../components/UserAvatar';
import { useConfirmation } from '../App';
import { JsonSyntaxHighlighter } from '../components/JsonSyntaxHighlighter';
import { api } from '../services/api';
import { RichTextEditor } from '../components/RichTextEditor';

interface TaskDetailsPageProps {
  task: Task;
  currentUser: User;
  users: User[];
  projectMembers: User[];
  allProjectTags: string[];
  sprints: Sprint[];
  onlineUsers: Set<string>;
  onClose: () => void;
  onUpdateTask: (task: Task) => Promise<void>;
  onUpdateSubtask: (taskId: string, subtaskId: string, updates: Partial<Subtask>) => Promise<void>;
  onDeleteSubtask: (taskId: string, subtaskId: string) => Promise<void>;
  onAddSubtasks: (taskId: string, subtasks: Partial<Subtask>[]) => Promise<void>;
  onAddComment: (taskId: string, commentText: string) => Promise<void>;
  aiFeaturesEnabled: boolean;
  onAddTask?: (taskData: NewTaskData) => Promise<void>;
  columns?: Column[];
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
            onClick={handleCopy} 
            className={`p-1.5 rounded-md hover:bg-gray-700 transition-colors ${className}`}
            title="Copy to clipboard"
        >
            {copied ? <CheckIcon className="w-3.5 h-3.5 text-green-500" /> : <CopyIcon className="w-3.5 h-3.5 text-gray-400" />}
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

  // Sync external changes safely
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

  // Debounced auto-save effect
  useEffect(() => {
    if (autoSave && isEditing && currentValue !== lastSavedValueRef.current) {
      const timer = setTimeout(() => {
        const cleanedValue = isRichText || isTextArea ? currentValue.trim() : currentValue;
        triggerSave(cleanedValue);
      }, 1200); // 1.2s typing debounce
      return () => clearTimeout(timer);
    }
  }, [currentValue, autoSave, isEditing, isRichText, isTextArea]);

  // When edit is finished (blurred or clicking Save)
  const handleSave = async () => {
    const cleanedValue = isRichText || isTextArea ? currentValue.trim() : currentValue;
    if (cleanedValue !== lastSavedValueRef.current) {
      await triggerSave(cleanedValue);
    }
    // Call the finished callback when we actually stop editing
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
        <div className="space-y-2 mt-1">
          <RichTextEditor value={currentValue} onChange={setCurrentValue} placeholder={placeholder} />
          <div className="flex gap-2 justify-between items-center">
            {/* Save Status Indicator */}
            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest pl-1">
              {saveStatus === 'saving' && (
                <span className="text-amber-400 flex items-center gap-1.5 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  Saving changes...
                </span>
              )}
              {saveStatus === 'saved' && (
                <span className="text-emerald-400 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Saved
                </span>
              )}
            </div>

            <div className="flex gap-2 justify-end">
              <button 
                type="button"
                onClick={() => {
                  setCurrentValue(value);
                  setIsEditing(false);
                  setSaveStatus('idle');
                }} 
                className="px-3 py-1.5 text-xs font-bold uppercase text-gray-400 bg-white/5 border border-white/5 hover:bg-white/10 rounded-lg cursor-pointer transition-all"
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={handleSave} 
                className="px-3 py-1.5 text-xs font-bold uppercase bg-emerald-500 text-black hover:bg-emerald-400 rounded-lg cursor-pointer transition-all"
              >
                Close & Save
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
        ? <textarea {...commonProps} rows={4} /> 
        : <input type={type} {...commonProps} />;
  }
  
  if (isJsonContent(value)) {
      return (
          <div onClick={() => setIsEditing(true)} className="cursor-pointer group relative">
              <div className="absolute top-2 right-2 text-[10px] text-gray-500 opacity-0 group-hover:opacity-100 bg-[#0D1117] px-1 rounded border border-gray-800 z-10">Click to edit</div>
              <JsonSyntaxHighlighter data={value} />
          </div>
      );
  }

  if (isRichText) {
      if (!value) {
          return (
              <div 
                  onClick={() => setIsEditing(true)} 
                  className={`min-h-[24px] cursor-pointer hover:bg-white/5 rounded-xl p-4 -m-4 border border-transparent hover:border-white/10 ${textClassName}`}
              >
                  <span className="text-gray-500">{placeholder}</span>
              </div>
          );
      }
      return (
          <div 
              onClick={() => setIsEditing(true)} 
              className={`min-h-[24px] cursor-pointer hover:bg-white/5 rounded-xl p-4 -m-4 border border-transparent hover:border-white/10 ${textClassName}`}
          >
              <div 
                  className="ql-editor p-0 m-0 border-0 bg-transparent text-inherit"
                  dangerouslySetInnerHTML={{ __html: value }} 
              />
          </div>
      );
  }

  return <div onClick={() => setIsEditing(true)} className={`min-h-[24px] ${textClassName}`}>{value || <span className="text-gray-500">{placeholder}</span>}</div>;
}

const CommentText: React.FC<{ text: string, renderWithMentions: (text: string) => React.ReactNode }> = ({ text, renderWithMentions }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const lines = text.split('\n');
    const hasMoreThan15Lines = lines.length > 15;

    return (
        <div>
            <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">
                {renderWithMentions(
                    isExpanded || !hasMoreThan15Lines
                        ? text
                        : lines.slice(0, 15).join('\n') + ' ...'
                )}
            </p>
            {hasMoreThan15Lines && (
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    type="button"
                    className="mt-1.5 text-[9px] font-black uppercase tracking-wider block text-emerald-400 hover:text-emerald-300 hover:underline cursor-pointer"
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

    // Mentions logic
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
                    <span key={idx} className="font-extrabold text-emerald-400 bg-emerald-500/10 px-1 py-0.5 rounded border border-emerald-500/20">
                        @{matchedUser.name}
                    </span>
                );
            }
        }
        return part;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex border-b border-white/5 pb-2 text-[10px] font-black uppercase tracking-widest gap-6">
        <button 
          type="button"
          onClick={() => setActiveTab2('comments')} 
          className={`pb-2 border-b-2 transition-all ${activeTab === 'comments' ? 'border-emerald-500 text-white' : 'border-transparent text-gray-500 hover:text-white'}`}
        >
          Discussion ({task.comments?.length || 0})
        </button>
        <button 
          type="button"
          onClick={() => setActiveTab2('history')} 
          className={`pb-2 border-b-2 transition-all ${activeTab === 'history' ? 'border-emerald-500 text-white' : 'border-transparent text-gray-500 hover:text-white'}`}
        >
          Telemetry Log ({task.history?.length || 0})
        </button>
      </div>

      {activeTab === 'comments' ? (
        <div className="space-y-6">
          <div className="space-y-4 max-h-80 overflow-y-auto custom-scrollbar pr-2">
            {(!task.comments || task.comments.length === 0) ? (
              <p className="text-xs text-gray-500 py-4 text-center">No commentary injected on this node yet.</p>
            ) : (
              [...task.comments].sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()).map(c => {
                const commentUser = users.find(u => u.id === c.userId);
                return (
                  <div key={c.id} className="flex gap-3 items-start bg-white/[0.02] p-4 rounded-xl border border-white/5">
                    <UserAvatar 
                      user={commentUser} 
                      className="w-7 h-7 text-[9px]" 
                      isOnline={commentUser ? onlineUsers.has(commentUser.id) : false} 
                    />
                    <div className="flex-grow space-y-1">
                      <div className="flex justify-between items-center text-[10px] uppercase font-bold text-gray-400">
                        <span className="text-gray-300">{commentUser?.name || 'Inscriber'}</span>
                        <span className="text-gray-500 font-mono">{new Date(c.createdAt).toLocaleDateString()} {new Date(c.createdAt).toLocaleTimeString()}</span>
                      </div>
                      <CommentText text={c.text} renderWithMentions={renderWithMentions} />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <form onSubmit={handlePostComment} className="space-y-3 relative">
            <div className="relative">
                <textarea
                  ref={commentInputRef}
                  value={commentText}
                  onChange={handleTextChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Inscribe contribution... (use @ to summon members)"
                  rows={3}
                  className="w-full px-4 py-3 bg-[#1C2326] border border-white/5 hover:border-white/10 focus:border-emerald-500 rounded-xl focus:outline-none text-xs text-white placeholder-gray-500 leading-relaxed font-medium transition-all"
                />
                
                {showMentions && mentionSuggestions.length > 0 && (
                    <div className="absolute left-0 bottom-full mb-2 z-30 bg-[#1C2326] border border-white/10 rounded-xl shadow-2xl max-h-40 overflow-y-auto custom-scrollbar overflow-hidden w-64">
                        <div className="bg-black/40 px-3 py-1.5 border-b border-white/5 text-[8px] font-black text-gray-500 uppercase tracking-widest">
                            Workspace Members
                        </div>
                        {mentionSuggestions.map((member, index) => (
                            <button
                                key={member.id}
                                type="button"
                                onClick={() => handleMentionSelect(member)}
                                onMouseEnter={() => setActiveMentionIndex(index)}
                                className={`w-full flex items-center gap-2 px-3 py-2 text-left font-bold text-[10px] uppercase tracking-wider ${index === activeMentionIndex ? 'bg-emerald-500 text-black' : 'text-gray-300 hover:bg-white/5'}`}
                            >
                                <UserAvatar user={member} className="w-5 h-5 text-[8px]" isOnline={onlineUsers.has(member.id)} />
                                <div className="truncate">
                                    <div>{member.name}</div>
                                    <div className="text-[8px] opacity-60 lowercase">{member.email}</div>
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
                className="px-5 py-2.5 bg-white text-black text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-40"
              >
                Inscribe Commentary
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar pr-2">
          {(!task.history || task.history.length === 0) ? (
            <p className="text-xs text-gray-400 py-4 text-center">No telemetry traces logged.</p>
          ) : (
            task.history.map(h => (
              <div key={h.id} className="flex gap-2.5 items-center bg-white/[0.01] p-3 rounded-xl border border-white/5 text-xs text-gray-300">
                <UserAvatar user={h.user} className="w-5 h-5 text-[7px]" isOnline={h.user ? onlineUsers.has(h.user.id) : false} />
                <span className="font-bold text-gray-400 uppercase tracking-wide text-[10px]">{h.user?.name || 'Agent'}</span>
                <span className="text-gray-500 flex-grow">{h.changeDescription}</span>
                <span className="text-[9px] text-gray-600 font-mono flex-shrink-0">{new Date(h.createdAt).toLocaleDateString()}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export const TaskDetailsPage: React.FC<TaskDetailsPageProps> = ({ 
  task, currentUser, users, projectMembers, allProjectTags, sprints, onlineUsers, onClose, onUpdateTask, onUpdateSubtask, onDeleteSubtask, onAddSubtasks, onAddComment, aiFeaturesEnabled, onAddTask, columns 
}) => {
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
    
    // Add history item
    const conversationLog: TaskHistory = {
      id: `temp-h-conv-${Date.now()}`,
      user: currentUser,
      createdAt: new Date().toISOString(),
      changeDescription: `converted this item from ${editedTask.taskType === 'bug' ? 'Bug' : 'Task'} to ${nextType === 'bug' ? 'Bug' : 'Task'}`
    };
    updated.history = [conversationLog, ...(editedTask.history || [])];
    
    setEditedTask(updated);
    await onUpdateTask(updated);
    showToast(`Successfully converted to ${nextType === 'bug' ? 'Bug' : 'Task'}!`);
  };

  const handleCreateDerivation = async () => {
    if (!onAddTask) return;
    const targetType = editedTask.taskType === 'bug' ? 'task' : 'bug';
    
    const derivedTitle = `${targetType === 'bug' ? 'Bug' : 'Task'} derived from ${editedTask.ticketId}: ${editedTask.title.substring(0, 30)}`;
    const derivedDesc = `**References parent:** [${editedTask.ticketId}]\n\n**Parent Description:**\n${editedTask.description || 'None'}`;
    
    // Get correct column UUID
    const parentColumnId = columns?.find(c => c.taskIds.includes(editedTask.id))?.id || columns?.[0]?.id || '';
    if (!parentColumnId) {
      showToast('Error: Unable to find column to place derived item.');
      return;
    }

    const newObj: NewTaskData = {
      title: derivedTitle,
      description: derivedDesc,
      priority: editedTask.priority,
      columnId: parentColumnId,
      assigneeId: editedTask.assignee?.id || undefined,
      sprintId: editedTask.sprintId || null,
      taskType: targetType,
      referenceNo: editedTask.ticketId
    };
    
    try {
      await onAddTask(newObj);
      
      const linkLog: TaskHistory = {
        id: `temp-h-link-${Date.now()}`,
        user: currentUser,
        createdAt: new Date().toISOString(),
        changeDescription: `derived and linked related ${targetType === 'bug' ? 'Bug' : 'Task'} with reference identifier ${editedTask.ticketId}`
      };
      
      const updatedOrigin = {
        ...editedTask,
        history: [linkLog, ...(editedTask.history || [])]
      };
      setEditedTask(updatedOrigin);
      await onUpdateTask(updatedOrigin);
      
      showToast(`Created related ${targetType === 'bug' ? 'Bug' : 'Task'}!`);
    } catch (err) {
      console.error(err);
      showToast(`Failed to derive ${targetType}.`);
    }
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
        setAiError(err instanceof Error ? err.message : 'Neural link failure.');
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
    <div className="w-full py-4 px-2 sm:px-2 space-y-6">
      {/* Header breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3 pb-6 border-b border-white/5">
        <div className="flex items-center gap-3">
          <button 
            type="button" 
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center cursor-pointer"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2 text-xs font-black text-emerald-500 uppercase tracking-widest mb-1">
              <span>{editedTask.ticketId}</span>
              <span className="text-white/20">/</span>
              <span>Edit Details</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Workspace Node Context</h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {editedTask.taskType === 'bug' ? (
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/20 px-3 py-1 rounded-full animate-pulse select-none">
              Bug
            </span>
          ) : (
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full select-none">
              Task
            </span>
          )}
          {editedTask.referenceNo && (
            <span className="text-[10px] sm:text-xs font-mono font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 px-3 py-1 rounded-full">
              🔗 Ref: {editedTask.referenceNo}
            </span>
          )}
        </div>
      </div>

      {toastMessage && (
        <div className="bg-emerald-500 text-black font-black uppercase tracking-widest text-[9px] px-4 py-2 rounded-xl shadow-2xl max-w-max mx-auto animate-bounce">
          🎉 {toastMessage}
        </div>
      )}

      {/* Main Grid View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left column (2 spans) - Contains content controls */}
        <div className="lg:col-span-2 space-y-6">
          <div className="space-y-8 w-full">
            
            {/* Header / Title area inside card */}
            <div className="flex justify-between items-start">
              <div className="flex-grow mr-4 group flex items-start gap-3 w-full">
                <div className="p-3 rounded-2xl bg-white/5 text-emerald-400 mt-1 flex-shrink-0">
                  <CheckSquareIcon className="w-6 h-6" />
                </div>
                <div className="flex-grow min-w-0">
                  <span className="text-[10px] font-mono font-bold uppercase text-gray-500 mb-1 block">Title (Click to Edit)</span>
                  <EditableField 
                      value={editedTask.title}
                      onSave={(newTitle) => handleUpdateField('title', newTitle)}
                      textClassName="text-2xl font-black w-full cursor-pointer hover:text-emerald-400 rounded transition-colors text-white tracking-tight break-words block"
                      inputClassName="text-2xl font-black p-2 rounded border-2 border-emerald-500/20 bg-black/40 focus:outline-none text-white w-full"
                      placeholder="Task Title"
                  />
                </div>
                <CopyButton text={`${editedTask.ticketId}: ${editedTask.title}`} className="opacity-0 group-hover:opacity-100 mt-2 flex-shrink-0" />
              </div>
            </div>

            {/* Injected metadata */}
            <div className="flex flex-wrap items-center gap-6 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 bg-white/5 p-4 rounded-xl border border-white/5">
              <div className="flex items-center gap-2.5">
                  <UserIcon className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Origin:</span>
                  {taskCreator ? (
                      <div className="flex items-center gap-2 bg-black/20 px-2 py-1 rounded-lg">
                          <UserAvatar user={taskCreator} className="w-5 h-5 text-[8px]" isOnline={onlineUsers.has(taskCreator.id)} />
                          <span className="text-white">{taskCreator.name}</span>
                      </div>
                  ) : (
                      <span className="text-white">External Node</span>
                  )}
              </div>
              <div className="flex items-center gap-2.5">
                  <HistoryIcon className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Injected:</span>
                  <span className="text-white font-mono">{new Date(task.createdAt).toLocaleDateString()} {new Date(task.createdAt).toLocaleTimeString()}</span>
              </div>
            </div>

            {/* Contextual description */}
            <section className="space-y-3">
              <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                  <MessageSquareIcon className="w-4 h-4 text-emerald-500" />
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Contextual Data (Click to Edit)</h4>
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
                          await onAddComment(task.id, `📝 Updated the description to: "${preview}"`);
                        } catch (err) {
                          console.warn("Could not post auto-save description comment:", err);
                        }
                      }}
                      isRichText
                      autoSave
                      textClassName="text-sm text-gray-300 w-full cursor-pointer hover:bg-white/5 rounded-xl p-4 -m-4 min-h-[100px] leading-relaxed border border-transparent hover:border-white/10 block bg-[#1C2326]/40 border-white/5"
                      inputClassName="text-sm p-4 rounded-xl border-2 border-emerald-500/20 bg-[#1C2326] focus:outline-none text-white w-full shadow-inner"
                      placeholder="No context provided. Click to synthesize description..."
                  />
                  {!isJsonContent(editedTask.description) && (
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <CopyButton text={editedTask.description} className="bg-black/60 p-1.5 rounded-lg" />
                      </div>
                  )}
              </div>
            </section>

            {/* Sub-Nodes list */}
            <section className="space-y-4 pt-6 border-t border-white/5">
              <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                      <CheckSquareIcon className="w-4 h-4 text-emerald-500" />
                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Sub-Nodes</h4>
                  </div>
                  {totalSubtasks > 0 && (
                      <div className="flex items-center gap-3">
                          <span className="text-[10px] font-mono text-emerald-500/70">{Math.round(progress)}% Complete</span>
                          <div className="w-32 bg-white/5 rounded-full h-1.5 overflow-hidden">
                              <div className="bg-emerald-500 h-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
                          </div>
                      </div>
                  )}
              </div>

              <div className="space-y-3">
                {(editedTask.subtasks || []).map(subtask => {
                  return (
                      <div key={subtask.id} className="flex items-center gap-4 bg-white/5 p-3 rounded-2xl group border border-white/5 hover:border-white/10 transition-all">
                          <input
                              type="checkbox"
                              checked={subtask.completed}
                              onChange={() => handleSubtaskToggle(subtask.id)}
                              className="w-5 h-5 rounded-lg border-2 border-white/10 bg-black/40 text-emerald-500 focus:ring-emerald-500/50 flex-shrink-0 cursor-pointer"
                          />
                          <div className="flex-grow min-w-0">
                               <div className="flex items-center gap-2 mb-0.5">
                                  <span className="text-[9px] font-mono text-emerald-500/40 font-bold uppercase tracking-tight">{subtask.ticketId}</span>
                               </div>
                               <EditableField
                                  value={subtask.title}
                                  onSave={(newTitle) => handleSubtaskTitleChange(subtask.id, newTitle)}
                                  textClassName={`text-sm font-medium ${subtask.completed ? 'line-through text-gray-600' : 'text-gray-200'} truncate block`}
                                  inputClassName="text-sm p-1 rounded bg-[#1C2326] border border-white/5 focus:border-emerald-500/30 focus:outline-none text-white w-full"
                                  placeholder="Edit sub-node..."
                              />
                          </div>
                          <div className="ml-auto flex items-center gap-2.5 opacity-40 group-hover:opacity-100 transition-opacity flex-shrink-0">
                              <select
                                  value={subtask.assigneeId || ''}
                                  onChange={(e) => handleSubtaskAssigneeChange(subtask.id, e.target.value)}
                                  className="text-[9px] font-black uppercase tracking-widest bg-black/40 border border-white/5 text-white rounded-lg py-1 px-2 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 cursor-pointer"
                              >
                                  <option value="">Auto</option>
                                  {projectMembers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                              </select>
                              
                              <UserAvatar 
                                  user={subtask.assignee}
                                  className="w-6 h-6 text-[8px] flex-shrink-0" 
                                  isOnline={subtask.assignee ? onlineUsers.has(subtask.assignee.id) : false}
                              />
                              
                              <button 
                                  type="button"
                                  onClick={() => handleDeleteSubtask(subtask.id)}
                                  className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-400/10 transition-all flex-shrink-0 cursor-pointer"
                              >
                                  <TrashIcon className="w-3.5 h-3.5" />
                              </button>
                          </div>
                      </div>
                  )
                })}
              </div>

              <form onSubmit={handleAddManualSubtask} className="flex flex-wrap items-center gap-3 bg-black/20 p-2 rounded-2xl border border-white/5">
                  <input 
                      type="text"
                      value={newSubtaskTitle}
                      onChange={(e) => setNewSubtaskTitle(e.target.value)}
                      placeholder="New Sub-Node Objective..."
                      className="flex-grow px-4 py-2 bg-transparent text-sm text-white focus:outline-none"
                  />
                  <div className="flex items-center gap-2">
                      <select
                          value={newSubtaskAssigneeId}
                          onChange={(e) => setNewSubtaskAssigneeId(e.target.value)}
                          className="px-3 py-1.5 bg-white/5 border border-white/5 rounded-xl text-[10px] font-bold uppercase text-gray-400 focus:text-white transition-colors cursor-pointer"
                      >
                          <option value="">Unassigned</option>
                          {projectMembers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                      <button type="submit" disabled={!newSubtaskTitle.trim()} className="p-2.5 bg-white text-black rounded-xl hover:bg-gray-200 transition-all disabled:opacity-30 cursor-pointer">
                          <PlusIcon className="w-4 h-4"/>
                      </button>
                  </div>
              </form>

              {aiFeaturesEnabled && (
                  <div className="bg-emerald-500/5 border border-emerald-500/10 p-6 rounded-2xl mt-4 relative overflow-hidden group/ai">
                      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover/ai:opacity-10 transition-opacity">
                          <SparklesIcon className="w-16 h-16 text-emerald-400" />
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                          <SparklesIcon className="w-4 h-4 text-emerald-400 animate-pulse"/>
                          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">Neural Decomposition</h4>
                      </div>
                      <p className="text-xs text-emerald-400/60 mb-4 leading-relaxed font-medium">
                          AI will analyze task complexity and synthesize a hierarchy of granular sub-nodes.
                      </p>
                      <button
                          type="button"
                          onClick={handleGenerateSubtasks}
                          disabled={aiState === 'loading'}
                          className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-emerald-500 text-black font-black uppercase tracking-[0.2em] rounded-xl shadow-xl shadow-emerald-500/10 hover:bg-emerald-400 transition-all text-[10px] disabled:opacity-50 cursor-pointer"
                      >
                      {aiState === 'loading' ? (
                          <>
                              <LoaderCircleIcon className="w-4 h-4 animate-spin" />
                              Generating Mesh...
                          </>
                      ) : (
                          <>
                              <BotMessageSquareIcon className="w-4 h-4" />
                              Synthesize Sub-Nodes
                          </>
                      )}
                      </button>
                      {aiState === 'error' && <p className="text-[10px] text-red-400 font-bold uppercase mt-3 tracking-widest text-center">{aiError}</p>}
                  </div>
              )}
            </section>

          </div>

          {/* Context Activity Logs and Comment Thread Section */}
          <div className="bg-[#131C1B]/90 border border-white/5 rounded-2xl p-6 shadow-xl">
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

        {/* Right Parameters Column */}
        <div className="space-y-6">
          <div className="bg-[#131C1B]/90 border border-white/5 rounded-2xl p-6 shadow-xl space-y-6">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 border-b border-white/5 pb-2">Node Parameters</h3>
            
            {/* Assignee Selection */}
            <div>
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-2 block">Assignee</label>
              <div className="relative">
                  <select
                    value={editedTask.assignee?.id || ''}
                    onChange={handleAssigneeChange}
                    className="w-full pl-3 pr-10 py-2.5 border border-white/5 rounded-xl bg-[#1C2326] text-white text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500/50 appearance-none font-bold cursor-pointer"
                  >
                    <option value="">Unassigned</option>
                    {projectMembers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                       <UserIcon className="w-4 h-4" />
                  </div>
              </div>
            </div>

            {/* Priority Selection */}
            <div>
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-2 block">Priority</label>
              <select
                value={editedTask.priority}
                onChange={handlePriorityChange}
                className="w-full px-3 py-2.5 border border-white/5 rounded-xl bg-[#1C2326] text-white text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500/50 font-bold uppercase tracking-widest cursor-pointer"
              >
                {Object.values(TaskPriority).map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            {/* Active Sprint Selection */}
            <div>
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-2 block">Active Sprint</label>
              <select
                value={editedTask.sprintId || ''}
                onChange={handleSprintChange}
                className="w-full px-3 py-2.5 border border-white/5 rounded-xl bg-[#1C2326] text-white text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500/50 font-bold cursor-pointer"
              >
                <option value="">Backlog</option>
                {(sprints || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            {/* Due date picker */}
            <div>
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-2 block">Due Cycle</label>
              <div className="bg-[#1C2326] border border-white/5 rounded-xl p-0.5">
                  <EditableField
                      value={editedTask.dueDate || ''}
                      onSave={(newDate) => handleUpdateField('dueDate', newDate)}
                      type="date"
                      textClassName="text-xs text-white font-bold text-center px-2 py-2.5 cursor-pointer hover:bg-white/5 rounded-lg text-center mx-auto block"
                      inputClassName="text-xs p-2 rounded bg-black/40 border border-white/5 focus:border-emerald-500/30 focus:outline-none text-white text-center w-full"
                      placeholder="Set Due Date"
                  />
              </div>
            </div>

            {/* Reference identifier */}
            <div>
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-2 block">Reference No</label>
              <div className="bg-[#1C2326] border border-white/5 rounded-xl p-0.5">
                  <EditableField
                      value={editedTask.referenceNo || ''}
                      onSave={(newRef) => handleUpdateField('referenceNo', newRef)}
                      textClassName="text-xs text-white font-bold text-center px-2 py-2.5 cursor-pointer hover:bg-white/5 rounded-lg text-center mx-auto block"
                      inputClassName="text-xs p-2 rounded bg-[#1C2326] border border-white/5 focus:border-emerald-500/30 focus:outline-none text-white text-center w-full"
                      placeholder="Set Ref ID"
                  />
              </div>
            </div>

            {/* Transition Actions */}
            <div className="pt-4 border-t border-white/5 space-y-3">
              <span className="text-[9px] font-black uppercase tracking-widest text-gray-500 block">Mutate Context</span>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleConvertType}
                  className="w-full text-[9px] font-black uppercase bg-[#1C2326] border border-white/5 hover:bg-[#2A3438] hover:text-white hover:border-white/15 px-3 py-2.5 rounded-xl transition-all cursor-pointer text-center"
                >
                  🔄 Convert Type
                </button>

                {onAddTask && (
                  <button
                    type="button"
                    onClick={handleCreateDerivation}
                    className={`w-full text-[9px] font-black uppercase px-3 py-2.5 rounded-xl transition-all cursor-pointer text-center ${
                      editedTask.taskType === 'bug' 
                        ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 animate-pulse' 
                        : 'bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20'
                    }`}
                  >
                    ➕ Derive Link
                  </button>
                )}
              </div>
            </div>

          </div>

          {/* Node Tags */}
          <div className="bg-[#131C1B]/90 border border-white/5 rounded-2xl p-6 shadow-xl space-y-3">
            <div className="flex items-center gap-2">
                <TagIcon className="w-4 h-4 text-emerald-500" />
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Node Tags</h4>
            </div>
            <div className="relative bg-[#1C2326] p-4 rounded-xl border border-white/5">
                <div className="flex flex-wrap gap-2 items-center">
                    {editedTask.tags.filter(tag => tag && !tag.startsWith('ticket:') && !tag.startsWith('type:') && !tag.startsWith('ref:')).map(tag => (
                        <span key={tag} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-lg border border-emerald-500/20 transition-all hover:bg-emerald-500/20">
                            {tag}
                            <button type="button" onClick={() => handleRemoveTag(tag)} className="text-emerald-500/50 hover:text-emerald-400 cursor-pointer">
                                <XIcon className="w-3.5 h-3.5"/>
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
                        placeholder="+ Add Label..."
                        className="flex-grow px-2 py-1 text-xs font-bold uppercase tracking-widest bg-transparent focus:outline-none text-white placeholder-gray-600"
                    />
                </div>
                 {isTagInputFocused && tagSuggestions.length > 0 && (
                  <div className="absolute z-20 left-0 right-0 top-full mt-2 bg-[#1C2326] border border-white/10 rounded-xl shadow-2xl max-h-40 overflow-y-auto custom-scrollbar overflow-hidden">
                      {tagSuggestions.map((tag, index) => (
                          <button 
                              type="button"
                              key={tag}
                              onClick={() => addTag(tag)}
                              onMouseEnter={() => setActiveSuggestionIndex(index)}
                              className={`w-full text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest ${index === activeSuggestionIndex ? 'bg-emerald-500 text-black' : 'text-white hover:bg-white/5'} cursor-pointer`}
                          >
                              {tag}
                          </button>
                      ))}
                  </div>
                )}
            </div>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 bg-white text-black font-extrabold rounded-xl hover:bg-gray-200 text-xs uppercase tracking-widest transition-all shadow-inner text-center block cursor-pointer"
            >
              Return to Project Board
            </button>
          </div>

        </div>

      </div>

    </div>
  );
};
