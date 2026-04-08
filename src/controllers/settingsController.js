const Settings = require('../models/Settings');

const getSettings = async (req, res) => {
    try {
        let settings = await Settings.findOne({ userId: req.user._id });

        if (!settings) {
            settings = new Settings({ userId: req.user._id });
            await settings.save();
        }

        res.status(200).json(settings);
    } catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const updateSettings = async (req, res) => {
    try {
        const settings = await Settings.findOneAndUpdate(
            { userId: req.user._id },
            req.body,
            { new: true, upsert: true }
        );

        res.status(200).json(settings);
    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
    getSettings,
    updateSettings
};