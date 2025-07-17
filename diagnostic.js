// Diagnostic script to check for common startup issues
import fs from 'fs';
import path from 'path';

console.log('🔍 Running startup diagnostics...\n');

// Check 1: Verify critical files exist and are readable
const criticalFiles = [
  'app/root.tsx',
  'app/routes/_index.tsx',
  'app/components/chat/Chat.client.tsx',
  'app/lib/persistence/useChatHistory.ts',
  'app/lib/agent/client-executor.ts',
  'vite.config.ts',
  'package.json'
];

console.log('1. Checking critical files...');
let fileIssues = 0;
criticalFiles.forEach(file => {
  try {
    const content = fs.readFileSync(file, 'utf8');
    if (content.length === 0) {
      console.log(`❌ ${file}: Empty file`);
      fileIssues++;
    } else if (content.includes('undefined') && content.includes('export')) {
      console.log(`⚠️  ${file}: May have undefined exports`);
    } else {
      console.log(`✅ ${file}: OK`);
    }
  } catch (error) {
    console.log(`❌ ${file}: ${error.message}`);
    fileIssues++;
  }
});

// Check 2: Look for common import/export issues
console.log('\n2. Checking for import/export issues...');
const tsFiles = [
  'app/lib/persistence/useChatHistory.ts',
  'app/components/chat/Messages.client.tsx',
  'app/components/sidebar/Menu.client.tsx',
  'app/lib/hooks/useEditChatDescription.ts'
];

tsFiles.forEach(file => {
  try {
    const content = fs.readFileSync(file, 'utf8');
    
    // Check for problematic imports
    const importLines = content.split('\n').filter(line => line.trim().startsWith('import'));
    const hasDbImport = importLines.some(line => line.includes('{ db,') || line.includes(', db }') || line.includes('{ db }'));
    
    if (hasDbImport) {
      console.log(`❌ ${file}: Still importing 'db' (should use 'getDb')`);
      fileIssues++;
    } else {
      console.log(`✅ ${file}: Import statements OK`);
    }
  } catch (error) {
    console.log(`❌ ${file}: ${error.message}`);
    fileIssues++;
  }
});

// Check 3: Verify package.json and dependencies
console.log('\n3. Checking package.json...');
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  
  if (packageJson.type === 'module') {
    console.log('✅ Package type: ES module');
  } else {
    console.log('⚠️  Package type: CommonJS');
  }
  
  if (packageJson.engines && packageJson.engines.node) {
    console.log(`✅ Node version requirement: ${packageJson.engines.node}`);
  } else {
    console.log('⚠️  No Node version requirement specified');
  }
  
  const hasVite = packageJson.devDependencies?.vite || packageJson.dependencies?.vite;
  if (hasVite) {
    console.log('✅ Vite dependency found');
  } else {
    console.log('❌ Vite dependency missing');
    fileIssues++;
  }
} catch (error) {
  console.log(`❌ package.json: ${error.message}`);
  fileIssues++;
}

// Check 4: Look for syntax errors in key files
console.log('\n4. Basic syntax check...');
const jsFiles = [
  'app/lib/agent/client-executor.ts',
  'vite.config.ts'
];

jsFiles.forEach(file => {
  try {
    const content = fs.readFileSync(file, 'utf8');
    
    // Basic brace matching
    const openBraces = (content.match(/\{/g) || []).length;
    const closeBraces = (content.match(/\}/g) || []).length;
    const openParens = (content.match(/\(/g) || []).length;
    const closeParens = (content.match(/\)/g) || []).length;
    
    if (openBraces !== closeBraces) {
      console.log(`❌ ${file}: Unmatched braces (${openBraces} open, ${closeBraces} close)`);
      fileIssues++;
    } else if (openParens !== closeParens) {
      console.log(`❌ ${file}: Unmatched parentheses (${openParens} open, ${closeParens} close)`);
      fileIssues++;
    } else {
      console.log(`✅ ${file}: Syntax looks good`);
    }
  } catch (error) {
    console.log(`❌ ${file}: ${error.message}`);
    fileIssues++;
  }
});

// Check 5: Environment and build files
console.log('\n5. Checking build configuration...');
const configFiles = ['vite.config.ts', 'tsconfig.json', 'wrangler.toml'];
configFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}: Exists`);
  } else {
    console.log(`❌ ${file}: Missing`);
    fileIssues++;
  }
});

// Summary
console.log('\n📊 Diagnostic Summary:');
if (fileIssues === 0) {
  console.log('🎉 No critical issues found!');
  console.log('💡 If you\'re still seeing errors, they might be runtime-specific.');
  console.log('   Try checking the browser console or network tab for more details.');
} else {
  console.log(`⚠️  Found ${fileIssues} issue(s) that need attention.`);
}

console.log('\n🔧 Next steps:');
console.log('1. Try running: pnpm dev');
console.log('2. Check browser console for errors');
console.log('3. Look at network tab for failed requests');
console.log('4. Check terminal output for build errors');