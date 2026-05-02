import './lib/runtimePolyfills';

import { registerWidgetTaskHandler } from 'react-native-android-widget';

import { widgetTaskHandler } from './widgets/task-handler';

// Register the widget task handler before expo-router boots.
// This runs in a headless JS context when Android triggers a widget update.
registerWidgetTaskHandler(widgetTaskHandler);

// Boot the normal Expo Router app.
// eslint-disable-next-line import/first
import 'expo-router/entry';
