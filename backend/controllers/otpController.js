const nodemailer = require('nodemailer');
const crypto = require('crypto');
const User = require('../models/User');

// In-memory OTP store (expires after 10 min)
const otpStore = {};

// Gmail SMTP configuration
const createTransporter = () => {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // Use TLS
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });
};

let transporter;

const initializeTransporter = () => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      console.log('⚠️  Email credentials not configured in .env');
      return;
    }

    transporter = createTransporter();
    
    // Test connection without blocking
    transporter.verify((error, success) => {
      if (error) {
        console.log('⚠️  Email service error:', error.message);
        transporter = null;
      } else {
        console.log('✅ Email service connected');
      }
    });
  } catch (error) {
    console.log('⚠️  Email transporter init error:', error.message);
    transporter = null;
  }
};

// Initialize on startup
initializeTransporter();

/* ═══════════════════ SEND OTP ═══════════════════ */
exports.sendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    // Validate email
    if (!email || !email.trim()) {
      return res.status(400).json({ 
        message: 'Email is required',
        success: false 
      });
    }

    const trimmedEmail = email.trim().toLowerCase();

    // Check if email credentials are configured
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      return res.status(503).json({ 
        message: 'Email service not configured. Contact administrator.',
        success: false 
      });
    }

    // Check if user exists (any role)
    const user = await User.findOne({ email: trimmedEmail });
    if (!user) {
      return res.status(404).json({ 
        message: 'Email not registered.',
        success: false 
      });
    }

    // Generate 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Store OTP
    otpStore[trimmedEmail] = { 
      otp, 
      expiresAt,
      attempts: 0 
    };

    // Prepare email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: trimmedEmail,
      subject: '🔐 Readify User Portal - Your OTP',
      html: `
        <div style="font-family: 'DM Sans', sans-serif; max-width: 400px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #0f172a 0%, #1a1f3a 100%); border-radius: 8px; color: #fff;">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="font-size: 2rem;">📚</div>
            <h2 style="margin: 8px 0 0 0; font-size: 1.5rem;">Readify User</h2>
          </div>
          <p style="color: #bfdbfe; margin-bottom: 16px;">Your One-Time Password (OTP) is:</p>
          <div style="background: rgba(255, 255, 255, 0.1); padding: 16px; border-radius: 6px; text-align: center; margin-bottom: 20px;">
            <div style="font-size: 2rem; font-weight: 700; letter-spacing: 4px; font-family: 'JetBrains Mono', monospace; color: #f59e0b;">${otp}</div>
          </div>
          <p style="color: #9ca3af; font-size: 0.875rem; margin-bottom: 12px;">✓ This OTP expires in <strong>10 minutes</strong>.</p>
          <p style="color: #6b7280; font-size: 0.75rem; margin: 0;">⚠️ Never share this OTP with anyone. If you didn't request this, please ignore.</p>
        </div>
      `
    };

    // Ensure transporter exists
    if (!transporter) {
      transporter = createTransporter();
    }

    // Send email
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.log('❌ Email send failed:', error.message);
        return res.status(500).json({ 
          message: 'Failed to send OTP: ' + error.message,
          success: false 
        });
      }
      console.log('✅ OTP sent to:', trimmedEmail);
      res.status(200).json({ 
        message: 'OTP sent successfully to your email',
        email: trimmedEmail,
        success: true 
      });
    });

  } catch (error) {
    console.error('OTP Send Error:', error);
    res.status(500).json({ 
      message: 'Server error. Please try again later.',
      success: false 
    });
  }
};

/* ═══════════════════ VERIFY OTP ═══════════════════ */
exports.verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    // Validate input
    if (!email || !otp) {
      return res.status(400).json({ 
        message: 'Email and OTP are required',
        success: false 
      });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedOTP = otp.trim();

    // Check if OTP exists
    const stored = otpStore[trimmedEmail];
    if (!stored) {
      return res.status(400).json({ 
        message: 'OTP not found. Request a new OTP.',
        success: false 
      });
    }

    // Check if OTP expired
    if (Date.now() > stored.expiresAt) {
      delete otpStore[trimmedEmail];
      return res.status(400).json({ 
        message: 'OTP has expired. Request a new OTP.',
        success: false 
      });
    }

    // Check attempts
    if (stored.attempts >= 3) {
      delete otpStore[trimmedEmail];
      return res.status(429).json({ 
        message: 'Too many failed attempts. Request a new OTP.',
        success: false 
      });
    }

    // Verify OTP
    if (stored.otp !== trimmedOTP) {
      stored.attempts += 1;
      return res.status(400).json({ 
        message: `Invalid OTP. ${3 - stored.attempts} attempts remaining.`,
        success: false 
      });
    }

    // OTP verified - clean up
    delete otpStore[trimmedEmail];

    res.status(200).json({ 
      message: 'OTP verified successfully',
      verified: true,
      success: true 
    });

  } catch (error) {
    console.error('OTP Verify Error:', error);
    res.status(500).json({ 
      message: 'Verification failed. Please try again.',
      success: false 
    });
  }
};
