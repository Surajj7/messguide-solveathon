import * as xlsx from "xlsx";
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

const VALID_MESS_TYPES = new Set(["VEG", "NON_VEG", "SPECIAL", "FOODPARK"]);

function normHeader(h) {
  return String(h || "")
    .trim()
    .toLowerCase()
    .replace(/[\s\-_]+/g, "_");
}

function parseDayOfWeek(val) {
  if (val === undefined || val === null || val === "") return null;
  const s = String(val).trim().toLowerCase();
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
  return map[s] ?? null;
}

function splitDishes(cellValue) {
  if (!cellValue) return [];
  return String(cellValue)
    .split(/[\n,;•/|]+/)
    .map((s) => s.replace(/^[-*•\s]+/, "").trim())
    .filter((s) => s.length > 0 && !/^none$/i.test(s));
}

function estimateNutrition(itemName, isNonVegContext = false) {
  const name = itemName.toLowerCase();
  const isNonVeg =
    /chicken|mutton|fish|egg|omelette|prawn|pork|beef|crab|meat/i.test(name) ||
    isNonVegContext;

  let calories = 260;
  let proteinG = 8;
  let carbsG = 36;
  let fatsG = 8;
  const tags = [isNonVeg ? "non-veg" : "veg"];

  if (/chicken|mutton|fish|prawn|crab/i.test(name)) {
    calories = 380;
    proteinG = 26;
    carbsG = 8;
    fatsG = 20;
    tags.push("high protein");
  } else if (/paneer|tofu|soya/i.test(name)) {
    calories = 360;
    proteinG = 18;
    carbsG = 16;
    fatsG = 22;
    tags.push("high protein");
  } else if (/egg|omelette/i.test(name)) {
    calories = 160;
    proteinG = 13;
    carbsG = 2;
    fatsG = 11;
    tags.push("high protein");
  } else if (/dal|sambar|rajma|chole|chana/i.test(name)) {
    calories = 210;
    proteinG = 11;
    carbsG = 28;
    fatsG = 6;
    tags.push("high protein");
  } else if (/dosa|idli|vada|upma|poha/i.test(name)) {
    calories = 280;
    proteinG = 7;
    carbsG = 45;
    fatsG = 8;
  } else if (/rice|biryani|pulao/i.test(name)) {
    calories = 290;
    proteinG = 5;
    carbsG = 52;
    fatsG = 6;
  } else if (/roti|chapati|naan|paratha/i.test(name)) {
    calories = 140;
    proteinG = 4;
    carbsG = 24;
    fatsG = 3;
  } else if (/fruit|salad|sprouts/i.test(name)) {
    calories = 95;
    proteinG = 2;
    carbsG = 20;
    fatsG = 0.5;
    tags.push("healthy");
  } else if (/samosa|pakoda|bajji|snack/i.test(name)) {
    calories = 260;
    proteinG = 4;
    carbsG = 28;
    fatsG = 14;
    tags.push("fried");
  }

  return {
    calories,
    proteinG,
    carbsG,
    fatsG,
    isVeg: !isNonVeg,
    tags,
  };
}

async function upsertMenuItem(tx, itemData) {
  const tagsJson = JSON.stringify(itemData.tags || []);
  const existing = await tx.menuItem.findUnique({
    where: { name: itemData.itemName },
  });
  if (existing) {
    return tx.menuItem.update({
      where: { id: existing.id },
      data: {
        calories: itemData.calories || existing.calories,
        proteinG: itemData.proteinG || existing.proteinG,
        carbsG: itemData.carbsG || existing.carbsG,
        fatsG: itemData.fatsG || existing.fatsG,
        tags: tagsJson,
        isVeg: itemData.isVeg ?? existing.isVeg,
      },
    });
  }
  return tx.menuItem.create({
    data: {
      name: itemData.itemName,
      calories: itemData.calories || 250,
      proteinG: itemData.proteinG || 8,
      carbsG: itemData.carbsG || 35,
      fatsG: itemData.fatsG || 7,
      tags: tagsJson,
      isVeg: itemData.isVeg ?? true,
    },
  });
}

/**
 * Universal Menu Importer:
 * Accepts both Excel (.xlsx, .xls) and CSV (.csv) buffers.
 * Supports:
 *  1) 4-Meals Matrix Format:
 *     Rows = Days of week (Monday..Sunday) or Calendar dates
 *     Columns = Breakfast, Lunch, Snacks, Dinner
 *     (plus optional Mess Type column or fallback defaultMessType)
 *  2) Legacy Item-by-item Format:
 *     item_name, calories, protein_g, carbs_g, fats_g, tags, is_veg, mess_type, meal_slot, day_of_week / menu_date
 */
