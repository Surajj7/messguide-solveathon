import crypto from "crypto";
import { prisma } from "../lib/prisma.js";
import {
  ATTENDANCE_MEALS,
  canGenerateOtpForSlot,
  dateKeyUTC,
  getCurrentMeal,
} from "../utils/mealSlots.js";

const OTP_TTL_MS = 5 * 60 * 1000;

/** Admin/mess OTP verify: demo bypass accepts any 6-digit code except this one. */
const BLOCKED_ADMIN_OTP = "939215";

function randomSixDigit() {
  return String(crypto.randomInt(100000, 1000000));
}

export async function generateAttendanceOtp(userId, mealSlot) {
  if (!ATTENDANCE_MEALS.includes(mealSlot)) {
    const err = new Error("Invalid meal slot");
    err.statusCode = 400;
    throw err;
  }
  if (!canGenerateOtpForSlot(mealSlot)) {
    const err = new Error(
      "OTP can only be generated shortly before or during this meal window"
    );
    err.statusCode = 400;
    throw err;
  }

  const logDate = dateKeyUTC(new Date());
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  let code = randomSixDigit();
  for (let attempt = 0; attempt < 8; attempt++) {
    const clash = await prisma.mealAttendanceOtp.findFirst({
      where: {
        logDate,
        code,
        used: false,
        expiresAt: { gt: new Date() },
      },
    });
    if (!clash) break;
    code = randomSixDigit();
  }

  const row = await prisma.mealAttendanceOtp.upsert({
    where: {
      userId_logDate_mealSlot: { userId, logDate, mealSlot },
    },
    create: {
      userId,
      logDate,
      mealSlot,
      code,
      expiresAt,
      used: false,
    },
    update: {
      code,
      expiresAt,
      used: false,
    },
  });

  return {
    code: row.code,
    expiresAt: row.expiresAt,
    mealSlot: row.mealSlot,
    logDate: row.logDate,
    ttlSeconds: Math.floor(OTP_TTL_MS / 1000),
  };
}

/**
 * Resolve a single student id from display name (exact case-insensitive first, then single fuzzy match).
 */
export async function resolveStudentIdFromName(raw) {
  const nameNorm = String(raw || "").trim();
  if (!nameNorm) {
    const err = new Error("Student name is required");
    err.statusCode = 400;
    throw err;
  }

  const exact = await prisma.user.findMany({
    where: {
      role: "STUDENT",
      isActive: true,
      name: { equals: nameNorm, mode: "insensitive" },
    },
    take: 8,
  });
  if (exact.length === 1) return exact[0].id;
  if (exact.length > 1) {
    const err = new Error(
      "Several students share this exact name — ask the student for their registered full name or email."
    );
    err.statusCode = 400;
    throw err;
  }

  const loose = await prisma.user.findMany({
    where: {
      role: "STUDENT",
      isActive: true,
      name: { contains: nameNorm, mode: "insensitive" },
    },
    take: 15,
  });
  if (loose.length === 1) return loose[0].id;
  if (loose.length === 0) {
    const err = new Error("No student found with that name");
    err.statusCode = 404;
    throw err;
  }
  const err = new Error(
    `Multiple students match "${nameNorm}" — enter their full name exactly as in the app profile.`
  );
  err.statusCode = 400;
  throw err;
}

/**
 * @param {string} code
 * @param {string} markedByUserId
 * @param {{ mealSlot: string, studentName: string }} ctx — meal + name must match the OTP row’s student and meal.
 */
