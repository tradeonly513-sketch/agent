import { json } from '@remix-run/cloudflare';
import type { ActionFunctionArgs } from '@remix-run/cloudflare';
import { withAuth } from '~/middleware';
import { updateFileInArtifacts } from '~/utils/fileOperations';

interface UpdateFileRequest {
  filePath: string;
  content: string;
  dataAppId: string;
}

export const action = withAuth(async ({ request }: ActionFunctionArgs) => {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const body = (await request.json()) as UpdateFileRequest;
    const { filePath, content, dataAppId } = body;

    if (!filePath || !content || !dataAppId) {
      return json({ error: 'Missing required fields' }, { status: 400 });
    }

    await updateFileInArtifacts(filePath, content, dataAppId);

    return json({ success: true });
  } catch (error) {
    console.error('Error updating file:', error);
    return json({ error: 'Failed to update file' }, { status: 500 });
  }
});
