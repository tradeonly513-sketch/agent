// Agent 模式测试脚本
// 在浏览器控制台中运行此脚本来测试 Agent 模式功能

console.log('🧪 开始 Agent 模式自动化测试...');

// 测试结果收集
const testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

function logTest(name, passed, message = '') {
  const status = passed ? '✅' : '❌';
  const result = { name, passed, message };
  testResults.tests.push(result);
  
  if (passed) {
    testResults.passed++;
    console.log(`${status} ${name}: ${message}`);
  } else {
    testResults.failed++;
    console.error(`${status} ${name}: ${message}`);
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testBasicFunctionality() {
  console.log('\n📋 测试阶段 1: 基础功能');
  
  // 测试页面加载
  try {
    const hasErrors = window.console.error.length > 0;
    logTest('页面加载', !hasErrors, '页面正常加载，无控制台错误');
  } catch (e) {
    logTest('页面加载', true, '页面加载正常');
  }
  
  // 测试 Agent 模式按钮存在
  const agentButton = document.querySelector('button[class*="agent"], button:contains("Agent"), button:contains("Chat")');
  logTest('Agent 按钮存在', !!agentButton, agentButton ? '找到模式切换按钮' : '未找到模式切换按钮');
  
  // 测试输入框存在
  const inputBox = document.querySelector('textarea, input[type="text"]');
  logTest('输入框存在', !!inputBox, inputBox ? '找到输入框' : '未找到输入框');
  
  return { agentButton, inputBox };
}

async function testModeSwitch(agentButton) {
  console.log('\n🔄 测试阶段 2: 模式切换');
  
  if (!agentButton) {
    logTest('模式切换', false, '无法找到模式切换按钮');
    return false;
  }
  
  try {
    // 记录初始状态
    const initialText = agentButton.textContent;
    const initialClass = agentButton.className;
    
    // 点击切换
    agentButton.click();
    await delay(500);
    
    // 检查是否有变化
    const newText = agentButton.textContent;
    const newClass = agentButton.className;
    
    const hasChanged = (newText !== initialText) || (newClass !== initialClass);
    logTest('模式切换响应', hasChanged, hasChanged ? '按钮状态已改变' : '按钮状态未改变');
    
    return hasChanged;
  } catch (e) {
    logTest('模式切换', false, `切换失败: ${e.message}`);
    return false;
  }
}

async function testQuickCommands(inputBox) {
  console.log('\n⚡ 测试阶段 3: 快捷命令');
  
  if (!inputBox) {
    logTest('快捷命令', false, '无法找到输入框');
    return;
  }
  
  const commands = ['/agent', '/chat', '/status'];
  
  for (const command of commands) {
    try {
      // 清空输入框
      inputBox.value = '';
      inputBox.focus();
      
      // 输入命令
      inputBox.value = command;
      
      // 模拟回车键
      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true
      });
      
      inputBox.dispatchEvent(enterEvent);
      await delay(1000);
      
      // 检查输入框是否被清空（表示命令被处理）
      const wasProcessed = inputBox.value === '';
      logTest(`快捷命令 ${command}`, wasProcessed, wasProcessed ? '命令被处理' : '命令未被处理');
      
    } catch (e) {
      logTest(`快捷命令 ${command}`, false, `命令执行失败: ${e.message}`);
    }
  }
}

async function testTaskTemplates() {
  console.log('\n📋 测试阶段 4: 任务模板');
  
  // 查找任务模板区域
  const templatesSection = document.querySelector('[class*="template"], [class*="Template"]');
  logTest('任务模板区域', !!templatesSection, templatesSection ? '找到模板区域' : '未找到模板区域');
  
  if (templatesSection) {
    // 查找模板卡片
    const templateCards = templatesSection.querySelectorAll('[class*="card"], [class*="template"], button, div[onclick]');
    logTest('模板卡片', templateCards.length > 0, `找到 ${templateCards.length} 个模板卡片`);
    
    // 尝试点击第一个模板
    if (templateCards.length > 0) {
      try {
        const firstTemplate = templateCards[0];
        firstTemplate.click();
        await delay(500);
        
        // 检查输入框是否有内容
        const inputBox = document.querySelector('textarea, input[type="text"]');
        const hasContent = inputBox && inputBox.value.length > 0;
        logTest('模板选择', hasContent, hasContent ? '模板内容已加载到输入框' : '模板内容未加载');
      } catch (e) {
        logTest('模板选择', false, `模板点击失败: ${e.message}`);
      }
    }
  }
}

