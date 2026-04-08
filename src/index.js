const express = require('express');
const dotenv = require('dotenv');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
const cors = require('cors');
const { json } = require('express');
const dbConnect = require('./config/dbconnect')
const authRoute = require('./routes/authRoute');
const invoiceRoute = require('./routes/invoiceRoute');
const settingsRoute = require('./routes/settingsRoute');
const notificationRoute = require('./routes/notificationRoute');
const webhookRoute = require('./routes/webhookRoute');
const passportConfig = require('./config/passportConfig');
const { updateSessionActivity } = require('./controllers/authController');

// Load .env from the project root
dotenv.config({ path: path.join(__dirname, '../.env') });

dbConnect();

const app = express();

//middlewares
const corsOptions = {
    origin: ['http://localhost:3009', 'http://localhost:3010', 'http://localhost:3011', 'http://localhost:3012', 'http://localhost:3001', 'http://localhost:3002'],
    credentials: true,
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
// Webhook route must be before json middleware
app.use('/api/webhooks', webhookRoute);
app.use(json({ limit:'100mb' }));
app.use(express.urlencoded({ limit:'100mb', extended: true }));
app.use(session({
    secret: process.env.SESSION_SECRET || 'default_secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        maxAge: 60000 * 60, // 1 hour
        httpOnly: true,
        sameSite: 'lax'
    }
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(updateSessionActivity);
//routes

app.use('/api/auth', authRoute);
app.use('/api/invoices', invoiceRoute);
app.use('/api/settings', settingsRoute);
app.use('/api/notifications', notificationRoute);

//listen
const PORT = process.env.PORT || 7002;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));