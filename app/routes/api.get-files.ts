import { json } from '@remix-run/cloudflare';
import type { LoaderFunction } from '@remix-run/cloudflare';
import JSZip from 'jszip';
import { withAuthLoader } from '~/middleware';

const BASE_URL = import.meta.env.RC_BASE_URL;

interface AppTemplateResponse {
  appTemplate: {
    name: string;
  };
}

async function getAppTemplate(dataAppId: string, token: string): Promise<string> {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  const dataAppResponse = await fetch(`${BASE_URL}/api/dataapps/by-id/${dataAppId}/detailed`, {
    method: 'GET',
    headers,
  });

  if (!dataAppResponse.ok) {
    throw new Error(`Failed to fetch app template: ${dataAppResponse.statusText}`);
  }

  const dataAppJson = (await dataAppResponse.json()) as AppTemplateResponse;

  if (!dataAppJson?.appTemplate?.name) {
    throw new Error('Invalid app template response');
  }

  return dataAppJson.appTemplate.name;
}

async function fetchZipFromDataApp(appTemplateName: string, token: string): Promise<JSZip> {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  const payload = {
    fileName: `${appTemplateName}.zip`,
    signedUrlObjectType: 'APP_TEMPLATE_REACTJS',
    metadata: { appType: 'reactjs', SOURCE: 'TENANT' },
  };

  const response = await fetch(`${BASE_URL}/api/signed-url/generate-file-download-url`, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers,
  });
  const result: any = await response.json();
  const signedUrl = result.signedUrl;

  if (!signedUrl) {
    throw new Error('Signed download URL not found.');
  }

  const zipResponse = await fetch(signedUrl, {
    headers: result.headers,
  });
  const blob = await zipResponse.blob();
  const zipArrayBuffer = await blob.arrayBuffer();

  return await JSZip.loadAsync(zipArrayBuffer);
}

function shouldIncludeFile(filePath: string): boolean {
  return !filePath.startsWith('.');
}

function isBinaryFile(filePath: string): boolean {
  const binaryExtensions = ['png', 'jpg', 'jpeg', 'gif', 'ico', 'pdf', 'pyc', 'exe', 'bin'];
  const ext = filePath.split('.').pop()?.toLowerCase() || '';

  return binaryExtensions.includes(ext);
}

async function processZipEntries(zip: JSZip) {
  const textDecoder = new TextDecoder('utf-8');
  const skippedFiles: string[] = [];
  const fileArtifacts: Array<{ path: string; content: string }> = [];

  const entries = Object.values(zip.files);

  const folderName = extractCommonFolder(zip);

  for (const entry of entries) {
    const relativePath = entry.name;

    const normalizedPath = normalizeRelativePath(relativePath, folderName);

    if (!normalizedPath || !shouldIncludeFile(relativePath) || entry.dir) {
      continue;
    }

    if (isBinaryFile(relativePath)) {
      skippedFiles.push(relativePath);
      continue;
    }

    let content: string;

    try {
      content = await entry.async('string');
    } catch {
      const uint8Content = await entry.async('uint8array');
      content = textDecoder.decode(uint8Content);
    }

    fileArtifacts.push({ path: normalizedPath, content });
  }

  return { fileArtifacts, skippedFiles };
}

function extractCommonFolder(zip: JSZip): string | null {
  const paths = Object.values(zip.files)
    .filter((entry) => !entry.dir && !entry.name.startsWith('__MACOSX'))
    .map((entry) => entry.name);

  if (paths.length === 0) {
    return null;
  }

  // Split each path into segments.
  const splitPaths = paths.map((path) => path.split('/'));

  // Find the common folder parts.
  let commonParts: string[] = splitPaths[0];

  for (let i = 1; i < splitPaths.length; i++) {
    const parts = splitPaths[i];
    const newCommonParts: string[] = [];

    for (let j = 0; j < commonParts.length && j < parts.length; j++) {
      if (commonParts[j] === parts[j]) {
        newCommonParts.push(commonParts[j]);
      } else {
        break;
      }
    }
    commonParts = newCommonParts;
  }

  // We consider it a common folder only if there is at least one folder.
  return commonParts.length > 0 ? commonParts[0] : null;
}

function normalizeRelativePath(relativePath: string, commonFolder?: string | null): string | null {
  if (relativePath.startsWith('__MACOSX') || /\/\._/.test(relativePath)) {
    return null;
  }

  let normalized = relativePath;

  if (commonFolder && normalized.startsWith(commonFolder)) {
    normalized = normalized.slice(commonFolder.length);
    normalized = normalized.replace(/^\/+/, '');
  }

  return normalized;
}

export const loader: LoaderFunction = withAuthLoader(async ({ request }) => {
  try {
    const url = new URL(request.url);
    const dataAppId = url.searchParams.get('dataAppId');
    const token = request.headers.get('token');

    if (!dataAppId || !token) {
      return json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const appTemplateName = await getAppTemplate(dataAppId, token);
    const zip = await fetchZipFromDataApp(appTemplateName, token);
    const { fileArtifacts, skippedFiles } = await processZipEntries(zip);

    return json({ fileArtifacts, skippedFiles, folderName: appTemplateName });
  } catch (error: any) {
    console.error('Error processing files:', error);
    return json({ error: error.message }, { status: 500 });
  }
});
