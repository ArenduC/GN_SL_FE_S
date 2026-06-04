import { useState, useCallback } from 'react';
import { authService } from '../services/auth.service';

export const useAuth = () => {
    const [user, setUser] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const login = useCallback(async (credentials: any) => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await authService.login(credentials);
            setUser(result.user);
            if (result.token) {
                localStorage.setItem('auth_token', result.token);
            }
            return result;
        } catch (err: any) {
            const errMsg = err.response?.data?.message || err.message || 'Login failed';
            setError(errMsg);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const logout = useCallback(async () => {
        setIsLoading(true);
        try {
            await authService.logout();
            setUser(null);
        } catch (err: any) {
            console.error('Logout error:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    return {
        user,
        isLoading,
        error,
        login,
        logout,
    };
};
