import { json, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { default as IndexRoute } from './_index';
import { ErrorBoundary } from '~/components/ui/ErrorBoundary/ErrorBoundary';

export const loader = async (args: LoaderFunctionArgs) => {
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
};

export default IndexRoute;

export { ErrorBoundary };
