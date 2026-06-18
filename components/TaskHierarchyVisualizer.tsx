import React, { useState, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  GitCommit, 
  GitMerge, 
  ChevronRight, 
  ChevronDown, 
  Plus, 
  Bug, 
  CheckSquare, 
  Network, 
  User as UserIcon, 
  Clock, 
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Layers,
  ArrowUpRight
} from 'lucide-react';
import { Task, NewTaskData, User, TaskPriority } from '../types';
import { UserAvatar } from './UserAvatar';

interface TaskHierarchyVisualizerProps {
  currentTask: Task;
  allTasks: Task[];
  projectMembers: User[];
  currentColumnId: string;
  sprintId: string | null | undefined;
  onSelectTask: (task: Task) => void;
  onAddTask: (taskData: NewTaskData) => Promise<void>;
  onOpenFullCreatePage?: () => void;
}

export const TaskHierarchyVisualizer: React.FC<TaskHierarchyVisualizerProps> = ({
  currentTask,
  allTasks,
  projectMembers,
  currentColumnId,
  sprintId,
  onSelectTask,
  onAddTask,
  onOpenFullCreatePage,
}) => {
  const [isAddingChild, setIsAddingChild] = useState(true);
  const [showGraphMap, setShowGraphMap] = useState(false);
  const [childType, setChildType] = useState<'task' | 'bug'>('task');
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState<TaskPriority>(TaskPriority.MEDIUM);
  const [newDescription, setNewDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [childAssigneeId, setChildAssigneeId] = useState('');

  // 1. Trace Ancestors (Current -> Parent -> Grandparent...)
  const getAncestors = (): Task[] => {
    const list: Task[] = [];
    let current = currentTask;
    while (current && current.parentId) {
      const parent = allTasks.find(t => t.id === current.parentId);
      if (parent) {
        list.unshift(parent); // oldest first
        current = parent;
      } else {
        break;
      }
    }
    return list;
  };

  // 2. Find Direct Children
  const getChildren = (): Task[] => {
    return allTasks.filter(t => t.parentId === currentTask.id);
  };

  const ancestors = getAncestors();
  const children = getChildren();

  // Handle Quick Add Child Node
  const handleCreateChild = async (e: FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setIsSubmitting(true);
    try {
      await onAddTask({
        title: newTitle.trim(),
        description: newDescription.trim() || `Child node spawned from parent ${currentTask.ticketId}`,
        priority: newPriority,
        columnId: currentColumnId,
        taskType: childType,
        parentId: currentTask.id,
        sprintId: sprintId,
        assigneeId: childAssigneeId || undefined,
      });
      setNewTitle('');
      setNewDescription('');
      setNewPriority(TaskPriority.MEDIUM);
      setChildAssigneeId('');
      setIsAddingChild(false);
    } catch (err) {
      console.error("Failed to spawn child node:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div id="hierarchy-visualizer-container" className="bg-[#131C1B]/60 border border-white/5 rounded-xl p-5 space-y-6 shadow-2xl backdrop-blur-md">
      {/* Visualizer Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <div className="flex items-center gap-2">
          <Network className="w-5 h-5 text-emerald-400 animate-pulse" />
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-wider">Spawn Dependency Modules</h3>
            <p className="text-[10px] text-gray-400 font-mono">Spawn recursive nested sub-tasks or sub-bugs directly connected to this node</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onOpenFullCreatePage && (
            <button
              type="button"
              onClick={onOpenFullCreatePage}
              className="text-[9px] font-bold px-2 py-1 rounded-md border border-white/10 bg-white/5 text-gray-300 hover:text-white hover:bg-white/10 transition-all font-mono uppercase cursor-pointer"
            >
              Open Full Form ↗
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowGraphMap(!showGraphMap)}
            className={`text-[9px] font-bold px-2 py-1 rounded-md border uppercase transition-all tracking-wider cursor-pointer font-mono ${
              showGraphMap
                ? 'bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/15'
                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/15'
            }`}
          >
            {showGraphMap ? 'Hide Node Graph Map 🕸️' : 'Show Node Graph Map 🕸️'}
          </button>
        </div>
      </div>

      {/* Form to Create Child Node (Shown directly by default for high-speed use) */}
      <div className="bg-black/20 rounded-lg p-4 border border-white/5 space-y-4">
        <div className="flex items-center justify-between border-b border-white/5 pb-1.5 mb-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-gray-400">Spawn Target Type:</span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setChildType('task')}
                className={`text-[9px] font-bold px-2.5 py-0.5 rounded border transition-all uppercase cursor-pointer ${
                  childType === 'task'
                    ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                    : 'bg-transparent text-gray-500 border-transparent hover:text-gray-300'
                }`}
              >
                Nested Task 📋
              </button>
              <button
                type="button"
                onClick={() => setChildType('bug')}
                className={`text-[9px] font-bold px-2.5 py-0.5 rounded border transition-all uppercase cursor-pointer ${
                  childType === 'bug'
                    ? 'bg-red-500/10 text-red-400 border-red-500/20'
                    : 'bg-transparent text-gray-500 border-transparent hover:text-gray-300'
                }`}
              >
                Nested Bug 🐛
              </button>
            </div>
          </div>
          <span className="text-[9px] text-gray-500 font-mono">Directly linked as child of {currentTask.ticketId}</span>
        </div>

        <form onSubmit={handleCreateChild} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div>
              <label htmlFor="child-title-input" className="block text-[10px] font-mono uppercase font-bold text-gray-400 mb-1">Node Title *</label>
              <input 
                id="child-title-input"
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder={childType === 'bug' ? "e.g., Infinite recursion stack overflow..." : "e.g., Form schema validation..."}
                className="w-full bg-[#1C2326] border border-white/15 focus:border-emerald-500 focus:outline-none px-3 py-1.5 text-xs text-white rounded font-medium"
              />
            </div>
            <div>
              <label htmlFor="child-desc-input" className="block text-[10px] font-mono uppercase font-bold text-gray-400 mb-1">Scope description</label>
              <textarea 
                id="child-desc-input"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Enter key functional deliverables or reproduction steps..."
                rows={2}
                className="w-full bg-[#1C2326] border border-white/15 focus:border-emerald-500 focus:outline-none px-3 py-1.5 text-xs text-white rounded font-medium resize-none"
              />
            </div>
          </div>

          <div className="space-y-3 flex flex-col justify-between">
            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label htmlFor="child-priority-select" className="block text-[10px] font-mono uppercase font-bold text-gray-400 mb-1">Priority Rank</label>
                <select
                  id="child-priority-select"
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value as TaskPriority)}
                  className="w-full bg-[#1C2326] border border-white/15 text-white text-xs rounded px-3 py-1.5 focus:border-emerald-500 cursor-pointer"
                >
                  <option value={TaskPriority.LOW}>Low</option>
                  <option value={TaskPriority.MEDIUM}>Medium</option>
                  <option value={TaskPriority.HIGH}>High</option>
                  <option value={TaskPriority.URGENT}>Urgent</option>
                </select>
              </div>
              <div>
                <label htmlFor="child-assignee-select" className="block text-[10px] font-mono uppercase font-bold text-gray-400 mb-1">Linked Operator</label>
                <select
                  id="child-assignee-select"
                  value={childAssigneeId}
                  onChange={(e) => setChildAssigneeId(e.target.value)}
                  className="w-full bg-[#1C2326] border border-white/15 text-white text-xs rounded px-3 py-1.5 focus:border-emerald-500 cursor-pointer"
                >
                  <option value="">Unassigned</option>
                  {projectMembers.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting || !newTitle.trim()}
                className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-700 text-black font-black uppercase text-xs py-2 px-4 rounded-lg shadow-lg flex items-center justify-center gap-1.5 h-9 transition-all cursor-pointer font-mono tracking-wider"
              >
                {isSubmitting ? (
                  <>Syncing with neural stack...</>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" /> Initialize Child Node
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Connection Flow Section (Shown optionally inside when toggled) */}
      <AnimatePresence>
        {showGraphMap && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-t border-white/5 pt-6 relative"
          >
            <div className="relative flex flex-col md:flex-row items-stretch justify-center gap-6 min-h-[220px]">
              {/* SVG Connector layer for fluid backdrop connecting effects */}
              <div className="absolute inset-0 pointer-events-none opacity-20 hidden md:block">
                <svg className="w-full h-full">
                  <defs>
                    <linearGradient id="glow-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#10B981" />
                      <stop offset="100%" stopColor="#3B82F6" />
                    </linearGradient>
                  </defs>
                  {/* Animated path line indicating neural network sync */}
                  <path 
                    d="M 50 110 C 200 110, 200 110, 500 110" 
                    fill="none" 
                    stroke="url(#glow-grad)" 
                    strokeWidth="2" 
                    strokeDasharray="6 4"
                    className="stroke-[url(#glow-grad)]"
                  />
                </svg>
              </div>

              {/* Column 1: Ancestors List (The Parents tree) */}
              <div className="flex-1 flex flex-col justify-center items-center md:items-end space-y-3 z-10">
                <div className="text-[10px] font-mono uppercase font-black text-gray-400 tracking-widest mb-1 select-none">
                  Upstream Dependency Parent(s)
                </div>

                {ancestors.length === 0 ? (
                  <div className="bg-white/[0.02] border border-white/5 rounded-lg px-4 py-3 text-center w-full max-w-sm">
                    <span className="text-[10px] font-mono text-gray-500 block">Root Ancestor Node</span>
                    <p className="text-[9px] text-gray-600 font-sans mt-0.5">This node is at the absolute hierarchy genesis.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5 w-full max-w-sm">
                    {ancestors.map((anc) => (
                      <motion.div
                        key={anc.id}
                        whileHover={{ scale: 1.02 }}
                        onClick={() => onSelectTask(anc)}
                        className="bg-[#1C2326]/50 border border-white/5 hover:border-emerald-500/30 rounded-lg p-2.5 cursor-pointer transition-all flex items-center justify-between gap-3 group shadow-lg"
                      >
                        <div className="min-w-0 flex items-center gap-2">
                          <span className={`p-1 rounded-md flex-shrink-0 ${anc.taskType === 'bug' ? 'bg-red-500/10 text-red-400 border border-red-500/15' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15'}`}>
                            {anc.taskType === 'bug' ? <Bug className="w-3.5 h-3.5" /> : <Layers className="w-3.5 h-3.5" />}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px] font-mono font-bold text-emerald-500/60 uppercase">{anc.ticketId}</span>
                              <span className={`text-[8px] px-1 font-mono rounded font-bold ${
                                anc.priority === TaskPriority.URGENT ? 'bg-red-500/10 text-red-400' :
                                anc.priority === TaskPriority.HIGH ? 'bg-amber-500/10 text-amber-400' :
                                'bg-emerald-500/10 text-emerald-400'
                              }`}>
                                {anc.priority}
                              </span>
                            </div>
                            <h4 className="text-xs font-bold text-gray-300 truncate leading-tight group-hover:text-white transition-colors">{anc.title}</h4>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {/* Central Divider Icon indicators */}
              <div className="flex items-center justify-center self-center bg-emerald-500/5 p-2 rounded-full border border-emerald-500/15 h-10 w-10 flex-shrink-0 relative">
                <ArrowRight className="w-5 h-5 text-emerald-400 hidden md:block" />
                <ChevronDown className="w-5 h-5 text-emerald-400 md:hidden" />
                <div className="absolute -inset-1 bg-emerald-500/10 rounded-full blur animate-pulse pointer-events-none" />
              </div>

              {/* Column 2: Selected Focus Node */}
              <div className="flex-1 flex flex-col justify-center items-center z-10">
                <div className="text-[10px] font-mono uppercase font-black text-emerald-500 tracking-widest mb-1 select-none">
                  Active Focus Center Node
                </div>
                <div className={`w-full max-w-sm bg-[#1C2326] p-4 rounded-xl border-2 shadow-2xl relative overflow-hidden transition-all duration-300 ${
                  currentTask.taskType === 'bug' ? 'border-red-500/50 bg-[#1e1313]' : 'border-emerald-500/50'
                }`}>
                  <div className={`absolute top-0 right-0 w-24 h-24 rounded-full filter blur-xl opacity-10 pointer-events-none ${
                    currentTask.taskType === 'bug' ? 'bg-red-500' : 'bg-emerald-500'
                  }`} />

                  <div className="flex justify-between items-start mb-2 relative z-10">
                    <span className={`text-[10px] font-mono font-black uppercase flex items-center gap-1 px-2 py-0.5 rounded-full border ${
                      currentTask.taskType === 'bug' 
                        ? 'bg-red-500/10 text-red-400 border-red-500/20' 
                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    }`}>
                      {currentTask.taskType === 'bug' ? <Bug className="w-3 h-3" /> : <Layers className="w-3 h-3" />}
                      {currentTask.taskType === 'bug' ? 'BUG CORE' : 'MODULE'}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-gray-500 uppercase tracking-widest">{currentTask.ticketId}</span>
                  </div>

                  <h4 className="text-sm font-black text-white leading-snug mb-3 relative z-10">{currentTask.title}</h4>
                  
                  <div className="flex items-center justify-between pt-2 border-t border-white/5 relative z-10">
                    <div className="flex items-center gap-1.5">
                      {currentTask.assignee ? (
                        <div className="flex items-center gap-1">
                          <UserAvatar user={currentTask.assignee} className="w-4.5 h-4.5" />
                          <span className="text-[10px] text-gray-400 font-medium truncate max-w-[80px]">{currentTask.assignee.name}</span>
                        </div>
                      ) : (
                        <span className="text-[9px] text-gray-500 italic">Unassigned Node</span>
                      )}
                    </div>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider font-mono ${
                      currentTask.priority === TaskPriority.URGENT ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
                      currentTask.priority === TaskPriority.HIGH ? 'bg-amber-500/15 text-amber-300 border border-amber-500/20' :
                      'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20'
                    }`}>
                      {currentTask.priority}
                    </span>
                  </div>
                </div>
              </div>

              {/* Central Divider Icon indicators */}
              <div className="flex items-center justify-center self-center bg-blue-500/5 p-2 rounded-full border border-blue-500/15 h-10 w-10 flex-shrink-0 relative">
                <ArrowRight className="w-5 h-5 text-blue-400 hidden md:block" />
                <ChevronDown className="w-5 h-5 text-blue-400 md:hidden" />
                <div className="absolute -inset-1 bg-blue-500/10 rounded-full blur animate-pulse pointer-events-none" />
              </div>

              {/* Column 3: Children (Dependent Leaf Nodes) */}
              <div className="flex-1 flex flex-col justify-center items-center md:items-start space-y-3 z-10">
                <div className="text-[10px] font-mono uppercase font-black text-gray-450 tracking-widest mb-1 select-none">
                  Downstream Nested Child Nodes ({children.length})
                </div>

                {children.length === 0 ? (
                  <div className="bg-white/[0.01] border border-white/5 border-dashed rounded-lg px-4 py-8 text-center w-full max-w-sm flex flex-col items-center justify-center">
                    <span className="text-[10px] font-mono text-gray-500">Nil Active Downstream Nodes</span>
                    <p className="text-[9px] text-gray-650 font-sans mt-0.5 max-w-[200px]">No nested modules or bugs spawned from this item.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5 w-full max-w-sm max-h-[220px] overflow-y-auto pr-1">
                    {children.map((child) => (
                      <motion.div
                        key={child.id}
                        whileHover={{ scale: 1.02 }}
                        onClick={() => onSelectTask(child)}
                        className="bg-[#1C2326]/50 border border-white/5 hover:border-blue-500/30 rounded-lg p-2.5 cursor-pointer transition-all flex items-center justify-between gap-3 group shadow-lg"
                      >
                        <div className="min-w-0 flex items-center gap-2">
                          <span className={`p-1 rounded-md flex-shrink-0 ${child.taskType === 'bug' ? 'bg-red-500/10 text-red-400 border border-red-500/15' : 'bg-blue-500/10 text-blue-400 border border-blue-500/15'}`}>
                            {child.taskType === 'bug' ? <Bug className="w-3.5 h-3.5" /> : <GitCommit className="w-3.5 h-3.5" />}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px] font-mono font-bold text-blue-400/70 uppercase">{child.ticketId}</span>
                              <span className={`text-[8px] px-1 font-mono rounded font-bold ${
                                child.priority === TaskPriority.URGENT ? 'bg-red-500/10 text-red-400' :
                                child.priority === TaskPriority.HIGH ? 'bg-amber-500/10 text-amber-400' :
                                'bg-blue-500/10 text-blue-400'
                              }`}>
                                {child.priority}
                              </span>
                            </div>
                            <h4 className="text-xs font-bold text-gray-300 truncate leading-tight group-hover:text-white transition-colors">{child.title}</h4>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
