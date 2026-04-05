import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authRequired, requireRoles } from "../middleware/auth.js";
import { hashPassword } from "../utils/password.js";

const router = Router();

router.get("/", authRequired, requireRoles("ADMIN"), async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        studentProfile: true,
      },
      orderBy: { email: "asc" },
    });
    res.json(users);
  } catch (e) {
    next(e);
  }
});

router.post("/", authRequired, requireRoles("ADMIN"), async (req, res, next) => {
  try {
    const { email, password, name, role, messType, hostelBlock, caterer } = req.body;
    if (!email || !password || !name || !role) {
      return res.status(400).json({ error: "email, password, name, role required" });
    }
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        role,
        ...(role === "STUDENT"
          ? {
              studentProfile: {
                create: {
                  messType: messType || "VEG",
                  hostelBlock: hostelBlock || "A",
                  caterer: caterer || "ZENITH",
                  profileComplete: true,
                },
              },
            }
          : {}),
      },
      include: { studentProfile: true },
    });
    res.status(201).json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
  } catch (e) {
    if (e.code === "P2002") {
      return res.status(409).json({ error: "Email exists" });
    }
    next(e);
  }
});

router.patch("/:id", authRequired, requireRoles("ADMIN"), async (req, res, next) => {
  try {
    const { name, isActive, role } = req.body;
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(typeof isActive === "boolean" && { isActive }),
        ...(role && { role }),
      },
    });
    res.json(user);
  } catch (e) {
    next(e);
  }
});

export default router;
