/** @type {import('@remix-run/dev').AppConfig} */
export default {
  // Make sure Remix builds for a Node/Express runtime (not Cloudflare/Edge)
  serverPlatform: "node",

  // Keep ESM since your package.json is "type": "module"
  serverModuleFormat: "esm",
};
