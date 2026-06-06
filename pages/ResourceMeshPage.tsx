import React, { useState, useMemo, useEffect } from 'react';
import { Project, User, Task } from '../types';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ResourceNeuralGraph } from '../components/ResourceNeuralGraph';
import { UserActivityGraph } from '../components/UserActivityGraph';
import { useConfirmation } from '../App';
import { 
  Zap, 
  Plus, 
  Trash2, 
  Copy, 
  Check, 
  ExternalLink,
  Info,
  RefreshCw,
  GitBranch,
  FileCode,
  Globe,
  ArrowLeft
} from 'lucide-react';

interface ResourceMeshPageProps {
  projects: Record<string, Project>;
  users: Record<string, User>;
  onlineUsers: Set<string>;
  currentUser: User;
  onTaskClick: (task: Task) => void;
  addProjectLink: (projectId: string, title: string, url: string, creatorId: string) => Promise<void>;
  deleteProjectLink: (linkId: string) => Promise<void>;
}

export const ResourceMeshPage: React.FC<ResourceMeshPageProps> = ({
  projects,
  users,
  onlineUsers,
  currentUser,
  onTaskClick,
  addProjectLink,
  deleteProjectLink
}) => {
  const { projectId: routeProjectId } = useParams<{ projectId?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const requestConfirmation = useConfirmation();

  // Local project context
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  
  // Link builder form state
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [isAddingLink, setIsAddingLink] = useState(false);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);

  const projectList = useMemo(() => Object.values(projects || {}) as Project[], [projects]);

  // Sync route param with project selector state
  useEffect(() => {
    if (routeProjectId && projects[routeProjectId]) {
      setSelectedProjectId(routeProjectId);
    } else {
      setSelectedProjectId('all');
    }
  }, [routeProjectId, projects]);

  const getActiveProject = (): Project | undefined => {
    if (selectedProjectId === 'all') {
      return projectList[0]; // fallback project to allow adding links
    }
    return projects[selectedProjectId];
  };

  const activeProject = getActiveProject();

  const getLinkIcon = (url: string) => {
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('github.com')) return <GitBranch className="w-4 h-4 text-emerald-400" />;
    if (lowerUrl.includes('figma.com')) return <FileCode className="w-4 h-4 text-purple-400" />;
    return <Globe className="w-4 h-4 text-blue-400" />;
  };

  const handleAddLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const proj = getActiveProject();
    if (!proj) return;
    if (!linkTitle.trim() || !linkUrl.trim()) return;

    setIsAddingLink(true);
    try {
      await addProjectLink(proj.id, linkTitle.trim(), linkUrl.trim(), currentUser.id);
      setLinkTitle('');
      setLinkUrl('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsAddingLink(false);
    }
  };

  const handleDeleteLink = (linkId: string, title: string) => {
    requestConfirmation({
      title: 'Sever Connection Node',
      message: (
        <>
          Are you sure you want to disconnect <strong>"{title}"</strong> from the Neural Mesh?
        </>
      ),
      confirmText: 'Disconnect',
      onConfirm: async () => {
        await deleteProjectLink(linkId);
      }
    });
  };

  const handleCopyLink = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedLinkId(id);
    setTimeout(() => setCopiedLinkId(null), 2000);
  };

  const totalConnections = useMemo(() => {
    if (selectedProjectId === 'all') {
      return projectList.reduce((sum, p) => sum + (p.links?.length || 0), 0);
    }
    return projects[selectedProjectId]?.links?.length || 0;
  }, [selectedProjectId, projects, projectList]);

  const handleBack = () => {
    if (routeProjectId) {
      navigate(`/project/${routeProjectId}`);
    } else {
      navigate('/resources');
    }
  };

  // Get current path's display name
  const currentPathName = useMemo(() => {
    if (selectedProjectId === 'all') return 'Global Workspace';
    return projects[selectedProjectId]?.name || 'Workspace';
  }, [selectedProjectId, projects]);

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-[#0D1112]">
      {/* Standalone Header matches TaskDetailsPage style */}
      <header className="h-14 min-h-[56px] max-h-14 flex-shrink-0 border-b border-white/5 bg-[#0E1314]/85 backdrop-blur-xl px-6 flex items-center justify-between sticky top-0 z-35">
        <div className="flex items-center gap-3">
          <button 
            type="button" 
            onClick={handleBack}
            className="p-1 px-2 text-xs rounded bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-all flex items-center gap-1 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Back</span>
          </button>
          
          <div className="flex items-center gap-1.5 text-xs text-gray-400 font-semibold truncate whitespace-nowrap">
            <span className="text-gray-500 truncate hover:text-gray-300 cursor-pointer" onClick={() => navigate('/resources')}>
              Enterprise Core
            </span>
            <span className="text-gray-700">/</span>
            <span className="text-white bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 text-[11px] font-bold truncate">
              {currentPathName}
            </span>
            <span className="text-gray-700">/</span>
            <span className="text-gray-400 text-[11px] uppercase tracking-widest hidden sm:inline">
              Neural Mesh Grid
            </span>
          </div>
        </div>

        {/* Dynamic Project Context select nicely embedded in navbar */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-black/40 rounded-lg border border-white/10 px-2.5 py-1 text-xs">
            <span className="text-gray-505 uppercase tracking-wider text-[9px] font-black mr-2">CONTEXT:</span>
            <select
              value={selectedProjectId}
              onChange={(e) => {
                const targetProj = e.target.value;
                setSelectedProjectId(targetProj);
                if (targetProj !== 'all') {
                  navigate(`/project/${targetProj}/mesh${location.search}`, { replace: true });
                } else {
                  navigate(`/resources/mesh${location.search}`, { replace: true });
                }
              }}
              className="bg-transparent text-white font-bold text-[11px] focus:outline-none cursor-pointer pr-1"
            >
              <option value="all" className="bg-[#0E1314] text-white">Global Workspace (All Nodes)</option>
              {projectList.map((p) => (
                <option key={p.id} value={p.id} className="bg-[#0E1314] text-white">
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* Main Grid View */}
      <div className="flex-grow overflow-y-auto custom-scrollbar p-6">
        <div className="max-w-7xl mx-auto w-full space-y-8">
          
          {/* Header Title Section */}
          <div className="border-b border-white/5 pb-4">
            <h1 className="text-lg font-black uppercase tracking-[0.2em] text-white">Neural Mesh Grid</h1>
            <p className="text-xs text-gray-400 mt-1">
              Active workspace topology, external connectives, and user commit velocity displayed on a simple, flat grid system.
            </p>
          </div>

          {/* Simple Grid Structure */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Column 1 - Interactive Topology Map (8 Cols width) */}
            <div className="lg:col-span-8 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-widest text-emerald-400">Topology Workspace</h3>
                <span className="text-[10px] font-mono text-gray-500">LATENCY: 2.4MS</span>
              </div>
              
              {/* Simple flat container for Topology Map graph with clean border */}
              <div className="h-[480px] bg-black/20 border border-white/10 rounded-xl overflow-hidden relative">
                <ResourceNeuralGraph 
                  projects={selectedProjectId === 'all' ? projects : { [selectedProjectId]: projects[selectedProjectId] }}
                  users={users}
                  onlineUsers={onlineUsers}
                  onTaskClick={onTaskClick}
                />
              </div>

              <div className="flex items-start gap-2.5 text-[11px] text-gray-400 leading-relaxed max-w-2xl">
                <Info className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <p>
                  Topology highlights task connections and team focus. Pinch/scroll inside the grid frame to scale workspace depth, or drag inside empty spaces to traverse different clusters.
                </p>
              </div>
            </div>

            {/* Column 2 - Sync Connectors Interface (4 Cols width) */}
            <div className="lg:col-span-4 space-y-6">
              
              {/* Form segment - simple, clean, un-boxed layout */}
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-emerald-400">Add Connector Link</h3>
                
                {selectedProjectId === 'all' ? (
                  <div className="p-3.5 border border-dashed border-white/10 rounded-xl bg-white/[0.01]">
                    <p className="text-[11px] text-gray-400 text-center leading-normal">
                      Please select a specific project context from the top navigation dropdown to initialize a new connection endpoint.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleAddLink} className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Node Label</label>
                      <input 
                        type="text" 
                        value={linkTitle} 
                        onChange={e => setLinkTitle(e.target.value)}
                        placeholder="e.g. Master Repo, Figma Board"
                        className="w-full px-3.5 py-2 bg-black/40 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/30 transition-all"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Endpoint URL</label>
                      <input 
                        type="url" 
                        value={linkUrl} 
                        onChange={e => setLinkUrl(e.target.value)}
                        placeholder="https://github.com/..."
                        className="w-full px-3.5 py-2 bg-black/40 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/30 transition-all font-mono"
                        required
                      />
                    </div>

                    <button 
                      type="submit" 
                      disabled={isAddingLink || !linkTitle.trim() || !linkUrl.trim()}
                      className="w-full py-2 bg-white hover:bg-gray-200 text-black font-black uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-1.5 text-[10px] disabled:opacity-40 cursor-pointer"
                    >
                      {isAddingLink ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Plus className="w-3.5 h-3.5" />
                      )}
                      Add Connection
                    </button>
                  </form>
                )}
              </div>

              {/* Dynamic Links List - simple rows, no heavy boxed grids */}
              <div className="space-y-3">
                <h3 className="text-xs font-black uppercase tracking-widest text-emerald-400">
                  Active Connections {totalConnections > 0 && `(${totalConnections})`}
                </h3>

                <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                  {/* Selected Project Links vs Global Projects links */}
                  {selectedProjectId !== 'all' && activeProject?.links && activeProject.links.length > 0 ? (
                    activeProject.links.map((link) => (
                      <div key={link.id} className="group flex items-center justify-between py-2 border-b border-white/5 hover:border-white/10 transition-colors">
                        <div className="flex items-center gap-3 min-w-0 flex-grow pr-4">
                          <span className="shrink-0">{getLinkIcon(link.url)}</span>
                          <div className="truncate text-left">
                            <a 
                              href={link.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="font-bold text-xs text-white hover:text-emerald-450 transition-colors block truncate"
                            >
                              {link.title}
                            </a>
                            <span className="text-[10px] text-gray-500 font-mono truncate block">{link.url}</span>
                          </div>
                        </div>

                        {/* Control actions */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button 
                            type="button"
                            onClick={() => handleCopyLink(link.url, link.id)}
                            className="p-1.5 rounded hover:bg-white/5 text-gray-400 hover:text-white transition-colors cursor-pointer"
                            title="Copy URL"
                          >
                            {copiedLinkId === link.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-450" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button 
                            type="button"
                            onClick={() => handleDeleteLink(link.id, link.title)}
                            className="p-1.5 rounded hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition-colors cursor-pointer"
                            title="Remove Link"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : selectedProjectId === 'all' ? (
                    /* Render global flat rows from all projects */
                    (()=>{
                      const allLinks = projectList.flatMap(p => (p.links || []).map(link => ({ ...link, project: p })));
                      if (allLinks.length > 0) {
                        return allLinks.map((link) => (
                          <div key={link.id} className="group flex items-center justify-between py-2 border-b border-white/5 hover:border-white/10 transition-colors">
                            <div className="flex items-center gap-3 min-w-0 flex-grow pr-4 text-left">
                              <span className="shrink-0">{getLinkIcon(link.url)}</span>
                              <div className="truncate">
                                <a 
                                  href={link.url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="font-bold text-xs text-white hover:text-emerald-450 transition-colors block truncate"
                                >
                                  {link.title}
                                </a>
                                <span className="text-[9px] text-gray-500 tracking-wider truncate block">
                                  {link.project.name.toUpperCase()} • {link.url}
                                </span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleCopyLink(link.url, link.id)}
                              className="p-1.5 rounded hover:bg-white/5 text-gray-400 hover:text-white shrink-0 cursor-pointer"
                              title="Copy URL"
                            >
                              {copiedLinkId === link.id ? <Check className="w-3.5 h-3.5 text-emerald-450" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        ));
                      }
                      return (
                        <p className="text-[11px] text-gray-500 py-4 text-center">No active connection endpoints.</p>
                      );
                    })()
                  ) : (
                    <p className="text-[11px] text-gray-500 py-4 text-center">No connections mapped to this project cell yet.</p>
                  )}
                </div>
              </div>

            </div>
          </div>

          {/* Simple Bottom Row - Activity Grid HeatMap */}
          <div className="border-t border-white/5 pt-8 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-emerald-400">Node Load Velocity</h3>
            <div className="bg-black/10 border border-white/10 rounded-xl p-4 md:p-6 overflow-x-auto">
              <UserActivityGraph 
                projects={projects}
                users={users}
                onlineUsers={onlineUsers}
                onTaskClick={onTaskClick}
              />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
