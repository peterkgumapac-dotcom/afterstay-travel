export default ({ config }) => ({
  ...config,
  plugins: [
    ...(config.plugins || []),
    'expo-image',
    'expo-sqlite',
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
