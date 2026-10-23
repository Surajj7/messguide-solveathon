import { prisma } from "../lib/prisma.js";
import { notifyStudents, notifyAdmins } from "./notifications.js";

const VALID_TRANSITIONS = {
  DRAFT: ["SCHEDULED", "OPEN", "CANCELLED"],
  SCHEDULED: ["OPEN", "PAUSED", "CANCELLED"],
  OPEN: ["PAUSED", "CLOSED", "CANCELLED"],
  PAUSED: ["OPEN", "CLOSED", "CANCELLED"],
  CLOSED: ["ARCHIVED"],
  CANCELLED: [],
  ARCHIVED: [],
};

/**
 * List polls scoped by role and mess assignment
 */
export async function listPolls({ role, userId, status, messType }) {
  const where = {};

  if (status) {
    where.status = status;
  }

  if (role === "STUDENT") {
    // Students only see polls that are scheduled, open, paused, or closed
    if (!status) {
      where.status = { in: ["SCHEDULED", "OPEN", "PAUSED", "CLOSED"] };
    }
    const studentProfile = await prisma.studentProfile.findUnique({
      where: { userId },
    });
    const sMessType = messType || studentProfile?.messType;
    if (sMessType) {
      where.messTypes = { has: sMessType };
    }
  } else if (role === "MESS_INCHARGE") {
    // Mess manager scoped to assigned mess types
    const managerProfile = await prisma.messManagerProfile.findUnique({
      where: { userId },
    });
    const assigned = managerProfile?.messTypes?.length
      ? managerProfile.messTypes
      : ["VEG", "NON_VEG", "SPECIAL", "FOODPARK"];
    where.messTypes = { hasSome: assigned };
  }

  const polls = await prisma.menuPoll.findMany({
    where,
    include: {
      categories: {
        include: {
          _count: { select: { candidates: true, ballots: true } },
        },
        orderBy: { displayOrder: "asc" },
      },
      _count: {
        select: { candidates: true, ballots: true },
      },
    },
    orderBy: [{ createdAt: "desc" }],
  });

  // If student, check which polls student has voted in
  if (role === "STUDENT" && userId) {
    const studentBallots = await prisma.menuPollBallot.findMany({
      where: { userId },
      select: { pollId: true, categoryId: true },
    });
    const votedPollMap = new Map();
    for (const b of studentBallots) {
      if (!votedPollMap.has(b.pollId)) votedPollMap.set(b.pollId, new Set());
      votedPollMap.get(b.pollId).add(b.categoryId);
    }

    return polls.map((p) => {
      const votedCategories = votedPollMap.get(p.id) || new Set();
      return {
        ...p,
        hasVoted: votedCategories.size > 0,
        votedCategoriesCount: votedCategories.size,
        totalCategoriesCount: p.categories.length,
      };
    });
  }

  return polls;
}

/**
 * Get detailed poll with categories and candidate items
 */
export async function getPollDetails(pollId, { role, userId }) {
  const poll = await prisma.menuPoll.findUnique({
    where: { id: pollId },
    include: {
      categories: {
        orderBy: { displayOrder: "asc" },
        include: {
          candidates: {
            include: {
              menuItem: true,
            },
            orderBy: [{ voteCount: "desc" }, { createdAt: "asc" }],
          },
        },
      },
      _count: {
        select: { ballots: true, candidates: true },
      },
    },
  });

  if (!poll) return null;

  // Filter candidates if student: students only see approved & available
  if (role === "STUDENT") {
    poll.categories = poll.categories.map((cat) => ({
      ...cat,
      candidates: cat.candidates.filter(
        (c) => c.status === "APPROVED" && c.isAvailable
      ),
    }));
  }

  // If student, attach their ballots
  let studentBallot = {};
  if (role === "STUDENT" && userId) {
    const ballots = await prisma.menuPollBallot.findMany({
      where: { pollId, userId },
      include: {
        selections: {
          select: { candidateId: true },
        },
      },
    });
    for (const b of ballots) {
      studentBallot[b.categoryId] = b.selections.map((s) => s.candidateId);
    }
  }

  // Calculate results if poll closed or live results enabled or admin/staff
  let results = null;
  if (
    poll.status === "CLOSED" ||
    poll.showLiveResults ||
    role === "ADMIN" ||
    role === "MESS_INCHARGE"
  ) {
    results = await calculatePollResults(pollId);
  }

  return {
    ...poll,
    studentBallot,
    results,
  };
}

