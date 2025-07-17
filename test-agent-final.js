// Agent 模式最终测试脚本
// 在浏览器控制台中运行，验证自动跳转功能

console.log('🧪 Agent 模式最终测试开始...');

// 测试配置
const TEST_CONFIG = {
  testMessage: "Create a React todo application with CRUD operations",
  maxWaitTime: 5000, // 5秒最大等待时间
  checkInterval: 500, // 每500ms检查一次状态
};

// 状态检查函数
function checkPageState() {
  return {
    url: window.location.pathname,
    isHomePage: window.location.pathname === '/',
    isChatPage: window.location.pathname.startsWith('/chat/'),
    hasWorkbench: !!document.querySelector('[class*="workbench"]') || 
                  !!document.querySelector('[data-workbench]'),
    hasFileTree: !!document.querySelector('[class*="file"]') ||
                 !!document.querySelector('[data-file-tree]'),
    hasEditor: !!document.querySelector('[class*="editor"]') ||
               !!document.querySelector('textarea'),
    hasMessages: !!document.querySelector('[class*="message"]'),
    agentMode: getAgentMode(),
    timestamp: Date.now()
  };
}

// 获取当前模式
function getAgentMode() {
  const buttons = document.querySelectorAll('button');
  for (const button of buttons) {
    const text = button.textContent?.toLowerCase();
    if (text?.includes('agent') && button.className?.includes('orange')) {
      return 'agent';
    } else if (text?.includes('chat') && button.className?.includes('blue')) {
      return 'chat';
    }
  }
  return 'unknown';
}

// 切换到 Agent 模式
function switchToAgentMode() {
  const buttons = document.querySelectorAll('button');
  for (const button of buttons) {
    const text = button.textContent?.toLowerCase();
    if (text?.includes('chat') || text?.includes('agent')) {
      // 如果当前显示 "Chat"，点击会切换到 Agent
      if (text.includes('chat')) {
        button.click();
        console.log('✅ 切换到 Agent 模式');
        return true;
      }
    }
  }
  console.error('❌ 未找到模式切换按钮');
  return false;
}

// 模拟用户输入并发送
function sendTestMessage(message) {
  const textarea = document.querySelector('textarea');
  if (!textarea) {
    console.error('❌ 未找到输入框');
    return false;
  }

  // 设置输入内容
  textarea.value = message;
  textarea.dispatchEvent(new Event('input', { bubbles: true }));

  // 模拟回车发送
  const enterEvent = new KeyboardEvent('keydown', {
    key: 'Enter',
    code: 'Enter',
    keyCode: 13,
    which: 13,
    bubbles: true
  });
  textarea.dispatchEvent(enterEvent);

  console.log('✅ 发送测试消息:', message);
  return true;
}

// 等待状态变化
async function waitForStateChange(targetCondition, maxWait = 5000) {
  const startTime = Date.now();
  const checkInterval = 500;
  
  return new Promise((resolve) => {
    const checkState = () => {
      const currentState = checkPageState();
      const elapsed = Date.now() - startTime;
      
      console.log(`⏱️ ${elapsed}ms - 检查状态:`, {
        url: currentState.url,
        isChatPage: currentState.isChatPage,
        hasWorkbench: currentState.hasWorkbench,
        hasMessages: currentState.hasMessages
      });
      
      if (targetCondition(currentState)) {
        console.log('✅ 目标状态达成!');
        resolve({ success: true, state: currentState, elapsed });
        return;
      }
      
      if (elapsed >= maxWait) {
        console.log('⏰ 等待超时');
        resolve({ success: false, state: currentState, elapsed });
        return;
      }
      
      setTimeout(checkState, checkInterval);
    };
    
    checkState();
  });
}

