import { prisma } from "../lib/prisma.js";
import { notifyUser } from "./notifications.js";

/**
 * Submit a student dish suggestion
 */
export async function createSuggestion(userId, data) {
  const { dishName, mealSlot, messType, description, reason } = data;

  if (!dishName || !dishName.trim()) {
    throw new Error("Dish name is required");
  }

  // Rate limit: max 5 pending suggestions per student
  const pendingCount = await prisma.dishSuggestion.count({
    where: { userId, status: "PENDING" },
  });
  if (pendingCount >= 5) {
    throw new Error(
      "You have reached the limit of 5 pending suggestions. Please wait for moderation before submitting more."
    );
  }

  // Duplicate detection against existing MenuItem catalog
  const existingMenuItem = await prisma.menuItem.findFirst({
    where: { name: { equals: dishName.trim(), mode: "insensitive" } },
  });

  // Duplicate detection against other pending or approved suggestions
  const existingSuggestion = await prisma.dishSuggestion.findFirst({
    where: {
      dishName: { equals: dishName.trim(), mode: "insensitive" },
      status: { in: ["PENDING", "APPROVED"] },
    },
  });

  const duplicateWarning =
    existingMenuItem || existingSuggestion
      ? `Note: A similar dish ("${dishName.trim()}") already exists in the campus database.`
      : null;

  const suggestion = await prisma.dishSuggestion.create({
    data: {
      userId,
      dishName: dishName.trim(),
      mealSlot: mealSlot || null,
      messType: messType || null,
      description: description?.trim() || null,
      reason: reason?.trim() || null,
      status: "PENDING",
    },
  });

  return {
    ...suggestion,
    duplicateWarning,
  };
}

/**
 * Get suggestions submitted by the authenticated student
 */
export async function getStudentSuggestions(userId) {
  return await prisma.dishSuggestion.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * List suggestions for Admin and Mess Managers with filtering
 */
export async function listSuggestions({ status, messType, mealSlot }) {
  const where = {};
  if (status) where.status = status;
  if (messType) where.messType = messType;
  if (mealSlot) where.mealSlot = mealSlot;

  return await prisma.dishSuggestion.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          studentProfile: {
            select: { registrationNo: true, messType: true, caterer: true },
          },
        },
      },
      moderatedBy: {
        select: { id: true, name: true, role: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Moderate a student dish suggestion (Admin / Mess Manager)
 */
export async function moderateSuggestion(suggestionId, { status, moderationReason }, moderator) {
  if (!["APPROVED", "REJECTED", "DUPLICATE"].includes(status)) {
    throw new Error("Invalid status. Must be APPROVED, REJECTED, or DUPLICATE.");
  }

  const suggestion = await prisma.dishSuggestion.findUnique({
    where: { id: suggestionId },
    include: { user: true },
  });
  if (!suggestion) throw new Error("Suggestion not found");

  const updated = await prisma.dishSuggestion.update({
    where: { id: suggestionId },
    data: {
      status,
      moderationReason: moderationReason?.trim() || null,
      moderatedById: moderator.id,
      moderatedAt: new Date(),
    },
  });

  // Notify the student
  const statusLabels = {
    APPROVED: "Approved",
    REJECTED: "Declined",
    DUPLICATE: "Marked as Duplicate",
  };

  await notifyUser(suggestion.userId, {
    type: "ANNOUNCEMENT",
    title: `Dish Suggestion ${statusLabels[status]}: "${suggestion.dishName}"`,
    message: moderationReason
      ? `Remarks: ${moderationReason}`
      : `Your suggestion for "${suggestion.dishName}" has been ${status.toLowerCase()} by the mess administration.`,
    metadata: { suggestionId, status },
  }).catch(() => {});

  return updated;
}
