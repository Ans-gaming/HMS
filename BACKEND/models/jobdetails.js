const mongoose = require("mongoose");

const jobDetailsSchema = new mongoose.Schema({
    fullname: { type: String, required: true },
    email: { type: String, required: true },
    contact: { type: String, required: true },

    jobRole: { type: String, required: true },
    shift: { type: String, required: true },
    resume: { type: String, required: true },

    status: { type: String, default: "Pending" },  // ⭐ NEW FIELD ADDED

    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("jobdetails", jobDetailsSchema);
