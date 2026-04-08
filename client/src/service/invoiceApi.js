import api from './api.js';

export const getDashboardStreamUrl = () => `${api.defaults.baseURL}/invoices/dashboard-stream`;
export const getCheckoutInvoicePdfUrl = (sessionId) => `${api.defaults.baseURL}/invoices/checkout/session/${encodeURIComponent(sessionId)}/pdf`;

export const invoiceApi = {
    getInvoices: () => api.get('/invoices'),
    getCheckoutSessionStatus: (sessionId) => api.get(`/invoices/checkout/session/${sessionId}`),
    sendCheckoutPaymentConfirmationEmail: (sessionId) => api.post(`/invoices/checkout/session/${sessionId}/send-confirmation-email`),
    requestCheckoutRefund: (sessionId) => api.post(`/invoices/checkout/session/${sessionId}/request-refund`),
    getInvoice: (id) => api.get(`/invoices/${id}`),
    createInvoice: (data, options = {}) => {
        const cloneFrom = options?.cloneFrom ? `?cloneFrom=${encodeURIComponent(options.cloneFrom)}` : '';
        return api.post(`/invoices${cloneFrom}`, data);
    },
    updateInvoice: (id, data) => api.put(`/invoices/${id}`, data),
    bulkUpdateInvoiceStatus: (ids, status) => api.patch('/invoices/bulk-status', { ids, status }),
    bulkDeleteInvoices: (ids) => api.delete('/invoices/bulk-delete', { data: { ids } }),
    deleteInvoice: (id) => api.delete(`/invoices/${id}`),
    getInvoiceStats: () => api.get('/invoices/stats'),
    getRecentInvoices: (limit = 5) => api.get(`/invoices/recent?limit=${limit}`),
    get24hRevenue: () => api.get('/invoices/stats/24h'),
    getRecentTransactions: (limit = 10) => api.get(`/invoices/transactions/recent?limit=${limit}`),
    getTransactionDetails: (transactionId) => api.get(`/invoices/transactions/${transactionId}`),
    downloadInvoicePDF: (id) => api.get(`/invoices/${id}/pdf`, { responseType: 'blob' }),
    sendInvoiceEmail: (id, emailData) => api.post(`/invoices/${id}/send-email`, emailData),
    approveInvoiceRefund: (id) => api.post(`/invoices/${id}/refund/approve`),
    generateInvoiceFromAI: (prompt) => api.post('/invoices/ai-generate', { prompt })
};

export const settingsApi = {
    getSettings: () => api.get('/settings'),
    updateSettings: (data) => api.put('/settings', data)
};