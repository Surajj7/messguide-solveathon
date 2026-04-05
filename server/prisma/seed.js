import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin1@vitadmin.ac.in" },
    update: {},
    create: {
      email: "admin1@vitadmin.ac.in",
      passwordHash,
      name: "Admin One",
      role: "ADMIN",
    },
  });

  const mess = await prisma.user.upsert({
    where: { email: "mess1@messadmin.ac.in" },
    update: {},
    create: {
      email: "mess1@messadmin.ac.in",
      passwordHash,
      name: "Mess Incharge",
      role: "MESS_INCHARGE",
    },
  });

  const students = [
    {
      email: "student1@vitstudent.ac.in",
      name: "Student One",
      messType: "VEG",
      block: "A",
      caterer: "ZENITH",
      reg: "22BCE1001",
      parentPhone: "+91-9000010001",
      parentEmail: "parent.student1@mockmail.test",
      wardenEmail: "warden.a@vitadmin.mock",
    },
    {
      email: "student2@vitstudent.ac.in",
      name: "Student Two",
      messType: "NON_VEG",
      block: "B",
      caterer: "SRRC",
      reg: "22BCE1002",
      parentPhone: "+91-9000010002",
      parentEmail: "parent.student2@mockmail.test",
      wardenEmail: "warden.b@vitadmin.mock",
    },
    {
      email: "student3@vitstudent.ac.in",
      name: "Student Three",
      messType: "SPECIAL",
      block: "C",
      caterer: "ZENITH",
      reg: "22BCE1003",
      parentPhone: "+91-9000010003",
      parentEmail: "parent.student3@mockmail.test",
      wardenEmail: "warden.c@vitadmin.mock",
    },
    { email: "student4@vitstudent.ac.in", name: "Student Four", messType: "VEG", block: "A", caterer: "ZENITH", reg: "22BCE1004" },
    { email: "student5@vitstudent.ac.in", name: "Student Five", messType: "VEG", block: "B", caterer: "SRRC", reg: "22BCE1005" },
    { email: "student6@vitstudent.ac.in", name: "Student Six", messType: "NON_VEG", block: "C", caterer: "RASSENCE", reg: "22BCE1006" },
    { email: "student7@vitstudent.ac.in", name: "Student Seven", messType: "NON_VEG", block: "D1", caterer: "ZENITH", reg: "22BCE1007" },
    { email: "student8@vitstudent.ac.in", name: "Student Eight", messType: "SPECIAL", block: "D2", caterer: "FUSION", reg: "22BCE1008" },
    { email: "student9@vitstudent.ac.in", name: "Student Nine", messType: "VEG", block: "E", caterer: "PROODLE", reg: "22BCE1009" },
    { email: "student10@vitstudent.ac.in", name: "Student Ten", messType: "VEG", block: "A", caterer: "RASSENCE", reg: "22BCE1010" },
    { email: "student11@vitstudent.ac.in", name: "Student Eleven", messType: "NON_VEG", block: "B", caterer: "SRRC", reg: "22BCE1011" },
    { email: "student12@vitstudent.ac.in", name: "Student Twelve", messType: "SPECIAL", block: "C", caterer: "RASSENCE", reg: "22BCE1012" },
  ];

  for (const s of students) {
    const u = await prisma.user.upsert({
      where: { email: s.email },
      update: {
        name: s.name,
      },
      create: {
        email: s.email,
        passwordHash,
        name: s.name,
        role: "STUDENT",
        studentProfile: {
          create: {
            messType: s.messType,
            hostelBlock: s.block,
            caterer: s.caterer,
            registrationNo: s.reg,
            parentPhone: s.parentPhone || null,
            parentEmail: s.parentEmail || null,
            wardenEmail: s.wardenEmail || null,
            healthGoal: "BALANCED",
            profileComplete: true,
          },
        },
      },
      include: { studentProfile: true },
    });
    if (!u.studentProfile) {
      await prisma.studentProfile.create({
        data: {
          userId: u.id,
          messType: s.messType,
          hostelBlock: s.block,
          caterer: s.caterer,
          registrationNo: s.reg,
          parentPhone: s.parentPhone || null,
          parentEmail: s.parentEmail || null,
          wardenEmail: s.wardenEmail || null,
          profileComplete: true,
        },
      });
    } else {
      await prisma.studentProfile.update({
        where: { userId: u.id },
        data: {
          registrationNo: s.reg,
          messType: s.messType,
          hostelBlock: s.block,
          caterer: s.caterer,
          parentPhone: s.parentPhone || null,
          parentEmail: s.parentEmail || null,
          wardenEmail: s.wardenEmail || null,
        },
      });
    }
  }

  const swapOpts = [
    { messType: "VEG", fromCaterer: "ZENITH", toCaterer: "SRRC", totalSlots: 10 },
    { messType: "VEG", fromCaterer: "ZENITH", toCaterer: "GRACE", totalSlots: 8 },
    { messType: "VEG", fromCaterer: "ZENITH", toCaterer: "RASSENCE", totalSlots: 6 },
    { messType: "VEG", fromCaterer: "ZENITH", toCaterer: "PROODLE", totalSlots: 6 },
    { messType: "VEG", fromCaterer: "SRRC", toCaterer: "PROODLE", totalSlots: 6 },
    { messType: "VEG", fromCaterer: "SRRC", toCaterer: "ZENITH", totalSlots: 8 },
    { messType: "VEG", fromCaterer: "SRRC", toCaterer: "GRACE", totalSlots: 7 },
    { messType: "VEG", fromCaterer: "PROODLE", toCaterer: "ZENITH", totalSlots: 8 },
    { messType: "VEG", fromCaterer: "PROODLE", toCaterer: "SRRC", totalSlots: 8 },
    { messType: "VEG", fromCaterer: "RASSENCE", toCaterer: "ZENITH", totalSlots: 10 },
    { messType: "VEG", fromCaterer: "RASSENCE", toCaterer: "SRRC", totalSlots: 8 },
    { messType: "VEG", fromCaterer: "GRACE", toCaterer: "ZENITH", totalSlots: 6 },
    { messType: "VEG", fromCaterer: "GRACE", toCaterer: "SRRC", totalSlots: 6 },
    { messType: "NON_VEG", fromCaterer: "SRRC", toCaterer: "GRACE", totalSlots: 10 },
    { messType: "NON_VEG", fromCaterer: "SRRC", toCaterer: "ZENITH", totalSlots: 8 },
    { messType: "NON_VEG", fromCaterer: "SRRC", toCaterer: "RASSENCE", totalSlots: 6 },
    { messType: "NON_VEG", fromCaterer: "RASSENCE", toCaterer: "GRACE", totalSlots: 10 },
    { messType: "NON_VEG", fromCaterer: "RASSENCE", toCaterer: "ZENITH", totalSlots: 8 },
    { messType: "NON_VEG", fromCaterer: "RASSENCE", toCaterer: "SRRC", totalSlots: 6 },
    { messType: "NON_VEG", fromCaterer: "ZENITH", toCaterer: "SRRC", totalSlots: 8 },
    { messType: "NON_VEG", fromCaterer: "ZENITH", toCaterer: "GRACE", totalSlots: 8 },
    { messType: "NON_VEG", fromCaterer: "GRACE", toCaterer: "ZENITH", totalSlots: 8 },
    { messType: "NON_VEG", fromCaterer: "GRACE", toCaterer: "SRRC", totalSlots: 8 },
    { messType: "SPECIAL", fromCaterer: "ZENITH", toCaterer: "FUSION", totalSlots: 10 },
    { messType: "SPECIAL", fromCaterer: "ZENITH", toCaterer: "GRACE", totalSlots: 5 },
    { messType: "SPECIAL", fromCaterer: "GRACE", toCaterer: "FUSION", totalSlots: 5 },
    { messType: "SPECIAL", fromCaterer: "GRACE", toCaterer: "ZENITH", totalSlots: 4 },
    { messType: "SPECIAL", fromCaterer: "RASSENCE", toCaterer: "FUSION", totalSlots: 6 },
    { messType: "SPECIAL", fromCaterer: "RASSENCE", toCaterer: "ZENITH", totalSlots: 5 },
    { messType: "SPECIAL", fromCaterer: "FUSION", toCaterer: "ZENITH", totalSlots: 8 },
    { messType: "SPECIAL", fromCaterer: "FUSION", toCaterer: "GRACE", totalSlots: 6 },
  ];
  for (const sw of swapOpts) {
    const existing = await prisma.catererSwapOption.findFirst({
      where: {
        messType: sw.messType,
        fromCaterer: sw.fromCaterer,
        toCaterer: sw.toCaterer,
      },
    });
    if (existing) {
      await prisma.catererSwapOption.update({
        where: { id: existing.id },
        data: { totalSlots: sw.totalSlots, isActive: true },
      });
    } else {
      await prisma.catererSwapOption.create({ data: sw });
    }
  }

  const food = [
    {
      name: "Idli Sambar",
      cal: 280,
      p: 9,
      c: 48,
      f: 4,
      tags: ["veg", "high protein"],
      veg: true,
    },
    {
      name: "Masala Dosa",
      cal: 320,
      p: 8,
      c: 42,
      f: 12,
      tags: ["veg", "spicy"],
      veg: true,
    },
    {
      name: "Boiled Eggs (2)",
      cal: 140,
      p: 12,
      c: 1,
      f: 10,
      tags: ["non-veg", "high protein"],
      veg: false,
    },
    {
      name: "Chicken Curry",
      cal: 380,
      p: 28,
      c: 8,
      f: 22,
      tags: ["non-veg", "spicy"],
      veg: false,
    },
    {
      name: "Paneer Butter Masala",
      cal: 420,
      p: 18,
      c: 22,
      f: 28,
      tags: ["veg", "high protein"],
      veg: true,
    },
    {
      name: "Dal Tadka",
      cal: 180,
      p: 10,
      c: 22,
      f: 6,
      tags: ["veg"],
      veg: true,
    },
    {
      name: "Steamed Rice",
      cal: 200,
      p: 4,
      c: 44,
      f: 2,
      tags: ["veg"],
      veg: true,
    },
    {
      name: "Mixed Veg Curry",
      cal: 150,
      p: 4,
      c: 18,
      f: 6,
      tags: ["veg"],
      veg: true,
    },
    {
      name: "Fruit Bowl",
      cal: 90,
      p: 1,
      c: 22,
      f: 0,
      tags: ["veg"],
      veg: true,
    },
    {
      name: "Samosa",
      cal: 260,
      p: 5,
      c: 28,
      f: 14,
      tags: ["veg", "fried"],
      veg: true,
    },
  ];

  const items = {};
  for (const f of food) {
    const mi = await prisma.menuItem.upsert({
      where: { name: f.name },
      update: {
        calories: f.cal,
        proteinG: f.p,
        carbsG: f.c,
        fatsG: f.f,
        tags: JSON.stringify(f.tags),
        isVeg: f.veg,
      },
      create: {
        name: f.name,
        calories: f.cal,
        proteinG: f.p,
        carbsG: f.c,
        fatsG: f.f,
        tags: JSON.stringify(f.tags),
        isVeg: f.veg,
      },
    });
    items[f.name] = mi.id;
  }

  const mealSlots = ["BREAKFAST", "LUNCH", "SNACKS", "DINNER"];
  const messTypes = ["VEG", "NON_VEG", "SPECIAL"];

  await prisma.menuTemplateEntry.deleteMany({});
  await prisma.menuDateEntry.deleteMany({});

  for (let dow = 0; dow < 7; dow++) {
    let order = 0;
    for (const mt of messTypes) {
      const breakfast =
        mt === "NON_VEG"
          ? ["Boiled Eggs (2)", "Idli Sambar"]
          : ["Idli Sambar", "Masala Dosa"];
      const lunch =
        mt === "NON_VEG"
          ? ["Chicken Curry", "Dal Tadka", "Steamed Rice"]
          : ["Paneer Butter Masala", "Dal Tadka", "Steamed Rice"];
      const snacks = ["Samosa", "Fruit Bowl"];
      const dinner =
        mt === "SPECIAL"
          ? ["Paneer Butter Masala", "Mixed Veg Curry", "Steamed Rice"]
          : ["Mixed Veg Curry", "Dal Tadka", "Steamed Rice"];

      const map = {
        BREAKFAST: breakfast,
        LUNCH: lunch,
        SNACKS: snacks,
        DINNER: dinner,
      };

      for (const slot of mealSlots) {
        for (const name of map[slot]) {
          await prisma.menuTemplateEntry.create({
            data: {
              dayOfWeek: dow,
              messType: mt,
              mealSlot: slot,
              menuItemId: items[name],
              sortOrder: order++,
            },
          });
        }
      }

    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  await prisma.nightMessItem.upsert({
    where: {
      serviceDate_name: { serviceDate: today, name: "Maggi Hot Cup" },
    },
    update: {},
    create: {
      serviceDate: today,
      name: "Maggi Hot Cup",
      price: 40,
      availableQty: 80,
      remainingQty: 55,
    },
  });
  await prisma.nightMessItem.upsert({
    where: {
      serviceDate_name: { serviceDate: today, name: "Veg Sandwich" },
    },
    update: {},
    create: {
      serviceDate: today,
      name: "Veg Sandwich",
      price: 50,
      availableQty: 40,
      remainingQty: 8,
    },
  });

  const tplCount = await prisma.whatsAppTemplate.count();
  if (tplCount === 0) {
    await prisma.whatsAppTemplate.create({
      data: {
        name: "Menu change alert",
        body: "Hello {name}, today's mess menu was updated. Open the Smart Mess app.",
      },
    });
  }

  console.log(
    "Seed OK. Users: admin1@vitadmin.ac.in, mess1@messadmin.ac.in, student1-12@vitstudent.ac.in / password123. Caterer swap options seeded."
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
