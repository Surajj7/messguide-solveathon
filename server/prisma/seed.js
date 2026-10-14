import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  // 1. Admin
  await prisma.user.upsert({
    where: { email: "admin1@vitadmin.ac.in" },
    update: { name: "Campus Director (Admin)" },
    create: {
      email: "admin1@vitadmin.ac.in",
      passwordHash,
      name: "Campus Director (Admin)",
      role: "ADMIN",
    },
  });

  // 2. Mess Incharge
  await prisma.user.upsert({
    where: { email: "mess1@messadmin.ac.in" },
    update: { name: "Chief Mess Incharge" },
    create: {
      email: "mess1@messadmin.ac.in",
      passwordHash,
      name: "Chief Mess Incharge",
      role: "MESS_INCHARGE",
    },
  });

  // 3. Students (Covering all 4 mess types: VEG, NON_VEG, SPECIAL, FOODPARK and caterers: ZENITH, PROODLE, FUSION, SRRC, CRCL)
  const studentsData = [
    {
      email: "student.veg@vitstudent.ac.in",
      name: "Rahul Sharma",
      messType: "VEG",
      block: "A",
      caterer: "ZENITH",
      reg: "23BCE1001",
      parentPhone: "+91-9876543210",
      parentEmail: "parent1@vitparent.ac.in",
      wardenEmail: "warden.a@vitadmin.ac.in",
    },
    {
      email: "student.nonveg@vitstudent.ac.in",
      name: "Priya Patel",
      messType: "NON_VEG",
      block: "B",
      caterer: "FUSION",
      reg: "23BCE1002",
      parentPhone: "+91-9876543211",
      parentEmail: "parent.priya@vitparent.ac.in",
      wardenEmail: "warden.b@vitadmin.ac.in",
    },
    {
      email: "student.special@vitstudent.ac.in",
      name: "Aditya Verma",
      messType: "SPECIAL",
      block: "C",
      caterer: "PROODLE",
      reg: "23BCE1003",
      parentPhone: "+91-9876543212",
      parentEmail: "parent.aditya@vitparent.ac.in",
      wardenEmail: "warden.c@vitadmin.ac.in",
    },
    {
      email: "student.foodpark@vitstudent.ac.in",
      name: "Sneha Nair",
      messType: "FOODPARK",
      block: "D1",
      caterer: "CRCL",
      reg: "23BCE1004",
      parentPhone: "+91-9876543213",
      parentEmail: "parent.sneha@vitparent.ac.in",
      wardenEmail: "warden.d1@vitadmin.ac.in",
    },
    {
      email: "student1@vitstudent.ac.in",
      name: "Aarav Gupta",
      messType: "VEG",
      block: "A",
      caterer: "SRRC",
      reg: "22BCE1001",
      parentPhone: "+91-9000010001",
      parentEmail: "parent.student1@vitparent.ac.in",
      wardenEmail: "warden.a@vitadmin.ac.in",
    },
    {
      email: "student2@vitstudent.ac.in",
      name: "Karan Mehta",
      messType: "NON_VEG",
      block: "B",
      caterer: "SRRC",
      reg: "22BCE1002",
    },
    {
      email: "student3@vitstudent.ac.in",
      name: "Ananya Roy",
      messType: "SPECIAL",
      block: "C",
      caterer: "ZENITH",
      reg: "22BCE1003",
    },
    {
      email: "student4@vitstudent.ac.in",
      name: "Rohan Das",
      messType: "FOODPARK",
      block: "D2",
      caterer: "CRCL",
      reg: "22BCE1004",
    },
  ];

  const studentUserMap = {};

  for (const s of studentsData) {
    const u = await prisma.user.upsert({
      where: { email: s.email },
      update: { name: s.name },
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
    studentUserMap[s.email] = u.id;
  }

  // 4. Parents (linked to their respective students)
  const parentsData = [
    {
      email: "parent1@vitparent.ac.in",
      name: "Sunil Sharma",
      studentEmail: "student.veg@vitstudent.ac.in",
      studentRegNo: "23BCE1001",
      phone: "+91-9876543210",
    },
    {
      email: "parent.priya@vitparent.ac.in",
      name: "Kavita Patel",
      studentEmail: "student.nonveg@vitstudent.ac.in",
      studentRegNo: "23BCE1002",
      phone: "+91-9876543211",
    },
    {
      email: "parent.aditya@vitparent.ac.in",
      name: "Ramesh Verma",
      studentEmail: "student.special@vitstudent.ac.in",
      studentRegNo: "23BCE1003",
      phone: "+91-9876543212",
    },
    {
      email: "parent.sneha@vitparent.ac.in",
      name: "Deepa Nair",
      studentEmail: "student.foodpark@vitstudent.ac.in",
      studentRegNo: "23BCE1004",
      phone: "+91-9876543213",
    },
  ];

  for (const p of parentsData) {
    const studentId = studentUserMap[p.studentEmail] || null;
    const parentUser = await prisma.user.upsert({
      where: { email: p.email },
      update: { name: p.name },
      create: {
        email: p.email,
        passwordHash,
        name: p.name,
        role: "PARENT",
        parentProfile: {
          create: {
            studentId,
            studentRegNo: p.studentRegNo,
            phone: p.phone,
          },
        },
      },
      include: { parentProfile: true },
    });

    if (!parentUser.parentProfile) {
      await prisma.parentProfile.create({
        data: {
          userId: parentUser.id,
          studentId,
          studentRegNo: p.studentRegNo,
          phone: p.phone,
        },
      });
    } else {
      await prisma.parentProfile.update({
        where: { userId: parentUser.id },
        data: {
          studentId,
          studentRegNo: p.studentRegNo,
          phone: p.phone,
        },
      });
    }
  }

  // 5. Food Catalog
  const foodCatalog = [
    { name: "Idli Sambar", cal: 280, p: 9, c: 48, f: 4, tags: ["veg", "high protein"], veg: true },
    { name: "Masala Dosa", cal: 320, p: 8, c: 42, f: 12, tags: ["veg", "spicy"], veg: true },
    { name: "Poha", cal: 240, p: 6, c: 44, f: 5, tags: ["veg"], veg: true },
    { name: "Boiled Eggs (2)", cal: 140, p: 13, c: 1, f: 10, tags: ["non-veg", "high protein"], veg: false },
    { name: "Chicken Curry", cal: 380, p: 28, c: 8, f: 22, tags: ["non-veg", "spicy", "high protein"], veg: false },
    { name: "Butter Chicken", cal: 440, p: 30, c: 12, f: 28, tags: ["non-veg", "high protein"], veg: false },
    { name: "Egg Curry", cal: 290, p: 18, c: 10, f: 18, tags: ["non-veg", "high protein"], veg: false },
    { name: "Paneer Butter Masala", cal: 420, p: 18, c: 22, f: 28, tags: ["veg", "high protein"], veg: true },
    { name: "Shahi Paneer", cal: 390, p: 17, c: 20, f: 26, tags: ["veg", "high protein"], veg: true },
    { name: "Dal Tadka", cal: 180, p: 10, c: 22, f: 6, tags: ["veg", "high protein"], veg: true },
    { name: "Dal Makhani", cal: 260, p: 12, c: 28, f: 12, tags: ["veg", "high protein"], veg: true },
    { name: "Steamed Rice", cal: 200, p: 4, c: 44, f: 2, tags: ["veg"], veg: true },
    { name: "Jeera Rice", cal: 220, p: 4, c: 46, f: 3, tags: ["veg"], veg: true },
    { name: "Veg Pulao", cal: 240, p: 5, c: 48, f: 4, tags: ["veg"], veg: true },
    { name: "Mixed Veg Curry", cal: 150, p: 4, c: 18, f: 6, tags: ["veg"], veg: true },
    { name: "Phulka (3)", cal: 180, p: 6, c: 36, f: 2, tags: ["veg"], veg: true },
    { name: "Butter Naan", cal: 260, p: 7, c: 38, f: 9, tags: ["veg"], veg: true },
    { name: "Aloo Paratha", cal: 310, p: 6, c: 44, f: 12, tags: ["veg"], veg: true },
    { name: "Fruit Bowl", cal: 90, p: 1, c: 22, f: 0, tags: ["veg", "healthy"], veg: true },
    { name: "Samosa", cal: 260, p: 5, c: 28, f: 14, tags: ["veg", "fried"], veg: true },
    { name: "Veg Puff", cal: 240, p: 4, c: 26, f: 13, tags: ["veg"], veg: true },
    { name: "Pav Bhaji", cal: 350, p: 9, c: 48, f: 14, tags: ["veg"], veg: true },
    { name: "Veg Manchurian & Fried Rice", cal: 410, p: 10, c: 62, f: 14, tags: ["veg", "foodpark"], veg: true },
    { name: "Hakka Noodles", cal: 340, p: 8, c: 54, f: 10, tags: ["veg", "foodpark"], veg: true },
    { name: "French Fries", cal: 280, p: 3, c: 36, f: 14, tags: ["veg", "fried", "foodpark"], veg: true },
    { name: "Paneer Tikka Wrap", cal: 360, p: 16, c: 38, f: 16, tags: ["veg", "high protein", "foodpark"], veg: true },
    { name: "Gulab Jamun", cal: 180, p: 3, c: 28, f: 7, tags: ["veg", "dessert"], veg: true },
  ];

  const itemMap = {};
  for (const f of foodCatalog) {
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
    itemMap[f.name] = mi.id;
  }

  // 6. Seed 4-Meal Menu Templates for All 4 Mess Types: VEG, NON_VEG, SPECIAL, FOODPARK
  await prisma.menuTemplateEntry.deleteMany({});
  await prisma.menuDateEntry.deleteMany({});

  const mealSlots = ["BREAKFAST", "LUNCH", "SNACKS", "DINNER"];
  const messTypes = ["VEG", "NON_VEG", "SPECIAL", "FOODPARK"];

  for (let dow = 0; dow < 7; dow++) {
    for (const mt of messTypes) {
      let breakfast = ["Idli Sambar", "Masala Dosa"];
      let lunch = ["Paneer Butter Masala", "Dal Tadka", "Steamed Rice", "Phulka (3)"];
      let snacks = ["Samosa", "Fruit Bowl"];
      let dinner = ["Mixed Veg Curry", "Dal Tadka", "Steamed Rice", "Gulab Jamun"];

      if (mt === "NON_VEG") {
        breakfast = ["Boiled Eggs (2)", "Idli Sambar"];
        lunch = ["Chicken Curry", "Dal Tadka", "Steamed Rice", "Phulka (3)"];
        snacks = ["Veg Puff", "Fruit Bowl"];
        dinner = ["Egg Curry", "Dal Fry" || "Dal Tadka", "Steamed Rice", "Gulab Jamun"];
      } else if (mt === "SPECIAL") {
        breakfast = ["Poha", "Masala Dosa"];
        lunch = ["Shahi Paneer", "Dal Makhani", "Veg Pulao", "Butter Naan"];
        snacks = ["Pav Bhaji", "Fruit Bowl"];
        dinner = ["Paneer Butter Masala", "Dal Makhani", "Jeera Rice", "Gulab Jamun"];
      } else if (mt === "FOODPARK") {
        breakfast = ["Aloo Paratha", "Masala Dosa"];
        lunch = ["Veg Manchurian & Fried Rice", "Hakka Noodles", "Steamed Rice"];
        snacks = ["French Fries", "Veg Puff"];
        dinner = ["Paneer Tikka Wrap", "Dal Tadka", "Jeera Rice", "Gulab Jamun"];
      }

      const mealMap = {
        BREAKFAST: breakfast,
        LUNCH: lunch,
        SNACKS: snacks,
        DINNER: dinner,
      };

      for (const slot of mealSlots) {
        let order = 0;
        for (const dishName of mealMap[slot]) {
          if (itemMap[dishName]) {
            await prisma.menuTemplateEntry.create({
              data: {
                dayOfWeek: dow,
                messType: mt,
                mealSlot: slot,
                menuItemId: itemMap[dishName],
                sortOrder: order++,
              },
            });
          }
        }
      }
    }
  }

  // 7. Seed Past 14 Days Attendance (for student.veg, student.nonveg, student.special, student.foodpark)
  await prisma.mealAttendance.deleteMany({});
  const primaryStudents = [
    "student.veg@vitstudent.ac.in",
    "student.nonveg@vitstudent.ac.in",
    "student.special@vitstudent.ac.in",
    "student.foodpark@vitstudent.ac.in",
  ];

  for (const email of primaryStudents) {
    const sId = studentUserMap[email];
    if (!sId) continue;

    for (let dayOffset = 0; dayOffset <= 14; dayOffset++) {
      const d = new Date();
      d.setDate(d.getDate() - dayOffset);
      d.setHours(0, 0, 0, 0);

      for (const slot of mealSlots) {
        // High attendance with occasional skip
        const isAbsent = (dayOffset === 2 && slot === "BREAKFAST") || (dayOffset === 7 && slot === "SNACKS");
        await prisma.mealAttendance.upsert({
          where: {
            userId_logDate_mealSlot: {
              userId: sId,
              logDate: d,
              mealSlot: slot,
            },
          },
          update: {},
          create: {
            userId: sId,
            logDate: d,
            mealSlot: slot,
            status: isAbsent ? "ABSENT" : "PRESENT",
            method: isAbsent ? "AUTO_ABSENT" : "OTP",
          },
        });
      }
    }
  }

  // 8. Seed Reviews Tagged by Mess Type and Caterer
  await prisma.review.deleteMany({});
  const sampleReviews = [
    {
      studentEmail: "student.veg@vitstudent.ac.in",
      dishName: "Masala Dosa",
      rating: 5,
      comment: "Crispy and hot! Chutney is delicious today at Zenith Veg mess.",
      messType: "VEG",
      caterer: "ZENITH",
    },
    {
      studentEmail: "student.veg@vitstudent.ac.in",
      dishName: "Paneer Butter Masala",
      rating: 4,
      comment: "Very rich gravy and soft paneer pieces.",
      messType: "VEG",
      caterer: "ZENITH",
    },
    {
      studentEmail: "student.nonveg@vitstudent.ac.in",
      dishName: "Chicken Curry",
      rating: 5,
      comment: "Fusion non-veg counter served very well seasoned tender chicken.",
      messType: "NON_VEG",
      caterer: "FUSION",
    },
    {
      studentEmail: "student.special@vitstudent.ac.in",
      dishName: "Shahi Paneer",
      rating: 5,
      comment: "Proodle Special mess never disappoints. Butter Naan was also fresh.",
      messType: "SPECIAL",
      caterer: "PROODLE",
    },
    {
      studentEmail: "student.foodpark@vitstudent.ac.in",
      dishName: "Paneer Tikka Wrap",
      rating: 5,
      comment: "CRCL Foodpark wrap is crunchy and super flavorful!",
      messType: "FOODPARK",
      caterer: "CRCL",
    },
  ];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const r of sampleReviews) {
    const sId = studentUserMap[r.studentEmail];
    const itemId = itemMap[r.dishName];
    if (sId && itemId) {
      await prisma.review.create({
        data: {
          userId: sId,
          menuItemId: itemId,
          menuDate: today,
          rating: r.rating,
          comment: r.comment,
          messType: r.messType,
          caterer: r.caterer,
        },
      });
    }
  }

  // 9. Seed Caterer Swap Options with CRCL and all 4 Mess Types
  const swapOpts = [
    { messType: "VEG", fromCaterer: "ZENITH", toCaterer: "SRRC", totalSlots: 10 },
    { messType: "VEG", fromCaterer: "ZENITH", toCaterer: "PROODLE", totalSlots: 8 },
    { messType: "VEG", fromCaterer: "SRRC", toCaterer: "ZENITH", totalSlots: 8 },
    { messType: "NON_VEG", fromCaterer: "FUSION", toCaterer: "ZENITH", totalSlots: 10 },
    { messType: "NON_VEG", fromCaterer: "ZENITH", toCaterer: "FUSION", totalSlots: 8 },
    { messType: "SPECIAL", fromCaterer: "PROODLE", toCaterer: "ZENITH", totalSlots: 6 },
    { messType: "SPECIAL", fromCaterer: "ZENITH", toCaterer: "PROODLE", totalSlots: 6 },
    { messType: "FOODPARK", fromCaterer: "CRCL", toCaterer: "PROODLE", totalSlots: 10 },
    { messType: "FOODPARK", fromCaterer: "PROODLE", toCaterer: "CRCL", totalSlots: 10 },
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

  // 10. Night Mess
  await prisma.nightMessItem.upsert({
    where: { serviceDate_name: { serviceDate: today, name: "Maggi Hot Cup" } },
    update: {},
    create: {
      serviceDate: today,
      name: "Maggi Hot Cup",
      price: 40,
      availableQty: 80,
      remainingQty: 55,
    },
  });

  console.log("Database seeded successfully with:");
  console.log(" - Admin: admin1@vitadmin.ac.in");
  console.log(" - Mess Incharge: mess1@messadmin.ac.in");
  console.log(" - Students: student.veg, student.nonveg, student.special, student.foodpark (all password123)");
  console.log(" - Parents: parent1@vitparent.ac.in, parent.priya, parent.aditya, parent.sneha (all password123)");
  console.log(" - 4 Mess Types: VEG, NON_VEG, SPECIAL, FOODPARK across all 4 meals (Breakfast, Lunch, Snacks, Dinner)");
  console.log(" - 14 days of meal attendance records & reviews tagged by mess type and caterer.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
