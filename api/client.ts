import axios from 'axios';
import { setupInterceptors } from './interceptors';

export const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://gn-sl-api.vercel.app';

const client = axios.create({
    baseURL: BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 45000, // Accommodate delayed backend responses up to 30s
});

// Configure standard request and response interceptors
setupInterceptors(client);

export default client;
