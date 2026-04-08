const Invoice = require('../models/Invoice');
const { constructEvent } = require('../utils/stripeService');
const { logActivity } = require('../utils/activityLogger');
const { createUserNotification } = require('../utils/notificationService');
const { publishDashboardUpdate } = require('../utils/dashboardRealtime');

const handleStripeWebhook = async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
        event = constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
case 'checkout.session.completed':
            const session = event.data.object;
            await handlePaymentSuccess(session);
            break;
        case 'invoice.payment_succeeded':
            const invoiceEvent = event.data.object;
            await handlePaymentSuccess(invoiceEvent, true);
            break;
        case 'payment_intent.requires_action':
            console.log('Payment requires action (3DS)');
            break;
        case 'payment_intent.created':
            console.log('Payment intent created');
            break;
        case 'payment_intent.payment_failed':
            console.log('Payment failed:', event.data.object.last_payment_error);
            break;
        case 'payment_intent.succeeded':
            const pi = event.data.object;
            console.log('PI succeeded, metadata:', pi.metadata);
            await handlePaymentSuccess(pi);
            break;
        case 'charge.succeeded':
            const charge = event.data.object;
            console.log('Charge succeeded, metadata:', charge.metadata);
            await handlePaymentSuccess(charge);
            break;
        default:
            console.log(`Unhandled event type ${event.type}`);
    }


    res.json({ received: true });
};

const handlePaymentSuccess = async (paymentObject, isInvoice = false) => {
    try {
        console.log('DEBUG Payment object:', {
            type: isInvoice ? 'invoice' : 'session/pi/charge',
            id: paymentObject.id,
            metadata: paymentObject.metadata
        });
        const invoiceId = paymentObject.metadata?.invoice_id || paymentObject.metadata?.invoiceId || paymentObject.id;
        if (!invoiceId) {
            console.error('No invoice_id in metadata:', paymentObject.metadata);
            return;
        }
        const invoice = await Invoice.findById(invoiceId).populate('userId');

        if (!invoice) {
            console.error('Invoice not found for payment:', invoiceId);
            return;
        }

        if (invoice.status === 'PAID') {
            console.log(`Invoice ${invoice.invoice_no} already PAID (idempotent)`);
            return;
        }

        invoice.status = 'PAID';
        await invoice.save();
        console.log(`✅ Invoice ${invoice.invoice_no} marked as PAID by user ${invoice.userId.username}`);

        await logActivity({
            userId: invoice.userId._id,
            action: 'PAYMENT_COMPLETED',
            category: 'payment',
            details: `Payment completed for invoice ${invoice.invoice_no}`,
            metadata: {
                invoiceId: invoice._id,
                invoiceNo: invoice.invoice_no,
                amount: invoice.total,
                currency: invoice.currency,
                stripeObjectId: paymentObject.id,
            },
        });

        await createUserNotification({
            userId: invoice.userId._id,
            eventKey: 'payment',
            notificationType: 'payment-received',
            title: 'Payment received',
            message: `Payment for invoice ${invoice.invoice_no} was received successfully.`,
            type: 'success',
            category: 'payment',
            actionUrl: '/payments',
            metadata: {
                invoiceId: invoice._id,
                invoiceNo: invoice.invoice_no,
                amount: invoice.total,
                currency: invoice.currency,
            },
        });

        publishDashboardUpdate(invoice.userId._id, { source: 'payment-received', invoiceId: invoice._id });

    } catch (error) {
        console.error('Error handling payment success:', error);
    }
};

module.exports = {
    handleStripeWebhook,
};