import React from 'react';

interface NetlifyConnectionProps {
  onDeploySite?: (siteId: string) => void;
}

export default function NetlifyConnection({ onDeploySite: _onDeploySite }: NetlifyConnectionProps = {}) {
  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-2">Netlify Connection</h3>
      <p className="text-sm text-gray-600">Netlify connection component coming soon...</p>
    </div>
  );
}
