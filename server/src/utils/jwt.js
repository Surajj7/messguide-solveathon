import jwt from "jsonwebtoken";
import { JWT_SECRET, JWT_EXPIRES } from "../config.js";

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}
