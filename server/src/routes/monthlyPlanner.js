import { Router } from "express";
import { authRequired, requireRoles } from "../middleware/auth.js";
import {
  generateMonthlyPlan,
  getMonthlyPlan,
  listMonthlyPlans,
  updatePlanItem,
  validatePlan,
  publishMonthlyPlan,
} from "../services/monthlyPlanner.service.js";

const router = Router();

/**
 * List all monthly plans (Admin & Mess Incharge)
 */
router.get(
  "/",
  authRequired,
  requireRoles("MESS_INCHARGE", "ADMIN"),
  async (req, res, next) => {
    try {
      const plans = await listMonthlyPlans();
      res.json(plans);
    } catch (e) {
      next(e);
    }
  }
);

/**
 * Generate a date-specific monthly menu plan (Admin)
 */
router.post(
  "/generate",
  authRequired,
  requireRoles("ADMIN"),
  async (req, res, next) => {
    try {
      const plan = await generateMonthlyPlan({
        ...req.body,
        adminUserId: req.userId,
      });
      res.status(201).json(plan);
    } catch (e) {
      next(e);
    }
  }
);

/**
 * Get monthly plan details with calendar breakdown (Admin & Mess Incharge)
 */
router.get(
  "/:id",
  authRequired,
  requireRoles("MESS_INCHARGE", "ADMIN"),
  async (req, res, next) => {
    try {
      const plan = await getMonthlyPlan(req.params.id);
      if (!plan) return res.status(404).json({ error: "Plan not found" });
      res.json(plan);
    } catch (e) {
      next(e);
    }
  }
);

/**
 * Update individual date-specific item (Pin/Lock, swap dish) (Admin)
 */
router.patch(
  "/items/:itemId",
  authRequired,
  requireRoles("MESS_INCHARGE", "ADMIN"),
  async (req, res, next) => {
    try {
      const item = await updatePlanItem(
        req.params.itemId,
        req.body,
        { id: req.userId, role: req.userRole }
      );
      res.json(item);
    } catch (e) {
      next(e);
    }
  }
);

/**
 * Validate complete monthly plan against constraints (Admin)
 */
router.get(
  "/:id/validate",
  authRequired,
  requireRoles("ADMIN"),
  async (req, res, next) => {
    try {
      const report = await validatePlan(req.params.id);
      res.json(report);
    } catch (e) {
      next(e);
    }
  }
);

/**
 * Explicitly publish approved monthly plan to live daily menu system (Admin)
 */
router.post(
  "/:id/publish",
  authRequired,
  requireRoles("ADMIN"),
  async (req, res, next) => {
    try {
      const result = await publishMonthlyPlan(req.params.id, req.userId);
      res.json(result);
    } catch (e) {
      next(e);
    }
  }
);

export default router;
