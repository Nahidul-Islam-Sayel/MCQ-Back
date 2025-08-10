import { Document, Schema } from "mongoose";

export interface ISchedule extends Document {
  date: string;
  time: string;
  email: string;
  phone: string;
  description?: string;
  meetingPlatform: string;
  convertedTime?: string;
  bangladeshTime?: string;
}

const ScheduleSchema: Schema<ISchedule> = new Schema({
  date: { type: String, required: true },
  time: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  description: { type: String },
  meetingPlatform: { type: String, required: true },
  convertedTime: { type: String },
  bangladeshTime: { type: String },
});

export default ScheduleSchema; // Export only schema
