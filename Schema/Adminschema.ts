// AdminSchema.ts
import { Document, Schema } from "mongoose";
import uniqueValidator from "mongoose-unique-validator";

export interface IAdmin extends Document {
  email: string;
  password: string;
}

const AdminSchema: Schema<IAdmin> = new Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
  },
});

AdminSchema.plugin(uniqueValidator);

export default AdminSchema; // export schema only, NOT the model
