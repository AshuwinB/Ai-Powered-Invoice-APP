const mongoose = require('mongoose');

const userInvoiceSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    address1: { type: String, required: true },
    address2: { type: String, default: null },
    address3: { type: String, default: null }
}, { _id: false });

const itemSchema = new mongoose.Schema({
    item_name: { type: String, required: true },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true },
    total: { type: Number, required: true }
}, { _id: false });

const invoiceSchema = new mongoose.Schema({
    invoice_no: { type: String, required: true },
    invoice_date: { type: Date, required: true },
    due_date: { type: Date, required: true },
    currency: { type: String, required: true },
    from: { type: userInvoiceSchema, required: true },
    to: { type: userInvoiceSchema, required: true },
    items: { type: [itemSchema], required: true },
    sub_total: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    tax_percentage: { type: Number, default: 0 },
    total: { type: Number, required: true },
    notes: { type: String, default: null },
    status: {
        type: String,
        enum: ['PAID', 'UNPAID', 'CANCEL'],
        required: true
    },
    payment_link: { type: String, default: null },
    payment_id: { type: String, default: null },
    qr_code: { type: String, default: null }, // base64 encoded QR code
    payment_confirmation_email_sent_at: { type: Date, default: null },
    refund_status: {
        type: String,
        enum: ['NONE', 'REQUESTED', 'APPROVED'],
        default: 'NONE',
    },
    refund_requested_at: { type: Date, default: null },
    refund_requested_by_email: { type: String, default: null },
    refund_approved_at: { type: Date, default: null },
    refund_approved_by_user_id: { type: mongoose.Schema.ObjectId, ref: 'User', default: null },
    stripe_refund_id: { type: String, default: null },
    userId: { type: mongoose.Schema.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

module.exports = mongoose.model('Invoice', invoiceSchema);