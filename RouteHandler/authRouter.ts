import express from "express";
import {
  confirmVerificationCode,
  login,
  refreshAccessToken,
  register,
  sendVerificationCode,
  verifyOtp,
} from "../controllers/authController";

const router = express.Router();

router.post("/send-verification-code", sendVerificationCode);
router.post("/register", register);
router.post("/confirm-code", confirmVerificationCode);
router.post("/login", login);
router.post("/refresh-token", refreshAccessToken);
router.post("/verify-otp", verifyOtp);

export default router;
