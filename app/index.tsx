import { Redirect } from 'expo-router';

// Entry: redirect to Home tab (multi-trip selector lives behind this in the future).
export default function Index() {
  return <Redirect href="/(tabs)/home" />;
}
