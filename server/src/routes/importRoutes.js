import { Router } from "express";
import multer from "multer";
import { authRequired, requireRoles } from "../middleware/auth.js";
import { importMenuCsv } from "../services/csvImport.js";
import { clearMenuData } from "../services/menuClear.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});
const router = Router();

router.post(
  "/csv",
  authRequired,
  requireRoles("MESS_INCHARGE", "ADMIN"),
  upload.single("file"),
  async (req, res, next) => {
    try {
      if (!req.file?.buffer) {
        return res.status(400).json({ error: "file field required" });
      }
      const clearExisting =
        req.body.clearExisting === "true" || req.body.clearExisting === true;
      const deleteMenuItems =
        req.body.deleteMenuItems === "true" || req.body.deleteMenuItems === true;

      if (clearExisting) {
        await clearMenuData({ deleteMenuItems });
      }

      const result = await importMenuCsv(req.file.buffer, {
        defaultMessType: req.body.targetMessType,
      });
      res.json({
        ...result,
        clearedBeforeImport: clearExisting,
        deletedMenuCatalog: Boolean(clearExisting && deleteMenuItems),
      });
    } catch (e) {
      next(e);
    }
  }
);

/** Setup guidance for SQL-based import */
router.get("/sql-instructions", authRequired, requireRoles("MESS_INCHARGE", "ADMIN"), (req, res) => {
  res.json({
    title: "PostgreSQL / SQL import",
    steps: [
      "Ensure DATABASE_URL in server/.env matches your PostgreSQL database.",
      "Edit docs/sample_menu_inserts.sql (or export from your tool) so INSERTs match your data.",
      "Run: psql \"%DATABASE_URL%\" -f docs/sample_menu_inserts.sql (Windows PowerShell: use $env:DATABASE_URL)",
      "Or use pgAdmin Query Tool to execute the SQL file.",
      "Menu items must exist in \"MenuItem\" before MenuDateEntry / MenuTemplateEntry reference them — use UUIDs from DB or run seed first.",
      "After import, verify with GET /api/menus/day?messType=VEG&date=YYYY-MM-DD",
    ],
    note: "Direct arbitrary SQL upload from the browser is disabled for safety; use psql or admin tools.",
  });
});

export default router;
