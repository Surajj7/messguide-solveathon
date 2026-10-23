import { prisma } from "../lib/prisma.js";
import { notifyStudents, notifyAdmins } from "./notifications.js";

const MEAL_SLOTS = ["BREAKFAST", "LUNCH", "SNACKS", "DINNER"];
const DEFAULT_MESS_TYPES = ["VEG", "NON_VEG", "SPECIAL", "FOODPARK"];

/**
 * Helper to get all calendar dates for a target month & year
 */
function getDatesInMonth(year, month) {
  const dates = [];
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  for (let day = 1; day <= daysInMonth; day++) {
    const dStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    dates.push(new Date(dStr + "T00:00:00.000Z"));
  }
  return dates;
}

/**
 * Calculate week number based on convention
 */
function getWeekNumber(date, convention) {
  const dayOfMonth = date.getUTCDate();
  if (convention === "SEQUENTIAL_7_DAYS") {
    return Math.floor((dayOfMonth - 1) / 7) + 1;
  }
  // CALENDAR_WEEKS: standard ISO/calendar week within the month
  const firstDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const firstDayOfWeek = (firstDay.getUTCDay() + 6) % 7; // 0=Mon, 6=Sun
  return Math.floor((dayOfMonth + firstDayOfWeek - 1) / 7) + 1;
}

/**
 * Generate or regenerate a date-specific monthly menu plan
 */
