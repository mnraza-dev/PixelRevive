import { Tabs } from 'expo-router';
import { StudioTabBar } from '../../components/StudioTabBar';
export default function TabLayout() {
  return <Tabs tabBar={props => <StudioTabBar {...props} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: 'transparent' }, animation: 'fade' }}>
    <Tabs.Screen name="index" options={{ title: 'Studio' }} />
    <Tabs.Screen name="enhance" options={{ title: 'Enhance' }} />
    <Tabs.Screen name="history" options={{ title: 'Library' }} />
    <Tabs.Screen name="profile" options={{ title: 'You' }} />
  </Tabs>;
}
