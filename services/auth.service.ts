import client from '../api/client';
import { ENDPOINTS } from '../api/endpoints';

export const authService = {
    /**
     * Authenticate and sign in user with email and password
     */
    login: async (credentials: any) => {
        const response = await client.post(ENDPOINTS.AUTH.login, credentials);
        return response.data;
    },
    
    /**
     * Register a new user profile
     */
    signUp: async (profileData: any) => {
        const response = await client.post(ENDPOINTS.AUTH.signUp, profileData);
        return response.data;
    },

    /**
     * End session and sign out
     */
    logout: async () => {
        await client.post(ENDPOINTS.AUTH.logout);
        localStorage.removeItem('auth_token');
    }
};
