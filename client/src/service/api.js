import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:7001/api',
    withCredentials: true
});

const getOrCreateDeviceId = () => {
    const storageKey = 'deviceId';
    const existing = localStorage.getItem(storageKey);
    if (existing) {
        return existing;
    }

    const randomValue = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const deviceId = `web-${randomValue}`;
    localStorage.setItem(storageKey, deviceId);
    return deviceId;
};

api.interceptors.request.use((config) => {
    config.headers['x-device-id'] = getOrCreateDeviceId();
    return config;
});

export default api;