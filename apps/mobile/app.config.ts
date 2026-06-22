import type { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'FandarAI',
  slug: 'fandarai',
  owner: 'fandarai',
  version: '1.0.0',
  orientation: 'portrait',
  icon: '../../packages/shared/assets/logo.png',
  splash: {
    image: '../../packages/shared/assets/logo.png',
    resizeMode: 'contain',
    backgroundColor: '#FFFFFF',
  },
  userInterfaceStyle: 'light',
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'ai.fandar.app',
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: 'ai.fandar.app',
    versionCode: 2,
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: [
    ['@rnmapbox/maps', {}],
    '@react-native-community/datetimepicker',
    [
      'expo-location',
      {
        locationWhenInUsePermission: 'Allow Fandar AI to use your location to find fan venues near you.',
      },
    ],
  ],
  extra: {
    eas: {
      projectId: 'a8ec8d1e-5ef1-41ec-9e26-99b2da2c2d72',
    },
  },
});
