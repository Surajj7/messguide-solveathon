import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { IoRestaurantOutline, IoShieldCheckmarkOutline, IoSchoolOutline } from "react-icons/io5";
import { useAuth } from "../context/AuthContext.jsx";
import styles from "./LoginPage.module.css";

const ROLE = {
  student: {
    key: "student",
    label: "Student",
    sub: "Menu, AI & community",
    email: "student1@vitstudent.ac.in",
    Icon: IoSchoolOutline,
  },
  mess: {
    key: "mess",
    label: "Mess Incharge",
    sub: "Menu & operations",
    email: "mess1@messadmin.ac.in",
    Icon: IoRestaurantOutline,
  },
  admin: {
    key: "admin",
    label: "Admin",
    sub: "Wardens & directors",
    email: "admin1@vitadmin.ac.in",
    Icon: IoShieldCheckmarkOutline,
  },
};

export default function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [portal, setPortal] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("password123");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  function selectPortal(key) {
    const p = ROLE[key];
    setPortal(key);
    setEmail(p.email);
    setErr("");
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!portal) {
      setErr("Choose Student, Mess, or Admin first.");
      return;
    }
    setErr("");
    setBusy(true);
    try {
      const u = await login(email, password);
      if (u.role === "STUDENT") {
        nav("/app", { replace: true });
      } else if (u.role === "MESS_INCHARGE") {
        nav("/mess", { replace: true });
      } else {
        nav("/admin", { replace: true });
      }
    } catch (ex) {
      const apiErr = ex.response?.data?.error;
      const net =
        ex.code === "ERR_NETWORK" || ex.message === "Network Error"
          ? "Cannot reach the API. Start the backend (server: npm run dev on port 4000) and open the app via Vite (npm run dev) so requests go to /api."
          : null;
      setErr(apiErr || net || ex.message || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <Link to="/" className={styles.backHome}>
        ← Back to home
      </Link>
      <div className={styles.card}>
        <div className={styles.brand}>
          <h1 className={styles.heroTitle}>NutriGuide</h1>
          <p className={styles.tagline}>Mess menu & nutrition, simplified</p>
        </div>
        <p className={styles.sub}>
          Pick your portal, then sign in. Same password for all demo accounts:{" "}
          <code className={styles.code}>password123</code>
        </p>

        <p className={styles.sectionLabel}>Choose dashboard</p>
        <div className={styles.roleGrid} role="group" aria-label="Login portal">
          {Object.entries(ROLE).map(([key, cfg]) => {
            const Icon = cfg.Icon;
            const active = portal === key;
            return (
              <button
                key={key}
                type="button"
                className={`${styles.roleCard} ${active ? styles.roleCardActive : ""}`}
                onClick={() => selectPortal(key)}
                aria-pressed={active}
              >
                <span className={styles.roleIconWrap} aria-hidden>
                  <Icon className={styles.roleIcon} />
                </span>
                <span className={styles.roleTitle}>{cfg.label}</span>
                <span className={styles.roleSub}>{cfg.sub}</span>
              </button>
            );
          })}
        </div>

        <form onSubmit={onSubmit} className={styles.form}>
          <label className="label">Email</label>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            placeholder={portal ? undefined : "Select a portal above"}
            required
            disabled={!portal}
          />
          <label className="label" style={{ marginTop: "0.75rem" }}>
            Password
          </label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            disabled={!portal}
          />
          {err && <p className="error" style={{ marginTop: "0.5rem" }}>{err}</p>}
          <button
            className="btn"
            type="submit"
            disabled={busy || !portal}
            style={{ marginTop: "1rem", width: "100%" }}
          >
            {busy ? "Signing in…" : portal ? "Sign in" : "Select a portal"}
          </button>
        </form>
      </div>
    </div>
  );
}
