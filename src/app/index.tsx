import { Redirect } from 'expo-router';

// The root index redirects immediately; actual routing is handled by
// RootStack in _layout.tsx based on auth state.
export default function Index() {
  return <Redirect href="/(tabs)" />;
}
