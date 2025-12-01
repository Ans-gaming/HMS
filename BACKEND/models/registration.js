const mongoose = require("mongoose");

const registrationSchema = new mongoose.Schema({
    username: { type: String, required: true },
    password: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    contact: { type: String, required: true },

    // ⭐ ADDED FOR OTP
    otp: { type: String, default: null },
    otpExpiry: { type: Date, default: null }

}, { timestamps: true });   // ⭐ IMPORTANT

module.exports = mongoose.model("Registration", registrationSchema);