export async function generateMonthlyPlan({
  pollId,
  targetMonth,
  targetYear,
  messTypes = DEFAULT_MESS_TYPES,
  weekConvention = "CALENDAR_WEEKS",
  name,
  adminUserId,
}) {
  const month = Number(targetMonth);
  const year = Number(targetYear);
  if (month < 1 || month > 12) throw new Error("Invalid target month (1-12)");

  const calendarDates = getDatesInMonth(year, month);
  const planName = name || `Monthly Menu Plan — ${new Date(year, month - 1).toLocaleString("en-US", { month: "long" })} ${year}`;

  // Check if a plan already exists for this month/year
  let plan = await prisma.monthlyMenuPlan.findFirst({
    where: { targetMonth: month, targetYear: year },
    include: { items: true },
  });

  const existingLockedItems = new Map();
  if (plan) {
    for (const item of plan.items) {
      if (item.isLocked) {
        const key = `${item.date.toISOString().slice(0, 10)}_${item.messType}_${item.mealSlot}_${item.sortOrder}`;
        existingLockedItems.set(key, item);
      }
    }
  } else {
    plan = await prisma.monthlyMenuPlan.create({
      data: {
        pollId: pollId || null,
        name: planName,
        targetMonth: month,
        targetYear: year,
        messTypes,
        weekConvention,
        status: "DRAFT",
      },
    });
  }

  // Load candidate dishes from poll if provided, or from verified catalog
  let candidatesBySlotMess = {};
  for (const m of messTypes) {
    candidatesBySlotMess[m] = {};
    for (const s of MEAL_SLOTS) {
      candidatesBySlotMess[m][s] = [];
    }
  }

  if (pollId) {
    const candidates = await prisma.menuPollCandidate.findMany({
      where: {
        pollId,
        status: "APPROVED",
        isAvailable: true,
      },
      include: { menuItem: true },
      orderBy: [{ voteCount: "desc" }, { calories: "asc" }],
    });

    for (const c of candidates) {
      if (candidatesBySlotMess[c.messType]?.[c.mealSlot]) {
        candidatesBySlotMess[c.messType][c.mealSlot].push({
          dishName: c.dishName,
          menuItemId: c.menuItemId,
          calories: c.calories || c.menuItem?.calories || 0,
          proteinG: c.proteinG || c.menuItem?.proteinG || 0,
          carbsG: c.carbsG || c.menuItem?.carbsG || 0,
          fatsG: c.fatsG || c.menuItem?.fatsG || 0,
          isVeg: c.menuItem?.isVeg ?? (c.messType === "VEG"),
          voteCount: c.voteCount,
        });
      }
    }
  }

  // Fallback: fill from verified MenuItem catalog if candidates are sparse
  const allMenuItems = await prisma.menuItem.findMany({
    orderBy: { name: "asc" },
  });

  const catalogFallback = {
    VEG: allMenuItems.filter((i) => i.isVeg),
    NON_VEG: allMenuItems,
    SPECIAL: allMenuItems,
    FOODPARK: allMenuItems,
  };

  // Generate date-specific entries for each date in month
  // Critical calendar rule: Each calendar date has distinct entries across weeks!
  const itemsToCreate = [];
  const recentDishesUsed = new Map(); // key: messType_mealSlot -> Map(dishName -> lastDateUsedIndex)

  // Clear existing unlocked items if regenerating
  if (plan.items && plan.items.length > 0) {
    await prisma.monthlyMenuPlanItem.deleteMany({
      where: { planId: plan.id, isLocked: false },
    });
  }

  calendarDates.forEach((dateObj, dateIndex) => {
    const dateStr = dateObj.toISOString().slice(0, 10);
    const dayOfWeek = dateObj.getUTCDay();
    const weekNumber = getWeekNumber(dateObj, weekConvention);

    for (const mess of messTypes) {
      for (const slot of MEAL_SLOTS) {
        // Items count per meal slot (e.g. 2 items per slot)
        const itemsCountForSlot = slot === "SNACKS" ? 1 : 2;

        for (let sortOrder = 0; sortOrder < itemsCountForSlot; sortOrder++) {
          const lockKey = `${dateStr}_${mess}_${slot}_${sortOrder}`;

          // Preserve locked item if present
          if (existingLockedItems.has(lockKey)) {
            continue;
          }

          // Pick candidate dish with cooldown/variety logic
          const availableCandidates = candidatesBySlotMess[mess]?.[slot] || [];
          let chosen = null;

          const recentKey = `${mess}_${slot}`;
          if (!recentDishesUsed.has(recentKey)) {
            recentDishesUsed.set(recentKey, new Map());
          }
          const usedMap = recentDishesUsed.get(recentKey);

          // Find candidate not used in last 3 days
          for (const cand of availableCandidates) {
            const lastUsedIndex = usedMap.get(cand.dishName);
            if (lastUsedIndex === undefined || dateIndex - lastUsedIndex >= 4) {
              chosen = cand;
              break;
            }
          }

          // If all candidates used recently, pick the one used longest ago or fallback catalog
          if (!chosen && availableCandidates.length > 0) {
            chosen = availableCandidates[dateIndex % availableCandidates.length];
          }

          // If still none, pick from catalog
          if (!chosen) {
            const fallbackList = catalogFallback[mess] || allMenuItems;
            if (fallbackList.length > 0) {
              const fb = fallbackList[(dateIndex * 3 + sortOrder) % fallbackList.length];
              chosen = {
                dishName: fb.name,
                menuItemId: fb.id,
                calories: fb.calories,
                proteinG: fb.proteinG,
                carbsG: fb.carbsG,
                fatsG: fb.fatsG,
                isVeg: fb.isVeg,
                voteCount: 0,
              };
            } else {
              chosen = {
                dishName: `${mess} ${slot} Selection ${sortOrder + 1}`,
                menuItemId: null,
                calories: 250,
                proteinG: 8,
                carbsG: 35,
                fatsG: 6,
                isVeg: mess === "VEG",
                voteCount: 0,
              };
            }
          }

          usedMap.set(chosen.dishName, dateIndex);

          itemsToCreate.push({
            planId: plan.id,
            date: dateObj,
            dayOfWeek,
            weekNumber,
            messType: mess,
            mealSlot: slot,
            menuItemId: chosen.menuItemId,
            dishName: chosen.dishName,
            isLocked: false,
            sourceVoteCount: chosen.voteCount || 0,
            nutritionSnapshot: JSON.stringify({
              calories: chosen.calories || 0,
              proteinG: chosen.proteinG || 0,
              carbsG: chosen.carbsG || 0,
              fatsG: chosen.fatsG || 0,
              isVeg: chosen.isVeg,
            }),
            sortOrder,
          });
        }
      }
    }
  });

  if (itemsToCreate.length > 0) {
    await prisma.monthlyMenuPlanItem.createMany({
      data: itemsToCreate,
    });
  }

  // Record audit
  await prisma.menuPollAudit.create({
    data: {
      pollId: pollId || null,
      actorId: adminUserId,
      actorRole: "ADMIN",
      action: "MONTHLY_MENU_PLAN_GENERATED",
      details: JSON.stringify({
        planId: plan.id,
        targetMonth: month,
        targetYear: year,
        totalItemsCreated: itemsToCreate.length,
        preservedLockedCount: existingLockedItems.size,
      }),
    },
  });

  return await getMonthlyPlan(plan.id);
}

/**
 * Fetch full monthly menu plan with items
 */
