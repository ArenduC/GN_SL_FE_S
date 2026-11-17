import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Monitor, Download, X, Check, Copy, Terminal, Smartphone, Sparkles } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { AppLogo } from './Icons';

interface PWAInstallButtonProps {
  variant?: 'header' | 'sidebar' | 'landing' | 'settings';
  isCollapsed?: boolean;
}

type GuidePlatform = 'windows' | 'linux' | 'mobile';

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'header',
  isCollapsed = false,
}) => {
  const { isInstallable, isInstalled, isIOS, os, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [activeTab, setActiveTab] = useState<GuidePlatform>(() => {
    if (os === 'Linux') return 'linux';
    if (os === 'iOS' || os === 'Android') return 'mobile';
    return 'windows';
  });
  const [copiedUrl, setCopiedUrl] = useState(false);

  const handleActionClick = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (accepted) return;
    }
    if (os === 'Linux') setActiveTab('linux');
    else if (os === 'iOS' || os === 'Android') setActiveTab('mobile');
    else setActiveTab('windows');
    setShowGuideModal(true);
  };

  const handleCopyUrl = () => {
    const url = window.location.origin;
    navigator.clipboard.writeText(url);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  // When already running inside installed standalone desktop/mobile app
  if (isInstalled) {
    if (variant === 'settings') {
      return (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
              <Monitor className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-white">Desktop Web App Active</p>
              <p className="text-[10px] text-emerald-400">Running in standalone app mode</p>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[9px] font-black uppercase tracking-widest">
            Installed
          </span>
        </div>
      );
    }
    return null;
  }

  const buttonLabel =
    os === 'Windows'
      ? 'Install for Windows'
      : os === 'Linux'
      ? 'Install for Linux'
      : 'Install Desktop App';

  return (
    <>
      {variant === 'header' && (
        <button
          type="button"
          onClick={handleActionClick}
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-black transition-all text-[10px] font-black uppercase tracking-wider cursor-pointer"
          title="Install app for Windows or Linux web version"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden lg:inline">{isInstallable ? 'Install App' : 'Windows / Linux App'}</span>
        </button>
      )}

      {variant === 'sidebar' && (
        <button
          type="button"
          onClick={handleActionClick}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all text-emerald-400 hover:text-black hover:bg-emerald-500/90 border border-emerald-500/15 bg-emerald-500/5"
          title="Install app for Windows or Linux web version"
        >
          <Monitor className="w-4 h-4 flex-shrink-0" />
          {!isCollapsed && <span className="truncate">Install Web App</span>}
        </button>
      )}

      {variant === 'landing' && (
        <button
          type="button"
          onClick={handleActionClick}
          className="flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 hover:bg-emerald-500 hover:text-black transition-all cursor-pointer"
          title="Install app for Windows or Linux web version"
        >
          <Monitor className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Windows / Linux App</span>
          <span className="sm:hidden">Install</span>
        </button>
      )}

      {variant === 'settings' && (
        <div className="p-4 rounded-xl bg-[#0E1314]/80 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
              <Monitor className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">Install App for Windows or Linux (Web Version)</h4>
              <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">
                Run SCOPE LOG in a dedicated standalone desktop window with taskbar pinning and offline caching.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleActionClick}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer shadow-md"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{buttonLabel}</span>
          </button>
        </div>
      )}

      {showGuideModal &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={() => setShowGuideModal(false)}
          >
            <div
              className="w-full max-w-lg bg-[#131C1B] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <header className="px-6 py-4 border-b border-white/5 bg-[#0E1314] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-1.5 flex items-center justify-center">
                    <AppLogo className="w-full h-full" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white tracking-tight">
                      Install SCOPE LOG Web App
                    </h3>
                    <p className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest">
                      Windows &amp; Linux Desktop Edition
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowGuideModal(false)}
                  className="p-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                  aria-label="Close install dialog"
                >
                  <X className="w-5 h-5" />
                </button>
              </header>

              {/* Modal Body */}
              <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh] custom-scrollbar">
                {isInstallable && (
                  <div className="p-4 rounded-xl bg-[#101918] border border-emerald-500/30 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <Sparkles className="w-5 h-5 text-emerald-400 shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-white">Ready for One-Click Install</p>
                        <p className="text-[11px] text-gray-400">
                          Your browser supports direct desktop installation.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        const ok = await install();
                        if (ok) setShowGuideModal(false);
                      }}
                      className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black uppercase tracking-wider transition-all shrink-0 cursor-pointer"
                    >
                      Install Now
                    </button>
                  </div>
                )}

                {/* OS Tabs */}
                <div className="grid grid-cols-3 gap-2 p-1 rounded-xl bg-[#0E1314] border border-white/5">
                  <button
                    type="button"
                    onClick={() => setActiveTab('windows')}
                    className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      activeTab === 'windows'
                        ? 'bg-[#101918] text-emerald-400 border border-emerald-500/25 shadow-sm'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    <span>Windows</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('linux')}
                    className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      activeTab === 'linux'
                        ? 'bg-[#101918] text-emerald-400 border border-emerald-500/25 shadow-sm'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <Terminal className="w-3.5 h-3.5" />
                    <span>Linux</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('mobile')}
                    className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      activeTab === 'mobile'
                        ? 'bg-[#101918] text-emerald-400 border border-emerald-500/25 shadow-sm'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Mobile / iOS</span>
                  </button>
                </div>

                {/* Windows Instructions */}
                {activeTab === 'windows' && (
                  <div className="space-y-3 text-xs text-gray-300 leading-relaxed">
                    <div className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-2.5">
                      <p className="text-[11px] font-black uppercase tracking-widest text-emerald-400">
                        Windows 10 / 11 (Chrome or Microsoft Edge)
                      </p>
                      <ol className="list-decimal list-inside space-y-2 text-gray-300">
                        <li>
                          Open SCOPE LOG directly in <strong className="text-white">Google Chrome</strong> or{' '}
                          <strong className="text-white">Microsoft Edge</strong>.
                        </li>
                        <li>
                          Click the <strong className="text-white">Install SCOPE LOG</strong> icon on the right side of
                          the address bar, or open the browser menu:
                          <div className="mt-1.5 ml-4 p-2 rounded-lg bg-[#0E1314] border border-white/5 text-[11px] font-mono text-gray-400">
                            Chrome: ⋮ → Cast, save, and share → Install SCOPE LOG
                            <br />
                            Edge: ⋯ → Apps → Install this site as an app
                          </div>
                        </li>
                        <li>
                          Confirm <strong className="text-white">Install</strong> to add SCOPE LOG to your{' '}
                          <strong className="text-white">Start Menu</strong> and pin it to the{' '}
                          <strong className="text-white">Windows Taskbar</strong>.
                        </li>
                      </ol>
                    </div>
                  </div>
                )}

                {/* Linux Instructions */}
                {activeTab === 'linux' && (
                  <div className="space-y-3 text-xs text-gray-300 leading-relaxed">
                    <div className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-2.5">
                      <p className="text-[11px] font-black uppercase tracking-widest text-emerald-400">
                        Linux Desktop (Chrome, Chromium, Brave, or Edge)
                      </p>
                      <ol className="list-decimal list-inside space-y-2 text-gray-300">
                        <li>
                          Open SCOPE LOG in a Chromium-based browser (<strong className="text-white">Chrome</strong>,{' '}
                          <strong className="text-white">Chromium</strong>,{' '}
                          <strong className="text-white">Brave</strong>, or{' '}
                          <strong className="text-white">Edge</strong>).
                        </li>
                        <li>
                          Click the <strong className="text-white">Install</strong> icon in the address bar, or open the
                          browser menu:
                          <div className="mt-1.5 ml-4 p-2 rounded-lg bg-[#0E1314] border border-white/5 text-[11px] font-mono text-gray-400">
                            ⋮ → Cast, save, and share → Install page as app...
                          </div>
                        </li>
                        <li>
                          Click <strong className="text-white">Install</strong>. A native{' '}
                          <code className="text-emerald-400">.desktop</code> launcher is automatically added to your
                          GNOME, KDE, or XFCE app menu and dock.
                        </li>
                      </ol>
                    </div>
                  </div>
                )}

                {/* Mobile / iOS Instructions */}
                {activeTab === 'mobile' && (
                  <div className="space-y-3 text-xs text-gray-300 leading-relaxed">
                    <div className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-2.5">
                      <p className="text-[11px] font-black uppercase tracking-widest text-emerald-400">
                        {isIOS ? 'iPhone / iPad (Safari)' : 'Android & iOS'}
                      </p>
                      <ol className="list-decimal list-inside space-y-2 text-gray-300">
                        <li>
                          <strong className="text-white">iOS Safari:</strong> Tap the{' '}
                          <strong className="text-white">Share</strong> button in the toolbar, then select{' '}
                          <strong className="text-white">Add to Home Screen</strong>.
                        </li>
                        <li>
                          <strong className="text-white">Android Chrome:</strong> Tap the{' '}
                          <strong className="text-white">⋮</strong> menu, then tap{' '}
                          <strong className="text-white">Install app</strong> or{' '}
                          <strong className="text-white">Add to Home screen</strong>.
                        </li>
                      </ol>
                    </div>
                  </div>
                )}

                {/* App URL Copy Box (useful when previewing inside an iframe) */}
                <div className="p-3.5 rounded-xl bg-[#0E1314] border border-white/5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">
                      Standalone Web App URL
                    </p>
                    <p className="text-xs font-mono text-gray-300 truncate mt-0.5">
                      {typeof window !== 'undefined' ? window.location.origin : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyUrl}
                    className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
                  >
                    {copiedUrl ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy URL</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
