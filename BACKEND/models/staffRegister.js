const mongoose = require("mongoose");

const staffSchema = new mongoose.Schema({
    fullname: { type: String, required: true },
    password: { type: String, required: true },
    gender: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    contact: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

// Collection name will be: staff-register
module.exports = mongoose.model("staff-register", staffSchema);
