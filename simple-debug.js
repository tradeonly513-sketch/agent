// 简单调试上下文问题
console.log('🔍 调试上下文溢出问题...\n');

// 模拟问题场景
function simulateContextIssue() {
  console.log('📋 模拟用户场景: 项目创建成功，但聊天时出现上下文溢出...\n');

  // 创建一个大型系统提示符（模拟项目创建后的状态）
  let systemPrompt = `You are Bolt, an expert AI assistant and exceptional senior software developer with vast knowledge across multiple programming languages, frameworks, design patterns, and best practices.

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
    "react-dom": "^18.2.0"
  }
}
</boltAction>

<boltAction type="file" filePath="src/App.tsx">
import React, { useState, useEffect } from 'react';

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
  // ... 大量的组件代码
  return <div>Todo App</div>;
};

export default App;
</boltAction>
</boltArtifact>

You are working on a React Todo application. The project has been successfully created and is running.`;

  // 添加大量内容来模拟真实场景
  for (let i = 0; i < 200; i++) {
    systemPrompt += `\n\nAdditional context ${i}: This is additional context that might be included in a real conversation. It contains information about the project, user preferences, previous interactions, and other relevant details that accumulate over time during a development session. This simulates the large system prompts that can occur in real usage.`;
  }

  console.log(`📏 系统提示符大小: ${systemPrompt.length} 字符`);

  // 简单的 token 估算 (1 token ≈ 4 字符)
  const systemTokens = Math.ceil(systemPrompt.length / 4);
  console.log(`📊 系统提示符估算 tokens: ${systemTokens}`);

  // 模拟消息
  const messages = [
    { role: 'user', content: '请帮我在这个 Todo 应用中添加一个搜索功能，用户可以通过关键词搜索 todo 项目。' },
    { role: 'assistant', content: '我来帮你添加搜索功能。我会在现有的 Todo 应用中添加一个搜索输入框，让用户可以通过关键词过滤 todo 项目。' },
    { role: 'user', content: '好的，请实现这个功能，并确保搜索是实时的，不区分大小写。' }
  ];

  let messageTokens = 0;
  messages.forEach(msg => {
    const tokens = Math.ceil(msg.content.length / 4);
    messageTokens += tokens;
    console.log(`📝 消息 "${msg.content.substring(0, 50)}...": ~${tokens} tokens`);
  });

  console.log(`📊 消息总 tokens: ${messageTokens}`);
  
  const completionTokens = 8000;
  const bufferTokens = 2000;
  const totalTokens = systemTokens + messageTokens + completionTokens + bufferTokens;
  
  console.log(`📊 预估总 tokens: ${totalTokens}`);
  console.log(`📊 Deepseek 限制: 65536 tokens`);
  
  if (totalTokens > 65536) {
    console.log(`⚠️  超出限制: ${totalTokens - 65536} tokens`);
    console.log('❌ 这就是用户遇到的问题！');
    
    // 计算需要的截断
    const maxSystemTokens = Math.floor(65536 * 0.4); // 40% 限制
    console.log(`\n🔧 应该截断系统提示符到: ${maxSystemTokens} tokens`);
    
    if (systemTokens > maxSystemTokens) {
      const truncationRatio = maxSystemTokens / systemTokens;
      const truncatedLength = Math.floor(systemPrompt.length * truncationRatio * 0.9);
      const truncatedPrompt = systemPrompt.substring(0, truncatedLength) + '\n\n[System prompt truncated to fit context window]';
      
      const truncatedTokens = Math.ceil(truncatedPrompt.length / 4);
      const newTotal = truncatedTokens + messageTokens + completionTokens + bufferTokens;
      
      console.log(`✂️  截断后系统提示符: ${truncatedTokens} tokens`);
      console.log(`📊 截断后总 tokens: ${newTotal}`);
      console.log(`✅ 是否在限制内: ${newTotal <= 65536 ? '是' : '否'}`);
      
      return newTotal <= 65536;
    }
  } else {
    console.log('✅ 在限制内，不需要截断');
    return true;
  }
  
  return false;
}

// 运行模拟
const result = simulateContextIssue();

if (!result) {
  console.log('\n❌ 发现问题：上下文管理器可能没有正确工作');
  console.log('🔧 需要检查实际的上下文管理器实现');
} else {
  console.log('\n✅ 模拟测试通过');
}

console.log('\n🎯 问题分析:');
console.log('1. 用户报告项目创建成功，但聊天时出现上下文溢出');
console.log('2. 错误信息显示 119950 tokens > 65536 limit');
console.log('3. 这表明上下文管理器可能没有被正确调用或执行');
console.log('4. 需要检查 stream-text.ts 中的上下文管理器调用');

console.log('\n🔍 可能的原因:');
console.log('- 上下文管理器没有被正确调用');
console.log('- 系统提示符截断功能没有生效');
console.log('- 错误处理中断了上下文优化流程');
console.log('- 某些代码路径绕过了上下文管理');

console.log('\n🛠️  下一步行动:');
console.log('1. 检查 stream-text.ts 中的上下文管理器调用');
console.log('2. 添加更多日志来跟踪执行流程');
console.log('3. 确保所有代码路径都经过上下文管理');
console.log('4. 测试修复并验证结果');
