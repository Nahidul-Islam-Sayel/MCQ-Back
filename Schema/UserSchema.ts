import mongoose, { Document, Schema } from "mongoose";

export interface IUser extends Document {
  name?: string;
  email: string;
  password?: string;
  country?: string;
  dob?: Date;
  emailVerified: boolean;
  verificationCode?: string;
  verificationCodeExpires?: Date;
  refreshToken?: string;
}

const UserSchema: Schema = new Schema({
  name: { type: String },
  email: { type: String, required: true, unique: true },
  password: { type: String },
  country: { type: String },
  dob: { type: Date },
  emailVerified: { type: Boolean, default: false },
  verificationCode: { type: String },
  verificationCodeExpires: { type: Date },
  refreshToken: { type: String },
});

export default mongoose.model<IUser>("User", UserSchema);
