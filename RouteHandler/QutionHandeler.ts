import express, { Request, Response } from "express";
import Question from "../Schema/Questionschema";

const router = express.Router();

// GET questions by step + level
router.get("/", async (req: Request, res: Response) => {
  try {
    const step = Number(req.query.step);
    const level = String(req.query.level);

    if (!step || !level) {
      return res
        .status(400)
        .json({ message: "step and level query params are required" });
    }

    const questions = await Question.find({ step, level }).sort({
      createdAt: 1,
    });
    res.json(questions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

// GET count for step + level
router.get("/count", async (req: Request, res: Response) => {
  try {
    const step = Number(req.query.step);
    const level = String(req.query.level);

    if (!step || !level) {
      return res
        .status(400)
        .json({ message: "step and level query params are required" });
    }

    const count = await Question.countDocuments({ step, level });
    res.json({ count });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

// POST create question (enforce max 22 per step+level)
router.post("/", async (req: Request, res: Response) => {
  try {
    const { step, level, questionText, options, correctOptionIndex } = req.body;

    if (
      typeof step !== "number" ||
      !level ||
      !questionText ||
      !Array.isArray(options) ||
      options.length !== 4 ||
      typeof correctOptionIndex !== "number"
    ) {
      return res.status(400).json({ message: "Invalid request body" });
    }

    const existingCount = await Question.countDocuments({ step, level });
    if (existingCount >= 22) {
      return res.status(400).json({
        message: "Limit reached: max 22 questions per step and level",
      });
    }

    const question = new Question({
      step,
      level,
      questionText,
      options,
      correctOptionIndex,
    });
    const saved = await question.save();

    res.status(201).json(saved);
  } catch (error: any) {
    console.error(error);
    if (error.name === "ValidationError") {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: "Server error" });
  }
});

// PUT update question by id
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    console.log("PUT /:id called with id:", id); // Debug log

    const { step, level, questionText, options, correctOptionIndex } = req.body;

    if (
      typeof step !== "number" ||
      !level ||
      !questionText ||
      !Array.isArray(options) ||
      options.length !== 4 ||
      typeof correctOptionIndex !== "number"
    ) {
      return res.status(400).json({ message: "Invalid request body" });
    }

    const updated = await Question.findByIdAndUpdate(
      id,
      { step, level, questionText, options, correctOptionIndex },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Question not found" });
    }

    res.json(updated);
  } catch (error: any) {
    console.error(error);
    if (error.name === "ValidationError") {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE question by id
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    console.log("DELETE /:id called with id:", id); // Debug log

    const removed = await Question.findByIdAndDelete(id);
    if (!removed) {
      return res.status(404).json({ message: "Question not found" });
    }
    res.json({ message: "Deleted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
