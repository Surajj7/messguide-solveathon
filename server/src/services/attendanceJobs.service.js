import { prisma } from "../lib/prisma.js";
import { ATTENDANCE_MEALS, dateKeyUTC, getMealStatus, hasMealEnded } from "../utils/mealSlots.js";

function today() {
  return dateKeyUTC(new Date());
}

/** Mark ABSENT for students with no PRESENT row after meal end. */
export async function jobAutoAbsent() {
  const now = new Date();
  const logDate = today();

  for (const slot of ATTENDANCE_MEALS) {
    if (!hasMealEnded(slot, logDate, now)) continue;

    const students = await prisma.user.findMany({
      where: { role: "STUDENT", isActive: true, studentProfile: { isNot: null } },
      select: { id: true },
    });

    for (const s of students) {
      const row = await prisma.mealAttendance.findUnique({
        where: {
          userId_logDate_mealSlot: { userId: s.id, logDate, mealSlot: slot },
        },
      });
      if (row?.status === "PRESENT") continue;
      if (row?.status === "ABSENT" && row.method === "AUTO_ABSENT") continue;

      await prisma.mealAttendance.upsert({
        where: {
          userId_logDate_mealSlot: { userId: s.id, logDate, mealSlot: slot },
        },
        create: {
          userId: s.id,
          logDate,
          mealSlot: slot,
          status: "ABSENT",
          method: "AUTO_ABSENT",
        },
        update: {
          status: "ABSENT",
          method: "AUTO_ABSENT",
          markedAt: now,
        },
      });
    }
  }
}

/** Notify students who are not present with ≤15 minutes left in active meal. */
export async function jobMealClosingWarning() {
  const now = new Date();
  const st = getMealStatus(now);
  if (st.phase !== "during" || !st.slot || st.minutesToEnd == null) return;
  if (st.minutesToEnd > 15) return;

  const logDate = today();
  const slot = st.slot;

  const students = await prisma.user.findMany({
    where: { role: "STUDENT", isActive: true, studentProfile: { isNot: null } },
    select: { id: true },
  });

  for (const s of students) {
    const present = await prisma.mealAttendance.findFirst({
      where: {
        userId: s.id,
        logDate,
        mealSlot: slot,
        status: "PRESENT",
      },
    });
    if (present) continue;

    const metaKey = `mealWarn:${slot}:${logDate.toISOString().slice(0, 10)}`;
    const already = await prisma.notification.findFirst({
      where: {
        userId: s.id,
        type: "MEAL_CLOSING_SOON",
        metadata: { contains: metaKey },
      },
    });
    if (already) continue;

    await prisma.notification.create({
      data: {
        userId: s.id,
        type: "MEAL_CLOSING_SOON",
        title: "Meal closing soon",
        message: `You have not been marked present for ${String(slot).replace(/_/g, " ").toLowerCase()}. Less than 15 minutes left — visit the mess or generate an OTP.`,
        metadata: JSON.stringify({ key: metaKey, mealSlot: slot }),
      },
    });
  }
}

/** Consecutive missed ended meals, walking back from the latest ended slot. */
export async function computeMissedStreak(userId, maxDays = 14) {
  const now = new Date();
  const slotDayOrder = ["DINNER", "SNACKS", "LUNCH", "BREAKFAST"];
  let streak = 0;

  for (let dayOffset = 0; dayOffset < maxDays; dayOffset++) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - dayOffset);

    for (const slot of slotDayOrder) {
      if (!ATTENDANCE_MEALS.includes(slot)) continue;
      if (!hasMealEnded(slot, d, now)) continue;

      const row = await prisma.mealAttendance.findUnique({
        where: {
          userId_logDate_mealSlot: { userId, logDate: d, mealSlot: slot },
        },
      });
      const missed = !row || row.status !== "PRESENT";
      if (missed) streak += 1;
      else return streak;
    }
  }
  return streak;
}

export async function jobMissedMealAlerts() {
  const students = await prisma.user.findMany({
    where: { role: "STUDENT", isActive: true, studentProfile: { isNot: null } },
    include: { studentProfile: true },
  });

  for (const u of students) {
    const streak = await computeMissedStreak(u.id);
    if (streak < 4) continue;

    const dayKey = dateKeyUTC(new Date()).toISOString().slice(0, 10);
    const metaFrag = `streakAlert:${dayKey}`;
    const dup = await prisma.notification.findFirst({
      where: {
        userId: u.id,
        type: "MISSED_MEALS_STREAK",
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        metadata: { contains: metaFrag },
      },
    });
    if (dup) continue;

    const p = u.studentProfile;
    const msg = `You have ${streak} consecutive missed meals recorded. Please contact the warden or mess office.`;

    await prisma.notification.create({
      data: {
        userId: u.id,
        type: "MISSED_MEALS_STREAK",
        title: "Missed meals alert",
        message: msg,
        metadata: JSON.stringify({ streak, key: metaFrag }),
      },
    });

    const parentLine = `MOCK parent SMS/email → ${p?.parentPhone || "—"} / ${p?.parentEmail || "—"} | Student ${u.name} (${u.email}) streak=${streak}`;
    console.log("[attendance:parent-mock]", parentLine);

    const wardenLine = `MOCK warden → ${p?.wardenEmail || "warden@campus.mock"} | ${u.email} missed streak ${streak}`;
    console.log("[attendance:warden-mock]", wardenLine);

    const admins = await prisma.user.findMany({
      where: { role: "ADMIN", isActive: true },
      select: { id: true },
    });
    await prisma.notification.createMany({
      data: admins.map((a) => ({
        userId: a.id,
        type: "MISSED_MEALS_STREAK",
        title: `At-risk student: ${u.name}`,
        message: `${u.email} · reg ${p?.registrationNo || "—"} · ~${streak} consecutive misses (see attendance module).`,
        metadata: JSON.stringify({ studentId: u.id, streak, key: metaFrag }),
      })),
    });
  }
}

export async function runAttendanceJobs() {
  try {
    await jobAutoAbsent();
    await jobMealClosingWarning();
    await jobMissedMealAlerts();
  } catch (e) {
    console.error("[attendance cron]", e);
  }
}
