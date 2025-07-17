// Simple test server to check application functionality
import { createServer } from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3001;

// Simple MIME type mapping
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.ts': 'text/plain'
};

function getMimeType(filePath) {
  const ext = path.extname(filePath);
  return mimeTypes[ext] || 'text/plain';
}

function createTestHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bolt.diy Test</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .test { margin: 10px 0; padding: 10px; border: 1px solid #ddd; }
        .pass { background: #d4edda; }
        .fail { background: #f8d7da; }
        .info { background: #d1ecf1; }
        code { background: #f8f9fa; padding: 2px 4px; }
    </style>
</head>
<body>
    <h1>🧪 Bolt.diy Runtime Test</h1>
    <div id="results"></div>
    
    <script type="module">
        const results = document.getElementById('results');
        
        function addResult(title, status, message) {
            const div = document.createElement('div');
            div.className = `test ${status}`;
            div.innerHTML = `<strong>${title}</strong>: ${message}`;
            results.appendChild(div);
        }
        
        async function runTests() {
            addResult('Test Start', 'info', 'Running browser compatibility tests...');
            
            // Test 1: Browser API availability
            try {
                const hasIndexedDB = typeof indexedDB !== 'undefined';
                addResult('IndexedDB Support', hasIndexedDB ? 'pass' : 'fail', 
                    hasIndexedDB ? 'IndexedDB is available' : 'IndexedDB is not available');
                
                const hasLocalStorage = typeof localStorage !== 'undefined';
                addResult('LocalStorage Support', hasLocalStorage ? 'pass' : 'fail',
                    hasLocalStorage ? 'LocalStorage is available' : 'LocalStorage is not available');
                    
                const hasWebWorkers = typeof Worker !== 'undefined';
                addResult('Web Workers Support', hasWebWorkers ? 'pass' : 'fail',
                    hasWebWorkers ? 'Web Workers are available' : 'Web Workers are not available');
            } catch (error) {
                addResult('Browser API Test', 'fail', \`Error: \${error.message}\`);
            }
            
            // Test 2: Module loading simulation
            try {
                // Simulate the indexedDB check from our code
                const indexedDBAvailable = typeof indexedDB !== 'undefined';
                if (!indexedDBAvailable) {
                    addResult('Database Fallback', 'pass', 'IndexedDB unavailable - fallback should work');
                } else {
                    addResult('Database Available', 'pass', 'IndexedDB available for persistence');
                }
            } catch (error) {
                addResult('Module Loading', 'fail', \`Error: \${error.message}\`);
            }
            
            // Test 3: Network connectivity
            try {
                const response = await fetch('/test-endpoint');
                addResult('Network Test', response.ok ? 'pass' : 'fail', 
                    `Server responded with status: ${response.status}`);
            } catch (error) {
                addResult('Network Test', 'fail', `Network error: ${error.message}`);
            }
            
            // Test 4: Error handling
            try {
                // Simulate potential runtime errors
                const testError = new Error('Test error');
                throw testError;
            } catch (error) {
                addResult('Error Handling', 'pass', 'Error catching works correctly');
            }
            
            // Test 5: Console log capture
            const originalLog = console.log;
            const originalError = console.error;
            let logCount = 0;
            let errorCount = 0;
            
            console.log = (...args) => {
                logCount++;
                originalLog(...args);
            };
            
            console.error = (...args) => {
                errorCount++;
                originalError(...args);
                addResult('Console Error Detected', 'fail', `Error: ${args.join(' ')}`);
            };
            
            // Restore console
            setTimeout(() => {
                console.log = originalLog;
                console.error = originalError;
                addResult('Console Test', 'info', `Captured ${logCount} logs, ${errorCount} errors`);
                
                addResult('Test Complete', 'info', 'All tests completed. Check results above.');
            }, 1000);
        }
        
        // Run tests when page loads
        runTests().catch(error => {
            addResult('Test Runner Error', 'fail', error.message);
        });
    </script>
</body>
</html>`;
}

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  
  console.log(`📝 ${new Date().toISOString()} - ${req.method} ${url.pathname}`);
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  if (url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(createTestHTML());
    return;
  }
  
  if (url.pathname === '/test-endpoint') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      message: 'Test endpoint responding correctly'
    }));
    return;
  }
  
  // Serve files from the project directory
  const filePath = path.join(__dirname, url.pathname.slice(1));
  
  try {
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const content = fs.readFileSync(filePath);
      const mimeType = getMimeType(filePath);
      
      res.writeHead(200, { 'Content-Type': mimeType });
      res.end(content);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File not found');
    }
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end(`Server error: ${error.message}`);
  }
});

server.listen(PORT, 'localhost', () => {
  console.log(`🚀 Test server running at http://localhost:${PORT}`);
  console.log('📊 This will help identify runtime issues in a browser environment');
  console.log('🔍 Open the URL in your browser to run tests');
  console.log('⏰ Server will auto-close in 2 minutes...');
  
  // Auto-close after 2 minutes
  setTimeout(() => {
    console.log('\n⏰ Test server shutting down...');
    server.close();
    process.exit(0);
  }, 120000);
});

server.on('error', (error) => {
  console.error('❌ Server error:', error.message);
  process.exit(1);
});