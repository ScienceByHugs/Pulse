const { withXcodeProject } = require('@expo/config-plugins');

/** Keep the widget extension's CFBundleVersion equal to the app's build number. */
module.exports = function withWidgetBuildNumber(config) {
  return withXcodeProject(config, (mod) => {
    const project = mod.modResults;
    const buildNumber = String(
      config.ios?.buildNumber || process.env.EAS_BUILD_VERSION || '1',
    );
    const target = project.pbxTargetByName('ExpoWidgetsTarget');
    if (!target?.pbxNativeTarget?.buildConfigurationList) return mod;

    const configurations = project.pbxXCBuildConfigurationSection();
    const list = project.pbxXCConfigurationList()[target.pbxNativeTarget.buildConfigurationList];
    for (const entry of list?.buildConfigurations || []) {
      const configuration = configurations[entry.value];
      if (configuration?.buildSettings) {
        configuration.buildSettings.CURRENT_PROJECT_VERSION = buildNumber;
      }
    }
    return mod;
  });
};
