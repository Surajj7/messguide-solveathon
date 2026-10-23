import { Router } from "express";
import { authRequired, requireRoles } from "../middleware/auth.js";
import {
  createSuggestion,
  getStudentSuggestions,
  listSuggestions,
  moderateSuggestion,
} from "../services/dishSuggestion.service.js";

const router = Router();

/**
 * Submit a student dish suggestion (Student only)
 */
router.post("/", authRequired, requireRoles("STUDENT"), async (req, res, next) => {
  try {
    const suggestion = await createSuggestion(req.userId, req.body);
    res.status(201).json(suggestion);
  } catch (e) {
    next(e);
  }
});

/**
 * Get suggestions submitted by the logged-in student
 */
router.get("/mine", authRequired, requireRoles("STUDENT"), async (req, res, next) => {
  try {
    const list = await getStudentSuggestions(req.userId);
    res.json(list);
  } catch (e) {
    next(e);
  }
});

/**
 * List all suggestions for moderation (Admin & Mess Incharge)
 */
router.get(
  "/",
  authRequired,
  requireRoles("MESS_INCHARGE", "ADMIN"),
  async (req, res, next) => {
    try {
      const { status, messType, mealSlot } = req.query;
      const list = await listSuggestions({ status, messType, mealSlot });
      res.json(list);
    } catch (e) {
      next(e);
    }
  }
);

/**
 * Moderate a student dish suggestion (Admin & Mess Incharge)
 */
router.post(
  "/:id/moderate",
  authRequired,
  requireRoles("MESS_INCHARGE", "ADMIN"),
  async (req, res, next) => {
    try {
      const { status, moderationReason } = req.body;
      const updated = await moderateSuggestion(
        req.params.id,
        { status, moderationReason },
        { id: req.userId, role: req.userRole }
      );
      res.json(updated);
    } catch (e) {
      next(e);
    }
  }
);

export default router;
