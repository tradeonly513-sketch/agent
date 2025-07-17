// Simple test to check the actual runtime errors
import fs from 'fs';

console.log('🔍 Checking for specific runtime error patterns...\n');

// Check what we can determine about potential errors
function analyzeCode() {
  console.log('1. Analyzing critical files for runtime issues...');
  
  // Check for common SSR issues
  const files = [
    'app/lib/persistence/useChatHistory.ts',
    'app/lib/hooks/useIndexedDB.ts',
    'app/components/chat/Chat.client.tsx',
    'app/lib/agent/client-executor.ts'
  ];
  
  files.forEach(file => {
    try {
      const content = fs.readFileSync(file, 'utf8');
      
      // Check for potential runtime issues
      const issues = [];
      
      if (content.includes('window.') && !content.includes('typeof window')) {
        issues.push('Direct window access without guards');
      }
      
      if (content.includes('document.') && !content.includes('typeof document')) {
        issues.push('Direct document access without guards');
      }
      
      if (content.includes('indexedDB') && !content.includes('typeof indexedDB')) {
        issues.push('Direct indexedDB access without guards');
      }
      
      if (content.includes('localStorage') && !content.includes('typeof localStorage')) {
        issues.push('Direct localStorage access without guards');
      }
      
      // Check for async/await at module level
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('await ') && !line.includes('function') && !line.includes('=>')) {
          issues.push(`Module-level await at line ${i + 1}`);
        }
      }
      
      if (issues.length === 0) {
        console.log(`✅ ${file}: No obvious runtime issues`);
      } else {
        console.log(`⚠️  ${file}: ${issues.join(', ')}`);
      }
      
    } catch (error) {
      console.log(`❌ ${file}: Cannot read - ${error.message}`);
    }
  });
}

function checkEnvironment() {
  console.log('\n2. Checking environment setup...');
  
  // Check .env.local
  try {
    const envContent = fs.readFileSync('.env.local', 'utf8');
    console.log('✅ .env.local exists');
    
    const lines = envContent.split('\n').filter(line => line.trim() && !line.startsWith('#'));
    console.log(`   Contains ${lines.length} environment variables`);
    
    const hasApiKeys = lines.some(line => 
      line.includes('API_KEY') || 
      line.includes('ANTHROPIC') || 
      line.includes('OPENAI') ||
      line.includes('GOOGLE') ||
      line.includes('GROQ')
    );
    
    if (hasApiKeys) {
      console.log('✅ Has API key configurations');
    } else {
      console.log('⚠️  No API keys detected (may cause provider errors)');
    }
    
  } catch (error) {
    console.log('⚠️  .env.local not found or not readable');
  }
  
  // Check package.json scripts
  try {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const devScript = pkg.scripts?.dev;
    
    if (devScript) {
      console.log(`✅ Dev script: ${devScript}`);
    } else {
      console.log('❌ No dev script found');
    }
    
  } catch (error) {
    console.log('❌ Cannot read package.json');
  }
}

function checkBuildFiles() {
  console.log('\n3. Checking build configuration...');
  
  const configs = [
    'vite.config.ts',
    'tsconfig.json',
    'wrangler.toml'
  ];
  
  configs.forEach(config => {
    if (fs.existsSync(config)) {
      console.log(`✅ ${config} exists`);
      
      if (config === 'vite.config.ts') {
        const content = fs.readFileSync(config, 'utf8');
        if (content.includes('chrome129IssuePlugin')) {
          console.log('   ✅ Chrome 129 fix enabled');
        }
        if (content.includes('nodePolyfills')) {
          console.log('   ✅ Node polyfills configured');
        }
      }
    } else {
      console.log(`❌ ${config} missing`);
    }
  });
}

function checkForKnownErrors() {
  console.log('\n4. Checking for known error patterns...');
  
  // Check if there are any obvious TypeScript errors
  try {
    const chatFile = fs.readFileSync('app/components/chat/Chat.client.tsx', 'utf8');
    
    // Look for the specific toast error we fixed
    if (chatFile.includes('duration:') && !chatFile.includes('autoClose:')) {
      console.log('❌ Found toast duration error (should be autoClose)');
    } else {
      console.log('✅ Toast configuration looks good');
    }
    
  } catch (error) {
    console.log('⚠️  Cannot check chat component');
  }
  
  // Check agent executor
  try {
    const executorFile = fs.readFileSync('app/lib/agent/executor.ts', 'utf8');
    
    if (executorFile.includes('DEFAULT_PROVIDER.name')) {
      console.log('❌ Found provider name error (should be DEFAULT_PROVIDER)');
    } else {
      console.log('✅ Provider configuration looks good');
    }
    
  } catch (error) {
    console.log('✅ Agent executor not found (this might be OK)');
  }
}

function provideDiagnostics() {
  console.log('\n🎯 Diagnostic Summary:');
  console.log('Based on the analysis, here are the most likely issues:');
  console.log('');
  console.log('💡 If you\'re seeing errors, they\'re likely one of these:');
  console.log('1. 🔐 Missing API keys - The app needs LLM provider API keys to work');
  console.log('2. 🌐 Network issues - Proxy, firewall, or antivirus blocking connections');
  console.log('3. 🖥️  Browser compatibility - Try Chrome Canary if using Chrome 129');
  console.log('4. 🔧 Environment variables - Check if .env.local is properly configured');
  console.log('');
  console.log('🔍 To get specific error details:');
  console.log('1. Open browser console (F12) and look for errors');
  console.log('2. Check Network tab for failed requests');
  console.log('3. Look at terminal output when running pnpm dev');
  console.log('');
  console.log('🚀 Quick fixes to try:');
  console.log('1. Clear browser cache and cookies');
  console.log('2. Try incognito/private browsing mode');
  console.log('3. Disable browser extensions temporarily');
  console.log('4. Check if localhost:5173 is accessible');
}

// Run all checks
analyzeCode();
checkEnvironment();
checkBuildFiles();
checkForKnownErrors();
provideDiagnostics();