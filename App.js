import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import ProfileScreen from './src/screens/ProfileScreen';
import AlertsScreen from './src/screens/AlertsScreen';
import { mockProfile, mockPortfolio, mockPosts, mockThoughts } from './src/data/mockProfile';
import { colors } from './src/theme';

const Tab = createBottomTabNavigator();

// Keeps navigation backgrounds black too (no white flash between tabs).
const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
  },
};

function Profile() {
  return (
    <ProfileScreen
      profile={mockProfile}
      portfolio={mockPortfolio}
      posts={mockPosts}
      thoughts={mockThoughts}
      isOwnProfile
    />
  );
}

const TAB_ICONS = {
  Profile: ['person', 'person-outline'],
  Alerts: ['notifications', 'notifications-outline'],
};

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <NavigationContainer theme={navTheme}>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarActiveTintColor: colors.primary,
            tabBarInactiveTintColor: colors.textMuted,
            tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
            tabBarLabelStyle: { fontWeight: '600' },
            tabBarIcon: ({ focused, color, size }) => (
              <Ionicons name={TAB_ICONS[route.name][focused ? 0 : 1]} size={size} color={color} />
            ),
          })}
        >
          <Tab.Screen name="Profile" component={Profile} />
          <Tab.Screen name="Alerts" component={AlertsScreen} />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
