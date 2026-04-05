import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authRequired, requireRoles } from "../middleware/auth.js";
import {
  generateAttendanceOtp,
  markPresentFromOtp,
  markPresentFromQr,
} from "../services/attendance.service.js";
import { computeMissedStreak } from "../services/attendanceJobs.service.js";
import {
  ATTENDANCE_MEALS,
  dateKeyUTC,
  getCurrentMeal,
  getMealStatus,
} from "../utils/mealSlots.js";

const router = Router();

function parseQrPayload(text) {
  const t = String(text || "").trim();
  try {
    const j = JSON.parse(t);
    if (j && j.sid) return j.sid;
    if (j && j.studentId) return j.studentId;
  } catch {
    /* plain uuid */
  }
  if (/^[0-9a-f-]{36}$/i.test(t)) return t;
  return null;
}

router.get("/today", authRequired, requireRoles("STUDENT"), async (req, res, next) => {
  try {
    const logDate = dateKeyUTC(new Date());
    const rows = await prisma.mealAttendance.findMany({
      where: { userId: req.userId, logDate },
    });
    const bySlot = Object.fromEntries(rows.map((r) => [r.mealSlot, r]));
    const current = getCurrentMeal();
    const status = getMealStatus();

    const slots = ATTENDANCE_MEALS.map((slot) => {
      const r = bySlot[slot];
      return {
        mealSlot: slot,
        status: r?.status || null,
        method: r?.method || null,
        markedAt: r?.markedAt || null,
      };
    });

    const streak = await computeMissedStreak(req.userId);

    res.json({
      date: logDate.toISOString().slice(0, 10),
      currentMeal: current,
      mealStatus: status,
      slots,
      missedStreak: streak,
    });
  } catch (e) {
    next(e);
  }
});

router.post("/generate-otp", authRequired, requireRoles("STUDENT"), async (req, res, next) => {
  try {
    let { mealSlot } = req.body || {};
    if (!mealSlot) {
      mealSlot = getCurrentMeal();
    }
    if (!mealSlot) {
      return res.status(400).json({
        error:
          "No active meal window. Use this during breakfast (7–9), lunch (12–2), snacks (5–6:30), or dinner (7–9), or pass mealSlot if you are within the pre-window.",
      });
    }
    const out = await generateAttendanceOtp(req.userId, mealSlot);
    res.json(out);
  } catch (e) {
    if (e.statusCode) return res.status(e.statusCode).json({ error: e.message });
    next(e);
  }
});

router.post("/verify-otp", authRequired, requireRoles("MESS_INCHARGE", "ADMIN"), async (req, res, next) => {
  try {
    const { code, mealSlot, studentName } = req.body || {};
    const result = await markPresentFromOtp(code, req.userId, {
      mealSlot,
      studentName,
    });
    res.json(result);
  } catch (e) {
    if (e.statusCode) return res.status(e.statusCode).json({ error: e.message });
    next(e);
  }
});

router.post("/mark-qr", authRequired, requireRoles("MESS_INCHARGE", "ADMIN"), async (req, res, next) => {
  try {
    const { studentId, raw } = req.body;
    const sid = studentId || parseQrPayload(raw);
    if (!sid) {
      return res.status(400).json({ error: "studentId or raw QR payload required" });
    }
    const result = await markPresentFromQr(sid, req.userId);
    res.json(result);
  } catch (e) {
    if (e.statusCode) return res.status(e.statusCode).json({ error: e.message });
    next(e);
  }
});

router.get("/streak", authRequired, requireRoles("STUDENT"), async (req, res, next) => {
  try {
    const streak = await computeMissedStreak(req.userId);
    res.json({ missedStreak: streak });
  } catch (e) {
    next(e);
  }
});

router.get("/admin/summary", authRequired, requireRoles("ADMIN"), async (req, res, next) => {
  try {
    const logDate = dateKeyUTC(new Date());
    const [students, todayRows, atRisk] = await Promise.all([
      prisma.user.count({ where: { role: "STUDENT", isActive: true } }),
      prisma.mealAttendance.findMany({ where: { logDate } }),
      prisma.user.findMany({
        where: { role: "STUDENT", isActive: true, studentProfile: { isNot: null } },
        include: { studentProfile: true },
        take: 80,
      }),
    ]);

    const presentToday = todayRows.filter((r) => r.status === "PRESENT").length;
    const absentToday = todayRows.filter((r) => r.status === "ABSENT").length;

    const risk = [];
    for (const u of atRisk) {
      const s = await computeMissedStreak(u.id);
      if (s >= 4) {
        risk.push({
          id: u.id,
          name: u.name,
          email: u.email,
          registrationNo: u.studentProfile?.registrationNo,
          streak: s,
        });
      }
    }

    res.json({
      date: logDate.toISOString().slice(0, 10),
      activeStudents: students,
      recordsToday: todayRows.length,
      presentMarksToday: presentToday,
      absentMarksToday: absentToday,
      atRisk: risk,
    });
  } catch (e) {
    next(e);
  }
});

router.get("/admin/trend", authRequired, requireRoles("ADMIN"), async (req, res, next) => {
  try {
    const from = req.query.from ? new Date(req.query.from) : new Date(Date.now() - 7 * 86400000);
    const to = req.query.to ? new Date(req.query.to) : new Date();
    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);

    const rows = await prisma.mealAttendance.groupBy({
      by: ["logDate", "status"],
      where: { logDate: { gte: from, lte: to } },
      _count: { _all: true },
    });

    const byDay = {};
    for (const r of rows) {
      const k = r.logDate.toISOString().slice(0, 10);
      if (!byDay[k]) byDay[k] = { date: k, PRESENT: 0, ABSENT: 0 };
      byDay[k][r.status] = r._count._all;
    }

    res.json({ points: Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date)) });
  } catch (e) {
    next(e);
  }
});

export default router;
