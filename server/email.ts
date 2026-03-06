import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587", 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || "Strikescout <noreply@strikescout.local>";
const APP_ORIGIN = process.env.APP_ORIGIN || process.env.VITE_ORIGIN || "http://localhost:5000";

export function isEmailConfigured(): boolean {
  return !!(SMTP_HOST && SMTP_USER && SMTP_PASS);
}

export async function sendConfirmationEmail(email: string, token: string): Promise<void> {
  const confirmUrl = `${APP_ORIGIN}/confirm-email?token=${encodeURIComponent(token)}`;

  if (!isEmailConfigured()) {
    console.log("[Email] SMTP not configured. Confirmation link (dev only):");
    console.log(confirmUrl);
    return;
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: SMTP_FROM,
    to: email,
    subject: "Confirm your Strikescout account",
    text: `Welcome to Strikescout! Please confirm your email by clicking this link:\n\n${confirmUrl}\n\nThis link expires in 24 hours.`,
    html: `
      <p>Welcome to Strikescout!</p>
      <p>Please confirm your email by clicking the link below:</p>
      <p><a href="${confirmUrl}">Confirm my account</a></p>
      <p>This link expires in 24 hours.</p>
      <p>If you didn't create an account, you can ignore this email.</p>
    `,
  });
}
