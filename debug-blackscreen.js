// 黑屏问题诊断脚本
// 在浏览器控制台中运行，帮助诊断 Chat 页面黑屏问题

console.log('🔍 开始黑屏问题诊断...');

// 诊断配置
const DIAGNOSTIC_CONFIG = {
  checkInterval: 1000, // 每秒检查一次
  maxChecks: 60, // 最多检查60次 (1分钟)
  memoryThreshold: 100 * 1024 * 1024, // 100MB 内存阈值
};

// 诊断状态
let diagnosticState = {
  isRunning: false,
  checkCount: 0,
  errors: [],
  warnings: [],
  memoryUsage: [],
  renderCounts: {},
};

// 检查页面基本状态
function checkPageBasics() {
  const basics = {
    url: window.location.href,
    pathname: window.location.pathname,
    title: document.title,
    bodyClasses: document.body.className,
    hasReactRoot: !!document.querySelector('#root'),
    hasContent: document.body.children.length > 0,
    isBlackScreen: isBlackScreen(),
    timestamp: Date.now()
  };
  
  return basics;
}

// 检测是否为黑屏
function isBlackScreen() {
  const body = document.body;
  const root = document.querySelector('#root');
  
  // 检查是否有可见内容
  const hasVisibleContent = document.querySelectorAll('*').length > 10;
  
  // 检查背景色是否为黑色
  const bodyStyle = getComputedStyle(body);
  const rootStyle = root ? getComputedStyle(root) : null;
  
  const isBodyBlack = bodyStyle.backgroundColor === 'rgb(0, 0, 0)' || 
                     bodyStyle.backgroundColor === 'black';
  const isRootBlack = rootStyle && (rootStyle.backgroundColor === 'rgb(0, 0, 0)' || 
                     rootStyle.backgroundColor === 'black');
  
  // 检查是否有错误边界显示
  const hasErrorBoundary = !!document.querySelector('[class*="error"]') ||
                          !!document.querySelector('[class*="Error"]');
  
  return {
    hasVisibleContent,
    isBodyBlack,
    isRootBlack,
    hasErrorBoundary,
    elementCount: document.querySelectorAll('*').length,
    isLikelyBlackScreen: !hasVisibleContent || isBodyBlack || isRootBlack
  };
}

// 检查 React 组件状态
function checkReactState() {
  const reactState = {
    hasReactDevTools: !!window.__REACT_DEVTOOLS_GLOBAL_HOOK__,
    reactVersion: null,
    componentErrors: [],
    renderCount: 0
  };
  
  // 尝试获取 React 版本
  try {
    if (window.React) {
      reactState.reactVersion = window.React.version;
    }
  } catch (e) {
    reactState.componentErrors.push('Failed to get React version: ' + e.message);
  }
  
  // 检查是否有 React 错误
  if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
    try {
      const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
      if (hook.renderers) {
        reactState.renderCount = hook.renderers.size;
      }
    } catch (e) {
      reactState.componentErrors.push('Failed to check React renderers: ' + e.message);
    }
  }
  
  return reactState;
}

// 检查内存使用情况
function checkMemoryUsage() {
  const memory = {
    timestamp: Date.now(),
    available: false
  };
  
  if (performance.memory) {
    memory.available = true;
    memory.used = performance.memory.usedJSHeapSize;
    memory.total = performance.memory.totalJSHeapSize;
    memory.limit = performance.memory.jsHeapSizeLimit;
    memory.usedMB = Math.round(memory.used / 1024 / 1024);
    memory.totalMB = Math.round(memory.total / 1024 / 1024);
    memory.limitMB = Math.round(memory.limit / 1024 / 1024);
    memory.isHighUsage = memory.used > DIAGNOSTIC_CONFIG.memoryThreshold;
  }
  
  return memory;
}

// 检查控制台错误
function checkConsoleErrors() {
  const errors = {
    jsErrors: [],
    networkErrors: [],
    reactErrors: [],
    timestamp: Date.now()
  };
  
  // 这个需要在页面加载时设置监听器
  // 这里只能检查已知的错误模式
  
  return errors;
}

// 检查网络状态
function checkNetworkStatus() {
  const network = {
    online: navigator.onLine,
    connection: null,
    timestamp: Date.now()
  };
  
  if (navigator.connection) {
    network.connection = {
      effectiveType: navigator.connection.effectiveType,
      downlink: navigator.connection.downlink,
      rtt: navigator.connection.rtt
    };
  }
  
  return network;
}

// 检查 DOM 变化
function checkDOMChanges() {
  const dom = {
    elementCount: document.querySelectorAll('*').length,
    scriptCount: document.querySelectorAll('script').length,
    styleCount: document.querySelectorAll('style, link[rel="stylesheet"]').length,
    hasChat: !!document.querySelector('[class*="chat"]'),
    hasWorkbench: !!document.querySelector('[class*="workbench"]'),
    hasMessages: !!document.querySelector('[class*="message"]'),
    timestamp: Date.now()
  };
  
  return dom;
}

