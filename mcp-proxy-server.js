#!/usr/bin/env node

/**
 * MCP Proxy Server
 * Runs stdio MCP servers and exposes them via SSE endpoints
 * This allows Buildify (running on Cloudflare Workers) to connect to stdio-based MCP servers
 */

const express = require('express');
const { spawn } = require('child_process');
const cors = require('cors');

const app = express();
const PORT = process.env.MCP_PROXY_PORT || 8080;

app.use(cors());
app.use(express.json());

// Store active MCP server processes
const mcpProcesses = new Map();

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', processes: mcpProcesses.size });
});

// Start MCP server and create SSE endpoint
app.post('/start-mcp/:serverName', async (req, res) => {
  const { serverName } = req.params;
  const { command, args, env } = req.body;

  try {
    // Stop existing process if running
    if (mcpProcesses.has(serverName)) {
      mcpProcesses.get(serverName).kill();
      mcpProcesses.delete(serverName);
    }

    // Start new MCP server process
    const mcpProcess = spawn(command, args, {
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    mcpProcesses.set(serverName, mcpProcess);

    // Handle process events
    mcpProcess.on('error', (error) => {
      console.error(`MCP server ${serverName} error:`, error);
      mcpProcesses.delete(serverName);
    });

    mcpProcess.on('exit', (code) => {
      console.log(`MCP server ${serverName} exited with code ${code}`);
      mcpProcesses.delete(serverName);
    });

    res.json({ 
      success: true, 
      message: `MCP server ${serverName} started`,
      sseEndpoint: `/sse/${serverName}`
    });

  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// SSE endpoint for MCP communication
app.get('/sse/:serverName', (req, res) => {
  const { serverName } = req.params;
  
  if (!mcpProcesses.has(serverName)) {
    return res.status(404).json({ error: 'MCP server not found' });
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const mcpProcess = mcpProcesses.get(serverName);

  // Forward MCP protocol messages via SSE
  mcpProcess.stdout.on('data', (data) => {
    try {
      const message = JSON.parse(data.toString());
      res.write(`data: ${JSON.stringify(message)}\n\n`);
    } catch (e) {
      // Handle non-JSON output
      res.write(`data: ${JSON.stringify({ type: 'stdout', data: data.toString() })}\n\n`);
    }
  });

  mcpProcess.stderr.on('data', (data) => {
    res.write(`data: ${JSON.stringify({ type: 'error', data: data.toString() })}\n\n`);
  });

  // Handle client disconnect
  req.on('close', () => {
    console.log(`SSE client disconnected from ${serverName}`);
  });

  // Keep connection alive
  const keepAlive = setInterval(() => {
    res.write('data: {"type":"ping"}\n\n');
  }, 30000);

  req.on('close', () => {
    clearInterval(keepAlive);
  });
});

// Stop MCP server
app.post('/stop-mcp/:serverName', (req, res) => {
  const { serverName } = req.params;
  
  if (mcpProcesses.has(serverName)) {
    mcpProcesses.get(serverName).kill();
    mcpProcesses.delete(serverName);
    res.json({ success: true, message: `MCP server ${serverName} stopped` });
  } else {
    res.status(404).json({ error: 'MCP server not found' });
  }
});

// List running servers
app.get('/servers', (req, res) => {
  const servers = Array.from(mcpProcesses.keys());
  res.json({ servers });
});

app.listen(PORT, () => {
  console.log(`MCP Proxy Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down MCP proxy server...');
  for (const [name, process] of mcpProcesses) {
    console.log(`Stopping MCP server: ${name}`);
    process.kill();
  }
  process.exit(0);
});