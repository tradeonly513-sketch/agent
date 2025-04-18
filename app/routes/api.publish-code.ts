import { json } from '@remix-run/cloudflare';
import type { ActionFunction } from '@remix-run/cloudflare';
import { withAuth } from '~/middleware';
import { deleteDataFile, saveFileArtifacts } from '~/utils/fileOperations';
import type { FileContent } from '~/utils/projectCommands';

interface DataAppStatus {
  launchStatus: string;
}

async function pollDataAppStatus(
  dataAppId: string,
  pollStatus: string,
  headers: HeadersInit,
  baseUrl: string,
): Promise<void> {
  const maxAttempts = 60; // 60 attempts with 5 second delay = 5 minutes timeout
  const delayMs = 5000; // 5 seconds between attempts

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const statusResponse = await fetch(`${baseUrl}/api/dataapps/by-id/${dataAppId}`, {
      method: 'GET',
      headers,
    });

    if (!statusResponse.ok) {
      throw new Error(`Failed to get dataApp status: ${statusResponse.statusText}`);
    }

    const dataAppStatus = (await statusResponse.json()) as DataAppStatus;

    if (dataAppStatus.launchStatus === pollStatus) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw new Error('Timeout waiting for dataApp to update status');
}

export const action: ActionFunction = withAuth(async ({ request }) => {
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
    const requestUrl = new URL(request.url);
    const BASE_URL = requestUrl.origin;

    if (!file || !dataAppId || !token) {
      return json({ error: 'Missing required fields' }, { status: 400 });
    }

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
    const dataAppResponse = await fetch(`${BASE_URL}/api/dataapps/by-id/${dataAppId}/detailed`, {
      method: 'GET',
      headers,
    });

    if (!dataAppResponse.ok) {
      throw new Error(`Failed to get data app details: ${dataAppResponse.statusText}`);
    }

    const dataAppJson = (await dataAppResponse.json()) as {
      tenantId: string;
      appTemplate?: { name: string; id: string };
    };
    const appTemplate = dataAppJson?.appTemplate;
    const appTemplateId = appTemplate?.id;
    const appName = appTemplate?.name || 'app';

    // Generate signed URL for upload
    const payload = {
      fileName: `${appName}.zip`,
      signedUrlObjectType: 'APP_TEMPLATE_REACTJS',
      metadata: { appType: 'reactjs', SOURCE: 'TENANT' },
    };

    const response = await fetch(`${BASE_URL}/api/signed-url/generate-file-upload-url`, {
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

    const templateResponse = await fetch(`${BASE_URL}/api/app-templates/${appTemplateId}`, {
      method: 'PUT',
      body: JSON.stringify({ ...appTemplate, name: appName, tenantId: dataAppJson.tenantId }),
      headers,
    });

    if (!templateResponse.ok) {
      throw new Error('Failed to update app template');
    }

    const templateJson = (await templateResponse.json()) as { templateId: string };

    const appTemplateIdUpdated = templateJson.templateId;

    await fetch(`${BASE_URL}/api/dataapps/${dataAppId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        ...dataAppJson,
        templateId: appTemplateIdUpdated,
      }),
    });

    await fetch(`${BASE_URL}/api/dataapps/${dataAppId}/stop`, {
      method: 'POST',
      headers,
    });

    await pollDataAppStatus(dataAppId, 'STOPPED', headers, BASE_URL);

    await fetch(`${BASE_URL}/api/dataapps/${dataAppId}/launch`, {
      method: 'POST',
      headers,
    });

    await pollDataAppStatus(dataAppId, 'RUNNING', headers, BASE_URL);

    if (fileArtifacts.length > 0 && projectName) {
      // Save file artifacts to disk and remove latest app data
      await saveFileArtifacts(fileArtifacts, dataAppId, projectName);
      await deleteDataFile(dataAppId, 'latest');
    }

    return json({
      success: true,
      appTemplateId,
      templateResponse,
      requestUrl,
      origin,
      templateBody: JSON.stringify({ ...appTemplate, name: appName }),
    });
  } catch (error: any) {
    console.error('Error publishing code:', error);
    return json({ error: 'Failed to publish code', details: error.message }, { status: 500 });
  }
});
