import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authRequired, requireRoles } from "../middleware/auth.js";

const router = Router();

router.put(
  "/student",
  authRequired,
  requireRoles("STUDENT"),
  async (req, res, next) => {
    try {
      const { healthGoal, profileComplete } = req.body;
      const profile = await prisma.studentProfile.update({
        where: { userId: req.userId },
        data: {
          ...(healthGoal && { healthGoal }),
          ...(typeof profileComplete === "boolean" && { profileComplete }),
        },
      });
      res.json(profile);
    } catch (e) {
      next(e);
    }
  }
);

router.get("/student", authRequired, requireRoles("STUDENT"), async (req, res, next) => {
  try {
    const p = await prisma.studentProfile.findUnique({
      where: { userId: req.userId },
    });
    res.json(p);
  } catch (e) {
    next(e);
  }
});

/** Admin: assign mess type / hostel / caterer (students cannot self-edit these) */
router.patch(
  "/student/:userId/assign",
  authRequired,
  requireRoles("ADMIN"),
  async (req, res, next) => {
    try {
      const { messType, hostelBlock, caterer } = req.body;
      const profile = await prisma.studentProfile.update({
        where: { userId: req.params.userId },
        data: {
          ...(messType && { messType }),
          ...(hostelBlock && { hostelBlock }),
          ...(caterer && { caterer }),
        },
      });
      res.json(profile);
    } catch (e) {
      next(e);
    }
  }
);

/** Mess/Admin: update nutrition on a menu item */
router.patch(
  "/menu-item/:id",
  authRequired,
  requireRoles("MESS_INCHARGE", "ADMIN"),
  async (req, res, next) => {
    try {
      const { calories, proteinG, carbsG, fatsG, tags, isVeg, name } = req.body;
      const item = await prisma.menuItem.update({
        where: { id: req.params.id },
        data: {
          ...(name && { name }),
          ...(calories !== undefined && { calories: Number(calories) }),
          ...(proteinG !== undefined && { proteinG: Number(proteinG) }),
          ...(carbsG !== undefined && { carbsG: Number(carbsG) }),
          ...(fatsG !== undefined && { fatsG: Number(fatsG) }),
          ...(tags !== undefined && {
            tags: typeof tags === "string" ? tags : JSON.stringify(tags),
          }),
          ...(isVeg !== undefined && { isVeg: Boolean(isVeg) }),
        },
      });
      res.json(item);
    } catch (e) {
      next(e);
    }
  }
);

export default router;
