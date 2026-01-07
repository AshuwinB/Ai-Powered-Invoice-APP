const express = require('express');
const dotenv = require('dotenv');
const session = require('express-session');
const passport = require('passport');
const cors = require('cors');
const { json } = require('express');
const dbConnect = require('./config/dbconnect')
const authRoute = require('./routes/authRoute');
const passportConfig = require('./config/passportConfig');

dotenv.config();

dbConnect();

const app = express();

//middlewares
const corsOptions = {
    origin: 'http://localhost:3001',
    credentials: true,
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(json({ limit:'100mb' }));
app.use(express.urlencoded({ limit:'100mb', extended: true }));
app.use(session({
    secret: process.env.SESSION_SECRET || 'default_secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 60000 * 60},
     // Set to true if using HTTPS
}));
app.use(passport.initialize());
app.use(passport.session());
//routes

app.use('/api/auth', authRoute);

//listen
const PORT = process.env.PORT || 7002;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));