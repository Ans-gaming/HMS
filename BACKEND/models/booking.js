const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema({
    bookingId: String,
    guestUsername: String,     // ⭐ username stored
    roomNumber: Number,
    roomType: String,
    acType: String,
    checkin: String,
    checkout: String,
    nights: Number,
    rate: Number,
    total: Number,
    status: { type: String, default: "Booked" } // Booked | CheckedOut
});

module.exports = mongoose.model("Booking", bookingSchema);
