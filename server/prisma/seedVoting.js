import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Monthly Menu Voting & Planning System data...");

  // 1. Mess Manager profile
  const messManager = await prisma.user.findUnique({
    where: { email: "mess1@messadmin.ac.in" },
  });

  if (messManager) {
    await prisma.messManagerProfile.upsert({
      where: { userId: messManager.id },
      update: {
        messTypes: ["VEG", "NON_VEG", "SPECIAL", "FOODPARK"],
        canAddLiveCandidates: true,
      },
      create: {
        userId: messManager.id,
        messTypes: ["VEG", "NON_VEG", "SPECIAL", "FOODPARK"],
        canAddLiveCandidates: true,
      },
    });
    console.log("✓ Linked MessManagerProfile to mess1@messadmin.ac.in");
  }

  const admin = await prisma.user.findUnique({
    where: { email: "admin1@vitadmin.ac.in" },
  });

  // 2. Sample Poll for Next Month
  const now = new Date();
  const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const targetMonth = nextMonthDate.getMonth() + 1;
  const targetYear = nextMonthDate.getFullYear();
  const monthName = nextMonthDate.toLocaleString("en-US", { month: "long" });

  const startDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
  const endDate = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000); // 10 days from now

  let poll = await prisma.menuPoll.findFirst({
    where: { targetMonth, targetYear },
  });

  if (!poll) {
    poll = await prisma.menuPoll.create({
      data: {
        name: `${monthName} ${targetYear} Campus Menu Choice Poll`,
        description: `Official campus-wide voting to curate the student mess menu for ${monthName} ${targetYear}. Your approval votes directly decide our daily rotations!`,
        targetMonth,
        targetYear,
        status: "OPEN",
        startDate,
        endDate,
        messTypes: ["VEG", "NON_VEG", "SPECIAL", "FOODPARK"],
        maxSelectionsPerCategory: 3,
        allowBallotEdit: true,
        showLiveResults: true,
        allowLiveCandidateAdditions: true,
        requireCandidateApproval: true,
        fairnessPolicy: "LATE_ENTRY_FLAG",
        tieBreakerPolicy: "ADMIN_REVIEW",
        weekNumbering: "CALENDAR_WEEKS",
        createdById: admin?.id,
        categories: {
          create: [
            {
              name: "Breakfast Specials",
              mealSlot: "BREAKFAST",
              maxSelections: 3,
              displayOrder: 1,
            },
            {
              name: "Lunch Main Course",
              mealSlot: "LUNCH",
              maxSelections: 3,
              displayOrder: 2,
            },
            {
              name: "Evening Snacks & Tea",
              mealSlot: "SNACKS",
              maxSelections: 2,
              displayOrder: 3,
            },
            {
              name: "Dinner Delicacies",
              mealSlot: "DINNER",
              maxSelections: 3,
              displayOrder: 4,
            },
          ],
        },
      },
      include: { categories: true },
    });
    console.log(`✓ Created poll: ${poll.name}`);
  } else {
    poll = await prisma.menuPoll.findUnique({
      where: { id: poll.id },
      include: { categories: true },
    });
  }

  // 3. Populate sample candidates if empty
  const candidateCount = await prisma.menuPollCandidate.count({
    where: { pollId: poll.id },
  });

  if (candidateCount === 0) {
    const sampleCandidates = [
      // Breakfast
      {
        catIndex: 0,
        dishName: "Mysore Masala Dosa with Sambar",
        messType: "VEG",
        mealSlot: "BREAKFAST",
        description: "Crispy red-chili garlic spiced crepe with potato masala and vegetable sambar",
        calories: 290,
        proteinG: 7,
        carbsG: 42,
        fatsG: 10,
        allergens: "Mustard",
        dietaryTags: ["Vegetarian", "South Indian", "Popular"],
      },
      {
        catIndex: 0,
        dishName: "Stuffed Aloo & Paneer Paratha",
        messType: "VEG",
        mealSlot: "BREAKFAST",
        description: "Whole wheat flatbread stuffed with spiced potatoes and paneer, served with curd & pickle",
        calories: 340,
        proteinG: 11,
        carbsG: 45,
        fatsG: 13,
        allergens: "Dairy, Gluten",
        dietaryTags: ["Vegetarian", "North Indian"],
      },
      {
        catIndex: 0,
        dishName: "Egg Bhurji & Multigrain Pav",
        messType: "NON_VEG",
        mealSlot: "BREAKFAST",
        description: "Scrambled eggs tossed with onions, tomatoes, and green chilies, served with toasted pav",
        calories: 310,
        proteinG: 19,
        carbsG: 28,
        fatsG: 14,
        allergens: "Eggs, Gluten",
        dietaryTags: ["High Protein", "Non-Veg"],
      },
      {
        catIndex: 0,
        dishName: "Poha with Sprouts & Roasted Peanuts",
        messType: "SPECIAL",
        mealSlot: "BREAKFAST",
        description: "Light flattened rice tempered with mustard, turmeric, boiled moong sprouts, and peanuts",
        calories: 230,
        proteinG: 8,
        carbsG: 38,
        fatsG: 5,
        allergens: "Peanuts, Mustard",
        dietaryTags: ["Low Fat", "Vegetarian", "Gluten-Free"],
      },

      // Lunch
      {
        catIndex: 1,
        dishName: "Paneer Lababdar & Butter Roti",
        messType: "VEG",
        mealSlot: "LUNCH",
        description: "Soft paneer cubes simmered in spiced tomato cashew gravy with whole wheat rotis",
        calories: 420,
        proteinG: 18,
        carbsG: 36,
        fatsG: 24,
        allergens: "Dairy, Nuts, Gluten",
        dietaryTags: ["Vegetarian", "High Protein"],
      },
      {
        catIndex: 1,
        dishName: "Hyderabadi Chicken Dum Biryani",
        messType: "NON_VEG",
        mealSlot: "LUNCH",
        description: "Slow-cooked fragrant basmati rice layered with marinated chicken, served with mirchi ka salan and raita",
        calories: 520,
        proteinG: 32,
        carbsG: 58,
        fatsG: 18,
        allergens: "Dairy",
        dietaryTags: ["Non-Veg", "High Protein", "Chef Special"],
      },
      {
        catIndex: 1,
        dishName: "Dal Makhani with Jeera Rice",
        messType: "VEG",
        mealSlot: "LUNCH",
        description: "Slow-cooked black lentils in creamy butter sauce paired with cumin-scented basmati rice",
        calories: 380,
        proteinG: 14,
        carbsG: 52,
        fatsG: 13,
        allergens: "Dairy",
        dietaryTags: ["Vegetarian", "Comfort Food"],
      },
      {
        catIndex: 1,
        dishName: "Grilled Fish Tikka with Mint Chutney",
        messType: "FOODPARK",
        mealSlot: "LUNCH",
        description: "Fresh boneless fish fillets marinated in hung curd, ajwain, and tandoori spices",
        calories: 290,
        proteinG: 34,
        carbsG: 6,
        fatsG: 14,
        allergens: "Fish, Dairy",
        dietaryTags: ["High Protein", "Keto-Friendly"],
      },

      // Snacks
      {
        catIndex: 2,
        dishName: "Samosa Chaat with Sweet Curd & Chutneys",
        messType: "VEG",
        mealSlot: "SNACKS",
        description: "Crushed potato samosa layered with chole, chilled sweet yogurt, tamarind and mint chutney",
        calories: 270,
        proteinG: 6,
        carbsG: 38,
        fatsG: 11,
        allergens: "Dairy, Gluten",
        dietaryTags: ["Street Food", "Vegetarian"],
      },
      {
        catIndex: 2,
        dishName: "Peri Peri Chicken Popcorn",
        messType: "NON_VEG",
        mealSlot: "SNACKS",
        description: "Bite-sized crispy chicken coated with spicy African bird's eye chili seasoning",
        calories: 310,
        proteinG: 22,
        carbsG: 18,
        fatsG: 16,
        allergens: "Gluten",
        dietaryTags: ["Non-Veg", "High Protein"],
      },
      {
        catIndex: 2,
        dishName: "Steamed Vegetable Momos with Spicy Dip",
        messType: "SPECIAL",
        mealSlot: "SNACKS",
        description: "Delicate dumplings filled with finely chopped cabbage, carrots, onions, served with hot garlic dip",
        calories: 190,
        proteinG: 5,
        carbsG: 32,
        fatsG: 4,
        allergens: "Gluten, Soy",
        dietaryTags: ["Vegetarian", "Low Calorie"],
      },

      // Dinner
      {
        catIndex: 3,
        dishName: "Malai Kofta in Velvety Gravy",
        messType: "VEG",
        mealSlot: "DINNER",
        description: "Paneer and potato dumplings stuffed with dry fruits in mild cashew tomato gravy",
        calories: 390,
        proteinG: 12,
        carbsG: 34,
        fatsG: 23,
        allergens: "Dairy, Nuts, Gluten",
        dietaryTags: ["Vegetarian", "Royal Feast"],
      },
      {
        catIndex: 3,
        dishName: "Butter Chicken with Garlic Naan",
        messType: "NON_VEG",
        mealSlot: "DINNER",
        description: "Charcoal-tandoor chicken in buttery silky makhani gravy with freshly baked garlic naan",
        calories: 510,
        proteinG: 35,
        carbsG: 44,
        fatsG: 22,
        allergens: "Dairy, Gluten",
        dietaryTags: ["Non-Veg", "High Protein", "All-Time Favorite"],
      },
      {
        catIndex: 3,
        dishName: "South Indian Special Veg Kurma & Parotta",
        messType: "SPECIAL",
        mealSlot: "DINNER",
        description: "Layered flaky parottas served with coconut-tempered aromatic mixed vegetable kurma",
        calories: 430,
        proteinG: 9,
        carbsG: 56,
        fatsG: 19,
        allergens: "Gluten",
        dietaryTags: ["Vegetarian", "South Indian"],
      },
      {
        catIndex: 3,
        dishName: "Kadhai Paneer with Phulkas",
        messType: "VEG",
        mealSlot: "DINNER",
        description: "Fresh cottage cheese, bell peppers, and coriander seeds roasted in iron wok",
        calories: 360,
        proteinG: 17,
        carbsG: 32,
        fatsG: 19,
        allergens: "Dairy, Gluten",
        dietaryTags: ["Vegetarian", "High Protein"],
      },
    ];

    for (const item of sampleCandidates) {
      const category = poll.categories[item.catIndex];
      if (!category) continue;

      let menuItem = await prisma.menuItem.findFirst({
        where: { name: item.dishName },
      });
      if (!menuItem) {
        menuItem = await prisma.menuItem.create({
          data: {
            name: item.dishName,
            calories: item.calories,
            proteinG: item.proteinG,
            carbsG: item.carbsG,
            fatsG: item.fatsG,
            isVeg: item.messType === "VEG",
            tags: JSON.stringify(item.dietaryTags),
          },
        });
      }

      await prisma.menuPollCandidate.create({
        data: {
          pollId: poll.id,
          categoryId: category.id,
          dishName: item.dishName,
          messType: item.messType,
          mealSlot: item.mealSlot,
          description: item.description,
          calories: item.calories,
          proteinG: item.proteinG,
          carbsG: item.carbsG,
          fatsG: item.fatsG,
          allergens: item.allergens,
          dietaryTags: JSON.stringify(item.dietaryTags),
          isAvailable: true,
          status: "APPROVED",
          submittedByRole: "ADMIN",
          submittedByUserId: admin?.id,
          menuItemId: menuItem.id,
          voteCount: Math.floor(Math.random() * 8) + 2, // 2-10 initial votes for realism
        },
      });
    }
    console.log("✓ Seeded sample candidates across all 4 categories");
  }

  // 4. Sample dish suggestions
  const student = await prisma.user.findFirst({
    where: { role: "STUDENT" },
  });

  if (student) {
    const existingSuggestion = await prisma.dishSuggestion.findFirst({
      where: { userId: student.id },
    });
    if (!existingSuggestion) {
      await prisma.dishSuggestion.create({
        data: {
          userId: student.id,
          dishName: "Cold Coffee with Chocolate Drizzle",
          mealSlot: "SNACKS",
          messType: "SPECIAL",
          description: "Chilled blended espresso with milk, sugar, and chocolate fudge",
          reason: "Popular among students during summer evenings and study sessions",
          status: "PENDING",
        },
      });
      console.log("✓ Created sample student dish suggestion");
    }
  }

  console.log("✓ Voting and planning system seeded successfully!");
}

main()
  .catch((e) => {
    console.error("Error in seedVoting:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
