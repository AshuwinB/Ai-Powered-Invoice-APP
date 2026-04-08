const isAuthenticated = (req, res, next) => {
    console.log('Auth check - req.isAuthenticated():', req.isAuthenticated());
    console.log('Auth check - req.user:', req.user);
    console.log('Auth check - req.session:', req.session ? 'exists' : 'null');
    console.log('Auth check - req.sessionID:', req.sessionID);

    if (req.isAuthenticated()) {
        return next();
    }
    res.status(401).json({ message: 'Unauthorized user' });
};

module.exports = { isAuthenticated };