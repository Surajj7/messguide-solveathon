import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  IoSunnyOutline,
  IoRestaurantOutline,
  IoCafeOutline,
  IoFastFoodOutline,
} from "react-icons/io5";
import api from "../../api/client.js";
import { useAuth } from "../../context/AuthContext.jsx";
import styles from "./StudentHome.module.css";

const MEAL_ICON = {
  BREAKFAST: IoSunnyOutline,
  LUNCH: IoRestaurantOutline,
  SNACKS: IoCafeOutline,
  DINNER: IoFastFoodOutline,
};

const MEAL_ORDER = ["BREAKFAST", "LUNCH", "SNACKS", "DINNER"];

function randomSixDigit() {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(100000 + (buf[0] % 900000));
}

export default function StudentHome() {
  const { user, profile } = useAuth();
  const [menu, setMenu] = useState(null);
  const [crowd, setCrowd] = useState(null);
  const [dashOtp, setDashOtp] = useState(null);
  const [otpSource, setOtpSource] = useState(null);
  const [otpExpiresAt, setOtpExpiresAt] = useState(null);
  const [otpMealSlot, setOtpMealSlot] = useState(null);
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpErr, setOtpErr] = useState("");

  const refreshDashboardOtp = useCallback(async () => {
    if (user?.role !== "STUDENT") return;
    setOtpErr("");
    setOtpBusy(true);
    try {
      const { data } = await api.post("/attendance/generate-otp", {});
      setDashOtp(data.code);
      setOtpSource("server");
      setOtpExpiresAt(data.expiresAt);
      setOtpMealSlot(data.mealSlot || null);
    } catch {
      setDashOtp(randomSixDigit());
      setOtpSource("demo");
      setOtpExpiresAt(null);
      setOtpMealSlot(null);
    } finally {
      setOtpBusy(false);
    }
  }, [user?.role]);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    api.get(`/menus/day?date=${today}`).then((r) => setMenu(r.data));
    api.get("/crowd/latest").then((r) => setCrowd(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (user?.role !== "STUDENT") return;
    refreshDashboardOtp();
  }, [user?.role, refreshDashboardOtp]);

  useEffect(() => {
    if (otpSource !== "server" || !otpExpiresAt) return;
    const t = setInterval(() => {
      if (new Date() >= new Date(otpExpiresAt)) {
        setDashOtp(randomSixDigit());
        setOtpSource("demo");
        setOtpExpiresAt(null);
        setOtpMealSlot(null);
      }
    }, 1000);
    return () => clearInterval(t);
  }, [otpSource, otpExpiresAt]);

  function shuffleDemoOtp() {
    setDashOtp(randomSixDigit());
    setOtpSource("demo");
    setOtpExpiresAt(null);
    setOtpMealSlot(null);
    setOtpErr("");
  }

  const isStudent = user?.role === "STUDENT";

  return (
    <div className={`page ${styles.page}`}>
      <div className={styles.hero}>
        <p className={styles.heroEyebrow}>Your mess companion</p>
        <h1 className={styles.heroTitle}>
          Hello, {user?.name?.split(" ")[0] || "there"}
        </h1>
        <p className={styles.heroMeta}>
          <span className={styles.pill}>{profile?.messType?.replace(/_/g, " ")}</span>
          <span className={styles.pill}>Block {profile?.hostelBlock}</span>
          <span className={styles.pill}>{profile?.caterer?.replace(/_/g, " ")}</span>
        </p>
        <p className={styles.hint}>
          Tap <strong>☰</strong> top-left for calendar, AI, community & more.
        </p>
      </div>

      {crowd && (
        <div className={styles.crowdCard}>
          <span className={styles.crowdIcon} aria-hidden>
            👥
          </span>
          <div>
            <p className={styles.crowdLabel}>Crowd right now</p>
            <p className={styles.crowdValue}>
              {crowd.level?.replace(/_/g, " ")}
              {crowd.note ? ` · ${crowd.note}` : ""}
            </p>
          </div>
        </div>
      )}

      {isStudent && dashOtp && (
        <section className={`card ${styles.otpCard}`} aria-labelledby="dash-otp-title">
          <div className={styles.otpCardHead}>
            <h2 id="dash-otp-title" className={styles.sectionTitle} style={{ margin: 0 }}>
              Meal OTP
            </h2>
            <span
              className={`${styles.otpBadge} ${otpSource === "server" ? styles.otpBadgeLive : ""}`}
            >
              {otpSource === "server" ? "Mess desk valid" : "Demo random"}
            </span>
          </div>
          <span className={styles.otpDigits} aria-live="polite">
            {dashOtp}
          </span>
          <p className={styles.otpMeta}>
            {otpSource === "server" && otpMealSlot ? (
              <>
                For <strong>{String(otpMealSlot).replace(/_/g, " ").toLowerCase()}</strong> · expires in 5
                minutes · tell the incharge this code.
              </>
            ) : (
              <>
                Random 6-digit for practice. During meal hours, tap <strong>Sync mess OTP</strong> for a code
                the desk can verify.
              </>
            )}
          </p>
          {otpErr && (
            <p className={styles.otpErr} role="alert">
              {otpErr}
            </p>
          )}
          <div className={styles.otpActions}>
            <button type="button" className="btn" disabled={otpBusy} onClick={() => refreshDashboardOtp()}>
              {otpBusy ? "…" : "Sync mess OTP"}
            </button>
            <button type="button" className="btn btn-ghost" disabled={otpBusy} onClick={shuffleDemoOtp}>
              New random code
            </button>
            <Link to="/app/attendance" className="btn btn-ghost" style={{ textDecoration: "none" }}>
              Full attendance
            </Link>
          </div>
        </section>
      )}

      <h2 className={styles.sectionTitle}>Today — meals</h2>
      {!menu && (
        <div className="emptyState" role="status">
          Loading today&apos;s menu…
        </div>
      )}
      {menu && (
        <div className={styles.mealsGrid}>
          {menu.meals
            .filter((m) => m.mealSlot !== "FEAST")
            .sort(
              (a, b) =>
                MEAL_ORDER.indexOf(a.mealSlot) - MEAL_ORDER.indexOf(b.mealSlot)
            )
            .map((m) => {
            const MealIcon = MEAL_ICON[m.mealSlot] || IoRestaurantOutline;
            return (
              <div key={m.mealSlot} className={styles.mealCard}>
                <div className={styles.mealCardHead}>
                  <span className={styles.mealIconWrap} aria-hidden>
                    <MealIcon size={22} />
                  </span>
                  <h2 className={styles.mealTitle}>
                    {m.mealSlot.replace(/_/g, " ").toLowerCase()}
                  </h2>
                </div>
                {m.items.length === 0 && (
                  <p className="muted" style={{ margin: 0 }}>
                    No items listed for this meal.
                  </p>
                )}
                {m.items.map((it) => (
                  <Link
                    key={it.id + m.mealSlot}
                    to={`/app/item/${it.id}?date=${menu.date}`}
                    className={styles.itemRow}
                  >
                    <span className={styles.itemName}>{it.name}</span>
                    <span className={styles.itemKcal}>{Math.round(it.calories)} kcal</span>
                  </Link>
                ))}
              </div>
            );
          })}
        </div>
      )}

      <p className={styles.disclaimer}>
        Educational nutrition hints only — not medical advice.
      </p>
    </div>
  );
}
