import React, { useEffect, useState } from "react";
import {
  IoCalendarOutline,
  IoRestaurantOutline,
  IoStarOutline,
  IoCheckmarkCircleOutline,
  IoCloseCircleOutline,
  IoLogOutOutline,
  IoSunnyOutline,
  IoCafeOutline,
  IoFastFoodOutline,
  IoShieldCheckmarkOutline,
} from "react-icons/io5";
import api from "../../api/client.js";
import { useAuth } from "../../context/AuthContext.jsx";
import styles from "./ParentDashboard.module.css";

const MEAL_ICONS = {
  BREAKFAST: IoSunnyOutline,
  LUNCH: IoRestaurantOutline,
  SNACKS: IoCafeOutline,
  DINNER: IoFastFoodOutline,
};

export default function ParentDashboard() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState("attendance"); // attendance | menu | feedback
  const [student, setStudent] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [menu, setMenu] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadInitial() {
      setLoading(true);
      setError("");
      try {
        const studentRes = await api.get("/parent/student");
        setStudent(studentRes.data);

        const [attRes, menuRes, fbRes] = await Promise.all([
          api.get("/parent/attendance?days=30"),
          api.get(`/parent/menu?date=${selectedDate}`),
          api.get("/parent/feedback"),
        ]);
        setAttendance(attRes.data);
        setMenu(menuRes.data);
        setFeedback(fbRes.data);
      } catch (err) {
        setError(
          err.response?.data?.error || "Failed to load parent portal data."
        );
      } finally {
        setLoading(false);
      }
    }
    loadInitial();
  }, []);

  async function handleDateChange(e) {
    const newDate = e.target.value;
    setSelectedDate(newDate);
    try {
      const menuRes = await api.get(`/parent/menu?date=${newDate}`);
      setMenu(menuRes.data);
    } catch {
      // ignore
    }
  }

  function getMessBadgeClass(messType) {
    switch (messType) {
      case "VEG":
        return styles.badgeVeg;
      case "NON_VEG":
        return styles.badgeNonVeg;
      case "SPECIAL":
        return styles.badgeSpecial;
      case "FOODPARK":
        return styles.badgeFoodpark;
      default:
        return styles.badgeVeg;
    }
  }

  if (loading) {
    return (
      <div className={styles.wrap}>
        <div className="emptyState">Loading parent portal…</div>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      {/* Top Bar */}
      <header className={styles.topBar}>
        <div className={styles.brand}>
          <IoShieldCheckmarkOutline size={24} />
          NutriGuide · Parent Portal
        </div>
        <div className={styles.userNav}>
          <span className={styles.userName}>{user?.name}</span>
          <button className={styles.logoutBtn} onClick={logout}>
            <IoLogOutOutline size={16} /> Sign out
          </button>
        </div>
      </header>

      {error && <div className="error" style={{ marginBottom: "1rem" }}>{error}</div>}

      {/* Student Profile Card */}
      {student && (
        <section className={styles.childHero}>
          <div className={styles.childHeader}>
            <div>
              <p className={styles.childTitle}>Linked Ward Information</p>
              <h1 className={styles.childName}>{student.name}</h1>
              <p className={styles.childReg}>
                Roll No: <strong>{student.registrationNo || "N/A"}</strong> · {student.email}
              </p>
            </div>
            <div className={styles.childBadges}>
              <span className={`${styles.badge} ${getMessBadgeClass(student.messType)}`}>
                Mess: {student.messType?.replace(/_/g, " ")}
              </span>
              <span className={`${styles.badge} ${styles.badgeCaterer}`}>
                Caterer: {student.caterer}
              </span>
              <span className={`${styles.badge} ${styles.badgeBlock}`}>
                Hostel: Block {student.hostelBlock}
              </span>
            </div>
          </div>
        </section>
      )}

      {/* Navigation Tabs */}
      <nav className={styles.tabs} aria-label="Parent Dashboard Tabs">
        <button
          className={`${styles.tabBtn} ${tab === "attendance" ? styles.tabActive : ""}`}
          onClick={() => setTab("attendance")}
        >
          <IoCalendarOutline size={18} /> Mess Attendance
        </button>
        <button
          className={`${styles.tabBtn} ${tab === "menu" ? styles.tabActive : ""}`}
          onClick={() => setTab("menu")}
        >
          <IoRestaurantOutline size={18} /> Menu Items
        </button>
        <button
          className={`${styles.tabBtn} ${tab === "feedback" ? styles.tabActive : ""}`}
          onClick={() => setTab("feedback")}
        >
          <IoStarOutline size={18} /> Student Feedback & Ratings
        </button>
      </nav>

      {/* TAB 1: Attendance */}
      {tab === "attendance" && (
        <section>
          {attendance?.stats && (
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <span className={styles.statLabel}>Attendance Rate</span>
                <div className={styles.statValue}>
                  {attendance.stats.attendanceRatePercent}%
                </div>
                <span className="muted">Past 30 days</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statLabel}>Meals Attended</span>
                <div className={styles.statValue}>
                  {attendance.stats.presentMeals}
                </div>
                <span className="muted">Meals checked in</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statLabel}>Missed Meals</span>
                <div className={styles.statValue}>
                  {attendance.stats.absentMeals}
                </div>
                <span className="muted">Meals missed / absent</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statLabel}>Consecutive Missed</span>
                <div className={styles.statValue}>
                  {attendance.stats.consecutiveMissedMeals}
                </div>
                <span className="muted">Current streak</span>
              </div>
            </div>
          )}

          <div className={styles.attendanceTableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Meal Slot</th>
                  <th>Status</th>
                  <th>Method</th>
                </tr>
              </thead>
              <tbody>
                {attendance?.records?.length === 0 && (
                  <tr>
                    <td colSpan="4" className="muted" style={{ textAlign: "center", padding: "2rem" }}>
                      No attendance records found yet.
                    </td>
                  </tr>
                )}
                {attendance?.records?.map((rec) => (
                  <tr key={rec.id}>
                    <td>{rec.logDate}</td>
                    <td>
                      <strong>{rec.mealSlot}</strong>
                    </td>
                    <td>
                      {rec.status === "PRESENT" ? (
                        <span className={styles.statusPresent}>
                          <IoCheckmarkCircleOutline size={16} /> Present
                        </span>
                      ) : (
                        <span className={styles.statusAbsent}>
                          <IoCloseCircleOutline size={16} /> Absent
                        </span>
                      )}
                    </td>
                    <td className="muted">{rec.method}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB 2: Menu Items */}
      {tab === "menu" && (
        <section>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.75rem" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.25rem", color: "#f8fafc" }}>
                Menu for {student?.name}&apos;s Mess
              </h2>
              <p className="muted" style={{ margin: "0.2rem 0 0", fontSize: "0.85rem" }}>
                Type: <strong>{student?.messType}</strong> · Caterer: <strong>{student?.caterer}</strong>
              </p>
            </div>
            <div>
              <input
                type="date"
                value={selectedDate}
                onChange={handleDateChange}
                className="input"
                style={{ maxWidth: "180px", background: "rgba(30, 41, 59, 0.8)", color: "#fff" }}
              />
            </div>
          </div>

          <div className={styles.menuMealsGrid}>
            {menu?.meals?.map((m) => {
              const Icon = MEAL_ICONS[m.mealSlot] || IoRestaurantOutline;
              return (
                <div key={m.mealSlot} className={styles.menuCard}>
                  <div className={styles.mealCardHeader}>
                    <Icon size={20} color="#38bdf8" />
                    <h3 className={styles.mealSlotTitle}>{m.mealSlot.toLowerCase()}</h3>
                  </div>
                  <div className={styles.dishList}>
                    {m.items?.length === 0 && (
                      <p className="muted" style={{ margin: 0, fontSize: "0.88rem" }}>
                        No items listed for this meal.
                      </p>
                    )}
                    {m.items?.map((dish) => (
                      <div key={dish.id} className={styles.dishItem}>
                        <div>
                          <div className={styles.dishName}>{dish.name}</div>
                          <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.2rem" }}>
                            {dish.isVeg ? (
                              <span style={{ fontSize: "0.7rem", color: "#4ade80", background: "rgba(34, 197, 94, 0.15)", padding: "0.15rem 0.4rem", borderRadius: "4px" }}>Veg</span>
                            ) : (
                              <span style={{ fontSize: "0.7rem", color: "#f87171", background: "rgba(239, 68, 68, 0.15)", padding: "0.15rem 0.4rem", borderRadius: "4px" }}>Non-Veg</span>
                            )}
                            {dish.tags?.map((t) => (
                              <span key={t} style={{ fontSize: "0.7rem", color: "#94a3b8" }}>{t}</span>
                            ))}
                          </div>
                        </div>
                        <span className={styles.dishKcal}>{Math.round(dish.calories)} kcal</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* TAB 3: Feedback & Reviews */}
      {tab === "feedback" && (
        <section>
          <div style={{ marginBottom: "1.5rem" }}>
            <h2 style={{ margin: "0 0 0.25rem", fontSize: "1.25rem", color: "#f8fafc" }}>
              Reviews Given by {student?.name}
            </h2>
            <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
              Feedback shared regarding meals at {student?.caterer} ({student?.messType} Mess).
            </p>
          </div>

          <div className={styles.feedbackList}>
            {feedback?.childReviews?.length === 0 && (
              <div className="card emptyState">No reviews submitted yet by student.</div>
            )}
            {feedback?.childReviews?.map((r) => (
              <div key={r.id} className={styles.feedbackCard}>
                <div className={styles.feedbackHeader}>
                  <strong style={{ fontSize: "1.05rem", color: "#ffffff" }}>
                    {r.menuItemName}
                  </strong>
                  <span className={styles.stars}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
                </div>
                {r.comment && <p className={styles.feedbackComment}>{r.comment}</p>}
                <div className={styles.feedbackDate}>
                  Tasted on {r.menuDate} · Caterer: {r.caterer || student?.caterer} ({r.messType || student?.messType})
                </div>
              </div>
            ))}
          </div>

          <div style={{ margin: "2rem 0 1rem" }}>
            <h3 style={{ margin: "0 0 0.25rem", fontSize: "1.1rem", color: "#f8fafc" }}>
              Overall Mess &amp; Caterer Feedback ({student?.caterer} - {student?.messType})
            </h3>
            <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
              Average Student Satisfaction Rating: <strong>★ {feedback?.averageMessRating} / 5</strong>
            </p>
          </div>

          <div className={styles.feedbackList}>
            {feedback?.messCommunityReviews?.map((r) => (
              <div key={r.id} className={styles.feedbackCard} style={{ background: "rgba(15, 23, 42, 0.4)" }}>
                <div className={styles.feedbackHeader}>
                  <strong style={{ color: "#e2e8f0" }}>{r.menuItemName}</strong>
                  <span className={styles.stars}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
                </div>
                {r.comment && <p className={styles.feedbackComment}>{r.comment}</p>}
                <div className={styles.feedbackDate}>
                  {r.menuDate} · {r.caterer} ({r.messType})
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
