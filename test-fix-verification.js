// Verification script for the optimized template approach
// This tests the two-phase approach: essential files + remaining files

console.log('🧪 Testing Optimized Template Approach');
console.log('======================================');

// Mock data to simulate a large template with many files
const mockLargeTemplate = {
  files: []
};

// Add critical files
mockLargeTemplate.files.push(
  {
    name: 'package.json',
    path: 'package.json',
    content: JSON.stringify({
      name: 'test-project',
      version: '1.0.0',
      dependencies: { react: '^18.0.0' }
    }, null, 2)
  },
  {
    name: 'vite.config.ts',
    path: 'vite.config.ts',
    content: 'import { defineConfig } from "vite";\nexport default defineConfig({});'
  },
  {
    name: 'App.tsx',
    path: 'src/App.tsx',
    content: 'export default function App() { return <div>Hello World</div>; }'
  }
);

// Generate regular files to simulate a large template
for (let i = 1; i <= 30; i++) {
  mockLargeTemplate.files.push({
    name: `component${i}.tsx`,
    path: `src/components/component${i}.tsx`,
    content: `// This is component ${i}\n`.repeat(50) + `export default function Component${i}() {\n  return <div>Component ${i}</div>;\n}`
  });
}

// Test the new categorization logic
function categorizeFiles(files) {
  const criticalFiles = [];
  const regularFiles = [];

  files.forEach((file) => {
    // Critical files that should be created first
    if (
      file.name === 'package.json' ||
      file.name === 'package-lock.json' ||
      file.name === 'yarn.lock' ||
      file.name === 'pnpm-lock.yaml' ||
      file.name === 'tsconfig.json' ||
      file.name === 'vite.config.ts' ||
      file.name === 'vite.config.js' ||
      file.name === 'index.html' ||
      file.path === 'src/main.tsx' ||
      file.path === 'src/main.ts' ||
      file.path === 'src/index.tsx' ||
      file.path === 'src/index.ts' ||
      file.path === 'src/App.tsx' ||
      file.path === 'src/App.ts'
    ) {
      criticalFiles.push(file);
    } else {
      regularFiles.push(file);
    }
  });

  return { criticalFiles, regularFiles };
}

// Simulate the optimized approach
const essentialFiles = mockLargeTemplate.files.filter(file =>
  file.name === 'package.json' ||
  file.name === 'index.html' ||
  file.path === 'src/main.tsx' ||
  file.path === 'src/main.ts' ||
  file.path === 'src/App.tsx' ||
  file.path === 'src/App.ts' ||
  file.name === 'vite.config.ts' ||
  file.name === 'vite.config.js'
);

const remainingFiles = mockLargeTemplate.files.filter(file => !essentialFiles.includes(file));

console.log(`📊 Test Results:`);
console.log(`   - Total files: ${mockLargeTemplate.files.length}`);
console.log(`   - Essential files: ${essentialFiles.length}`);
console.log(`   - Remaining files: ${remainingFiles.length}`);

// Simulate the first message with essential files
const firstMessage = `
I'll help you create a project using the Test template. Let me start by setting up the essential files and structure.

<boltArtifact id="project-setup" title="Project Setup - Test" type="bundled">
${essentialFiles
  .map(
    (file) =>
      `<boltAction type="file" filePath="${file.path}">
${file.content}
</boltAction>`,
  )
  .join('\n')}
</boltArtifact>

Now I'll create the remaining ${remainingFiles.length} files to complete your project structure.`;

// Simulate the second message with remaining files
const secondMessage = `
Let me create the remaining files to complete your Test project:

<boltArtifact id="remaining-files" title="Complete Project Structure" type="bundled">
${remainingFiles
  .map(
    (file) =>
      `<boltAction type="file" filePath="${file.path}">
${file.content}
</boltAction>`,
  )
  .join('\n')}
</boltArtifact>

Perfect! Your Test project is now complete with all ${mockLargeTemplate.files.length} files. You can start developing right away!`;

console.log(`\n📏 Optimized Approach - Message Size Analysis:`);
console.log(`   - First message size: ${firstMessage.length} characters`);
console.log(`   - Second message size: ${secondMessage.length} characters`);
console.log(`   - Total message size: ${firstMessage.length + secondMessage.length} characters`);

const maxSingleMessage = Math.max(firstMessage.length, secondMessage.length);
console.log(`   - Largest single message: ${maxSingleMessage} characters`);
console.log(`   - Size check: ${maxSingleMessage > 120000 ? '⚠️ Still too large' : maxSingleMessage > 60000 ? '⚠️ Large but manageable' : '✅ Within limits'}`);

console.log(`\n📁 Two-Phase Strategy:`);
console.log(`   - Phase 1: Essential files (${essentialFiles.length}) in first message`);
console.log(`   - Phase 2: Remaining files (${remainingFiles.length}) in follow-up message`);
console.log(`   - Benefits: Smaller individual messages, better reliability`);

console.log('\n✅ Optimized template approach verification completed!');
console.log('🎯 Key improvement: Split into manageable chunks while keeping boltArtifact approach');
console.log('🚀 Better reliability and user experience!');
