const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withBleScanPermission(config) {
  return withAndroidManifest(config, (configWithManifest) => {
    const permissions = configWithManifest.modResults.manifest['uses-permission'] ?? [];
    const scanPermission = permissions.find(
      (permission) => permission.$['android:name'] === 'android.permission.BLUETOOTH_SCAN',
    );

    if (scanPermission) {
      scanPermission.$['android:usesPermissionFlags'] = 'neverForLocation';
    }

    return configWithManifest;
  });
};
