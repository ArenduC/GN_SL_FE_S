import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Database, 
  Key, 
  Layers, 
  Bug, 
  ArrowRight, 
  Maximize2, 
  Minimize2, 
  MousePointer, 
  Activity, 
  ExternalLink,
  Plus,
  HelpCircle,
  Hash,
  Clock,
  Briefcase
} from 'lucide-react';
import { Task, User } from '../types';

interface NodeData {
  id: string;
  type: 'task' | 'bug';
  label: string;
  status: string;
  role: 'parent' | 'selected' | 'child' | 'sibling';
  ticketId: string;
  priority: string;
  assignee?: User;
  dueDate?: string;
}

interface EdgeData {
  source: string;
  target: string;
  relation: string;
}

interface TaskSchemaGraphVisualizerProps {
  currentTask: Task;
  allTasks: Task[];
  projectMembers: User[];
  onSelectTask: (task: Task) => void;
  onClose?: () => void;
}

export const TaskSchemaGraphVisualizer: React.FC<TaskSchemaGraphVisualizerProps> = ({
  currentTask,
  allTasks,
  projectMembers,
  onSelectTask,
  onClose,
}) => {
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Element refs to dynamically calculate connections
  const nodeRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // 1. Build the Node & Edge lists matching the user's specific JSON graph structure
  const graphData = useMemo(() => {
    const nodes: NodeData[] = [];
    const edges: EdgeData[] = [];

    // Main selected task
    nodes.push({
      id: currentTask.id,
      type: currentTask.taskType || 'task',
      label: currentTask.title,
      status: currentTask.columnName || 'Todo',
      role: 'selected',
      ticketId: currentTask.ticketId,
      priority: currentTask.priority,
      assignee: currentTask.assignee,
      dueDate: currentTask.dueDate || undefined,
    });

    // Parent Task (if nested)
    let parentId = currentTask.parentId;
    if (parentId) {
      const parent = allTasks.find(t => t.id === parentId);
      if (parent) {
        nodes.push({
          id: parent.id,
          type: parent.taskType || 'task',
          label: parent.title,
          status: parent.columnName || 'Todo',
          role: 'parent',
          ticketId: parent.ticketId,
          priority: parent.priority,
          assignee: parent.assignee,
          dueDate: parent.dueDate || undefined,
        });

        edges.push({
          source: parent.id,
          target: currentTask.id,
          relation: 'parent-to-child'
        });

        // Siblings (tasks with same parent, excluding self)
        const siblings = allTasks.filter(t => t.parentId === parentId && t.id !== currentTask.id);
        siblings.forEach(sib => {
          nodes.push({
            id: sib.id,
            type: sib.taskType || 'task',
            label: sib.title,
            status: sib.columnName || 'Todo',
            role: 'sibling',
            ticketId: sib.ticketId,
            priority: sib.priority,
            assignee: sib.assignee,
            dueDate: sib.dueDate || undefined,
          });

          edges.push({
            source: parent.id,
            target: sib.id,
            relation: 'parent-to-child'
          });
        });
      }
    }

    // Children Tasks
    const children = allTasks.filter(t => t.parentId === currentTask.id);
    children.forEach(child => {
      nodes.push({
        id: child.id,
        type: child.taskType || 'task',
        label: child.title,
        status: child.columnName || 'Todo',
        role: 'child',
        ticketId: child.ticketId,
        priority: child.priority,
        assignee: child.assignee,
        dueDate: child.dueDate || undefined,
      });

      edges.push({
        source: currentTask.id,
        target: child.id,
        relation: 'parent-to-child'
      });
    });

    return { nodes, edges };
  }, [currentTask, allTasks]);

  // Handle graph mouse dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.node-card')) return; // ignore if clicking a card
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleZoom = (direction: 'in' | 'out' | 'reset') => {
    if (direction === 'in') setScale(prev => Math.min(prev + 0.1, 1.5));
    if (direction === 'out') setScale(prev => Math.max(prev - 0.1, 0.5));
    if (direction === 'reset') {
      setScale(1);
      setPan({ x: 0, y: 0 });
    }
  };

  // Redraw links on scroll/resize/render
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 });
  const [edgeCoords, setEdgeCoords] = useState<{ id: string; d: string }[]>([]);

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [graphData]);

  // Dynamically calculate coordinate paths for schema connectors
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const coords = graphData.edges.map((edge, idx) => {
        const srcEl = nodeRefs.current[edge.source];
        const tgtEl = nodeRefs.current[edge.target];
        if (!srcEl || !tgtEl) return null;

        const srcRect = srcEl.getBoundingClientRect();
        const tgtRect = tgtEl.getBoundingClientRect();

        // Target local coords relative to container
        const x1 = (srcRect.left + srcRect.width - containerRect.left - pan.x) / scale;
        const y1 = (srcRect.top + srcRect.height / 2 - containerRect.top - pan.y) / scale;

        const x2 = (tgtRect.left - containerRect.left - pan.x) / scale;
        const y2 = (tgtRect.top + tgtRect.height / 2 - containerRect.top - pan.y) / scale;

        // Draw perfect database connection bezier link
        const dx = Math.abs(x2 - x1) * 0.5;
        const d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

        return {
          id: `${edge.source}-${edge.target}-${idx}`,
          d
        };
      }).filter(Boolean) as { id: string; d: string }[];

      setEdgeCoords(coords);
    }, 150);

    return () => clearTimeout(timer);
  }, [graphData, pan, scale, dimensions]);

  // Classify nodes into logical relational columns for neat database layout
  const groupedNodes = useMemo(() => {
    const parents = graphData.nodes.filter(n => n.role === 'parent');
    const selectedAndSiblings = graphData.nodes.filter(n => n.role === 'selected' || n.role === 'sibling');
    const children = graphData.nodes.filter(n => n.role === 'child');

    return { parents, selectedAndSiblings, children };
  }, [graphData]);

  return (
    <div className="w-full bg-[#0B0F11] border border-white/10 rounded-xl overflow-hidden relative shadow-2xl flex flex-col h-[520px] select-none">
      
      {/* Visualizer header controls */}
      <div className="bg-[#101618] border-b border-white/10 px-4 py-3 flex items-center justify-between z-20">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-emerald-400" />
          <span className="text-[11px] font-mono font-bold tracking-wider uppercase text-white">
            RELATIONAL ENTITY GRAPH SCHEMATICS 
          </span>
          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] px-1.5 py-0.5 rounded font-mono font-bold uppercase tracking-wider">
            {currentTask.ticketId}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="bg-[#1C2326] border border-white/5 rounded-lg p-0.5 flex items-center gap-1">
            <button
              onClick={() => handleZoom('out')}
              className="text-[10px] text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-white/5 font-mono cursor-pointer transition-all"
              title="Zoom out"
            >
              -
            </button>
            <span className="text-[9px] font-mono text-gray-500 px-1">{Math.round(scale * 100)}%</span>
            <button
              onClick={() => handleZoom('in')}
              className="text-[10px] text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-white/5 font-mono cursor-pointer transition-all"
              title="Zoom in"
            >
              +
            </button>
            <button
              onClick={() => handleZoom('reset')}
              className="text-[9px] text-gray-450 hover:text-white px-2 py-1 rounded hover:bg-white/5 font-mono cursor-pointer transition-all uppercase"
              title="Reset viewport"
            >
              Reset
            </button>
          </div>
          
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-xs font-bold px-2 py-1 bg-[#1C2326] border border-white/5 rounded-lg hover:bg-white/10 transition-all cursor-pointer"
            >
              ✕ Close
            </button>
          )}
        </div>
      </div>

      {/* Main Graph Canvas Playground with dots blueprint grid */}
      <div 
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="flex-grow w-full relative overflow-hidden cursor-grab active:cursor-grabbing"
        style={{
          backgroundImage: 'radial-gradient(#1E2629 1px, transparent 1px)',
          backgroundSize: '16px 16px',
        }}
      >
        
        {/* Render live scalable/pannable schema canvas overlay */}
        <div
          className="absolute inset-0 origin-center transition-transform duration-100 ease-out"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
          }}
        >
          {/* SVG Connector links layer overlay */}
          <svg className="absolute top-0 left-0 w-[4000px] h-[4000px] pointer-events-none overflow-visible z-0">
            <defs>
              <linearGradient id="db-conn-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#10B981" />
                <stop offset="50%" stopColor="#3B82F6" />
                <stop offset="100%" stopColor="#A78BFA" />
              </linearGradient>
              <marker
                id="arrowhead"
                viewBox="0 0 10 10"
                refX="5"
                refY="5"
                markerWidth="4"
                markerHeight="4"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#10B981" />
              </marker>
              <marker
                id="dotConnection"
                viewBox="0 0 10 10"
                refX="5"
                refY="5"
                markerWidth="6"
                markerHeight="6"
              >
                <circle cx="5" cy="5" r="3" fill="#3b82f6" stroke="#ffffff" strokeWidth="1" />
              </marker>
            </defs>

            {/* Loop through calculated connector coordinates */}
            {edgeCoords.map((edge) => (
              <g key={edge.id}>
                {/* Visual backdrop shadow path for glow */}
                <path
                  d={edge.d}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="3.5"
                  className="opacity-15 blur-[2px]"
                />
                {/* Active vector line */}
                <path
                  d={edge.d}
                  fill="none"
                  stroke="url(#db-conn-grad)"
                  strokeWidth="1.5"
                  markerEnd="url(#dotConnection)"
                  markerStart="url(#dotConnection)"
                  strokeDasharray="4 2"
                  className="stroke-[url(#db-conn-grad)]"
                />
              </g>
            ))}
          </svg>

          {/* Relational columns containing ER styled Task cards */}
          <div className="absolute top-12 left-10 flex gap-24 items-start select-none z-10" style={{ width: '920px' }}>
            
            {/* COLUMN 1: UPSTREAM PARENTS */}
            <div className="w-[280px] flex flex-col gap-6">
              <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest px-1 font-bold border-b border-white/5 pb-1 select-none">
                Parents / Upstream (ID ref)
              </div>
              {groupedNodes.parents.length === 0 ? (
                <div className="bg-[#0F1517] border border-white/5 rounded-lg p-6 text-center text-[10px] text-gray-500 border-dashed select-none">
                  Absolute Genesis Node (No relational parent key)
                </div>
              ) : (
                groupedNodes.parents.map(node => (
                  <SchemaNodeCard 
                    key={node.id} 
                    node={node} 
                    onSelectTask={onSelectTask} 
                    innerRef={(el) => nodeRefs.current[node.id] = el}
                  />
                ))
              )}
            </div>

            {/* COLUMN 2: ACTIVE FOCUS & SIBLINGS */}
            <div className="w-[280px] flex flex-col gap-6">
              <div className="text-[10px] font-mono text-emerald-500 uppercase tracking-widest px-1 font-bold border-b border-emerald-500/10 pb-1 select-none">
                Focus Instance & Peer Tasks ({groupedNodes.selectedAndSiblings.length})
              </div>
              {groupedNodes.selectedAndSiblings.map(node => (
                <SchemaNodeCard 
                  key={node.id} 
                  node={node} 
                  onSelectTask={onSelectTask} 
                  innerRef={(el) => nodeRefs.current[node.id] = el}
                />
              ))}
            </div>

            {/* COLUMN 3: DOWNSTREAM DEPENDENT CHILDREN */}
            <div className="w-[280px] flex flex-col gap-6">
              <div className="text-[10px] font-mono text-blue-400 uppercase tracking-widest px-1 font-bold border-b border-white/5 pb-1 select-none">
                Downstream Leaf Keys ({groupedNodes.children.length})
              </div>
              {groupedNodes.children.length === 0 ? (
                <div className="bg-[#0F1517] border border-white/5 rounded-lg p-6 text-center text-[10px] text-gray-500 border-dashed select-none">
                  Leaf Node (No linked sub-dependencies spawned)
                </div>
              ) : (
                groupedNodes.children.map(node => (
                  <SchemaNodeCard 
                    key={node.id} 
                    node={node} 
                    onSelectTask={onSelectTask} 
                    innerRef={(el) => nodeRefs.current[node.id] = el}
                  />
                ))
              )}
            </div>

          </div>
        </div>
      </div>
      
      {/* Help footer bar */}
      <div className="bg-[#101618] border-t border-white/5 px-4 py-2 flex items-center justify-between text-[10px] text-gray-500 font-mono">
        <div className="flex items-center gap-2">
          <Activity className="w-3.1 h-3.1 text-blue-400 animate-pulse" />
          <span>Interactive Canvas. Drag to pan workspace, scroll to zoom. Click any key link to traverse tree.</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> Parent Link</span>
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-blue-500 rounded-full" /> Sibling</span>
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-purple-500 rounded-full" /> Child</span>
        </div>
      </div>
    </div>
  );
};

