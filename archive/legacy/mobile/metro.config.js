const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add support for .mjs files which are common in ESM packages
config.resolver.sourceExts.push('mjs');

// Prefer CJS over ESM for compatibility with packages like socket.io-client
// This avoids "Unable to resolve ./socket.js" errors
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];

module.exports = config;
