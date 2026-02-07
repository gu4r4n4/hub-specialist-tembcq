
import { createAuthClient } from 'better-auth/react';
import { expoClient } from '@better-auth/expo/client';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

const backendUrl = Constants.expoConfig?.extra?.backendUrl || 'http://localhost:8081';

export const authClient = createAuthClient({
  baseURL: backendUrl,
  plugins: [
    expoClient({
      scheme: 'hubspecialist',
      storagePrefix: 'hub-specialist',
      storage: SecureStore,
    }),
  ],
});
