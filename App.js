import { registerRootComponent } from 'expo';
import { Ionicons } from '@expo/vector-icons';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import StatsScreen from './src/screens/StatsScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import HomeScreen from './src/screens/HomeScreen';

const Tab = createBottomTabNavigator();
const linking = { prefixes: ['bookkeeper://'], config: { screens: { '记账': 'add', '历史': 'history', '统计': 'stats' } } };

function App() {
  return (
    <NavigationContainer linking={linking}>
      <Tab.Navigator screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: '#4F46E5' }, headerTintColor: '#fff',
        tabBarActiveTintColor: '#4F46E5', tabBarInactiveTintColor: '#9CA3AF',
        tabBarIcon: ({ color, size }) => {
          const icons = { '记账': 'create-outline', '历史': 'list-outline', '统计': 'stats-chart-outline' };
          return <Ionicons name={icons[route.name]} size={size} color={color} />;
        },
      })}>
        <Tab.Screen name="记账" component={HomeScreen} options={{ title: 'AI 记账' }} />
        <Tab.Screen name="历史" component={HistoryScreen} />
        <Tab.Screen name="统计" component={StatsScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

registerRootComponent(App);
