import { parse } from "csv-parse/sync";
import { prisma } from "../lib/prisma.js";
import { notifyStudents, notifyAdmins } from "./notifications.js";

const VALID_MESS_TYPES = ["VEG", "NON_VEG", "SPECIAL", "FOODPARK"];
const VALID_MEAL_SLOTS = ["BREAKFAST", "LUNCH", "SNACKS", "DINNER", "FEAST", "NIGHT_MESS"];

function sanitizeFormulaInjection(value) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (/^[=+\-@\t\r]/.test(trimmed)) {
    return "'" + trimmed;
  }
  return trimmed;
}

/**
 * Get manager's assigned mess types
 */
async function getManagerMessTypes(userId) {
  const profile = await prisma.messManagerProfile.findUnique({
    where: { userId },
  });
  return profile?.messTypes?.length
    ? profile.messTypes
    : ["VEG", "NON_VEG", "SPECIAL", "FOODPARK"];
}

/**
 * Add a candidate dish to a poll category
 */
export async function addCandidate(pollId, data, actor) {
  const poll = await prisma.menuPoll.findUnique({
    where: { id: pollId },
    include: { categories: true },
  });
  if (!poll) throw new Error("Poll not found");

  if (["CLOSED", "ARCHIVED", "CANCELLED"].includes(poll.status)) {
    throw new Error(`Cannot add candidates to a poll with status ${poll.status}`);
  }

  const {
    categoryId,
    dishName,
    messType,
    mealSlot,
    description,
    calories = 0,
    proteinG = 0,
    carbsG = 0,
    fatsG = 0,
    allergens,
    dietaryTags = [],
    menuItemId,
    amendmentReason,
  } = data;

  if (!dishName || !dishName.trim()) {
    throw new Error("dishName is required");
  }
  if (!VALID_MESS_TYPES.includes(messType)) {
    throw new Error(`Invalid messType: ${messType}`);
  }
  if (!VALID_MEAL_SLOTS.includes(mealSlot)) {
    throw new Error(`Invalid mealSlot: ${mealSlot}`);
  }

  const category = poll.categories.find((c) => c.id === categoryId);
  if (!category) throw new Error("Category does not belong to this poll");

  // Determine approval status and permissions based on actor role
  let status = "APPROVED";
  let isLiveAddition = false;

  if (actor.role === "MESS_INCHARGE") {
    const assigned = await getManagerMessTypes(actor.id);
    if (!assigned.includes(messType)) {
      throw new Error(`You are not authorized to manage candidates for mess type: ${messType}`);
    }

    const managerProfile = await prisma.messManagerProfile.findUnique({
      where: { userId: actor.id },
    });
    const hasLivePrivilege =
      managerProfile?.canAddLiveCandidates || poll.allowLiveCandidateAdditions;

    if (poll.status === "OPEN") {
      if (hasLivePrivilege) {
        status = "APPROVED";
        isLiveAddition = true;
      } else if (poll.requireCandidateApproval) {
        status = "PENDING_APPROVAL";
      } else {
        throw new Error("Adding candidates during active voting is not permitted for this poll.");
      }
    } else if (poll.status === "DRAFT" || poll.status === "SCHEDULED") {
      status = poll.requireCandidateApproval ? "PENDING_APPROVAL" : "APPROVED";
    }
  } else if (actor.role === "ADMIN") {
    status = "APPROVED";
    if (poll.status === "OPEN") {
      isLiveAddition = true;
    }
  } else {
    throw new Error("Unauthorized");
  }

  // Reuse or link to existing MenuItem
  let linkedMenuItemId = menuItemId;
  let isVeg = messType === "VEG";

  if (!linkedMenuItemId) {
    const existingDish = await prisma.menuItem.findFirst({
      where: { name: { equals: dishName.trim(), mode: "insensitive" } },
    });
    if (existingDish) {
      linkedMenuItemId = existingDish.id;
      isVeg = existingDish.isVeg;
    } else {
      // Create new catalog MenuItem
      const createdItem = await prisma.menuItem.create({
        data: {
          name: dishName.trim(),
          calories: Number(calories) || 0,
          proteinG: Number(proteinG) || 0,
          carbsG: Number(carbsG) || 0,
          fatsG: Number(fatsG) || 0,
          isVeg,
          tags: JSON.stringify(Array.isArray(dietaryTags) ? dietaryTags : []),
        },
      });
      linkedMenuItemId = createdItem.id;
    }
  }

  const candidate = await prisma.menuPollCandidate.create({
    data: {
      pollId,
      categoryId,
      dishName: sanitizeFormulaInjection(dishName.trim()),
      messType,
      mealSlot,
      description: sanitizeFormulaInjection(description || ""),
      calories: Number(calories) || 0,
      proteinG: Number(proteinG) || 0,
      carbsG: Number(carbsG) || 0,
      fatsG: Number(fatsG) || 0,
      allergens: sanitizeFormulaInjection(allergens || null),
      dietaryTags: JSON.stringify(Array.isArray(dietaryTags) ? dietaryTags : []),
      isAvailable: true,
      isLiveAddition,
      status,
      submittedByRole: actor.role,
      submittedByUserId: actor.id,
      amendmentReason: amendmentReason ? sanitizeFormulaInjection(amendmentReason) : null,
      menuItemId: linkedMenuItemId,
    },
    include: { menuItem: true },
  });

  await prisma.menuPollAudit.create({
    data: {
      pollId,
      candidateId: candidate.id,
      actorId: actor.id,
      actorRole: actor.role,
      action: status === "APPROVED" ? "CANDIDATE_ADDED" : "CANDIDATE_PROPOSAL_SUBMITTED",
      details: JSON.stringify({
        dishName,
        messType,
        mealSlot,
        status,
        isLiveAddition,
      }),
    },
  });

  if (status === "PENDING_APPROVAL") {
    await notifyAdmins({
      type: "POLL_UPDATE",
      title: "New Candidate Proposal",
      message: `A mess manager proposed "${dishName}" for ${poll.name}. Review needed.`,
      metadata: { pollId, candidateId: candidate.id },
    }).catch(() => {});
  } else if (isLiveAddition && poll.status === "OPEN") {
    await notifyStudents({
      type: "POLL_UPDATE",
      title: "New Candidate Added To Active Poll",
      message: `"${dishName}" was added to ${category.name} in ${poll.name}. Cast your vote!`,
      metadata: { pollId, candidateId: candidate.id, categoryId },
    }).catch(() => {});
  }

  return candidate;
}

