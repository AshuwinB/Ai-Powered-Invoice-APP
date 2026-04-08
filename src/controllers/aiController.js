const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const AI_MODELS = [
    'gemini-2.5-flash',
    'gemini-flash-latest',
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash'
];

const INVOICE_SYSTEM_PROMPT = `You are an invoice data extraction assistant. The user will describe an invoice in natural language. Extract structured invoice data from the description and return ONLY a valid JSON object with NO markdown, NO code fences, NO extra text.

The JSON must follow this exact schema:
{
  "from": {
    "name": "",
    "email": "",
    "address1": "",
    "address2": "",
    "address3": ""
  },
  "to": {
    "name": "",
    "email": "",
    "address1": "",
    "address2": "",
    "address3": "",
    "city": "",
    "state": "",
    "postal_code": ""
  },
  "items": [
    {
      "item_name": "",
      "quantity": 1,
      "price": 0,
      "total": 0
    }
  ],
  "discount": 0,
  "tax_percentage": 0,
  "notes": "",
  "currency": "USD"
}

Rules:
- Use numeric values for quantity, price, total (not strings)
- Total for each item = quantity * price
- Leave fields empty string "" if not mentioned
- Default currency to USD unless specified otherwise
- Supported currency codes: USD, EUR, GBP, INR
- Only extract data explicitly mentioned; do not invent details
- Prefer Indian context when user mentions India/INR/GST terms (city/state/pincode formatting is allowed)
- Return ONLY the JSON object, nothing else`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isRateLimitError = (error) => {
    if (!error) return false;
    if (error.status === 429) return true;
    const message = String(error.message || '').toLowerCase();
    return message.includes('rate') || message.includes('quota') || message.includes('429');
};

const isUnavailableModelError = (error) => {
    if (!error) return false;
    if (error.status === 404) return true;
    const message = String(error.message || '').toLowerCase();
    return message.includes('not found') || message.includes('not supported for generatecontent');
};

const getAIResponseText = async (promptText) => {
    let lastRateLimitError = null;

    for (const modelName of AI_MODELS) {
        const model = genAI.getGenerativeModel({ model: modelName });

        // Retry once per model because free-tier rate limits are often bursty.
        for (let attempt = 1; attempt <= 2; attempt += 1) {
            try {
                const result = await model.generateContent([
                    { text: INVOICE_SYSTEM_PROMPT },
                    { text: `Invoice description: ${promptText}` }
                ]);

                return result.response.text().trim();
            } catch (error) {
                if (!isRateLimitError(error)) {
                    if (isUnavailableModelError(error)) {
                        // Try the next model if this one is unavailable for the current API version/key.
                        break;
                    }
                    throw error;
                }

                lastRateLimitError = error;

                if (attempt === 1) {
                    await sleep(1000);
                    continue;
                }

                // Move to the next model candidate after second rate-limit hit.
                break;
            }
        }
    }

    throw lastRateLimitError || new Error('AI rate limit reached');
};

const parseInvoiceJson = (rawText) => {
    const jsonText = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const parsed = JSON.parse(jsonText);
    return parsed?.invoiceData || parsed;
};

const generateInvoiceFromAI = async (req, res) => {
    try {
        const { prompt } = req.body;

        if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
            return res.status(400).json({ message: 'prompt is required' });
        }

        if (prompt.trim().length > 2000) {
            return res.status(400).json({ message: 'Prompt too long (max 2000 characters)' });
        }

        if (!process.env.GEMINI_API_KEY) {
            return res.status(503).json({ message: 'AI service not configured. Add GEMINI_API_KEY to .env' });
        }

        const rawText = await getAIResponseText(prompt.trim());

        let invoiceData;
        try {
            invoiceData = parseInvoiceJson(rawText);
        } catch {
            console.error('Gemini returned unparseable JSON:', rawText);
            return res.status(502).json({ message: 'AI returned an unexpected response. Please rephrase your description.' });
        }

        // Ensure items have correct totals
        if (Array.isArray(invoiceData.items)) {
            invoiceData.items = invoiceData.items.map(item => ({
                ...item,
                quantity: Number(item.quantity) || 1,
                price: Number(item.price) || 0,
                total: (Number(item.quantity) || 1) * (Number(item.price) || 0)
            }));
        }

        return res.status(200).json({ invoiceData });
    } catch (error) {
        console.error('AI invoice generation error:', error);
        if (error.status === 429) {
            return res.status(429).json({ message: 'AI rate limit reached. Please try again in a moment.' });
        }
        return res.status(500).json({ message: 'AI generation failed. Please try again.' });
    }
};

module.exports = { generateInvoiceFromAI };