/* SCHEMA NOTATIONS SUB-ELEMENT CARD EXECUTED FLUSH ACCORDING TO HIGH-RESOLUTION DESIGN GUIDELINES */
interface SchemaNodeCardProps {
  node: NodeData;
  onSelectTask: (task: Task) => void;
  innerRef: (el: HTMLDivElement | null) => void;
}

const SchemaNodeCard: React.FC<SchemaNodeCardProps> = ({ node, onSelectTask, innerRef }) => {
  const isSelected = node.role === 'selected';
  
  const handleCardClick = (e: React.MouseEvent) => {
    // Avoid double trigger if clicking internal actions
    if ((e.target as HTMLElement).closest('.nav-trigger')) return;
    
    // Create standard mock or load task
    onSelectTask({
      id: node.id,
      title: node.label,
      ticketId: node.ticketId,
      taskType: node.type,
      columnName: node.status,
      priority: node.priority as any,
      assignee: node.assignee,
      dueDate: node.dueDate,
    } as any);
  };

  return (
    <div 
      ref={innerRef}
      onClick={handleCardClick}
      className={`node-card text-left bg-[#0E1315] border rounded-lg overflow-hidden shadow-lg transition-all duration-250 cursor-pointer min-w-[260px] ${
        isSelected 
          ? 'border-emerald-500 bg-[#0F1C1C]' 
          : 'border-white/10 hover:border-white/20 hover:shadow-xl'
      }`}
    >
      {/* 1. Header of DB Table representing Task type/role */}
      <div className={`px-2.5 py-1.5 flex items-center justify-between text-[10px] font-mono select-none ${
        isSelected ? 'bg-emerald-500/10 text-emerald-400 border-b border-emerald-500/10' : 'bg-[#141A1C] text-gray-400 border-b border-white/5'
      }`}>
        <div className="flex items-center gap-1 font-bold">
          <Database className="w-3 h-3 flex-shrink-0 opacity-80" />
          <span>{node.role.toUpperCase()}</span>
        </div>
        <span className={`text-[8.5px] px-1 py-0.2 rounded font-extrabold uppercase font-mono border ${
          node.type === 'bug' ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-blue-500/10 border-blue-500/20 text-blue-400'
        }`}>
          {node.type}
        </span>
      </div>

      {/* 2. List of Fields/Columns representing DB Attributes exactly */}
      <div className="p-2 space-y-1 text-[11px] font-mono leading-tight">
        
        {/* FIELD 1: Primary Key ID */}
        <div className="flex justify-between items-center px-1 py-0.5 rounded hover:bg-white/[0.02]">
          <div className="flex items-center gap-1.5 text-gray-300">
            <Key className="w-3 h-3 text-yellow-500 rotate-45 flex-shrink-0" />
            <span className="font-bold">id</span>
          </div>
          <span className="text-gray-500 text-[9.5px]">uuid [pk]</span>
        </div>

        {/* FIELD 2: ticketId */}
        <div className="flex justify-between items-center px-1 py-0.5 rounded hover:bg-white/[0.02]">
          <div className="flex items-center gap-1.5 text-emerald-400">
            <Hash className="w-3 h-3 flex-shrink-0 opacity-80" />
            <span className="font-black">{node.ticketId}</span>
          </div>
          <span className="text-gray-500 text-[9.5px]">varchar({node.ticketId.length})</span>
        </div>

        {/* FIELD 3: label/title (varchar) with click action */}
        <div className="px-1 border-t border-dashed border-white/5 pt-1 mt-1">
          <span className="text-[9px] text-gray-500 block">label_title text</span>
          <p className="text-white text-xs font-bold leading-tight line-clamp-2 mt-0.5 hover:text-blue-300 font-sans tracking-tight">
            {node.label}
          </p>
        </div>

        {/* FIELD 4: priority with values */}
        <div className="flex justify-between items-center px-1 py-0.5 rounded hover:bg-white/[0.02] border-t border-dashed border-white/5 pt-1 mt-1">
          <div className="text-gray-400 flex items-center gap-1">
            <Activity className="w-3 h-3 text-amber-500 flex-shrink-0" />
            <span>priority</span>
          </div>
          <span className={`text-[9.5px] font-bold px-1 rounded uppercase ${
            node.priority === 'URGENT' ? 'text-red-400 bg-red-500/5' :
            node.priority === 'HIGH' ? 'text-amber-400 bg-amber-500/5' : 'text-blue-400 bg-blue-500/5'
          }`}>{node.priority}</span>
        </div>

        {/* FIELD 5: relation / parent references */}
        {node.role !== 'parent' && (
          <div className="flex justify-between items-center px-1 py-0.5 rounded hover:bg-white/[0.02]">
            <div className="text-gray-400 flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500/40" />
              <span>parentId</span>
            </div>
            <span className="text-gray-500 text-[9.5px] text-right truncate max-w-[80px]">uuid [fk]</span>
          </div>
        )}

        {/* FIELD 6: status */}
        <div className="flex justify-between items-center px-1 py-0.5 rounded hover:bg-white/[0.02]">
          <div className="text-gray-400 flex items-center gap-1">
            <Briefcase className="w-3 h-3 text-cyan-400 flex-shrink-0" />
            <span>status</span>
          </div>
          <span className="text-white text-[10px] bg-white/5 px-1 rounded font-sans">{node.status}</span>
        </div>

        {/* FIELD 7: assignee */}
        <div className="flex justify-between items-center px-1 py-0.5 rounded hover:bg-white/[0.02]">
          <div className="text-gray-400">assignee</div>
          <span className="text-gray-450 text-[10px] truncate max-w-[110px] font-sans">
            {node.assignee ? node.assignee.name : 'Unassigned'}
          </span>
        </div>

      </div>

      {/* Traversal pointer footer indicator */}
      <div className="bg-[#111719] px-2 py-1 flex items-center justify-between text-[8px] font-mono text-gray-500 border-t border-white/5">
        <span>traversal_node</span>
        <span className="nav-trigger text-blue-400 flex items-center gap-1 font-semibold hover:text-white transition-colors cursor-pointer select-none">
          TRAVERSE <ExternalLink className="w-2.5 h-2.5" />
        </span>
      </div>
    </div>
  );
};
