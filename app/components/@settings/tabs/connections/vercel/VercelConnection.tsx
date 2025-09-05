import React from 'react';

interface VercelConnectionProps {
  onDeployProject?: (projectId: string) => void;
}

export default function VercelConnection({ onDeployProject: _onDeployProject }: VercelConnectionProps = {}) {
  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-2">Vercel Connection</h3>
      <p className="text-sm text-gray-600">Vercel connection component coming soon...</p>
    </div>
  );
}
