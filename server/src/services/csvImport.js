import { parse } from "csv-parse/sync";
import { prisma } from "../lib/prisma.js";

const MEALS = new Set([
  "BREAKFAST",
  "LUNCH",
  "SNACKS",
  "DINNER",
  "FEAST",
  "NIGHT_MESS",
]);
const MESS = new Set(["VEG", "NON_VEG", "SPECIAL"]);

function normHeader(h) {
  return String(h || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function parseDayOfWeek(val) {
  const s = String(val).trim();
  const n = parseInt(s, 10);
  if (!Number.isNaN(n) && n >= 0 && n <= 6) return n;
  const map = {
    sun: 0,
    sunday: 0,
    mon: 1,
    monday: 1,
    tue: 2,
    tues: 2,
    tuesday: 2,
    wed: 3,
    wednesday: 3,
    thu: 4,
    thur: 4,
    thurs: 4,
    thursday: 4,
    fri: 5,
    friday: 5,
    sat: 6,
    saturday: 6,
  };
  return map[s.toLowerCase()] ?? null;
}

async function upsertMenuItem(tx, r) {
  const tagsJson = JSON.stringify(r.tags);
  const existing = await tx.menuItem.findUnique({ where: { name: r.itemName } });
  if (existing) {
    return tx.menuItem.update({
      where: { id: existing.id },
      data: {
        calories: r.calories,
        proteinG: r.proteinG,
        carbsG: r.carbsG,
        fatsG: r.fatsG,
        tags: tagsJson,
        isVeg: r.isVeg,
      },
    });
  }
  return tx.menuItem.create({
    data: {
      name: r.itemName,
      calories: r.calories,
      proteinG: r.proteinG,
      carbsG: r.carbsG,
      fatsG: r.fatsG,
      tags: tagsJson,
      isVeg: r.isVeg,
    },
  });
}

/**
 * CSV columns:
 * item_name, calories, protein_g, carbs_g, fats_g, tags, is_veg
 * mess_type, meal_slot, sort_order
 * menu_date (YYYY-MM-DD) OR day_of_week (0-6 / name)
 * For NIGHT_MESS: service_date, price, available_qty, remaining_qty (optional)
 */
export async function importMenuCsv(buffer) {
  const text = buffer.toString("utf-8");
  let records;
  try {
    records = parse(text, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
  } catch (e) {
    return {
      success: false,
      errors: [{ row: 0, message: e.message }],
      imported: 0,
    };
  }

  const errors = [];
  const rows = [];

  for (let i = 0; i < records.length; i++) {
    const raw = records[i];
    const row = {};
    for (const [k, v] of Object.entries(raw)) {
      row[normHeader(k)] = v;
    }

    const itemName = row.item_name || row.name || row.food_item;
    if (!itemName) {
      errors.push({ row: i + 2, message: "Missing item_name" });
      continue;
    }

    const messType = String(row.mess_type || row.mess || "").toUpperCase();
    if (!MESS.has(messType)) {
      errors.push({ row: i + 2, message: `Invalid mess_type: ${messType}` });
      continue;
    }

    const mealSlot = String(row.meal_slot || row.meal || "").toUpperCase();
    if (!MEALS.has(mealSlot)) {
      errors.push({ row: i + 2, message: `Invalid meal_slot: ${mealSlot}` });
      continue;
    }

    let menuDate = null;
    let dayOfWeek = null;
    if (mealSlot === "NIGHT_MESS") {
      const sd = row.service_date || row.menu_date || row.date;
      if (!sd) {
        errors.push({
          row: i + 2,
          message: "NIGHT_MESS requires service_date",
        });
        continue;
      }
      menuDate = new Date(sd);
      if (Number.isNaN(menuDate.getTime())) {
        errors.push({ row: i + 2, message: "Invalid service_date" });
        continue;
      }
    } else if (row.menu_date || row.date) {
      const ds = row.menu_date || row.date;
      menuDate = new Date(ds);
      if (Number.isNaN(menuDate.getTime())) {
        errors.push({ row: i + 2, message: "Invalid menu_date" });
        continue;
      }
    } else if (row.day_of_week !== undefined && row.day_of_week !== "") {
      const dow = parseDayOfWeek(row.day_of_week);
      if (dow === null) {
        errors.push({ row: i + 2, message: "Invalid day_of_week" });
        continue;
      }
      dayOfWeek = dow;
    } else {
      errors.push({
        row: i + 2,
        message: "Provide menu_date OR day_of_week (or service_date for NIGHT_MESS)",
      });
      continue;
    }

    const calories = parseFloat(row.calories) || 0;
    const proteinG = parseFloat(row.protein_g ?? row.protein) || 0;
    const carbsG = parseFloat(row.carbs_g ?? row.carbs) || 0;
    const fatsG = parseFloat(row.fats_g ?? row.fats) || 0;
    const sortOrder = parseInt(row.sort_order, 10) || 0;

    let tags = [];
    if (row.tags) {
      try {
        tags = JSON.parse(row.tags);
      } catch {
        tags = String(row.tags)
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
      }
    }
    const isVeg =
      String(row.is_veg ?? row.veg ?? "true").toLowerCase() === "true" ||
      String(row.is_veg ?? "").toLowerCase() === "yes";

    rows.push({
      itemName: String(itemName).trim(),
      calories,
      proteinG,
      carbsG,
      fatsG,
      tags,
      isVeg,
      messType,
      mealSlot,
      menuDate,
      dayOfWeek,
      sortOrder,
      price: parseFloat(row.price) || 0,
      availableQty: parseInt(row.available_qty ?? row.available, 10) || 0,
      remainingQty:
        row.remaining_qty !== undefined && row.remaining_qty !== ""
          ? parseInt(row.remaining_qty, 10)
          : parseInt(row.available_qty ?? row.available, 10) || 0,
    });
  }

  if (errors.length && rows.length === 0) {
    return { success: false, errors, imported: 0 };
  }

  let imported = 0;
  // Default interactive transaction timeout is 5s; merged / large CSVs need more.
  await prisma.$transaction(
    async (tx) => {
      for (const r of rows) {
        const item = await upsertMenuItem(tx, r);

        if (r.mealSlot === "NIGHT_MESS") {
          const d = new Date(r.menuDate);
          d.setHours(0, 0, 0, 0);
          await tx.nightMessItem.upsert({
            where: {
              serviceDate_name: { serviceDate: d, name: r.itemName },
            },
            create: {
              serviceDate: d,
              name: r.itemName,
              price: r.price,
              availableQty: r.availableQty,
              remainingQty: r.remainingQty,
            },
            update: {
              price: r.price,
              availableQty: r.availableQty,
              remainingQty: r.remainingQty,
            },
          });
          imported++;
          continue;
        }

        if (r.menuDate) {
          const d = new Date(r.menuDate);
          d.setHours(0, 0, 0, 0);
          await tx.menuDateEntry.create({
            data: {
              menuDate: d,
              messType: r.messType,
              mealSlot: r.mealSlot,
              menuItemId: item.id,
              sortOrder: r.sortOrder,
            },
          });
        } else {
          await tx.menuTemplateEntry.create({
            data: {
              dayOfWeek: r.dayOfWeek,
              messType: r.messType,
              mealSlot: r.mealSlot,
              menuItemId: item.id,
              sortOrder: r.sortOrder,
            },
          });
        }
        imported++;
      }
    },
    { maxWait: 15000, timeout: 300000 }
  );

  return { success: errors.length === 0, errors, imported };
}
