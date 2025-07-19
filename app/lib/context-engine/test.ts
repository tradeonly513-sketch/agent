/**
 * Simple test file for Context Engine functionality
 * Run this with: node -r ts-node/register app/lib/context-engine/test.ts
 */

import { BoltContextEngine } from './core';
import { ContextEngineManager } from './manager';
import type { FileMap } from './manager';
import type { Message } from 'ai';

// Mock file structure
const mockFiles: FileMap = {
  '/home/project/src/components/Header.tsx': {
    type: 'file',
    isBinary: false,
    content: `import React from 'react';
import { useState } from 'react';

interface HeaderProps {
  title: string;
  onMenuClick: () => void;
}

export function Header({ title, onMenuClick }: HeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleMenuToggle = () => {
    setIsMenuOpen(!isMenuOpen);
    onMenuClick();
  };

  return (
    <header className="bg-blue-500 text-white p-4">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold">{title}</h1>
        <button 
          onClick={handleMenuToggle}
          className="md:hidden"
        >
          Menu
        </button>
      </div>
    </header>
  );
}`,
  },
  '/home/project/src/components/Sidebar.tsx': {
    type: 'file',
    isBinary: false,
    content: `import React from 'react';
import { Link } from 'react-router-dom';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  return (
    <aside className={\`fixed left-0 top-0 h-full w-64 bg-gray-800 text-white transform transition-transform \${isOpen ? 'translate-x-0' : '-translate-x-full'}\`}>
      <div className="p-4">
        <h2 className="text-lg font-semibold mb-4">Navigation</h2>
        <nav>
          <ul className="space-y-2">
            <li><Link to="/" onClick={onClose}>Home</Link></li>
            <li><Link to="/about" onClick={onClose}>About</Link></li>
            <li><Link to="/contact" onClick={onClose}>Contact</Link></li>
          </ul>
        </nav>
      </div>
    </aside>
  );
}`,
  },
  '/home/project/src/utils/api.ts': {
    type: 'file',
    isBinary: false,
    content: `export async function fetchData(url: string) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(\`HTTP error! status: \${response.status}\`);
    }
    return await response.json();
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  }
}

export function formatData(data: any[]): string[] {
  return data.map(item => item.toString());
}`,
  },
  '/home/project/src/hooks/useLocalStorage.ts': {
    type: 'file',
    isBinary: false,
    content: `import { useState, useEffect } from 'react';

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error('Error reading from localStorage:', error);
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error('Error writing to localStorage:', error);
    }
  };

  return [storedValue, setValue] as const;
}`,
  },
};

// Mock messages
const mockMessages: Message[] = [
  {
    id: '1',
    role: 'user',
    content:
      '[Model: gpt-4o]\n\n[Provider: OpenAI]\n\nI want to modify the Header component to include a search functionality. Add a search input field next to the menu button.',
  },
];

async function testContextEngine() {
  console.log('🚀 Testing Bolt Context Engine...\n');

  try {
    // Test 1: Basic Context Engine functionality
    console.log('📊 Test 1: Basic indexing and retrieval');

    const engine = new BoltContextEngine();

    console.log('Indexing codebase...');
    await engine.indexCodebase(mockFiles);
    console.log('✅ Indexing completed');

    const intent = await engine.analyzeIntent(mockMessages);
    console.log('📝 Intent analysis:', {
      type: intent.type,
      entities: intent.entities,
      keywords: intent.keywords,
      confidence: intent.confidence,
    });

    const optimizationResult = await engine.optimizeContext(mockMessages, mockFiles, 4000);
    console.log('🎯 Context optimization result:', {
      contextLength: optimizationResult.context.length,
      metadata: optimizationResult.metadata,
    });

    // Test 2: Context Engine Manager
    console.log('\n📊 Test 2: Context Engine Manager');

    const manager = new ContextEngineManager({
      enableSmartRetrieval: true,
      enableCompression: true,
      maxContextRatio: 0.7,
      compressionThreshold: 3000,
    });

    const managerResult = await manager.optimizeContext(mockMessages, mockFiles, 'gpt-4o');

    console.log('🎯 Manager optimization result:', {
      strategy: managerResult.strategy,
      originalTokens: managerResult.originalTokens,
      optimizedTokens: managerResult.optimizedTokens,
      compressionRatio: managerResult.compressionRatio,
      processingTime: managerResult.metadata.processingTime,
    });

    // Test 3: Performance with large context
    console.log('\n📊 Test 3: Performance test with larger context');

    const largeFiles = { ...mockFiles };

    // Add more files to simulate a larger codebase
    for (let i = 0; i < 20; i++) {
      largeFiles[`/home/project/src/components/Component${i}.tsx`] = {
        type: 'file',
        isBinary: false,
        content: `export function Component${i}() {
  return <div>Component ${i}</div>;
}`.repeat(10), // Make it longer
      };
    }

    const startTime = Date.now();
    const largeResult = await manager.optimizeContext(mockMessages, largeFiles, 'gpt-4o');
    const endTime = Date.now();

    console.log('🎯 Large context optimization:', {
      strategy: largeResult.strategy,
      fileCount: Object.keys(largeFiles).length,
      originalTokens: largeResult.originalTokens,
      optimizedTokens: largeResult.optimizedTokens,
      compressionRatio: largeResult.compressionRatio,
      processingTime: endTime - startTime,
      nodesRetrieved: largeResult.metadata.nodesRetrieved,
    });

    console.log('\n✅ All tests completed successfully!');

    // Statistics
    const stats = manager.getStatistics();
    console.log('\n📈 Context Engine Statistics:', stats);
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Export test function for use in other files
export { testContextEngine };

// Run tests if this file is executed directly
if (require.main === module) {
  testContextEngine();
}
