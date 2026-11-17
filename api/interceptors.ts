import { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios';

export const setupInterceptors = (axiosInstance: AxiosInstance): AxiosInstance => {
    // Request Interceptor
    axiosInstance.interceptors.request.use(
        (config: InternalAxiosRequestConfig) => {
            // Include authorization token if stored
            const token = localStorage.getItem('auth_token');
            const isValidToken = token && token !== 'undefined' && token !== 'null' && token.trim().length > 0;
            if (isValidToken && config.headers) {
                const bearerToken = `Bearer ${token}`;
                config.headers.Authorization = bearerToken;
                config.headers['Authorization'] = bearerToken;
                config.headers['authorization'] = bearerToken;
                
                // For modern Axios (AxiosHeaders class)
                if (typeof config.headers.set === 'function') {
                    config.headers.set('Authorization', bearerToken);
                    config.headers.set('authorization', bearerToken);
                }
            }

            // Automatically append ngrok-skip-browser-warning bypass to both headers and query params
            const isNgrok = config.url?.includes('ngrok-free.dev') || config.baseURL?.includes('ngrok-free.dev');
            if (isNgrok) {
                if (config.headers) {
                    config.headers['ngrok-skip-browser-warning'] = 'true';
                }
                config.params = {
                    ...config.params,
                    'ngrok-skip-browser-warning': 'true'
                };
            }
            return config;
        },
        (error) => {
            console.error('[API Request Error]:', error);
            return Promise.reject(error);
        }
    );

    // Response Interceptor
    axiosInstance.interceptors.response.use(
        (response: AxiosResponse) => {
            return response;
        },
        (error) => {
            // Standardize and log global response errors
            const status = error.response ? error.response.status : null;
            const data = error.response ? error.response.data : null;
            const config = error.config;
            const isSilent = config?.silent || (status === 404 && config?.url?.includes('/profile'));
            
            if (!isSilent) {
                console.error(`[API Response Error] Status: ${status}`, data || error.message);
            } else {
                console.log(`[API Response Info] Status: ${status} (Silent request or expected 404 profile status)`);
            }
            
            if (status === 401) {
                console.warn('Unauthorized or Session expired.');
                // Handle unauthorized transitions or session cleanups here
            }
            
            return Promise.reject(error);
        }
    );

    return axiosInstance;
};
