const { withXcodeProject } = require('@expo/config-plugins');

/** Keep the widget extension's CFBundleVersion equal to the app's build number. */
module.exports = function withWidgetBuildNumber(config) {
  return withXcodeProject(config, (mod) => {
    const project = mod.modResults;
    const buildNumber = String(
      config.ios?.buildNumber || process.env.EAS_BUILD_VERSION || '1',
    );
    const target = project.pbxTargetByName('ExpoWidgetsTarget');
    const appTarget = project.pbxTargetByName('Pulse');
    if (appTarget?.pbxNativeTarget) {
      const phases = project.pbxNativeTargetSection()[appTarget.pbxNativeTarget.uuid]?.buildPhases || [];
      const phaseName = '[Pulse] Sync widget build number';
      if (!phases.some((phase) => phase.comment === phaseName)) {
        project.addBuildPhase([], 'PBXShellScriptBuildPhase', phaseName, appTarget.pbxNativeTarget.uuid, {
          shellPath: '/bin/sh',
          shellScript: 'WIDGET_PLIST="${TARGET_BUILD_DIR}/${WRAPPER_NAME}/PlugIns/ExpoWidgetsTarget.appex/Info.plist"\nif [ -f "$WIDGET_PLIST" ]; then /usr/libexec/PlistBuddy -c "Set :CFBundleVersion ${CURRENT_PROJECT_VERSION}" "$WIDGET_PLIST"; fi',
        });
      }
    }
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
