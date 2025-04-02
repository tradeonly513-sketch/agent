import { json } from '@remix-run/cloudflare';
import type { ActionFunction } from '@remix-run/cloudflare';
import JSZip from 'jszip';

interface RequestBody {
  dataAppId: string;
  token: string;
}

const BASE_URL = 'https://test.dev.rapidcanvas.net/';

async function getAppTemplate(dataAppId: string, token: string): Promise<string> {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  const dataAppResponse = await fetch(`${BASE_URL}/api/dataapps/by-id/${dataAppId}/detailed`, {
    method: 'GET',
    headers,
  });
  const dataAppJson: any = await dataAppResponse.json();

  return dataAppJson.appTemplate.name;
}

async function fetchZipFromDataApp(appTemplateName: string, token: string): Promise<JSZip> {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
  console.log(appTemplateName);

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
  console.log(signedUrl);

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

async function processZipEntries(zip: JSZip, folderName: string) {
  const textDecoder = new TextDecoder('utf-8');
  const skippedFiles: string[] = [];
  const fileArtifacts: Array<{ path: string; content: string }> = [];

  const entries = Object.values(zip.files);

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
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      const uint8Content = await entry.async('uint8array');
      content = textDecoder.decode(uint8Content);
    }

    fileArtifacts.push({ path: normalizedPath, content });
  }

  return { fileArtifacts, skippedFiles };
}

function normalizeRelativePath(relativePath: string, commonFolder?: string): string | null {
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

export const action: ActionFunction = async ({ request }) => {
  try {
    const body = (await request.json()) as RequestBody;
    const { dataAppId, token } = body;

    if (!dataAppId || !token) {
      return json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const folderName = await getAppTemplate(dataAppId, token);
    const zip = await fetchZipFromDataApp(folderName, token);
    const { fileArtifacts, skippedFiles } = await processZipEntries(zip, folderName);

    return json({ fileArtifacts, skippedFiles, folderName });
  } catch (error: any) {
    console.error('Error processing files:', error);
    return json({ error: error.message }, { status: 500 });
  }
};
