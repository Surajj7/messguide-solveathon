import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authRequired, requireRoles } from "../middleware/auth.js";
import { getMenuForDate } from "../services/menuResolve.js";

const router = Router();

/**
 * Helper to resolve the parent's linked student
 */
async function getParentStudent(userId) {
  const parentProfile = await prisma.parentProfile.findUnique({
    where: { userId },
    include: {
      student: {
        include: {
          studentProfile: true,
        },
      },
    },
  });

  if (!parentProfile) {
    return null;
  }

  // If directly linked via student relation
  if (parentProfile.student) {
    return parentProfile.student;
  }

  // Fallback: search by studentRegNo if present
  if (parentProfile.studentRegNo) {
    const profile = await prisma.studentProfile.findUnique({
      where: { registrationNo: parentProfile.studentRegNo },
      include: {
        user: {
          include: { studentProfile: true },
        },
      },
    });
    if (profile?.user) return profile.user;
  }

  return null;
}

/**
 * GET /api/parent/student
 * Returns the student profile details for the authenticated parent
 */
router.get("/student", authRequired, requireRoles("PARENT"), async (req, res, next) => {
  try {
    const student = await getParentStudent(req.userId);
    if (!student) {
      return res.status(404).json({ error: "No student linked to this parent account." });
    }

    res.json({
      id: student.id,
      name: student.name,
      email: student.email,
      registrationNo: student.studentProfile?.registrationNo,
      hostelBlock: student.studentProfile?.hostelBlock,
      messType: student.studentProfile?.messType,
      caterer: student.studentProfile?.caterer,
      healthGoal: student.studentProfile?.healthGoal,
      consecutiveMissedMeals: student.studentProfile?.consecutiveMissedMeals || 0,
      profileComplete: student.studentProfile?.profileComplete,
    });
  } catch (e) {
    next(e);
  }
});

/**
 * GET /api/parent/attendance
 * Returns child's mess attendance log and summary metrics
 */
router.get("/attendance", authRequired, requireRoles("PARENT"), async (req, res, next) => {
  try {
    const student = await getParentStudent(req.userId);
    if (!student) {
      return res.status(404).json({ error: "No student linked to this parent account." });
    }

    const days = parseInt(req.query.days || "30", 10);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const rows = await prisma.mealAttendance.findMany({
      where: {
        userId: student.id,
        logDate: { gte: startDate },
      },
      orderBy: [{ logDate: "desc" }, { mealSlot: "asc" }],
    });

    const total = rows.length;
    const present = rows.filter((r) => r.status === "PRESENT").length;
    const absent = rows.filter((r) => r.status === "ABSENT").length;
    const rate = total > 0 ? Math.round((present / total) * 100) : 100;

    res.json({
      studentName: student.name,
      registrationNo: student.studentProfile?.registrationNo,
      stats: {
        totalMealsRecorded: total,
        presentMeals: present,
        absentMeals: absent,
        attendanceRatePercent: rate,
        consecutiveMissedMeals: student.studentProfile?.consecutiveMissedMeals || 0,
      },
      records: rows.map((r) => ({
        id: r.id,
        logDate: r.logDate.toISOString().slice(0, 10),
        mealSlot: r.mealSlot,
        status: r.status,
        method: r.method,
        markedAt: r.markedAt,
      })),
    });
  } catch (e) {
    next(e);
  }
});

/**
 * GET /api/parent/menu
 * Returns the menu for the student's assigned mess type & caterer for a given date
 */
router.get("/menu", authRequired, requireRoles("PARENT"), async (req, res, next) => {
  try {
    const student = await getParentStudent(req.userId);
    if (!student) {
      return res.status(404).json({ error: "No student linked to this parent account." });
    }

    const messType = student.studentProfile?.messType || "VEG";
    const dateStr = req.query.date || new Date().toISOString().slice(0, 10);
    const menuData = await getMenuForDate(new Date(dateStr + "T12:00:00"), messType);

    res.json({
      ...menuData,
      studentName: student.name,
      studentMessType: messType,
      studentCaterer: student.studentProfile?.caterer,
    });
  } catch (e) {
    next(e);
  }
});

/**
 * GET /api/parent/feedback
 * Returns feedback and reviews submitted by the child,
 * plus community reviews for the student's specific mess & caterer
 */
router.get("/feedback", authRequired, requireRoles("PARENT"), async (req, res, next) => {
  try {
    const student = await getParentStudent(req.userId);
    if (!student) {
      return res.status(404).json({ error: "No student linked to this parent account." });
    }

    const studentMessType = student.studentProfile?.messType;
    const studentCaterer = student.studentProfile?.caterer;

    // Student's own reviews
    const myStudentReviews = await prisma.review.findMany({
      where: { userId: student.id },
      include: { menuItem: true },
      orderBy: { createdAt: "desc" },
    });

    // Student's complaints
    const myStudentComplaints = await prisma.complaint.findMany({
      where: { userId: student.id },
      include: { menuItem: true },
      orderBy: { createdAt: "desc" },
    });

    // Mess / caterer community reviews
    const messReviews = await prisma.review.findMany({
      where: {
        OR: [
          { messType: studentMessType },
          { caterer: studentCaterer },
        ],
      },
      include: { menuItem: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    const averageRating =
      messReviews.length > 0
        ? Number(
            (
              messReviews.reduce((acc, curr) => acc + curr.rating, 0) /
              messReviews.length
            ).toFixed(1)
          )
        : 4.5;

    res.json({
      studentName: student.name,
      messType: studentMessType,
      caterer: studentCaterer,
      averageMessRating: averageRating,
      childReviews: myStudentReviews.map((r) => ({
        id: r.id,
        menuItemName: r.menuItem?.name,
        menuDate: r.menuDate.toISOString().slice(0, 10),
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
        attachmentPath: r.attachmentPath,
        messType: r.messType,
        caterer: r.caterer,
      })),
      childComplaints: myStudentComplaints.map((c) => ({
        id: c.id,
        menuItemName: c.menuItem?.name,
        menuDate: c.menuDate.toISOString().slice(0, 10),
        issueType: c.issueType,
        description: c.description,
        status: c.status,
        escalated: c.escalated,
        createdAt: c.createdAt,
      })),
      messCommunityReviews: messReviews.map((r) => ({
        id: r.id,
        menuItemName: r.menuItem?.name,
        menuDate: r.menuDate.toISOString().slice(0, 10),
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
        messType: r.messType,
        caterer: r.caterer,
      })),
    });
  } catch (e) {
    next(e);
  }
});

export default router;
