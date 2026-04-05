import express from "express";
import cors from "cors";
import { PORT } from "./config.js";
import { uploadDir } from "./lib/upload.js";
import authRoutes from "./routes/auth.js";
import usersRoutes from "./routes/users.js";
import profilesRoutes from "./routes/profiles.js";
import menusRoutes from "./routes/menus.js";
import importRoutes from "./routes/importRoutes.js";
import reviewsRoutes from "./routes/reviews.js";
import complaintsRoutes from "./routes/complaints.js";
import suggestionsRoutes from "./routes/suggestions.js";
import crowdRoutes from "./routes/crowd.js";
import leftoversRoutes from "./routes/leftovers.js";
import nightMessRoutes from "./routes/nightMess.js";
import communityRoutes from "./routes/community.js";
import notificationsRoutes from "./routes/notifications.js";
import aiRoutes from "./routes/ai.js";
import preferencesRoutes from "./routes/preferences.js";
import announcementsRoutes from "./routes/announcements.js";
import adminRoutes from "./routes/admin.js";
import whatsappRoutes from "./routes/whatsapp.js";
import notifyAdminRoutes from "./routes/notifyAdmin.js";
import caloriesRoutes from "./routes/calories.js";
import advancedRequestsRoutes from "./routes/advancedRequests.js";
import messSwapRoutes from "./routes/messSwap.js";
import messSwapAdminRoutes from "./routes/messSwapAdmin.js";
import attendanceRoutes from "./routes/attendance.js";
import { startAttendanceCron } from "./cron/attendanceCron.js";

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use("/uploads", express.static(uploadDir));

app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "mess-menu-api" });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/profiles", profilesRoutes);
app.use("/api/menus", menusRoutes);
app.use("/api/import", importRoutes);
app.use("/api/reviews", reviewsRoutes);
app.use("/api/complaints", complaintsRoutes);
app.use("/api/suggestions", suggestionsRoutes);
app.use("/api/crowd", crowdRoutes);
app.use("/api/leftovers", leftoversRoutes);
app.use("/api/night-mess", nightMessRoutes);
app.use("/api/community", communityRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/preferences", preferencesRoutes);
app.use("/api/announcements", announcementsRoutes);
app.use("/api/admin/mess-swap", messSwapAdminRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/whatsapp", whatsappRoutes);
app.use("/api/admin-notify", notifyAdminRoutes);
app.use("/api/calories", caloriesRoutes);
app.use("/api/advanced-requests", advancedRequestsRoutes);
app.use("/api/mess-swap", messSwapRoutes);
app.use("/api/attendance", attendanceRoutes);

app.use((req, res, next) => {
  if (!req.path.startsWith("/api")) return next();
  res.status(404).json({
    error: "API route not found",
    path: req.originalUrl,
    hint: "Restart the backend (server folder: npm run dev). An old Node process often serves /api/health but not newer routes like /api/mess-swap.",
  });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Server error" });
});

app.listen(PORT, () => {
  console.log(`Mess Menu API listening on http://localhost:${PORT}`);
  startAttendanceCron();
});
