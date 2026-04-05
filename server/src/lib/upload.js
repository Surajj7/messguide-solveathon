import fs from "fs";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const uploadDir = path.join(__dirname, "../../uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

export const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
      const safe = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      cb(null, safe);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok =
      /^image\//.test(file.mimetype) ||
      file.mimetype === "application/pdf" ||
      file.mimetype === "application/msword" ||
      file.mimetype.includes("wordprocessingml") ||
      file.mimetype.includes("spreadsheetml") ||
      file.mimetype === "application/octet-stream";
    if (!ok) {
      return cb(new Error("Allowed: images, PDF, Office docs"));
    }
    cb(null, true);
  },
});

/** Public URL path stored in DB (served by Express static /uploads) */
export function publicUploadPath(filename) {
  if (!filename) return null;
  return `/uploads/${filename}`;
}
