import axios from "axios";
import bcrypt from "bcrypt";
import express, { Request, Response } from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import AdminSchema from "../Schema/Adminschema";
import ScheduleSchema from "../Schema/Scheduleschema ";
import VisitSchema from "../Schema/Visitschema ";

const router = express.Router();

// Models (ensure schemas are exported as Schema objects only)
const Admin =
  mongoose.models.singupadmin || mongoose.model("singupadmin", AdminSchema);
const Schedule =
  mongoose.models.schedule || mongoose.model("schedule", ScheduleSchema);
const Visit = mongoose.models.visit || mongoose.model("visit", VisitSchema);

// LOGIN ADMIN
router.post("/login", async (req: Request, res: Response) => {
  console.log("Hello");
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ error: "Email and password are required." });
    }

    const user = await Admin.findOne({ email });

    if (!user.email || !user.password) {
      console.log(user.passowrd);
      return res.status(401).json({ error: "Wrong email or password." });
    }

    // Log for debugging (optional)
    // console.log("Entered password:", password);
    // console.log("Hashed password:", user.password);

    const isValidPassword = await bcrypt.compare(password, user.password);
    console.log(isValidPassword);
    if (!isValidPassword) {
      return res.status(401).json({ error: "Wrong email or password." });
    }

    const token = jwt.sign(
      { username: user.username, userId: user._id },
      process.env.JWT_SECRET || "your_jwt_secret",
      { expiresIn: "1h" }
    );

    return res.status(200).json({
      access_token: token,
      message: "Login successful!",
    });
  } catch (error) {
    console.error("Error during login:", error);
    return res.status(500).json({ error: "Server error, please try again." });
  }
});

// SCHEDULE MEETING
router.post("/schedule", async (req: Request, res: Response) => {
  try {
    const {
      date,
      time,
      email,
      phone,
      description,
      meetingPlatform,
      convertedTime,
      bangladeshTime,
    } = req.body;

    if (!date || !time || !email || !phone || !meetingPlatform) {
      return res
        .status(400)
        .json({ message: "All required fields must be filled!" });
    }

    const newSchedule = new Schedule({
      date,
      time,
      email,
      phone,
      description,
      meetingPlatform,
      convertedTime,
      bangladeshTime,
    });

    await newSchedule.save();

    return res.status(201).json({ message: "Meeting scheduled successfully!" });
  } catch (error) {
    console.error("Error saving schedule:", error);
    return res.status(500).json({ message: "Server error!", error });
  }
});

// GET ALL SCHEDULES
router.get("/getschedules", async (_req: Request, res: Response) => {
  try {
    const schedules = await Schedule.find().sort({ date: 1, time: 1 });
    return res.status(200).json(schedules);
  } catch (error) {
    console.error("Error fetching schedules:", error);
    return res.status(500).json({ message: "Server error!", error });
  }
});

// DELETE SCHEDULE
router.delete("/deleteschedule/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = await Schedule.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ message: "Schedule not found" });
    }

    return res.status(200).json({ message: "Schedule deleted successfully!" });
  } catch (error) {
    console.error("Error deleting schedule:", error);
    return res.status(500).json({ message: "Server error!", error });
  }
});

// TRACK VISIT
router.post("/track-visit", async (req: Request, res: Response) => {
  try {
    const { ip } = req.body;

    if (!ip) {
      return res.status(400).json({ error: "IP is required" });
    }

    const geo = await axios.get(`http://ip-api.com/json/${ip}`);
    const { country, city } = geo.data;

    const visit = new Visit({
      ip,
      country,
      city,
      timestamp: new Date(),
    });

    await visit.save();
    return res.json({ message: "Visit logged", country, city });
  } catch (error) {
    console.error("Error tracking visit:", error);
    return res.status(500).json({ error: "Failed to track visit" });
  }
});

// GET VISITS
router.get("/visits", async (_req: Request, res: Response) => {
  try {
    const visits = await Visit.find().sort({ timestamp: -1 });
    return res.json(visits);
  } catch (error) {
    console.error("Error fetching visits:", error);
    return res.status(500).json({ error: "Failed to fetch visits" });
  }
});

export default router;