/**
 * Create a new poll (Admin)
 */
export async function createPoll(data, adminUserId) {
  const {
    name,
    description,
    targetMonth,
    targetYear,
    startDate,
    endDate,
    messTypes = ["VEG", "NON_VEG", "SPECIAL", "FOODPARK"],
    maxSelectionsPerCategory = 3,
    allowBallotEdit = true,
    showLiveResults = false,
    allowLiveCandidateAdditions = false,
    requireCandidateApproval = true,
    fairnessPolicy = "LATE_ENTRY_FLAG",
    tieBreakerPolicy = "ADMIN_REVIEW",
    weekNumbering = "CALENDAR_WEEKS",
    categories = [],
  } = data;

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new Error("Invalid start or end date");
  }
  if (start >= end) {
    throw new Error("Voting end date must be after start date");
  }

  // Default meal slot categories if none provided
  const categoryList =
    categories.length > 0
      ? categories
      : [
          { name: "Breakfast Favorites", mealSlot: "BREAKFAST", maxSelections: 3, displayOrder: 1 },
          { name: "Lunch Specials", mealSlot: "LUNCH", maxSelections: 3, displayOrder: 2 },
          { name: "Snacks & Refreshments", mealSlot: "SNACKS", maxSelections: 2, displayOrder: 3 },
          { name: "Dinner Delights", mealSlot: "DINNER", maxSelections: 3, displayOrder: 4 },
        ];

  const poll = await prisma.menuPoll.create({
    data: {
      name,
      description,
      targetMonth: Number(targetMonth),
      targetYear: Number(targetYear),
      startDate: start,
      endDate: end,
      messTypes,
      maxSelectionsPerCategory: Number(maxSelectionsPerCategory),
      allowBallotEdit: Boolean(allowBallotEdit),
      showLiveResults: Boolean(showLiveResults),
      allowLiveCandidateAdditions: Boolean(allowLiveCandidateAdditions),
      requireCandidateApproval: Boolean(requireCandidateApproval),
      fairnessPolicy,
      tieBreakerPolicy,
      weekNumbering,
      createdById: adminUserId,
      categories: {
        create: categoryList.map((c, i) => ({
          name: c.name,
          mealSlot: c.mealSlot,
          maxSelections: Number(c.maxSelections || maxSelectionsPerCategory),
          displayOrder: c.displayOrder ?? i + 1,
        })),
      },
    },
    include: {
      categories: true,
    },
  });

  await prisma.menuPollAudit.create({
    data: {
      pollId: poll.id,
      actorId: adminUserId,
      actorRole: "ADMIN",
      action: "POLL_CREATED",
      details: JSON.stringify({ name, targetMonth, targetYear, startDate, endDate }),
    },
  });

  return poll;
}

/**
 * Update poll settings (Admin)
 */
