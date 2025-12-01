const mongoose = require("mongoose");

const registrationSchema = new mongoose.Schema({
    username: { type: String, required: true },
    password: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    contact: { type: String, required: true }
}, { timestamps: true });   // ⭐ IMPORTANT

module.exports = mongoose.model("Registration", registrationSchema);