/**
 * Update candidate details or availability
 */
export async function updateCandidate(candidateId, data, actor) {
  const candidate = await prisma.menuPollCandidate.findUnique({
    where: { id: candidateId },
    include: { poll: true },
  });
  if (!candidate) throw new Error("Candidate not found");

  if (actor.role === "MESS_INCHARGE") {
    const assigned = await getManagerMessTypes(actor.id);
    if (!assigned.includes(candidate.messType)) {
      throw new Error("You are not authorized for this mess type");
    }
  }

  const {
    dishName,
    description,
    calories,
    proteinG,
    carbsG,
    fatsG,
    allergens,
    dietaryTags,
    isAvailable,
    amendmentReason,
  } = data;

  const updateData = {};
  let isMaterialChange = false;

  if (isAvailable !== undefined) {
    updateData.isAvailable = Boolean(isAvailable);
  }

  if (dishName && dishName.trim() !== candidate.dishName) {
    updateData.dishName = sanitizeFormulaInjection(dishName.trim());
    isMaterialChange = true;
  }
  if (description !== undefined) {
    updateData.description = sanitizeFormulaInjection(description);
  }
  if (calories !== undefined) updateData.calories = Number(calories);
  if (proteinG !== undefined) updateData.proteinG = Number(proteinG);
  if (carbsG !== undefined) updateData.carbsG = Number(carbsG);
  if (fatsG !== undefined) updateData.fatsG = Number(fatsG);
  if (allergens !== undefined) updateData.allergens = sanitizeFormulaInjection(allergens);
  if (dietaryTags !== undefined) {
    updateData.dietaryTags = JSON.stringify(Array.isArray(dietaryTags) ? dietaryTags : []);
  }

  // If live poll and material attributes changed, bump version and record reason
  if (candidate.poll.status === "OPEN" && isMaterialChange) {
    updateData.version = candidate.version + 1;
    updateData.amendmentReason = sanitizeFormulaInjection(
      amendmentReason || "Material details updated during live voting"
    );
  }

  const updated = await prisma.menuPollCandidate.update({
    where: { id: candidateId },
    data: updateData,
  });

  await prisma.menuPollAudit.create({
    data: {
      pollId: candidate.pollId,
      candidateId: candidate.id,
      actorId: actor.id,
      actorRole: actor.role,
      action: isAvailable === false ? "CANDIDATE_MARKED_UNAVAILABLE" : "CANDIDATE_UPDATED",
      details: JSON.stringify({
        changedFields: Object.keys(updateData),
        amendmentReason,
        version: updated.version,
      }),
    },
  });

  return updated;
}

