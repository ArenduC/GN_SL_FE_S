import React from 'react';
import { useTheme } from '../theme';

export interface ThemeCardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverEffect?: boolean;
  padded?: boolean;
  glow?: boolean;
  children: React.ReactNode;
}

export const ThemeCard: React.FC<ThemeCardProps> = ({
  hoverEffect = false,
  padded = true,
  glow = false,
  className = '',
  children,
  ...props
}) => {
  const { palette } = useTheme();

  return (
    <div
      {...props}
      className={`rounded-2xl border ${palette.border} ${palette.bgCard} ${palette.textPrimary} ${palette.shadow} transition-all duration-300 ${
        padded ? 'p-5 sm:p-6' : ''
      } ${
        hoverEffect ? `hover:border-white/10 hover:-translate-y-0.5 hover:ring-1 hover:ring-white/5` : ''
      } ${
        glow ? `relative before:absolute before:inset-0 before:rounded-2xl before:bg-gradient-to-tr before:from-white/1 before:to-transparent before:-z-10 before:blur-md` : ''
      } ${className}`}
    >
      {children}
    </div>
  );
};
