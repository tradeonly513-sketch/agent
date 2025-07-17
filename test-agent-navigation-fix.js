// Agent 模式导航修复测试脚本
// 专门测试 URL 变化后页面是否正确渲染

console.log('🧪 Agent 模式导航修复测试开始...');

// 测试配置
const TEST_CONFIG = {
  testMessage: "Create a React todo application with CRUD operations",
  maxWaitTime: 10000, // 10秒最大等待时间
  checkInterval: 500, // 每500ms检查一次
};

// 检查页面状态
function checkPageState() {
  const state = {
    url: window.location.pathname,
    isHomePage: window.location.pathname === '/',
    isChatPage: window.location.pathname.startsWith('/chat/'),
    
    // 检查首页元素
    hasHomeHeader: !!document.querySelector('h1') || !!document.querySelector('[class*="title"]'),
    hasHomeInput: !!document.querySelector('textarea') && window.location.pathname === '/',
    
    // 检查聊天页面元素
    hasChatMessages: !!document.querySelector('[class*="message"]') && document.querySelectorAll('[class*="message"]').length > 0,
    hasWorkbench: !!document.querySelector('[class*="workbench"]') || 
                  !!document.querySelector('[class*="editor"]') ||
                  !!document.querySelector('[data-workbench]'),
    hasFileTree: !!document.querySelector('[class*="file"]') && 
                 !window.location.pathname.startsWith('/'),
    
    // 检查状态变量 (如果可访问)
    chatStarted: null,
    agentMode: getAgentMode(),
    
    timestamp: Date.now()
  };
  
  // 尝试获取 chatStarted 状态
  try {
    // 这些变量可能不在全局作用域，所以用 try-catch
    if (typeof chatStarted !== 'undefined') {
      state.chatStarted = chatStarted;
    }
  } catch (e) {
    // 忽略错误，状态检查是可选的
  }
  
  return state;
}

