const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const origResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // On web, react-native-maps can't resolve — return empty module
  if (
    platform === 'web' &&
    (moduleName === 'react-native-maps' || moduleName.includes('react-native-maps/'))
  ) {
    return { type: 'empty' };
  }

  return origResolve
    ? origResolve(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
