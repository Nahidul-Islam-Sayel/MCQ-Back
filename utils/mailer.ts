import dotenv from "dotenv";
dotenv.config(); // Load env variables here or from main entry point

import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: false, // false for port 587 with STARTTLS
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendVerificationEmail(email: string, code: string) {
  const mailOptions = {
    from: `"Pro Coder Hero" <${process.env.SMTP_USER}>`,
    to: email,
    subject: "Pro Coder Hero  Code",
    text: `Your  code is: ${code}. It expires in 10 minutes.`,
    html: `<p>Your  code is: <b>${code}</b>. It expires in 10 minutes.</p>`,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent:", info.messageId);
  } catch (error) {
    console.error("Error sending email:", error);
    throw error; // Rethrow or handle appropriately
  }
}
