import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { signToken } from "../utils/jwt.js";
import { authRequired } from "../middleware/auth.js";

const router = Router();

router.post("/register", async (req, res, next) => {
  try {
    const { email, password, name, role } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: "email, password, name required" });
    }
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      return res.status(409).json({ error: "Email already registered" });
    }
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        role: role === "MESS_INCHARGE" ? "MESS_INCHARGE" : "STUDENT",
      },
    });
    if (user.role === "STUDENT") {
      await prisma.studentProfile.create({
        data: {
          userId: user.id,
          messType: "VEG",
          hostelBlock: "A",
          caterer: "ZENITH",
          profileComplete: false,
        },
      });
    }
    const token = signToken({
      sub: user.id,
      role: user.role,
      email: user.email,
    });
    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (e) {
    next(e);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "email and password required" });
    }
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const token = signToken({
      sub: user.id,
      role: user.role,
      email: user.email,
    });
    let profile = null;
    if (user.role === "STUDENT") {
      profile = await prisma.studentProfile.findUnique({
        where: { userId: user.id },
      });
    } else if (user.role === "PARENT") {
      profile = await prisma.parentProfile.findUnique({
        where: { userId: user.id },
        include: {
          student: {
            select: {
              id: true,
              name: true,
              email: true,
              studentProfile: true,
            },
          },
        },
      });
    }
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      profile,
    });
  } catch (e) {
    next(e);
  }
});

router.get("/me", authRequired, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        studentProfile: true,
        parentProfile: {
          include: {
            student: {
              select: {
                id: true,
                name: true,
                email: true,
                studentProfile: true,
              },
            },
          },
        },
      },
    });
    if (!user) return res.status(404).json({ error: "Not found" });
    res.json(user);
  } catch (e) {
    next(e);
  }
});

export default router;
