const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({
    username: { type: String, required: true },     // from login
    cardHolder: { type: String, required: true },
    cardNumber: { type: String, required: true },
    expiryDate: { type: String, required: true },
    cvv: { type: String, required: true },
    billingZip: { type: String, required: true },
    bookingId: { type: String, required: true },    // link to booking
    paidAt: { type: Date, default: Date.now },
    totalAmount: Number,
    date: { type: Date, default: Date.now }

});

module.exports = mongoose.model("Payment", paymentSchema);