export async function getMonthlyPlan(planId) {
  const plan = await prisma.monthlyMenuPlan.findUnique({
    where: { id: planId },
    include: {
      items: {
        include: { menuItem: true },
        orderBy: [{ date: "asc" }, { mealSlot: "asc" }, { sortOrder: "asc" }],
      },
      poll: {
        select: { id: true, name: true, targetMonth: true, targetYear: true },
      },
    },
  });
  if (!plan) return null;

  // Group items by date string
  const calendarMap = {};
  for (const item of plan.items) {
    const dStr = item.date.toISOString().slice(0, 10);
    if (!calendarMap[dStr]) {
      calendarMap[dStr] = {
        date: dStr,
        dayOfWeek: item.dayOfWeek,
        weekNumber: item.weekNumber,
        meals: {
          BREAKFAST: [],
          LUNCH: [],
          SNACKS: [],
          DINNER: [],
        },
      };
    }
    let nutrition = null;
    try {
      nutrition = JSON.parse(item.nutritionSnapshot || "{}");
    } catch {
      nutrition = {};
    }
    calendarMap[dStr].meals[item.mealSlot].push({
      id: item.id,
      dishName: item.dishName,
      messType: item.messType,
      isLocked: item.isLocked,
      sourceVoteCount: item.sourceVoteCount,
      sortOrder: item.sortOrder,
      menuItemId: item.menuItemId,
      nutrition,
    });
  }

  return {
    ...plan,
    totalEntriesCount: plan.items.length,
    calendar: Object.values(calendarMap),
  };
}

/**
 * List all monthly plans (Admin)
 */
export async function listMonthlyPlans() {
  return await prisma.monthlyMenuPlan.findMany({
    include: {
      _count: { select: { items: true } },
      poll: { select: { id: true, name: true } },
    },
    orderBy: [{ targetYear: "desc" }, { targetMonth: "desc" }],
  });
}

/**
 * Update an individual plan item (Pin/Lock, swap dish)
 */
export async function updatePlanItem(itemId, { dishName, menuItemId, isLocked, sortOrder }, actor) {
  const item = await prisma.monthlyMenuPlanItem.findUnique({
    where: { id: itemId },
    include: { plan: true },
  });
  if (!item) throw new Error("Plan item not found");
  if (item.plan.status === "PUBLISHED" && actor.role !== "ADMIN") {
    throw new Error("Cannot edit published menu without admin privilege");
  }

  const updateData = {};
  if (isLocked !== undefined) updateData.isLocked = Boolean(isLocked);
  if (dishName && dishName.trim()) updateData.dishName = dishName.trim();
  if (menuItemId !== undefined) updateData.menuItemId = menuItemId;
  if (sortOrder !== undefined) updateData.sortOrder = Number(sortOrder);

  if (dishName && dishName.trim() !== item.dishName) {
    const mi = await prisma.menuItem.findFirst({
      where: { name: { equals: dishName.trim(), mode: "insensitive" } },
    });
    if (mi) {
      updateData.menuItemId = mi.id;
      updateData.nutritionSnapshot = JSON.stringify({
        calories: mi.calories,
        proteinG: mi.proteinG,
        carbsG: mi.carbsG,
        fatsG: mi.fatsG,
        isVeg: mi.isVeg,
      });
    }
  }

  return await prisma.monthlyMenuPlanItem.update({
    where: { id: itemId },
    data: updateData,
  });
}

/**
 * Validate complete monthly menu plan before publishing
 */
export async function validatePlan(planId) {
  const plan = await prisma.monthlyMenuPlan.findUnique({
    where: { id: planId },
    include: { items: true },
  });
  if (!plan) throw new Error("Plan not found");

  const calendarDates = getDatesInMonth(plan.targetYear, plan.targetMonth);
  const errors = [];
  const warnings = [];

  const itemsByDateMess = {};
  for (const item of plan.items) {
    const dStr = item.date.toISOString().slice(0, 10);
    const key = `${dStr}_${item.messType}`;
    if (!itemsByDateMess[key]) itemsByDateMess[key] = new Set();
    itemsByDateMess[key].add(item.mealSlot);
  }

  // Check all required dates and meal slots
  for (const d of calendarDates) {
    const dStr = d.toISOString().slice(0, 10);
    for (const mess of plan.messTypes) {
      const key = `${dStr}_${mess}`;
      const slotsPresent = itemsByDateMess[key] || new Set();
      for (const slot of MEAL_SLOTS) {
        if (!slotsPresent.has(slot)) {
          errors.push(`Missing meal slot '${slot}' on ${dStr} for mess type '${mess}'`);
        }
      }
    }
  }

  // Check repetition: dishes appearing on 2 consecutive days in same slot
  const slotDateDishMap = {};
  for (const item of plan.items) {
    const dStr = item.date.toISOString().slice(0, 10);
    const key = `${item.messType}_${item.mealSlot}`;
    if (!slotDateDishMap[key]) slotDateDishMap[key] = [];
    slotDateDishMap[key].push({ date: dStr, dish: item.dishName });
  }

  for (const [key, list] of Object.entries(slotDateDishMap)) {
    list.sort((a, b) => a.date.localeCompare(b.date));
    for (let i = 1; i < list.length; i++) {
      if (list[i].dish.toLowerCase() === list[i - 1].dish.toLowerCase()) {
        const d1 = new Date(list[i - 1].date);
        const d2 = new Date(list[i].date);
        const diffDays = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
        if (diffDays <= 1) {
          warnings.push(
            `Dish "${list[i].dish}" appears on consecutive days (${list[i - 1].date} and ${list[i].date}) in ${key}`
          );
        }
      }
    }
  }

  const isValid = errors.length === 0;

  return {
    isValid,
    totalDatesInMonth: calendarDates.length,
    totalItems: plan.items.length,
    errors,
    warnings,
    summary: isValid
      ? `All ${calendarDates.length} days of ${new Date(plan.targetYear, plan.targetMonth - 1).toLocaleString("en-US", { month: "long" })} have complete meal coverage.`
      : `${errors.length} validation issues must be resolved before publishing.`,
  };
}

