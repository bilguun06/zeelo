import '../global.css';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { Manrope_700Bold, Manrope_800ExtraBold } from '@expo-google-fonts/manrope';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/lib/auth';
import { I18nProvider } from '@/lib/i18n';
import { KEYS, prefs } from '@/lib/storage';

void SplashScreen.preventAutoHideAsync().catch(() => {});

function ThemeBoot() {
  const { colorScheme, setColorScheme } = useColorScheme();
  useEffect(() => {
    // Follow the OS theme unless the user picked one in Profile → Appearance.
    prefs.get(KEYS.theme).then((t) => {
      if (t === 'light' || t === 'dark') return setColorScheme(t);
      // On web, resolve "system" explicitly so NativeWind owns the <html class="dark"> toggle (no race).
      if (Platform.OS === 'web') return setColorScheme(window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      setColorScheme('system');
    });
  }, [setColorScheme]);
  // Web preview: NativeWind's class strategy keys `dark:` styles off <html class="dark">.
  useEffect(() => {
    if (Platform.OS === 'web') document.documentElement.classList.toggle('dark', colorScheme === 'dark');
  }, [colorScheme]);
  return <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />;
}

export default function RootLayout() {
  const [client] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { retry: (n, e) => n < 2 && (e as { status?: number })?.status !== 401 && (e as { status?: number })?.status !== 404, staleTime: 20_000 },
    },
  }));
  const [loaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Manrope_700Bold, Manrope_800ExtraBold });

  useEffect(() => {
    if (loaded) void SplashScreen.hideAsync().catch(() => {});
  }, [loaded]);
  if (!loaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={client}>
          <I18nProvider>
            <AuthProvider>
              <ThemeBoot />
              <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: 'transparent' } }}>
                <Stack.Screen name="index" options={{ animation: 'fade' }} />
                <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
                <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
                <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
                <Stack.Screen name="repay/[loanId]" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
              </Stack>
            </AuthProvider>
          </I18nProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
