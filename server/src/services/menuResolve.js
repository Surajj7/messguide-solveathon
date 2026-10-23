import { prisma } from "../lib/prisma.js";

function startOfDay(d) {
  if (typeof d === "string") {
    const s = d.slice(0, 10);
    return new Date(s + "T00:00:00.000Z");
  }
  const x = new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return new Date(`${y}-${m}-${day}T00:00:00.000Z`);
}

/**
 * Resolve menu for a calendar date + mess type: date overrides first, else weekly template.
 */
export async function getMenuForDate(dateInput, messType) {
  const d = startOfDay(dateInput);
  const localD = new Date(dateInput);
  localD.setHours(0, 0, 0, 0);
  const dayOfWeek = d.getUTCDay();

  const dateEntries = await prisma.menuDateEntry.findMany({
    where: {
      OR: [{ menuDate: d }, { menuDate: localD }],
      messType,
    },
    include: { menuItem: true },
    orderBy: [{ mealSlot: "asc" }, { sortOrder: "asc" }],
  });

  const bySlot = {};
  const mealSlots = ["BREAKFAST", "LUNCH", "SNACKS", "DINNER"];

  if (dateEntries.length > 0) {
    for (const e of dateEntries) {
      if (!bySlot[e.mealSlot]) bySlot[e.mealSlot] = [];
      bySlot[e.mealSlot].push(formatItem(e.menuItem, e.sortOrder));
    }
  } else {
    const tpl = await prisma.menuTemplateEntry.findMany({
      where: { dayOfWeek, messType },
      include: { menuItem: true },
      orderBy: [{ mealSlot: "asc" }, { sortOrder: "asc" }],
    });
    for (const e of tpl) {
      if (!bySlot[e.mealSlot]) bySlot[e.mealSlot] = [];
      bySlot[e.mealSlot].push(formatItem(e.menuItem, e.sortOrder));
    }
  }

  return {
    date: d.toISOString().slice(0, 10),
    messType,
    source: dateEntries.length > 0 ? "date_override" : "weekly_template",
    dayOfWeek,
    meals: mealSlots.map((slot) => ({
      mealSlot: slot,
      items: bySlot[slot] || [],
    })),
  };
}

function formatItem(item, sortOrder) {
  let tags = [];
  try {
    tags = JSON.parse(item.tags || "[]");
  } catch {
    tags = [];
  }
  return {
    id: item.id,
    name: item.name,
    calories: item.calories,
    proteinG: item.proteinG,
    carbsG: item.carbsG,
    fatsG: item.fatsG,
    tags,
    isVeg: item.isVeg,
    sortOrder,
  };
}
