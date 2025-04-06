import { json } from '@remix-run/cloudflare';
import type { ActionFunction } from '@remix-run/cloudflare';
import { deleteDataFile, saveFileArtifacts } from '~/utils/fileOperations';
import type { FileContent } from '~/utils/projectCommands';

const getBaseUrl = () => {
  return 'https://test.dev.rapidcanvas.net/';
};

export const action: ActionFunction = async ({ request }) => {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const dataAppId = formData.get('dataAppId') as string;
    const projectName = formData.get('projectName') as string;
    const fileArtifactsJson = formData.get('fileArtifacts') as string;
    const token = request.headers.get('token');

    if (!file || !dataAppId || !token) {
      return json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Parse file artifacts if provided
    let fileArtifacts: FileContent[] = [];

    if (fileArtifactsJson) {
      try {
        fileArtifacts = JSON.parse(fileArtifactsJson);
      } catch (error) {
        console.error('Error parsing file artifacts:', error);
      }
    }

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };

    // Get data app details
    const dataAppResponse = await fetch(`${getBaseUrl()}/api/dataapps/by-id/${dataAppId}/detailed`, {
      method: 'GET',
      headers,
    });

    if (!dataAppResponse.ok) {
      throw new Error(`Failed to get data app details: ${dataAppResponse.statusText}`);
    }

    const dataAppJson = (await dataAppResponse.json()) as { appTemplate?: { name: string } };
    const appName = dataAppJson?.appTemplate?.name || 'app';

    // Generate signed URL for upload
    const payload = {
      fileName: `${appName}.zip`,
      signedUrlObjectType: 'APP_TEMPLATE_REACTJS',
      metadata: { appType: 'reactjs', SOURCE: 'TENANT' },
    };

    const response = await fetch(`${getBaseUrl()}/api/signed-url/generate-file-upload-url`, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers,
    });

    if (!response.ok) {
      throw new Error(`Failed to generate signed URL: ${response.statusText}`);
    }

    const result = (await response.json()) as { signedUrl: string; headers?: Record<string, string> };
    const signedUrl = result.signedUrl;
    const resultHeaders = result.headers || {};

    if (!signedUrl) {
      throw new Error('Signed upload URL not found.');
    }

    // Upload the file
    const zipResponse = await fetch(signedUrl, {
      headers: {
        ...resultHeaders,
        'Content-Type': 'application/zip',
      },
      method: 'PUT',
      body: file,
    });

    if (!zipResponse.ok) {
      throw new Error('Failed to upload file');
    }

    if (fileArtifacts.length > 0 && projectName) {
      // Save file artifacts to disk and remove latest app data
      await saveFileArtifacts(fileArtifacts, dataAppId, projectName);
      await deleteDataFile(dataAppId, 'latest');
    }

    return json({ success: true });
  } catch (error: any) {
    console.error('Error publishing code:', error);
    return json({ error: 'Failed to publish code', details: error.message }, { status: 500 });
  }
};
