// routes/exam.ts
import express, { Request, Response } from "express";
import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import Question from "../Schema/Questionschema"; // path to your Question schema
import Result from "../Schema/ResultSchema";

const router = express.Router();

// mapping levels by step
const STEP_LEVELS: Record<number, string[]> = {
  1: ["A1", "A2"],
  2: ["B1", "B2"],
  3: ["C1", "C2"],
};

const CERT_RULES = (
  step: number,
  level: string,
  percentage: number,
  total: number
) => {
  // returns certification string & whether proceed to next step
  // Based exactly on your rules
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
  // fallback
  return { certification: "No certification", proceed: false };
};

// GET /exam/questions?step=1
// returns up to 44 random questions for the two levels in that step
router.get("/questions", async (req: Request, res: Response) => {
  try {
    const step = Number(req.query.step || 1);
    if (![1, 2, 3].includes(step))
      return res.status(400).json({ message: "step must be 1,2 or 3" });

    const levels = STEP_LEVELS[step];
    // sample equally from both levels, but simpler: sample from both combined
    const desired = 44;
    // Use aggregation for random sampling
    const questions = await Question.aggregate([
      { $match: { level: { $in: levels } } },
      { $sample: { size: desired } },
      { $sort: { createdAt: 1 } }, // optional
    ]);
    return res.json({ questions });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
});

// POST /exam/submit
// body: { userId?, name, email?, step, level, answers: [{questionId, selectedIndex}], timeTakenSeconds }
router.post("/submit", async (req: Request, res: Response) => {
  try {
    const { userId, name, email, step, level, answers } = req.body;
    if (
      !name ||
      typeof step !== "number" ||
      !level ||
      !Array.isArray(answers)
    ) {
      return res.status(400).json({ message: "Invalid payload" });
    }

    // Fetch the questions referenced to compute correctness
    const questionIds = answers.map((a: any) => a.questionId);
    const questions = await Question.find({ _id: { $in: questionIds } });

    const questionMap: Record<string, any> = {};
    questions.forEach((q) => (questionMap[q._id.toString()] = q));

    let score = 0;
    answers.forEach((a: any) => {
      const q = questionMap[a.questionId];
      if (!q) return;
      if (q.correctOptionIndex === a.selectedIndex) score += 1;
    });

    const total = answers.length;
    const percentage = total === 0 ? 0 : (score / total) * 100;

    const { certification, proceed } = CERT_RULES(
      step,
      level,
      percentage,
      total
    );

    // Save result
    const saved = await Result.create({
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
    });

    // generate certificate PDF if certification is not Fail/Remain and is a certification string containing 'certified' or C1/C2
    const certsDir = path.join(process.cwd(), "certs");
    if (!fs.existsSync(certsDir)) fs.mkdirSync(certsDir, { recursive: true });

    let certificatePath: string | null = null;
    if (
      certification !== "Fail" &&
      !certification.startsWith("Remain") &&
      certification !== "No certification"
    ) {
      // create PDF
      const filename = `certificate_${saved._id}.pdf`;
      const filepath = path.join(certsDir, filename);

      const doc = new PDFDocument({ size: "A4", margin: 50 });
      const writeStream = fs.createWriteStream(filepath);
      doc.pipe(writeStream);

      // certificate content (simple)
      doc.fontSize(20).text("Certification", { align: "center" });
      doc.moveDown(1);
      doc.fontSize(16).text(`${name}`, { align: "center" });
      doc.moveDown(0.5);
      doc
        .fontSize(14)
        .text(`has achieved: ${certification}`, { align: "center" });
      doc.moveDown(0.5);
      doc
        .fontSize(12)
        .text(`Step: ${step} | Level: ${level}`, { align: "center" });
      doc.moveDown(0.5);
      doc
        .fontSize(12)
        .text(`Score: ${score} / ${total} (${percentage.toFixed(2)}%)`, {
          align: "center",
        });
      doc.moveDown(2);
      doc
        .fontSize(10)
        .text(`Issued: ${new Date().toLocaleString()}`, { align: "center" });

      doc.end();

      // wait for stream finish before responding with URL
      await new Promise<void>((resolve, reject) => {
        writeStream.on("finish", () => resolve());
        writeStream.on("error", (e) => reject(e));
      });

      certificatePath = `/certs/${filename}`; // you must serve /certs as static later
    }

    // Return result and certificate path and whether proceed to next step
    return res.json({
      savedResult: saved,
      certification,
      percentage,
      proceedToNextStep: proceed,
      certificateUrl: certificatePath ? certificatePath : null,
    });
  } catch (error) {
    console.error("submit error", error);
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
