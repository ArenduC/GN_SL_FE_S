import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios';

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
    _retryCount?: number;
    silent?: boolean;
}

const MAX_TRANSIENT_RETRIES = 2;

export const setupInterceptors = (axiosInstance: AxiosInstance): AxiosInstance => {
    // Request Interceptor
    axiosInstance.interceptors.request.use(
        (config: InternalAxiosRequestConfig) => {
            // Include authorization token if stored
            const token = localStorage.getItem('auth_token');
            const isValidToken = token && token !== 'undefined' && token !== 'null' && token.trim().length > 0;
            if (isValidToken && config.headers) {
                const bearerToken = `Bearer ${token}`;
                if (typeof config.headers.set === 'function') {
                    config.headers.set('Authorization', bearerToken);
                } else {
                    config.headers.Authorization = bearerToken;
                }
            }

            // Automatically append ngrok-skip-browser-warning bypass only for ngrok endpoints
            const isNgrok = config.url?.includes('ngrok-free.dev') || config.baseURL?.includes('ngrok-free.dev');
            if (isNgrok) {
                if (config.headers) {
                    if (typeof config.headers.set === 'function') {
                        config.headers.set('ngrok-skip-browser-warning', 'true');
                    } else {
                        config.headers['ngrok-skip-browser-warning'] = 'true';
                    }
                }
                config.params = {
                    ...config.params,
                    'ngrok-skip-browser-warning': 'true'
                };
            }
            return config;
        },
        (error) => {
            console.warn('[API Request Error]:', error?.message || error);
            return Promise.reject(error);
        }
    );

    // Response Interceptor
    axiosInstance.interceptors.response.use(
        (response: AxiosResponse) => {
            return response;
        },
        async (error) => {
            if (axios.isCancel(error) || error?.code === 'ERR_CANCELED') {
                return Promise.reject(error);
            }

            const config = error.config as RetryableRequestConfig | undefined;
            const status = error.response ? error.response.status : null;
            const data = error.response ? error.response.data : null;

            const isOnline = typeof navigator === 'undefined' || navigator.onLine !== false;
            const isTransientNetworkError =
                isOnline &&
                config &&
                (!error.response || status === 502 || status === 503 || status === 504) &&
                (config._retryCount || 0) < MAX_TRANSIENT_RETRIES;

            if (isTransientNetworkError && config) {
                config._retryCount = (config._retryCount || 0) + 1;
                const delayMs = config._retryCount * 600;
                await new Promise((resolve) => setTimeout(resolve, delayMs));
                return axiosInstance(config);
            }

            const isSilent = config?.silent || (status === 404 && config?.url?.includes('/profile'));

            if (!isSilent) {
                if (status === null) {
                    console.warn(`[API Network Warning] Request unreachable (${config?.url || 'unknown'}):`, error.message);
                } else {
                    console.error(`[API Response Error] Status: ${status}`, data || error.message);
                }
            }

            if (status === 401) {
                console.warn('Unauthorized or Session expired.');
            }

            return Promise.reject(error);
        }
    );

    return axiosInstance;
};
