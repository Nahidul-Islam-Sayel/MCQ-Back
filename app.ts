import cors from "cors";
import dotenv from "dotenv";
import express, { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import path from "path";
import AdminLoginHandler from "./RouteHandler/AdminLoginHandeler";
import authRouter from "./RouteHandler/authRouter";
import examRoutes from "./RouteHandler/examRoute";
import AdminAddQuestion from "./RouteHandler/QutionHandeler";
import StudensExam from "./RouteHandler/studentExam";
import StudentsProfileHander from "./RouteHandler/StudentsProfileHander";
dotenv.config();

const app = express();

mongoose
  .connect(process.env.MONGODB_URI || "")
  .then(() => {
    console.log("Connection successful");
  })
  .catch((err) => console.log(err));

app.use(express.json());

// Only one CORS middleware with options:
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

app.use("/SingUpAdmin", AdminLoginHandler);
app.use("/AdminAddQuestion", AdminAddQuestion);
app.use("/StudentsSection", authRouter);
app.use("/StudentsProfile", StudentsProfileHander);
app.use("/StudentsExam", StudensExam);

app.use("/certs", express.static(path.join(process.cwd(), "certs")));
app.use("/exam", examRoutes);

// Error handler middleware
const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (res.headersSent) {
    return next(err);
  }
  res.status(500).json({ error: err.message || err });
};

app.use(errorHandler);

console.log("SMTP_HOST:", process.env.SMTP_HOST);

export default app;
