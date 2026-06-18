import React, { useEffect, useRef, useState } from 'react';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';
import { Table, Plus, Columns, Rows } from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({ value, onChange, placeholder }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<Quill | null>(null);
  const isUpdatingRef = useRef<boolean>(false);
  
  // Custom Table Insertion States
  const [showTableModal, setShowTableModal] = useState<boolean>(false);
  const [rows, setRows] = useState<number>(3);
  const [cols, setCols] = useState<number>(3);

  useEffect(() => {
    if (!containerRef.current) return;

    // Create a sub-div so Quill mounts safely
    const editorDiv = document.createElement('div');
    containerRef.current.appendChild(editorDiv);

    const quill = new Quill(editorDiv, {
      theme: 'snow',
      placeholder: placeholder || 'Write something amazing...',
      modules: {
        table: true,
        toolbar: [
          [{ header: [1, 2, 3, false] }],
          ['bold', 'italic', 'underline', 'strike'],
          [{ list: 'ordered' }, { list: 'bullet' }],
          ['code-block', 'blockquote'],
          ['link'],
          ['table'],
          ['clean']
        ]
      }
    });

    quillRef.current = quill;

    // Load initial content (as HTML or raw text)
    if (value) {
      if (value.startsWith('<')) {
        quill.clipboard.dangerouslyPasteHTML(value);
      } else {
        quill.setText(value);
      }
    }

    // Bind event handler
    quill.on('text-change', () => {
      if (isUpdatingRef.current) return;
      
      const html = quill.root.innerHTML;
      // Handle Quill's empty value representation
      if (html === '<p><br></p>') {
        onChange('');
      } else {
        onChange(html);
      }
    });

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
      quillRef.current = null;
    };
  }, []);

  // Sync value from parent if it changed externally
  useEffect(() => {
    if (quillRef.current) {
      const currentHTML = quillRef.current.root.innerHTML;
      const targetValue = value || '';
      
      if (targetValue !== currentHTML && targetValue !== '<p><br></p>') {
        isUpdatingRef.current = true;
        
        // Preserve selection/cursor position if possible
        const range = quillRef.current.getSelection();
        
        if (targetValue.startsWith('<')) {
          quillRef.current.clipboard.dangerouslyPasteHTML(targetValue);
        } else {
          quillRef.current.setText(targetValue);
        }
        
        if (range) {
          quillRef.current.setSelection(range);
        }
        
        isUpdatingRef.current = false;
      }
    }
  }, [value]);

  // Command to insert a beautifully styled HTML Table template
  const insertCustomTable = (numRows: number, numCols: number) => {
    if (!quillRef.current) return;
    const quill = quillRef.current;
    
    quill.focus();
    const range = quill.getSelection();
    const index = range ? range.index : quill.getLength();

    // Start of Table template
    let tableHtml = `<table style="width: 100%; border-collapse: collapse; margin: 16px 0; border: 1px solid rgba(255, 255, 255, 0.1);">`;
    
    // Header Row with glowing color background
    tableHtml += `<thead><tr style="background-color: rgba(16, 185, 129, 0.1);">`;
    for (let c = 1; c <= numCols; c++) {
      tableHtml += `<th style="border: 1px solid rgba(255, 255, 255, 0.15); padding: 8px 12px; font-weight: 600; text-align: left; color: #10b981; font-size: 13px;">Col Header ${c}</th>`;
    }
    tableHtml += `</tr></thead>`;
    
    // Rows
    tableHtml += `<tbody>`;
    for (let r = 1; r <= numRows; r++) {
      const isEven = r % 2 === 0;
      const rowStyle = isEven ? `background-color: rgba(255, 255, 255, 0.02);` : '';
      tableHtml += `<tr style="${rowStyle}">`;
      for (let c = 1; c <= numCols; c++) {
        tableHtml += `<td style="border: 1px solid rgba(255, 255, 255, 0.08); padding: 8px 12px; color: #d1d5db; font-size: 12px;">Cell ${r}-${c}</td>`;
      }
      tableHtml += `</tr>`;
    }
    tableHtml += `</tbody></table><p><br></p>`;

    quill.clipboard.dangerouslyPasteHTML(index, tableHtml);
  };

  return (
    <div className="rich-text-editor-container rounded-xl overflow-hidden border border-white/10 bg-black/40 text-white w-full shadow-inner">
      {/* Dynamic injection of dark theme overrides to keep it perfectly styled and self-contained */}
      <style>{`
        .rich-text-editor-container .ql-toolbar.ql-snow {
          background-color: rgb(28, 35, 38);
          border: none;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          padding: 8px 12px;
        }
        .rich-text-editor-container .ql-container.ql-snow {
          border: none;
          background-color: transparent;
          font-family: inherit;
        }
        .rich-text-editor-container .ql-editor {
          min-height: 120px;
          max-height: 350px;
          overflow-y: auto;
          color: #e5e7eb;
          font-size: 0.875rem;
          line-height: 1.6;
          padding: 12px;
        }
        .rich-text-editor-container .ql-editor.ql-blank::before {
          color: rgba(255, 255, 255, 0.3);
          font-style: normal;
          left: 12px;
        }
        /* Custom styled Toolbar SVGs for dark mode */
        .rich-text-editor-container .ql-snow .ql-stroke {
          stroke: #9ca3af !important;
        }
        .rich-text-editor-container .ql-snow .ql-fill {
          fill: #9ca3af !important;
        }
        .rich-text-editor-container .ql-snow .ql-picker {
          color: #9ca3af !important;
        }
        .rich-text-editor-container .ql-snow .ql-picker-options {
          background-color: #131c1b !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
        }
        .rich-text-editor-container .ql-snow .ql-picker-item {
          color: #9ca3af !important;
        }
        .rich-text-editor-container .ql-snow .ql-picker-item:hover,
        .rich-text-editor-container .ql-snow .ql-picker-item.ql-selected {
          color: #10b981 !important;
        }
        .rich-text-editor-container .ql-snow.ql-toolbar button:hover .ql-stroke,
        .rich-text-editor-container .ql-snow.ql-toolbar button.ql-active .ql-stroke,
        .rich-text-editor-container .ql-snow.ql-toolbar .ql-picker-label:hover .ql-stroke,
        .rich-text-editor-container .ql-snow.ql-toolbar .ql-picker-label.ql-active .ql-stroke {
          stroke: #10b981 !important;
        }
        .rich-text-editor-container .ql-snow.ql-toolbar button:hover .ql-fill,
        .rich-text-editor-container .ql-snow.ql-toolbar button.ql-active .ql-fill,
        .rich-text-editor-container .ql-snow.ql-toolbar .ql-picker-label:hover .ql-fill,
        .rich-text-editor-container .ql-snow.ql-toolbar .ql-picker-label.ql-active .ql-fill {
          fill: #10b981 !important;
        }
        .rich-text-editor-container .ql-snow.ql-toolbar button:hover,
        .rich-text-editor-container .ql-snow.ql-toolbar button.ql-active {
          color: #10b981 !important;
        }
        .rich-text-editor-container .ql-snow .ql-editor pre.ql-syntax {
          background-color: #0f172a !important;
          color: #e2e8f0 !important;
          border-radius: 6px;
          border: 1px solid rgba(255, 255, 255, 0.05);
          padding: 10px;
        }
        .rich-text-editor-container .ql-snow a {
          color: #10b981 !important;
          text-decoration: underline;
        }

        /* Pristine table layouts inside Quill editors and read-only views */
        .ql-editor table {
          border-collapse: collapse;
          width: 100% !important;
          margin: 16px 0 !important;
          border: 1px solid rgba(255, 255, 255, 0.12) !important;
          border-radius: 8px !important;
          overflow: hidden !important;
        }
        .ql-editor th {
          background-color: rgba(16, 185, 129, 0.12) !important;
          color: #10b981 !important;
          font-weight: 600 !important;
          text-align: left !important;
          padding: 10px 14px !important;
          border: 1px solid rgba(255, 255, 255, 0.15) !important;
          font-size: 0.825rem !important;
        }
        .ql-editor td {
          padding: 10px 14px !important;
          border: 1px solid rgba(255, 255, 255, 0.08) !important;
          color: #d1d5db !important;
          font-size: 0.775rem !important;
        }
        .ql-editor tr:nth-child(even) {
          background-color: rgba(255, 255, 255, 0.02) !important;
        }

        /* Light mode table overrides if the container has light backgrounds */
        body.light .ql-editor table,
        [class*="theme-light"] .ql-editor table,
        [class*="bg-white"] .ql-editor table {
          border: 1px solid rgba(0, 0, 0, 0.15) !important;
        }
        body.light .ql-editor th,
        [class*="theme-light"] .ql-editor th,
        [class*="bg-white"] .ql-editor th {
          background-color: rgba(16, 185, 129, 0.08) !important;
          color: #065f46 !important;
          border: 1px solid rgba(0, 0, 0, 0.15) !important;
        }
        body.light .ql-editor td,
        [class*="theme-light"] .ql-editor td,
        [class*="bg-white"] .ql-editor td {
          border: 1px solid rgba(0, 0, 0, 0.1) !important;
          color: #374151 !important;
        }
        body.light .ql-editor tr:nth-child(even),
        [class*="theme-light"] .ql-editor tr:nth-child(even),
        [class*="bg-white"] .ql-editor tr:nth-child(even) {
          background-color: rgba(0, 0, 0, 0.02) !important;
        }
      `}</style>
      <div ref={containerRef} className="quill-dark-wrapper" />
      
      {/* Bottom Action bar inside editor container for user friendly Grid Insertion */}
      <div className="border-t border-white/5 bg-white/[0.01] px-4 py-2.5 flex items-center justify-between text-xs text-gray-400">
        <button
          type="button"
          onClick={() => setShowTableModal(!showTableModal)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all ${
            showTableModal 
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/35' 
              : 'bg-white/5 text-gray-300 border-white/5 hover:bg-white/10 hover:border-white/10'
          }`}
        >
          <Table className="w-3.5 h-3.5 text-emerald-500" />
          <span>Insert Grid Table</span>
        </button>
        <span className="text-[10px] text-gray-500 font-mono tracking-widest uppercase">Grid Node Builder</span>
      </div>

      {showTableModal && (
        <div className="bg-[#121A19] border-t border-white/10 p-3.5 flex flex-col sm:flex-row gap-3 items-center justify-between animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-gray-400 flex items-center gap-1.5 text-xs font-medium">
                <Rows className="w-3.5 h-3.5 text-emerald-500" /> Rows:
              </span>
              <input 
                type="number" 
                min={1} 
                max={15} 
                value={rows} 
                onChange={(e) => setRows(Math.min(15, Math.max(1, parseInt(e.target.value) || 1)))} 
                className="w-14 px-2 py-1 bg-black/40 border border-white/10 rounded-md text-center text-xs text-white uppercase font-bold focus:outline-none focus:border-emerald-500/50"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400 flex items-center gap-1.5 text-xs font-medium">
                <Columns className="w-3.5 h-3.5 text-emerald-500" /> Cols:
              </span>
              <input 
                type="number" 
                min={1} 
                max={10} 
                value={cols} 
                onChange={(e) => setCols(Math.min(10, Math.max(1, parseInt(e.target.value) || 1)))} 
                className="w-14 px-2 py-1 bg-black/40 border border-white/10 rounded-md text-center text-xs text-white uppercase font-bold focus:outline-none focus:border-emerald-500/50"
              />
            </div>
          </div>
          <div className="flex gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={() => setShowTableModal(false)}
              className="px-3 py-1.5 text-xs font-bold text-gray-400 hover:text-white transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                insertCustomTable(rows, cols);
                setShowTableModal(false);
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs rounded-lg transition-all active:scale-95 shadow-lg shadow-emerald-500/10 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3px]" />
              <span>Insert Table</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
