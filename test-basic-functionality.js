// 基本功能测试脚本 - 验证消息发送是否正常工作
// 在浏览器控制台中运行

console.log('🧪 开始基本功能测试...');

// 测试配置
const TEST_CONFIG = {
  chatTestMessage: "Hello, this is a test message",
  agentTestMessage: "Create a simple HTML page",
  waitTime: 3000, // 等待3秒检查结果
};

// 检查页面基本元素
function checkPageElements() {
  console.log('📋 检查页面元素...');
  
  const elements = {
    textarea: document.querySelector('textarea'),
    form: document.querySelector('form'),
    sendButton: document.querySelector('button[type="submit"]') || 
                document.querySelector('button[aria-label*="send"]'),
    modeButton: document.querySelector('button[class*="accent"]'),
    messages: document.querySelectorAll('[class*="message"]')
  };
  
  console.log('页面元素检查:', {
    textarea: !!elements.textarea,
    form: !!elements.form,
    sendButton: !!elements.sendButton,
    modeButton: !!elements.modeButton,
    messagesCount: elements.messages.length
  });
  
  return elements;
}

// 获取当前模式
function getCurrentMode() {
  const buttons = document.querySelectorAll('button');
  for (const button of buttons) {
    const text = button.textContent?.toLowerCase();
    if (text?.includes('chat') && button.className?.includes('accent')) {
      return 'chat';
    } else if (text?.includes('agent') && button.className?.includes('accent')) {
      return 'agent';
    }
  }
  return 'unknown';
}

// 切换模式
function switchMode() {
  const buttons = document.querySelectorAll('button');
  for (const button of buttons) {
    const text = button.textContent?.toLowerCase();
    if (text?.includes('chat') || text?.includes('agent')) {
      button.click();
      console.log('✅ 模式切换完成');
      return true;
    }
  }
  console.error('❌ 未找到模式切换按钮');
  return false;
}

// 发送消息
function sendMessage(message) {
  console.log('📤 发送消息:', message);
  
  const textarea = document.querySelector('textarea');
  if (!textarea) {
    console.error('❌ 未找到输入框');
    return false;
  }
  
  // 清空并设置新消息
  textarea.value = '';
  textarea.value = message;
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  
  // 尝试多种发送方式
  let sent = false;
  
  // 方式1: 查找并点击发送按钮
  const sendButton = document.querySelector('button[type="submit"]') || 
                     document.querySelector('button[aria-label*="send"]') ||
                     document.querySelector('button[title*="send"]');
  if (sendButton && !sendButton.disabled) {
    sendButton.click();
    sent = true;
    console.log('✅ 通过发送按钮发送');
  }
  
  // 方式2: 提交表单
  if (!sent) {
    const form = textarea.closest('form');
    if (form) {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      sent = true;
      console.log('✅ 通过表单提交发送');
    }
  }
  
  // 方式3: 模拟回车键
  if (!sent) {
    const enterEvent = new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true
    });
    textarea.dispatchEvent(enterEvent);
    sent = true;
    console.log('✅ 通过回车键发送');
  }
  
  return sent;
}

// 等待并检查结果
async function waitAndCheckResult(expectedChanges = {}) {
  console.log('⏳ 等待结果...');
  
  const initialState = {
    url: window.location.pathname,
    messagesCount: document.querySelectorAll('[class*="message"]').length,
    hasWorkbench: !!document.querySelector('[class*="workbench"]')
  };
  
  console.log('初始状态:', initialState);
  
  // 等待指定时间
  await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.waitTime));
  
  const finalState = {
    url: window.location.pathname,
    messagesCount: document.querySelectorAll('[class*="message"]').length,
    hasWorkbench: !!document.querySelector('[class*="workbench"]')
  };
  
  console.log('最终状态:', finalState);
  
  // 检查变化
  const changes = {
    urlChanged: initialState.url !== finalState.url,
    messagesIncreased: finalState.messagesCount > initialState.messagesCount,
    workbenchAppeared: !initialState.hasWorkbench && finalState.hasWorkbench
  };
  
  console.log('检测到的变化:', changes);
  
  return { initialState, finalState, changes };
}

