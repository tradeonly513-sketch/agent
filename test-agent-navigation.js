// Agent 模式页面导航测试脚本
// 在浏览器控制台中运行

console.log('🧪 开始测试 Agent 模式页面导航...');

// 测试函数：检查页面状态
function checkPageState() {
  const state = {
    url: window.location.pathname,
    isHomePage: window.location.pathname === '/',
    isChatPage: window.location.pathname.startsWith('/chat/'),
    hasWorkbench: !!document.querySelector('[data-workbench]') || 
                  !!document.querySelector('.workbench') ||
                  !!document.querySelector('[class*="workbench"]'),
    hasFileTree: !!document.querySelector('[data-file-tree]') || 
                 !!document.querySelector('.file-tree') ||
                 !!document.querySelector('[class*="file"]'),
    hasEditor: !!document.querySelector('[data-editor]') || 
               !!document.querySelector('.editor') ||
               !!document.querySelector('textarea') ||
               !!document.querySelector('[class*="editor"]'),
    hasMessages: !!document.querySelector('[data-messages]') || 
                 !!document.querySelector('.messages') ||
                 !!document.querySelector('[class*="message"]'),
    agentMode: null,
    chatStarted: null
  };

  // 尝试获取模式状态
  try {
    const buttons = document.querySelectorAll('button');
    buttons.forEach(button => {
      const text = button.textContent?.toLowerCase();
      if (text?.includes('agent') && button.className?.includes('accent')) {
        state.agentMode = 'agent';
      } else if (text?.includes('chat') && button.className?.includes('accent')) {
        state.agentMode = 'chat';
      }
    });
  } catch (e) {
    console.warn('无法检测模式状态:', e);
  }

  return state;
}

// 测试函数：模拟用户输入
function simulateUserInput(text) {
  const textarea = document.querySelector('textarea');
  if (!textarea) {
    console.error('❌ 未找到输入框');
    return false;
  }

  // 模拟输入
  textarea.value = text;
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  
  // 模拟回车
  const enterEvent = new KeyboardEvent('keydown', {
    key: 'Enter',
    code: 'Enter',
    keyCode: 13,
    which: 13,
    bubbles: true
  });
  textarea.dispatchEvent(enterEvent);

  console.log('✅ 模拟输入完成:', text);
  return true;
}

// 测试函数：切换到 Agent 模式
function switchToAgentMode() {
  const buttons = document.querySelectorAll('button');
  let agentButton = null;

  buttons.forEach(button => {
    const text = button.textContent?.toLowerCase();
    if (text?.includes('chat') || text?.includes('agent')) {
      // 如果当前显示 "Chat"，点击会切换到 Agent
      if (text.includes('chat')) {
        agentButton = button;
      }
    }
  });

  if (agentButton) {
    agentButton.click();
    console.log('✅ 切换到 Agent 模式');
    return true;
  } else {
    console.error('❌ 未找到模式切换按钮');
    return false;
  }
}

// 主测试函数
async function testAgentNavigation() {
  console.log('📋 测试 1: 检查初始页面状态...');
  
  const initialState = checkPageState();
  console.log('初始状态:', initialState);

  if (!initialState.isHomePage) {
    console.warn('⚠️ 当前不在首页，请刷新页面到首页再测试');
    return false;
  }

  console.log('📋 测试 2: 切换到 Agent 模式...');
  
  if (!switchToAgentMode()) {
    return false;
  }

  // 等待状态更新
  await new Promise(resolve => setTimeout(resolve, 500));

  console.log('📋 测试 3: 模拟用户输入...');
  
  const testInput = "Create a React todo application";
  if (!simulateUserInput(testInput)) {
    return false;
  }

  console.log('📋 测试 4: 等待页面响应...');
  
  // 等待页面跳转和状态更新
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('📋 测试 5: 检查最终状态...');
  
  const finalState = checkPageState();
  console.log('最终状态:', finalState);

  // 验证结果
  const results = {
    pageNavigation: finalState.isChatPage,
    workbenchVisible: finalState.hasWorkbench,
    editorVisible: finalState.hasEditor,
    messagesVisible: finalState.hasMessages,
    agentModeActive: finalState.agentMode === 'agent'
  };

  console.log('📊 测试结果:', results);

  // 计算通过率
  const passed = Object.values(results).filter(r => r).length;
  const total = Object.values(results).length;
  
  console.log(`📈 通过率: ${passed}/${total} (${Math.round(passed/total*100)}%)`);

  if (passed === total) {
    console.log('🎉 所有测试通过！Agent 模式页面导航正常工作。');
  } else {
    console.log('⚠️ 部分测试失败，需要进一步检查：');
    Object.entries(results).forEach(([key, value]) => {
      if (!value) {
        console.log(`  ❌ ${key}: 失败`);
      }
    });
  }

  return passed === total;
}

// 辅助函数：检查控制台错误
function checkConsoleErrors() {
  console.log('📋 检查控制台错误...');
  
  // 这个需要手动检查
  console.log('ℹ️ 请手动检查控制台是否有红色错误信息');
  console.log('ℹ️ 特别关注以下类型的错误:');
  console.log('   - JavaScript 语法错误');
  console.log('   - 网络请求失败');
  console.log('   - React 组件错误');
  console.log('   - 路由导航错误');
}

// 辅助函数：检查网络请求
function checkNetworkRequests() {
  console.log('📋 检查网络请求...');
  console.log('ℹ️ 请在 Network 标签页检查:');
  console.log('   1. 是否有 /api/chat 请求');
  console.log('   2. 请求状态码是否为 200');
  console.log('   3. 响应内容是否正常');
}

// 导出测试函数
if (typeof window !== 'undefined') {
  window.testAgentNavigation = {
    runTest: testAgentNavigation,
    checkPageState,
    simulateUserInput,
    switchToAgentMode,
    checkConsoleErrors,
    checkNetworkRequests
  };
  
  console.log('ℹ️ 测试函数已添加到 window.testAgentNavigation');
  console.log('ℹ️ 运行完整测试: window.testAgentNavigation.runTest()');
  console.log('ℹ️ 检查页面状态: window.testAgentNavigation.checkPageState()');
}

// 自动运行测试（如果在首页）
if (typeof window !== 'undefined' && window.location.pathname === '/') {
  console.log('🚀 检测到首页，准备自动运行测试...');
  console.log('ℹ️ 3秒后开始测试，或手动运行 window.testAgentNavigation.runTest()');
  
  setTimeout(() => {
    if (confirm('是否开始 Agent 模式页面导航测试？')) {
      testAgentNavigation();
    }
  }, 3000);
} else {
  console.log('ℹ️ 请在首页运行此测试脚本');
  console.log('ℹ️ 或手动调用 window.testAgentNavigation.runTest()');
}
