import type { MetaFunction } from '@remix-run/cloudflare';
import { ClientOnly } from 'remix-utils/client-only';
import BmadDemo from '~/components/chat/BmadDemo';

export const meta: MetaFunction = () => {
  return [{ title: 'BMad System Test' }, { name: 'description', content: 'Test page for BMad agent system' }];
};

export default function BmadTest() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">BMad Agent System Test</h1>
          <p className="text-gray-600 dark:text-gray-400">
            This page demonstrates the BMad (Business Method for Agile Development) agent system integration. The BMad
            system provides structured, role-based AI agents for development workflows.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* BMad Demo Component */}
          <div className="lg:col-span-2">
            <ClientOnly>{() => <BmadDemo />}</ClientOnly>
          </div>

          {/* Information Panel */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">📚 About BMad System</h3>
            <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
              <div>
                <strong>BMad Method:</strong> A structured approach to agile development using specialized AI agents.
              </div>
              <div>
                <strong>Key Features:</strong>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>Role-based agents (Orchestrator, Developer, Architect, etc.)</li>
                  <li>Command-driven interaction (*help, *agent, *task)</li>
                  <li>Interactive and YOLO modes</li>
                  <li>Task execution with user elicitation</li>
                  <li>Workflow coordination</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Available Agents */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">🤖 Available Agents</h3>
            <div className="space-y-3 text-sm">
              <div className="border-b border-gray-200 dark:border-gray-700 pb-2">
                <div className="font-medium text-gray-900 dark:text-white">🎭 BMad Orchestrator</div>
                <div className="text-gray-600 dark:text-gray-400">
                  Master coordinator for workflow management and agent switching
                </div>
              </div>
              <div className="border-b border-gray-200 dark:border-gray-700 pb-2">
                <div className="font-medium text-gray-900 dark:text-white">💻 James (Developer)</div>
                <div className="text-gray-600 dark:text-gray-400">
                  Full-stack developer for code implementation and testing
                </div>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-500">
                More agents can be added by extending the BMad configuration
              </div>
            </div>
          </div>
        </div>

        {/* Usage Instructions */}
        <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-3">🚀 Getting Started</h3>
          <div className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
            <div>
              <strong>1.</strong> Click "Activate BMad" to initialize the system
            </div>
            <div>
              <strong>2.</strong> Use quick commands or type commands manually
            </div>
            <div>
              <strong>3.</strong> Try "*help" to see available commands
            </div>
            <div>
              <strong>4.</strong> Activate an agent with "*agent bmad-orchestrator"
            </div>
            <div>
              <strong>5.</strong> Explore agent capabilities and tasks
            </div>
          </div>
        </div>

        {/* Integration Notes */}
        <div className="mt-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-yellow-900 dark:text-yellow-100 mb-3">⚙️ Integration Status</h3>
          <div className="space-y-2 text-sm text-yellow-800 dark:text-yellow-200">
            <div>✅ BMad core system implemented</div>
            <div>✅ Agent configuration and parsing</div>
            <div>✅ Command system (*help, *agent, *status, etc.)</div>
            <div>✅ Basic UI controls and demo</div>
            <div>🔄 Integration with main chat system (in progress)</div>
            <div>🔄 Task execution and elicitation system</div>
            <div>🔄 Workflow management</div>
            <div>📋 File-based agent and task loading</div>
          </div>
        </div>
      </div>
    </div>
  );
}
