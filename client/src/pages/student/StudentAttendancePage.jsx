import React, { useEffect, useState, useMemo } from "react";
import QRCode from "react-qr-code";
import { BackLink } from "../../components/BackLink.jsx";
import api from "../../api/client.js";
import { useAuth } from "../../context/AuthContext.jsx";
import styles from "./StudentAttendancePage.module.css";

function label(s) {
  return String(s || "").replace(/_/g, " ");
}

export default function StudentAttendancePage() {
  const { user } = useAuth();
  const [today, setToday] = useState(null);
  const [otp, setOtp] = useState(null);
  const [otpExpiry, setOtpExpiry] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const qrPayload = useMemo(
    () => JSON.stringify({ sid: user?.id, v: 1 }),
    [user?.id]
  );

  function load() {
    api.get("/attendance/today").then((r) => setToday(r.data)).catch(() => setToday(null));
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!otpExpiry) return;
    const t = setInterval(() => {
      if (new Date() >= new Date(otpExpiry)) {
        setOtp(null);
        setOtpExpiry(null);
      }
    }, 1000);
    return () => clearInterval(t);
  }, [otpExpiry]);

  async function genOtp() {
    setErr("");
    setBusy(true);
    try {
      const { data } = await api.post("/attendance/generate-otp", {});
      setOtp(data.code);
      setOtpExpiry(data.expiresAt);
      load();
    } catch (e) {
      setErr(e.response?.data?.error || e.message || "Could not generate OTP");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`page ${styles.page}`}>
      <BackLink to="/app" />
      <h1 className={styles.title}>Meal attendance</h1>
      <p className="muted" style={{ fontSize: "0.9rem", marginTop: 0 }}>
        Show your QR at the mess desk, or generate a <strong>6-digit OTP</strong> (valid 5 minutes) and
        dictate it to the incharge.
      </p>

      {today && (
        <div className={styles.banner}>
          <span>
            Approx. missed streak: <strong>{today.missedStreak}</strong> ended meals
          </span>
          {today.currentMeal && (
            <span className={styles.pill}>Active meal: {label(today.currentMeal)}</span>
          )}
        </div>
      )}

      <div className={styles.grid}>
        <div className={`card ${styles.card}`}>
          <h2 className={styles.h2}>Your QR</h2>
          <p className="muted" style={{ fontSize: "0.82rem", marginTop: 0 }}>
            Mess staff scans this to mark you present for the <strong>current</strong> meal window.
          </p>
          {user?.id && (
            <div className={styles.qrBox}>
              <QRCode value={qrPayload} size={200} level="M" />
            </div>
          )}
        </div>

        <div className={`card ${styles.card}`}>
          <h2 className={styles.h2}>OTP for incharge</h2>
          <button type="button" className="btn" onClick={genOtp} disabled={busy}>
            {busy ? "Generating…" : "Generate 6-digit OTP"}
          </button>
          {err && (
            <p className={styles.err} role="alert">
              {err}
            </p>
          )}
          {otp && (
            <div className={styles.otpShow}>
              <span className={styles.otpDigits}>{otp}</span>
              <p className="muted" style={{ fontSize: "0.8rem", margin: "0.35rem 0 0" }}>
                Expires in 5 minutes. One active OTP per meal.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className={`card ${styles.card}`}>
        <h2 className={styles.h2}>Today&apos;s meals</h2>
        {!today && <p className="muted">Loading…</p>}
        {today && (
          <ul className={styles.slotList}>
            {today.slots.map((s) => (
              <li key={s.mealSlot} className={styles.slotRow}>
                <span className={styles.slotName}>{label(s.mealSlot)}</span>
                {s.status ? (
                  <span
                    className={
                      s.status === "PRESENT" ? styles.tagOk : styles.tagBad
                    }
                  >
                    {label(s.status)}
                    {s.method ? ` · ${label(s.method)}` : ""}
                  </span>
                ) : (
                  <span className={styles.tagPending}>Not marked</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
