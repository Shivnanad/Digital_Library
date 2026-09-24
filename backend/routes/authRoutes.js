const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const User = require("../models/User");
const { requireAuth } = require("../middlewares/authMiddleware");

const router = express.Router();

// In-memory state for password-change OTP flow.
const passwordOtpStore = {};

function createMailTransporter() {
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });
}

/* ── Multer: save profile pictures to /public/avatars ── */
const avatarDir = path.join(__dirname, '..', 'public', 'avatars');
if (!fs.existsSync(avatarDir)) fs.mkdirSync(avatarDir, { recursive: true });

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, avatarDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `avatar_${req.user._id}_${Date.now()}${ext}`);
  }
});
const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) return cb(null, true);
    cb(new Error("Only image files (jpg, png, gif, webp) are allowed"));
  }
});

/* REGISTER */
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields required" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword
    });

    res.status(201).json({ message: "Registration successful" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Registration failed" });
  }
});

/* LOGIN */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET || "secretkey",
      { expiresIn: "7d" }
    );

    // Determine if this user should see onboarding.
    // Only brand-new users (created within the last 2 minutes) who haven't
    // completed onboarding should see it. All older accounts are treated
    // as pre-existing users and auto-skip the onboarding.
    let onboardingCompleted = user.onboardingCompleted;
    if (!onboardingCompleted) {
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
      if (user.createdAt < twoMinutesAgo) {
        // This is a pre-existing user — auto-complete their onboarding
        onboardingCompleted = true;
        user.onboardingCompleted = true;
      }
    }

    // Update lastLogin timestamp
    user.lastLogin = new Date();
    await user.save();

    res.json({
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profilePic: user.profilePic,
        onboardingCompleted: onboardingCompleted
      }
    });
  } catch (err) {
    res.status(500).json({ message: "Login failed" });
  }
});

