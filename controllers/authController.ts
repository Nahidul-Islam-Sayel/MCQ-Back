import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import User from "../Schema/UserSchema";
import { sendVerificationEmail } from "../utils/mailer";
dotenv.config();
// Load secrets from env or fallback strings (replace fallback strings in production!)
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET!;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET!;

const VERIFICATION_CODE_EXPIRY_MINUTES = 10;
const RESET_CODE_EXPIRY_MINUTES = 10;
// Token expiration times
const ACCESS_TOKEN_EXPIRES = "15m";
const REFRESH_TOKEN_EXPIRES = "7d";

// Helper: generate access token
function generateAccessToken(userId: string) {
  return jwt.sign({ userId }, ACCESS_TOKEN_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES,
  });
}

// Helper: generate refresh token
function generateRefreshToken(userId: string) {
  return jwt.sign({ userId }, REFRESH_TOKEN_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRES,
  });
}

// Send verification code to email
export async function sendVerificationCode(req: Request, res: Response) {
  try {
    const { email } = req.body;
    if (!email)
      return res.status(400).json({ success: false, error: "Email required" });

    const user = await User.findOne({ email });

    if (user && user.emailVerified) {
      return res
        .status(400)
        .json({ success: false, error: "Email already verified" });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiryDate = new Date(
      Date.now() + VERIFICATION_CODE_EXPIRY_MINUTES * 60 * 1000
    );

    if (user) {
      user.verificationCode = code;
      user.verificationCodeExpires = expiryDate;
      await user.save();
    } else {
      const newUser = new User({
        email,
        verificationCode: code,
        verificationCodeExpires: expiryDate,
        emailVerified: false,
      });
      await newUser.save();
    }

    await sendVerificationEmail(email, code);

    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
}

// Confirm verification code from email
export async function confirmVerificationCode(req: Request, res: Response) {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res
        .status(400)
        .json({ success: false, error: "Email and code are required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ success: false, error: "User not found" });
    }

    if (user.verificationCode !== code) {
      return res.status(400).json({ success: false, error: "Invalid code" });
    }

    if (
      user.verificationCodeExpires &&
      user.verificationCodeExpires < new Date()
    ) {
      return res.status(400).json({ success: false, error: "Code expired" });
    }

    user.emailVerified = true;
    user.verificationCode = undefined;
    user.verificationCodeExpires = undefined;
    await user.save();

    return res.json({ success: true, message: "Email verified successfully" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
}

// Register a new user with full details
export async function register(req: Request, res: Response) {
  try {
    const { name, email, password, country, dob } = req.body;

    if (!name || !email || !password || !country || !dob) {
      return res
        .status(400)
        .json({ success: false, error: "All fields are required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({
        success: false,
        error: "User not found. Please verify email first.",
      });
    }

    if (
      user.verificationCodeExpires &&
      user.verificationCodeExpires < new Date()
    ) {
      return res
        .status(400)
        .json({ success: false, error: "Verification code expired" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    user.name = name;
    user.password = hashedPassword;
    user.country = country;
    user.dob = new Date(dob);
    user.emailVerified = true;
    user.verificationCode = undefined;
    user.verificationCodeExpires = undefined;

    await user.save();

    return res.json({ success: true, message: "User registered successfully" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
}

// Login - generate tokens on successful login
export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res
        .status(400)
        .json({ success: false, error: "Email and password required" });

    const user = await User.findOne({ email });

    if (!user) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid credentials" });
    }

    if (!user.password) {
      return res
        .status(400)
        .json({ success: false, error: "Please complete registration first" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch)
      return res
        .status(400)
        .json({ success: false, error: "Invalid credentials" });

    // Generate OTP code (6-digit)
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    // Or for stronger OTP, you can use crypto:
    // const otpCode = crypto.randomInt(100000, 999999).toString();

    // Set OTP expiry (10 minutes from now)
    const otpExpiry = new Date(
      Date.now() + VERIFICATION_CODE_EXPIRY_MINUTES * 60 * 1000
    );

    // Save OTP and expiry in user record
    user.verificationCode = otpCode;
    user.verificationCodeExpires = otpExpiry;

    await user.save();

    // Send OTP email
    await sendVerificationEmail(email, otpCode);

    // Respond with success, but do NOT send tokens yet
    return res.json({ success: true, message: "OTP sent to your email." });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
}

// Refresh access token using refresh token cookie
export async function refreshAccessToken(req: Request, res: Response) {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken)
      return res
        .status(401)
        .json({ success: false, error: "No refresh token provided" });

    const decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET) as {
      userId: string;
    };

    const user = await User.findById(decoded.userId);
    if (!user || user.refreshToken !== refreshToken) {
      return res
        .status(403)
        .json({ success: false, error: "Invalid refresh token" });
    }

    const newAccessToken = generateAccessToken(user._id.toString());
    return res.json({ success: true, accessToken: newAccessToken });
  } catch (err) {
    console.error(err);
    return res
      .status(403)
      .json({ success: false, error: "Invalid or expired refresh token" });
  }
}
// In authController.ts

export async function verifyOtp(req: Request, res: Response) {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res
        .status(400)
        .json({ success: false, error: "Email and OTP are required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ success: false, error: "User not found" });
    }

    if (user.verificationCode !== otp) {
      return res.status(400).json({ success: false, error: "Invalid OTP" });
    }

    if (
      user.verificationCodeExpires &&
      user.verificationCodeExpires < new Date()
    ) {
      return res.status(400).json({ success: false, error: "OTP expired" });
    }

    // OTP is valid: clear it and generate tokens
    user.verificationCode = undefined;
    user.verificationCodeExpires = undefined;

    // Generate tokens
    const accessToken = generateAccessToken(user._id.toString());
    const refreshToken = generateRefreshToken(user._id.toString());
    user.refreshToken = refreshToken;

    await user.save();

    // Send refresh token as cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Send accessToken and userId in response
    return res.json({ success: true, accessToken, userid: user._id });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
}
// Reset password (authenticated users only)
export async function resetPassword(req: Request, res: Response) {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res
        .status(400)
        .json({ success: false, error: "All fields are required" });
    }

    // Extract user ID from the access token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ success: false, error: "No token provided" });
    }
    const token = authHeader.split(" ")[1];

    let decoded;
    try {
      decoded = jwt.verify(token, ACCESS_TOKEN_SECRET) as { userId: string };
    } catch {
      return res
        .status(403)
        .json({ success: false, error: "Invalid or expired token" });
    }

    // Find user by decoded ID
    const user = await User.findById(decoded.userId);
    if (!user || !user.password) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    // Compare old password
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res
        .status(400)
        .json({ success: false, error: "Old password is incorrect" });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    user.password = hashedPassword;
    await user.save();

    return res.json({ success: true, message: "Password reset successfully" });
  } catch (error) {
    console.error("Error resetting password:", error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
}

export async function sendResetCode(req: Request, res: Response) {
  try {
    const { email } = req.body;
    if (!email)
      return res.status(400).json({ success: false, error: "Email required" });

    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal whether email exists for privacy — but client needs real user flow.
      // If you want to inform user, return 404. Here we return 400.
      return res
        .status(400)
        .json({ success: false, error: "User with this email not found" });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiryDate = new Date(
      Date.now() + RESET_CODE_EXPIRY_MINUTES * 60 * 1000
    );

    user.verificationCode = code;
    user.verificationCodeExpires = expiryDate;
    await user.save();

    // sendVerificationEmail already present in your project
    await sendVerificationEmail(email, code);

    return res.json({ success: true, message: "Reset code sent to email." });
  } catch (err) {
    console.error("sendResetCode error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
}

export async function verifyResetCode(req: Request, res: Response) {
  try {
    const { email, code } = req.body;
    if (!email || !code)
      return res
        .status(400)
        .json({ success: false, error: "Email and code required" });

    const user = await User.findOne({ email });
    if (!user)
      return res.status(400).json({ success: false, error: "User not found" });

    if (!user.verificationCode || user.verificationCode !== code) {
      return res.status(400).json({ success: false, error: "Invalid code" });
    }

    if (
      user.verificationCodeExpires &&
      user.verificationCodeExpires < new Date()
    ) {
      return res.status(400).json({ success: false, error: "Code expired" });
    }

    // Optionally clear code here or keep it until password is set. We'll allow it but keep it valid.
    return res.json({ success: true, message: "Code verified" });
  } catch (err) {
    console.error("verifyResetCode error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
}

export async function resetPasswordWithCode(req: Request, res: Response) {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword)
      return res.status(400).json({
        success: false,
        error: "Email, code and new password required",
      });

    const user = await User.findOne({ email });
    if (!user)
      return res.status(400).json({ success: false, error: "User not found" });

    if (!user.verificationCode || user.verificationCode !== code) {
      return res.status(400).json({ success: false, error: "Invalid code" });
    }

    if (
      user.verificationCodeExpires &&
      user.verificationCodeExpires < new Date()
    ) {
      return res.status(400).json({ success: false, error: "Code expired" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(newPassword, salt);
    user.password = hashed;

    // clear OTP/code fields
    user.verificationCode = undefined;
    user.verificationCodeExpires = undefined;
    await user.save();

    return res.json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (err) {
    console.error("resetPasswordWithCode error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
}
