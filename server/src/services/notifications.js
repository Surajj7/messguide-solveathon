import { prisma } from "../lib/prisma.js";

/** Notify all students (and optionally mess/admins) */
export async function notifyStudents({ type, title, message, metadata }) {
  const students = await prisma.user.findMany({
    where: { role: "STUDENT", isActive: true },
    select: { id: true },
  });
  const metaStr = metadata ? JSON.stringify(metadata) : null;
  await prisma.notification.createMany({
    data: students.map((u) => ({
      userId: u.id,
      type,
      title,
      message,
      metadata: metaStr,
    })),
  });
}

export async function notifyUser(userId, { type, title, message, metadata }) {
  await prisma.notification.create({
    data: {
      userId,
      type,
      title,
      message,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });
}

export async function notifyAdmins({ type, title, message, metadata }) {
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", isActive: true },
    select: { id: true },
  });
  const metaStr = metadata ? JSON.stringify(metadata) : null;
  await prisma.notification.createMany({
    data: admins.map((u) => ({
      userId: u.id,
      type,
      title,
      message,
      metadata: metaStr,
    })),
  });
}

export async function notifyMessInchargeUsers({ type, title, message, metadata }) {
  const staff = await prisma.user.findMany({
    where: { role: "MESS_INCHARGE", isActive: true },
    select: { id: true },
  });
  const metaStr = metadata ? JSON.stringify(metadata) : null;
  if (staff.length === 0) return;
  await prisma.notification.createMany({
    data: staff.map((u) => ({
      userId: u.id,
      type,
      title,
      message,
      metadata: metaStr,
    })),
  });
}