// 获取当前模式
function getAgentMode() {
  const buttons = document.querySelectorAll('button');
  for (const button of buttons) {
    const text = button.textContent?.toLowerCase();
    const classes = button.className?.toLowerCase();
    if (text?.includes('agent') && (classes?.includes('accent') || classes?.includes('orange'))) {
      return 'agent';
    } else if (text?.includes('chat') && (classes?.includes('accent') || classes?.includes('blue'))) {
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

// 发送消息
function sendMessage(message) {
  const textarea = document.querySelector('textarea');
  if (!textarea) {
    console.error('❌ 未找到输入框');
    return false;
  }
  
  // 设置消息
  textarea.value = message;
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  
  // 发送消息
  const enterEvent = new KeyboardEvent('keydown', {
    key: 'Enter',
    code: 'Enter',
    keyCode: 13,
    which: 13,
    bubbles: true
  });
  textarea.dispatchEvent(enterEvent);
  
  console.log('✅ 发送消息:', message);
  return true;
}

// 等待页面状态变化
async function waitForPageTransition() {
  console.log('⏳ 等待页面从首页切换到聊天界面...');
  
  const startTime = Date.now();
  const initialState = checkPageState();
  
  console.log('初始状态:', {
    url: initialState.url,
    isHomePage: initialState.isHomePage,
    hasHomeInput: initialState.hasHomeInput
  });
  
  return new Promise((resolve) => {
    const checkTransition = () => {
      const currentState = checkPageState();
      const elapsed = Date.now() - startTime;
      
      // 详细日志
      if (elapsed % 2000 === 0 || elapsed < 1000) { // 每2秒或前1秒记录一次
        console.log(`⏱️ ${elapsed}ms - 状态检查:`, {
          url: currentState.url,
          isChatPage: currentState.isChatPage,
          hasChatMessages: currentState.hasChatMessages,
          hasWorkbench: currentState.hasWorkbench
        });
      }
      
      // 成功条件：URL 变为聊天页面 AND (有消息 OR 有工作区)
      const transitionSuccess = currentState.isChatPage && 
                               (currentState.hasChatMessages || currentState.hasWorkbench);
      
      if (transitionSuccess) {
        console.log('🎉 页面转换成功！');
        resolve({
          success: true,
          elapsed,
          initialState,
          finalState: currentState,
          transitionType: 'automatic'
        });
        return;
      }
      
      // 超时检查
      if (elapsed >= TEST_CONFIG.maxWaitTime) {
        console.log('⏰ 等待超时');
        resolve({
          success: false,
          elapsed,
          initialState,
          finalState: currentState,
          reason: 'timeout'
        });
        return;
      }
      
      // 继续检查
      setTimeout(checkTransition, TEST_CONFIG.checkInterval);
    };
    
    checkTransition();
  });
}

// 主测试函数
async function testAgentNavigationFix() {
  console.log('🚀 开始 Agent 模式导航修复测试...');
  
  // 步骤 1: 检查初始状态
  console.log('\n📋 步骤 1: 检查初始状态');
  const initialState = checkPageState();
  console.log('初始状态:', initialState);
  
  if (!initialState.isHomePage) {
    console.warn('⚠️ 当前不在首页，请刷新到首页再测试');
    return { success: false, reason: 'Not on homepage' };
  }
  
  // 步骤 2: 切换到 Agent 模式
  console.log('\n📋 步骤 2: 切换到 Agent 模式');
  if (!switchToAgentMode()) {
    return { success: false, reason: 'Failed to switch to agent mode' };
  }
  
  // 等待模式切换完成
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // 步骤 3: 发送测试消息
  console.log('\n📋 步骤 3: 发送测试消息');
  if (!sendMessage(TEST_CONFIG.testMessage)) {
    return { success: false, reason: 'Failed to send message' };
  }
  
  // 步骤 4: 等待页面转换
  console.log('\n📋 步骤 4: 等待页面自动转换 (关键测试)');
  const transitionResult = await waitForPageTransition();
  
  // 步骤 5: 分析结果
  console.log('\n📋 步骤 5: 分析测试结果');
  
  const testResult = {
    pageTransition: transitionResult.success,
    responseTime: transitionResult.elapsed,
    urlChanged: transitionResult.finalState.isChatPage,
    workbenchVisible: transitionResult.finalState.hasWorkbench,
    messagesVisible: transitionResult.finalState.hasChatMessages,
    noRefreshNeeded: transitionResult.success // 关键指标
  };
  
  console.log('📊 详细测试结果:', testResult);
  
  // 计算通过率
  const passedTests = Object.values(testResult).filter(v => v === true).length - 1; // 排除 responseTime
  const totalTests = Object.keys(testResult).length - 1;
  const passRate = Math.round((passedTests / totalTests) * 100);
  
  console.log(`📈 测试通过率: ${passedTests}/${totalTests} (${passRate}%)`);
  console.log(`⏱️ 页面转换时间: ${transitionResult.elapsed}ms`);
  
  // 最终判断
  if (transitionResult.success && passRate >= 80) {
    console.log('\n🎉 测试通过！Agent 模式导航修复成功。');
    console.log('✅ 关键成就:');
    console.log('  - 无需手动刷新页面');
    console.log('  - URL 自动变化到聊天页面');
    console.log('  - 页面自动显示聊天界面');
    console.log('  - 工作区正确显示');
    
    return { success: true, results: testResult, transitionResult };
  } else {
    console.log('\n❌ 测试失败，问题仍然存在：');
    
    if (!transitionResult.success) {
      console.log('  - 页面没有自动转换到聊天界面');
      console.log('  - 仍然需要手动刷新页面');
    }
    
    Object.entries(testResult).forEach(([key, value]) => {
      if (key !== 'responseTime' && !value) {
        console.log(`  - ${key}: 失败`);
      }
    });
    
    console.log('\n🔍 建议检查:');
    console.log('  1. 控制台是否有 JavaScript 错误');
    console.log('  2. chatStarted 状态是否正确更新');
    console.log('  3. useEffect 依赖是否正确');
    
    return { success: false, results: testResult, transitionResult };
  }
}

// 快速检查函数
function quickStatusCheck() {
  const state = checkPageState();
  console.log('🔍 当前页面状态:', state);
  return state;
}

// 导出测试函数
if (typeof window !== 'undefined') {
  window.agentNavTest = {
    run: testAgentNavigationFix,
    quickCheck: quickStatusCheck,
    switchToAgent: switchToAgentMode,
    sendMessage: sendMessage,
    checkState: checkPageState
  };
  
  console.log('ℹ️ 测试函数已添加到 window.agentNavTest');
  console.log('ℹ️ 运行完整测试: window.agentNavTest.run()');
  console.log('ℹ️ 快速检查: window.agentNavTest.quickCheck()');
}

// 自动运行测试（如果在首页）
if (typeof window !== 'undefined') {
  const currentState = checkPageState();
  if (currentState.isHomePage) {
    console.log('🏠 检测到首页，准备运行导航修复测试...');
    setTimeout(() => {
      if (confirm('🧪 开始 Agent 模式导航修复测试？\n\n这将测试 Agent 模式是否能自动从首页切换到聊天界面，无需手动刷新。')) {
        testAgentNavigationFix().then(result => {
          if (result.success) {
            alert('🎉 测试通过！Agent 模式导航修复成功，无需手动刷新。');
          } else {
            alert('❌ 测试失败，页面仍然需要手动刷新。请检查控制台了解详情。');
          }
        });
      }
    }, 2000);
  } else {
    console.log('ℹ️ 请在首页运行此测试');
    console.log('ℹ️ 当前页面:', currentState.url);
  }
}