export async function updatePoll(pollId, data, adminUserId) {
  const poll = await prisma.menuPoll.findUnique({ where: { id: pollId } });
  if (!poll) throw new Error("Poll not found");

  const allowedFields = [
    "name",
    "description",
    "targetMonth",
    "targetYear",
    "startDate",
    "endDate",
    "messTypes",
    "maxSelectionsPerCategory",
    "allowBallotEdit",
    "showLiveResults",
    "allowLiveCandidateAdditions",
    "requireCandidateApproval",
    "fairnessPolicy",
    "tieBreakerPolicy",
    "weekNumbering",
  ];

  const updateData = {};
  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      if (field === "startDate" || field === "endDate") {
        updateData[field] = new Date(data[field]);
      } else if (field === "targetMonth" || field === "targetYear" || field === "maxSelectionsPerCategory") {
        updateData[field] = Number(data[field]);
      } else {
        updateData[field] = data[field];
      }
    }
  }

  const updated = await prisma.menuPoll.update({
    where: { id: pollId },
    data: updateData,
    include: { categories: true },
  });

  await prisma.menuPollAudit.create({
    data: {
      pollId,
      actorId: adminUserId,
      actorRole: "ADMIN",
      action: "POLL_CONFIG_UPDATED",
      details: JSON.stringify({ changedFields: Object.keys(updateData) }),
    },
  });

  return updated;
}

/**
 * Change poll lifecycle status (Admin)
 */
export async function changePollStatus(pollId, targetStatus, adminUserId, reason = "") {
  const poll = await prisma.menuPoll.findUnique({ where: { id: pollId } });
  if (!poll) throw new Error("Poll not found");

  const allowed = VALID_TRANSITIONS[poll.status] || [];
  if (!allowed.includes(targetStatus)) {
    throw new Error(
      `Invalid state transition: Cannot change status from ${poll.status} to ${targetStatus}`
    );
  }

  const updateData = { status: targetStatus };

  if (targetStatus === "CANCELLED") {
    updateData.cancellationReason = reason || "Cancelled by administrator";
  }

  // If closing, freeze results snapshot
  if (targetStatus === "CLOSED") {
    const snapshot = await calculatePollResults(pollId, true);
    updateData.frozenResults = JSON.stringify(snapshot);
  }

  const updated = await prisma.menuPoll.update({
    where: { id: pollId },
    data: updateData,
  });

  await prisma.menuPollAudit.create({
    data: {
      pollId,
      actorId: adminUserId,
      actorRole: "ADMIN",
      action: `STATUS_CHANGED_TO_${targetStatus}`,
      details: JSON.stringify({ previousStatus: poll.status, newStatus: targetStatus, reason }),
    },
  });

  // Notifications
  if (targetStatus === "OPEN") {
    await notifyStudents({
      type: "POLL_UPDATE",
      title: "Menu Voting Is Now Open!",
      message: `Voting is live for ${poll.name}. Cast your votes for next month's menu!`,
      metadata: { pollId: poll.id, targetMonth: poll.targetMonth, targetYear: poll.targetYear },
    }).catch(() => {});
  } else if (targetStatus === "CLOSED") {
    await notifyStudents({
      type: "POLL_UPDATE",
      title: "Menu Voting Closed",
      message: `Voting has closed for ${poll.name}. Results will be evaluated by the mess committee.`,
      metadata: { pollId: poll.id },
    }).catch(() => {});
  }

  return updated;
}

/**
 * Submit or replace a student's ballot for a specific category
 */
