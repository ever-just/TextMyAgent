const path = require('path');

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;

  // Only notarize macOS builds
  if (electronPlatformName !== 'darwin') {
    console.log('Skipping notarization: not macOS');
    return;
  }

  // Skip notarization if explicitly disabled
  if (process.env.SKIP_NOTARIZATION === 'true') {
    console.log('Skipping notarization: SKIP_NOTARIZATION=true');
    return;
  }

  // Check for required environment variables
  const appleId = process.env.APPLE_ID;
  const appleIdPassword = process.env.APPLE_ID_PASSWORD; // App-specific password
  const teamId = process.env.APPLE_TEAM_ID;

  if (!appleId || !appleIdPassword || !teamId) {
    console.log('Skipping notarization: Missing Apple credentials');
    console.log('  Required environment variables:');
    console.log('    APPLE_ID - Your Apple ID email');
    console.log('    APPLE_ID_PASSWORD - App-specific password from appleid.apple.com');
    console.log('    APPLE_TEAM_ID - Your Apple Developer Team ID');
    return;
  }

  // Dynamic import for ES module
  const { notarize } = await import('@electron/notarize');

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);

  console.log(`Notarizing ${appPath}...`);

  try {
    await notarize({
      tool: 'notarytool',
      appPath,
      appleId,
      appleIdPassword,
      teamId,
    });
    console.log('Notarization complete!');
  } catch (error) {
    console.error('Notarization failed:', error);
    throw error;
  }
};
