
"use client";

import React, { useEffect, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { cpp } from '@codemirror/lang-cpp';
import { oneDark } from '@codemirror/theme-one-dark';
import type { Extension } from '@codemirror/state';
import type { SupportedLanguage } from '@/types';
import { useTheme } from 'next-themes';

interface CodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  language: SupportedLanguage;
  readOnly?: boolean;
  height?: string;
}

const languageExtensions: Record<SupportedLanguage, () => Extension> = {
  javascript: () => javascript({ jsx: true, typescript: true }),
  python: () => python(),
  cpp: () => cpp(),
};

export function CodeEditor({ value, onChange, language, readOnly = false, height = '100%' }: CodeEditorProps) {
  const { theme } = useTheme();
  const [extensions, setExtensions] = useState<Extension[]>([]);

  useEffect(() => {
    const langExtension = languageExtensions[language];
    if (langExtension) {
      setExtensions([langExtension()]);
    }
  }, [language]);

  return (
    <CodeMirror
      value={value}
      height={height}
      className="flex-grow w-full h-full text-base"
      extensions={extensions}
      onChange={onChange}
      readOnly={readOnly}
      theme={theme === 'dark' ? oneDark : 'light'}
      basicSetup={{
        lineNumbers: true,
        bracketMatching: true,
        autocompletion: true,
        indentOnInput: true,
        foldGutter: true,
        highlightActiveLine: true,
        highlightActiveLineGutter: true,
      }}
    />
  );
}
