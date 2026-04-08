# React Invoice App with Stripe and 2FA

Invoice management app with React (Vite) frontend and Express/MongoDB backend.

## Current Features
- User auth with 2FA onboarding and device-based login approval
- Create, edit, clone, delete, and email invoices
- Stripe Checkout card payments
- Payment success flow with:
	- Download Invoice PDF
	- Send payment confirmation email
	- Refund request button
- Refund workflow:
	- Customer requests refund from payment success page
	- Owner receives notification and approves refund
	- Stripe refund is initiated and refund email is sent
- Notifications feed and activity logs

## Tech Stack
- Frontend: React, Vite, Tailwind, Axios
- Backend: Node.js, Express, Passport, Mongoose
- Payments: Stripe Checkout + Stripe webhooks
- Email: Nodemailer (SMTP)

## Project Structure
- `client/` - React frontend
- `src/` - Express backend

## Environment Variables
1. Copy `.env.example` to `.env`
2. Fill real values in `.env` (do not commit credentials)

Important:
- `.env` is ignored by git.
- `.env.example` is safe for repository sharing.

## Setup
### 1) Install dependencies
Backend:
```bash
npm install
```

Frontend:
```bash
cd client
npm install
cd ..
```

### 2) Configure ports
Frontend API base URL is currently hardcoded in `client/src/service/api.js` as:
- `http://localhost:7001/api`

So either:
1. Set `PORT=7001` in `.env`, or
2. Change `client/src/service/api.js` to match your backend port.

### 3) Run app
Backend:
```bash
npm run dev
```

Frontend:
```bash
cd client
npm run dev
```

## Stripe Webhook (local)
Run Stripe CLI in another terminal:
```bash
stripe listen --forward-to localhost:7001/api/webhooks/stripe
```

Then:
1. Create and pay an invoice in Stripe Checkout
2. Webhook updates invoice/payment state in app

## Security and Repository Notes
- Never commit `.env` or any credentials.
- Rotate keys immediately if they were ever pushed publicly.
- Use `.env.example` as the shared config template.
