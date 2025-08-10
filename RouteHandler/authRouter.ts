import express from "express";
import {
  confirmVerificationCode,
  login,
  refreshAccessToken,
  register,
  resetPassword,
  resetPasswordWithCode,
  sendResetCode,
  sendVerificationCode,
  verifyOtp,
  verifyResetCode,
} from "../controllers/authController";

const router = express.Router();

router.post("/send-verification-code", sendVerificationCode);
router.post("/register", register);
router.post("/confirm-code", confirmVerificationCode);
router.post("/login", login);
router.post("/refresh-token", refreshAccessToken);
router.post("/verify-otp", verifyOtp);
router.post("/reset-password", resetPassword);
router.post("/forgot-password", sendResetCode);
router.post("/verify-reset-code", verifyResetCode);
router.post("/reset-password-with-code", resetPasswordWithCode);

export default router;
