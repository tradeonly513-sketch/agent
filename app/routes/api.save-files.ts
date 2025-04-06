import { json } from '@remix-run/cloudflare';
import type { ActionFunction } from '@remix-run/cloudflare';
import type { FileContent } from '~/utils/projectCommands';
import { saveFileArtifacts, readFileArtifacts } from '~/utils/fileOperations';
import { withAuth } from '~/middleware';

interface SaveFilesRequest {
  files: FileContent[];
  dataAppId: string;
  folderName: string;
}

export const action: ActionFunction = withAuth(async ({ request }) => {
  try {
    const body = (await request.json()) as SaveFilesRequest;
    const { files, dataAppId, folderName } = body;

    if (!files || !dataAppId || !folderName) {
      return json({ error: 'Missing required fields' }, { status: 400 });
    }

    await saveFileArtifacts(files, dataAppId, folderName);

    const latestData = await readFileArtifacts(dataAppId, 'latest');

    if (!latestData) {
      return json({ success: true, files, isLatest: false });
    }

    return json({ success: true, files: latestData.files, isLatest: true });
  } catch (error) {
    console.error('Error saving files:', error);
    return json({ error: 'Failed to save files' }, { status: 500 });
  }
});
