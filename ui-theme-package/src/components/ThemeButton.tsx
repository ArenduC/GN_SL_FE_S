import React from 'react';
import { useTheme } from '../theme';

export interface ThemeButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'muted' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export const ThemeButton: React.FC<ThemeButtonProps> = ({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}) => {
  const { palette } = useTheme();

  let variantClasses = '';
  switch (variant) {
    case 'primary':
      variantClasses = `${palette.primary} ${palette.primaryHover} shadow-sm`;
      break;
    case 'muted':
      variantClasses = `${palette.accentMuted} hover:bg-white/10`;
      break;
    case 'outline':
      variantClasses = `bg-transparent text-white ${palette.outline}`;
      break;
    case 'ghost':
      variantClasses = 'bg-transparent text-gray-400 hover:text-white hover:bg-white/5';
      break;
  }

  let sizeClasses = '';
  switch (size) {
    case 'sm':
      sizeClasses = 'py-1.5 px-3 text-[10px] rounded-lg tracking-widest font-black uppercase';
      break;
    case 'md':
      sizeClasses = 'py-2.5 px-4 text-[11px] rounded-xl tracking-widest font-black uppercase';
      break;
    case 'lg':
      sizeClasses = 'py-3.5 px-6 text-xs rounded-2xl tracking-widest font-black uppercase';
      break;
  }

  return (
    <button
      {...props}
      className={`font-sans inline-flex items-center justify-center gap-2 border border-transparent font-black tracking-widest uppercase transition-all duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${sizeClasses} ${variantClasses} ${className}`}
    >
      {children}
    </button>
  );
};
