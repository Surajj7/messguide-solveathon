import { prisma } from "../lib/prisma.js";

function labelCaterer(c) {
  return String(c || "").replace(/_/g, " ");
}

/**
 * FCFS caterer swap with row lock to prevent oversubscription.
 */
export async function applyCatererSwap(userId, optionId) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SELECT id FROM "CatererSwapOption" WHERE id = $1::text FOR UPDATE`,
      optionId
    );

    const option = await tx.catererSwapOption.findUnique({
      where: { id: optionId },
    });
    if (!option || !option.isActive) {
      const err = new Error("This swap option is not available");
      err.statusCode = 400;
      throw err;
    }
    if (option.fromCaterer === option.toCaterer) {
      const err = new Error("Invalid swap configuration");
      err.statusCode = 400;
      throw err;
    }

    const profile = await tx.studentProfile.findUnique({ where: { userId } });
    if (!profile) {
      const err = new Error("Student profile not found");
      err.statusCode = 400;
      throw err;
    }
    if (profile.messType !== option.messType) {
      const err = new Error("This swap is only for the same mess type as your profile");
      err.statusCode = 400;
      throw err;
    }
    if (profile.caterer !== option.fromCaterer) {
      const err = new Error(
        `Your current caterer is ${labelCaterer(profile.caterer)}; this swap is from ${labelCaterer(option.fromCaterer)}`
      );
      err.statusCode = 400;
      throw err;
    }
    if (profile.caterer === option.toCaterer) {
      const err = new Error("You are already assigned to this caterer");
      err.statusCode = 400;
      throw err;
    }

    const pendingUpgrade = await tx.messUpgradeRequest.count({
      where: { userId, status: "PENDING" },
    });
    if (pendingUpgrade > 0) {
      const err = new Error("Resolve or wait for your pending mess upgradation request first");
      err.statusCode = 400;
      throw err;
    }

    const used = await tx.catererSwapRequest.count({
      where: { optionId, status: "CONFIRMED" },
    });
    if (used >= option.totalSlots) {
      const err = new Error("No slots left for this swap (first come, first served)");
      err.statusCode = 409;
      throw err;
    }

    const alreadyThisOption = await tx.catererSwapRequest.findFirst({
      where: { userId, optionId, status: "CONFIRMED" },
    });
    if (alreadyThisOption) {
      const err = new Error("You have already completed this swap");
      err.statusCode = 400;
      throw err;
    }

    const row = await tx.catererSwapRequest.create({
      data: {
        userId,
        optionId,
        status: "CONFIRMED",
        messTypeSnapshot: profile.messType,
        fromCatererSnapshot: profile.caterer,
        toCatererSnapshot: option.toCaterer,
      },
      include: { option: true },
    });

    await tx.studentProfile.update({
      where: { userId },
      data: { caterer: option.toCaterer },
    });

    await tx.notification.create({
      data: {
        userId,
        type: "MESS_CATERER_SWAP",
        title: "Caterer swap confirmed",
        message: `Your caterer is now ${labelCaterer(option.toCaterer)} (${String(profile.messType).replace(/_/g, " ")} line, FCFS).`,
      },
    });

    return row;
  });
}

export async function cancelCatererSwapRequest(requestId, _adminUserId, adminNote) {
  return prisma.$transaction(async (tx) => {
    const req = await tx.catererSwapRequest.findUnique({
      where: { id: requestId },
      include: { option: true },
    });
    if (!req) {
      const err = new Error("Request not found");
      err.statusCode = 404;
      throw err;
    }
    if (req.status !== "CONFIRMED") {
      const err = new Error("Only confirmed swaps can be reversed");
      err.statusCode = 400;
      throw err;
    }

    const profile = await tx.studentProfile.findUnique({ where: { userId: req.userId } });
    if (profile && profile.caterer === req.toCatererSnapshot) {
      await tx.studentProfile.update({
        where: { userId: req.userId },
        data: { caterer: req.fromCatererSnapshot },
      });
    }

    const updated = await tx.catererSwapRequest.update({
      where: { id: requestId },
      data: {
        status: "CANCELLED",
        adminNote: adminNote?.trim() || null,
      },
      include: { user: { select: { id: true, name: true, email: true } }, option: true },
    });

    await tx.notification.create({
      data: {
        userId: req.userId,
        type: "MESS_CATERER_SWAP",
        title: "Caterer swap reversed",
        message:
          "An administrator reversed your caterer swap. Your caterer assignment was restored when applicable.",
      },
    });

    return updated;
  });
}

export async function createMessUpgradeRequest(userId, targetMessType, paymentId) {
  const cleanPayment = String(paymentId || "").trim();
  if (!cleanPayment) {
    const err = new Error("Payment / transaction ID is required");
    err.statusCode = 400;
    throw err;
  }

  const profile = await prisma.studentProfile.findUnique({ where: { userId } });
  if (!profile) {
    const err = new Error("Student profile not found");
    err.statusCode = 400;
    throw err;
  }
  if (profile.messType === targetMessType) {
    const err = new Error("Choose a different mess type than your current allocation");
    err.statusCode = 400;
    throw err;
  }

  const pending = await prisma.messUpgradeRequest.count({
    where: { userId, status: "PENDING" },
  });
  if (pending > 0) {
    const err = new Error("You already have a pending mess upgradation request");
    err.statusCode = 400;
    throw err;
  }

  return prisma.messUpgradeRequest.create({
    data: {
      userId,
      targetMessType,
      paymentId: cleanPayment,
    },
  });
}

export async function reviewMessUpgrade(requestId, adminUserId, { status, adminRemarks, assignedCaterer }) {
  if (!["APPROVED", "REJECTED"].includes(status)) {
    const err = new Error("status must be APPROVED or REJECTED");
    err.statusCode = 400;
    throw err;
  }

  return prisma.$transaction(async (tx) => {
    const req = await tx.messUpgradeRequest.findUnique({
      where: { id: requestId },
      include: { user: { include: { studentProfile: true } } },
    });
    if (!req) {
      const err = new Error("Request not found");
      err.statusCode = 404;
      throw err;
    }
    if (req.status !== "PENDING") {
      const err = new Error("Request is no longer pending");
      err.statusCode = 400;
      throw err;
    }

    if (status === "APPROVED") {
      if (!assignedCaterer) {
        const err = new Error("assignedCaterer is required when approving");
        err.statusCode = 400;
        throw err;
      }
      await tx.studentProfile.update({
        where: { userId: req.userId },
        data: {
          messType: req.targetMessType,
          caterer: assignedCaterer,
        },
      });
    }

    const updated = await tx.messUpgradeRequest.update({
      where: { id: requestId },
      data: {
        status,
        adminRemarks: adminRemarks?.trim() || null,
        assignedCaterer: status === "APPROVED" ? assignedCaterer : null,
        reviewedById: adminUserId,
        reviewedAt: new Date(),
      },
    });

    await tx.notification.create({
      data: {
        userId: req.userId,
        type: "MESS_UPGRADE",
        title: status === "APPROVED" ? "Mess upgrade approved" : "Mess upgrade not approved",
        message:
          status === "APPROVED"
            ? `Your mess type is now ${String(req.targetMessType).replace(/_/g, " ")} with caterer ${labelCaterer(assignedCaterer)}.`
            : `Your mess upgradation request was not approved.${adminRemarks ? ` Note: ${adminRemarks}` : ""}`,
      },
    });

    return updated;
  });
}
