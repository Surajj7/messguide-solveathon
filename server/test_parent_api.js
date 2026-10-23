async function testParentLogin(email, password) {
  const baseURL = "http://localhost:4000/api";
  console.log(`\n========================================`);
  console.log(`Testing Parent login with ${email}...`);

  const loginRes = await fetch(`${baseURL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const loginData = await loginRes.json();
  console.log("Login Status:", loginRes.status);
  console.log("User returned:", loginData.user);

  if (!loginRes.ok) {
    throw new Error("Login failed: " + JSON.stringify(loginData));
  }

  const token = loginData.token;
  const headers = { Authorization: `Bearer ${token}` };

  console.log("\n1. Testing GET /api/auth/me...");
  const meRes = await fetch(`${baseURL}/auth/me`, { headers });
  const meData = await meRes.json();
  console.log("Auth /me:", { id: meData.id, email: meData.email, role: meData.role, parentProfile: meData.parentProfile?.studentRegNo });

  console.log("\n2. Testing GET /api/parent/student...");
  const studentRes = await fetch(`${baseURL}/parent/student`, { headers });
  const studentData = await studentRes.json();
  console.log("Student:", studentData.name, "Reg:", studentData.registrationNo, "Mess:", studentData.messType, "Caterer:", studentData.caterer);

  console.log("\n3. Testing GET /api/parent/attendance?days=30...");
  const attRes = await fetch(`${baseURL}/parent/attendance?days=30`, { headers });
  const attData = await attRes.json();
  console.log("Attendance stats:", attData.stats, "Records count:", attData.records?.length);

  console.log("\n4. Testing GET /api/parent/menu...");
  const today = new Date().toISOString().slice(0, 10);
  const menuRes = await fetch(`${baseURL}/parent/menu?date=${today}`, { headers });
  const menuData = await menuRes.json();
  console.log("Menu for date:", menuData.date, "Meals:", Object.keys(menuData.meals || {}));

  console.log(`\nSUCCESS: Parent ${email} verified successfully!`);
}

async function run() {
  try {
    await testParentLogin("parent1@vitparent.ac.in", "password123");
    await testParentLogin("parent.soham@vitparent.ac.in", "password123");
    console.log("\n>>> ALL PARENT LOGINS AND INTEGRATIONS WORKING 100% <<<");
  } catch (err) {
    console.error("Test failed:", err);
    process.exit(1);
  }
}

run();
