const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();

// ⭐ FINAL WORKING CORS FIX
app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type"]
}));

app.use(express.json());

app.use("/uploads", express.static("uploads"));

const cloudinary = require("cloudinary").v2;

cloudinary.config({
    cloud_name: "defiwywnx",
    api_key: "282517342222967",
    api_secret: "i0ziehkakuCQM63CW-pytb-BlJI"
});

// Import Models
const Registration = require("./models/registration");
const StaffRegister = require("./models/staffRegister");
const JobDetails = require("./models/jobdetails");
const Visitors = require("./models/visitors");
const Room = require("./models/rooms");
const Booking = require("./models/booking");
const Payment = require("./models/payment");
const CancelRequests = require("./models/cancelRequests");


async function logVisitor(username, userType, status) {
    await Visitors.create({
        username,
        userType,
        status,
        dateTime: new Date()
    });
}

// MongoDB connection
mongoose.connect("mongodb+srv://admin:AnsGaming01@cluster0.zaarqpp.mongodb.net/hms")
    .then(() => console.log("MongoDB connected"))
    .catch(err => console.log(err));

app.get("/", (req, res) => {
    res.send("Backend working!");
});

const multer = require("multer");

// Storage for resumes
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/");   // store files inside uploads folder
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + "-" + file.originalname);
    }
});

const upload = multer({ storage: storage });

// ✅ REGISTER API (Guest)
app.post("/register", async (req, res) => {
    try {
        const { username, password, email, contact } = req.body;

        // ❗ Check if user already exists
        const existing = await Registration.findOne({ email });
        if (existing) {
            await logVisitor(username, "guest", "failed");  // ❌ store failed register attempt
            return res.json({ success: false, message: "Email already exists" });
        }

        const newUser = new Registration({
            username,
            password,
            email,
            contact
        });

        await newUser.save();

        // ⭐ Store visitor entry (Guest - Register Success)
        await logVisitor(username, "guest", "success");

        res.json({ success: true, message: "User registered successfully!" });

    } catch (err) {
        // ❗ Log failed register attempt
        await logVisitor(req.body.username, "guest", "failed");

        res.status(500).json({ success: false, message: err.message });
    }
});

// LOGIN API (with visitor tracking)
app.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;

        const user = await Registration.findOne({ username });

        if (!user) {
            await logVisitor(username, "guest", "failed");
            return res.json({ success: false, message: "User not found" });
        }

        if (user.password !== password) {
            await logVisitor(username, "guest", "failed");
            return res.json({ success: false, message: "Incorrect password" });
        }

        // SUCCESS LOGIN → Store visitor
        await logVisitor(username, "guest", "success");

        res.json({
            success: true,
            message: "Login successful!"
        });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});


