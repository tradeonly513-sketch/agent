import { json, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { default as IndexRoute } from './_index';
import { ErrorBoundary } from '~/components/ui/ErrorBoundary';

const BASE_URL = 'https://test.dev.rapidcanvas.net/';

export async function loader(args: LoaderFunctionArgs) {
  const url = new URL(args.request.url);
  const token = url.searchParams.get('token');

  if (!token) {
    throw new Response('Unauthorized', { status: 401 });
  }

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  const dataAppResponse = await fetch(`${BASE_URL}api/token/validation`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ token }),
  });

  console.log({ dataAppResponse });

  if (dataAppResponse.status === 401) {
    throw new Response('User authentication failed.', {
      status: 401,
    });
  }

  if (dataAppResponse.status !== 200) {
    throw new Response('Something went wrong', {
      status: 500,
      statusText: dataAppResponse.statusText,
    });
  }

  /*
   *   const showChat = process.env.SHOW_CHAT?.toLowerCase() === 'true';
   *   const shouldHideHeader = process.env.HIDE_APP_HEADER?.toLowerCase() === 'true';
   *   const shouldHideUserSettingsMenu = process.env.HIDE_USER_SETTINGS_MENU?.toLowerCase() === 'true';
   *   const shouldHideGithubOptions = process.env.HIDE_GITHUB_OPTIONS?.toLowerCase() === 'true';
   *
   *   ToDo: Remove hide workbench setting once dataApp chat option is introduced
   *   const shouldHideWorkbenchCloseIcon = process.env.HIDE_WORKBENCH_CLOSE?.toLowerCase() === 'true';
   */

  return json({
    id: args.params.id,
    showChat: false,
    shouldHideWorkbenchCloseIcon: true,
    shouldHideHeader: true,
    shouldHideUserSettingsMenu: true,
    shouldHideGithubOptions: true,
  });
}

export default IndexRoute;

export { ErrorBoundary };