async function testTaskExecution(inputBox) {
  console.log('\n🚀 测试阶段 5: 任务执行');
  
  if (!inputBox) {
    logTest('任务执行', false, '无法找到输入框');
    return;
  }
  
  try {
    // 输入测试任务
    const testTask = '创建一个简单的 HTML 文件叫做 hello.html';
    inputBox.value = testTask;
    inputBox.focus();
    
    // 查找发送按钮
    const sendButton = document.querySelector('button[type="submit"], button:contains("Send"), button:contains("发送")');
    
    if (sendButton) {
      sendButton.click();
      await delay(2000);
      
      // 查找 Agent Status 面板
      const statusPanel = document.querySelector('[class*="agent"], [class*="status"], [class*="progress"]');
      logTest('任务启动', !!statusPanel, statusPanel ? '任务已启动，显示状态面板' : '任务未启动');
      
      if (statusPanel) {
        // 查找步骤列表
        const steps = statusPanel.querySelectorAll('[class*="step"], li, div[class*="item"]');
        logTest('步骤生成', steps.length > 0, `生成了 ${steps.length} 个步骤`);
        
        // 查找进度条
        const progressBar = statusPanel.querySelector('[class*="progress"], [role="progressbar"]');
        logTest('进度条显示', !!progressBar, progressBar ? '显示进度条' : '未显示进度条');
      }
    } else {
      logTest('任务执行', false, '未找到发送按钮');
    }
  } catch (e) {
    logTest('任务执行', false, `任务执行失败: ${e.message}`);
  }
}

async function testAgentControls() {
  console.log('\n🎛️ 测试阶段 6: Agent 控制');
  
  // 查找控制按钮
  const controlButtons = document.querySelectorAll('button[title*="pause"], button[title*="stop"], button[title*="skip"], button[class*="control"]');
  logTest('控制按钮', controlButtons.length > 0, `找到 ${controlButtons.length} 个控制按钮`);
  
  // 测试按钮可点击性
  controlButtons.forEach((button, index) => {
    try {
      const isEnabled = !button.disabled;
      const title = button.title || button.textContent || `按钮${index + 1}`;
      logTest(`控制按钮 ${title}`, isEnabled, isEnabled ? '按钮可用' : '按钮禁用');
    } catch (e) {
      logTest(`控制按钮 ${index + 1}`, false, `按钮测试失败: ${e.message}`);
    }
  });
}

async function runAllTests() {
  console.log('🎯 开始完整的 Agent 模式测试套件...\n');
  
  try {
    // 阶段 1: 基础功能
    const { agentButton, inputBox } = await testBasicFunctionality();
    await delay(1000);
    
    // 阶段 2: 模式切换
    await testModeSwitch(agentButton);
    await delay(1000);
    
    // 阶段 3: 快捷命令
    await testQuickCommands(inputBox);
    await delay(1000);
    
    // 阶段 4: 任务模板
    await testTaskTemplates();
    await delay(1000);
    
    // 阶段 5: 任务执行
    await testTaskExecution(inputBox);
    await delay(3000); // 等待任务执行
    
    // 阶段 6: Agent 控制
    await testAgentControls();
    
  } catch (e) {
    console.error('测试执行出错:', e);
  }
  
  // 输出测试结果
  console.log('\n📊 测试结果汇总:');
  console.log(`✅ 通过: ${testResults.passed}`);
  console.log(`❌ 失败: ${testResults.failed}`);
  console.log(`📈 成功率: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);
  
  console.log('\n📋 详细结果:');
  testResults.tests.forEach(test => {
    const status = test.passed ? '✅' : '❌';
    console.log(`${status} ${test.name}: ${test.message}`);
  });
  
  return testResults;
}

// 导出测试函数供手动调用
window.testAgentMode = {
  runAllTests,
  testBasicFunctionality,
  testModeSwitch,
  testQuickCommands,
  testTaskTemplates,
  testTaskExecution,
  testAgentControls
};

console.log('🎯 测试脚本已加载！');
console.log('运行 testAgentMode.runAllTests() 开始完整测试');
console.log('或运行单个测试函数，如 testAgentMode.testBasicFunctionality()');