// ✅ GET GUEST STATS
app.get("/guest-stats", async (req, res) => {
    try {
        const totalGuests = await Registration.countDocuments();

        // Today's date range
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        const newToday = await Registration.countDocuments({
            createdAt: { $gte: startOfDay, $lte: endOfDay }
        });

        res.json({
            success: true,
            totalGuests,
            newToday
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ✅ STAFF REGISTER API
app.post("/staff-register", async (req, res) => {
    try {
        const { fullname, password, confirmPassword, gender, email, contact } = req.body;

        // ❗ Password check
        if (password !== confirmPassword) {
            await logVisitor(fullname, "staff", "failed");  // failed attempt
            return res.json({ success: false, message: "Passwords do not match" });
        }

        // ❗ Check if staff with same email already exists
        const existing = await StaffRegister.findOne({ email });
        if (existing) {
            await logVisitor(fullname, "staff", "failed"); 
            return res.json({ success: false, message: "Email already exists" });
        }

        const newStaff = new StaffRegister({
            fullname,
            password,
            gender,
            email,
            contact
        });

        await newStaff.save();

        // ⭐ Log successful staff registration
        await logVisitor(fullname, "staff", "success");

        res.json({ success: true, message: "Staff registered successfully!" });

    } catch (err) {
        // ❗ Log failed attempt
        await logVisitor(req.body.fullname, "staff", "failed");

        res.status(500).json({ success: false, message: err.message });
    }
});

app.post("/job-details", upload.single("resume"), async (req, res) => {
    try {
        const { email, jobRole, shift } = req.body;

        const limits = {
            frontdesk: { total: 6, morning: 2, evening: 2, night: 2 },
            housekeeping: { total: 50, morning: 17, evening: 17, night: 16 },
            service: { total: 50, morning: 17, evening: 17, night: 16 },
            cook: { total: 14, morning: 5, evening: 5, night: 4 }
        };

        const current = await JobDetails.find({ jobRole });

        // **Check total role capacity**
        if (current.length >= limits[jobRole].total) {
            return res.json({ success: false, message: "This job role is full!" });
        }

        // **Check shift capacity**
        const shiftCount = await JobDetails.countDocuments({ jobRole, shift });
        if (shiftCount >= limits[jobRole][shift]) {
            return res.json({ success: false, message: "This shift is full!" });
        }

        // Resume check
        if (!req.file) {
            return res.json({ success: false, message: "Resume not uploaded!" });
        }

        // Upload to cloudinary
        const cloudUpload = await cloudinary.uploader.upload(req.file.path, {
            folder: "hms_resumes",
            resource_type: "raw",
            format: "pdf"
        });

        const resumeUrl = cloudUpload.secure_url;

        // Fetch staff data
        const staff = await StaffRegister.findOne({ email });

        if (!staff) {
            return res.json({ success: false, message: "Staff not found!" });
        }

        // Save job details
        const newJob = new JobDetails({
            fullname: staff.fullname,
            email: staff.email,
            contact: staff.contact,
            jobRole,
            shift,
            resume: resumeUrl
        });

        await newJob.save();

        res.json({ success: true, message: "Job details saved!" });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get("/job-availability", async (req, res) => {
    try {
        const limits = {
            frontdesk: { total: 6, morning: 2, evening: 2, night: 2 },
            housekeeping: { total: 50, morning: 17, evening: 17, night: 16 },
            service: { total: 50, morning: 17, evening: 17, night: 16 },
            cook: { total: 14, morning: 5, evening: 5, night: 4 }
        };

        const jobs = await JobDetails.find();

        let count = {
            frontdesk: { total: 0, morning: 0, evening: 0, night: 0 },
            housekeeping: { total: 0, morning: 0, evening: 0, night: 0 },
            service: { total: 0, morning: 0, evening: 0, night: 0 },
            cook: { total: 0, morning: 0, evening: 0, night: 0 }
        };

        jobs.forEach(j => {
            count[j.jobRole].total++;
            count[j.jobRole][j.shift]++;
        });

        res.json({ success: true, limits, count });

    } catch (err) {
        res.json({ success: false, message: err.message });
    }
});

// STAFF LOGIN API (Fullname + Password + JobRole + Approval Required)
app.post("/staff-login", async (req, res) => {
    try {
        const { fullname, password, selectedRole } = req.body;

        // 1️⃣ Check staff registration
        const staff = await StaffRegister.findOne({ fullname });

        if (!staff) {
            await logVisitor(fullname, "staff", "failed");
            return res.json({ success: false, message: "Staff not found" });
        }

        if (staff.password !== password) {
            await logVisitor(fullname, "staff", "failed");
            return res.json({ success: false, message: "Incorrect password" });
        }

        // 2️⃣ Get job details
        const job = await JobDetails.findOne({ email: staff.email });

        if (!job) {
            await logVisitor(fullname, "staff", "failed");
            return res.json({
                success: false,
                message: "Job details not found for this employee."
            });
        }

        // 3️⃣ Check admin approval
        if (job.status !== "Approved") {
            await logVisitor(fullname, "staff", "failed");
            return res.json({
                success: false,
                message: "Access denied. Admin has not approved your application yet."
            });
        }

        // 4️⃣ Verify role matches
        if (job.jobRole !== selectedRole) {
            await logVisitor(fullname, "staff", "failed");
            return res.json({
                success: false,
                message: "Incorrect job role selected."
            });
        }

        // 5️⃣ SUCCESS LOGIN
        await logVisitor(fullname, "staff", "success");

        res.json({
            success: true,
            message: "Login successful!",
            fullname: staff.fullname,
            jobRole: job.jobRole
        });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ✅ GET STAFF STATS WITH ACTIVE SHIFT BASED ON CURRENT TIME
app.get("/staff-stats", async (req, res) => {
    try {
        const totalStaff = await StaffRegister.countDocuments();

        // Current time in 24-hour format
        const now = new Date();
        const hour = now.getHours();

        let currentShift = "";

        // Determine current shift
        if (hour >= 6 && hour < 14) {
            currentShift = "morning";
        } else if (hour >= 14 && hour < 22) {
            currentShift = "evening";
        } else {
            currentShift = "night";
        }

        // Count staff with *current shift* from jobdetails collection
        const activeStaff = await JobDetails.countDocuments({ shift: currentShift });

        res.json({
            success: true,
            totalStaff,
            currentShift,
            activeStaff
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get("/all-jobdetails", async (req, res) => {
    try {
        const jobs = await JobDetails.find();
        res.json({ success: true, jobs });
    } catch (err) {
        res.json({ success: false, message: err.message });
    }
});

app.post("/update-status", async (req, res) => {
    try {
        const { id, status } = req.body;

        // Find job entry
        const job = await JobDetails.findById(id);
        if (!job) {
            return res.json({ success: false, message: "Job entry not found" });
        }

        const email = job.email;

        // If REJECT → DELETE from both collections
        if (status === "Rejected") {
            await JobDetails.findByIdAndDelete(id);   // delete from jobdetails
            await StaffRegister.findOneAndDelete({ email });  // delete staff register entry

            return res.json({
                success: true,
                message: "Employee rejected and removed from system"
            });
        }

        // If APPROVED → Update only status
        await JobDetails.findByIdAndUpdate(id, { status });

        res.json({
            success: true,
            message: "Employee approved"
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});

// ⭐ CANCEL APPLICATION → Delete staffRegister + jobdetails
app.post("/cancel-application", async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) return res.json({ success: false, message: "Email missing" });

        // Delete job details
        await JobDetails.findOneAndDelete({ email });

        // Delete staff register entry
        await StaffRegister.findOneAndDelete({ email });

        return res.json({
            success: true,
            message: "Application cancelled and all data removed"
        });

    } catch (err) {
        return res.json({ success: false, message: err.message });
    }
});

// ⭐ DELETE STAFF (After Approval)
app.post("/delete-staff", async (req, res) => {
    try {
        const { id } = req.body; // jobdetails ID

        // Find job entry first
        const job = await JobDetails.findById(id);
        if (!job) {
            return res.json({ success: false, message: "Job entry not found" });
        }

        const email = job.email;

        // Delete from BOTH collections
        await JobDetails.findByIdAndDelete(id);
        await StaffRegister.findOneAndDelete({ email });

        return res.json({
            success: true,
            message: "Staff permanently deleted from system"
        });

    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// ⭐ GET VISITOR STATS + LOG LIST
app.get("/visitor-stats", async (req, res) => {
    try {
        const logs = await Visitors.find().sort({ dateTime: -1 });

        const total = logs.length;

        // Today's date range
        const start = new Date();
        start.setHours(0, 0, 0, 0);

        const end = new Date();
        end.setHours(23, 59, 59, 999);

        const today = await Visitors.countDocuments({
            dateTime: { $gte: start, $lte: end }
        });

        res.json({
            success: true,
            total,
            today,
            logs: logs.map(v => ({
                username: v.username,
                type: v.userType,
                status: v.status,
                date: v.dateTime
            }))
        });

    } catch (err) {
        res.json({ success: false, message: err.message });
    }
});

app.post("/delete-all-visitors", async (req, res) => {
    try {
        await Visitors.deleteMany({});  // delete all documents

        res.json({
            success: true,
            message: "All visitors history deleted successfully"
        });

    } catch (err) {
        res.json({
            success: false,
            message: err.message
        });
    }
});

app.get("/all-rooms", async (req, res) => {
    try {
        const rooms = await Room.find();
        const bookings = await Booking.find({ status: "Booked" });

        const now = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
        const today = new Date(now);

        // Mark rooms as occupied if user is still staying
        for (const b of bookings) {
            const checkoutDate = new Date(b.checkout);
            checkoutDate.setHours(23, 59, 59, 999);

            const roomIndex = rooms.findIndex(r => r.roomNumber === b.roomNumber);

            if (roomIndex !== -1) {
                if (today <= checkoutDate) {
                    rooms[roomIndex].status = "Occupied"; // STILL STAYING TODAY
                } else {
                    rooms[roomIndex].status = "Available"; // CHECKOUT PASSED
                }
            }
        }

        res.json({ success: true, rooms });
    } catch (err) {
        res.json({ success: false, message: err.message });
    }
});

app.get("/init-rooms", async (req, res) => {
    try {
        const rooms = [];

        // 1st Floor
        for (let i = 101; i <= 110; i++)
            rooms.push({ roomNumber: i, type: "Single Bedroom", acType: "AC", floor: 1 });
        for (let i = 111; i <= 120; i++)
            rooms.push({ roomNumber: i, type: "Single Bedroom", acType: "NON-AC", floor: 1 });

        // 2nd Floor
        for (let i = 201; i <= 210; i++)
            rooms.push({ roomNumber: i, type: "Double Bedroom", acType: "AC", floor: 2 });
        for (let i = 211; i <= 220; i++)
            rooms.push({ roomNumber: i, type: "Double Bedroom", acType: "NON-AC", floor: 2 });

        // 3rd Floor
        for (let i = 301; i <= 310; i++)
            rooms.push({ roomNumber: i, type: "Triple Bedroom", acType: "AC", floor: 3 });
        for (let i = 311; i <= 320; i++)
            rooms.push({ roomNumber: i, type: "Triple Bedroom", acType: "NON-AC", floor: 3 });

        // 4th Floor Deluxe
        for (let i = 401; i <= 410; i++)
            rooms.push({ roomNumber: i, type: "Deluxe Room", acType: "NA", floor: 4 });

        // 5th Floor Suite
        for (let i = 501; i <= 505; i++)
            rooms.push({ roomNumber: i, type: "Suite Room", acType: "NA", floor: 5 });

        await Room.deleteMany({});
        await Room.insertMany(rooms);

        res.json({ success: true, message: "Rooms initialized!" });
    } catch (err) {
        res.json({ success: false, message: err.message });
    }
});

app.get("/available-rooms", async (req, res) => {
    try {
        const { type, acType } = req.query;

        let query = { status: "Available" };

        if (type) query.type = type;
        if (acType) query.acType = acType;

        const rooms = await Room.find(query);
        res.json({ success: true, rooms });

    } catch (err) {
        res.json({ success: false, message: err.message });
    }
});

app.post("/occupy-room", async (req, res) => {
    try {
        const { roomNumber } = req.body;

        await Room.updateOne(
            { roomNumber },
            { status: "Occupied" }
        );

        res.json({ success: true });

    } catch (err) {
        res.json({ success: false, message: err.message });
    }
});

app.post("/save-booking", async (req, res) => {
    try {
        const { roomNumber } = req.body;

        // 1️⃣ Save booking
        await Booking.create(req.body);

        // 2️⃣ Mark room as Occupied
        await Room.updateOne(
            { roomNumber },
            { status: "Occupied" }
        );

        res.json({ success: true, message: "Booking saved!" });

    } catch (err) {
        res.json({ success: false, message: err.message });
    }
});

// ⭐ ADD THIS FUNCTION HERE (Step 1)
async function autoCompleteExpiredBookings() {
    const now = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    const today = new Date(now);

    const bookings = await Booking.find({ status: "Booked" });

    for (const b of bookings) {
        const checkoutDate = new Date(b.checkout);
        checkoutDate.setHours(23, 59, 59, 999);

        if (today > checkoutDate) {
            await Booking.updateOne({ bookingId: b.bookingId }, { status: "Completed" });

            await Room.updateOne(
                { roomNumber: b.roomNumber },
                { status: "Available" }
            );
        }
    }
}

app.get("/booked-rooms", async (req, res) => {
    try {
        // Auto clear expired bookings
        await autoCompleteExpiredBookings();

        const bookings = await Booking.find({ status: "Booked" });
        const occupied = bookings.map(b => b.roomNumber);

        res.json({ success: true, occupied });
    } catch (err) {
        res.json({ success: false, message: err.message });
    }
});

app.post("/save-payment", async (req, res) => {
    try {
        await Payment.create(req.body);
        res.json({ success: true, message: "Payment stored successfully!" });
    } catch (err) {
        res.json({ success: false, message: err.message });
    }
});

// ⭐ GET ALL PAYMENTS
app.get("/all-payments", async (req, res) => {
    try {
        const payments = await Payment.find().sort({ _id: -1 }); // latest first
        res.json({ success: true, payments });
    } catch (err) {
        res.json({ success: false, message: err.message });
    }
});

app.get("/check-active-booking", async (req, res) => {
    try {
        const username = req.query.username;
        if (!username) {
            return res.json({ active: false });
        }

        // get current IST time
        const now = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
        const currentDate = new Date(now);

        // find active booking for this user
        const booking = await Booking.findOne({
            guestUsername: username,
            status: "Booked"
        });

        if (!booking) return res.json({ active: false });

        const checkoutDate = new Date(booking.checkout);
        checkoutDate.setHours(23, 59, 59, 999);
        
        // if checkout date already passed → no active booking
        if (currentDate > checkoutDate) {
            return res.json({ active: false });
        }

        // Otherwise: booking is still active
        res.json({ active: true });

    } catch (err) {
        res.json({ active: false });
    }
});

app.post("/cancel-booking", async (req, res) => {
    try {
        const { bookingId } = req.body;

        // 1️⃣ Find booking
        const booking = await Booking.findOne({ bookingId });
        if (!booking) {
            return res.json({ success: false, message: "Booking not found" });
        }

        const roomNumber = booking.roomNumber;

        // 2️⃣ Fetch Payment so we can keep GST
        const payment = await Payment.findOne({ bookingId });

        if (payment) {
            const total = booking.total;          // room + gst
            const roomTotal = booking.rate * booking.nights;
            const gstAmount = Math.round(roomTotal * 0.10);

            // 3️⃣ Update payment → keep GST only
            await Payment.updateOne(
                { bookingId },
                {
                    totalAmount: gstAmount,
                    note: "GST retained. Room amount refunded on cancellation."
                }
            );
        }

        // 4️⃣ Remove booking
        await Booking.deleteOne({ bookingId });

        // 5️⃣ Free the room
        await Room.updateOne(
            { roomNumber },
            { status: "Available" }
        );

        return res.json({
            success: true,
            message: "Booking cancelled. GST retained."
        });

    } catch (err) {
        return res.json({ success: false, message: err.message });
    }
});

app.post("/save-cancel-request", async (req, res) => {
    try {
        const { guestName, bookingId, reason } = req.body;

        await CancelRequests.create({
            guestName,
            bookingId,
            reason
        });

        res.json({ success: true });

    } catch (err) {
        res.json({ success: false, message: err.message });
    }
});

app.post("/delete-cancel-request", async (req, res) => {
    try {
        await CancelRequests.findByIdAndDelete(req.body.id);
        res.json({ success: true });
    } catch (err) {
        res.json({ success: false });
    }
});

app.get("/all-cancel-requests", async (req, res) => {
    try {
        const all = await CancelRequests.find().sort({ date: -1 });
        res.json({ success: true, requests: all });
    } catch (err) {
        res.json({ success: false });
    }
});

app.get("/all-bookings", async (req, res) => {
    try {
        const bookings = await Booking.find({ status: "Booked" });
        res.json({ success: true, bookings });
    } catch (err) {
        res.json({ success: false, message: err.message });
    }
});

app.get("/get-booking-details", async (req, res) => {
    try {
        const { username } = req.query;

        if (!username) {
            return res.json({ success: false, message: "Username missing" });
        }

        const booking = await Booking.findOne({
            guestUsername: username,
            status: "Booked"
        });

        if (!booking) {
            return res.json({ success: false, message: "No active booking" });
        }

        res.json({
            success: true,
            booking
        });

    } catch (err) {
        res.json({ success: false, message: err.message });
    }
});

const fs = require("fs");

// ⭐ GENERATE + UPLOAD INVOICE TO CLOUDINARY (Option 3)
app.post("/generate-invoice", async (req, res) => {
    try {
        const { bookingId, pdfBase64 } = req.body;

        // Save PDF temporarily
        const pdfPath = `Invoice_${bookingId}.pdf`;
        const pdfBuffer = Buffer.from(pdfBase64, "base64");
        fs.writeFileSync(pdfPath, pdfBuffer);

        // Upload to Cloudinary
        const upload = await cloudinary.uploader.upload(pdfPath, {
            folder: "hms_invoices",
            resource_type: "raw",
            format: "pdf"
        });

        // Delete local file
        fs.unlinkSync(pdfPath);

        return res.json({
            success: true,
            invoiceUrl: upload.secure_url
        });

    } catch (err) {
        console.log(err);
        res.json({ success: false, message: err.message });
    }
});

const axios = require("axios");
let otpStore = {}; // temporary OTP storage

// SEND OTP
app.post("/send-otp", async (req, res) => {
    try {
        const { contact } = req.body;

        if (!contact) {
            return res.json({ success: false, message: "Mobile number missing" });
        }

        const otp = Math.floor(100000 + Math.random() * 900000);

        otpStore[contact] = otp;
        setTimeout(() => delete otpStore[contact], 5 * 60 * 1000); // auto delete after 5 mins

        const apiKey = process.env.FAST2SMS_API_KEY;

        const response = await axios.post(
            "https://www.fast2sms.com/dev/bulkV2",
            {
                route: "v3",
                sender_id: "TXTIND",
                message: `Your HMS Deluxe OTP is ${otp}`,
                language: "english",
                flash: 0,
                numbers: contact
            },
            {
                headers: {
                    authorization: apiKey,
                    "Content-Type": "application/json"
                }
            }
        );

        return res.json({ success: true, message: "OTP sent!" });

    } catch (err) {
        return res.json({ success: false, message: err.message });
    }
});

// VERIFY OTP
app.post("/verify-otp", (req, res) => {
    const { contact, otp } = req.body;

    if (otpStore[contact] && otpStore[contact] == otp) {
        delete otpStore[contact];
        return res.json({ success: true, message: "OTP verified!" });
    }

    return res.json({ success: false, message: "Invalid OTP" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log("Server running on " + PORT);
});