export async function submitBallot(pollId, categoryId, candidateIds, userId) {
  const poll = await prisma.menuPoll.findUnique({
    where: { id: pollId },
    include: { categories: true },
  });
  if (!poll) throw new Error("Poll not found");

  if (poll.status !== "OPEN") {
    throw new Error(`Poll is not accepting votes. Current status: ${poll.status}`);
  }

  const now = new Date();
  if (now < new Date(poll.startDate) || now > new Date(poll.endDate)) {
    throw new Error("Voting window is not active. Submissions are rejected outside the permitted dates.");
  }

  // Student eligibility check
  const student = await prisma.user.findUnique({
    where: { id: userId },
    include: { studentProfile: true },
  });
  if (!student || student.role !== "STUDENT") {
    throw new Error("Only authenticated students are eligible to vote");
  }

  const studentMess = student.studentProfile?.messType;
  if (studentMess && poll.messTypes.length > 0 && !poll.messTypes.includes(studentMess)) {
    throw new Error(`This poll is not applicable to your registered mess type (${studentMess})`);
  }

  const category = poll.categories.find((c) => c.id === categoryId);
  if (!category) throw new Error("Category not found in this poll");

  // Selection limit check
  const uniqueCandidateIds = [...new Set(candidateIds)];
  if (uniqueCandidateIds.length > category.maxSelections) {
    throw new Error(
      `You may select at most ${category.maxSelections} candidate(s) in this category.`
    );
  }

  // Validate candidate existence and availability
  if (uniqueCandidateIds.length > 0) {
    const candidates = await prisma.menuPollCandidate.findMany({
      where: {
        id: { in: uniqueCandidateIds },
        categoryId,
        pollId,
        status: "APPROVED",
        isAvailable: true,
      },
    });

    if (candidates.length !== uniqueCandidateIds.length) {
      throw new Error("One or more selected candidates are invalid, unapproved, or unavailable.");
    }
  }

  // Transaction: Replace or insert ballot safely
  return await prisma.$transaction(async (tx) => {
    const existingBallot = await tx.menuPollBallot.findUnique({
      where: {
        pollId_userId_categoryId: {
          pollId,
          userId,
          categoryId,
        },
      },
      include: { selections: true },
    });

    if (existingBallot && !poll.allowBallotEdit) {
      throw new Error("Ballot modification is not permitted for this poll.");
    }

    let ballotId = existingBallot?.id;

    if (existingBallot) {
      // Decrement vote counts of previously selected candidates
      const previousCandidateIds = existingBallot.selections.map((s) => s.candidateId);
      if (previousCandidateIds.length > 0) {
        await tx.menuPollCandidate.updateMany({
          where: { id: { in: previousCandidateIds } },
          data: { voteCount: { decrement: 1 } },
        });
      }

      // Delete prior selections
      await tx.menuPollBallotSelection.deleteMany({
        where: { ballotId: existingBallot.id },
      });

      // Update ballot timestamp
      await tx.menuPollBallot.update({
        where: { id: existingBallot.id },
        data: { updatedAt: new Date() },
      });
    } else {
      const created = await tx.menuPollBallot.create({
        data: {
          pollId,
          userId,
          categoryId,
        },
      });
      ballotId = created.id;
    }

    // Insert new selections
    if (uniqueCandidateIds.length > 0) {
      await tx.menuPollBallotSelection.createMany({
        data: uniqueCandidateIds.map((cid) => ({
          ballotId,
          candidateId: cid,
        })),
      });

      // Increment candidate vote counts
      await tx.menuPollCandidate.updateMany({
        where: { id: { in: uniqueCandidateIds } },
        data: { voteCount: { increment: 1 } },
      });
    }

    // Audit record (does not expose candidate selections)
    await tx.menuPollAudit.create({
      data: {
        pollId,
        actorId: userId,
        actorRole: "STUDENT",
        action: existingBallot ? "BALLOT_EDITED" : "BALLOT_SUBMITTED",
        details: JSON.stringify({
          categoryId,
          selectionCount: uniqueCandidateIds.length,
          timestamp: new Date().toISOString(),
        }),
      },
    });

    return {
      success: true,
      message: existingBallot ? "Ballot updated successfully" : "Ballot cast successfully",
      ballotId,
      categoryId,
      selectedCount: uniqueCandidateIds.length,
    };
  });
}

/**
 * Calculate approval voting results for a poll
 */
