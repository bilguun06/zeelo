import { Redirect, Tabs } from 'expo-router';
import { Home, LayoutGrid, User, Wallet } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, View } from 'react-native';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';

/** Active tab gets a glowing gradient pill behind the icon. */
function TabIcon({ Icon, color, focused }: { Icon: typeof Home; color: string; focused: boolean }) {
  return (
    <View style={{ width: 46, height: 30, borderRadius: 15, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', shadowColor: '#FF5533', shadowOpacity: focused ? 0.6 : 0, shadowRadius: 10 }}>
      {focused && <LinearGradient colors={['#FF5533', '#FF8A4C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />}
      <View style={{ position: 'relative', zIndex: 1 }}><Icon size={20} color={color} strokeWidth={focused ? 2.4 : 2} /></View>
    </View>
  );
}

export default function TabsLayout() {
  const { status } = useAuth();
  const { t, lang } = useI18n();
  const { c } = useTheme();
  if (status === 'signedOut' || status === 'locked') return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Floating glass-dark pill tab bar
        tabBarActiveTintColor: '#FFFFFF',
        tabBarInactiveTintColor: 'rgba(255,255,255,0.45)',
        tabBarLabelStyle: { fontFamily: 'Inter_600SemiBold', fontSize: 10.5, marginBottom: 2 },
        tabBarStyle: {
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: Platform.OS === 'ios' ? 28 : 16,
          height: 68,
          paddingTop: 6,
          paddingBottom: 6,
          paddingHorizontal: 6,
          borderRadius: 30,
          borderTopWidth: 0,
          backgroundColor: c.surface === '#FFFFFF' ? '#14161F' : '#101119',
          shadowColor: '#14161F', shadowOpacity: 0.35, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 16,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: lang === 'en' ? 'Home' : 'Нүүр', tabBarIcon: (p) => <TabIcon Icon={Home} {...p} /> }} />
      <Tabs.Screen name="products" options={{ title: lang === 'en' ? 'Products' : 'Бүтээгдэхүүн', tabBarIcon: (p) => <TabIcon Icon={LayoutGrid} {...p} /> }} />
      <Tabs.Screen name="loans" options={{ title: t('loans.title'), tabBarIcon: (p) => <TabIcon Icon={Wallet} {...p} /> }} />
      <Tabs.Screen name="profile" options={{ title: t('profile.title'), tabBarIcon: (p) => <TabIcon Icon={User} {...p} /> }} />
    </Tabs>
  );
}
