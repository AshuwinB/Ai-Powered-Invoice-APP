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

