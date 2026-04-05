import dotenv from "dotenv";
dotenv.config();

export const PORT = process.env.PORT || 4000;
export const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";
export const JWT_EXPIRES = process.env.JWT_EXPIRES || "7d";
/** Groq Cloud — https://console.groq.com/keys */
export const GROQ_API_KEY = (process.env.GROQ_API_KEY || "").trim();
export const GROQ_MODEL = (process.env.GROQ_MODEL || "llama-3.3-70b-versatile").trim();
export const COMPLAINT_ESCALATION_THRESHOLD = Number(process.env.COMPLAINT_ESCALATION_THRESHOLD) || 3;
