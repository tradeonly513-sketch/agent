import { json, type MetaFunction } from '@remix-run/cloudflare';

export const meta: MetaFunction = () => {
  return [{ title: 'Test Page' }, { name: 'description', content: 'Test page for debugging' }];
};

export const loader = () => json({});

export default function Test() {
  return (
    <div className="flex flex-col h-full w-full bg-bolt-elements-background-depth-1 p-8">
      <h1 className="text-2xl font-bold text-bolt-elements-textPrimary mb-4">Test Page</h1>
      <p className="text-bolt-elements-textSecondary">
        If you can see this page, the basic routing and styling are working.
      </p>
      <div className="mt-4 p-4 bg-bolt-elements-background-depth-2 rounded-lg">
        <h2 className="text-lg font-semibold text-bolt-elements-textPrimary mb-2">System Status</h2>
        <ul className="space-y-1 text-sm text-bolt-elements-textSecondary">
          <li>✅ Remix routing working</li>
          <li>✅ CSS classes loading</li>
          <li>✅ TypeScript compilation successful</li>
        </ul>
      </div>
    </div>
  );
}
