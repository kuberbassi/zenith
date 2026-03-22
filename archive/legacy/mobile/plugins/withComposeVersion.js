const { withProjectBuildGradle } = require('@expo/config-plugins');

module.exports = (config) => {
    return withProjectBuildGradle(config, (config) => {
        if (config.modResults.language === 'groovy') {
            config.modResults.contents = config.modResults.contents.replace(
                /buildscript\s*\{/,
                `buildscript {
    ext {
        composeCompilerExtensionVersion = "1.5.15"
    }`
            );
        }
        return config;
    });
};