export async function calculatePollResults(pollId, forceLive = false) {
  const poll = await prisma.menuPoll.findUnique({
    where: { id: pollId },
    include: {
      categories: {
        orderBy: { displayOrder: "asc" },
        include: {
          candidates: {
            include: { menuItem: true },
          },
          ballots: {
            include: { selections: true },
          },
        },
      },
    },
  });

  if (!poll) throw new Error("Poll not found");

  // If frozen and not forcing live calculation, return frozen snapshot
  if (!forceLive && poll.status === "CLOSED" && poll.frozenResults) {
    try {
      return JSON.parse(poll.frozenResults);
    } catch {
      // Fallback to recalculation
    }
  }

  // Count total eligible voters
  const eligibleStudentsCount = await prisma.studentProfile.count({
    where: {
      messType: { in: poll.messTypes },
      user: { isActive: true },
    },
  });

  // Count unique voters who submitted at least one ballot
  const uniqueVoterRows = await prisma.menuPollBallot.findMany({
    where: { pollId },
    distinct: ["userId"],
    select: { userId: true },
  });
  const uniqueVotersCount = uniqueVoterRows.length;

  const turnoutPercentage =
    eligibleStudentsCount > 0
      ? Number(((uniqueVotersCount / eligibleStudentsCount) * 100).toFixed(1))
      : null;

  const categoriesResults = poll.categories.map((cat) => {
    // Valid submitted ballots in this category = denominator
    const validBallotsInCategory = cat.ballots.length;

    // Count votes for each candidate from selections directly
    const candidateVoteMap = new Map();
    for (const b of cat.ballots) {
      for (const sel of b.selections) {
        candidateVoteMap.set(sel.candidateId, (candidateVoteMap.get(sel.candidateId) || 0) + 1);
      }
    }

    const candidateList = cat.candidates.map((c) => {
      const votes = candidateVoteMap.get(c.id) || 0;
      // Approval vote share formula:
      // (valid ballots selecting the candidate / valid submitted ballots in category) * 100
      const voteShare =
        validBallotsInCategory > 0
          ? Number(((votes / validBallotsInCategory) * 100).toFixed(1))
          : 0;

      let dietaryTags = [];
      try {
        dietaryTags = JSON.parse(c.dietaryTags || "[]");
      } catch {
        dietaryTags = [];
      }

      return {
        id: c.id,
        dishName: c.dishName,
        messType: c.messType,
        mealSlot: c.mealSlot,
        description: c.description,
        calories: c.calories,
        proteinG: c.proteinG,
        carbsG: c.carbsG,
        fatsG: c.fatsG,
        allergens: c.allergens || "Not available",
        dietaryTags,
        isAvailable: c.isAvailable,
        isLiveAddition: c.isLiveAddition,
        status: c.status,
        version: c.version,
        voteCount: votes,
        voteSharePercentage: voteShare,
        menuItemId: c.menuItemId,
      };
    });

    // Sort candidates according to tie-breaker policy
    candidateList.sort((a, b) => {
      if (b.voteCount !== a.voteCount) {
        return b.voteCount - a.voteCount;
      }
      if (poll.tieBreakerPolicy === "HIGHER_NUTRITION") {
        return (b.proteinG || 0) - (a.proteinG || 0);
      }
      return 0; // Maintain tie for review
    });

    // Detect ties and assign ranks
    let currentRank = 1;
    for (let i = 0; i < candidateList.length; i++) {
      if (i > 0) {
        if (candidateList[i].voteCount === candidateList[i - 1].voteCount) {
          candidateList[i].rank = candidateList[i - 1].rank;
          candidateList[i].isTie = true;
          candidateList[i - 1].isTie = true;
        } else {
          currentRank = i + 1;
          candidateList[i].rank = currentRank;
          candidateList[i].isTie = false;
        }
      } else {
        candidateList[i].rank = currentRank;
        candidateList[i].isTie = false;
      }
    }

    return {
      categoryId: cat.id,
      categoryName: cat.name,
      mealSlot: cat.mealSlot,
      maxSelections: cat.maxSelections,
      validSubmittedBallots: validBallotsInCategory,
      candidates: candidateList,
    };
  });

  return {
    pollId: poll.id,
    pollName: poll.name,
    targetMonth: poll.targetMonth,
    targetYear: poll.targetYear,
    status: poll.status,
    totalEligibleVoters: eligibleStudentsCount,
    uniqueVotersCount,
    turnoutPercentage,
    denominatorNote:
      "Vote share is calculated as: (Valid ballots selecting candidate / Total valid ballots in category) × 100",
    categories: categoriesResults,
    calculatedAt: new Date().toISOString(),
  };
}
