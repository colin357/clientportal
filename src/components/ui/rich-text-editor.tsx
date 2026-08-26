'use client';

import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import 'react-quill/dist/quill.snow.css';

const ReactQuill = dynamic(() => import('react-quill'), {
  ssr: false,
  loading: () => <div className="h-40 bg-gray-100 rounded animate-pulse" />,
});

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function RichTextEditor({ value, onChange, placeholder, className }: RichTextEditorProps) {
  const modules = useMemo(() => ({
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline'],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }],
      ['link'],
      ['clean'],
    ],
  }), []);

  const formats = [
    'header',
    'bold', 'italic', 'underline',
    'list', 'bullet',
    'link',
  ];

  return (
    <div className={className}>
      <ReactQuill
        theme="snow"
        value={value}
        onChange={onChange}
        modules={modules}
        formats={formats}
        placeholder={placeholder}
        className="bg-white rounded"
      />
      <style jsx global>{`
        .ql-container {
          min-height: 150px;
          font-size: 14px;
        }
        .ql-editor {
          min-height: 150px;
        }
        .ql-toolbar.ql-snow {
          border-radius: 4px 4px 0 0;
          border-color: #e5e7eb;
        }
        .ql-container.ql-snow {
          border-radius: 0 0 4px 4px;
          border-color: #e5e7eb;
        }
      `}</style>
    </div>
  );
}
