import React, { useEffect, useRef } from 'react';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({ value, onChange, placeholder }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<Quill | null>(null);
  const isUpdatingRef = useRef<boolean>(false);

  useEffect(() => {
    if (!containerRef.current) return;

    // Create a sub-div so Quill mounts safely
    const editorDiv = document.createElement('div');
    containerRef.current.appendChild(editorDiv);

    const quill = new Quill(editorDiv, {
      theme: 'snow',
      placeholder: placeholder || 'Write something amazing...',
      modules: {
        toolbar: [
          [{ header: [1, 2, 3, false] }],
          ['bold', 'italic', 'underline', 'strike'],
          [{ list: 'ordered' }, { list: 'bullet' }],
          ['code-block', 'blockquote'],
          ['link'],
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
      `}</style>
      <div ref={containerRef} className="quill-dark-wrapper" />
    </div>
  );
};