// 执行完整诊断
function runDiagnostic() {
  const diagnostic = {
    timestamp: Date.now(),
    checkNumber: ++diagnosticState.checkCount,
    basics: checkPageBasics(),
    react: checkReactState(),
    memory: checkMemoryUsage(),
    network: checkNetworkStatus(),
    dom: checkDOMChanges()
  };
  
  // 检查是否有问题
  const issues = [];
  
  if (diagnostic.basics.isBlackScreen.isLikelyBlackScreen) {
    issues.push('🚨 检测到黑屏问题');
  }
  
  if (diagnostic.memory.available && diagnostic.memory.isHighUsage) {
    issues.push(`⚠️ 内存使用过高: ${diagnostic.memory.usedMB}MB`);
  }
  
  if (!diagnostic.network.online) {
    issues.push('🌐 网络连接断开');
  }
  
  if (diagnostic.react.componentErrors.length > 0) {
    issues.push(`⚛️ React 错误: ${diagnostic.react.componentErrors.length} 个`);
  }
  
  // 记录诊断结果
  if (issues.length > 0) {
    console.warn(`🔍 诊断 #${diagnostic.checkNumber}:`, issues);
    console.log('详细信息:', diagnostic);
    diagnosticState.warnings.push({ issues, diagnostic });
  } else {
    console.log(`✅ 诊断 #${diagnostic.checkNumber}: 正常`);
  }
  
  return diagnostic;
}

// 开始持续诊断
function startDiagnostic() {
  if (diagnosticState.isRunning) {
    console.log('⚠️ 诊断已在运行中');
    return;
  }
  
  console.log('🚀 开始持续诊断...');
  diagnosticState.isRunning = true;
  diagnosticState.checkCount = 0;
  
  const intervalId = setInterval(() => {
    if (diagnosticState.checkCount >= DIAGNOSTIC_CONFIG.maxChecks) {
      stopDiagnostic();
      return;
    }
    
    runDiagnostic();
  }, DIAGNOSTIC_CONFIG.checkInterval);
  
  diagnosticState.intervalId = intervalId;
  
  // 立即运行一次
  runDiagnostic();
}

// 停止诊断
function stopDiagnostic() {
  if (!diagnosticState.isRunning) {
    console.log('⚠️ 诊断未在运行');
    return;
  }
  
  console.log('🛑 停止诊断');
  diagnosticState.isRunning = false;
  
  if (diagnosticState.intervalId) {
    clearInterval(diagnosticState.intervalId);
    diagnosticState.intervalId = null;
  }
  
  // 显示诊断总结
  console.log('📊 诊断总结:');
  console.log(`- 总检查次数: ${diagnosticState.checkCount}`);
  console.log(`- 发现问题: ${diagnosticState.warnings.length} 次`);
  console.log(`- 错误记录: ${diagnosticState.errors.length} 个`);
  
  if (diagnosticState.warnings.length > 0) {
    console.log('⚠️ 主要问题:');
    diagnosticState.warnings.forEach((warning, index) => {
      console.log(`${index + 1}. ${warning.issues.join(', ')}`);
    });
  }
}

// 手动检查黑屏
function checkBlackScreen() {
  console.log('🔍 手动检查黑屏状态...');
  const result = runDiagnostic();
  
  if (result.basics.isBlackScreen.isLikelyBlackScreen) {
    console.error('🚨 确认检测到黑屏问题!');
    console.log('可能的原因:');
    console.log('1. JavaScript 错误导致 React 组件崩溃');
    console.log('2. CSS 样式问题导致内容不可见');
    console.log('3. 内存泄漏导致页面无响应');
    console.log('4. 网络问题导致资源加载失败');
    
    console.log('建议的解决方案:');
    console.log('1. 检查浏览器控制台的错误信息');
    console.log('2. 尝试刷新页面');
    console.log('3. 清除浏览器缓存');
    console.log('4. 检查网络连接');
  } else {
    console.log('✅ 未检测到黑屏问题');
  }
  
  return result;
}

// 导出诊断函数
if (typeof window !== 'undefined') {
  window.blackScreenDiagnostic = {
    start: startDiagnostic,
    stop: stopDiagnostic,
    check: checkBlackScreen,
    runOnce: runDiagnostic,
    getState: () => diagnosticState
  };
  
  console.log('ℹ️ 黑屏诊断工具已加载');
  console.log('使用方法:');
  console.log('- window.blackScreenDiagnostic.start() - 开始持续诊断');
  console.log('- window.blackScreenDiagnostic.check() - 手动检查一次');
  console.log('- window.blackScreenDiagnostic.stop() - 停止诊断');
}

// 如果检测到当前就是黑屏，立即运行诊断
setTimeout(() => {
  const currentCheck = checkBlackScreen();
  if (currentCheck.basics.isBlackScreen.isLikelyBlackScreen) {
    console.log('🚨 检测到当前页面可能存在黑屏问题，建议运行持续诊断');
    console.log('运行: window.blackScreenDiagnostic.start()');
  }
}, 1000);
