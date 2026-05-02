export default ({ config }) => ({
  ...config,
  plugins: [
    ...(config.plugins || []),
    'expo-image',
    'expo-sqlite',
    'expo-video',
    'expo-secure-store',
    [
      'expo-build-properties',
      {
        android: {
          minSdkVersion: 24,
        },
      },
    ],
    [
      'react-native-android-widget',
      {
        fonts: ['./assets/fonts/SpaceMono-Regular.ttf'],
        widgets: [
          {
            name: 'TripCountdown',
            label: 'Trip Countdown',
            description: 'Days until your next trip',
            minWidth: '110dp',
            minHeight: '40dp',
            targetCellWidth: 2,
            targetCellHeight: 1,
            previewImage: './assets/widgets/trip-countdown-preview.png',
            updatePeriodMillis: 1800000,
          },
          {
            name: 'NextFlight',
            label: 'Next Flight',
            description: 'Your upcoming flight details',
            minWidth: '180dp',
            minHeight: '110dp',
            targetCellWidth: 3,
            targetCellHeight: 2,
            previewImage: './assets/widgets/next-flight-preview.png',
            updatePeriodMillis: 1800000,
          },
          {
            name: 'DailyBudget',
            label: 'Daily Budget',
            description: "Today's spending at a glance",
            minWidth: '250dp',
            minHeight: '110dp',
            targetCellWidth: 4,
            targetCellHeight: 2,
            previewImage: './assets/widgets/daily-budget-preview.png',
            updatePeriodMillis: 1800000,
          },
        ],
      },
    ],
  ],
  ios: {
    ...config.ios,
    config: {
      googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ?? '',
    },
  },
  android: {
    ...config.android,
    config: {
      ...config.android?.config,
      googleMaps: {
        apiKey: process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ?? '',
      },
    },
  },
});
