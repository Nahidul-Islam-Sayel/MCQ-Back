// models/Result.ts
import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IAnswer {
  questionId: Types.ObjectId;
  selectedIndex: number; // -1 if no answer
}

export interface IResult extends Document {
  userId?: string | null;
  name: string;
  email?: string | null;
  step: number;
  level: string;
  score: number;
  total: number;
  percentage: number;
  certification: string;
  answers: IAnswer[];
  createdAt?: Date;
  updatedAt?: Date;
}

const AnswerSchema = new Schema<IAnswer>(
  {
    questionId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Question",
    },
    selectedIndex: { type: Number, required: true },
  },
  { _id: false }
);

const ResultSchema = new Schema<IResult>(
  {
    userId: { type: String, default: null },
    name: { type: String, required: true },
    email: { type: String, default: null },
    step: { type: Number, required: true },
    level: { type: String, required: true },
    score: { type: Number, required: true },
    total: { type: Number, required: true },
    percentage: { type: Number, required: true },
    certification: { type: String, required: true },
    answers: [AnswerSchema],
  },
  { timestamps: true }
);

const Result: Model<IResult> =
  mongoose.models.Result || mongoose.model<IResult>("Result", ResultSchema);

export default Result;
