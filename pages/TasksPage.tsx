import React, { useState, useMemo, useEffect } from 'react';
import { Project, User, AugmentedTask, Task, FilterSegment, Column, Sprint } from '../types';
import { DownloadIcon, XIcon } from '../components/Icons';
import { exportAugmentedTasksToCsv, exportTasksToPdf } from '../utils/export';
import { TaskListRow } from '../components/TaskListRow';
import { RightControlDeck } from '../components/RightControlDeck';
import { Pagination } from '../components/Pagination';
import { TaskInsights } from '../components/TaskInsights';
import { useConfirmation } from '../App';

interface TasksPageProps {
  projects: Record<string, Project>;
  users: Record<string, User>;
  currentUser: User;
  onTaskClick: (task: Task) => void;
  isControlDeckOpen?: boolean;
  setIsControlDeckOpen?: (val: boolean) => void;
}

export const TasksPage: React.FC<TasksPageProps> = ({ projects, users, currentUser, onTaskClick, isControlDeckOpen, setIsControlDeckOpen }) => {
  const [internalControlDeckOpen, setInternalControlDeckOpen] = useState(false);
  const resolvedControlDeckOpen = isControlDeckOpen !== undefined ? isControlDeckOpen : internalControlDeckOpen;
  const resolvedSetControlDeckOpen = setIsControlDeckOpen || setInternalControlDeckOpen;
  const [viewMode, setViewMode] = useState<'all' | 'my'>('all');
  
  // Filtering state
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string[]>([]);
  const [assigneeFilter, setAssigneeFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [sprintFilter, setSprintFilter] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [relativeTimeValue, setRelativeTimeValue] = useState('');
  const [relativeTimeUnit, setRelativeTimeUnit] = useState<FilterSegment['filters']['relativeTimeUnit']>('hours');
  const [relativeTimeCondition, setRelativeTimeCondition] = useState<FilterSegment['filters']['relativeTimeCondition']>('within');
  const [segments, setSegments] = useState<FilterSegment[]>([]);
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>('all');
  const [dateTarget, setDateTarget] = useState<'createdAt' | 'dueDate'>('createdAt');
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  // Sorting state
  const [sortField, setSortField] = useState<'ticketId' | 'title' | 'projectName' | 'priority' | 'columnName' | 'assignee'>('ticketId');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Column Visibility state
  const [visibleColumns, setVisibleColumns] = useState({
    id: true,
    title: true,
    project: true,
    priority: true,
    status: true,
    assignee: true
  });
  const [isColumnDropdownOpen, setIsColumnDropdownOpen] = useState(false);

  // Bulk Selection state
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const requestConfirmation = useConfirmation();
  const storageKey = 'tasks-page-segments';

  useEffect(() => {
    try {
      const savedSegments = localStorage.getItem(storageKey);
      if (savedSegments) {
        setSegments(JSON.parse(savedSegments));
      }
    } catch (error) {
      console.error("Failed to load filter segments from localStorage", error);
    }
  }, [storageKey]);

  const saveSegmentsToStorage = (updatedSegments: FilterSegment[]) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(updatedSegments));
    } catch (error) {
      console.error("Failed to save filter segments to localStorage", error);
    }
  };

  const handleAddSegment = async (name: string, filters: FilterSegment['filters']) => {
    if (!name.trim()) return;

    const newSegment: FilterSegment = {
      id: Date.now().toString(),
      name: name.trim(),
      projectId: "global", 
      creatorId: currentUser.id,
      filters: filters,
    };
    const updatedSegments = [...segments, newSegment];
    setSegments(updatedSegments);
    saveSegmentsToStorage(updatedSegments);
    setActiveSegmentId(newSegment.id);
  };

  const handleDeleteSegment = async (segmentId: string) => {
    const segment = segments.find(s => s.id === segmentId);
    if (!segment) return;

    requestConfirmation({
        title: 'Delete Saved View',
        message: <>Are you sure you want to delete the saved view <strong>"{segment.name}"</strong> from your local storage?</>,
        onConfirm: () => {
            const updatedSegments = segments.filter(s => s.id !== segmentId);
            setSegments(updatedSegments);
            saveSegmentsToStorage(updatedSegments);
            if (activeSegmentId === segmentId) {
              handleClearFilters();
            }
        },
        confirmText: 'Delete'
    });
  };

  const handleUpdateSegment = async (segmentId: string, updates: { name?: string, filters?: FilterSegment['filters'] }) => {
      const updatedSegments = segments.map(s => {
          if (s.id === segmentId) {
              return {
                  ...s,
                  name: updates.name ?? s.name,
                  filters: updates.filters ?? s.filters,
              };
          }
          return s;
      });
      setSegments(updatedSegments);
      saveSegmentsToStorage(updatedSegments);
  };

  const handleApplySegment = (segmentId: string | null) => {
    setActiveSegmentId(segmentId);
    if (segmentId === 'all' || segmentId === null) {
      setSearchTerm('');
      setPriorityFilter([]);
      setAssigneeFilter([]);
      setStatusFilter([]);
      setTagFilter([]);
      setSprintFilter([]);
      setStartDate('');
      setEndDate('');
      setRelativeTimeValue('');
      setRelativeTimeUnit('hours');
      setRelativeTimeCondition('within');
    } else {
      const segment = segments.find(s => s.id === segmentId);
      if (segment) {
        setSearchTerm(segment.filters.searchTerm || '');
        setPriorityFilter(segment.filters.priorityFilter || []);
        setAssigneeFilter(segment.filters.assigneeFilter || []);
        setStatusFilter(segment.filters.statusFilter || []);
        setTagFilter(segment.filters.tagFilter || []);
        setSprintFilter(segment.filters.sprintFilter || []);
        setStartDate(segment.filters.startDate || '');
        setEndDate(segment.filters.endDate || '');
        setRelativeTimeValue(segment.filters.relativeTimeValue || '');
        setRelativeTimeUnit(segment.filters.relativeTimeUnit || 'hours');
        setRelativeTimeCondition(segment.filters.relativeTimeCondition || 'within');
      }
    }
  };
  
  const handleClearFilters = () => {
    handleApplySegment('all');
  };

  const allTasks = useMemo((): AugmentedTask[] => {
    if (!projects) return [];
    return (Object.values(projects || {}) as Project[]).flatMap(project => {
      const board = project.board;
      if (!board?.tasks) return [];
      
      const tasks = Object.values(board.tasks || {}) as Task[];
      const columns = board.columns ? (Object.values(board.columns || {}) as Column[]) : [];

      return tasks.map(task => {
        const column = columns.find(c => c.taskIds.includes(task.id));
        return {
          ...task,
          projectId: project.id,
          projectName: project.name,
          columnId: column?.id || '',
          columnName: column?.title || 'Uncategorized',
        };
      });
    });
  }, [projects]);

  const uniqueAssignees = useMemo(() => {
    const list = new Set<string>();
    allTasks.forEach(task => {
      if (task.assignee?.name) {
        list.add(task.assignee.name);
      }
      (task.subtasks || []).forEach(sub => {
        if (sub.assignee?.name) {
          list.add(sub.assignee.name);
        }
      });
    });
    return Array.from(list).sort();
  }, [allTasks]);

  const assigneeOptions = useMemo(() => {
    return uniqueAssignees.map(name => ({ value: name, label: name }));
  }, [uniqueAssignees]);

  const allStatuses = useMemo(() => {
    const statusSet = new Set<string>();
    (Object.values(projects || {}) as Project[]).forEach(project => {
      if (project.board?.columns) {
        (Object.values(project.board.columns || {}) as Column[]).forEach(column => {
          statusSet.add(column.title);
        });
      }
    });
    return Array.from(statusSet).sort();
  }, [projects]);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    allTasks.forEach(task => {
        task.tags.forEach(tag => {
            if (tag && !tag.startsWith('ticket:') && !tag.startsWith('type:') && !tag.startsWith('ref:')) {
                tags.add(tag);
            }
        });
    });
    return Array.from(tags).sort();
  }, [allTasks]);

  const allSprints = useMemo((): Sprint[] => {
    const sprints: Sprint[] = [];
    const sprintIds = new Set<string>();
    (Object.values(projects || {}) as Project[]).forEach(project => {
        (project.sprints || []).forEach(sprint => {
            if (!sprintIds.has(sprint.id)) {
                sprints.push(sprint);
                sprintIds.add(sprint.id);
            }
        });
    });
    return sprints;
  }, [projects]);


  const filteredTasks = useMemo(() => {
    let tasks = allTasks;
    if (viewMode === 'my') {
      tasks = tasks.filter(task => 
        task.assignee?.id === currentUser.id ||
        (task.subtasks || []).some(sub => sub.assignee?.id === currentUser.id || sub.assigneeId === currentUser.id)
      );
    }
    
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      tasks = tasks.filter(task => 
        (task.title || '').toLowerCase().includes(search) ||
        (task.description || '').toLowerCase().includes(search) ||
        (task.ticketId || '').toLowerCase().includes(search) ||
        (task.subtasks || []).some(st => (st.ticketId || '').toLowerCase().includes(search))
      );
    }

    if (priorityFilter.length > 0) {
      tasks = tasks.filter(task => priorityFilter.includes(task.priority));
    }

    if (assigneeFilter.length > 0) {
      tasks = tasks.filter(task => {
        const hasMainAssignee = task.assignee?.name ? assigneeFilter.includes(task.assignee.name) : false;
        const hasSubtaskAssignee = (task.subtasks || []).some(sub => 
          sub.assignee?.name && assigneeFilter.includes(sub.assignee.name)
        );
        return hasMainAssignee || hasSubtaskAssignee;
      });
    }

    if (statusFilter.length > 0) {
        tasks = tasks.filter(task => statusFilter.includes(task.columnName));
    }

    if (tagFilter.length > 0) {
      tasks = tasks.filter(task => task.tags.some(tag => tagFilter.includes(tag)));
    }

    if (sprintFilter.length > 0) {
      tasks = tasks.filter(task => task.sprintId ? sprintFilter.includes(task.sprintId) : false);
    }

    const getTaskTime = (task: Task): number => {
      if (dateTarget === 'dueDate') {
        return task.dueDate ? new Date(task.dueDate).getTime() : 0;
      }
      return new Date(task.createdAt).getTime();
    };

    if (startDate) {
      const [y, m, d] = startDate.split('-').map(Number);
      const start = new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
      tasks = tasks.filter(task => getTaskTime(task) >= start);
    }
    if (endDate) {
      const [y, m, d] = endDate.split('-').map(Number);
      const end = new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
      tasks = tasks.filter(task => getTaskTime(task) <= end);
    }
    
    if (relativeTimeValue && parseInt(relativeTimeValue, 10) > 0) {
        const now = new Date();
        const cutoff = new Date();
        const value = parseInt(relativeTimeValue, 10);

        switch(relativeTimeUnit) {
            case 'seconds': cutoff.setSeconds(now.getSeconds() - value); break;
            case 'minutes': cutoff.setMinutes(now.getMinutes() - value); break;
            case 'hours': cutoff.setHours(now.getHours() - value); break;
            case 'days': cutoff.setDate(now.getDate() - value); break;
            case 'months': cutoff.setMonth(now.getMonth() - value); break;
            case 'years': cutoff.setFullYear(now.getFullYear() - value); break;
        }
        
        if (relativeTimeCondition === 'within') {
            tasks = tasks.filter(task => getTaskTime(task) >= cutoff.getTime());
        } else { 
            tasks = tasks.filter(task => getTaskTime(task) < cutoff.getTime());
        }
    }

    // Apply Sorting
    const sorted = [...tasks];
    sorted.sort((a, b) => {
      let valA = '';
      let valB = '';
      if (sortField === 'ticketId') {
        valA = a.ticketId || '';
        valB = b.ticketId || '';
      } else if (sortField === 'title') {
        valA = a.title || '';
        valB = b.title || '';
      } else if (sortField === 'projectName') {
        valA = a.projectName || '';
        valB = b.projectName || '';
      } else if (sortField === 'priority') {
        valA = a.priority || '';
        valB = b.priority || '';
      } else if (sortField === 'columnName') {
        valA = a.columnName || '';
        valB = b.columnName || '';
      } else if (sortField === 'assignee') {
        valA = a.assignee?.name || '';
        valB = b.assignee?.name || '';
      }
      return sortDirection === 'asc' 
        ? valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' }) 
        : valB.localeCompare(valA, undefined, { numeric: true, sensitivity: 'base' });
    });

    return sorted;
  }, [allTasks, viewMode, currentUser.id, searchTerm, priorityFilter, assigneeFilter, statusFilter, tagFilter, sprintFilter, startDate, endDate, relativeTimeValue, relativeTimeUnit, relativeTimeCondition, dateTarget, sortField, sortDirection]);
  
  useEffect(() => {
    setCurrentPage(1);
  }, [filteredTasks.length]);

  const totalPages = Math.ceil(filteredTasks.length / ITEMS_PER_PAGE);
  const paginatedTasks = filteredTasks.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handleExport = () => {
    exportAugmentedTasksToCsv(filteredTasks, users, "Global View");
  };

  const handleExportPdf = () => {
    exportTasksToPdf(filteredTasks, "Global View");
  };

  const isAllSelected = paginatedTasks.length > 0 && paginatedTasks.every(t => selectedTaskIds.includes(t.id));

  const handleSelectAllToggle = () => {
    if (isAllSelected) {
      setSelectedTaskIds(selectedTaskIds.filter(id => !paginatedTasks.some(t => t.id === id)));
    } else {
      const newSelections = [...selectedTaskIds];
      paginatedTasks.forEach(t => {
        if (!newSelections.includes(t.id)) {
          newSelections.push(t.id);
        }
      });
      setSelectedTaskIds(newSelections);
    }
  };

  const handleSelectTaskToggle = (taskId: string) => {
    if (selectedTaskIds.includes(taskId)) {
      setSelectedTaskIds(selectedTaskIds.filter(id => id !== taskId));
    } else {
      setSelectedTaskIds([...selectedTaskIds, taskId]);
    }
  };

  return (
    <div className={`w-full relative pr-0 ${resolvedControlDeckOpen ? 'lg:pr-[368px]' : 'lg:pr-12'} pb-12 transition-all duration-300 ease-in-out`}>
      <div className="flex-grow min-w-0 space-y-6">
        <TaskInsights tasks={filteredTasks} />

      <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-black uppercase text-white tracking-widest">Neural Nodes</h2>
          <div className="bg-emerald-500/10 text-emerald-400 text-[9px] font-black px-2 py-1 rounded-lg border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]">
            {filteredTasks.length} <span className="text-emerald-400/50">/ {allTasks.length} Nodes</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Column Visibility Trigger Button */}
          <div className="relative">
            <button 
              onClick={() => setIsColumnDropdownOpen(!isColumnDropdownOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 border border-gray-700 text-white font-bold rounded-lg hover:bg-gray-700 transition-all text-[10px]"
              title="Toggle Columns"
            >
              <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 4.5v15m6-15v15m-12-3h18" />
              </svg>
              <span>Dynamic Columns</span>
            </button>
            {isColumnDropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-[#0E1314] border border-white/10 rounded-xl shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest px-2 py-1 mb-1 border-b border-white/5">Show/Hide Columns</p>
                {Object.keys(visibleColumns).map((key) => (
                  <label key={key} className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-semibold text-gray-300 hover:text-white hover:bg-white/5 cursor-pointer capitalize">
                    <input 
                      type="checkbox" 
                      checked={visibleColumns[key as keyof typeof visibleColumns]}
                      onChange={() => setVisibleColumns({
                        ...visibleColumns,
                        [key]: !visibleColumns[key as keyof typeof visibleColumns]
                      })}
                      className="rounded border-white/10 bg-black/40 text-emerald-500 focus:ring-emerald-500 accent-emerald-500 w-3.5 h-3.5 cursor-pointer"
                    />
                    <span>{key === 'id' ? 'ID' : key}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center p-1 bg-[#1C2326] rounded-lg">
            <button onClick={() => setViewMode('all')} className={`px-2.5 py-1 text-[10px] font-bold rounded-md ${viewMode === 'all' ? 'bg-gray-700 text-white' : 'hover:bg-gray-800/50 text-gray-400'}`}>
              Global
            </button>
            <button onClick={() => setViewMode('my')} className={`px-2.5 py-1 text-[10px] font-bold rounded-md ${viewMode === 'my' ? 'bg-gray-700 text-white' : 'hover:bg-gray-800/50 text-gray-400'}`}>
              Personal
            </button>
          </div>
          <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 border border-gray-700 text-white font-bold rounded-lg hover:bg-gray-700 transition-all text-[10px]" title="Export CSV">
            <DownloadIcon className="w-3.5 h-3.5" /> <span>CSV</span>
          </button>
          <button onClick={handleExportPdf} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 border border-gray-700 text-white font-bold rounded-lg hover:bg-gray-700 transition-all text-[10px]" title="Export PDF">
            <DownloadIcon className="w-3.5 h-3.5" /> <span>PDF</span>
          </button>
        </div>
      </div>
      
      <div className="mb-4">
        {/* Segment Tabs for Global View */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-3 mb-1">
            <button 
                onClick={() => handleApplySegment('all')} 
                className={`px-4 py-1.5 flex-shrink-0 text-[10px] font-bold uppercase tracking-widest rounded-full transition-all ${activeSegmentId === 'all' ? 'bg-white text-black shadow-lg shadow-white/5' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
            >
                All Scope
            </button>
            {segments
              .filter(segment => segment.name.toUpperCase() !== 'ADD')
              .map(segment => (
                <div key={segment.id} className="relative group flex-shrink-0">
                    <button 
                        onClick={() => handleApplySegment(segment.id)} 
                        className={`pl-4 ${activeSegmentId === segment.id ? 'pr-8' : 'pr-4'} py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-full transition-all ${activeSegmentId === segment.id ? 'bg-white text-black shadow-lg shadow-white/5' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
                    >
                        {segment.name}
                    </button>
                    {activeSegmentId === segment.id && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); handleDeleteSegment(segment.id); }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-black hover:text-red-600 transition-colors"
                            title="Delete this view"
                        >
                            <XIcon className="w-3 h-3" />
                        </button>
                    )}
                </div>
            ))}
        </div>

      </div>

      <div className="bg-[#131C1B]/80 backdrop-blur-xl rounded-xl border border-white/5 overflow-hidden shadow-2xl relative">
        {/* Sticky Header with Sorting columns */}
        <div className="sticky top-0 z-10 flex items-center gap-4 px-6 py-3 border-b border-white/5 bg-[#101718]">
          
          <div className="w-10 flex-shrink-0">
            <input 
              type="checkbox" 
              checked={isAllSelected}
              onChange={handleSelectAllToggle}
              className="w-4 h-4 rounded border-white/10 bg-black/40 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0 focus:outline-none cursor-pointer transition-all accent-emerald-500"
            />
          </div>

          {visibleColumns.id && (
            <button 
              onClick={() => handleSort('ticketId')}
              className="w-20 flex-shrink-0 text-left font-black text-[9px] uppercase tracking-[0.2em] text-gray-500 flex items-center gap-1 hover:text-emerald-400 transition-colors"
            >
              <span>ID</span>
              {sortField === 'ticketId' && (sortDirection === 'asc' ? '↑' : '↓')}
            </button>
          )}

          {visibleColumns.title && (
            <button 
              onClick={() => handleSort('title')}
              className="flex-grow text-left font-black text-[9px] uppercase tracking-[0.2em] text-gray-500 flex items-center gap-1 hover:text-emerald-400 transition-colors"
            >
              <span>Node Cluster</span>
              {sortField === 'title' && (sortDirection === 'asc' ? '↑' : '↓')}
            </button>
          )}

          {visibleColumns.project && (
            <button 
              onClick={() => handleSort('projectName')}
              className="w-32 flex-shrink-0 text-left font-black text-[9px] uppercase tracking-[0.2em] text-gray-500 flex items-center gap-1 hover:text-emerald-400 transition-colors"
            >
              <span>Project Nexus</span>
              {sortField === 'projectName' && (sortDirection === 'asc' ? '↑' : '↓')}
            </button>
          )}

          {visibleColumns.priority && (
            <button 
              onClick={() => handleSort('priority')}
              className="w-24 flex-shrink-0 text-left font-black text-[9px] uppercase tracking-[0.2em] text-gray-500 flex items-center gap-1 hover:text-emerald-400 transition-colors"
            >
              <span>Priority</span>
              {sortField === 'priority' && (sortDirection === 'asc' ? '↑' : '↓')}
            </button>
          )}

          {visibleColumns.status && (
            <button 
              onClick={() => handleSort('columnName')}
              className="w-28 flex-shrink-0 text-left font-black text-[9px] uppercase tracking-[0.2em] text-gray-500 flex items-center gap-1 hover:text-emerald-400 transition-colors"
            >
              <span>Status</span>
              {sortField === 'columnName' && (sortDirection === 'asc' ? '↑' : '↓')}
            </button>
          )}

          {visibleColumns.assignee && (
            <button 
              onClick={() => handleSort('assignee')}
              className="w-36 flex-shrink-0 text-right font-black text-[9px] uppercase tracking-[0.2em] text-gray-500 flex items-center justify-end gap-1 hover:text-emerald-400 transition-colors"
            >
              <span>Resource</span>
              {sortField === 'assignee' && (sortDirection === 'asc' ? '↑' : '↓')}
            </button>
          )}
        </div>

        <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
            {paginatedTasks.length > 0 ? (
                paginatedTasks.map(task => (
                    <TaskListRow 
                      key={task.id} 
                      task={task} 
                      onClick={onTaskClick} 
                      users={users} 
                      visibleColumns={visibleColumns}
                      isSelected={selectedTaskIds.includes(task.id)}
                      onToggleSelect={() => handleSelectTaskToggle(task.id)}
                    />
                ))
            ) : (
                <div className="p-16 text-center text-gray-500 font-mono text-xs italic uppercase tracking-widest">
                    NO NEURAL TASKS FOUND IN SCOPE
                </div>
            )}
        </div>
      </div>
      <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} itemsPerPage={ITEMS_PER_PAGE} totalItems={filteredTasks.length} />

      {/* Floating Action Drawer for Bulk Actions */}
      {selectedTaskIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#0E1314]/95 border border-emerald-500/30 rounded-2xl p-4 shadow-2xl flex items-center gap-6 z-50 animate-in slide-in-from-bottom duration-250 backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="w-2 h-2 rounded-full bg-emerald-500 absolute" />
            <span className="text-xs font-bold text-white pl-3">{selectedTaskIds.length} tasks selected</span>
          </div>
          <div className="h-4 w-px bg-white/10" />
          <div className="flex items-center gap-2">
            <button 
              onClick={() => {
                const selectedTasks = allTasks.filter(t => selectedTaskIds.includes(t.id));
                exportAugmentedTasksToCsv(selectedTasks, users, "Selected_Scope");
              }}
              className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold rounded-lg hover:bg-emerald-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <DownloadIcon className="w-3 h-3" />
              <span>Export Selected CSV</span>
            </button>
            <button 
              onClick={() => {
                const selectedTasks = allTasks.filter(t => selectedTaskIds.includes(t.id));
                exportTasksToPdf(selectedTasks, "Selected_Scope");
              }}
              className="px-3 py-1.5 bg-gray-800 text-white border border-gray-700 text-[10px] font-bold rounded-lg hover:bg-gray-700 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <DownloadIcon className="w-3 h-3" />
              <span>Export Selected PDF</span>
            </button>
            <button 
              onClick={() => setSelectedTaskIds([])}
              className="px-3 py-1.5 bg-transparent text-gray-400 hover:text-white text-[10px] font-semibold rounded-lg transition-all"
            >
              Clear Selected
            </button>
          </div>
        </div>
      )}
      </div>

      <RightControlDeck
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        assignees={Object.values(users || {})}
        sprints={allSprints}
        statuses={allStatuses}
        tags={allTags}
        priorityFilter={priorityFilter}
        setPriorityFilter={setPriorityFilter}
        assigneeFilter={assigneeFilter}
        setAssigneeFilter={setAssigneeFilter}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        tagFilter={tagFilter}
        setTagFilter={setTagFilter}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        onClearFilters={handleClearFilters}
        onExportCsv={handleExport}
        onExportPdf={handleExportPdf}
        filteredCount={filteredTasks.length}
        totalCount={allTasks.length}
        isOpen={resolvedControlDeckOpen}
        onToggleIsOpen={resolvedSetControlDeckOpen}
      />
    </div>
  );
};