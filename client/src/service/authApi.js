import api from './api';

export const register = async (username, password) => {
    try {
        const response = await api.post('/auth/register', { username, password });
        return response.data;
    } catch (error) {
        throw error;
    }   
}

export const loginUser = async (username, password) => {
  try {
    const response = await api.post(
      '/auth/login',
      { username, password },
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    // 🔒 THIS is where lock handling happens in frontend
    if (error.response?.data?.message) {
      throw { message: error.response.data.message };
    }

    throw { message: 'Login failed' };
  }
};
// export const loginUser = async (username, password) => {
//     try {
//         const response = await api.post('/auth/login', { username, password }, { withCredentials: true });
//         return response.data;
//     } catch (error) {
//         throw error;
//     }   
// }

export const authStatus = async () => {
    try {
        const response = await api.get('/auth/status', { withCredentials: true });
        return response.data;
    } catch (error) {
        throw error;
    }   
}

export const logoutUser = async () => {
    try {
        const response = await api.post('/auth/logout', {}, { withCredentials: true });
        return response.data;
    } catch (error) {
        throw error;
    }   
}

export const setup2fa = async () => {
    try {
        const response = await api.post('/auth/2fa/setup', {}, { withCredentials: true });
        return response.data;
    } catch (error) {
        throw error;
    }   
}

export const verify2fa = async (token) => {
    try {
        const response = await api.post('/auth/2fa/verify', {token}, { withCredentials: true });
        return response.data;
    } catch (error) {
        throw error;
    }   
}

export const reset2fa = async () => {
    try {
        const response = await api.post('/auth/2fa/reset', {}, { withCredentials: true });
        return response.data;
    } catch (error) {
        throw error;
    }   
}

export const skip2faOnboarding = async () => {
    try {
        const response = await api.post('/auth/2fa/skip-onboarding', {}, { withCredentials: true });
        return response.data;
    } catch (error) {
        throw error;
    }
}

export const getLoginChallengeStatus = async (challengeId) => {
    try {
        const response = await api.post('/auth/login/challenge-status', { challengeId }, { withCredentials: true });
        return response.data;
    } catch (error) {
        throw error;
    }
}

export const completeChallengeLogin = async (challengeId, challengeToken) => {
    try {
        const response = await api.post('/auth/login/complete-challenge', { challengeId, challengeToken }, { withCredentials: true });
        return response.data;
    } catch (error) {
        throw error;
    }
}

export const getPendingLoginApprovals = async () => {
    try {
        const response = await api.get('/auth/security/pending-logins', { withCredentials: true });
        return response.data;
    } catch (error) {
        throw error;
    }
}

export const approveLoginRequest = async (challengeId, selectedCode) => {
    try {
        const response = await api.post('/auth/security/approve-login', { challengeId, selectedCode }, { withCredentials: true });
        return response.data;
    } catch (error) {
        throw error;
    }
}

export const rejectLoginRequest = async (challengeId) => {
    try {
        const response = await api.post('/auth/security/reject-login', { challengeId }, { withCredentials: true });
        return response.data;
    } catch (error) {
        throw error;
    }
}

export const getActiveDevices = async () => {
    try {
        const response = await api.get('/auth/security/devices', { withCredentials: true });
        return response.data;
    } catch (error) {
        throw error;
    }
}

export const logoutDeviceById = async (id) => {
    try {
        const response = await api.delete(`/auth/security/devices/${id}`, { withCredentials: true });
        return response.data;
    } catch (error) {
        throw error;
    }
}

export const logoutOtherDevices = async () => {
    try {
        const response = await api.post('/auth/security/logout-others', {}, { withCredentials: true });
        return response.data;
    } catch (error) {
        throw error;
    }
}

export const getActivityLogs = async (limit = 100) => {
    try {
        const response = await api.get(`/auth/security/logs?limit=${limit}`, { withCredentials: true });
        return response.data;
    } catch (error) {
        throw error;
    }
}

export const getAccountProfile = async () => {
    try {
        const response = await api.get('/auth/account/profile', { withCredentials: true });
        return response.data;
    } catch (error) {
        throw error;
    }
}

export const updateAccountProfile = async (payload) => {
    try {
        const response = await api.put('/auth/account/profile', payload, { withCredentials: true });
        return response.data;
    } catch (error) {
        throw error;
    }
}

export const requestEmailOtp = async (email) => {
    try {
        const response = await api.post('/auth/account/email/request-otp', { email }, { withCredentials: true });
        return response.data;
    } catch (error) {
        throw error;
    }
}

export const verifyEmailOtp = async (email, otp) => {
    try {
        const response = await api.post('/auth/account/email/verify-otp', { email, otp }, { withCredentials: true });
        return response.data;
    } catch (error) {
        throw error;
    }
}

export const requestPhoneOtp = async (phone) => {
    try {
        const response = await api.post('/auth/account/phone/request-otp', { phone }, { withCredentials: true });
        return response.data;
    } catch (error) {
        throw error;
    }
}

export const verifyPhoneOtp = async (phone, otp) => {
    try {
        const response = await api.post('/auth/account/phone/verify-otp', { phone, otp }, { withCredentials: true });
        return response.data;
    } catch (error) {
        throw error;
    }
}

export const changeAccountPassword = async (currentPassword, newPassword) => {
    try {
        const response = await api.put('/auth/account/password', { currentPassword, newPassword }, { withCredentials: true });
        return response.data;
    } catch (error) {
        throw error;
    }
}

export const getNotificationPreferences = async () => {
    try {
        const response = await api.get('/auth/account/notification-preferences', { withCredentials: true });
        return response.data;
    } catch (error) {
        throw error;
    }
}

export const updateNotificationPreferences = async (notificationPreferences) => {
    try {
        const response = await api.put('/auth/account/notification-preferences', { notificationPreferences }, { withCredentials: true });
        return response.data;
    } catch (error) {
        throw error;
    }
}