// 主测试函数
async function runAgentNavigationTest() {
  console.log('🚀 开始 Agent 模式导航测试...');
  
  // 步骤 1: 检查初始状态
  console.log('📋 步骤 1: 检查初始状态');
  const initialState = checkPageState();
  console.log('初始状态:', initialState);
  
  if (!initialState.isHomePage) {
    console.warn('⚠️ 当前不在首页，请刷新到首页再测试');
    return { success: false, reason: 'Not on homepage' };
  }
  
  // 步骤 2: 切换到 Agent 模式
  console.log('📋 步骤 2: 切换到 Agent 模式');
  if (!switchToAgentMode()) {
    return { success: false, reason: 'Failed to switch to agent mode' };
  }
  
  // 等待模式切换完成
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // 步骤 3: 发送测试消息
  console.log('📋 步骤 3: 发送测试消息');
  if (!sendTestMessage(TEST_CONFIG.testMessage)) {
    return { success: false, reason: 'Failed to send message' };
  }
  
  // 步骤 4: 等待页面跳转
  console.log('📋 步骤 4: 等待页面跳转和工作区显示');
  const result = await waitForStateChange(
    (state) => state.isChatPage && state.hasWorkbench && state.hasMessages,
    TEST_CONFIG.maxWaitTime
  );
  
  // 步骤 5: 分析结果
  console.log('📋 步骤 5: 分析测试结果');
  const finalState = checkPageState();
  
  const testResults = {
    pageNavigation: finalState.isChatPage,
    workbenchVisible: finalState.hasWorkbench,
    messagesVisible: finalState.hasMessages,
    editorVisible: finalState.hasEditor,
    fileTreeVisible: finalState.hasFileTree,
    responseTime: result.elapsed,
    autoNavigation: result.success
  };
  
  console.log('📊 测试结果详情:', testResults);
  
  // 计算通过率
  const passedTests = Object.values(testResults).filter(v => v === true).length;
  const totalTests = Object.keys(testResults).length - 1; // 排除 responseTime
  const passRate = Math.round((passedTests / totalTests) * 100);
  
  console.log(`📈 测试通过率: ${passedTests}/${totalTests} (${passRate}%)`);
  console.log(`⏱️ 响应时间: ${result.elapsed}ms`);
  
  // 最终判断
  if (result.success && passRate >= 80) {
    console.log('🎉 测试通过！Agent 模式导航正常工作。');
    console.log('✅ 主要功能:');
    console.log('  - 自动页面跳转: ✅');
    console.log('  - 工作区显示: ✅');
    console.log('  - 消息显示: ✅');
    return { success: true, results: testResults };
  } else {
    console.log('❌ 测试失败，需要进一步检查：');
    Object.entries(testResults).forEach(([key, value]) => {
      if (key !== 'responseTime') {
        console.log(`  - ${key}: ${value ? '✅' : '❌'}`);
      }
    });
    return { success: false, results: testResults };
  }
}

// 快速检查函数
function quickCheck() {
  const state = checkPageState();
  console.log('🔍 快速状态检查:', state);
  return state;
}

// 导出测试函数
if (typeof window !== 'undefined') {
  window.agentTest = {
    runTest: runAgentNavigationTest,
    quickCheck: quickCheck,
    switchToAgentMode: switchToAgentMode,
    sendTestMessage: sendTestMessage,
    checkPageState: checkPageState
  };
  
  console.log('ℹ️ 测试函数已添加到 window.agentTest');
  console.log('ℹ️ 运行完整测试: window.agentTest.runTest()');
  console.log('ℹ️ 快速检查: window.agentTest.quickCheck()');
}

// 自动运行测试（如果在首页）
if (typeof window !== 'undefined') {
  const currentState = checkPageState();
  if (currentState.isHomePage) {
    console.log('🏠 检测到首页，准备自动运行测试...');
    console.log('ℹ️ 3秒后开始测试，或手动运行 window.agentTest.runTest()');
    
    setTimeout(() => {
      if (confirm('🧪 开始 Agent 模式导航测试？\n\n这将测试 Agent 模式是否能自动跳转到聊天页面并显示工作区。')) {
        runAgentNavigationTest().then(result => {
          if (result.success) {
            alert('🎉 测试通过！Agent 模式工作正常。');
          } else {
            alert('❌ 测试失败，请检查控制台了解详情。');
          }
        });
      }
    }, 3000);
  } else {
    console.log('ℹ️ 请在首页 (/) 运行此测试');
    console.log('ℹ️ 当前页面:', currentState.url);
  }
}
