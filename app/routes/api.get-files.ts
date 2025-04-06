import { json } from '@remix-run/cloudflare';
import type { LoaderFunction } from '@remix-run/cloudflare';
import JSZip from 'jszip';
import { withAuthLoader } from '~/middleware';

const BASE_URL = 'https://test.dev.rapidcanvas.net/';

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

  const zipResponse = await fetch(signedUrl, { headers: result.headers });
  const blob = await zipResponse.blob();
  const zipArrayBuffer = await blob.arrayBuffer();

  return JSZip.loadAsync(zipArrayBuffer);
}

function shouldIncludeFile(filePath: string): boolean {
  return !filePath.startsWith('.') && !filePath.includes('__MACOSX');
}

function isBinaryFile(filePath: string): boolean {
  const binaryExtensions = ['png', 'jpg', 'jpeg', 'gif', 'ico', 'pdf', 'pyc', 'exe', 'bin'];
  const ext = filePath.split('.').pop()?.toLowerCase() || '';

  return binaryExtensions.includes(ext);
}

/**
 * Normalize by dropping the first folder segment (the ZIP's root folder)
 */
function normalizeRelativePath(relativePath: string): string | null {
  if (relativePath.startsWith('__MACOSX') || /\/\._/.test(relativePath)) {
    return null;
  }

  const parts = relativePath.split('/');

  if (parts.length <= 1) {
    return parts[0];
  }

  return parts.slice(1).join('/');
}

async function processZipEntries(zip: JSZip) {
  const textDecoder = new TextDecoder('utf-8');
  const skippedFiles: string[] = [];
  const fileArtifacts: Array<{ path: string; content: string }> = [];

  for (const entry of Object.values(zip.files)) {
    if (entry.dir) {
      continue;
    }

    const rel = entry.name;
    const normalizedPath = normalizeRelativePath(rel);

    if (!normalizedPath || !shouldIncludeFile(rel)) {
      continue;
    }

    if (isBinaryFile(rel)) {
      skippedFiles.push(rel);
      continue;
    }

    let content: string;

    try {
      content = await entry.async('string');
    } catch {
      const bytes = await entry.async('uint8array');
      content = textDecoder.decode(bytes);
    }
    fileArtifacts.push({ path: normalizedPath, content });
  }

  return { fileArtifacts, skippedFiles };
}

export const loader: LoaderFunction = withAuthLoader(async ({ request }) => {
  try {
    const url = new URL(request.url);
    const dataAppId = url.searchParams.get('dataAppId');
    const token = request.headers.get('token');

    if (!dataAppId || !token) {
      return json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const folderName = await getAppTemplate(dataAppId, token);
    const zip = await fetchZipFromDataApp(folderName, token);
    const { fileArtifacts, skippedFiles } = await processZipEntries(zip);

    return json({ fileArtifacts, skippedFiles, folderName });
  } catch (error: any) {
    console.error('Error processing files:', error);
    return json({ error: error.message }, { status: 500 });
  }
});
