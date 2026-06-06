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
    <div className="w-full h-full flex flex-col overflow-hidden bg-[#0D1112]">
      {/* Header breadcrumbs */}
      <header className="h-14 min-h-[56px] max-h-14 flex-shrink-0 border-b border-white/5 bg-[#0E1314]/85 backdrop-blur-xl px-6 flex items-center justify-between sticky top-0 z-35">
        <div className="flex items-center gap-3">
          <button 
            type="button" 
            onClick={onCancel}
            className="p-1 px-2 text-xs rounded bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-all flex items-center gap-1 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Back</span>
          </button>
          
          <div className="flex items-center gap-1.5 text-xs text-gray-400 font-semibold truncate whitespace-nowrap">
            <span className="text-gray-500 truncate">{project?.name}</span>
            <span className="text-gray-700">/</span>
            <span className="text-white bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 text-[11px] font-bold truncate">Workspace Tasks</span>
            <span className="text-gray-700">/</span>
            <span className="text-gray-400 text-[11px] uppercase tracking-widest">Create Item</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/5 border border-emerald-500/10 rounded text-[10px] font-mono text-emerald-450">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Active Sync</span>
          </span>
        </div>
      </header>

      {/* Main Page scrollable body */}
      <div className="flex-grow overflow-y-auto custom-scrollbar p-6">
        <div className="max-w-6xl mx-auto w-full">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-10 gap-4">
        
        {/* Left Side Main Fields column (70% - 7 spans) */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* Task Type Switcher */}
          <div>
            <label className="block text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-1.5 select-none">Item Type</label>
            <div className="flex gap-2 max-w-xs">
              <button
                type="button"
                onClick={() => setTaskType('task')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded border transition-all cursor-pointer ${
                  taskType === 'task'
                    ? 'bg-white text-black border-white'
                    : 'bg-[#1C2326] text-gray-450 border-white/5 hover:border-white/10 hover:text-white'
                }`}
              >
                <CheckSquare className="w-3.5 h-3.5" />
                Task
              </button>
              <button
                type="button"
                onClick={() => setTaskType('bug')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded border transition-all cursor-pointer ${
                  taskType === 'bug'
                    ? 'bg-red-500/10 text-red-400 border-red-500/25 shadow-[0_0_12px_rgba(239,68,68,0.08)]'
                    : 'bg-[#1C2326] text-gray-450 border-white/5 hover:border-white/10 hover:text-white'
                }`}
              >
                <Bug className="w-3.5 h-3.5" />
                Bug
              </button>
            </div>
          </div>

          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-1 select-none">Task Title</label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full px-3 py-1.5 border border-white/5 hover:border-white/10 focus:border-emerald-500/30 rounded focus:outline-none bg-[#1C2326] text-white text-xs placeholder-gray-500 transition-all font-medium"
              placeholder="e.g., Refactor subscription gateway integration"
            />
          </div>

          {/* Description Editor */}
          <div>
            <label htmlFor="description" className="block text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-1 select-none">Detailed Specifications</label>
            <div className="rounded border border-white/5 bg-[#1C2326] overflow-hidden">
              <RichTextEditor
                value={description}
                onChange={setDescription}
                placeholder="Inscribe requirements, constraints, or schemas..."
              />
            </div>
          </div>
        </div>

        {/* Right Side Settings Column (30% - 3 spans) */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-[#0F1517] border border-white/5 rounded-lg p-4 space-y-4 shadow-sm">
            <h3 className="text-[9px] font-bold uppercase tracking-wider text-gray-400 border-b border-white/5 pb-1 select-none">Contextual parameters</h3>
            
            {/* Column select */}
            <div>
              <label htmlFor="column" className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-1 select-none">
                <Columns className="w-3 h-3 text-emerald-400" />
                Workflow Column
              </label>
              <select
                id="column"
                value={columnId}
                onChange={(e) => setColumnId(e.target.value)}
                className="w-full px-2 py-1.5 border border-white/5 rounded bg-[#1C2326] text-white text-xs focus:outline-none cursor-pointer"
              >
                {columns.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>

            {/* Priority select */}
            <div>
              <label htmlFor="priority" className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-1 select-none">
                <Sparkles className="w-3 h-3 text-amber-400" />
                Priority
              </label>
              <select
                id="priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full px-2 py-1.5 border border-white/5 rounded bg-[#1C2326] text-white text-xs focus:outline-none cursor-pointer uppercase font-mono text-[10px]"
              >
                {Object.values(TaskPriority).map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            {/* Assignee select */}
            <div>
              <label htmlFor="assignee" className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-1 select-none">
                <UserIcon className="w-3 h-3 text-blue-400" />
                Assignee
              </label>
              <select
                id="assignee"
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full px-2 py-1.5 border border-white/5 rounded bg-[#1C2326] text-white text-xs focus:outline-none cursor-pointer"
              >
                <option value="">Unassigned</option>
                {projectMembers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>

            {/* Due date picker */}
            <div>
              <label htmlFor="dueDate" className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-1 select-none">
                <Calendar className="w-3 h-3 text-rose-450" />
                Due Date
              </label>
              <input
                type="date"
                id="dueDate"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-2 py-1.5 border border-white/5 rounded bg-[#1C2326] text-white text-xs focus:outline-none cursor-pointer"
              />
            </div>

            {/* Sprint iteration select */}
            <div>
              <label htmlFor="sprint" className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-1 select-none">
                <Layers className="w-3 h-3 text-purple-405" />
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
                className="w-full px-2 py-1.5 border border-white/5 rounded bg-[#1C2326] text-white text-xs focus:outline-none cursor-pointer"
              >
                <option value="">No Sprint</option>
                {(sprints || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                <option value="new" className="font-bold text-gray-305">Create New Sprint...</option>
              </select>
            </div>

            {/* Sprints inline creation */}
            {showNewSprintForm && (
              <div className="p-3 bg-white/[0.02] border border-white/5 rounded space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[8px] font-bold uppercase tracking-widest text-emerald-400">Add Sprint</span>
                  <button type="button" onClick={() => setShowNewSprintForm(false)} className="p-0.5 text-gray-500 hover:text-white cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <input
                  id="new-sprint-name"
                  type="text"
                  value={newSprintName}
                  onChange={(e) => setNewSprintName(e.target.value)}
                  placeholder="e.g., Sprint 9"
                  className="w-full px-2 py-1 border border-white/5 rounded bg-[#1C2326] text-white text-xs focus:outline-none"
                />
                
                <div className="flex items-center gap-1.5 my-1">
                  <input
                    type="checkbox"
                    id="newSprintIsDefault"
                    checked={newSprintIsDefault}
                    onChange={(e) => setNewSprintIsDefault(e.target.checked)}
                    className="w-3 h-3 rounded bg-[#1C2326] border-white/5 text-emerald-555 focus:ring-0 cursor-pointer"
                  />
                  <label htmlFor="newSprintIsDefault" className="text-[8px] font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-300 transition-colors">
                    Primary Sprints
                  </label>
                </div>

                <button 
                  type="button" 
                  onClick={handleCreateSprint} 
                  disabled={isCreatingSprint || !newSprintName.trim()} 
                  className="w-full py-1.5 bg-white text-black font-bold text-[9px] uppercase tracking-wider rounded flex items-center justify-center gap-1 hover:bg-gray-200 transition-colors disabled:opacity-40 cursor-pointer"
                >
                  {isCreatingSprint ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                  Confirm Sprint
                </button>
              </div>
            )}

          </div>

          {/* Error notifications */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/15 text-red-400 rounded flex items-start gap-1.5 text-[10px] font-semibold">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Form action triggers inline */}
          <div className="flex gap-2 pt-1">
            <button 
              type="button" 
              onClick={onCancel} 
              disabled={isSaving} 
              className="flex-1 py-1.5 text-center bg-[#1C2326] border border-white/5 text-gray-400 font-bold rounded hover:text-white hover:bg-white/5 transition-all text-[9.5px] uppercase tracking-wider disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={isSaving || !title.trim()} 
              className="flex-1 py-1.5 bg-white text-black font-bold rounded hover:bg-gray-200 transition-all text-[9.5px] uppercase tracking-wider disabled:opacity-40 flex items-center justify-center gap-1 cursor-pointer"
            >
              {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              <span>{isSaving ? 'Creating...' : 'Create Item'}</span>
            </button>
          </div>
        </div>

      </form>
        </div>
      </div>
    </div>
  );
};
