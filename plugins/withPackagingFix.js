const { withAppBuildGradle } = require('expo/config-plugins');

module.exports = function withPackagingFix(config) {
  return withAppBuildGradle(config, (config) => {
    const contents = config.modResults.contents;

    // Add packaging block if not already present
    if (!contents.includes('packaging {')) {
      config.modResults.contents = contents.replace(
        /android\s*\{/,
        `android {
    packaging {
        resources {
            excludes += ['META-INF/versions/9/OSGI-INF/MANIFEST.MF']
        }
    }`
      );
    }

    return config;
  });
};
