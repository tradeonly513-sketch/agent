// 严格的上下文溢出测试 - 模拟用户的确切场景
console.log('🔬 严格上下文溢出测试...\n');

// 模拟用户遇到的确切场景：项目创建成功后的聊天
function createRealWorldSystemPrompt() {
  // 这是一个真实的大型系统提示符，类似用户遇到的情况
  return `You are Bolt, an expert AI assistant and exceptional senior software developer with vast knowledge across multiple programming languages, frameworks, design patterns, and best practices.

<boltArtifact id="project-files" title="Project Files">
<boltAction type="file" filePath="package.json">
{
  "name": "react-todo-app",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@types/react": "^18.2.43",
    "@types/react-dom": "^18.2.17",
    "@typescript-eslint/eslint-plugin": "^6.14.0",
    "@typescript-eslint/parser": "^6.14.0",
    "@vitejs/plugin-react": "^4.2.1",
    "eslint": "^8.55.0",
    "eslint-plugin-react-hooks": "^4.6.0",
    "eslint-plugin-react-refresh": "^0.4.5",
    "typescript": "^5.2.2",
    "vite": "^5.0.8",
    "tailwindcss": "^3.3.6",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.32"
  }
}
</boltAction>

<boltAction type="file" filePath="index.html">
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>React Todo App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
</boltAction>

<boltAction type="file" filePath="src/main.tsx">
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
</boltAction>

<boltAction type="file" filePath="src/App.tsx">
import React, { useState, useEffect } from 'react';
import './App.css';

interface Todo {
  id: number;
  text: string;
  completed: boolean;
  createdAt: Date;
  priority: 'low' | 'medium' | 'high';
  category: string;
}

const App: React.FC = () => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [inputText, setInputText] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [category, setCategory] = useState('');

  // Load todos from localStorage on component mount
  useEffect(() => {
    const savedTodos = localStorage.getItem('todos');
    if (savedTodos) {
      try {
        const parsedTodos = JSON.parse(savedTodos).map((todo: any) => ({
          ...todo,
          createdAt: new Date(todo.createdAt)
        }));
        setTodos(parsedTodos);
      } catch (error) {
        console.error('Error parsing saved todos:', error);
      }
    }
  }, []);

  // Save todos to localStorage whenever todos change
  useEffect(() => {
    localStorage.setItem('todos', JSON.stringify(todos));
  }, [todos]);

  const addTodo = () => {
    if (inputText.trim() !== '') {
      const newTodo: Todo = {
        id: Date.now(),
        text: inputText.trim(),
        completed: false,
        createdAt: new Date(),
        priority,
        category: category.trim() || 'General'
      };
      setTodos([...todos, newTodo]);
      setInputText('');
      setCategory('');
    }
  };

  const toggleTodo = (id: number) => {
    setTodos(todos.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ));
  };

  const deleteTodo = (id: number) => {
    setTodos(todos.filter(todo => todo.id !== id));
  };

  const editTodo = (id: number, newText: string) => {
    setTodos(todos.map(todo =>
      todo.id === id ? { ...todo, text: newText } : todo
    ));
  };

  const clearCompleted = () => {
    setTodos(todos.filter(todo => !todo.completed));
  };

  const filteredTodos = todos.filter(todo => {
    switch (filter) {
      case 'active':
        return !todo.completed;
      case 'completed':
        return todo.completed;
      default:
        return true;
    }
  });

  const completedCount = todos.filter(todo => todo.completed).length;
  const activeCount = todos.length - completedCount;

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-center mb-6 text-gray-800">
          Todo App
        </h1>
        
        <div className="mb-6">
          <div className="flex mb-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addTodo()}
              placeholder="Add a new todo..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={addTodo}
              className="px-4 py-2 bg-blue-500 text-white rounded-r-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Add
            </button>
          </div>
        </div>

        <div className="space-y-2 mb-4">
          {filteredTodos.map(todo => (
            <div key={todo.id} className="flex items-center p-3 border border-gray-200 rounded-md">
              <input
                type="checkbox"
                checked={todo.completed}
                onChange={() => toggleTodo(todo.id)}
                className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <div className="flex-1">
                <span className={todo.completed ? 'line-through text-gray-500' : 'text-gray-800'}>
                  {todo.text}
                </span>
                <div className="text-xs text-gray-500 mt-1">
                  {todo.category} • {todo.priority} priority • {todo.createdAt.toLocaleDateString()}
                </div>
              </div>
              <div className="flex gap-2 ml-2">
                <button
                  onClick={() => editTodo(todo.id, prompt('Edit todo:', todo.text) || todo.text)}
                  className="text-blue-500 hover:text-blue-700 text-sm"
                >
                  Edit
                </button>
                <button
                  onClick={() => deleteTodo(todo.id)}
                  className="text-red-500 hover:text-red-700 text-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
          {filteredTodos.length === 0 && (
            <p className="text-center text-gray-500 py-4">
              {filter === 'all' ? 'No todos yet' : \`No \${filter} todos\`}
            </p>
          )}
        </div>

        {todos.length > 0 && (
          <div className="flex justify-between items-center text-sm text-gray-600">
            <span>
              {activeCount} active, {completedCount} completed
            </span>
            {completedCount > 0 && (
              <button
                onClick={clearCompleted}
                className="text-red-500 hover:text-red-700"
              >
                Clear completed
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
</boltAction>

<boltAction type="file" filePath="src/App.css">
#root {
  max-width: 1280px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
}

.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
  transition: filter 300ms;
}
.logo:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
}
.logo.react:hover {
  filter: drop-shadow(0 0 2em #61dafbaa);
}

@keyframes logo-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: no-preference) {
  a:nth-of-type(2) .logo {
    animation: logo-spin infinite 20s linear;
  }
}

.card {
  padding: 2em;
}

.read-the-docs {
  color: #888;
}
</boltAction>

<boltAction type="file" filePath="src/index.css">
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
  line-height: 1.5;
  font-weight: 400;

  color-scheme: light dark;
  color: rgba(255, 255, 255, 0.87);
  background-color: #242424;

  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  -webkit-text-size-adjust: 100%;
}

a {
  font-weight: 500;
  color: #646cff;
  text-decoration: inherit;
}
a:hover {
  color: #535bf2;
}

body {
  margin: 0;
  display: flex;
  place-items: center;
  min-width: 320px;
  min-height: 100vh;
}

h1 {
  font-size: 3.2em;
  line-height: 1.1;
}

button {
  border-radius: 8px;
  border: 1px solid transparent;
  padding: 0.6em 1.2em;
  font-size: 1em;
  font-weight: 500;
  font-family: inherit;
  background-color: #1a1a1a;
  cursor: pointer;
  transition: border-color 0.25s;
}
button:hover {
  border-color: #646cff;
}
button:focus,
button:focus-visible {
  outline: 4px auto -webkit-focus-ring-color;
}

@media (prefers-color-scheme: light) {
  :root {
    color: #213547;
    background-color: #ffffff;
  }
  a:hover {
    color: #747bff;
  }
  button {
    background-color: #f9f9f9;
  }
}
</boltAction>

<boltAction type="file" filePath="vite.config.ts">
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
})
</boltAction>

<boltAction type="file" filePath="tsconfig.json">
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",

    /* Linting */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
</boltAction>

<boltAction type="file" filePath="tsconfig.node.json">
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
</boltAction>

<boltAction type="file" filePath="tailwind.config.js">
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
</boltAction>

<boltAction type="file" filePath="postcss.config.js">
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
</boltAction>

<boltAction type="file" filePath=".eslintrc.cjs">
module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended',
    'eslint:recommended',
    '@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
  },
}
</boltAction>
</boltArtifact>

You are working on a React Todo application. The project has been successfully created and is running. The user can now interact with you to make modifications, add features, or fix any issues.

Current project structure:
- package.json: Contains all necessary dependencies including React, TypeScript, Vite, Tailwind CSS
- index.html: Main HTML file with proper meta tags and root div
- src/main.tsx: Entry point that renders the App component
- src/App.tsx: Main application component with full todo functionality including:
  * Add todos with priority and category
  * Mark todos as complete/incomplete  
  * Edit todos with inline editing
  * Filter todos (all/active/completed)
  * Delete individual todos
  * Clear all completed todos
  * Local storage persistence
  * Responsive design with Tailwind CSS
- src/App.css: Component-specific styles
- src/index.css: Global styles with Tailwind imports
- vite.config.ts: Vite configuration with React plugin
- tsconfig.json: TypeScript configuration with strict settings
- tsconfig.node.json: Node-specific TypeScript configuration
- tailwind.config.js: Tailwind CSS configuration
- postcss.config.js: PostCSS configuration for Tailwind
- .eslintrc.cjs: ESLint configuration with TypeScript and React rules

The application includes comprehensive todo management features with a clean, modern UI. All files are properly configured and the project is ready for development.

What would you like to do next?`;
}

