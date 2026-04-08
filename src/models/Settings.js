const mongoose = require('mongoose');

const businessInfoSchema = new mongoose.Schema({
    businessName: { type: String, default: '' },
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
    address: { type: String, default: '' },
    website: { type: String, default: '' },
    logo: { type: String, default: null }
}, { _id: false });

const currencySchema = new mongoose.Schema({
    currency: { type: String, default: 'USD' },
    symbol: { type: String, default: '$' }
}, { _id: false });

const taxSchema = new mongoose.Schema({
    defaultTaxRate: { type: Number, default: 0 },
    taxName: { type: String, default: 'Tax' }
}, { _id: false });

const paymentSchema = new mongoose.Schema({
    defaultPaymentDeadlineDays: { type: Number, default: 30 },
    defaultPaymentTerms: { type: String, default: 'Due upon receipt' }
}, { _id: false });

const invoiceSchema = new mongoose.Schema({
    numberFormat: { type: String, default: 'INV-{YYYY}{MM}{DD}-{###}' }, // e.g., INV-20260401-001
    notesAndTerms: { type: String, default: 'Thank you for your business!' }
}, { _id: false });

const themeSchema = new mongoose.Schema({
    template: { type: String, default: 'modern' }, // modern, classic, minimal
    primaryColor: { type: String, default: '#3B82F6' },
    accentColor: { type: String, default: '#1E40AF' }
}, { _id: false });

const pdfSchema = new mongoose.Schema({
    paperSize: { type: String, default: 'A4' }, // A4, Letter, Legal
    orientation: { type: String, default: 'portrait' }, // portrait, landscape
    marginTop: { type: Number, default: 50 },
    marginBottom: { type: Number, default: 50 },
    marginLeft: { type: Number, default: 50 },
    marginRight: { type: Number, default: 50 },
    fontFamily: { type: String, default: 'Helvetica' }, // Helvetica, Times-Roman, Courier
    fontSize: { type: Number, default: 12 },
    showLogo: { type: Boolean, default: true },
    showWatermark: { type: Boolean, default: false },
    watermarkText: { type: String, default: 'DRAFT' }
}, { _id: false });

const signatureSchema = new mongoose.Schema({
    name: { type: String, default: null },
    image: { type: String, default: null }
}, { _id: false });

const settingsSchema = new mongoose.Schema({
    businessInfo: businessInfoSchema,
    currency: currencySchema,
    tax: taxSchema,
    payment: paymentSchema,
    invoice: invoiceSchema,
    theme: themeSchema,
    pdf: pdfSchema,
    signature: signatureSchema,
    invoiceLogo: { type: String, default: null }, // Keep for backward compatibility
    userId: { type: mongoose.Schema.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

module.exports = mongoose.model('Settings', settingsSchema);