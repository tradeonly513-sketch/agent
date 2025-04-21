import { json } from '@remix-run/node';
import type { LoaderFunctionArgs } from '@remix-run/node';

import { deleteDataFile, readFileArtifacts } from '~/utils/fileOperations';
import { withAuthLoader } from '~/middleware';

export const loader = withAuthLoader(async ({ request }: LoaderFunctionArgs) => {
  const searchParams = new URL(request.url).searchParams;
  const dataAppId = searchParams.get('dataAppId');

  if (!dataAppId) {
    return json({ error: 'Data app ID is required' }, { status: 400 });
  }

  try {
    const data = await readFileArtifacts(dataAppId!, 'app');
    await deleteDataFile(dataAppId, 'latest');

    if (!data) {
      return json({ error: 'No saved data found' }, { status: 404 });
    }

    return json(data);
  } catch (error) {
    console.error('Error loading files:', error);
    return json({ error: 'Failed to load files' }, { status: 500 });
  }
});
