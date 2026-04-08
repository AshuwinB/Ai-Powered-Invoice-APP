const Stripe = require('stripe');
const QRCode = require('qrcode');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/*
  CREATE PAYMENT LINK
  - card-only checkout
  - forces billing address collection for compliance
*/
const createPaymentLink = async (invoice) => {
  try {

    console.log(
      "Creating payment link",
      invoice.invoice_no,
      invoice.currency,
      invoice.total
    );

    const currency = (invoice.currency || "usd").toLowerCase();

    const paymentMethods = ["card"];

    const buildSessionPayload = (methods) => ({

      payment_method_types: methods,

      mode: "payment",

      // important: always collect customer info fresh
      customer_email: invoice.to.email,

      // force address collection (required for India export payments)
      billing_address_collection: "required",

      // automatically create stripe customer
      customer_creation: "always",

      locale: "auto",

      line_items: [
        {
          price_data: {
            currency: currency,

            product_data: {
              name: `Invoice ${invoice.invoice_no}`,
              description: `Payment for invoice ${invoice.invoice_no}`
            },

            unit_amount: Math.round(invoice.total * 100)
          },

          quantity: 1
        }
      ],

      success_url:
        `${process.env.FRONTEND_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,

      cancel_url:
        `${process.env.FRONTEND_URL}/payment-cancelled`,

      metadata: {
        invoice_id: invoice._id.toString(),
        invoice_no: invoice.invoice_no
      },

      payment_intent_data: {

        metadata: {
          invoice_id: invoice._id.toString(),
          invoice_no: invoice.invoice_no
        }

      }

    });

    const session = await stripe.checkout.sessions.create(buildSessionPayload(paymentMethods));

    console.log("Stripe checkout URL:", session.url);

    return {

      payment_link: session.url,

      payment_id: session.id

    };

  } catch (error) {

    console.error("Stripe error:", error);

    throw error;

  }
};


/*
  GENERATE QR CODE
*/
const generateQRCode = async (url) => {

  try {

    return await QRCode.toDataURL(url);

  } catch (error) {

    console.error("QR error:", error);

    throw error;

  }

};


/*
  STRIPE WEBHOOK VERIFY
*/
const constructEvent = (payload, signature, secret) => {

  return stripe.webhooks.constructEvent(
    payload,
    signature,
    secret
  );

};


module.exports = {

  createPaymentLink,

  generateQRCode,

  constructEvent,

  stripe

};