// Script to start dev server and capture initial errors
import { spawn } from 'child_process';
import fs from 'fs';

console.log('🚀 Starting development server...\n');

const logFile = 'server-output.log';
const errorFile = 'server-errors.log';

// Clear previous logs
fs.writeFileSync(logFile, '');
fs.writeFileSync(errorFile, '');

// Start the development server
const devServer = spawn('pnpm', ['run', 'dev'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  shell: true
});

let startupCompleted = false;
let errorCount = 0;
let warningCount = 0;

// Capture stdout
devServer.stdout.on('data', (data) => {
  const output = data.toString();
  console.log(output);
  fs.appendFileSync(logFile, output);
  
  // Check for successful startup
  if (output.includes('Local:') || output.includes('localhost:5173')) {
    startupCompleted = true;
    console.log('✅ Server started successfully!');
  }
  
  // Look for specific error patterns
  if (output.toLowerCase().includes('error')) {
    errorCount++;
  }
  if (output.toLowerCase().includes('warning')) {
    warningCount++;
  }
});

// Capture stderr
devServer.stderr.on('data', (data) => {
  const error = data.toString();
  console.error('🔴 ERROR:', error);
  fs.appendFileSync(errorFile, error);
  errorCount++;
});

// Handle process events
devServer.on('error', (error) => {
  console.error('🔴 Failed to start server:', error.message);
  process.exit(1);
});

devServer.on('close', (code) => {
  console.log(`\n📊 Server process exited with code ${code}`);
  console.log(`Errors: ${errorCount}, Warnings: ${warningCount}`);
  
  if (code !== 0 && !startupCompleted) {
    console.log('❌ Server failed to start properly');
    
    // Read and display captured errors
    try {
      const errors = fs.readFileSync(errorFile, 'utf8');
      if (errors.trim()) {
        console.log('\n🔍 Captured errors:');
        console.log(errors);
      }
    } catch (e) {
      console.log('No error file found');
    }
  }
  
  process.exit(code);
});

// Give it 30 seconds to start up
setTimeout(() => {
  if (!startupCompleted) {
    console.log('\n⏰ Startup timeout - killing process...');
    devServer.kill('SIGTERM');
    
    // Wait a bit for graceful shutdown
    setTimeout(() => {
      console.log('📊 Startup analysis:');
      console.log(`- Errors encountered: ${errorCount}`);
      console.log(`- Warnings encountered: ${warningCount}`);
      console.log(`- Startup completed: ${startupCompleted}`);
      
      if (errorCount > 0) {
        console.log('\n🔍 Check server-errors.log for detailed error information');
      }
      
      process.exit(1);
    }, 2000);
  } else {
    console.log('\n✅ Server startup completed successfully!');
    devServer.kill('SIGTERM');
    process.exit(0);
  }
}, 30000);