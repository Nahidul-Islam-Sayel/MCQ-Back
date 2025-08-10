// In your Express router file
import express from "express";
import User from "../Schema/UserSchema";

const router = express.Router();

router.get("/user/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select(
      "-password -refreshToken -verificationCode -verificationCodeExpires"
    );
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
