import React, { useState, useEffect, FormEvent, useMemo } from 'react';
import { TaskPriority, Column, NewTaskData, User, Sprint, Project } from '../types';
import { RichTextEditor } from '../components/RichTextEditor';
import { 
  ArrowLeft, 
  Sparkles, 
  Bug, 
  CheckSquare, 
  Calendar, 
  User as UserIcon, 
  Layers, 
  Columns, 
  AlertCircle, 
  Loader2, 
  Plus, 
  X 
} from 'lucide-react';

interface CreateTaskPageProps {
  project: Project;
  onSubmit: (taskData: NewTaskData) => Promise<void>;
  onCancel: () => void;
  onAddSprint: (sprintData: Omit<Sprint, 'id' | 'projectId' | 'createdAt' | 'status' | 'isDefault'> & { isDefault?: boolean; }) => Promise<Sprint>;
  projectMembers?: User[];
}

export const CreateTaskPage: React.FC<CreateTaskPageProps> = ({ 
  project, 
  onSubmit, 
  onCancel, 
  onAddSprint,
  projectMembers = [] 
}) => {
  const columns = useMemo(() => {
    return Object.values(project?.board?.columns || {});
  }, [project]);

  const sprints = useMemo(() => {
    return project?.sprints || [];
  }, [project]);

  const [title, setTitle] = useState(() => localStorage.getItem('draft_page_task_title') || '');
  const [description, setDescription] = useState(() => localStorage.getItem('draft_page_task_description') || '');
  const [priority, setPriority] = useState<TaskPriority>(() => (localStorage.getItem('draft_page_task_priority') as TaskPriority) || TaskPriority.MEDIUM);
  const [columnId, setColumnId] = useState<string>(() => localStorage.getItem('draft_page_task_columnId') || columns[0]?.id || '');
  const [assigneeId, setAssigneeId] = useState<string>(() => localStorage.getItem('draft_page_task_assigneeId') || '');
  const [dueDate, setDueDate] = useState(() => localStorage.getItem('draft_page_task_dueDate') || '');
  const [taskType, setTaskType] = useState<'task' | 'bug'>(() => (localStorage.getItem('draft_page_task_taskType') as 'task' | 'bug') || 'task');

  const defaultSprintId = useMemo(() => {
    const defaultSprint = (sprints || []).find(s => s.isDefault);
    return defaultSprint ? defaultSprint.id : '';
  }, [sprints]);

  const [sprintId, setSprintId] = useState<string>(() => localStorage.getItem('draft_page_task_sprintId') || defaultSprintId);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  // Sprints create states
  const [showNewSprintForm, setShowNewSprintForm] = useState(false);
  const [newSprintName, setNewSprintName] = useState('');
  const [newSprintIsDefault, setNewSprintIsDefault] = useState(false);
  const [isCreatingSprint, setIsCreatingSprint] = useState(false);

  // Sync draft helper state
  useEffect(() => {
    localStorage.setItem('draft_page_task_title', title);
  }, [title]);

  useEffect(() => {
    localStorage.setItem('draft_page_task_description', description);
  }, [description]);

  useEffect(() => {
    localStorage.setItem('draft_page_task_priority', priority);
  }, [priority]);

  useEffect(() => {
    if (columnId) {
      localStorage.setItem('draft_page_task_columnId', columnId);
    }
  }, [columnId]);

  useEffect(() => {
    localStorage.setItem('draft_page_task_assigneeId', assigneeId);
  }, [assigneeId]);

  useEffect(() => {
    localStorage.setItem('draft_page_task_dueDate', dueDate);
  }, [dueDate]);

  useEffect(() => {
    localStorage.setItem('draft_page_task_taskType', taskType);
  }, [taskType]);

  useEffect(() => {
    localStorage.setItem('draft_page_task_sprintId', sprintId);
  }, [sprintId]);

  const clearDraft = () => {
    localStorage.removeItem('draft_page_task_title');
    localStorage.removeItem('draft_page_task_description');
    localStorage.removeItem('draft_page_task_priority');
    localStorage.removeItem('draft_page_task_columnId');
    localStorage.removeItem('draft_page_task_assigneeId');
    localStorage.removeItem('draft_page_task_dueDate');
    localStorage.removeItem('draft_page_task_taskType');
    localStorage.removeItem('draft_page_task_sprintId');
  };

  const handleCreateSprint = async () => {
    if (!newSprintName.trim()) return;
    setIsCreatingSprint(true);
    try {
      const newSprint = await onAddSprint({ 
        name: newSprintName.trim(), 
        goal: null, 
        startDate: null, 
        endDate: null,
        isDefault: newSprintIsDefault
      });
      setSprintId(newSprint.id);
      setShowNewSprintForm(false);
      setNewSprintName('');
      setNewSprintIsDefault(false);
    } catch (err) {
      console.error("Failed to create sprint:", err);
    } finally {
      setIsCreatingSprint(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !columnId) {
      setError('Please provide a title and select a targeted workflow column.');
      return;
    }
    setIsSaving(true);
    setError('');
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        priority,
        columnId,
        assigneeId: assigneeId || undefined,
        dueDate: dueDate || undefined,
        sprintId: sprintId || null,
        taskType,
      });
      clearDraft();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred while creating the task.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full py-4 px-2 sm:px-2">
      {/* Header breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-white/5">
        <div className="flex items-center gap-3">
          <button 
            type="button" 
            onClick={onCancel}
            className="p-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2 text-xs font-black text-emerald-500 uppercase tracking-widest mb-1">
              <span>{project?.name}</span>
              <span className="text-white/20">/</span>
              <span>Workspace Tasks</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Create New Workspace Node</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] font-mono text-gray-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Vite Core Engine Live
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Side Main Fields column (2 spans) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card Backing (Now flat and clean) */}
          <div className="space-y-6 w-full">
            
            {/* Task Type Switcher */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400 mb-2">Item Type</label>
              <div className="grid grid-cols-2 gap-3 max-w-sm">
                <button
                  type="button"
                  onClick={() => setTaskType('task')}
                  className={`flex items-center justify-center gap-2 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl border transition-all ${
                    taskType === 'task'
                      ? 'bg-white text-black border-white shadow-lg'
                      : 'bg-[#1C2326] text-gray-400 border-white/5 hover:border-white/10 hover:text-white'
                  }`}
                >
                  <CheckSquare className="w-4 h-4" />
                  Task
                </button>
                <button
                  type="button"
                  onClick={() => setTaskType('bug')}
                  className={`flex items-center justify-center gap-2 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl border transition-all ${
                    taskType === 'bug'
                      ? 'bg-red-500/10 text-red-500 border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.1)] font-extrabold'
                      : 'bg-[#1C2326] text-gray-400 border-white/5 hover:border-white/10 hover:text-white'
                  }`}
                >
                  <Bug className="w-4 h-4" />
                  Bug
                </button>
              </div>
            </div>

            {/* Title */}
            <div>
              <label htmlFor="title" className="block text-[10px] font-black uppercase tracking-wider text-gray-400 mb-2">Task Title</label>
              <input
                type="text"
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full px-4 py-3 border border-white/5 hover:border-white/10 focus:border-emerald-500 rounded-xl shadow-inner focus:outline-none focus:ring-0 bg-[#1C2326] text-white text-sm placeholder-gray-500 transition-all font-medium"
                placeholder="e.g., Synthesize dashboard metadata structures"
              />
            </div>

            {/* Description Editor */}
            <div>
              <label htmlFor="description" className="block text-[10px] font-black uppercase tracking-wider text-gray-400 mb-2">Detailed Specifications</label>
              <div className="rounded-xl overflow-hidden border border-white/5 bg-[#1C2326] ring-1 ring-white/5">
                <RichTextEditor
                  value={description}
                  onChange={setDescription}
                  placeholder="Inscribe specific requirements, steps, or code schemas..."
                />
              </div>
            </div>

          </div>
        </div>

        {/* Right Side Settings Column (1 span) */}
        <div className="space-y-6">
          <div className="bg-[#131C1B]/90 border border-white/5 rounded-2xl p-6 shadow-xl space-y-6">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 border-b border-white/5 pb-2">Node Parameters</h3>
            
            {/* Column select */}
            <div>
              <label htmlFor="column" className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-gray-400 mb-2">
                <Columns className="w-3.5 h-3.5 text-emerald-400" />
                Workflow Column
              </label>
              <select
                id="column"
                value={columnId}
                onChange={(e) => setColumnId(e.target.value)}
                className="w-full px-3 py-2.5 border border-white/5 hover:border-white/10 focus:border-emerald-500 rounded-xl bg-[#1C2326] text-white text-sm focus:outline-none"
              >
                {columns.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>

            {/* Priority select */}
            <div>
              <label htmlFor="priority" className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-gray-400 mb-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Task Priority
              </label>
              <select
                id="priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full px-3 py-2.5 border border-white/5 hover:border-white/10 focus:border-emerald-500 rounded-xl bg-[#1C2326] text-white text-sm focus:outline-none"
              >
                {Object.values(TaskPriority).map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            {/* Assignee select */}
            <div>
              <label htmlFor="assignee" className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-gray-400 mb-2">
                <UserIcon className="w-3.5 h-3.5 text-blue-400" />
                Assignee
              </label>
              <select
                id="assignee"
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full px-3 py-2.5 border border-white/5 hover:border-white/10 focus:border-emerald-500 rounded-xl bg-[#1C2326] text-white text-sm focus:outline-none"
              >
                <option value="">Unassigned</option>
                {projectMembers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>

            {/* Due date picker */}
            <div>
              <label htmlFor="dueDate" className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-gray-400 mb-2">
                <Calendar className="w-3.5 h-3.5 text-rose-400" />
                Target Due Date
              </label>
              <input
                type="date"
                id="dueDate"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2.5 border border-white/5 hover:border-white/10 focus:border-emerald-500 rounded-xl bg-[#1C2326] text-white text-sm focus:outline-none"
              />
            </div>

            {/* Sprint iteration select */}
            <div>
              <label htmlFor="sprint" className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-gray-400 mb-2">
                <Layers className="w-3.5 h-3.5 text-purple-400" />
                Sprint iteration
              </label>
              <select
                id="sprint"
                value={sprintId}
                onChange={(e) => {
                  if (e.target.value === 'new') {
                    setShowNewSprintForm(true);
                  } else {
                    setSprintId(e.target.value);
                    setShowNewSprintForm(false);
                  }
                }}
                className="w-full px-3 py-2.5 border border-white/5 hover:border-white/10 focus:border-emerald-500 rounded-xl bg-[#1C2326] text-white text-sm focus:outline-none"
              >
                <option value="">No Sprint</option>
                {(sprints || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                <option value="new" className="font-bold text-gray-300">Create New Sprint...</option>
              </select>
            </div>

            {/* Sprints modal inline creation */}
            {showNewSprintForm && (
              <div className="p-4 bg-white/5 border border-white/5 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400">Add Sprint</span>
                  <button type="button" onClick={() => setShowNewSprintForm(false)} className="p-1 text-gray-400 hover:text-white">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <input
                  id="new-sprint-name"
                  type="text"
                  value={newSprintName}
                  onChange={(e) => setNewSprintName(e.target.value)}
                  placeholder="e.g., Q3 Launch"
                  className="w-full px-3 py-2 border border-white/10 rounded-lg bg-[#1C2326] text-white text-xs text-medium focus:outline-none"
                />
                
                <div className="flex items-center gap-2 my-2">
                  <input
                    type="checkbox"
                    id="newSprintIsDefault"
                    checked={newSprintIsDefault}
                    onChange={(e) => setNewSprintIsDefault(e.target.checked)}
                    className="w-3.5 h-3.5 rounded bg-gray-800 border-gray-700 text-gray-500 focus:ring-0"
                  />
                  <label htmlFor="newSprintIsDefault" className="text-[10px] font-bold text-gray-500 uppercase tracking-widest cursor-pointer hover:text-gray-300 transition-colors">
                    Primary Sprints
                  </label>
                </div>

                <button 
                  type="button" 
                  onClick={handleCreateSprint} 
                  disabled={isCreatingSprint || !newSprintName.trim()} 
                  className="w-full py-2 bg-white text-black font-extrabold text-[10px] uppercase tracking-widest rounded-lg flex items-center justify-center gap-1.5 hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  {isCreatingSprint ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                  Confirm Sprint
                </button>
              </div>
            )}

          </div>

          {/* Error notifications */}
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl flex items-start gap-2 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Form action triggers */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button 
              type="button" 
              onClick={onCancel} 
              disabled={isSaving} 
              className="flex-1 py-3 text-center bg-[#131C1B] border border-white/5 text-gray-400 font-extrabold rounded-xl hover:text-white hover:bg-white/5 transition-all text-xs uppercase tracking-widest disabled:opacity-50"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={isSaving} 
              className="flex-1 py-3 bg-white text-black font-extrabold rounded-xl shadow-lg hover:bg-gray-200 transition-all text-xs uppercase tracking-widest disabled:bg-gray-500 disabled:text-gray-300 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {isSaving ? 'Creating...' : 'Create Node'}
            </button>
          </div>
        </div>

      </form>
    </div>
  );
};
