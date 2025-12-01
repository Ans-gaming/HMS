const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema({
    roomNumber: Number,
    type: String,
    acType: String,   // ac / non-ac / na
    floor: Number,
    status: { type: String, default: "Available" }  // Available | Occupied
});

module.exports = mongoose.model("Room", roomSchema);
