const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withGradleWrapper = (config) => {
    return withDangerousMod(config, [
        'android',
        async (config) => {
            // The path to gradle-wrapper.properties within the android directory
            // projectRoot is usually the root of the React Native project (android/)
            const wrapperPath = path.join(config.modRequest.platformProjectRoot, 'gradle', 'wrapper', 'gradle-wrapper.properties');

            if (fs.existsSync(wrapperPath)) {
                let content = fs.readFileSync(wrapperPath, 'utf8');
                // Replace the distributionUrl
                content = content.replace(
                    /distributionUrl=.*$/,
                    'distributionUrl=https\\://services.gradle.org/distributions/gradle-8.13-bin.zip'
                );
                fs.writeFileSync(wrapperPath, content);
            } else {
                // If file doesn't exist, we can create it or ignore (prebuild usually creates it)
                console.warn('⚠️ gradle-wrapper.properties not found, skipping update.');
            }
            return config;
        },
    ]);
};

module.exports = withGradleWrapper;
