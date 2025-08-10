// RouteHandler/studentExam.ts
import express, { Request, Response } from "express";
import fs from "fs";
import { Types } from "mongoose";
import path from "path";
import PDFDocument from "pdfkit";
import Question from "../Schema/Question";
import Result from "../Schema/ResultSchema";

const router = express.Router();

interface Answer {
  questionId: string | Types.ObjectId;
  selectedIndex: number;
}

interface SubmitPayload {
  userId?: string;
  name: string;
  email?: string;
  step: number;
  level?: string;
  answers: Answer[];
}

const STEP_LEVELS: Record<number, string[]> = {
  1: ["A1", "A2"],
  2: ["B1", "B2"],
  3: ["C1", "C2"],
};

function decideCertification(step: number, percentage: number) {
  if (step === 1) {
    if (percentage < 25) return { certification: "Fail", proceed: false };
    if (percentage >= 25 && percentage < 50)
      return { certification: "A1 certified", proceed: false };
    if (percentage >= 50 && percentage < 75)
      return { certification: "A2 certified", proceed: false };
    if (percentage >= 75)
      return { certification: "A2 certified", proceed: true };
  }
  if (step === 2) {
    if (percentage < 25)
      return { certification: "Remain at A2", proceed: false };
    if (percentage >= 25 && percentage < 50)
      return { certification: "B1 certified", proceed: false };
    if (percentage >= 50 && percentage < 75)
      return { certification: "B2 certified", proceed: false };
    if (percentage >= 75)
      return { certification: "B2 certified", proceed: true };
  }
  if (step === 3) {
    if (percentage < 25)
      return { certification: "Remain at B2", proceed: false };
    if (percentage >= 25 && percentage < 50)
      return { certification: "C1 certified", proceed: false };
    if (percentage >= 50)
      return { certification: "C2 certified", proceed: false };
  }
  return { certification: "No certification", proceed: false };
}

