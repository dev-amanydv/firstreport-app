// @ts-check
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// The workspace packages are NodeNext TypeScript and import "./config.js" for "./config.ts".
// Metro does not map the extension, so retry a relative ".js" import without it.
const resolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const next = resolve ?? context.resolveRequest;
  if (moduleName.startsWith(".") && moduleName.endsWith(".js")) {
    try {
      return next(context, moduleName, platform);
    } catch {
      return next(context, moduleName.slice(0, -3), platform);
    }
  }
  return next(context, moduleName, platform);
};

module.exports = config;