// 模拟用户的消息历史（这会导致上下文溢出）
function createLargeMessageHistory() {
  return [
    {
      role: 'user',
      content: '请帮我在这个 Todo 应用中添加一个搜索功能，用户可以通过关键词搜索 todo 项目。'
    },
    {
      role: 'assistant',
      content: '我来帮你添加搜索功能。我会在现有的 Todo 应用中添加一个搜索输入框，让用户可以通过关键词过滤 todo 项目。这个搜索功能将是实时的，不区分大小写，并且会搜索 todo 的文本内容和分类。'
    },
    {
      role: 'user',
      content: '好的，请实现这个功能，并确保搜索是实时的，不区分大小写。另外，我希望搜索结果能够高亮显示匹配的关键词。'
    },
    {
      role: 'assistant',
      content: '完美！我会为你实现一个功能完整的搜索系统，包括实时搜索、不区分大小写匹配，以及关键词高亮显示。让我来修改 App.tsx 文件来添加这些功能。'
    }
  ];
}

// 执行严格测试
function runStrictTest() {
  console.log('📋 模拟用户的确切场景...');
  
  const systemPrompt = createRealWorldSystemPrompt();
  const messages = createLargeMessageHistory();
  
  console.log(`📏 系统提示符大小: ${systemPrompt.length} 字符`);
  
  // 计算 tokens (使用更精确的估算)
  const systemTokens = Math.ceil(systemPrompt.length / 3.5); // 更精确的估算
  let messageTokens = 0;
  
  messages.forEach((msg, index) => {
    const tokens = Math.ceil(msg.content.length / 3.5);
    messageTokens += tokens;
    console.log(`📝 消息 ${index + 1}: ${tokens} tokens`);
  });
  
  const completionTokens = 8000;
  const bufferTokens = 2000;
  const totalTokens = systemTokens + messageTokens + completionTokens + bufferTokens;
  
  console.log(`\n📊 Token 分析:`);
  console.log(`   系统提示符: ${systemTokens} tokens`);
  console.log(`   消息总计: ${messageTokens} tokens`);
  console.log(`   完成 tokens: ${completionTokens} tokens`);
  console.log(`   缓冲 tokens: ${bufferTokens} tokens`);
  console.log(`   总计: ${totalTokens} tokens`);
  console.log(`   Deepseek 限制: 65536 tokens`);
  
  if (totalTokens > 65536) {
    const overflow = totalTokens - 65536;
    console.log(`\n⚠️  上下文溢出: ${overflow} tokens`);
    console.log('❌ 这正是用户遇到的问题！');
    
    // 测试上下文管理器应该如何处理
    console.log('\n🔧 测试上下文管理器应该如何处理...');
    
    // 40% 系统提示符限制
    const maxSystemTokens = Math.floor(65536 * 0.4); // 26,214 tokens
    console.log(`   最大系统提示符 tokens: ${maxSystemTokens}`);
    
    if (systemTokens > maxSystemTokens) {
      console.log(`   ✂️  需要截断系统提示符: ${systemTokens} → ${maxSystemTokens}`);
      
      const truncationRatio = maxSystemTokens / systemTokens;
      const truncatedLength = Math.floor(systemPrompt.length * truncationRatio * 0.9);
      const truncatedPrompt = systemPrompt.substring(0, truncatedLength) + '\n\n[System prompt truncated to fit context window]';
      
      const truncatedSystemTokens = Math.ceil(truncatedPrompt.length / 3.5);
      const newTotal = truncatedSystemTokens + messageTokens + completionTokens + bufferTokens;
      
      console.log(`   截断后系统提示符: ${truncatedSystemTokens} tokens`);
      console.log(`   截断后总计: ${newTotal} tokens`);
      console.log(`   是否在限制内: ${newTotal <= 65536 ? '✅ 是' : '❌ 否'}`);
      
      if (newTotal <= 65536) {
        console.log('\n🎉 上下文管理器应该能够解决这个问题！');
        return true;
      } else {
        console.log('\n❌ 即使截断系统提示符也无法解决问题！');
        return false;
      }
    }
  } else {
    console.log('\n✅ 在限制内，不需要处理');
    return true;
  }
  
  return false;
}

// 运行测试
const testResult = runStrictTest();

console.log('\n🎯 测试结论:');
if (testResult) {
  console.log('✅ 上下文管理器应该能够处理这种情况');
  console.log('🔍 如果用户仍然遇到问题，说明上下文管理器没有被正确调用');
} else {
  console.log('❌ 即使有上下文管理器也无法处理这种情况');
  console.log('🔧 需要更激进的优化策略');
}

console.log('\n📝 下一步行动:');
console.log('1. 检查服务器日志，确认上下文管理器是否被调用');
console.log('2. 验证系统提示符截断是否正常工作');
console.log('3. 确保所有代码路径都经过上下文管理');
console.log('4. 如果问题仍然存在，需要进一步调试');
