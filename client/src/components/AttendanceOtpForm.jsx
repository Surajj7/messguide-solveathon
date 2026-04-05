import React, { useRef, useState } from "react";
import api from "../api/client.js";
import styles from "./AttendanceOtpForm.module.css";

export const MEAL_OPTIONS = [
  { value: "BREAKFAST", label: "Breakfast" },
  { value: "LUNCH", label: "Lunch" },
  { value: "SNACKS", label: "Snacks" },
  { value: "DINNER", label: "Dinner" },
];

/**
 * Meal + student name + OTP → POST /attendance/verify-otp (mess incharge or admin).
 */
export default function AttendanceOtpForm({ onVerified, title = "Mark attendance (OTP)" }) {
  const [mealSlot, setMealSlot] = useState("LUNCH");
  const [studentName, setStudentName] = useState("");
  const [otp, setOtp] = useState("");
  const otpInputRef = useRef(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setMsg("");
    const name = studentName.trim();
    const fromDom = String(otpInputRef.current?.value ?? "").replace(/\D/g, "");
    const fromState = otp.replace(/\D/g, "");
    const code = (fromDom.length >= 6 ? fromDom : fromState).slice(0, 6);
    if (!mealSlot) {
      setErr("Select the meal type.");
      return;
    }
    if (!name) {
      setErr("Enter the student’s name (as shown in their profile).");
      return;
    }
    if (code.length !== 6) {
      setErr("Enter all 6 digits of the OTP (numbers only).");
      return;
    }
    setBusy(true);
    try {
      const { data } = await api.post("/attendance/verify-otp", {
        code,
        mealSlot,
        studentName: name,
      });
      setMsg(
        `Marked present: ${data.student.name} (${data.student.email}) · ${String(data.mealSlot).replace(/_/g, " ")}`
      );
      setOtp("");
      onVerified?.();
    } catch (ex) {
      setErr(ex.response?.data?.error || ex.message || "Verification failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <h3 className={styles.title}>{title}</h3>
      <p className="muted" style={{ fontSize: "0.82rem", marginTop: 0 }}>
        Select meal, enter the student&apos;s name and their 6-digit code from the app.
      </p>
      <label className="label">Meal</label>
      <select className="input" value={mealSlot} onChange={(e) => setMealSlot(e.target.value)}>
        {MEAL_OPTIONS.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>
      <label className="label" style={{ marginTop: "0.65rem" }}>
        Student name
      </label>
      <input
        className="input"
        type="text"
        autoComplete="name"
        placeholder="e.g. Student One"
        value={studentName}
        onChange={(e) => setStudentName(e.target.value)}
      />
      <label className="label" style={{ marginTop: "0.65rem" }}>
        6-digit OTP
      </label>
      <input
        ref={otpInputRef}
        className={`input ${styles.otpInput}`}
        inputMode="numeric"
        maxLength={6}
        placeholder="000000"
        autoComplete="one-time-code"
        name="attendance-otp"
        value={otp}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, "").slice(0, 6);
          setOtp(v);
        }}
      />
      <button className="btn" type="submit" style={{ marginTop: "0.75rem" }} disabled={busy}>
        {busy ? "Verifying…" : "Verify & mark present"}
      </button>
      {msg && <p className={styles.ok}>{msg}</p>}
      {err && (
        <p className={styles.err} role="alert">
          {err}
        </p>
      )}
    </form>
  );
}
