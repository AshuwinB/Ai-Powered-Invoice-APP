const nodemailer = require('nodemailer');
const { generateInvoicePDF } = require('./pdfGenerator');

// Create transporter with better error handling
const createTransporter = () => {
    const config = {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: false, // true for 465, false for other ports
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    };

    console.log('Creating transporter with config:', {
        host: config.host,
        port: config.port,
        user: config.auth.user ? config.auth.user.substring(0, 5) + '***' : 'NOT SET'
    });

    return nodemailer.createTransport(config);
};

let transporter = createTransporter();

const getCurrencySymbol = (code) => {
    const symbols = {
        inr: '₹',
        usd: '$',
        eur: '€',
        gbp: '£',
        aud: 'A$',
        cad: 'C$',
        jpy: '¥'
    };
    if (!code) return '$';
    return symbols[code.toLowerCase()] || '$';
};

// Verify connection on startup
transporter.verify((error, success) => {
    if (error) {
        console.error('⚠️  SMTP Connection Error:', error.message);
        console.error('Please check your SMTP credentials in .env file');
    } else {
        console.log('✅ SMTP Connection Verified Successfully');
    }
});

const sendInvoiceEmail = async (invoice, recipientEmail, subject, message, settings = {}) => {
    try {
        // Verify SMTP is configured
        if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
            throw new Error('SMTP_USER and SMTP_PASS must be configured in .env file');
        }

        console.log('📧 Generating invoice PDF...');
        // Generate PDF
        const pdfBuffer = await generateInvoicePDF(invoice, settings);
        console.log('✅ PDF Generated Successfully');

        // Email options
        const mailOptions = {
            from: process.env.SMTP_USER,
            to: recipientEmail,
            subject: subject || `Invoice ${invoice.invoice_no}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333;">Invoice ${invoice.invoice_no}</h2>
                    <p>${message || 'Please find your invoice attached.'}</p>

                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
                        <h3 style="margin-top: 0; color: #333;">Invoice Details</h3>
                        <p><strong>Invoice Number:</strong> ${invoice.invoice_no}</p>
                        <p><strong>Date:</strong> ${new Date(invoice.invoice_date).toLocaleDateString()}</p>
                        <p><strong>Due Date:</strong> ${new Date(invoice.due_date).toLocaleDateString()}</p>
                        <p><strong>Total:</strong> ${getCurrencySymbol(invoice.currency)}${invoice.total.toFixed(2)} ${invoice.currency}</p>
                        <p><strong>Status:</strong> ${invoice.status}</p>
                        ${invoice.payment_link ? `
                        <div style="margin-top: 20px; padding: 15px; background-color: #e9ecef; border-radius: 5px;">
                            <h4 style="margin-top: 0; color: #495057;">Payment Information</h4>
                            <p style="margin: 10px 0;">Click the button below to make payment:</p>
                            <a href="${invoice.payment_link}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0;">Pay Now</a>
                            ${invoice.qr_code ? `<img src="${invoice.qr_code}" alt="Payment QR Code" style="max-width: 150px; height: auto; margin-top: 10px;" />` : ''}
                        </div>
                        ` : ''}
                    </div>

                    <p style="color: #666; font-size: 14px;">
                        This is an automated email. Please do not reply to this message.
                    </p>
                </div>
            `,
            attachments: [
                {
                    filename: `invoice-${invoice.invoice_no}.pdf`,
                    content: pdfBuffer,
                    contentType: 'application/pdf'
                }
            ]
        };

        console.log('📤 Sending email to:', recipientEmail);
        // Send email
        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Email sent successfully:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('❌ Error sending email:', error.message);
        console.error('Error details:', error);
        throw new Error(`Email sending failed: ${error.message}`);
    }
};

const sendSecurityOtpEmail = async ({ recipientEmail, otp, displayName }) => {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        throw new Error('SMTP_USER and SMTP_PASS must be configured in .env file');
    }

    const safeName = displayName || 'there';
    const mailOptions = {
        from: process.env.SMTP_USER,
        to: recipientEmail,
        subject: 'Your verification code',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto;">
                <h2 style="margin-bottom: 8px;">Verify your contact</h2>
                <p>Hello ${safeName},</p>
                <p>Your one-time verification code is:</p>
                <div style="font-size: 28px; font-weight: bold; letter-spacing: 4px; margin: 14px 0; color: #0f766e;">${otp}</div>
                <p>This code will expire in 10 minutes.</p>
                <p style="font-size: 12px; color: #6b7280;">If you did not request this, you can ignore this email.</p>
            </div>
        `,
    };

    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
};

const sendPhoneOtp = async ({ phone, otp }) => {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_PHONE_NUMBER;

    if (!sid || !token || !from) {
        if (process.env.NODE_ENV !== 'production') {
            console.log(`[DEV OTP] Phone ${phone} -> ${otp}`);
            return { success: true, mode: 'dev-log', devOtp: otp };
        }
        throw new Error('Phone OTP provider is not configured');
    }

    const normalizePhone = (value) => String(value || '').replace(/[^\d+]/g, '').trim();
    const toNormalized = normalizePhone(phone);
    const fromNormalized = normalizePhone(from);

    if (toNormalized === fromNormalized) {
        const sameNumberError = new Error('Phone OTP destination cannot be the same as Twilio sender number');
        sameNumberError.code = 'TWILIO_SAME_TO_FROM';
        throw sameNumberError;
    }

    const body = new URLSearchParams({
        To: phone,
        From: from,
        Body: `Your verification code is ${otp}. It expires in 10 minutes.`,
    });

    const authToken = Buffer.from(`${sid}:${token}`).toString('base64');
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: 'POST',
        headers: {
            Authorization: `Basic ${authToken}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
    });

    if (!response.ok) {
        const errorText = await response.text();
        const twilioError = new Error(`Twilio send failed: ${errorText}`);
        twilioError.code = 'TWILIO_SEND_FAILED';
        throw twilioError;
    }

    return { success: true, mode: 'twilio' };
};

module.exports = {
    sendInvoiceEmail,
    sendSecurityOtpEmail,
    sendPhoneOtp,
};