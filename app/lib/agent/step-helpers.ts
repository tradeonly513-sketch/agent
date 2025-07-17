import type { AgentTask, AgentStep } from '~/types/actions';

export class StepHelpers {
  static getReactFileCreationCalls(__task: AgentTask): Array<{ name: string; parameters: any }> {
    const calls = [];

    // Create package.json
    calls.push({
      name: 'create_file',
      parameters: {
        path: 'package.json',
        content: JSON.stringify(
          {
            name: 'react-todo-app',
            version: '1.0.0',
            private: true,
            dependencies: {
              react: '^18.2.0',
              'react-dom': '^18.2.0',
              'react-scripts': '5.0.1',
            },
            scripts: {
              start: 'react-scripts start',
              build: 'react-scripts build',
              test: 'react-scripts test',
              eject: 'react-scripts eject',
            },
          },
          null,
          2,
        ),
      },
    });

    // Create public/index.html
    calls.push({
      name: 'create_file',
      parameters: {
        path: 'public/index.html',
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>React Todo App</title>
</head>
<body>
  <noscript>You need to enable JavaScript to run this app.</noscript>
  <div id="root"></div>
</body>
</html>`,
      },
    });

    // Create src/index.js
    calls.push({
      name: 'create_file',
      parameters: {
        path: 'src/index.js',
        content: `import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`,
      },
    });

    return calls;
  }

  static getExpressFileCreationCalls(_task: AgentTask): Array<{ name: string; parameters: any }> {
    const calls = [];

    // Create package.json
    calls.push({
      name: 'create_file',
      parameters: {
        path: 'package.json',
        content: JSON.stringify(
          {
            name: 'express-api',
            version: '1.0.0',
            description: 'Express REST API',
            main: 'server.js',
            scripts: {
              start: 'node server.js',
              dev: 'nodemon server.js',
            },
            dependencies: {
              express: '^4.18.2',
              cors: '^2.8.5',
              dotenv: '^16.0.3',
            },
            devDependencies: {
              nodemon: '^2.0.22',
            },
          },
          null,
          2,
        ),
      },
    });

    // Create server.js
    calls.push({
      name: 'create_file',
      parameters: {
        path: 'server.js',
        content: `const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Express API Server is running!' });
});

app.listen(PORT, () => {
  console.log(\`Server is running on port \${PORT}\`);
});`,
      },
    });

    return calls;
  }

  static getHtmlFileCreationCalls(_task: AgentTask): Array<{ name: string; parameters: any }> {
    return [
      {
        name: 'create_file',
        parameters: {
          path: 'index.html',
          content: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hello World</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background-color: #f0f0f0;
        }
        .container {
            text-align: center;
            background: white;
            padding: 2rem;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Hello, World!</h1>
        <p>This is a simple HTML page created by the Agent.</p>
    </div>
</body>
</html>`,
        },
      },
    ];
  }

  static getPythonFileCreationCalls(_task: AgentTask): Array<{ name: string; parameters: any }> {
    return [
      {
        name: 'create_file',
        parameters: {
          path: 'main.py',
          content: `#!/usr/bin/env python3
"""
Python script created by Agent
"""

def main():
    print("Hello, World!")
    print("This is a Python script created by the Agent.")

if __name__ == "__main__":
    main()`,
        },
      },
    ];
  }

  static getGenericFileCreationCalls(_task: AgentTask, _step: AgentStep): Array<{ name: string; parameters: any }> {
    const fileName = StepHelpers.extractFileNameFromDescription(task.description) || 'example.txt';
    const content = StepHelpers.generateFileContent(fileName, task.description);

    return [
      {
        name: 'create_file',
        parameters: {
          path: fileName,
          content,
        },
      },
    ];
  }

  static getCommandExecutionCalls(_step: AgentStep, _task: AgentTask): Array<{ name: string; parameters: any }> {
    const calls = [];

    if (step.title.toLowerCase().includes('install')) {
      if (task.description.toLowerCase().includes('npm') || task.description.toLowerCase().includes('node')) {
        calls.push({
          name: 'execute_command',
          parameters: {
            command: 'npm install',
          },
        });
      } else if (task.description.toLowerCase().includes('python') || task.description.toLowerCase().includes('pip')) {
        calls.push({
          name: 'execute_command',
          parameters: {
            command: 'pip install -r requirements.txt',
          },
        });
      }
    }

    if (step.title.toLowerCase().includes('test')) {
      calls.push({
        name: 'execute_command',
        parameters: {
          command: 'npm test',
        },
      });
    }

    return calls;
  }

  static getDirectoryCreationCalls(_task: AgentTask): Array<{ name: string; parameters: any }> {
    const calls = [];

    if (task.description.toLowerCase().includes('react')) {
      calls.push(
        { name: 'create_folder', parameters: { path: 'src' } },
        {
          name: 'create_folder',
          parameters: { path: 'public' },
        },
        { name: 'create_folder', parameters: { path: 'src/components' } },
      );
    } else if (task.description.toLowerCase().includes('express')) {
      calls.push(
        { name: 'create_folder', parameters: { path: 'routes' } },
        {
          name: 'create_folder',
          parameters: { path: 'middleware' },
        },
        { name: 'create_folder', parameters: { path: 'models' } },
      );
    }

    return calls;
  }

  static extractFileNameFromDescription(description: string): string | null {
    const patterns = [
      /create.*?([a-zA-Z0-9_-]+\.[a-zA-Z0-9]+)/i,
      /file.*?called.*?([a-zA-Z0-9_-]+\.[a-zA-Z0-9]+)/i,
      /([a-zA-Z0-9_-]+\.html)/i,
      /([a-zA-Z0-9_-]+\.js)/i,
      /([a-zA-Z0-9_-]+\.css)/i,
      /([a-zA-Z0-9_-]+\.py)/i,
    ];

    for (const pattern of patterns) {
      const match = description.match(pattern);

      if (match) {
        return match[1];
      }
    }

    return null;
  }

  static generateFileContent(fileName: string, description: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase();

    switch (ext) {
      case 'html':
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Generated HTML</title>
</head>
<body>
    <h1>Hello, World!</h1>
    <p>This file was generated based on: ${description}</p>
</body>
</html>`;

      case 'js':
        return `// JavaScript file generated by Agent
console.log('Hello, World!');

// Generated based on: ${description}`;

      case 'css':
        return `/* CSS file generated by Agent */
body {
    font-family: Arial, sans-serif;
    margin: 0;
    padding: 20px;
    background-color: #f0f0f0;
}

/* Generated based on: ${description} */`;

      case 'py':
        return `#!/usr/bin/env python3
"""
Python file generated by Agent
Based on: ${description}
"""

def main():
    print("Hello, World!")

if __name__ == "__main__":
    main()`;

      default:
        return `Hello, World!

This file was generated by the Agent based on: ${description}`;
    }
  }

  static generateStepSummary(_step: AgentStep, toolCalls: Array<{ name: string; parameters: any }>): string {
    let summary = `Completed step: ${step.title}\n`;

    if (toolCalls.length > 0) {
      summary += `\nActions performed:\n`;
      toolCalls.forEach((call, index) => {
        summary += `${index + 1}. Used ${call.name}`;

        if (call.name === 'create_file') {
          summary += ` to create ${call.parameters.path}`;
        } else if (call.name === 'execute_command') {
          summary += ` to run: ${call.parameters.command}`;
        } else if (call.name === 'create_folder') {
          summary += ` to create directory ${call.parameters.path}`;
        }

        summary += '\n';
      });
    }

    return summary;
  }
}
