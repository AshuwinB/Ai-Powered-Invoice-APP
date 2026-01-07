const bcrypt = require('bcryptjs');
const User = require('../models/user');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const jwt = require('jsonwebtoken');


const register = async(req, res) => {
    try {
        const { username, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        await User.create({ username, password: hashedPassword, isMfaActive: false });
        console.log('New Registering user:', username);
        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const login = async(req, res) => {
    req.user.loginAttempts = 0;
    req.user.lockUntil = undefined;
    await req.user.save();
    console.log('User logged in:', req.user);
    res.status(200).json({ message: 'Login successful', user: req.user.username, isMfaActive: req.user.isMfaActive });
};

const authStatus = async(req, res) => {
    if (req.user) {
        res.status(200).json({message: 'Authenticated', user: req.user.username, isMfaActive: req.user.isMfaActive });
    } else {
        res.status(401).json({ message: 'Unauthorized user' });
    }
};

const logout = async(req, res) => {
    if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized user' });
    }
    req.logout((err) => {
        if (err) {
            return res.status(400).json({ message: 'User not logged in!' });
        }
        req.session.destroy();
        res.clearCookie('connect.sid');
        res.status(200).json({ message: 'Logout successful' });
    })
};

const setup2FA = async(req, res) => {
    try {
        console.log('Setting up 2FA for user:', req.user);
        const user = req.user;
        var secret = speakeasy.generateSecret({ length: 20 });
        console.log('2FA Secret for user', user.username, ':', secret.base32);
        user.twoFASecret = secret.base32;
        user.isMfaActive = true;
        await user.save();
        const url = speakeasy.otpauthURL({
            secret: secret.ascii,
            label: `2FA Demo (${user.username})`,
        });
        const qrCodeDataURL = await qrcode.toDataURL(url);
        res.json({ 
            message: '2FA setup successful', 
            qrCodeDataURL,
            secret: secret.base32 
        });
        //
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

const verify2FA = async(req, res) => {
    const {token} = req.body;
    try {
        const user = req.user;
        const verified = speakeasy.totp.verify({   
            secret: user.twoFASecret,
            encoding: 'base32',
            token: token,
        });
        if (verified) {
            const jwtToken = jwt.sign(
                { id: user._id, username: user.username },
                process.env.JWT_SECRET,
                { expiresIn: '1h' }
            );
            res.status(200).json({ message: '2FA verification successful', jwtToken });
        } else {
            res.status(400).json({ message: 'Invalid 2FA token' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

const reset2FA = async(req, res) => {
    try {
        const user = req.user;
        user.twoFASecret = "";
        user.isMfaActive = false;
        await user.save();
        res.status(200).json({ message: '2FA has been reset. Please set up again.' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
  register,
  login,
  authStatus,
  logout,
  setup2FA,
  verify2FA,
  reset2FA,
};