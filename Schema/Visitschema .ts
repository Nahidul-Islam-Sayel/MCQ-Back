import { Document, Schema } from "mongoose";

export interface IVisit extends Document {
  ip: string;
  country: string;
  city: string;
  timestamp: Date;
}

const VisitSchema: Schema<IVisit> = new Schema({
  ip: { type: String, required: true },
  country: { type: String, required: true },
  city: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

export default VisitSchema;
