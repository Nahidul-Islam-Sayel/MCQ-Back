import mongoose, { Document, Schema } from "mongoose";

export interface IQuestion extends Document {
  step: number;
  level: string;
  questionText: string;
  options: string[];
  correctOptionIndex: number;
}

const QuestionSchema: Schema<IQuestion> = new Schema(
  {
    step: { type: Number, required: true },
    level: { type: String, required: true },
    questionText: { type: String, required: true, trim: true },
    options: {
      type: [String],
      validate: {
        validator: function (arr: string[]) {
          return (
            Array.isArray(arr) &&
            arr.length === 4 &&
            arr.every((s) => typeof s === "string" && s.trim().length > 0)
          );
        },
        message: "Options must be an array of 4 non-empty strings",
      },
      required: true,
    },
    correctOptionIndex: { type: Number, required: true, min: 0, max: 3 },
  },
  { timestamps: true }
);

export default mongoose.model<IQuestion>("Question", QuestionSchema);