/**
 * Review pending candidate proposal (Admin)
 */
export async function reviewCandidateProposal(candidateId, { status, rejectionReason }, adminUserId) {
  if (!["APPROVED", "REJECTED"].includes(status)) {
    throw new Error("Status must be APPROVED or REJECTED");
  }

  const candidate = await prisma.menuPollCandidate.findUnique({
    where: { id: candidateId },
    include: { poll: true },
  });
  if (!candidate) throw new Error("Candidate not found");

  const updated = await prisma.menuPollCandidate.update({
    where: { id: candidateId },
    data: {
      status,
      rejectionReason: status === "REJECTED" ? rejectionReason || "Rejected by administrator" : null,
      isLiveAddition: candidate.poll.status === "OPEN",
    },
  });

  await prisma.menuPollAudit.create({
    data: {
      pollId: candidate.pollId,
      candidateId: candidate.id,
      actorId: adminUserId,
      actorRole: "ADMIN",
      action: `PROPOSAL_${status}`,
      details: JSON.stringify({ status, rejectionReason }),
    },
  });

  if (status === "APPROVED" && candidate.poll.status === "OPEN") {
    await notifyStudents({
      type: "POLL_UPDATE",
      title: "New Candidate Approved",
      message: `"${candidate.dishName}" was approved and is now open for voting in ${candidate.poll.name}!`,
      metadata: { pollId: candidate.pollId, candidateId: candidate.id },
    }).catch(() => {});
  }

  return updated;
}

/**
 * Generate candidate CSV template
 */
export function generateCandidateCsvTemplate() {
  const headers = [
    "dish_name",
    "mess_type",
    "meal_slot",
    "category_name",
    "description",
    "calories",
    "protein_g",
    "carbohydrates_g",
    "fat_g",
    "allergens",
    "dietary_tags",
    "available",
  ];

  const sampleRows = [
    [
      "Paneer Butter Masala",
      "VEG",
      "LUNCH",
      "Lunch Specials",
      "Cottage cheese cubes in rich tomato cream gravy",
      "280",
      "12",
      "18",
      "18",
      "Dairy",
      "High Protein,Vegetarian",
      "true",
    ],
    [
      "Chicken Biryani",
      "NON_VEG",
      "DINNER",
      "Dinner Delights",
      "Aromatic spiced basmati rice with marinated chicken",
      "460",
      "28",
      "52",
      "14",
      "Dairy",
      "High Protein",
      "true",
    ],
    [
      "Masala Dosa",
      "VEG",
      "BREAKFAST",
      "Breakfast Favorites",
      "Crispy fermented crepe stuffed with potato masala",
      "220",
      "6",
      "34",
      "7",
      "Mustard",
      "Vegetarian",
      "true",
    ],
  ];

  const csvContent = [
    headers.join(","),
    ...sampleRows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")),
  ].join("\n");

  return csvContent;
}

/**
 * Parse and validate candidates CSV
 */
