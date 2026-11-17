import React from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-[9998] flex items-center gap-2 rounded-xl bg-[#131C1B] border border-amber-500/30 px-3.5 py-2 text-xs font-semibold text-amber-400 shadow-2xl backdrop-blur-md">
      <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
      <span>Offline Mode — Cached workspace assets active</span>
    </div>
  );
};
