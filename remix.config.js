/** @type {import('@remix-run/dev').AppConfig} */
export default {
  // Force a Node/Express runtime (not Workerd/Edge)
  serverPlatform: "node",

  // Force CommonJS output for the server bundle
  serverModuleFormat: "cjs",

  // Make module resolution unambiguously Node
  serverConditions: ["node"],
  serverMainFields: ["main", "module"],
};
