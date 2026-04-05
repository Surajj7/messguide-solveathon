import { runAttendanceJobs } from "../services/attendanceJobs.service.js";

const FIVE_MIN = 5 * 60 * 1000;

export function startAttendanceCron() {
  setTimeout(() => {
    runAttendanceJobs();
  }, 3000);
  setInterval(runAttendanceJobs, FIVE_MIN);
  console.log("[attendance] background jobs every 5 minutes (auto-absent, 15m warnings, streak alerts)");
}