export async function importMenuCsv(buffer, options = {}) {
  let records = [];

  // Try parsing as Excel first
  try {
    const workbook = xlsx.read(buffer, { type: "buffer" });
    if (workbook.SheetNames && workbook.SheetNames.length > 0) {
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      records = xlsx.utils.sheet_to_json(firstSheet, { defval: "" });
    }
  } catch {
    // If not Excel, parse as CSV
    try {
      const text = buffer.toString("utf-8");
      records = parse(text, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
    } catch (e) {
      return {
        success: false,
        errors: [{ row: 0, message: "Failed to parse file: " + e.message }],
        imported: 0,
      };
    }
  }

  if (!records || records.length === 0) {
    return {
      success: false,
      errors: [{ row: 0, message: "File is empty or contains no records" }],
      imported: 0,
    };
  }

  // Detect format: Check if columns contain "breakfast", "lunch", "snacks", "dinner"
  const firstRowHeaders = Object.keys(records[0]).map(normHeader);
  const isMatrixFormat =
    firstRowHeaders.some((h) => h.includes("breakfast") || h === "bf") &&
    (firstRowHeaders.some((h) => h.includes("lunch")) ||
      firstRowHeaders.some((h) => h.includes("dinner")));

  const errors = [];
  const itemsToCreate = [];

  const defaultMessType = options.defaultMessType
    ? String(options.defaultMessType).toUpperCase()
    : "ALL";

  if (isMatrixFormat) {
    // ==========================================
    // 1) 4-Meals Matrix Format (Requested by user)
    // ==========================================
    for (let i = 0; i < records.length; i++) {
      const raw = records[i];
      const row = {};
      for (const [k, v] of Object.entries(raw)) {
        row[normHeader(k)] = v;
      }

      // Identify day or date
      const dayVal =
        row.day ||
        row.day_of_week ||
        row.days ||
        row.date ||
        row.menu_date ||
        "";
      if (!dayVal) {
        continue; // skip empty rows
      }

      let dayOfWeek = null;
      let menuDate = null;

      // Check if it's a date YYYY-MM-DD
      if (/^\d{4}-\d{2}-\d{2}/.test(String(dayVal))) {
        menuDate = new Date(dayVal);
        if (Number.isNaN(menuDate.getTime())) {
          errors.push({ row: i + 2, message: `Invalid date: ${dayVal}` });
          continue;
        }
      } else {
        const dow = parseDayOfWeek(dayVal);
        if (dow === null) {
          errors.push({ row: i + 2, message: `Invalid day of week: ${dayVal}` });
          continue;
        }
        dayOfWeek = dow;
      }

      // Mess type: from column, or options, or all 4
      let targetMessTypes = [];
      const rowMessType = String(
        row.mess_type || row.mess || row.type || ""
      ).toUpperCase();
      if (VALID_MESS_TYPES.has(rowMessType)) {
        targetMessTypes = [rowMessType];
      } else if (defaultMessType !== "ALL" && VALID_MESS_TYPES.has(defaultMessType)) {
        targetMessTypes = [defaultMessType];
      } else {
        targetMessTypes = ["VEG", "NON_VEG", "SPECIAL", "FOODPARK"];
      }

      // The 4 meals
      const mealSlots = [
        {
          slot: "BREAKFAST",
          content:
            row.breakfast || row.morning || row.bf || row.breakfast_menu || "",
        },
        {
          slot: "LUNCH",
          content: row.lunch || row.afternoon || row.lunch_menu || "",
        },
        {
          slot: "SNACKS",
          content:
            row.snacks ||
            row.evening_snacks ||
            row.tea_snacks ||
            row.tiffin ||
            "",
        },
        {
          slot: "DINNER",
          content: row.dinner || row.night || row.dinner_menu || "",
        },
      ];

      for (const { slot, content } of mealSlots) {
        if (!content) continue;
        const dishes = splitDishes(content);
        let order = 0;

        for (const dish of dishes) {
          for (const mt of targetMessTypes) {
            const isNonVegMess = mt === "NON_VEG";
            const nutrition = estimateNutrition(dish, isNonVegMess);

            itemsToCreate.push({
              itemName: dish,
              messType: mt,
              mealSlot: slot,
              dayOfWeek,
              menuDate,
              sortOrder: order++,
              ...nutrition,
            });
          }
        }
      }
    }
  } else {
    // ==========================================
    // 2) Legacy Item-by-Item Format
    // ==========================================
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
      if (!VALID_MESS_TYPES.has(messType)) {
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
      if (row.menu_date || row.date) {
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
          message: "Provide menu_date OR day_of_week",
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

      itemsToCreate.push({
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
      });
    }
  }

  if (itemsToCreate.length === 0 && errors.length > 0) {
    return { success: false, errors, imported: 0 };
  }

  // Insert items in batch transaction
  let imported = 0;
  await prisma.$transaction(
    async (tx) => {
      for (const r of itemsToCreate) {
        const item = await upsertMenuItem(tx, r);

        if (r.menuDate) {
          const d = new Date(r.menuDate);
          d.setHours(0, 0, 0, 0);
          await tx.menuDateEntry.create({
            data: {
              menuDate: d,
              messType: r.messType,
              mealSlot: r.mealSlot,
              menuItemId: item.id,
              sortOrder: r.sortOrder || 0,
            },
          });
        } else if (r.dayOfWeek !== null && r.dayOfWeek !== undefined) {
          await tx.menuTemplateEntry.create({
            data: {
              dayOfWeek: r.dayOfWeek,
              messType: r.messType,
              mealSlot: r.mealSlot,
              menuItemId: item.id,
              sortOrder: r.sortOrder || 0,
            },
          });
        }
        imported++;
      }
    },
    { maxWait: 15000, timeout: 300000 }
  );

  return {
    success: true,
    format: isMatrixFormat ? "4_meals_matrix" : "legacy_items",
    imported,
    errors,
  };
}
