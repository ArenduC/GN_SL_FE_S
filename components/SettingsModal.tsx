
import React, { useState, FormEvent, useEffect } from 'react';
import { User, Project } from '../types';
import { XIcon, TrashIcon, UserIcon, SettingsIcon, LayoutDashboardIcon, SparklesIcon, ZapIcon, ShieldCheckIcon, LoaderCircleIcon, EyeIcon, EyeOffIcon } from './Icons';
import { useConfirmation } from '../App';
import { validateGeminiKey } from '../services/geminiService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onUpdateUser: (updates: { name: string }) => Promise<void>;
  featureFlags: { ai: boolean, voice: boolean };
  onFlagsChange: (flags: { ai: boolean, voice: boolean }) => void;
  projects: Project[];
  onDeleteProject: (projectId: string) => Promise<void>;
  onShowPrivacy: () => void;
  onPreferencesChange?: () => void;
}

type Tab = 'general' | 'profile' | 'projects' | 'neural' | 'billing';

const ToggleSwitch: React.FC<{ label: string, enabled: boolean, onChange: (enabled: boolean) => void, disabled?: boolean }> = ({ label, enabled, onChange, disabled }) => (
    <div className={`flex items-center justify-between ${disabled ? 'opacity-50' : ''}`}>
        <span className="font-medium text-white">{label}</span>
        <button
            type="button"
            role="switch"
            aria-checked={enabled}
            disabled={disabled}
            onClick={() => onChange(!enabled)}
            className={`${enabled ? 'bg-gray-600' : 'bg-gray-800'} relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-[#131C1B]`}
        >
            <span
                aria-hidden="true"
                className={`${enabled ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
            />
        </button>
    </div>
);

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen, onClose, currentUser, onUpdateUser,
  featureFlags, onFlagsChange, projects, onDeleteProject,
  onShowPrivacy, onPreferencesChange,
}) => {
  const requestConfirmation = useConfirmation();
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [userName, setUserName] = useState(currentUser.name);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  
  // Workspace preference states
  const [prefView, setPrefView] = useState(() => localStorage.getItem('user_project_default_view') || 'board');
  const [prefProject, setPrefProject] = useState(() => localStorage.getItem('user_project_default_project') || '');
  const [prefTheme, setPrefTheme] = useState(() => localStorage.getItem('user_project_theme') || 'dark');
  const [prefTimezone, setPrefTimezone] = useState(() => localStorage.getItem('user_project_timezone') || 'UTC');

  // BYOK State
  const [apiKey, setApiKey] = useState(localStorage.getItem('user_gemini_api_key') || '');
  const [showKey, setShowKey] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [keyStatus, setKeyStatus] = useState<'none' | 'valid' | 'invalid'>(apiKey ? 'valid' : 'none');

  if (!isOpen) return null;
  
  const handleKeySave = async () => {
      if (!apiKey.trim()) {
          localStorage.removeItem('user_gemini_api_key');
          setKeyStatus('none');
          onFlagsChange({ ...featureFlags, ai: false, voice: false });
          return;
      }

      setIsValidating(true);
      const isValid = await validateGeminiKey(apiKey.trim());
      setIsValidating(false);

      if (isValid) {
          localStorage.setItem('user_gemini_api_key', apiKey.trim());
          setKeyStatus('valid');
          onFlagsChange({ ...featureFlags, ai: true, voice: true });
      } else {
          setKeyStatus('invalid');
          onFlagsChange({ ...featureFlags, ai: false, voice: false });
      }
  };

  const handleProfileSave = async (e: FormEvent) => {
    e.preventDefault();
    if (userName.trim() === currentUser.name) return;
    setIsSavingProfile(true);
    await onUpdateUser({ name: userName.trim() });
    setIsSavingProfile(false);
  };

  const updatePreference = (key: string, value: string) => {
    localStorage.setItem(key, value);
    if (key === 'user_project_default_view') setPrefView(value);
    if (key === 'user_project_default_project') setPrefProject(value);
    if (key === 'user_project_theme') setPrefTheme(value);
    if (key === 'user_project_timezone') setPrefTimezone(value);

    // Call callback to let parent know
    if (onPreferencesChange) {
      onPreferencesChange();
    }
  };
  
  const TabButton: React.FC<{ tabName: Tab; icon: React.ReactNode; children: React.ReactNode }> = ({ tabName, icon, children }) => (
    <button
      onClick={() => setActiveTab(tabName)}
      className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-md transition-colors ${activeTab === tabName ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800/50'}`}
    >
      {icon}
      {children}
    </button>
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#131C1B] rounded-lg shadow-2xl w-full max-w-3xl max-h-[80vh] flex" onClick={(e) => e.stopPropagation()}>
        <aside className="w-1/4 p-4 border-r border-gray-800 flex flex-col">
          <h2 className="text-base font-bold mb-6 text-white text-medium">Settings</h2>
          <nav className="space-y-2">
            <TabButton tabName="general" icon={<SettingsIcon className="w-5 h-5" />}>General</TabButton>
            <TabButton tabName="neural" icon={<SparklesIcon className="w-5 h-5 text-emerald-400" />}>Neural Link</TabButton>
            <TabButton tabName="profile" icon={<UserIcon className="w-5 h-5" />}>Profile</TabButton>
            <TabButton tabName="projects" icon={<LayoutDashboardIcon className="w-5 h-5" />}>Projects</TabButton>
            <TabButton tabName="billing" icon={<ZapIcon className="w-5 h-5 text-amber-400 animate-pulse" />}>Billing & Plan</TabButton>
          </nav>
        </aside>

        <main className="w-3/4 flex flex-col">
          <header className="p-4 border-b border-gray-800 flex justify-end items-center flex-shrink-0">
            <button onClick={onClose} className="p-2 rounded-full text-gray-400 hover:bg-gray-800 transition-colors">
              <XIcon className="w-6 h-6" />
            </button>
          </header>
          
          <div className="p-6 overflow-y-auto custom-scrollbar flex-grow">
            {activeTab === 'general' && (
              <div className="space-y-6">
                 <h3 className="text-lg font-bold text-white">General Setup & Defaults</h3>
                 
                 <div className="p-4 bg-gray-800/50 rounded-lg space-y-4">
                    {/* Project default view selector */}
                    <div>
                      <label htmlFor="prefView" className="block text-xs font-semibold text-gray-300 mb-1.5 uppercase tracking-wider text-[10px]">Default Project View</label>
                      <select 
                        id="prefView"
                        value={prefView}
                        onChange={(e) => updatePreference('user_project_default_view', e.target.value)}
                        className="w-full bg-[#1C2326] border border-gray-700 text-white rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500"
                      >
                        <option value="board">Kanban Board Layout</option>
                        <option value="table">Unified Table List</option>
                      </select>
                    </div>

                    {/* Preselected default project workspace */}
                    <div>
                      <label htmlFor="prefProject" className="block text-xs font-semibold text-gray-300 mb-1.5 uppercase tracking-wider text-[10px]">Primary Home Project</label>
                      <select 
                        id="prefProject"
                        value={prefProject}
                        onChange={(e) => updatePreference('user_project_default_project', e.target.value)}
                        className="w-full bg-[#1C2326] border border-gray-700 text-white rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500"
                      >
                        <option value="">Dashboard Overview (Global Workspace)</option>
                        {projects.map(proj => (
                          <option key={proj.id} value={proj.id}>{proj.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Custom app theme styling selector */}
                    <div>
                      <label htmlFor="prefTheme" className="block text-xs font-semibold text-gray-300 mb-1.5 uppercase tracking-wider text-[10px]">Project Theme Mode</label>
                      <select 
                        id="prefTheme"
                        value={prefTheme}
                        onChange={(e) => updatePreference('user_project_theme', e.target.value)}
                        className="w-full bg-[#1C2326] border border-gray-700 text-white rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500"
                      >
                        <option value="dark">Deep Cyber Dark</option>
                        <option value="gray">Slate Industrial Gray</option>
                        <option value="light">Polished Paper Light</option>
                      </select>
                    </div>

                    {/* Standard Timezone selector */}
                    <div>
                      <label htmlFor="prefTimezone" className="block text-xs font-semibold text-gray-300 mb-1.5 uppercase tracking-wider text-[10px]">Time Zone Offset</label>
                      <select 
                        id="prefTimezone"
                        value={prefTimezone}
                        onChange={(e) => updatePreference('user_project_timezone', e.target.value)}
                        className="w-full bg-[#1C2326] border border-gray-700 text-white rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500"
                      >
                        <option value="UTC">Coordinated Universal Time (UTC)</option>
                        <option value="IST">India Standard Time (IST - UTC+5:30)</option>
                      </select>
                    </div>

                    <div className="h-px bg-gray-700/50 my-4" />

                    <ToggleSwitch 
                        label="AI Active Processing" 
                        enabled={featureFlags.ai} 
                        disabled={keyStatus !== 'valid'}
                        onChange={enabled => onFlagsChange({...featureFlags, ai: enabled})} 
                    />
                    <ToggleSwitch 
                        label="Voice Protocol Assistant" 
                        enabled={featureFlags.voice} 
                        disabled={keyStatus !== 'valid'}
                        onChange={enabled => onFlagsChange({...featureFlags, voice: enabled})} 
                    />
                 </div>
              </div>
            )}

            {activeTab === 'neural' && (
              <div className="space-y-6">
                 <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <SparklesIcon className="w-5 h-5 text-emerald-400" />
                    Neural Interface Configuration
                 </h3>
                 <div className="p-5 bg-emerald-500/5 border border-emerald-500/10 rounded-xl space-y-4">
                    <p className="text-xs text-gray-400 leading-relaxed font-medium">
                        To enable advanced synthesis, automated project planning, and the Neural Nexus, provide your <strong>Gemini API Key</strong>. Your key is stored locally in your browser and never leaves this domain.
                    </p>
                    
                    <div className="relative">
                        <input
                            type={showKey ? 'text' : 'password'}
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="Enter Gemini API Key..."
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 pr-12 transition-all"
                        />
                        <button 
                            type="button"
                            onClick={() => setShowKey(!showKey)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                        >
                            {showKey ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                        </button>
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            {keyStatus === 'valid' ? (
                                <div className="flex items-center gap-2 text-emerald-400 text-[10px] font-black uppercase tracking-widest">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    Link Active
                                </div>
                            ) : keyStatus === 'invalid' ? (
                                <div className="flex items-center gap-2 text-red-400 text-[10px] font-black uppercase tracking-widest">
                                    <XIcon className="w-3 h-3" />
                                    Invalid Protocol
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 text-gray-500 text-[10px] font-black uppercase tracking-widest">
                                    No Link Detected
                                </div>
                            )}
                        </div>
                        
                        <button 
                            type="button"
                            onClick={handleKeySave}
                            disabled={isValidating}
                            className="flex items-center gap-2 px-5 py-2 bg-emerald-500 text-black font-black uppercase tracking-widest text-[10px] rounded-lg hover:bg-emerald-400 transition-all disabled:opacity-50"
                        >
                            {isValidating ? <LoaderCircleIcon className="w-3 h-3 animate-spin" /> : <ZapIcon className="w-3 h-3" />}
                            Sync Neural Link
                        </button>
                    </div>
                 </div>
                 <div className="px-1">
                    <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-gray-500 hover:text-emerald-400 underline uppercase tracking-widest">
                        Get a Gemini API Key (Free)
                    </a>
                 </div>
              </div>
            )}
            
             {activeTab === 'profile' && (
              <div className="space-y-6">
                <h3 className="text-lg font-bold text-white">Profile Setup</h3>
                 <form onSubmit={handleProfileSave} className="p-4 bg-gray-800/50 rounded-lg space-y-4">
                    <div>
                        <label htmlFor="name" className="block text-xs font-medium text-white">Full Name</label>
                        <input
                            id="name"
                            type="text"
                            value={userName}
                            onChange={(e) => setUserName(e.target.value)}
                            className="mt-1 w-full max-w-sm px-3 py-2 border border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-gray-500 focus:border-gray-500 bg-[#1C2326] text-white text-xs font-medium"
                        />
                    </div>
                     <div className="flex justify-start">
                        <button type="submit" disabled={isSavingProfile || userName === currentUser.name} className="px-4 py-2 bg-gray-300 text-black font-semibold rounded-lg shadow-sm hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:bg-gray-500 disabled:cursor-not-allowed text-xs uppercase tracking-wider font-bold">
                            {isSavingProfile ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                 </form>
              </div>
            )}

             {activeTab === 'projects' && (
              <div className="space-y-6">
                <h3 className="text-lg font-bold text-white">Your Project Nodes</h3>
                <div className="space-y-3">
                    {projects.map(project => (
                        <div key={project.id} className="p-4 bg-gray-800/40 rounded-xl border border-white/5 hover:border-white/10 transition-colors flex justify-between items-center">
                            <div>
                              <h4 className="font-bold text-white text-xs uppercase tracking-wider">{project.name}</h4>
                              <p className="text-xs text-gray-400 mt-1 leading-relaxed">{project.description || 'No specifications registered.'}</p>
                            </div>
                            <span className="text-[9px] font-mono tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full uppercase">
                              Active Node
                            </span>
                        </div>
                    ))}
                    {projects.length === 0 && (
                      <p className="text-xs text-gray-500 py-6 text-center italic">No workspace configurations registered.</p>
                    )}
                </div>
              </div>
            )}

            {activeTab === 'billing' && (
              <div className="space-y-6">
                <div className="flex items-center gap-2 pb-2 border-b border-white/10">
                  <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
                  </svg>
                  <h3 className="text-lg font-bold text-white">Enterprise Billing & Quotas</h3>
                </div>

                <div className="p-4 rounded-xl bg-gradient-to-br from-[#121918] to-[#0A0F0E] border border-emerald-500/15">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#10B981] mb-1">Current Plan Tier</p>
                  <h3 className="text-lg font-black text-white">Scale Core Enterprise Plan</h3>
                  <p className="text-xs text-gray-400 mt-1">Automatic workload synchronization, advanced neural analytics.</p>
                  <div className="flex items-baseline gap-1 mt-3">
                    <span className="text-xl font-bold text-white">$49</span>
                    <span className="text-[10px] text-gray-500 font-mono">/ Month / Core Node</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Resource Quotas Usage</h4>
                  <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-3">
                    <div>
                      <div className="flex justify-between text-[11px] mb-1.5">
                        <span className="text-gray-400 font-semibold">Active Node Connections</span>
                        <span className="text-white font-bold">{projects.length} / 10 Nodes</span>
                      </div>
                      <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                        <div className="bg-emerald-500 h-full rounded-full transition-all" style={{ width: `${Math.min(100, (projects.length / 10) * 100)}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] mb-1.5">
                        <span className="text-gray-400 font-semibold">AI Assistant Executions</span>
                        <span className="text-white font-bold">128 / 500 Credits</span>
                      </div>
                      <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                        <div className="bg-violet-500 h-full rounded-full transition-all" style={{ width: '25.6%' }} />
                      </div>
                    </div>
                  </div>

                  <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-6 block">Billing History</h3>
                  <div className="bg-white/5 rounded-xl border border-white/5 divide-y divide-white/5 text-[11px]">
                    <div className="flex justify-between items-center p-3 text-gray-400 font-medium">
                      <span>INV-2026-004 (Pending)</span>
                      <span className="text-emerald-400 font-bold">$49.00</span>
                    </div>
                    <div className="flex justify-between items-center p-3 text-gray-400 font-medium">
                      <span>INV-2026-003 (Succeeded)</span>
                      <span className="text-gray-300 font-semibold">$49.00</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <button 
                    type="button"
                    onClick={() => {
                      requestConfirmation({
                        title: 'Enterprise Upgrade Requested',
                        message: (
                          <div className="space-y-2 text-xs text-gray-300">
                            <p>An Enterprise Custom Plan upgrade request has been registered.</p>
                            <p>A billing and workspace integration representative will contact you at <strong className="text-emerald-400">{currentUser.email || 'your registered address'}</strong> within 24 standard processing cycles.</p>
                          </div>
                        ),
                        confirmText: 'Acknowledged',
                        onConfirm: () => {}
                      });
                    }}
                    className="w-full py-2.5 bg-white text-black font-black text-xs uppercase tracking-widest rounded-xl hover:bg-emerald-400 transition-all shadow-xl"
                  >
                    Upgrade Framework Core
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};
