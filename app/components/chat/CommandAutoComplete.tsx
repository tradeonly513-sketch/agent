import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { workbenchStore } from '~/lib/stores/workbench';
import type { CommandSuggestion } from '~/types/commands';

interface CommandAutoCompleteProps {
  input: string;
  onSelect: (suggestion: string) => void;
  onClose: () => void;
  visible: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
}

export function CommandAutoComplete({ input, onSelect, onClose, visible, textareaRef: _textareaRef }: CommandAutoCompleteProps) {
  const [suggestions, setSuggestions] = useState<Array<CommandSuggestion | { type: 'file' | 'folder'; path: string }>>(
    [],
  );
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible || !input.trim()) {
      setSuggestions([]);
      return;
    }

    const suggestions = generateSuggestions(input);
    setSuggestions(suggestions);
    setSelectedIndex(0);
  }, [input, visible]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!visible || suggestions.length === 0) {
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % suggestions.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
          break;
        case 'Enter':
        case 'Tab': {
          e.preventDefault();

          const selected = suggestions[selectedIndex];

          if (selected) {
            if ('command' in selected) {
              onSelect(selected.command);
            } else {
              onSelect(selected.path);
            }
          }

          break;
        }
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [visible, suggestions, selectedIndex, onSelect, onClose]);

  if (!visible || suggestions.length === 0) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        ref={containerRef}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="absolute z-50 w-full max-w-md bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-lg shadow-lg max-h-64 overflow-y-auto"
        style={{
          bottom: '100%',
          marginBottom: '8px',
        }}
      >
        <div className="p-2">
          <div className="text-xs text-bolt-elements-textSecondary mb-2 px-2">
            Use ↑↓ to navigate, Enter/Tab to select, Esc to close
          </div>
          {suggestions.map((suggestion, index) => (
            <div
              key={index}
              className={`px-3 py-2 rounded cursor-pointer transition-colors ${
                index === selectedIndex
                  ? 'bg-bolt-elements-background-depth-3 text-bolt-elements-textPrimary'
                  : 'text-bolt-elements-textSecondary hover:bg-bolt-elements-background-depth-3 hover:text-bolt-elements-textPrimary'
              }`}
              onClick={() => {
                if ('command' in suggestion) {
                  onSelect(suggestion.command);
                } else {
                  onSelect(suggestion.path);
                }
              }}
            >
              {'command' in suggestion ? (
                <CommandSuggestionItem suggestion={suggestion} />
              ) : (
                <FileSuggestionItem suggestion={suggestion} />
              )}
            </div>
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function CommandSuggestionItem({ suggestion }: { suggestion: CommandSuggestion }) {
  return (
    <div>
      <div className="font-medium text-sm">{suggestion.command}</div>
      <div className="text-xs text-bolt-elements-textTertiary">{suggestion.description}</div>
      {suggestion.example && (
        <div className="text-xs text-bolt-elements-textSecondary mt-1 font-mono">{suggestion.example}</div>
      )}
    </div>
  );
}

function FileSuggestionItem({ suggestion }: { suggestion: { type: 'file' | 'folder'; path: string } }) {
  const icon = suggestion.type === 'folder' ? '📁' : '📄';
  const displayPath = suggestion.path.length > 50 ? '...' + suggestion.path.slice(-47) : suggestion.path;

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-mono truncate">{displayPath}</div>
        <div className="text-xs text-bolt-elements-textTertiary capitalize">{suggestion.type}</div>
      </div>
    </div>
  );
}

function generateSuggestions(input: string): Array<CommandSuggestion | { type: 'file' | 'folder'; path: string }> {
  const trimmed = input.trim();
  const suggestions: Array<CommandSuggestion | { type: 'file' | 'folder'; path: string }> = [];

  // @ 命令建议
  if (trimmed.startsWith('@')) {
    const afterAt = trimmed.slice(1);

    if (!afterAt || afterAt === '' || 'file'.startsWith(afterAt.toLowerCase())) {
      suggestions.push({
        command: '@file ',
        description: 'Reference a specific file',
        example: '@file src/App.tsx',
      });
    }

    if (!afterAt || afterAt === '' || 'folder'.startsWith(afterAt.toLowerCase())) {
      suggestions.push({
        command: '@folder ',
        description: 'Reference all files in a folder',
        example: '@folder src/components',
      });
    }

    if (!afterAt || afterAt === '' || 'search'.startsWith(afterAt.toLowerCase())) {
      suggestions.push({
        command: '@search ',
        description: 'Search for text in files',
        example: '@search "useState"',
      });
    }

    if (!afterAt || afterAt === '' || 'help'.startsWith(afterAt.toLowerCase())) {
      suggestions.push({
        command: '@help',
        description: 'Show @ command help',
        example: '@help',
      });
    }

    // 文件路径建议
    if (afterAt.includes(' ')) {
      const parts = afterAt.split(' ');
      const command = parts[0];
      const path = parts.slice(1).join(' ');

      if ((command === 'file' || command === 'folder') && path) {
        const fileSuggestions = getFileSuggestions(path, command === 'folder');
        suggestions.push(...fileSuggestions);
      }
    } else if (afterAt && !['file', 'folder', 'search', 'help'].includes(afterAt.toLowerCase())) {
      // 直接路径建议
      const fileSuggestions = getFileSuggestions(afterAt, false);
      suggestions.push(...fileSuggestions);
    }
  }

  // # 命令建议
  else if (trimmed.startsWith('#')) {
    const afterHash = trimmed.slice(1);

    if (!afterHash || afterHash === '' || 'file'.startsWith(afterHash.toLowerCase())) {
      suggestions.push({
        command: '#file ',
        description: 'Add file to conversation context',
        example: '#file src/utils.ts',
      });
    }

    if (!afterHash || afterHash === '' || 'folder'.startsWith(afterHash.toLowerCase())) {
      suggestions.push({
        command: '#folder ',
        description: 'Add folder to conversation context',
        example: '#folder src/hooks',
      });
    }

    if (!afterHash || afterHash === '' || 'context'.startsWith(afterHash.toLowerCase())) {
      suggestions.push({
        command: '#context list',
        description: 'List current context files',
        example: '#context list',
      });
      suggestions.push({
        command: '#context clear',
        description: 'Clear all context files',
        example: '#context clear',
      });
    }

    if (!afterHash || afterHash === '' || 'help'.startsWith(afterHash.toLowerCase())) {
      suggestions.push({
        command: '#help',
        description: 'Show # command help',
        example: '#help',
      });
    }

    // 文件路径建议
    if (afterHash.includes(' ')) {
      const parts = afterHash.split(' ');
      const command = parts[0];
      const path = parts.slice(1).join(' ');

      if ((command === 'file' || command === 'folder') && path) {
        const fileSuggestions = getFileSuggestions(path, command === 'folder');
        suggestions.push(...fileSuggestions);
      }
    } else if (afterHash && !['file', 'folder', 'context', 'help'].includes(afterHash.toLowerCase())) {
      // 直接路径建议
      const fileSuggestions = getFileSuggestions(afterHash, false);
      suggestions.push(...fileSuggestions);
    }
  }

  // help 命令建议
  else if (trimmed.toLowerCase().startsWith('help')) {
    const afterHelp = trimmed.slice(4).trim();

    if (!afterHelp) {
      suggestions.push({
        command: 'help',
        description: 'Show all available commands',
        example: 'help',
      });
      suggestions.push({
        command: 'help @',
        description: 'Show @ command help',
        example: 'help @',
      });
      suggestions.push({
        command: 'help #',
        description: 'Show # command help',
        example: 'help #',
      });
    }
  }

  return suggestions.slice(0, 10); // 限制建议数量
}

function getFileSuggestions(
  partialPath: string,
  foldersOnly: boolean = false,
): Array<{ type: 'file' | 'folder'; path: string }> {
  const files = workbenchStore.files.get();
  const suggestions: Array<{ type: 'file' | 'folder'; path: string }> = [];

  // 获取所有文件和文件夹路径
  const allPaths = Object.keys(files);
  const folders = new Set<string>();

  // 提取文件夹路径
  allPaths.forEach((path) => {
    const parts = path.split('/');

    for (let i = 1; i < parts.length; i++) {
      const folderPath = parts.slice(0, i + 1).join('/');
      folders.add(folderPath);
    }
  });

  const normalizedPartial = partialPath.toLowerCase();

  // 添加文件夹建议
  Array.from(folders)
    .filter((folder) => folder.toLowerCase().includes(normalizedPartial))
    .sort()
    .slice(0, 5)
    .forEach((folder) => {
      suggestions.push({ type: 'folder', path: folder });
    });

  // 添加文件建议（如果不是只要文件夹）
  if (!foldersOnly) {
    allPaths
      .filter((path) => {
        const file = files[path];
        return file?.type === 'file' && path.toLowerCase().includes(normalizedPartial);
      })
      .sort()
      .slice(0, 5)
      .forEach((path) => {
        suggestions.push({ type: 'file', path });
      });
  }

  return suggestions.slice(0, 8); // 限制文件建议数量
}
