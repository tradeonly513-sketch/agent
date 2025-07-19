import { useState } from 'react';
import { getTemplates } from '~/utils/selectStarterTemplate';

export default function TestTemplate() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const testTemplate = async (templateName: string) => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      console.log(`Testing template: ${templateName}`);

      const templateResult = await getTemplates(templateName, 'Test Project');

      if (templateResult) {
        const { assistantMessage, userMessage, totalFiles, criticalFilesCount, regularFilesCount } = templateResult;

        setResult({
          templateName,
          assistantMessageSize: assistantMessage.length,
          userMessageSize: userMessage.length,
          totalFiles,
          criticalFilesCount,
          regularFilesCount,
        });

        console.log('✅ Template test successful:', {
          totalFiles,
          criticalFilesCount,
          regularFilesCount,
          assistantMessageSize: assistantMessage.length,
        });
      } else {
        setError('Template not found or failed to load');
      }
    } catch (err) {
      console.error('❌ Template test failed:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const templates = ['Vite React', 'NextJS Shadcn', 'Vite Shadcn', 'Remix Typescript', 'Expo App'];

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Template Initialization Test</h1>
      <p className="text-gray-600 mb-8">
        This page tests the template initialization fix to ensure large templates are properly split into batches.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {templates.map((template) => (
          <button
            key={template}
            onClick={() => testTemplate(template)}
            disabled={loading}
            className="p-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Test {template}
          </button>
        ))}
      </div>

      {loading && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <p className="mt-2">Testing template...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
          <h3 className="font-bold text-lg mb-4">Test Results for {result.templateName}</h3>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <strong>Total Files:</strong> {result.totalFiles}
            </div>
            <div>
              <strong>Critical Files:</strong> {result.criticalFilesCount}
            </div>
            <div>
              <strong>Regular Files:</strong> {result.regularFilesCount}
            </div>
            <div>
              <strong>Assistant Message Size:</strong> {result.assistantMessageSize.toLocaleString()} chars
            </div>
            <div>
              <strong>User Message Size:</strong> {result.userMessageSize.toLocaleString()} chars
            </div>
          </div>

          <div className="mb-4">
            <strong>Size Check:</strong>{' '}
            {result.assistantMessageSize > 60000 ? (
              <span className="text-red-600">⚠️ Still large ({result.assistantMessageSize} chars)</span>
            ) : (
              <span className="text-green-600">✅ Within limits ({result.assistantMessageSize} chars)</span>
            )}
          </div>

          <div>
            <strong>Strategy:</strong> Files are categorized into critical and regular files, then created in two
            artifacts for better reliability.
          </div>
        </div>
      )}
    </div>
  );
}
