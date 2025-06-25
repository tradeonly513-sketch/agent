import { json } from '@remix-run/cloudflare';
import { detectEnvironment, getEnvironmentDescription, getStdioAvailabilityMessage } from '~/utils/environment';

export async function loader() {
  const env = detectEnvironment();
  
  return json({
    environment: env,
    description: getEnvironmentDescription(),
    stdioMessage: getStdioAvailabilityMessage(),
  });
}