# React Invoice App with Stripe & 2FA

## Features
- Create/send invoices with PDF
- Stripe Checkout payments (INR/USD/UPI)
- **Auto-mark PAID via webhook** + confirmation emails
- 2FA authentication
- MongoDB

## Webhook Test
1. `stripe listen --forward-to localhost:7001/api/webhooks/stripe`
2. Create/pay invoice → status → PAID, emails sent.

Tested: INV-20260404-967