// GET questions
router.get("/questions", async (req: Request, res: Response) => {
  try {
    const step = Number(req.query.step || 1);
    if (![1, 2, 3].includes(step)) {
      return res.status(400).json({ message: "step must be 1,2 or 3" });
    }

    const levels = STEP_LEVELS[step];
    const size = 44;

    const agg = [{ $match: { level: { $in: levels } } }, { $sample: { size } }];

    const questions = await Question.aggregate(agg);
    const clientQs = questions.map((q: any) => ({
      _id: q._id,
      questionText: q.questionText,
      options: q.options,
      step: q.step,
      level: q.level,
    }));

    res.json({ questions: clientQs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST submit
router.post(
  "/submit",
  async (req: Request<{}, {}, SubmitPayload>, res: Response) => {
    try {
      const { userId, name, email, step, level, answers } = req.body;

      if (!name || typeof step !== "number" || !Array.isArray(answers)) {
        return res.status(400).json({ message: "Invalid payload" });
      }

      if (userId) {
        const latestStep1 = await Result.findOne({ userId, step: 1 }).sort({
          createdAt: -1,
        });
        if (latestStep1 && latestStep1.certification === "Fail" && step === 1) {
          return res
            .status(403)
            .json({ message: "No retake allowed after Fail on Step 1" });
        }
      }

      const qIds = answers.map((a) => new Types.ObjectId(a.questionId));
      const questions = await Question.find({ _id: { $in: qIds } });

      const qMap = new Map<string, any>();
      questions.forEach((q) => qMap.set(q._id.toString(), q));

      let score = 0;
      answers.forEach((a) => {
        const q = qMap.get(a.questionId.toString());
        if (!q) return;
        if (a.selectedIndex === q.correctOptionIndex) score++;
      });

      const total = answers.length;
      const percentage = total === 0 ? 0 : (score / total) * 100;
      const { certification, proceed } = decideCertification(step, percentage);

      // Upsert: update existing result for userId + step or create new
      const filter = { userId: userId || null, step };
      const update = {
        userId: userId || null,
        name,
        email: email || null,
        step,
        level,
        score,
        total,
        percentage,
        certification,
        answers,
        updatedAt: new Date(),
      };
      const options = { upsert: true, new: true, setDefaultsOnInsert: true };

      // findOneAndUpdate returns the updated or created doc
      const result = await Result.findOneAndUpdate(filter, update, options);

      if (!result) {
        return res
          .status(500)
          .json({ message: "Failed to save or update result" });
      }

      let certificateUrl: string | null = null;
      if (
        certification !== "Fail" &&
        !certification.startsWith("Remain") &&
        certification !== "No certification"
      ) {
        const certsDir = path.join(process.cwd(), "certs");
        if (!fs.existsSync(certsDir))
          fs.mkdirSync(certsDir, { recursive: true });

        const filename = `certificate_${result._id}.pdf`;
        const filepath = path.join(certsDir, filename);

        const doc = new PDFDocument({ size: "A4", margin: 48 });
        const stream = fs.createWriteStream(filepath);
        doc.pipe(stream);

        doc
          .fontSize(22)
          .text("Certificate of Achievement", { align: "center" });
        doc.moveDown(1.5);
        doc.fontSize(16).text(`This certifies that`, { align: "center" });
        doc.moveDown(0.5);
        doc.fontSize(20).text(name, { align: "center", underline: true });
        doc.moveDown(0.6);
        doc
          .fontSize(14)
          .text(`has achieved: ${certification}`, { align: "center" });
        doc.moveDown(0.6);
        doc.fontSize(12).text(`Step: ${step} | Level recorded: ${level}`, {
          align: "center",
        });
        doc.moveDown(0.4);
        doc
          .fontSize(12)
          .text(`Score: ${score} / ${total} (${percentage.toFixed(2)}%)`, {
            align: "center",
          });
        doc.moveDown(1.2);
        doc
          .fontSize(10)
          .text(`Issued: ${new Date().toLocaleString()}`, { align: "center" });

        doc.end();

        await new Promise<void>((resolve, reject) => {
          stream.on("finish", () => resolve());
          stream.on("error", (err) => reject(err));
        });

        certificateUrl = `/certs/${filename}`;
      }

      res.json({
        savedResult: result,
        certification,
        percentage,
        proceedToNextStep: proceed,
        certificateUrl,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// GET latest result
router.get("/latest-result", async (req: Request, res: Response) => {
  try {
    const { userId, step } = req.query;
    if (!userId || !step) {
      return res.status(400).json({ message: "userId and step required" });
    }
    const result = await Result.findOne({
      userId: String(userId),
      step: Number(step),
    }).sort({ createdAt: -1 });
    res.json({ result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// In your studentExam router file (RouteHandler/studentExam.ts)
router.get("/all-results", async (req, res) => {
  try {
    const results = await Result.find().sort({ createdAt: -1 });
    // Map results to include certificateUrl if file exists
    const mappedResults = results.map((r) => ({
      _id: r._id,
      userId: r.userId,
      name: r.name,
      email: r.email,
      step: r.step,
      level: r.level,
      score: r.score,
      total: r.total,
      percentage: r.percentage,
      certification: r.certification,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      certificateUrl: r._id ? `/certs/certificate_${r._id}.pdf` : null,
    }));

    res.json({ results: mappedResults });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/user-exams/:userid", async (req: Request, res: Response) => {
  const { userid } = req.params;

  if (!userid) {
    return res.status(400).json({ error: "User ID is required" });
  }

  try {
    // Find all exam results for this user, sorted by creation date descending
    const results = await Result.find({ userId: userid }).sort({
      createdAt: -1,
    });

    // Map results to send only the needed fields for frontend
    const mappedResults = results.map((r) => ({
      _id: r._id,
      step: r.step,
      level: r.level,
      score: r.score,
      total: r.total,
      percentage: r.percentage,
      certification: r.certification,
      date: r.createdAt,
    }));

    return res.json(mappedResults);
  } catch (error) {
    console.error("Error fetching user exam attempts:", error);
    return res.status(500).json({ error: "Server error" });
  }
});

router.get("/user-exams/:userid", async (req: Request, res: Response) => {
  try {
    const { userid } = req.params;
    if (!userid) return res.status(400).json({ error: "userid required" });

    const results = await Result.find({ userId: userid }).sort({
      createdAt: -1,
    });

    const mapped = results.map((r) => {
      const filename = `certificate_${r._id}.pdf`;
      const certPath = path.join(process.cwd(), "certs", filename);
      const exists = fs.existsSync(certPath);
      return {
        _id: r._id,
        step: r.step,
        level: r.level,
        score: r.score,
        total: r.total,
        percentage: r.percentage,
        certification: r.certification,
        date: r.createdAt,
        certificateUrl: exists ? `/certs/${filename}` : null,
      };
    });

    return res.json(mapped);
  } catch (err) {
    console.error("Error fetching user exams:", err);
    return res.status(500).json({ error: "Server error" });
  }
});
export default router;
