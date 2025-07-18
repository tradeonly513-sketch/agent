// 调试上下文问题 - 重现用户遇到的错误
import { ContextManager } from './app/lib/.server/llm/context-manager.ts';
import { countSystemTokens } from './app/lib/.server/llm/token-counter.ts';

console.log('🔍 调试上下文溢出问题...\n');

// 模拟用户遇到的场景
async function debugContextIssue() {
  try {
    console.log('📋 模拟用户场景: 项目创建成功，但聊天时出现上下文溢出...\n');

    // 创建一个大型系统提示符（模拟项目创建后的状态）
    const createLargeSystemPrompt = () => {
      let prompt = `You are Bolt, an expert AI assistant and exceptional senior software developer with vast knowledge across multiple programming languages, frameworks, design patterns, and best practices.

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
        
        {/* Add Todo Form */}
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
          
          <div className="flex gap-2">
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Category (optional)"
              className="flex-1 px-3 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as 'low' | 'medium' | 'high')}
              className="px-3 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
        </div>

        {/* Filter Buttons */}
        <div className="flex justify-center mb-4">
          <div className="inline-flex rounded-md shadow-sm">
            {(['all', 'active', 'completed'] as const).map((filterType) => (
              <button
                key={filterType}
                onClick={() => setFilter(filterType)}
                className={\`px-4 py-2 text-sm font-medium \${
                  filter === filterType
                    ? 'bg-blue-500 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                } \${
                  filterType === 'all' ? 'rounded-l-md' :
                  filterType === 'completed' ? 'rounded-r-md' : ''
                } border border-gray-300\`}
              >
                {filterType.charAt(0).toUpperCase() + filterType.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Todo List */}
        <div className="space-y-2 mb-4">
          {filteredTodos.map(todo => (
            <TodoItem
              key={todo.id}
              todo={todo}
              onToggle={toggleTodo}
              onDelete={deleteTodo}
              onEdit={editTodo}
            />
          ))}
          {filteredTodos.length === 0 && (
            <p className="text-center text-gray-500 py-4">
              {filter === 'all' ? 'No todos yet' : \`No \${filter} todos\`}
            </p>
          )}
        </div>

        {/* Stats and Actions */}
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

interface TodoItemProps {
  todo: Todo;
  onToggle: (id: number) => void;
  onDelete: (id: number) => void;
  onEdit: (id: number, newText: string) => void;
}

const TodoItem: React.FC<TodoItemProps> = ({ todo, onToggle, onDelete, onEdit }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(todo.text);

  const handleEdit = () => {
    if (editText.trim() !== '') {
      onEdit(todo.id, editText.trim());
      setIsEditing(false);
    }
  };

  const priorityColors = {
    low: 'border-l-green-400',
    medium: 'border-l-yellow-400',
    high: 'border-l-red-400'
  };

  return (
    <div className={\`flex items-center p-3 border border-gray-200 rounded-md \${priorityColors[todo.priority]} border-l-4\`}>
      <input
        type="checkbox"
        checked={todo.completed}
        onChange={() => onToggle(todo.id)}
        className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
      />
      
      <div className="flex-1">
        {isEditing ? (
          <input
            type="text"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={handleEdit}
            onKeyPress={(e) => e.key === 'Enter' && handleEdit()}
            className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            autoFocus
          />
        ) : (
          <div>
            <span
              className={\`\${todo.completed ? 'line-through text-gray-500' : 'text-gray-800'}\`}
              onDoubleClick={() => setIsEditing(true)}
            >
              {todo.text}
            </span>
            <div className="text-xs text-gray-500 mt-1">
              {todo.category} • {todo.priority} priority • {todo.createdAt.toLocaleDateString()}
            </div>
          </div>
        )}
      </div>
      
      <div className="flex gap-2 ml-2">
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="text-blue-500 hover:text-blue-700 text-sm"
        >
          Edit
        </button>
        <button
          onClick={() => onDelete(todo.id)}
          className="text-red-500 hover:text-red-700 text-sm"
        >
          Delete
        </button>
      </div>
    </div>
  );
};

export default App;
</boltAction>
</boltArtifact>

You are working on a React Todo application. The project has been successfully created and is running. The user can now interact with you to make modifications, add features, or fix any issues.

Current project structure:
- package.json: Contains all necessary dependencies
- index.html: Main HTML file
- src/main.tsx: Entry point
- src/App.tsx: Main application component with full todo functionality

The application includes:
- Add todos with priority and category
- Mark todos as complete/incomplete
- Edit todos by double-clicking
- Filter todos (all/active/completed)
- Delete individual todos
- Clear all completed todos
- Local storage persistence
- Responsive design with Tailwind CSS

What would you like to do next?`;

      // 添加更多内容来模拟真实的大型上下文
      for (let i = 0; i < 50; i++) {
        prompt += `\n\nAdditional context ${i}: This is additional context that might be included in a real conversation. It contains information about the project, user preferences, previous interactions, and other relevant details that accumulate over time during a development session.`;
      }

      return prompt;
    };

    // 创建测试消息
    const testMessages = [
      {
        role: 'user',
        content: '请帮我在这个 Todo 应用中添加一个搜索功能，用户可以通过关键词搜索 todo 项目。'
      },
      {
        role: 'assistant',
        content: '我来帮你添加搜索功能。我会在现有的 Todo 应用中添加一个搜索输入框，让用户可以通过关键词过滤 todo 项目。'
      },
      {
        role: 'user',
        content: '好的，请实现这个功能，并确保搜索是实时的，不区分大小写。'
      }
    ];

    const systemPrompt = createLargeSystemPrompt();
    console.log(`📏 系统提示符大小: ${systemPrompt.length} 字符`);

    // 创建上下文管理器
    const contextManager = new ContextManager({
      model: 'deepseek-chat',
      maxContextTokens: 65536,
      completionTokens: 8000,
      bufferTokens: 2000
    });

    // 计算初始 token 数量
    const systemTokens = countSystemTokens(systemPrompt, undefined, 'deepseek-chat');
    console.log(`📊 系统提示符 tokens: ${systemTokens}`);

    // 计算消息 tokens
    let messageTokens = 0;
    testMessages.forEach(msg => {
      const tokens = Math.ceil(msg.content.length / 4); // 简单估算
      messageTokens += tokens;
      console.log(`📝 消息 "${msg.content.substring(0, 50)}...": ~${tokens} tokens`);
    });

    console.log(`📊 消息总 tokens: ${messageTokens}`);
    console.log(`📊 预估总 tokens: ${systemTokens + messageTokens + 8000 + 2000}`);

    if (systemTokens + messageTokens + 8000 + 2000 > 65536) {
      console.log('⚠️  预估会超出上下文限制，测试上下文管理器...\n');
    }

    // 测试上下文优化
    const result = await contextManager.optimizeMessages(
      testMessages,
      systemPrompt,
      undefined
    );

    console.log('\n📊 上下文优化结果:');
    console.log(`   策略: ${result.strategy}`);
    console.log(`   系统提示符被截断: ${result.systemPromptTruncated ? '是' : '否'}`);
    console.log(`   消息数量: ${result.messages.length}`);
    console.log(`   移除的消息数: ${result.removedMessages}`);
    console.log(`   是否截断: ${result.truncated ? '是' : '否'}`);

    if (result.systemPromptTruncated) {
      console.log(`   截断后系统提示符大小: ${result.systemPrompt.length} 字符`);
      const newSystemTokens = countSystemTokens(result.systemPrompt, undefined, 'deepseek-chat');
      console.log(`   截断后系统提示符 tokens: ${newSystemTokens}`);
    }

    // 验证最终结果是否在限制内
    const finalSystemTokens = countSystemTokens(result.systemPrompt, undefined, 'deepseek-chat');
    const finalMessageTokens = result.messages.reduce((total, msg) => {
      return total + Math.ceil(msg.content.length / 4);
    }, 0);
    const finalTotal = finalSystemTokens + finalMessageTokens + 8000 + 2000;

    console.log(`\n✅ 最终验证:`);
    console.log(`   最终系统提示符 tokens: ${finalSystemTokens}`);
    console.log(`   最终消息 tokens: ${finalMessageTokens}`);
    console.log(`   预估最终总 tokens: ${finalTotal}`);
    console.log(`   是否在限制内: ${finalTotal <= 65536 ? '是' : '否'}`);

    if (finalTotal > 65536) {
      console.log('\n❌ 上下文管理器没有成功解决问题！');
      console.log('   需要进一步调试和修复。');
      return false;
    } else {
      console.log('\n🎉 上下文管理器工作正常！');
      return true;
    }

  } catch (error) {
    console.error('❌ 调试过程中出现错误:', error);
    return false;
  }
}

// 运行调试
debugContextIssue().then(success => {
  if (!success) {
    console.log('\n🔧 需要修复上下文管理器...');
    process.exit(1);
  } else {
    console.log('\n✅ 调试完成，上下文管理器工作正常。');
  }
});
