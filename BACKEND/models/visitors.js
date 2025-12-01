const mongoose = require("mongoose");

const visitorSchema = new mongoose.Schema({
    username: String,
    userType: String,  // Guest / Staff
    status: String,    // Registered / Success / Failed
    dateTime: { type: Date, default: Date.now }
});

module.exports = mongoose.model("visitors", visitorSchema);
