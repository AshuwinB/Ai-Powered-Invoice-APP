import api from './api';

export const getNotificationStreamUrl = () => `${api.defaults.baseURL}/notifications/stream`;

export const getNotifications = async ({ page = 1, limit = 20, status = 'all', category = 'all' } = {}) => {
    const response = await api.get('/notifications', {
        params: { page, limit, status, category },
        withCredentials: true,
    });
    return response.data;
};

export const getUnreadNotificationCount = async () => {
    const response = await api.get('/notifications/unread-count', { withCredentials: true });
    return response.data;
};

export const markNotificationsAsSeen = async () => {
    const response = await api.patch('/notifications/seen', {}, { withCredentials: true });
    return response.data;
};

export const deleteNotification = async (notificationId) => {
    const response = await api.delete(`/notifications/${notificationId}`, { withCredentials: true });
    return response.data;
};
