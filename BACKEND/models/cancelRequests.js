const mongoose = require("mongoose");

const cancelSchema = new mongoose.Schema({
    guestName: String,
    bookingId: String,
    reason: String,
    date: { type: Date, default: Date.now }
});

module.exports = mongoose.model("CancelRequests", cancelSchema);
