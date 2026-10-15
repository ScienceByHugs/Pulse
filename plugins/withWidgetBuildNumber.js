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
    const phases = project.pbxNativeTargetSection()[target.pbxNativeTarget.uuid]?.buildPhases || [];
    const phaseName = '[Pulse] Sync widget build number';
    if (!phases.some((phase) => phase.comment === phaseName)) {
      project.addBuildPhase([], 'PBXShellScriptBuildPhase', phaseName, target.pbxNativeTarget.uuid, {
        shellPath: '/bin/sh',
        shellScript: 'APP_PLIST="${TARGET_BUILD_DIR}/Pulse.app/Info.plist"\nWIDGET_PLIST="${TARGET_BUILD_DIR}/${WRAPPER_NAME}/Info.plist"\nif [ -f "$APP_PLIST" ] && [ -f "$WIDGET_PLIST" ]; then APP_BUILD=$(/usr/libexec/PlistBuddy -c "Print :CFBundleVersion" "$APP_PLIST"); /usr/libexec/PlistBuddy -c "Set :CFBundleVersion $APP_BUILD" "$WIDGET_PLIST"; fi',
      });
    }

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
