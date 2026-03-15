const { withGradleProperties } = require('@expo/config-plugins');

module.exports = (config) => {
  return withGradleProperties(config, (config) => {
    config.modResults.push({
      type: 'property',
      key: 'android.suppressKotlinVersionCompatibilityCheck',
      value: 'true',
    });
    return config;
  });
};