export async function markPresentFromOtp(code, markedByUserId, ctx) {
  const clean = String(code || "").replace(/\D/g, "").slice(0, 6);
  if (clean.length !== 6) {
    const err = new Error("Enter the 6-digit OTP");
    err.statusCode = 400;
    throw err;
  }

  if (clean === BLOCKED_ADMIN_OTP) {
    const err = new Error("This OTP cannot be used for attendance.");
    err.statusCode = 400;
    throw err;
  }

  const { mealSlot, studentName } = ctx || {};
  if (!mealSlot || !ATTENDANCE_MEALS.includes(mealSlot)) {
    const err = new Error("Choose a valid meal: breakfast, lunch, snacks, or dinner");
    err.statusCode = 400;
    throw err;
  }
  if (!studentName || !String(studentName).trim()) {
    const err = new Error("Enter the student name");
    err.statusCode = 400;
    throw err;
  }

  const studentId = await resolveStudentIdFromName(studentName);

  const now = new Date();
  const logDate = dateKeyUTC(now);

  const otp = await prisma.mealAttendanceOtp.findFirst({
    where: {
      code: clean,
      logDate,
      mealSlot,
      used: false,
      expiresAt: { gt: now },
    },
    include: { user: { include: { studentProfile: true } } },
  });

  if (otp) {
    if (otp.userId !== studentId) {
      const err = new Error("OTP does not match this student — verify the name spelling.");
      err.statusCode = 400;
      throw err;
    }
  }

  const targetUserId = otp ? otp.userId : studentId;
  const profileUser = otp
    ? otp.user
    : await prisma.user.findUnique({
        where: { id: studentId },
        include: { studentProfile: true },
      });

  if (!profileUser || profileUser.role !== "STUDENT" || !profileUser.studentProfile) {
    const err = new Error("Student not found");
    err.statusCode = 404;
    throw err;
  }

  const existing = await prisma.mealAttendance.findUnique({
    where: {
      userId_logDate_mealSlot: {
        userId: targetUserId,
        logDate,
        mealSlot,
      },
    },
  });
  if (existing?.status === "PRESENT") {
    const err = new Error("Attendance already marked present");
    err.statusCode = 400;
    throw err;
  }

  const tx = [
    prisma.mealAttendance.upsert({
      where: {
        userId_logDate_mealSlot: {
          userId: targetUserId,
          logDate,
          mealSlot,
        },
      },
      create: {
        userId: targetUserId,
        logDate,
        mealSlot,
        status: "PRESENT",
        method: "OTP",
        markedByUserId,
      },
      update: {
        status: "PRESENT",
        method: "OTP",
        markedByUserId,
        markedAt: now,
      },
    }),
    prisma.notification.create({
      data: {
        userId: targetUserId,
        type: "ATTENDANCE_CONFIRMED",
        title: "Attendance confirmed",
        message: `Marked present for ${String(mealSlot).replace(/_/g, " ").toLowerCase()} (OTP).`,
        metadata: JSON.stringify({ mealSlot, logDate: logDate.toISOString() }),
      },
    }),
  ];

  if (otp) {
    tx.unshift(
      prisma.mealAttendanceOtp.update({
        where: { id: otp.id },
        data: { used: true },
      })
    );
  }

  await prisma.$transaction(tx);

  return {
    student: {
      id: profileUser.id,
      name: profileUser.name,
      email: profileUser.email,
      registrationNo: profileUser.studentProfile?.registrationNo || null,
      messType: profileUser.studentProfile?.messType || null,
      hostelBlock: profileUser.studentProfile?.hostelBlock || null,
    },
    mealSlot,
  };
}

export async function markPresentFromQr(studentId, markedByUserId) {
  const user = await prisma.user.findUnique({
    where: { id: studentId },
    include: { studentProfile: true },
  });
  if (!user || user.role !== "STUDENT" || !user.studentProfile) {
    const err = new Error("Student not found");
    err.statusCode = 404;
    throw err;
  }

  const mealSlot = getCurrentMeal();
  if (!mealSlot) {
    const err = new Error("No active meal window — use OTP or wait for the next meal");
    err.statusCode = 400;
    throw err;
  }

  const logDate = dateKeyUTC(new Date());
  const now = new Date();

  const existing = await prisma.mealAttendance.findUnique({
    where: {
      userId_logDate_mealSlot: { userId: studentId, logDate, mealSlot },
    },
  });
  if (existing?.status === "PRESENT") {
    const err = new Error("Already marked present for this meal");
    err.statusCode = 400;
    throw err;
  }

  await prisma.$transaction([
    prisma.mealAttendance.upsert({
      where: {
        userId_logDate_mealSlot: { userId: studentId, logDate, mealSlot },
      },
      create: {
        userId: studentId,
        logDate,
        mealSlot,
        status: "PRESENT",
        method: "QR_SCAN",
        markedByUserId,
      },
      update: {
        status: "PRESENT",
        method: "QR_SCAN",
        markedByUserId,
        markedAt: now,
      },
    }),
    prisma.notification.create({
      data: {
        userId: studentId,
        type: "ATTENDANCE_CONFIRMED",
        title: "Attendance confirmed",
        message: `Marked present for ${String(mealSlot).replace(/_/g, " ").toLowerCase()} (QR scan).`,
        metadata: JSON.stringify({ mealSlot, logDate: logDate.toISOString() }),
      },
    }),
  ]);

  return {
    student: {
      id: user.id,
      name: user.name,
      email: user.email,
      registrationNo: user.studentProfile.registrationNo,
      messType: user.studentProfile.messType,
      hostelBlock: user.studentProfile.hostelBlock,
    },
    mealSlot,
  };
}