// 测试 Chat 模式
async function testChatMode() {
  console.log('🔵 测试 Chat 模式...');
  
  // 确保在 Chat 模式
  const currentMode = getCurrentMode();
  if (currentMode !== 'chat') {
    switchMode();
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // 发送消息
  if (!sendMessage(TEST_CONFIG.chatTestMessage)) {
    return { success: false, reason: 'Failed to send message' };
  }
  
  // 等待结果
  const result = await waitAndCheckResult();
  
  // 评估结果
  const success = result.changes.messagesIncreased || 
                  result.changes.urlChanged || 
                  result.changes.workbenchAppeared;
  
  return {
    success,
    mode: 'chat',
    result,
    evaluation: {
      messageAppeared: result.changes.messagesIncreased,
      pageNavigated: result.changes.urlChanged,
      workbenchShown: result.changes.workbenchAppeared
    }
  };
}

// 测试 Agent 模式
async function testAgentMode() {
  console.log('🟠 测试 Agent 模式...');
  
  // 切换到 Agent 模式
  switchMode();
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // 发送消息
  if (!sendMessage(TEST_CONFIG.agentTestMessage)) {
    return { success: false, reason: 'Failed to send message' };
  }
  
  // 等待结果
  const result = await waitAndCheckResult();
  
  // 评估结果
  const success = result.changes.messagesIncreased || 
                  result.changes.urlChanged || 
                  result.changes.workbenchAppeared;
  
  return {
    success,
    mode: 'agent',
    result,
    evaluation: {
      messageAppeared: result.changes.messagesIncreased,
      pageNavigated: result.changes.urlChanged,
      workbenchShown: result.changes.workbenchAppeared
    }
  };
}

// 主测试函数
async function runBasicFunctionalityTest() {
  console.log('🚀 开始基本功能测试...');
  
  // 检查页面元素
  const elements = checkPageElements();
  if (!elements.textarea) {
    console.error('❌ 页面元素检查失败，无法继续测试');
    return { success: false, reason: 'Missing essential elements' };
  }
  
  const results = {
    pageElements: !!elements.textarea,
    chatMode: null,
    agentMode: null,
    overall: false
  };
  
  try {
    // 测试 Chat 模式
    console.log('\n' + '='.repeat(50));
    results.chatMode = await testChatMode();
    console.log('Chat 模式测试结果:', results.chatMode.success ? '✅ 通过' : '❌ 失败');
    
    // 等待一下再测试 Agent 模式
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 测试 Agent 模式
    console.log('\n' + '='.repeat(50));
    results.agentMode = await testAgentMode();
    console.log('Agent 模式测试结果:', results.agentMode.success ? '✅ 通过' : '❌ 失败');
    
  } catch (error) {
    console.error('❌ 测试过程中出现错误:', error);
    return { success: false, error, results };
  }
  
  // 总体评估
  results.overall = results.chatMode?.success && results.agentMode?.success;
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 测试总结:');
  console.log('  页面元素: ' + (results.pageElements ? '✅' : '❌'));
  console.log('  Chat 模式: ' + (results.chatMode?.success ? '✅' : '❌'));
  console.log('  Agent 模式: ' + (results.agentMode?.success ? '✅' : '❌'));
  console.log('  总体结果: ' + (results.overall ? '🎉 全部通过' : '⚠️ 部分失败'));
  
  if (!results.overall) {
    console.log('\n❌ 失败详情:');
    if (!results.chatMode?.success) {
      console.log('  - Chat 模式: 消息发送后没有反应');
    }
    if (!results.agentMode?.success) {
      console.log('  - Agent 模式: 消息发送后没有反应');
    }
    console.log('\n🔍 建议检查:');
    console.log('  1. 浏览器控制台是否有错误信息');
    console.log('  2. Network 标签页是否有网络请求');
    console.log('  3. 页面是否在首页 (/)');
  }
  
  return { success: results.overall, results };
}

// 导出测试函数
if (typeof window !== 'undefined') {
  window.basicTest = {
    run: runBasicFunctionalityTest,
    chatMode: testChatMode,
    agentMode: testAgentMode,
    checkElements: checkPageElements,
    sendMessage: sendMessage
  };
  
  console.log('ℹ️ 测试函数已添加到 window.basicTest');
  console.log('ℹ️ 运行完整测试: window.basicTest.run()');
}

// 如果在首页，询问是否自动运行测试
if (typeof window !== 'undefined' && window.location.pathname === '/') {
  console.log('🏠 检测到首页，准备运行测试...');
  setTimeout(() => {
    if (confirm('🧪 开始基本功能测试？\n\n这将测试 Chat 和 Agent 模式的消息发送功能。')) {
      runBasicFunctionalityTest();
    }
  }, 2000);
} else {
  console.log('ℹ️ 请在首页运行此测试');
}
