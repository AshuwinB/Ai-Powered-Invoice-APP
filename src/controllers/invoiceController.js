const Invoice = require('../models/Invoice');
const Notification = require('../models/Notification');
const Settings = require('../models/Settings');
const { generateInvoicePDF } = require('../utils/pdfGenerator');
const { sendInvoiceEmail: sendEmailService } = require('../utils/emailService');
const { createPaymentLink, generateQRCode, stripe } = require('../utils/stripeService');
const { logActivity } = require('../utils/activityLogger');
const { createUserNotification } = require('../utils/notificationService');
const { registerDashboardClient, publishDashboardUpdate } = require('../utils/dashboardRealtime');

const normalizeInvoiceStatus = (value) => {
    const status = String(value || 'UNPAID').toUpperCase();
    return ['PAID', 'UNPAID', 'CANCEL'].includes(status) ? status : 'UNPAID';
};

const sanitizeAndValidateInvoicePayload = (payload) => {
    const {
        _id,
        userId,
        createdAt,
        updatedAt,
        __v,
        payment_confirmation_email_sent_at,
        refund_status,
        refund_requested_at,
        refund_requested_by_email,
        refund_approved_at,
        refund_approved_by_user_id,
        stripe_refund_id,
        ...safePayload
    } = payload || {};

    const invoiceDate = new Date(safePayload.invoice_date);
    const dueDate = new Date(safePayload.due_date);

    if (Number.isNaN(invoiceDate.getTime()) || Number.isNaN(dueDate.getTime())) {
        return { error: 'Invoice date and due date are required and must be valid dates.' };
    }

    if (dueDate < invoiceDate) {
        return { error: 'Due date must be on or after invoice date.' };
    }

    const rawItems = Array.isArray(safePayload.items) ? safePayload.items : [];
    if (rawItems.length === 0) {
        return { error: 'At least one invoice item is required.' };
    }

    const sanitizedItems = rawItems.map((item) => {
        const quantity = Number(item.quantity || 0);
        const price = Number(item.price || 0);
        const itemName = String(item.item_name || '').trim();
        return {
            item_name: itemName,
            quantity,
            price,
            total: Number((quantity * price).toFixed(2)),
        };
    });

    const invalidItem = sanitizedItems.find((item) => !item.item_name || item.quantity <= 0 || item.price < 0);
    if (invalidItem) {
        return { error: 'Each item must include a name, quantity greater than 0, and non-negative price.' };
    }

    const subTotal = Number(sanitizedItems.reduce((sum, item) => sum + item.total, 0).toFixed(2));
    const discount = Number(safePayload.discount || 0);
    const taxPercentage = Number(safePayload.tax_percentage || 0);

    if (discount < 0) {
        return { error: 'Discount cannot be negative.' };
    }

    if (discount > subTotal) {
        return { error: 'Discount cannot be greater than subtotal.' };
    }

    if (taxPercentage < 0) {
        return { error: 'Tax percentage cannot be negative.' };
    }

    const taxableAmount = subTotal - discount;
    const taxAmount = Number(((taxableAmount * taxPercentage) / 100).toFixed(2));
    const total = Number((taxableAmount + taxAmount).toFixed(2));

    if (total <= 0) {
        return { error: 'Invoice total must be greater than 0.' };
    }

    return {
        data: {
            ...safePayload,
            invoice_date: invoiceDate,
            due_date: dueDate,
            items: sanitizedItems,
            sub_total: subTotal,
            discount,
            tax_percentage: taxPercentage,
            total,
            status: normalizeInvoiceStatus(safePayload.status),
        },
    };
};

