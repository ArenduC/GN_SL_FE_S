import React, { useState } from 'react';
import { 
  SearchIcon, 
  XIcon, 
  DownloadIcon, 
  ChevronLeftIcon,
  ChevronRightIcon,
  SparklesIcon,
  CheckIcon,
  PlusIcon,
  FilterIcon,
  ZapIcon,
  ActivityIcon
} from './Icons';
import { User, Sprint, TaskPriority } from '../types';

interface RightControlDeckProps {
  // Search
  searchTerm: string;
  setSearchTerm: (val: string) => void;

  // Options lists
  assignees: User[];
  sprints?: Sprint[];
  statuses?: string[];
  tags?: string[];

  // Filter state
  priorityFilter: string[];
  setPriorityFilter: (val: string[]) => void;
  assigneeFilter: string[];
  setAssigneeFilter: (val: string[]) => void;
  statusFilter: string[];
  setStatusFilter: (val: string[]) => void;
  tagFilter: string[];
  setTagFilter: (val: string[]) => void;

  // Date frame
  startDate: string;
  setStartDate: (val: string) => void;
  endDate: string;
  setEndDate: (val: string) => void;

  // Global triggers
  onClearFilters: () => void;
  onExportCsv: () => void;
  onExportPdf: () => void;

  // Indicators
  filteredCount: number;
  totalCount: number;

  // Controlled visibility
  isOpen?: boolean;
  onToggleIsOpen?: (val: boolean) => void;

  // Context-specific actions (optional)
  onNewTaskClick?: () => void;
  onAddColumn?: (title: string) => void;
  onResourceMeshClick?: () => void;
  linksCount?: number;
  onNeuralNexusClick?: () => void;
  aiFeaturesEnabled?: boolean;
  projectView?: string;
  projectColumnsList?: { id: string, name: string, taskIds: string[] }[];
}

