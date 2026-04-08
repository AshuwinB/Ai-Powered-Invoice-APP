const { Router } = require('express');
const { isAuthenticated } = require('../middleware/auth');
const {
    getInvoices,
    streamDashboardUpdates,
    getInvoice,
    createInvoice,
    updateInvoice,
    bulkUpdateInvoiceStatus,
    bulkDeleteInvoices,
    deleteInvoice,
    getInvoiceStats,
    getRecentInvoices,
    get24hRevenue,
    getRecentTransactions,
    getTransactionDetails,
    getCheckoutSessionStatus,
    requestCheckoutRefund,
    approveInvoiceRefund,
    sendCheckoutPaymentConfirmationEmail,
    downloadCheckoutInvoicePDF,
    downloadInvoicePDF,
    previewPDF,
    sendInvoiceEmail
} = require('../controllers/invoiceController');
const { generateInvoiceFromAI } = require('../controllers/aiController');

const router = Router();

// AI draft generation is stateless and does not access user invoice data.
// Keep this route outside auth middleware to avoid session-related 401 errors in the modal flow.
router.post('/ai-generate', generateInvoiceFromAI);
router.get('/checkout/session/:sessionId', getCheckoutSessionStatus);
router.get('/checkout/session/:sessionId/pdf', downloadCheckoutInvoicePDF);
router.post('/checkout/session/:sessionId/send-confirmation-email', sendCheckoutPaymentConfirmationEmail);
router.post('/checkout/session/:sessionId/request-refund', requestCheckoutRefund);

// All invoice data routes require authentication
router.use(isAuthenticated);

router.get('/', getInvoices);
router.get('/stats', getInvoiceStats);
router.get('/dashboard-stream', streamDashboardUpdates);
router.get('/recent', getRecentInvoices);
router.get('/stats/24h', get24hRevenue);
router.get('/transactions/recent', getRecentTransactions);
router.get('/transactions/:transactionId', getTransactionDetails);
router.patch('/bulk-status', bulkUpdateInvoiceStatus);
router.delete('/bulk-delete', bulkDeleteInvoices);
router.get('/:id', getInvoice);
router.get('/:id/pdf', downloadInvoicePDF);
router.post('/preview-pdf', previewPDF);
router.post('/:id/send-email', sendInvoiceEmail);
router.post('/:id/refund/approve', approveInvoiceRefund);
router.post('/', createInvoice);
router.put('/:id', updateInvoice);
router.delete('/:id', deleteInvoice);

module.exports = router;