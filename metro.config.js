const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');
const config = getDefaultConfig(__dirname);

// pdf-lib's older tslib export map selects an ESM wrapper with a missing default
// under Metro. Use that package's CommonJS entry, preserving nested versions.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'tslib') {
    return {
      type: 'sourceFile',
      filePath: require.resolve('tslib', { paths: [path.dirname(context.originModulePath)] }),
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};
module.exports = config;
