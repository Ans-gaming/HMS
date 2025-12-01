const mongoose = require("mongoose");

const gstSchema = new mongoose.Schema({
    bookingId: String,
    username: String,
    gstAmount: Number,
    date: { type: Date, default: Date.now }
});

module.exports = mongoose.model("GSTPayments", gstSchema);
