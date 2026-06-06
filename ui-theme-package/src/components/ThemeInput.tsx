import React from 'react';
import { useTheme } from '../theme';

export interface ThemeInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const ThemeInput: React.FC<ThemeInputProps> = ({
  label,
  error,
  className = '',
  ...props
}) => {
  const { palette } = useTheme();

  return (
    <div className="w-full flex flex-col gap-1.5 text-left">
      {label && (
        <label className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-500 select-none">
          {label}
        </label>
      )}
      <input
        {...props}
        className={`w-full ${palette.bgInput} ${palette.textPrimary} placeholder-gray-600 text-xs py-2.5 px-3.5 border border-white/5 rounded-xl focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/5 transition-all duration-200 outline-none ${
          error ? 'border-rose-500/40 focus:border-rose-500' : ''
        } ${className}`}
      />
      {error && (
        <span className="text-[10px] text-rose-400 font-bold tracking-wide mt-0.5">
          {error}
        </span>
      )}
    </div>
  );
};
