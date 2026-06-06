import React from 'react';
import { useTheme } from '../theme';

export interface ThemeBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'muted' | 'success' | 'alert';
  pulse?: boolean;
  children: React.ReactNode;
}

export const ThemeBadge: React.FC<ThemeBadgeProps> = ({
  variant = 'muted',
  pulse = false,
  className = '',
  children,
  ...props
}) => {
  const { palette } = useTheme();

  let variationClasses = '';
  switch (variant) {
    case 'primary':
      variationClasses = `bg-white/10 text-white border border-white/15`;
      break;
    case 'muted':
      variationClasses = `bg-white/5 text-gray-400 border border-white/5`;
      break;
    case 'success':
      variationClasses = `bg-emerald-500/10 text-emerald-400 border border-emerald-500/20`;
      break;
    case 'alert':
      variationClasses = `bg-rose-500/10 text-rose-400 border border-rose-500/20`;
      break;
  }

  return (
    <span
      {...props}
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded font-mono text-[9px] font-black uppercase tracking-wider ${variationClasses} ${className}`}
    >
      {pulse && (
        <span className={`relative flex h-1.5 w-1.5 shrink-0`}>
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
            variant === 'success' ? 'bg-emerald-400' : variant === 'alert' ? 'bg-rose-400' : 'bg-white'
          }`} />
          <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
            variant === 'success' ? 'bg-emerald-500' : variant === 'alert' ? 'bg-rose-500' : 'bg-gray-400'
          }`} />
        </span>
      )}
      <span>{children}</span>
    </span>
  );
};
