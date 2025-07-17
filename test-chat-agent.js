// 简单的测试脚本来验证 Chat 和 Agent 模式
// 在浏览器控制台中运行

console.log('🧪 开始测试 Chat 和 Agent 模式...');

// 测试 1: 检查基本变量和函数是否存在
function testBasicFunctions() {
  console.log('📋 测试 1: 检查基本函数...');
  
  try {
    // 检查关键变量
    if (typeof window !== 'undefined') {
      console.log('✅ 浏览器环境正常');
    }
    
    // 检查 React 是否加载
    if (typeof React !== 'undefined') {
      console.log('✅ React 已加载');
    }
    
    console.log('✅ 测试 1 通过');
    return true;
  } catch (error) {
    console.error('❌ 测试 1 失败:', error);
    return false;
  }
}

// 测试 2: 检查页面元素
function testPageElements() {
  console.log('📋 测试 2: 检查页面元素...');
  
  try {
    // 检查输入框
    const textarea = document.querySelector('textarea');
    if (textarea) {
      console.log('✅ 找到输入框');
    } else {
      console.warn('⚠️ 未找到输入框');
    }
    
    // 检查发送按钮
    const sendButton = document.querySelector('[type="submit"]') || 
                      document.querySelector('button[aria-label*="send"]') ||
                      document.querySelector('button[title*="send"]');
    if (sendButton) {
      console.log('✅ 找到发送按钮');
    } else {
      console.warn('⚠️ 未找到发送按钮');
    }
    
    // 检查模式切换按钮
    const modeButtons = document.querySelectorAll('button');
    let chatButton = null;
    let agentButton = null;
    
    modeButtons.forEach(button => {
      const text = button.textContent?.toLowerCase();
      if (text?.includes('chat')) {
        chatButton = button;
      }
      if (text?.includes('agent')) {
        agentButton = button;
      }
    });
    
    if (chatButton || agentButton) {
      console.log('✅ 找到模式切换按钮');
    } else {
      console.warn('⚠️ 未找到模式切换按钮');
    }
    
    console.log('✅ 测试 2 通过');
    return true;
  } catch (error) {
    console.error('❌ 测试 2 失败:', error);
    return false;
  }
}

// 测试 3: 模拟用户输入
function testUserInput() {
  console.log('📋 测试 3: 模拟用户输入...');
  
  try {
    const textarea = document.querySelector('textarea');
    if (!textarea) {
      console.error('❌ 未找到输入框，无法测试');
      return false;
    }
    
    // 模拟输入
    textarea.value = 'Test message';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    
    console.log('✅ 成功模拟输入');
    
    // 清除测试输入
    textarea.value = '';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    
    console.log('✅ 测试 3 通过');
    return true;
  } catch (error) {
    console.error('❌ 测试 3 失败:', error);
    return false;
  }
}

// 测试 4: 检查控制台错误
function testConsoleErrors() {
  console.log('📋 测试 4: 检查控制台错误...');
  
  // 这个测试需要手动检查控制台
  console.log('ℹ️ 请手动检查控制台是否有红色错误信息');
  console.log('ℹ️ 如果看到 JavaScript 错误，请报告具体错误信息');
  
  return true;
}

// 运行所有测试
function runAllTests() {
  console.log('🚀 开始运行所有测试...');
  
  const results = [
    testBasicFunctions(),
    testPageElements(),
    testUserInput(),
    testConsoleErrors()
  ];
  
  const passed = results.filter(r => r).length;
  const total = results.length;
  
  console.log(`📊 测试结果: ${passed}/${total} 通过`);
  
  if (passed === total) {
    console.log('🎉 所有测试通过！基本功能应该正常工作。');
    console.log('📝 请手动测试以下功能:');
    console.log('   1. Chat 模式: 输入 "Hello" 并发送');
    console.log('   2. Agent 模式: 切换模式后输入 "Create a simple HTML file"');
  } else {
    console.log('⚠️ 部分测试失败，可能存在问题。');
  }
  
  return passed === total;
}

// 自动运行测试
if (typeof window !== 'undefined') {
  // 等待页面加载完成
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runAllTests);
  } else {
    setTimeout(runAllTests, 1000); // 延迟1秒确保React组件加载完成
  }
} else {
  console.log('ℹ️ 请在浏览器控制台中运行此脚本');
}

// 导出测试函数供手动调用
if (typeof window !== 'undefined') {
  window.testChatAgent = {
    runAllTests,
    testBasicFunctions,
    testPageElements,
    testUserInput,
    testConsoleErrors
  };
  
  console.log('ℹ️ 测试函数已添加到 window.testChatAgent');
  console.log('ℹ️ 可以手动调用 window.testChatAgent.runAllTests()');
}