/**
 * Explicitly publish approved plan into official daily menu system
 */
export async function publishMonthlyPlan(planId, adminUserId) {
  const plan = await prisma.monthlyMenuPlan.findUnique({
    where: { id: planId },
    include: {
      items: {
        include: { menuItem: true },
      },
    },
  });
  if (!plan) throw new Error("Plan not found");

  const validation = await validatePlan(planId);
  if (!validation.isValid) {
    throw new Error(
      `Cannot publish plan with validation errors:\n${validation.errors.slice(0, 5).join("\n")}`
    );
  }

  // Populate MenuDateEntry in Prisma transaction
  // This seamlessly feeds the existing getMenuForDate daily menu service!
  const datesCovered = [...new Set(plan.items.map((i) => i.date.toISOString().slice(0, 10)))];

  await prisma.$transaction(async (tx) => {
    // 1. Clear existing MenuDateEntry for these dates and messTypes
    for (const dStr of datesCovered) {
      const d = new Date(dStr + "T00:00:00.000Z");
      await tx.menuDateEntry.deleteMany({
        where: {
          menuDate: d,
          messType: { in: plan.messTypes },
        },
      });
    }

    // 2. Prepare MenuDateEntry rows
    const dateEntriesToCreate = [];
    for (const item of plan.items) {
      let menuItemId = item.menuItemId;

      // If item lacks menuItemId, find or create
      if (!menuItemId) {
        let mi = await tx.menuItem.findFirst({
          where: { name: { equals: item.dishName, mode: "insensitive" } },
        });
        if (!mi) {
          mi = await tx.menuItem.create({
            data: {
              name: item.dishName,
              calories: 250,
              isVeg: item.messType === "VEG",
              tags: "[]",
            },
          });
        }
        menuItemId = mi.id;
      }

      const itemDate = new Date(item.date);
      itemDate.setHours(0, 0, 0, 0);

      dateEntriesToCreate.push({
        menuDate: itemDate,
        messType: item.messType,
        mealSlot: item.mealSlot,
        menuItemId,
        sortOrder: item.sortOrder,
      });
    }

    if (dateEntriesToCreate.length > 0) {
      await tx.menuDateEntry.createMany({
        data: dateEntriesToCreate,
      });
    }

    // 3. Mark plan as PUBLISHED
    await tx.monthlyMenuPlan.update({
      where: { id: planId },
      data: {
        status: "PUBLISHED",
        publishedAt: new Date(),
        publishedById: adminUserId,
      },
    });

    // 4. Audit publication
    await tx.menuPollAudit.create({
      data: {
        pollId: plan.pollId,
        actorId: adminUserId,
        actorRole: "ADMIN",
        action: "MONTHLY_MENU_PUBLISHED",
        details: JSON.stringify({
          planId,
          targetMonth: plan.targetMonth,
          targetYear: plan.targetYear,
          publishedItemsCount: dateEntriesToCreate.length,
          datesCoveredCount: datesCovered.length,
        }),
      },
    });
  });

  // Notify students and staff
  const monthName = new Date(plan.targetYear, plan.targetMonth - 1).toLocaleString("en-US", {
    month: "long",
  });

  await notifyStudents({
    type: "MENU_PUBLISHED",
    title: `Official Menu Published for ${monthName} ${plan.targetYear}`,
    message: `The student-voted monthly menu for ${monthName} is now live on your daily menu schedule!`,
    metadata: { planId, targetMonth: plan.targetMonth, targetYear: plan.targetYear },
  }).catch(() => {});

  await notifyAdmins({
    type: "ANNOUNCEMENT",
    title: `Monthly Menu Published`,
    message: `Plan "${plan.name}" successfully published across ${datesCovered.length} dates.`,
    metadata: { planId },
  }).catch(() => {});

  return {
    success: true,
    message: `Monthly menu published successfully. ${datesCovered.length} dates populated in daily menu.`,
    planId,
    datesCount: datesCovered.length,
  };
}
