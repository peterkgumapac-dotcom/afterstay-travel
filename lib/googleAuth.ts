import { CONFIG } from './config';

type GoogleSigninModule = typeof import('@react-native-google-signin/google-signin');

let googleSigninModule: GoogleSigninModule | null = null;
let configured = false;

async function getGoogleSigninModule(): Promise<GoogleSigninModule> {
  if (!googleSigninModule) {
    googleSigninModule = await import('@react-native-google-signin/google-signin');
  }
  if (!configured) {
    googleSigninModule.GoogleSignin.configure({
      webClientId: CONFIG.GOOGLE_WEB_CLIENT_ID,
    });
    configured = true;
  }
  return googleSigninModule;
}

export async function beginGoogleSignIn() {
  const { GoogleSignin } = await getGoogleSigninModule();

  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

  // Force the chooser after logout/account switches instead of silently reusing
  // the previous Google account cached by the native module.
  let hasPreviousSignIn = false;
  try {
    hasPreviousSignIn = await Promise.resolve(GoogleSignin.hasPreviousSignIn());
  } catch {
    hasPreviousSignIn = false;
  }
  if (hasPreviousSignIn) {
    await GoogleSignin.signOut().catch(() => {});
  }

  return GoogleSignin.signIn();
}

export async function clearGoogleSession(): Promise<void> {
  try {
    const { GoogleSignin } = await getGoogleSigninModule();
    await GoogleSignin.signOut().catch(() => {});
    await GoogleSignin.revokeAccess().catch(() => {});
  } catch {
    // Native module may be unavailable in Expo Go, or the user may not have used Google.
  }
}
