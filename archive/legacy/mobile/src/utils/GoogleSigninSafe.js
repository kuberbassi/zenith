import { Platform } from 'react-native';
import Constants from 'expo-constants';

let GoogleSignin = {
    configure: () => { },
    hasPlayServices: async () => true,
    signIn: async () => { throw new Error("Google Sign-In not supported in Expo Go"); },
    signOut: async () => { },
    isSignedIn: async () => false,
    getTokens: async () => ({ accessToken: 'mock-token' }),
};

let statusCodes = {
    SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
    IN_PROGRESS: 'IN_PROGRESS',
    PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
};

// Check if running in Expo Go
const isExpoGo = Constants.appOwnership === 'expo';

if (!isExpoGo) {
    try {
        const GoogleModule = require('@react-native-google-signin/google-signin');
        GoogleSignin = GoogleModule.GoogleSignin;
        statusCodes = GoogleModule.statusCodes;
    } catch (e) {
        console.warn("Google Sign-In module not found, using mock.");
    }
} else {
    // console.log("Running in Expo Go: Google Sign-In mocked.");
}

export { GoogleSignin, statusCodes };
