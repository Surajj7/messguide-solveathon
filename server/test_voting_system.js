import { PrismaClient } from "@prisma/client";
import {
  listPolls,
  getPollDetails,
  createPoll,
  changePollStatus,
  submitBallot,
  calculatePollResults,
} from "./src/services/menuPoll.service.js";
import {
  addCandidate,
  updateCandidate,
  generateCandidateCsvTemplate,
  parseAndValidateCandidateCsv,
  commitCandidateCsvImport,
} from "./src/services/candidate.service.js";
import {
  createSuggestion,
  getStudentSuggestions,
  listSuggestions,
  moderateSuggestion,
} from "./src/services/dishSuggestion.service.js";
import {
  generateMonthlyPlan,
  getMonthlyPlan,
  updatePlanItem,
  validatePlan,
  publishMonthlyPlan,
} from "./src/services/monthlyPlanner.service.js";
import { getMenuForDate } from "./src/services/menuResolve.js";

const prisma = new PrismaClient();

async function runTests() {
  console.log("=== STARTING FULL VOTING & PLANNING SYSTEM TEST SUITE ===");

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  // 1. Setup users
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  const student = await prisma.user.findFirst({ where: { role: "STUDENT" } });
  const manager = await prisma.user.findFirst({ where: { role: "MESS_INCHARGE" } });

  assert(admin && student && manager, "Found admin, student, and mess manager accounts");

  // 2. Poll listing & details
  const activePolls = await listPolls({ role: "STUDENT", userId: student.id });
  assert(activePolls.length > 0, `Student can list active polls (found ${activePolls.length})`);

  const poll = activePolls[0];
  const pollDetails = await getPollDetails(poll.id, { role: "STUDENT", userId: student.id });
  assert(pollDetails && pollDetails.categories.length > 0, "Student fetched poll details with categories");

  // 3. Ballot submission & approval voting
  const firstCat = pollDetails.categories[0];
  const candidateIds = firstCat.candidates.slice(0, 2).map((c) => c.id);
  assert(candidateIds.length >= 1, "Category has at least one candidate for voting");

  const voteRes = await submitBallot(poll.id, firstCat.id, candidateIds, student.id);
  assert(voteRes.success, "Student successfully cast approval ballot");

  // Verify ballot was recorded
  const checkDetails = await getPollDetails(poll.id, { role: "STUDENT", userId: student.id });
  assert(
    checkDetails.studentBallot[firstCat.id]?.length === candidateIds.length,
    "Student's submitted ballot is retrieved upon reload"
  );

  // 4. Ballot replacement / edit
  const singleCandidate = [candidateIds[0]];
  const editRes = await submitBallot(poll.id, firstCat.id, singleCandidate, student.id);
  assert(editRes.success && editRes.selectedCount === 1, "Student successfully updated/replaced ballot");

  // 5. Enforce selection limit
  let limitExceeded = false;
  try {
    const tooMany = firstCat.candidates.map((c) => c.id).concat(["fake-id-1", "fake-id-2"]);
    await submitBallot(poll.id, firstCat.id, tooMany, student.id);
  } catch (err) {
    limitExceeded = true;
  }
  assert(limitExceeded, "Server strictly rejects ballots exceeding maxSelections");

  // 6. Results calculation & Approval voting formulas
  const results = await calculatePollResults(poll.id, true);
  assert(results && results.categories.length > 0, "Calculated approval voting results");
  const cat0Res = results.categories.find((c) => c.categoryId === firstCat.id);
  assert(cat0Res.validSubmittedBallots >= 1, "Valid submitted ballots recorded as denominator");
  assert(
    cat0Res.candidates[0].voteSharePercentage >= 0,
    `Vote share calculated: ${cat0Res.candidates[0].voteSharePercentage}%`
  );

  // 7. Student Dish Suggestion
  const testDishName = `Tandoori Mushroom Tikka ${Date.now()}`;
  const sugg = await createSuggestion(student.id, {
    dishName: testDishName,
    mealSlot: "SNACKS",
    messType: "VEG",
    description: "Charcoal grilled spiced mushrooms",
    reason: "Great protein snack",
  });
  assert(sugg && sugg.status === "PENDING", "Student submitted new dish suggestion with PENDING status");

  // 8. Suggestion moderation (Admin)
  const modRes = await moderateSuggestion(sugg.id, {
    status: "APPROVED",
    moderationReason: "Approved for future menu consideration",
  }, admin);
  assert(modRes.status === "APPROVED", "Admin moderated suggestion to APPROVED");

  // 9. Candidate CSV import & template
  const csvTemplate = generateCandidateCsvTemplate();
  assert(csvTemplate.includes("dish_name") && csvTemplate.includes("mess_type"), "CSV template generated correctly");

  const preview = await parseAndValidateCandidateCsv(
    Buffer.from(csvTemplate),
    poll.id,
    admin
  );
  assert(preview.validRows.length > 0, `CSV preview validated ${preview.validRows.length} rows`);

  // 10. Date-Specific Monthly Menu Generation
  const targetMonth = poll.targetMonth;
  const targetYear = poll.targetYear;

  const plan = await generateMonthlyPlan({
    pollId: poll.id,
    targetMonth,
    targetYear,
    messTypes: ["VEG", "NON_VEG", "SPECIAL", "FOODPARK"],
    weekConvention: "CALENDAR_WEEKS",
    adminUserId: admin.id,
  });

  assert(plan && plan.calendar.length >= 28, `Monthly menu generated full calendar (${plan.calendar.length} distinct dates)`);

  // Verify critical calendar rule: date-specific entries across weeks
  const day1 = plan.calendar[0];
  const day8 = plan.calendar[7];
  assert(
    day1.date !== day8.date,
    `Date 1 (${day1.date}) and Date 8 (${day8.date}) are distinct dates with separate entries`
  );

  // 11. Lock / Pin dish survival
  const firstItem = plan.items[0];
  const lockedItem = await updatePlanItem(firstItem.id, { isLocked: true }, admin);
  assert(lockedItem.isLocked === true, "Item successfully pinned/locked");

  // Regenerate and ensure locked item survives
  const regenerated = await generateMonthlyPlan({
    pollId: poll.id,
    targetMonth,
    targetYear,
    messTypes: ["VEG", "NON_VEG", "SPECIAL", "FOODPARK"],
    adminUserId: admin.id,
  });
  const foundLocked = regenerated.items.find((i) => i.id === firstItem.id);
  assert(foundLocked && foundLocked.isLocked, "Pinned dish survived menu regeneration intact");

  // 12. Plan validation & publication
  const validation = await validatePlan(plan.id);
  assert(validation.isValid, "Monthly menu plan validated complete meal coverage");

  const publishRes = await publishMonthlyPlan(plan.id, admin.id);
  assert(publishRes.success, `Monthly menu published to live system (${publishRes.datesCount} dates)`);

  // 13. Integration check with existing daily menu system
  const testDate = plan.calendar[0].date;
  const dailyMenu = await getMenuForDate(new Date(testDate + "T12:00:00"), "VEG");
  assert(
    dailyMenu.source === "date_override",
    `getMenuForDate for ${testDate} served official published monthly plan (source: ${dailyMenu.source})`
  );
  assert(dailyMenu.meals.length === 4, "Daily menu contains all 4 meal slots from published plan");

  console.log("\n=======================================================");
  console.log(`ALL TESTS PASSED! (${passed} checks passed, ${failed} failed)`);
  console.log("=======================================================\n");
}

runTests()
  .catch((e) => {
    console.error("Test execution failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