export const RightControlDeck: React.FC<RightControlDeckProps> = ({
  searchTerm,
  setSearchTerm,
  assignees,
  sprints = [],
  statuses = [],
  tags = [],
  priorityFilter,
  setPriorityFilter,
  assigneeFilter,
  setAssigneeFilter,
  statusFilter,
  setStatusFilter,
  tagFilter,
  setTagFilter,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  onClearFilters,
  onExportCsv,
  onExportPdf,
  filteredCount,
  totalCount,
  isOpen: controlledIsOpen,
  onToggleIsOpen,

  // Optional contextual action handlers
  onNewTaskClick,
  onAddColumn,
  onResourceMeshClick,
  linksCount = 0,
  onNeuralNexusClick,
  aiFeaturesEnabled = false,
  projectView = 'board',
  projectColumnsList = []
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'filters' | 'actions' | 'analytics'>('filters');
  const [newColumnTitle, setNewColumnTitle] = useState('');

  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;

  const setIsOpen = (val: boolean) => {
    if (onToggleIsOpen) {
      onToggleIsOpen(val);
    } else {
      setInternalIsOpen(val);
    }
  };

  const handleTabClick = (tab: 'filters' | 'actions' | 'analytics') => {
    if (isOpen) {
      if (activeTab === tab) {
        setIsOpen(false);
      } else {
        setActiveTab(tab);
      }
    } else {
      setIsOpen(true);
      setActiveTab(tab);
    }
  };

  const handleAddColumn = () => {
    if (newColumnTitle.trim() && onAddColumn) {
      onAddColumn(newColumnTitle.trim());
      setNewColumnTitle('');
    }
  };

  // Helper toggle helpers
  const togglePriority = (prio: string) => {
    if (priorityFilter.includes(prio)) {
      setPriorityFilter(priorityFilter.filter(p => p !== prio));
    } else {
      setPriorityFilter([...priorityFilter, prio]);
    }
  };

  const toggleAssignee = (id: string) => {
    if (assigneeFilter.includes(id)) {
      setAssigneeFilter(assigneeFilter.filter(a => a !== id));
    } else {
      setAssigneeFilter([...assigneeFilter, id]);
    }
  };

  const toggleStatus = (status: string) => {
    if (statusFilter.includes(status)) {
      setStatusFilter(statusFilter.filter(s => s !== status));
    } else {
      setStatusFilter([...statusFilter, status]);
    }
  };

  const toggleTag = (tag: string) => {
    if (tagFilter.includes(tag)) {
      setTagFilter(tagFilter.filter(t => t !== tag));
    } else {
      setTagFilter([...tagFilter, tag]);
    }
  };

  const activeFiltersCount = 
    (searchTerm ? 1 : 0) + 
    priorityFilter.length + 
    assigneeFilter.length + 
    statusFilter.length + 
    tagFilter.length + 
    (startDate || endDate ? 1 : 0);

  return (
    <div className="hidden lg:flex fixed right-0 top-14 bottom-0 z-30 transition-all shadow-2xl h-[calc(100vh-56px)] select-none">
      
      {/* 1. Main Sliding Panel Content */}
      {isOpen && (
        <div className="w-80 bg-[#0B0E0F]/95 backdrop-blur-md border-l border-white/5 h-full flex flex-col justify-between overflow-y-auto custom-scrollbar border-r border-white/5">
          
          <div className="divide-y divide-white/5 flex-grow flex flex-col min-h-0">
            
            {/* Header section (dynamically changes depending on tab) */}
            <div className="p-4 flex items-center justify-between bg-black/20">
              <div className="flex items-center gap-2">
                {activeTab === 'filters' && (
                  <>
                    <FilterIcon className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white">WORKSPACE FILTERS</h3>
                  </>
                )}
                {activeTab === 'actions' && (
                  <>
                    <ZapIcon className="w-4 h-4 text-amber-400" />
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white">OPERATIONS PANEL</h3>
                  </>
                )}
                {activeTab === 'analytics' && (
                  <>
                    <ActivityIcon className="w-4 h-4 text-indigo-400" />
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white">WORKSPACE METRICS</h3>
                  </>
                )}
              </div>
              <span className="text-[8px] bg-white/5 px-2 py-0.5 rounded text-gray-500 font-extrabold font-mono tracking-widest uppercase">
                {activeTab}
              </span>
            </div>

            {/* TAB CONTENT Scrollable container */}
            <div className="p-4 space-y-6 flex-grow overflow-y-auto custom-scrollbar">

              {/* ======================================= */}
              {/*           TAB 1: FILTERS                */}
              {/* ======================================= */}
              {activeTab === 'filters' && (
                <div className="space-y-6">
                  {/* Applied filters status card */}
                  <div className="p-3 bg-[#121819]/40 border border-white/5 rounded-xl space-y-1">
                    <div className="flex justify-between items-center text-[9px] font-mono font-bold text-gray-500">
                      <span>FILTER ACCURACY</span>
                      <span className="text-emerald-400 font-black">{filteredCount} / {totalCount} Nodes</span>
                    </div>
                    {activeFiltersCount > 0 && (
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[9px] text-gray-400 font-medium"><strong>{activeFiltersCount} filter(s)</strong> configured</span>
                        <button 
                          onClick={onClearFilters}
                          className="text-[9px] font-black text-rose-400 hover:text-rose-300 uppercase tracking-widest cursor-pointer"
                        >
                          Reset filters
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Core word query search filter */}
                  <div className="space-y-1.5">
                    <label className="block text-[9px] font-black text-gray-500 uppercase tracking-[0.15em]">Core Text Filter</label>
                    <div className="relative">
                      <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                      <input 
                        type="text" 
                        placeholder="Query titles, details, IDs..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-[#1C2326] text-xs text-white placeholder-gray-500 py-2 pl-8 pr-8 border border-white/5 rounded-xl focus:outline-none focus:border-emerald-500 transition-all"
                      />
                      {searchTerm && (
                        <button 
                          onClick={() => setSearchTerm('')} 
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                        >
                          <XIcon className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Priority Filter */}
                  <div className="space-y-2">
                    <label className="block text-[9px] font-black text-gray-500 uppercase tracking-[0.15em]">Priority Classification</label>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.values(TaskPriority).map(prio => {
                        const active = priorityFilter.includes(prio);
                        return (
                          <button
                            key={prio}
                            onClick={() => togglePriority(prio)}
                            className={`px-3 py-1 text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer rounded-lg ${
                              active 
                                ? 'bg-emerald-500 text-black font-black' 
                                : 'bg-[#1C2326] text-gray-400 hover:bg-white/5 hover:text-white border border-white/5'
                            }`}
                          >
                            {prio}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Status filters */}
                  {statuses.length > 0 && (
                    <div className="space-y-2">
                      <label className="block text-[9px] font-black text-gray-500 uppercase tracking-[0.15em]">Workflow Columns</label>
                      <div className="space-y-1 max-h-36 overflow-y-auto no-scrollbar">
                        {statuses.map(st => {
                          const checked = statusFilter.includes(st);
                          return (
                            <button
                              key={st}
                              onClick={() => toggleStatus(st)}
                              className="w-full flex items-center justify-between px-2.5 py-1.5 bg-[#1C2326]/40 hover:bg-[#1C2326] rounded-lg border border-white/5 text-left text-xs transition-colors cursor-pointer"
                            >
                              <span className={`font-semibold ${checked ? 'text-emerald-400' : 'text-gray-400'}`}>{st}</span>
                              {checked && <CheckIcon className="w-3.5 h-3.5 text-emerald-400" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Assignee filters */}
                  {assignees.length > 0 && (
                    <div className="space-y-2">
                      <label className="block text-[9px] font-black text-gray-500 uppercase tracking-[0.15em]">Target Assignees</label>
                      <div className="space-y-1 max-h-36 overflow-y-auto no-scrollbar">
                        {assignees.map(u => {
                          const checked = assigneeFilter.includes(u.id);
                          return (
                            <button
                              key={u.id}
                              onClick={() => toggleAssignee(u.id)}
                              className="w-full flex items-center justify-between px-2.5 py-1.5 bg-[#1C2326]/40 hover:bg-[#1C2326] rounded-lg border border-white/5 text-left text-xs transition-colors cursor-pointer"
                            >
                              <span className={`font-semibold ${checked ? 'text-emerald-400' : 'text-gray-400'}`}>{u.name}</span>
                              {checked && <CheckIcon className="w-3.5 h-3.5 text-emerald-400" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Tag Filters */}
                  {tags.length > 0 && (
                    <div className="space-y-2">
                      <label className="block text-[9px] font-black text-gray-500 uppercase tracking-[0.15em]">Classification Tags</label>
                      <div className="flex flex-wrap gap-1.5">
                        {tags.map(tag => {
                          const active = tagFilter.includes(tag);
                          return (
                            <button
                              key={tag}
                              onClick={() => toggleTag(tag)}
                              className={`px-2 py-0.5 rounded text-[9px] font-bold tracking-wider transition-all cursor-pointer ${
                                active 
                                  ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/40 font-black' 
                                  : 'bg-white/5 text-gray-400 hover:text-white border border-white/5'
                              }`}
                            >
                              #{tag}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Calendars timeline filter */}
                  <div className="space-y-2">
                    <label className="block text-[9px] font-black text-gray-500 uppercase tracking-[0.15em]">Time Iteration Bounds</label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-[8px] text-gray-500 mb-1 uppercase font-bold">Start Date</p>
                        <input 
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="w-full bg-[#1C2326] text-xs text-white p-1.5 border border-white/5 rounded-lg focus:outline-none"
                        />
                      </div>
                      <div>
                        <p className="text-[8px] text-gray-500 mb-1 uppercase font-bold">End Date</p>
                        <input 
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="w-full bg-[#1C2326] text-xs text-white p-1.5 border border-white/5 rounded-lg focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ======================================= */}
              {/*           TAB 2: ACTIONS                */}
              {/* ======================================= */}
              {activeTab === 'actions' && (
                <div className="space-y-5">
                  <p className="text-[10px] text-gray-400 leading-relaxed font-semibold uppercase tracking-wider">
                    Quick board controllers and actions migrated from the horizontal header.
                  </p>

                  {/* Action 1: Create Task */}
                  {onNewTaskClick && (
                    <div className="space-y-1.5">
                      <label className="block text-[9px] font-black text-gray-500 uppercase tracking-[0.15em]">Task Creation</label>
                      <button
                        onClick={onNewTaskClick}
                        className="w-full flex items-center justify-center gap-2 h-10 bg-white hover:bg-gray-200 text-black font-black uppercase tracking-widest rounded-xl transition-all text-[9px] cursor-pointer"
                      >
                        <PlusIcon className="w-4 h-4 text-black" />
                        <span>Create New Task</span>
                      </button>
                    </div>
                  )}

                  {/* Action 2: Add Column (inline!) */}
                  {onAddColumn && projectView === 'board' && (
                    <div className="space-y-2 bg-white/5 border border-white/5 rounded-2xl p-4">
                      <h4 className="text-[10px] font-black uppercase tracking-[0.1em] text-gray-300">Board Board Columns</h4>
                      <div className="space-y-1.5">
                        <label className="text-[8px] font-bold text-gray-500 uppercase tracking-[0.15em]">Column Title</label>
                        <div className="flex gap-1.5">
                          <input 
                            type="text"
                            placeholder="e.g. In Testing..."
                            value={newColumnTitle}
                            onChange={(e) => setNewColumnTitle(e.target.value)}
                            onKeyDown={(u) => { if (u.key === 'Enter') handleAddColumn(); }}
                            className="flex-grow bg-[#1C2326] text-xs text-white p-2 border border-white/5 rounded-xl focus:outline-none focus:border-emerald-500"
                          />
                          <button
                            onClick={handleAddColumn}
                            disabled={!newColumnTitle.trim()}
                            className="px-3.5 bg-emerald-500 hover:bg-emerald-400 text-black rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Action 3: Resource Mesh */}
                  {onResourceMeshClick && (
                    <div className="space-y-1.5">
                      <label className="block text-[9px] font-black text-gray-500 uppercase tracking-[0.15em]">Network Hub</label>
                      <button
                        onClick={onResourceMeshClick}
                        className="w-full flex items-center justify-between px-3 h-10 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl hover:bg-emerald-500/20 transition-all text-[10px] font-black uppercase tracking-widest cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <ZapIcon className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                          <span>Resource Mesh</span>
                        </div>
                        <span className="bg-emerald-500/20 text-[9px] font-semibold px-2 py-0.5 rounded-full text-emerald-400">{linksCount} Links</span>
                      </button>
                    </div>
                  )}

                  {/* Action 4: Neural Nexus AI (Conditional) */}
                  {aiFeaturesEnabled && onNeuralNexusClick && (
                    <div className="space-y-1.5">
                      <label className="block text-[9px] font-black text-gray-500 uppercase tracking-[0.15em]">Cognitive Intelligence</label>
                      <button
                        onClick={onNeuralNexusClick}
                        className="w-full flex items-center justify-center gap-2 h-10 bg-gradient-to-r from-emerald-500 to-indigo-600 hover:from-emerald-400 hover:to-indigo-500 text-white font-black uppercase tracking-widest rounded-xl transition-all text-[9px] shadow-lg shadow-indigo-500/10 cursor-pointer"
                      >
                        <SparklesIcon className="w-3.5 h-3.5 text-white animate-pulse" />
                        <span>Trigger Neural Nexus</span>
                      </button>
                    </div>
                  )}

                  {/* Action 5: Exporter Hub */}
                  <div className="space-y-2 bg-black/30 border border-white/5 rounded-2xl p-4">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.1em] text-gray-300">Exporter Hub</h4>
                    <p className="text-[8px] text-gray-500 uppercase font-black tracking-widest">Generate static files from Board Snapshots.</p>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <button
                        onClick={onExportCsv}
                        className="flex items-center justify-center gap-1 py-2 bg-[#1C2326] hover:bg-white/5 text-white rounded-xl border border-white/5 text-[9px] uppercase font-black tracking-widest cursor-pointer transition-all"
                      >
                        <DownloadIcon className="w-3 h-3 text-gray-400" />
                        CSV File
                      </button>

                      <button
                        onClick={onExportPdf}
                        className="flex items-center justify-center gap-1 py-2 bg-[#1C2326] hover:bg-white/5 text-white rounded-xl border border-white/5 text-[9px] uppercase font-black tracking-widest cursor-pointer transition-all"
                      >
                        <DownloadIcon className="w-3 h-3 text-gray-400" />
                        PDF File
                      </button>
                    </div>
                  </div>

                </div>
              )}

              {/* ======================================= */}
              {/*           TAB 3: ANALYTICS              */}
              {/* ======================================= */}
              {activeTab === 'analytics' && (
                <div className="space-y-6">
                  
                  {/* Progress bar / health status card */}
                  <div className="p-4 bg-[#121819]/40 border border-white/5 rounded-2xl space-y-3">
                    <div className="flex justify-between items-center text-[10px] font-black text-gray-500 uppercase tracking-widest">
                      <span>Filtered Node Ratio</span>
                      <span className="text-emerald-400 font-black">{filteredCount} / {totalCount} Nodes</span>
                    </div>
                    <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-emerald-500 transition-all rounded-full shadow-[0_0_8px_rgba(16,185,129,0.3)]" 
                        style={{ width: `${totalCount > 0 ? (filteredCount / totalCount) * 100 : 100}%` }}
                      />
                    </div>
                    
                    <div className="flex justify-between items-center pt-1 border-t border-white/5 text-[9px] font-semibold text-gray-400">
                      <span>Active Task Density:</span>
                      <span className="text-indigo-400 font-extrabold">{totalCount > 0 ? Math.round((filteredCount / totalCount) * 100) : 100}%</span>
                    </div>
                  </div>

                  {/* Stats overview matrix */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-[#1C2326]/40 border border-white/5 p-3 rounded-2xl text-center space-y-1">
                      <span className="block text-[8px] font-bold text-gray-500 uppercase tracking-widest">Total Nodes</span>
                      <span className="block text-xl font-mono font-black text-white">{totalCount}</span>
                    </div>
                    
                    <div className="bg-[#1C2326]/40 border border-white/5 p-3 rounded-2xl text-center space-y-1">
                      <span className="block text-[8px] font-bold text-gray-500 uppercase tracking-widest">Resource Links</span>
                      <span className="block text-xl font-mono font-black text-emerald-400">{linksCount}</span>
                    </div>

                    <div className="bg-[#1C2326]/40 border border-white/5 p-3 rounded-2xl text-center col-span-2 space-y-1">
                      <span className="block text-[8px] font-bold text-gray-500 uppercase tracking-widest">Project Activity Status</span>
                      <div className="flex justify-center items-center gap-1.5 pt-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] uppercase font-black text-white font-mono tracking-wider">Telemetry Operational</span>
                      </div>
                    </div>
                  </div>

                  {/* Column Stats Load */}
                  {projectColumnsList && projectColumnsList.length > 0 && (
                    <div className="space-y-3 bg-[#121819]/20 border border-white/5 rounded-2xl p-4">
                      <h4 className="text-[10px] font-black uppercase tracking-[0.1em] text-gray-300">COLUMN TASK LOADING</h4>
                      <div className="space-y-3">
                        {projectColumnsList.map(col => {
                          const totalTasksCount = projectColumnsList.reduce((acc, c) => acc + (c.taskIds?.length || 0), 0);
                          const ratio = totalTasksCount > 0 ? (col.taskIds.length / totalTasksCount) * 100 : 0;
                          return (
                            <div key={col.id} className="space-y-1">
                              <div className="flex justify-between items-center text-[9px] font-semibold text-gray-400">
                                <span>{(col.name || 'Column').toUpperCase()}</span>
                                <span className="font-bold text-white font-mono">{col.taskIds.length} T</span>
                              </div>
                              <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-emerald-500 transition-all rounded-full"
                                  style={{ width: `${ratio}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                </div>
              )}

            </div>

          </div>

          {/* Footer informational banner */}
          <div className="p-4 border-t border-white/5 bg-black/20 text-[8px] font-mono text-gray-500 text-center leading-relaxed">
            Data updates sync dynamically via workspace hub nodes under telemetry compliance standards.
          </div>

        </div>
      )}

      {/* 2. Permanent Vertical Tab Strip (Android Studio style) */}
      <div className="w-12 bg-[#0C1012] border-l border-white/5 h-full flex flex-col items-center pt-4 pb-4 gap-6 select-none relative z-50">
        
        {/* Toggle Panel Button at top */}
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 hover:text-white text-gray-400 cursor-pointer transition-all"
          title={isOpen ? "Collapse Panel" : "Expand Panel"}
        >
          {isOpen ? <ChevronRightIcon className="w-4 h-4" /> : <ChevronLeftIcon className="w-4 h-4" />}
        </button>

        {/* Divider line */}
        <div className="w-6 h-px bg-white/10" />

        {/* Tab 1: Filters */}
        <button
          onClick={() => handleTabClick('filters')}
          className={`p-2.5 rounded-xl transition-all relative group cursor-pointer ${
            isOpen && activeTab === 'filters'
              ? 'bg-emerald-500 text-black font-black shadow-[0_0_12px_rgba(16,185,129,0.3)]'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
          title="Filters & Search"
        >
          <FilterIcon className="w-5 h-5" />
          {activeFiltersCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[8px] font-bold text-white animate-pulse">
              {activeFiltersCount}
            </span>
          )}
          {/* Tooltip */}
          <div className="absolute right-14 top-1/2 -translate-y-1/2 bg-black text-[9px] text-gray-300 font-extrabold uppercase tracking-widest px-2 py-1 rounded border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
            Filters & Search
          </div>
        </button>

        {/* Tab 2: Control & Uplinks */}
        <button
          onClick={() => handleTabClick('actions')}
          className={`p-2.5 rounded-xl transition-all relative group cursor-pointer ${
            isOpen && activeTab === 'actions'
              ? 'bg-emerald-500 text-black font-black shadow-[0_0_12px_rgba(16,185,129,0.3)]'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
          title="Operations & Uplinks"
        >
          <ZapIcon className="w-5 h-5" />
          {/* Tooltip */}
          <div className="absolute right-14 top-1/2 -translate-y-1/2 bg-black text-[9px] text-gray-300 font-extrabold uppercase tracking-widest px-2 py-1 rounded border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
            Operations & Actions
          </div>
        </button>

        {/* Tab 3: Workspace Activity & Metrics */}
        <button
          onClick={() => handleTabClick('analytics')}
          className={`p-2.5 rounded-xl transition-all relative group cursor-pointer ${
            isOpen && activeTab === 'analytics'
              ? 'bg-emerald-500 text-black font-black shadow-[0_0_12px_rgba(16,185,129,0.3)]'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
          title="Workspace Metrics"
        >
          <ActivityIcon className="w-5 h-5" />
          {/* Tooltip */}
          <div className="absolute right-14 top-1/2 -translate-y-1/2 bg-black text-[9px] text-gray-300 font-extrabold uppercase tracking-widest px-2 py-1 rounded border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
            Health & Metrics
          </div>
        </button>

        {/* Rotated label vertical header at bottom */}
        <div className="flex-grow flex items-end pb-4">
          <span className="text-[8px] font-black uppercase text-gray-600 tracking-[0.25em] [writing-mode:vertical-lr] select-none transform rotate-180">
            {isOpen ? `ACTIVE VIEW: ${activeTab.toUpperCase()}` : 'CONTROL PANEL'}
          </span>
        </div>
      </div>

    </div>
  );
};