const getInvoices = async (req, res) => {
    try {
        const invoices = await Invoice.find({ userId: req.user._id }).sort({ createdAt: -1 });
        res.status(200).json(invoices);
    } catch (error) {
        console.error('Error fetching invoices:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const streamDashboardUpdates = async (req, res) => {
    try {
        registerDashboardClient({ userId: req.user._id, res });
    } catch (error) {
        console.error('Error opening dashboard stream:', error);
        if (!res.headersSent) {
            res.status(500).json({ message: 'Unable to open dashboard stream.' });
        }
    }
};

const getInvoice = async (req, res) => {
    try {
        const invoice = await Invoice.findOne({
            _id: req.params.id,
            userId: req.user._id
        });

        if (!invoice) {
            return res.status(404).json({ message: 'Invoice not found' });
        }

        res.status(200).json(invoice);
    } catch (error) {
        console.error('Error fetching invoice:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const createInvoice = async (req, res) => {
    try {
        const cloneFrom = String(req.query?.cloneFrom || '').trim();
        const validation = sanitizeAndValidateInvoicePayload(req.body || {});
        if (validation.error) {
            return res.status(400).json({ message: validation.error });
        }

        const invoiceData = {
            ...validation.data,
            userId: req.user._id
        };

        const invoice = new Invoice(invoiceData);
        await invoice.save();

        // Create payment link and QR code
        try {
            const paymentResult = await createPaymentLink(invoice);
            console.log('Stripe payment result:', paymentResult);
            const { payment_link, payment_id } = paymentResult;

            invoice.payment_link = payment_link;
            invoice.payment_id = payment_id;
            invoice.qr_code = payment_link ? await generateQRCode(payment_link) : null;
            await invoice.save();
        } catch (paymentError) {
            console.error('Error creating payment link:', paymentError);
            // Don't fail invoice creation if payment link fails
        }

        await logActivity({
            userId: req.user._id,
            action: 'INVOICE_CREATED',
            category: 'invoice',
            details: `Created invoice ${invoice.invoice_no}`,
            metadata: {
                invoiceId: invoice._id,
                invoiceNo: invoice.invoice_no,
                total: invoice.total,
                currency: invoice.currency,
                status: invoice.status,
            },
            req,
        });

        await createUserNotification({
            userId: req.user._id,
            eventKey: 'invoice',
            notificationType: 'invoice-new-created',
            title: 'New Invoice created',
            message: `Invoice ${invoice.invoice_no} was created for ${invoice.total} ${invoice.currency || 'USD'}.`,
            type: 'success',
            category: 'invoice',
            actionUrl: `/invoices/${invoice._id}`,
            metadata: { invoiceId: invoice._id, invoiceNo: invoice.invoice_no },
        });

        publishDashboardUpdate(req.user._id, { source: 'invoice-created', invoiceId: invoice._id });

        if (cloneFrom) {
            await logActivity({
                userId: req.user._id,
                action: 'INVOICE_DUPLICATED',
                category: 'invoice',
                details: `Duplicated invoice ${cloneFrom} into ${invoice.invoice_no}`,
                metadata: { sourceInvoiceId: cloneFrom, invoiceId: invoice._id, invoiceNo: invoice.invoice_no },
                req,
            });
        }

        res.status(201).json(invoice);
    } catch (error) {
        console.error('Error creating invoice:', error);
        if (error?.name === 'ValidationError') {
            const fields = Object.keys(error.errors || {});
            return res.status(400).json({
                message: 'Invoice validation failed. Please complete required fields.',
                fields
            });
        }
        res.status(500).json({ message: 'Server error' });
    }
};

const updateInvoice = async (req, res) => {
    try {
        const validation = sanitizeAndValidateInvoicePayload(req.body || {});
        if (validation.error) {
            return res.status(400).json({ message: validation.error });
        }

        const invoice = await Invoice.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            validation.data,
            { new: true }
        );

        if (!invoice) {
            return res.status(404).json({ message: 'Invoice not found' });
        }

        await logActivity({
            userId: req.user._id,
            action: 'INVOICE_UPDATED',
            category: 'invoice',
            details: `Updated invoice ${invoice.invoice_no}`,
            metadata: { invoiceId: invoice._id, invoiceNo: invoice.invoice_no },
            req,
        });

        await createUserNotification({
            userId: req.user._id,
            eventKey: 'invoice',
            title: 'Invoice updated',
            message: `Invoice ${invoice.invoice_no} was updated.`,
            type: 'info',
            category: 'invoice',
            actionUrl: `/invoices/${invoice._id}`,
            metadata: { invoiceId: invoice._id, invoiceNo: invoice.invoice_no },
        });

        publishDashboardUpdate(req.user._id, { source: 'invoice-updated', invoiceId: invoice._id });

        res.status(200).json(invoice);
    } catch (error) {
        console.error('Error updating invoice:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const bulkUpdateInvoiceStatus = async (req, res) => {
    try {
        const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
        const requestedStatus = String(req.body?.status || '').toUpperCase();
        const allowedStatuses = ['PAID', 'UNPAID', 'CANCEL'];

        if (!ids.length) {
            return res.status(400).json({ message: 'Select at least one invoice to update.' });
        }

        if (!allowedStatuses.includes(requestedStatus)) {
            return res.status(400).json({ message: 'Invalid status. Use PAID, UNPAID, or CANCEL.' });
        }

        const result = await Invoice.updateMany(
            { _id: { $in: ids }, userId: req.user._id },
            { status: requestedStatus }
        );

        await logActivity({
            userId: req.user._id,
            action: 'INVOICE_BULK_STATUS_UPDATED',
            category: 'invoice',
            details: `Updated ${result.modifiedCount || 0} invoice(s) to ${requestedStatus}`,
            metadata: { ids, status: requestedStatus, modifiedCount: result.modifiedCount || 0 },
            req,
        });

        await createUserNotification({
            userId: req.user._id,
            eventKey: 'invoice',
            title: 'Bulk status updated',
            message: `${result.modifiedCount || 0} invoice(s) moved to ${requestedStatus}.`,
            type: 'info',
            category: 'invoice',
            actionUrl: '/invoices',
            metadata: { status: requestedStatus, count: result.modifiedCount || 0 },
        });

        publishDashboardUpdate(req.user._id, { source: 'invoice-bulk-status-updated' });

        return res.status(200).json({
            message: 'Invoice statuses updated successfully',
            matchedCount: result.matchedCount || 0,
            modifiedCount: result.modifiedCount || 0,
            status: requestedStatus,
        });
    } catch (error) {
        console.error('Error updating invoice statuses in bulk:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};

const bulkDeleteInvoices = async (req, res) => {
    try {
        const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];

        if (!ids.length) {
            return res.status(400).json({ message: 'Select at least one invoice to delete.' });
        }

        const targetInvoices = await Invoice.find({ _id: { $in: ids }, userId: req.user._id }).select('_id invoice_no');
        if (!targetInvoices.length) {
            return res.status(404).json({ message: 'No matching invoices found for deletion.' });
        }

        const result = await Invoice.deleteMany({
            _id: { $in: targetInvoices.map((item) => item._id) },
            userId: req.user._id,
        });

        await logActivity({
            userId: req.user._id,
            action: 'INVOICE_BULK_DELETED',
            category: 'invoice',
            details: `Deleted ${result.deletedCount || 0} invoice(s) in bulk`,
            metadata: {
                ids: targetInvoices.map((item) => item._id),
                invoiceNumbers: targetInvoices.map((item) => item.invoice_no),
                deletedCount: result.deletedCount || 0,
            },
            req,
        });

        await createUserNotification({
            userId: req.user._id,
            eventKey: 'invoice',
            title: 'Bulk delete completed',
            message: `${result.deletedCount || 0} invoice(s) were deleted.`,
            type: 'warning',
            category: 'invoice',
            actionUrl: '/invoices',
            metadata: { deletedCount: result.deletedCount || 0 },
        });

        publishDashboardUpdate(req.user._id, { source: 'invoice-bulk-deleted' });

        return res.status(200).json({
            message: 'Invoices deleted successfully',
            deletedCount: result.deletedCount || 0,
            deletedIds: targetInvoices.map((item) => item._id),
        });
    } catch (error) {
        console.error('Error deleting invoices in bulk:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};

const deleteInvoice = async (req, res) => {
    try {
        const invoice = await Invoice.findOneAndDelete({
            _id: req.params.id,
            userId: req.user._id
        });

        if (!invoice) {
            return res.status(404).json({ message: 'Invoice not found' });
        }

        await logActivity({
            userId: req.user._id,
            action: 'INVOICE_DELETED',
            category: 'invoice',
            details: `Deleted invoice ${invoice.invoice_no}`,
            metadata: { invoiceId: invoice._id, invoiceNo: invoice.invoice_no },
            req,
        });

        await createUserNotification({
            userId: req.user._id,
            eventKey: 'invoice',
            title: 'Invoice deleted',
            message: `Invoice ${invoice.invoice_no} was deleted.`,
            type: 'warning',
            category: 'invoice',
            actionUrl: '/invoices',
            metadata: { invoiceId: invoice._id, invoiceNo: invoice.invoice_no },
        });

        publishDashboardUpdate(req.user._id, { source: 'invoice-deleted', invoiceId: invoice._id });

        res.status(200).json({ message: 'Invoice deleted successfully' });
    } catch (error) {
        console.error('Error deleting invoice:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const getInvoiceStats = async (req, res) => {
    try {
        const userId = req.user._id;

        const totalInvoices = await Invoice.countDocuments({ userId });
        const paidInvoices = await Invoice.countDocuments({ userId, status: 'PAID' });
        const unpaidInvoices = await Invoice.countDocuments({ userId, status: 'UNPAID' });
        const cancelledInvoices = await Invoice.countDocuments({ userId, status: 'CANCEL' });

        const totalRevenue = await Invoice.aggregate([
            { $match: { userId, status: 'PAID' } },
            { $group: { _id: null, total: { $sum: '$total' } } }
        ]);

        const revenue = totalRevenue.length > 0 ? totalRevenue[0].total : 0;

        res.status(200).json({
            totalInvoices,
            paidInvoices,
            unpaidInvoices,
            cancelledInvoices,
            totalRevenue: revenue
        });
    } catch (error) {
        console.error('Error fetching invoice stats:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const downloadInvoicePDF = async (req, res) => {
    try {
        const invoice = await Invoice.findOne({
            _id: req.params.id,
            userId: req.user._id
        });

        if (!invoice) {
            return res.status(404).json({ message: 'Invoice not found' });
        }

        // Fetch user settings for PDF customization
        const settings = await Settings.findOne({ userId: req.user._id }) || {};

        const pdfBuffer = await generateInvoicePDF(invoice, settings);

        await logActivity({
            userId: req.user._id,
            action: 'INVOICE_DOWNLOADED',
            category: 'invoice',
            details: `Downloaded PDF for invoice ${invoice.invoice_no}`,
            metadata: { invoiceId: invoice._id, invoiceNo: invoice.invoice_no },
            req,
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=invoice-${invoice.invoice_no}.pdf`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const previewPDF = async (req, res) => {
    try {
        const { invoice, settings } = req.body;

        if (!invoice) {
            return res.status(400).json({ message: 'Invoice data is required' });
        }

        const pdfBuffer = await generateInvoicePDF(invoice, settings || {});

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename=preview.pdf');
        res.send(pdfBuffer);
    } catch (error) {
        console.error('Error generating PDF preview:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const sendInvoiceEmail = async (req, res) => {
    try {
        const { id } = req.params;
        const { recipientEmail, subject, message } = req.body;

        const invoice = await Invoice.findOne({
            _id: id,
            userId: req.user._id
        });

        if (!invoice) {
            return res.status(404).json({ message: 'Invoice not found' });
        }

        if (!recipientEmail) {
            return res.status(400).json({ message: 'Recipient email is required' });
        }

        // Fetch user settings for PDF customization
        const settings = await Settings.findOne({ userId: req.user._id }) || {};

        const result = await sendEmailService(invoice, recipientEmail, subject, message, settings);

        await logActivity({
            userId: req.user._id,
            action: 'INVOICE_EMAIL_SENT',
            category: 'email',
            details: `Sent invoice ${invoice.invoice_no} to ${recipientEmail}`,
            metadata: {
                invoiceId: invoice._id,
                invoiceNo: invoice.invoice_no,
                recipientEmail,
                messageId: result.messageId,
            },
            req,
        });

        await createUserNotification({
            userId: req.user._id,
            eventKey: 'invoice',
            title: 'Invoice emailed',
            message: `Invoice ${invoice.invoice_no} was emailed to ${recipientEmail}.`,
            type: 'info',
            category: 'invoice',
            actionUrl: `/invoices/${invoice._id}`,
            metadata: { invoiceId: invoice._id, invoiceNo: invoice.invoice_no, recipientEmail },
        });

        res.status(200).json({
            message: 'Invoice sent successfully',
            messageId: result.messageId
        });
    } catch (error) {
        console.error('Error sending invoice email:', error);
        const errorMessage = error.message || 'Failed to send email';
        
        // Return more specific error messages
        if (errorMessage.includes('Invalid credentials')) {
            return res.status(500).json({ message: 'Invalid SMTP credentials. Check your .env file.' });
        }
        if (errorMessage.includes('not configured')) {
            return res.status(500).json({ message: 'SMTP not configured. Set SMTP_USER and SMTP_PASS in .env' });
        }
        if (errorMessage.includes('connect')) {
            return res.status(500).json({ message: 'Cannot connect to SMTP server. Check host/port' });
        }
        
        res.status(500).json({ message: errorMessage });
    }
};

const getRecentInvoices = async (req, res) => {
    try {
        const { limit = 5 } = req.query;
        const recent = await Invoice.find({ userId: req.user._id })
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .select('invoice_no status total invoice_date payment_link createdAt');
        res.status(200).json(recent);
    } catch (error) {
        console.error('Error fetching recent invoices:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const get24hRevenue = async (req, res) => {
    try {
        const userId = req.user._id;
        const now = new Date();
        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        const paidInvoices = await Invoice.find({
            userId,
            status: 'PAID',
            createdAt: { $gte: twentyFourHoursAgo }
        }).select('total createdAt');

        const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
        const toIstShifted = (dateValue) => new Date(new Date(dateValue).getTime() + IST_OFFSET_MS);
        const toHourKey = (dateValue) => {
            const shifted = toIstShifted(dateValue);
            return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')} ${String(shifted.getUTCHours()).padStart(2, '0')}:00`;
        };

        const revenueByHour = {};
        for (const invoice of paidInvoices) {
            const key = toHourKey(invoice.createdAt);
            revenueByHour[key] = (revenueByHour[key] || 0) + Number(invoice.total || 0);
        }

        const nowIstShifted = toIstShifted(now);
        nowIstShifted.setUTCMinutes(0, 0, 0);

        const chartData = [];
        for (let i = 23; i >= 0; i--) {
            const slot = new Date(nowIstShifted.getTime() - i * 60 * 60 * 1000);
            const key = `${slot.getUTCFullYear()}-${String(slot.getUTCMonth() + 1).padStart(2, '0')}-${String(slot.getUTCDate()).padStart(2, '0')} ${String(slot.getUTCHours()).padStart(2, '0')}:00`;
            const label = `${String(slot.getUTCDate()).padStart(2, '0')}/${String(slot.getUTCMonth() + 1).padStart(2, '0')} ${String(slot.getUTCHours()).padStart(2, '0')}:00`;
            chartData.push({
                slot: key,
                label,
                revenue: Number((revenueByHour[key] || 0).toFixed(2))
            });
        }

        res.status(200).json(chartData);
    } catch (error) {
        console.error('Error fetching 24h revenue:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const getRecentTransactions = async (req, res) => {
    try {
        const { limit = 10 } = req.query;
        const invoices = await Invoice.find({
            userId: req.user._id,
            payment_id: { $ne: null },
            payment_link: { $ne: null }
        })
            .sort({ createdAt: -1 })
            .limit(parseInt(limit, 10));

        const transactions = await Promise.all(invoices.map(async (invoice) => {
            let session = null;
            try {
                session = await stripe.checkout.sessions.retrieve(invoice.payment_id);
            } catch (error) {
                console.warn(`Unable to fetch Stripe session for ${invoice.payment_id}:`, error.message);
            }

            const amount = session?.amount_total != null ? session.amount_total / 100 : invoice.total;
            const basePaymentStatus = session?.payment_status || (invoice.status === 'PAID' ? 'paid' : 'unpaid');
            const paymentStatus = invoice.refund_status === 'APPROVED' ? 'refunded' : basePaymentStatus;
            const paymentMethod = session?.payment_method_types?.[0] || 'card';
            const customer = session?.customer_details?.name || invoice.to?.name || 'Customer';
            const customerEmail = session?.customer_details?.email || invoice.to?.email || '';
            const date = session?.created ? new Date(session.created * 1000) : invoice.createdAt;

            return {
                id: invoice.payment_id,
                invoiceId: invoice._id,
                invoiceNo: invoice.invoice_no,
                amount,
                currency: (invoice.currency || 'usd').toUpperCase(),
                paymentStatus,
                refundStatus: invoice.refund_status || 'NONE',
                refundApprovedAt: invoice.refund_approved_at || null,
                paymentMethod,
                description: `Invoice ${invoice.invoice_no}`,
                customer,
                customerEmail,
                date
            };
        }));

        transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        res.status(200).json(transactions);
    } catch (error) {
        console.error('Error fetching recent transactions:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const getTransactionDetails = async (req, res) => {
    try {
        const { transactionId } = req.params;
        const invoice = await Invoice.findOne({ payment_id: transactionId, userId: req.user._id });

        if (!invoice) {
            return res.status(404).json({ message: 'Transaction not found' });
        }

        let session = null;
        let lineItems = { data: [] };
        try {
            session = await stripe.checkout.sessions.retrieve(transactionId);
            lineItems = await stripe.checkout.sessions.listLineItems(transactionId, { limit: 20 });
        } catch (error) {
            console.warn(`Unable to fetch Stripe session details for ${transactionId}:`, error.message);
        }

        const amount = session?.amount_total != null ? session.amount_total / 100 : invoice.total;
        const basePaymentStatus = session?.payment_status || (invoice.status === 'PAID' ? 'paid' : 'unpaid');
        const paymentStatus = invoice.refund_status === 'APPROVED' ? 'refunded' : basePaymentStatus;
        const paymentMethod = session?.payment_method_types?.[0] || 'card';
        const customer = session?.customer_details?.name || invoice.to?.name || 'Customer';
        const customerEmail = session?.customer_details?.email || invoice.to?.email || '';
        const date = session?.created ? new Date(session.created * 1000) : invoice.createdAt;

        const recentActivity = [
            {
                title: 'Checkout session created',
                time: invoice.createdAt,
                status: 'created'
            },
            {
                title: paymentStatus === 'paid' ? 'Payment completed' : 'Payment pending',
                time: date,
                status: paymentStatus
            }
        ];

        if (invoice.refund_status === 'REQUESTED' && invoice.refund_requested_at) {
            recentActivity.push({
                title: 'Refund requested',
                time: invoice.refund_requested_at,
                status: 'requested',
            });
        }

        if (invoice.refund_status === 'APPROVED' && invoice.refund_approved_at) {
            recentActivity.push({
                title: 'Refund approved',
                time: invoice.refund_approved_at,
                status: 'refunded',
            });
        }

        const checkoutSummary = (lineItems.data || []).map((item) => ({
            description: item.description,
            quantity: item.quantity,
            amount: item.amount_total / 100,
            currency: (item.currency || invoice.currency || 'usd').toUpperCase()
        }));

        res.status(200).json({
            id: transactionId,
            amount,
            currency: (invoice.currency || 'usd').toUpperCase(),
            paymentStatus,
            refundStatus: invoice.refund_status || 'NONE',
            paymentMethod,
            description: `Invoice ${invoice.invoice_no}`,
            customer,
            customerEmail,
            date,
            recentActivity,
            checkoutSummary,
            otherDetails: {
                stripeCheckoutSessionId: transactionId,
                invoiceId: invoice._id,
                invoiceNo: invoice.invoice_no,
                billingEmail: customerEmail,
                paymentLink: invoice.payment_link,
                refundApprovedAt: invoice.refund_approved_at || null,
                stripeRefundId: invoice.stripe_refund_id || null,
            }
        });
    } catch (error) {
        console.error('Error fetching transaction details:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const getCheckoutSessionStatus = async (req, res) => {
    try {
        const sessionId = String(req.params.sessionId || '').trim();
        if (!sessionId) {
            return res.status(400).json({ message: 'Checkout session id is required.' });
        }

        const session = await stripe.checkout.sessions.retrieve(sessionId);
        const invoiceIdFromSession = session?.metadata?.invoice_id || null;

        let invoice = null;
        if (invoiceIdFromSession) {
            invoice = await Invoice.findById(invoiceIdFromSession);
        }

        if (!invoice) {
            invoice = await Invoice.findOne({ payment_id: sessionId });
        }

        const paymentStatus = String(session?.payment_status || 'unpaid').toLowerCase();
        const amount = session?.amount_total != null ? session.amount_total / 100 : null;
        const currency = String(session?.currency || invoice?.currency || 'usd').toUpperCase();

        return res.status(200).json({
            id: sessionId,
            paymentStatus,
            amount,
            currency,
            invoiceId: invoice?._id || null,
            invoiceNo: invoice?.invoice_no || null,
            customerEmail: session?.customer_details?.email || invoice?.to?.email || null,
            paymentConfirmationEmailSent: Boolean(invoice?.payment_confirmation_email_sent_at),
            refundStatus: invoice?.refund_status || 'NONE',
            refundRequestedAt: invoice?.refund_requested_at || null,
            refundApprovedAt: invoice?.refund_approved_at || null,
        });
    } catch (error) {
        console.error('Error fetching checkout session status:', error);
        return res.status(500).json({ message: 'Unable to fetch checkout session status.' });
    }
};

const requestCheckoutRefund = async (req, res) => {
    try {
        const sessionId = String(req.params.sessionId || '').trim();
        if (!sessionId) {
            return res.status(400).json({ message: 'Checkout session id is required.' });
        }

        const session = await stripe.checkout.sessions.retrieve(sessionId);
        const paymentStatus = String(session?.payment_status || 'unpaid').toLowerCase();
        if (paymentStatus !== 'paid') {
            return res.status(400).json({ message: 'Refund can be requested only after successful payment.' });
        }

        const invoiceIdFromSession = session?.metadata?.invoice_id || null;
        let invoice = null;

        if (invoiceIdFromSession) {
            invoice = await Invoice.findById(invoiceIdFromSession);
        }
        if (!invoice) {
            invoice = await Invoice.findOne({ payment_id: sessionId });
        }
        if (!invoice) {
            return res.status(404).json({ message: 'Invoice not found for this checkout session.' });
        }

        if (invoice.refund_status === 'REQUESTED') {
            return res.status(200).json({
                message: 'Refund request already submitted and pending approval.',
                alreadyRequested: true,
                refundStatus: invoice.refund_status,
                refundRequestedAt: invoice.refund_requested_at,
            });
        }

        if (invoice.refund_status === 'APPROVED') {
            return res.status(400).json({ message: 'Refund has already been approved for this invoice.' });
        }

        const requesterEmail = session?.customer_details?.email || invoice?.to?.email || null;

        invoice.refund_status = 'REQUESTED';
        invoice.refund_requested_at = new Date();
        invoice.refund_requested_by_email = requesterEmail;
        await invoice.save();

        await createUserNotification({
            userId: invoice.userId,
            eventKey: 'payment',
            notificationType: 'payment-refund-requested',
            title: 'Refund request received',
            message: `Refund requested for invoice ${invoice.invoice_no}.`,
            type: 'warning',
            category: 'payment',
            actionUrl: '/notifications',
            metadata: {
                notificationKind: 'refund-request',
                invoiceId: invoice._id,
                invoiceNo: invoice.invoice_no,
                sessionId,
                requesterEmail,
                requestedAt: invoice.refund_requested_at,
            },
        });

        await logActivity({
            userId: invoice.userId,
            action: 'INVOICE_REFUND_REQUESTED',
            category: 'payment',
            details: `Refund requested for invoice ${invoice.invoice_no}`,
            metadata: {
                invoiceId: invoice._id,
                invoiceNo: invoice.invoice_no,
                requesterEmail,
            },
            req,
        });

        return res.status(200).json({
            message: 'Refund request submitted successfully.',
            refundStatus: invoice.refund_status,
            refundRequestedAt: invoice.refund_requested_at,
        });
    } catch (error) {
        console.error('Error requesting checkout refund:', error);
        return res.status(500).json({ message: 'Unable to submit refund request.' });
    }
};

const approveInvoiceRefund = async (req, res) => {
    try {
        const invoice = await Invoice.findOne({ _id: req.params.id, userId: req.user._id });
        if (!invoice) {
            return res.status(404).json({ message: 'Invoice not found' });
        }

        if (!invoice.payment_id) {
            return res.status(400).json({ message: 'No Stripe checkout session found for this invoice.' });
        }

        if (invoice.refund_status !== 'REQUESTED') {
            return res.status(400).json({ message: 'Refund can only be approved when status is REQUESTED.' });
        }

        const session = await stripe.checkout.sessions.retrieve(invoice.payment_id);
        const paymentIntentId = typeof session?.payment_intent === 'string'
            ? session.payment_intent
            : session?.payment_intent?.id;

        if (!paymentIntentId) {
            return res.status(400).json({ message: 'Payment intent not found for this checkout session.' });
        }

        const refund = await stripe.refunds.create({
            payment_intent: paymentIntentId,
            reason: 'requested_by_customer',
            metadata: {
                invoice_id: invoice._id.toString(),
                invoice_no: invoice.invoice_no,
            },
        });

        invoice.refund_status = 'APPROVED';
        invoice.refund_approved_at = new Date();
        invoice.refund_approved_by_user_id = req.user._id;
        invoice.stripe_refund_id = refund.id;
        invoice.status = 'CANCEL';
        await invoice.save();

        const requesterEmail = invoice.refund_requested_by_email || session?.customer_details?.email || invoice?.to?.email;
        if (requesterEmail) {
            const settings = await Settings.findOne({ userId: invoice.userId }) || {};
            const refundMessage = `
              <h2>Refund Approved</h2>
              <p>Your refund request for <strong>Invoice ${invoice.invoice_no}</strong> has been approved.</p>
              <p>Refund amount: <strong>${invoice.total.toFixed(2)} ${invoice.currency}</strong>.</p>
              <p>The refund has been initiated to your original payment method.</p>
            `;

            await sendEmailService(
                invoice,
                requesterEmail,
                `Refund Approved - Invoice ${invoice.invoice_no}`,
                refundMessage,
                settings
            );
        }

        await Notification.updateMany(
            {
                userId: req.user._id,
                'metadata.notificationKind': 'refund-request',
                'metadata.invoiceId': invoice._id,
            },
            {
                isRead: true,
                readAt: new Date(),
                'metadata.resolvedAt': new Date().toISOString(),
                'metadata.resolutionStatus': 'approved',
            }
        );

        await createUserNotification({
            userId: req.user._id,
            eventKey: 'payment',
            notificationType: 'payment-refund-approved',
            title: 'Refund approved',
            message: `Refund approved for invoice ${invoice.invoice_no}.`,
            type: 'success',
            category: 'payment',
            actionUrl: `/invoices/${invoice._id}`,
            metadata: {
                notificationKind: 'refund-approved',
                invoiceId: invoice._id,
                invoiceNo: invoice.invoice_no,
                stripeRefundId: refund.id,
            },
        });

        await logActivity({
            userId: req.user._id,
            action: 'INVOICE_REFUND_APPROVED',
            category: 'payment',
            details: `Refund approved for invoice ${invoice.invoice_no}`,
            metadata: {
                invoiceId: invoice._id,
                invoiceNo: invoice.invoice_no,
                stripeRefundId: refund.id,
            },
            req,
        });

        return res.status(200).json({
            message: 'Refund approved and initiated successfully.',
            refundStatus: invoice.refund_status,
            stripeRefundId: refund.id,
        });
    } catch (error) {
        console.error('Error approving invoice refund:', error);
        return res.status(500).json({ message: 'Unable to approve refund.' });
    }
};

const sendCheckoutPaymentConfirmationEmail = async (req, res) => {
    try {
        const sessionId = String(req.params.sessionId || '').trim();
        if (!sessionId) {
            return res.status(400).json({ message: 'Checkout session id is required.' });
        }

        const session = await stripe.checkout.sessions.retrieve(sessionId);
        const paymentStatus = String(session?.payment_status || 'unpaid').toLowerCase();

        const invoiceIdFromSession = session?.metadata?.invoice_id || null;
        let invoice = null;

        if (invoiceIdFromSession) {
            invoice = await Invoice.findById(invoiceIdFromSession);
        }

        if (!invoice) {
            invoice = await Invoice.findOne({ payment_id: sessionId });
        }

        if (!invoice) {
            return res.status(404).json({ message: 'Invoice not found for this checkout session.' });
        }

        if (paymentStatus !== 'paid' && invoice.status !== 'PAID') {
            return res.status(400).json({ message: 'Payment is not completed yet.' });
        }

        if (invoice.payment_confirmation_email_sent_at) {
            return res.status(200).json({
                message: 'Payment confirmation email was already sent.',
                alreadySent: true,
                sentAt: invoice.payment_confirmation_email_sent_at,
            });
        }

        const recipientEmail = session?.customer_details?.email || invoice?.to?.email;
        if (!recipientEmail) {
            return res.status(400).json({ message: 'Customer email is unavailable for this checkout session.' });
        }

        const settings = await Settings.findOne({ userId: invoice.userId }) || {};
        const paidMessage = `
          <h2>Payment Confirmed</h2>
          <p>Thank you for your payment of <strong>${invoice.total.toFixed(2)} ${invoice.currency}</strong>.</p>
          <p>Invoice ${invoice.invoice_no} has been marked as PAID.</p>
          <p>Your receipt is attached to this email.</p>
        `;

        await sendEmailService(
            invoice,
            recipientEmail,
            `Payment Confirmation - Invoice ${invoice.invoice_no}`,
            paidMessage,
            settings
        );

        invoice.payment_confirmation_email_sent_at = new Date();
        await invoice.save();

        return res.status(200).json({
            message: 'Payment confirmation email sent successfully.',
            sentAt: invoice.payment_confirmation_email_sent_at,
            recipientEmail,
        });
    } catch (error) {
        console.error('Error sending checkout payment confirmation email:', error);
        return res.status(500).json({ message: 'Unable to send payment confirmation email.' });
    }
};

const downloadCheckoutInvoicePDF = async (req, res) => {
    try {
        const sessionId = String(req.params.sessionId || '').trim();
        if (!sessionId) {
            return res.status(400).json({ message: 'Checkout session id is required.' });
        }

        const session = await stripe.checkout.sessions.retrieve(sessionId);
        const paymentStatus = String(session?.payment_status || 'unpaid').toLowerCase();

        const invoiceIdFromSession = session?.metadata?.invoice_id || null;
        let invoice = null;

        if (invoiceIdFromSession) {
            invoice = await Invoice.findById(invoiceIdFromSession);
        }

        if (!invoice) {
            invoice = await Invoice.findOne({ payment_id: sessionId });
        }

        if (!invoice) {
            return res.status(404).json({ message: 'Invoice not found for this checkout session.' });
        }

        if (paymentStatus !== 'paid' && invoice.status !== 'PAID') {
            return res.status(400).json({ message: 'Invoice PDF is available after payment is completed.' });
        }

        const settings = await Settings.findOne({ userId: invoice.userId }) || {};
        const pdfBuffer = await generateInvoicePDF(invoice, settings);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=invoice-${invoice.invoice_no}.pdf`);
        return res.send(pdfBuffer);
    } catch (error) {
        console.error('Error downloading checkout invoice PDF:', error);
        return res.status(500).json({ message: 'Unable to download invoice PDF.' });
    }
};

module.exports = {
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
};
