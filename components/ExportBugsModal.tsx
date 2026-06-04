
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Bug, User } from '../types';
import { XIcon, DownloadIcon, LoaderCircleIcon, FileTextIcon } from './Icons';
import { exportBugsToCsv, exportBugsToPdf } from '../utils/export';

interface ExportBugsModalProps {
  isOpen: boolean;
  onClose: () => void;
  bugs: Bug[];
  projectName: string;
  users: Record<string, User>;
}

export const ExportBugsModal: React.FC<ExportBugsModalProps> = ({ 
  isOpen, 
  onClose, 
  bugs, 
  projectName, 
  users 
}) => {
  const [isExporting, setIsExporting] = useState<'csv' | 'pdf' | null>(null);

  if (!isOpen) return null;

  const bugsToExport = bugs;
  const isFilteredExport = bugs.length < (bugs[0]?.id ? Object.keys(users).length : 0); // Not a great check but okay

  const handleExportCsv = async () => {
    setIsExporting('csv');
    try {
      await new Promise(resolve => setTimeout(resolve, 600));
      exportBugsToCsv(bugs, projectName, users);
      onClose();
    } catch (error) {
      console.error("CSV Export failed:", error);
    } finally {
      setIsExporting(null);
    }
  };

  const handleExportPdf = async () => {
    setIsExporting('pdf');
    try {
      await new Promise(resolve => setTimeout(resolve, 600));
      exportBugsToPdf(bugs, projectName, users);
      onClose();
    } catch (error) {
      console.error("PDF Export failed:", error);
    } finally {
      setIsExporting(null);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#131C1B] rounded-2xl shadow-2xl w-full max-w-md border border-white/5 animate-in fade-in zoom-in duration-200" onClick={(e) => e.stopPropagation()}>
        <header className="p-4 border-b border-white/5 flex justify-between items-center bg-white/5">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <DownloadIcon className="w-5 h-5 text-emerald-500" />
            Export Archive
          </h2>
          <button onClick={onClose} className="p-2 rounded-full text-gray-400 hover:bg-white/10 transition-colors">
            <XIcon className="w-5 h-5" />
          </button>
        </header>

        <div className="p-6 space-y-5">
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-center">
            <p className="text-sm text-emerald-400 font-medium">
              Ready to synthesize <span className="text-white font-bold">{bugs.length}</span> bug reports from <span className="text-white font-bold">{projectName}</span>.
            </p>
          </div>
          
          <div className="space-y-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 text-center">Select Export Neural Protocol</p>
            
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={handleExportCsv}
                disabled={!!isExporting}
                className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all group ${isExporting === 'csv' ? 'bg-white text-black border-white' : 'bg-white/5 border-white/5 hover:border-white/20 hover:bg-white/[0.08]'}`}
              >
                {isExporting === 'csv' ? <LoaderCircleIcon className="w-6 h-6 animate-spin" /> : <DownloadIcon className="w-6 h-6 text-gray-400 group-hover:text-emerald-500 transition-colors" />}
                <span className="text-[10px] font-black uppercase tracking-widest">CSV Format</span>
                <span className="text-[8px] text-gray-600 font-medium normal-case">Spreadsheet Compatible</span>
              </button>

              <button 
                onClick={handleExportPdf}
                disabled={!!isExporting}
                className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all group ${isExporting === 'pdf' ? 'bg-white text-black border-white' : 'bg-white/5 border-white/5 hover:border-white/20 hover:bg-white/[0.08]'}`}
              >
                {isExporting === 'pdf' ? <LoaderCircleIcon className="w-6 h-6 animate-spin" /> : <FileTextIcon className="w-6 h-6 text-gray-400 group-hover:text-emerald-500 transition-colors" />}
                <span className="text-[10px] font-black uppercase tracking-widest">PDF Report</span>
                <span className="text-[8px] text-gray-600 font-medium normal-case">Portable Document</span>
              </button>
            </div>
          </div>

          <div className="p-4 bg-white/5 rounded-xl">
             <div className="text-gray-400 text-xs space-y-2">
                <p className="text-[9px] font-bold uppercase tracking-widest text-gray-600">Extracted Fields:</p>
                <ul className="list-none grid grid-cols-2 gap-x-4 gap-y-1 text-[8px] uppercase font-bold tracking-wider opacity-60">
                  <li className="flex items-center gap-1.5"><div className="w-1 h-1 bg-emerald-500 rounded-full" /> Bug IDs</li>
                  <li className="flex items-center gap-1.5"><div className="w-1 h-1 bg-emerald-500 rounded-full" /> Titles</li>
                  <li className="flex items-center gap-1.5"><div className="w-1 h-1 bg-emerald-500 rounded-full" /> Statuses</li>
                  <li className="flex items-center gap-1.5"><div className="w-1 h-1 bg-emerald-500 rounded-full" /> Priorities</li>
                  <li className="flex items-center gap-1.5"><div className="w-1 h-1 bg-emerald-500 rounded-full" /> Assignees</li>
                  <li className="flex items-center gap-1.5"><div className="w-1 h-1 bg-emerald-500 rounded-full" /> Anatomy</li>
                  <li className="flex items-center gap-1.5"><div className="w-1 h-1 bg-emerald-500 rounded-full" /> Chronicles</li>
                </ul>
              </div>
          </div>
        </div>

        <footer className="p-4 bg-white/5 flex gap-3 justify-center rounded-b-2xl border-t border-white/5">
          <button 
            onClick={onClose}
            className="px-8 py-2 text-gray-500 text-[10px] font-black uppercase tracking-widest hover:text-white transition-colors"
          >
            Abort Protocol
          </button>
        </footer>
      </div>
    </div>,
    document.body
  );
};
