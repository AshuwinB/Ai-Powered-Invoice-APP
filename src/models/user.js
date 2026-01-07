const mongoose = require('mongoose'); 

const userSchema = new mongoose.Schema({
    username: {
        type: String,   
        required: true,
        unique: true,
    },  
    password: {
        type: String,
        required: true,
    },
    loginAttempts: {
        type: Number,
        default: 0,
    },
    lockUntil: {
        type: Date,
    },
    isMfaActive: {
        type: Boolean,
        default: true,
    },
    twoFASecret: {
        type: String,
    },
}, { timestamps: true });   

userSchema.methods.isLocked = function () {
  return this.lockUntil && this.lockUntil > Date.now();
};

module.exports = mongoose.model("User", userSchema);
    
// const User = mongoose.model("User", userSchema);

// module.exports = User;