export async function parseAndValidateCandidateCsv(buffer, pollId, actor) {
  const poll = await prisma.menuPoll.findUnique({
    where: { id: pollId },
    include: {
      categories: true,
      candidates: { select: { dishName: true, messType: true, categoryId: true } },
    },
  });
  if (!poll) throw new Error("Poll not found");

  const assignedMesses =
    actor.role === "MESS_INCHARGE"
      ? await getManagerMessTypes(actor.id)
      : VALID_MESS_TYPES;

  let records = [];
  try {
    records = parse(buffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
  } catch (err) {
    throw new Error(`CSV parsing error: ${err.message}`);
  }

  if (records.length === 0) {
    throw new Error("Uploaded CSV file is empty");
  }
  if (records.length > 500) {
    throw new Error("File exceeds maximum allowed rows (500 rows per import)");
  }

  const validRows = [];
  const errorRows = [];
  const seenInFile = new Set();

  for (let i = 0; i < records.length; i++) {
    const raw = records[i];
    const rowNum = i + 2; // accounting for header
    const errors = [];

    // Map headers flexibly
    const dishName =
      raw.dish_name || raw.dishName || raw["Dish Name"] || raw.name || "";
    const messType = (
      raw.mess_type || raw.messType || raw["Mess Type"] || "VEG"
    )
      .toUpperCase()
      .trim();
    const mealSlot = (
      raw.meal_slot || raw.mealSlot || raw["Meal Slot"] || "LUNCH"
    )
      .toUpperCase()
      .trim();
    const categoryName =
      raw.category_name || raw.category || raw["Category Name"] || "";
    const description = raw.description || raw["Description"] || "";
    const calories = parseFloat(raw.calories || raw.calories_kcal || 0);
    const proteinG = parseFloat(raw.protein_g || raw.proteinG || 0);
    const carbsG = parseFloat(raw.carbohydrates_g || raw.carbsG || 0);
    const fatsG = parseFloat(raw.fat_g || raw.fatsG || 0);
    const allergens = raw.allergens || "";
    const dietaryTagsRaw = raw.dietary_tags || raw.tags || "";
    const available = raw.available === "false" || raw.available === false ? false : true;

    if (!dishName.trim()) {
      errors.push("Missing required field: dish_name");
    }

    if (!VALID_MESS_TYPES.includes(messType)) {
      errors.push(`Invalid mess_type '${messType}'. Permitted: ${VALID_MESS_TYPES.join(", ")}`);
    } else if (!assignedMesses.includes(messType)) {
      errors.push(`Mess type '${messType}' is outside your authorized mess assignments`);
    }

    if (!VALID_MEAL_SLOTS.includes(mealSlot)) {
      errors.push(`Invalid meal_slot '${mealSlot}'. Permitted: ${VALID_MEAL_SLOTS.join(", ")}`);
    }

    if (isNaN(calories) || calories < 0) errors.push("calories must be a non-negative number");
    if (isNaN(proteinG) || proteinG < 0) errors.push("protein_g must be a non-negative number");
    if (isNaN(carbsG) || carbsG < 0) errors.push("carbohydrates_g must be a non-negative number");
    if (isNaN(fatsG) || fatsG < 0) errors.push("fat_g must be a non-negative number");

    // Match or resolve category
    let matchedCategory = null;
    if (categoryName) {
      matchedCategory = poll.categories.find(
        (c) => c.name.toLowerCase() === categoryName.toLowerCase()
      );
    }
    if (!matchedCategory) {
      matchedCategory = poll.categories.find((c) => c.mealSlot === mealSlot);
    }
    if (!matchedCategory && poll.categories.length > 0) {
      matchedCategory = poll.categories[0];
    }
    if (!matchedCategory) {
      errors.push("No matching category found in this poll");
    }

    // Check duplicate in file
    const dedupeKey = `${dishName.trim().toLowerCase()}_${messType}_${matchedCategory?.id}`;
    if (seenInFile.has(dedupeKey)) {
      errors.push("Duplicate dish row within this CSV file");
    }
    seenInFile.add(dedupeKey);

    // Check duplicate in poll
    const existsInPoll = poll.candidates.some(
      (c) =>
        c.dishName.toLowerCase() === dishName.trim().toLowerCase() &&
        c.messType === messType &&
        c.categoryId === matchedCategory?.id
    );
    if (existsInPoll) {
      errors.push("Dish is already registered as a candidate in this poll category");
    }

    let dietaryTags = [];
    if (dietaryTagsRaw) {
      dietaryTags = String(dietaryTagsRaw)
        .split(/[;,|]+/)
        .map((s) => s.trim())
        .filter(Boolean);
    }

    if (errors.length > 0) {
      errorRows.push({
        row: rowNum,
        dishName: dishName || "(Empty)",
        errors,
      });
    } else {
      validRows.push({
        row: rowNum,
        dishName: sanitizeFormulaInjection(dishName.trim()),
        messType,
        mealSlot,
        categoryId: matchedCategory.id,
        categoryName: matchedCategory.name,
        description: sanitizeFormulaInjection(description),
        calories: isNaN(calories) ? 0 : calories,
        proteinG: isNaN(proteinG) ? 0 : proteinG,
        carbsG: isNaN(carbsG) ? 0 : carbsG,
        fatsG: isNaN(fatsG) ? 0 : fatsG,
        allergens: allergens ? sanitizeFormulaInjection(allergens) : null,
        dietaryTags,
        isAvailable: available,
      });
    }
  }

  return {
    summary: {
      totalRows: records.length,
      validRowsCount: validRows.length,
      errorRowsCount: errorRows.length,
      canImport: validRows.length > 0,
    },
    validRows,
    errorRows,
  };
}

/**
 * Commit candidate CSV import
 */
export async function commitCandidateCsvImport(pollId, rows, actor) {
  const poll = await prisma.menuPoll.findUnique({
    where: { id: pollId },
  });
  if (!poll) throw new Error("Poll not found");

  let status = "APPROVED";
  if (actor.role === "MESS_INCHARGE") {
    const profile = await prisma.messManagerProfile.findUnique({ where: { userId: actor.id } });
    const hasLivePrivilege = profile?.canAddLiveCandidates || poll.allowLiveCandidateAdditions;
    if (poll.status === "OPEN" && !hasLivePrivilege) {
      status = poll.requireCandidateApproval ? "PENDING_APPROVAL" : "APPROVED";
    } else if (poll.requireCandidateApproval) {
      status = "PENDING_APPROVAL";
    }
  }

  const createdCandidates = [];

  for (const r of rows) {
    // Find or create MenuItem
    let menuItemId = null;
    const existing = await prisma.menuItem.findFirst({
      where: { name: { equals: r.dishName, mode: "insensitive" } },
    });
    if (existing) {
      menuItemId = existing.id;
    } else {
      const createdItem = await prisma.menuItem.create({
        data: {
          name: r.dishName,
          calories: r.calories,
          proteinG: r.proteinG,
          carbsG: r.carbsG,
          fatsG: r.fatsG,
          isVeg: r.messType === "VEG",
          tags: JSON.stringify(r.dietaryTags || []),
        },
      });
      menuItemId = createdItem.id;
    }

    const candidate = await prisma.menuPollCandidate.create({
      data: {
        pollId,
        categoryId: r.categoryId,
        dishName: r.dishName,
        messType: r.messType,
        mealSlot: r.mealSlot,
        description: r.description,
        calories: r.calories,
        proteinG: r.proteinG,
        carbsG: r.carbsG,
        fatsG: r.fatsG,
        allergens: r.allergens,
        dietaryTags: JSON.stringify(r.dietaryTags || []),
        isAvailable: r.isAvailable ?? true,
        status,
        submittedByRole: actor.role,
        submittedByUserId: actor.id,
        menuItemId,
      },
    });
    createdCandidates.push(candidate);
  }

  await prisma.menuPollAudit.create({
    data: {
      pollId,
      actorId: actor.id,
      actorRole: actor.role,
      action: "CSV_CANDIDATES_IMPORTED",
      details: JSON.stringify({
        importedCount: createdCandidates.length,
        status,
      }),
    },
  });

  return {
    importedCount: createdCandidates.length,
    status,
    candidates: createdCandidates,
  };
}