/* ── UPLOAD PROFILE PICTURE ── */
router.put("/profile-pic", requireAuth, avatarUpload.single("profilePic"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No image file provided" });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Delete old avatar file if it exists
    if (user.profilePic) {
      const oldFile = path.join(__dirname, '..', 'public', user.profilePic.replace(/^\//, ''));
      if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
    }

    // Save new path
    user.profilePic = `/avatars/${req.file.filename}`;
    await user.save();

    res.json({
      message: "Profile picture updated",
      profilePic: user.profilePic
    });
  } catch (err) {
    console.error("Profile pic upload error:", err);
    res.status(500).json({ message: "Failed to upload profile picture" });
  }
});

/* ── REMOVE PROFILE PICTURE ── */
router.delete("/profile-pic", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Delete file
    if (user.profilePic) {
      const filePath = path.join(__dirname, '..', 'public', user.profilePic.replace(/^\//, ''));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    user.profilePic = null;
    await user.save();

    res.json({ message: "Profile picture removed" });
  } catch (err) {
    console.error("Profile pic remove error:", err);
    res.status(500).json({ message: "Failed to remove profile picture" });
  }
});

/* ── SEND PASSWORD CHANGE OTP (auth user only) ── */
router.post("/password-change/send-otp", requireAuth, async (req, res) => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      return res.status(503).json({ message: "Email service is not configured" });
    }

    const email = String(req.user?.email || "").trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ message: "Authenticated user email missing" });
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000;

    passwordOtpStore[email] = {
      otp,
      expiresAt,
      attempts: 0,
      verified: false,
      verifiedAt: null,
    };

    const transporter = createMailTransporter();
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Readify Password Change OTP",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 460px; margin: 0 auto; padding: 18px; background: #111827; color: #e5e7eb; border-radius: 10px;">
          <h2 style="margin: 0 0 12px; color: #f59e0b;">Readify Security Check</h2>
          <p style="margin: 0 0 14px;">Use this OTP to verify your password change request:</p>
          <div style="font-size: 30px; font-weight: 700; letter-spacing: 6px; text-align: center; color: #fbbf24; margin: 12px 0 16px;">${otp}</div>
          <p style="margin: 0 0 8px; color: #cbd5e1;">This OTP expires in 10 minutes.</p>
          <p style="margin: 0; color: #94a3b8; font-size: 12px;">If you did not request this, ignore this email.</p>
        </div>
      `,
    });

    res.json({ message: "OTP sent to your registered email" });
  } catch (err) {
    console.error("password-change/send-otp error:", err);
    res.status(500).json({ message: "Failed to send OTP" });
  }
});

/* ── VERIFY PASSWORD CHANGE OTP ── */
router.post("/password-change/verify-otp", requireAuth, async (req, res) => {
  try {
    const email = String(req.user?.email || "").trim().toLowerCase();
    const otpInput = String(req.body?.otp || "").trim();

    if (!otpInput) return res.status(400).json({ message: "OTP is required" });

    const entry = passwordOtpStore[email];
    if (!entry) return res.status(400).json({ message: "No OTP request found. Send OTP first." });

    if (Date.now() > entry.expiresAt) {
      delete passwordOtpStore[email];
      return res.status(400).json({ message: "OTP expired. Send OTP again." });
    }

    if (entry.attempts >= 3) {
      delete passwordOtpStore[email];
      return res.status(429).json({ message: "Too many invalid attempts. Send OTP again." });
    }

    if (entry.otp !== otpInput) {
      entry.attempts += 1;
      return res.status(400).json({ message: `Invalid OTP. ${Math.max(0, 3 - entry.attempts)} attempt(s) left.` });
    }

    entry.verified = true;
    entry.verifiedAt = Date.now();

    res.json({ message: "OTP verified successfully" });
  } catch (err) {
    console.error("password-change/verify-otp error:", err);
    res.status(500).json({ message: "Failed to verify OTP" });
  }
});

/* ── UPDATE PASSWORD AFTER OTP VERIFICATION ── */
router.post("/password-change/update", requireAuth, async (req, res) => {
  try {
    const email = String(req.user?.email || "").trim().toLowerCase();
    const { newPassword } = req.body || {};
    const cleanPassword = String(newPassword || "");

    if (cleanPassword.length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters" });
    }

    const entry = passwordOtpStore[email];
    if (!entry || !entry.verified) {
      return res.status(400).json({ message: "OTP not verified" });
    }

    if (!entry.verifiedAt || Date.now() - entry.verifiedAt > 10 * 60 * 1000) {
      delete passwordOtpStore[email];
      return res.status(400).json({ message: "Verification expired. Please verify OTP again." });
    }

    const hashedPassword = await bcrypt.hash(cleanPassword, 10);
    await User.findByIdAndUpdate(req.user._id, { password: hashedPassword });

    delete passwordOtpStore[email];

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    console.error("password-change/update error:", err);
    res.status(500).json({ message: "Failed to update password" });
  }
});

/* ── COMPLETE ONBOARDING ── */
router.post("/complete-onboarding", requireAuth, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { onboardingCompleted: true });
    res.json({ message: "Onboarding completed" });
  } catch (err) {
    console.error("complete-onboarding error:", err);
    res.status(500).json({ message: "Failed to complete onboarding" });
  }
});

/* ── SAVE READING PREFERENCES ── */
router.post("/save-preferences", requireAuth, async (req, res) => {
  try {
    const { favoriteGenres, readingFrequency, readingGoal, preferredFormat, excitedAbout } = req.body;
    await User.findByIdAndUpdate(req.user._id, {
      readingPreferences: {
        favoriteGenres: favoriteGenres || [],
        readingFrequency: readingFrequency || "",
        readingGoal: readingGoal || "",
        preferredFormat: preferredFormat || "",
        excitedAbout: excitedAbout || ""
      },
      onboardingCompleted: true
    });
    res.json({ message: "Preferences saved" });
  } catch (err) {
    console.error("save-preferences error:", err);
    res.status(500).json({ message: "Failed to save preferences" });
  }
});

module.exports = router;
