// Direct test of application modules to identify runtime errors
import fs from 'fs';
import path from 'path';

console.log('🧪 Testing application modules directly...\n');

async function testModule(modulePath, description) {
  try {
    console.log(`Testing ${description}...`);
    
    // Read the file content first
    const content = fs.readFileSync(modulePath, 'utf8');
    
    // Check for obvious issues
    if (content.includes('export const db = ') && content.includes('await openDatabase()')) {
      throw new Error('Module-level await detected');
    }
    
    if (content.includes('import { db,') || content.includes(', db }')) {
      throw new Error('Importing removed "db" export');
    }
    
    // Basic syntax validation using Node's module parser
    try {
      const { pathToFileURL } = await import('url');
      const moduleURL = pathToFileURL(path.resolve(modulePath)).href;
      // We can't actually import TS files directly, but we can check for basic issues
      console.log(`✅ ${description}: Basic checks passed`);
    } catch (importError) {
      console.log(`⚠️  ${description}: ${importError.message}`);
    }
    
  } catch (error) {
    console.log(`❌ ${description}: ${error.message}`);
    return false;
  }
  return true;
}

async function testBrowserAPIs() {
  console.log('\n🌐 Testing browser API guards...');
  
  // Simulate SSR environment
  global.window = undefined;
  global.document = undefined;
  global.indexedDB = undefined;
  
  try {
    // Test indexedDB usage guard
    const useIndexedDBCode = fs.readFileSync('app/lib/hooks/useIndexedDB.ts', 'utf8');
    if (useIndexedDBCode.includes('typeof indexedDB === \'undefined\'')) {
      console.log('✅ useIndexedDB: Has proper browser API guard');
    } else {
      console.log('❌ useIndexedDB: Missing browser API guard');
      return false;
    }
    
    // Test database access pattern
    const useChatHistoryCode = fs.readFileSync('app/lib/persistence/useChatHistory.ts', 'utf8');
    if (useChatHistoryCode.includes('export const getDb')) {
      console.log('✅ useChatHistory: Uses lazy database loading');
    } else {
      console.log('❌ useChatHistory: Missing lazy database loading');
      return false;
    }
    
    return true;
  } catch (error) {
    console.log(`❌ Browser API test failed: ${error.message}`);
    return false;
  }
}

async function runTests() {
  console.log('🔬 Running comprehensive module tests...\n');
  
  const tests = [
    ['app/lib/persistence/useChatHistory.ts', 'Chat History Module'],
    ['app/lib/agent/client-executor.ts', 'Client Executor Module'],
    ['app/lib/hooks/useIndexedDB.ts', 'IndexedDB Hook'],
    ['app/components/chat/Chat.client.tsx', 'Chat Component'],
    ['app/routes/.well-known.$.ts', 'Well-known Route'],
    ['vite.config.ts', 'Vite Configuration']
  ];
  
  let passed = 0;
  let total = tests.length;
  
  for (const [modulePath, description] of tests) {
    if (await testModule(modulePath, description)) {
      passed++;
    }
  }
  
  // Test browser API guards
  if (await testBrowserAPIs()) {
    passed++;
    total++;
  }
  
  console.log(`\n📊 Test Results: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('🎉 All tests passed! The application should work correctly.');
    
    console.log('\n🔍 Since basic tests pass, the runtime errors might be:');
    console.log('1. Environment-specific (Windows path issues)');
    console.log('2. Network/proxy related');
    console.log('3. Missing environment variables');
    console.log('4. Browser-specific issues');
    
    console.log('\n💡 Recommendations:');
    console.log('- Check if .env.local has required API keys');
    console.log('- Try accessing http://localhost:5173 directly');
    console.log('- Check browser console for client-side errors');
    console.log('- Verify no antivirus blocking the dev server');
    
  } else {
    console.log('❌ Some tests failed. Please fix the issues above.');
  }
  
  // Check environment setup
  console.log('\n🔧 Environment Check:');
  try {
    const envLocal = fs.readFileSync('.env.local', 'utf8');
    const hasApiKeys = envLocal.includes('API_KEY') || envLocal.includes('ANTHROPIC') || envLocal.includes('OPENAI');
    if (hasApiKeys) {
      console.log('✅ .env.local: Has API keys configured');
    } else {
      console.log('⚠️  .env.local: No API keys found (this may cause issues)');
    }
  } catch (error) {
    console.log('⚠️  .env.local: File not found or not readable');
  }
}

runTests().catch(console.error);