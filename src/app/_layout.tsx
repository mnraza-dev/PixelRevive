import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { GlassEnvironment } from '../components/GlassSurface';
import { useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Stack, useRouter, useSegments, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { EnhancementProvider } from '../context/EnhancementContext';
import { useTheme } from '../hooks/useThemeColor';

SplashScreen.preventAutoHideAsync().catch(() => {});

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return <View style={{ flex: 1, justifyContent: 'center', padding: 32, backgroundColor: '#101116', gap: 20 }}>
    <Text style={{ color: '#FFF', fontSize: 26, fontWeight: '600' }}>Let’s try that again.</Text>
    <Text style={{ color: '#ADB2C1', fontSize: 16 }}>The studio could not open this screen. Your saved photos stay on your device.</Text>
    <Pressable accessibilityRole="button" onPress={retry} style={{ backgroundColor: '#FF5E67', padding: 18, borderRadius: 18 }}><Text style={{ color: '#FFF', fontWeight: '600', textAlign: 'center' }}>Try again</Text></Pressable>
  </View>;
}

function RootStack() {
  const { isDark } = useTheme();
  const { isLoading, user } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    // Protection logic
    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      // Redirect to login if unauthenticated
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
      // Redirect away from login if authenticated
      router.replace('/(tabs)');
    }

    // Hide splash screen once initial auth state is determined
    SplashScreen.hideAsync().catch(() => {});
  }, [user, isLoading, segments, router]);

  if (isLoading) return null;

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: 'transparent' },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="result" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
        <Stack.Screen name="processing" options={{ headerShown: false, presentation: 'fullScreenModal', gestureEnabled: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <GlassEnvironment>
    <AuthProvider>
      <EnhancementProvider>
        <RootStack />
      </EnhancementProvider>
    </AuthProvider>
    </GlassEnvironment>
    </GestureHandlerRootView>
  );
}
