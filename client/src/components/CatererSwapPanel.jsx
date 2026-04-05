import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import styles from "../pages/student/CatererSwapPage.module.css";

function labelEnum(s) {
  return String(s || "").replace(/_/g, " ");
}

/**
 * @param {{ variant?: "page" | "dashboard" }} props
 */
export default function CatererSwapPanel({ variant = "page" }) {
  const { user, refreshProfile } = useAuth();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [msg, setMsg] = useState("");
  const [pendingUpgrade, setPendingUpgrade] = useState(false);

  const isDashboard = variant === "dashboard";

  function formatLoadError(e) {
    const d = e.response?.data;
    if (d && typeof d === "object") {
      const parts = [d.error, d.hint].filter(Boolean);
      if (parts.length) return parts.join(" ");
    }
    return e.response?.data?.error || e.message || "Failed to load";
  }

  function load() {
    setErr("");
    Promise.all([api.get("/mess-swap/options/eligible"), api.get("/mess-swap/upgrade/my")])
      .then(([optRes, upRes]) => {
        setData(optRes.data);
        setPendingUpgrade((upRes.data || []).some((x) => x.status === "PENDING"));
      })
      .catch((e) => setErr(formatLoadError(e)));
  }

  useEffect(() => {
    if (user?.role !== "STUDENT") return;
    load();
    const onVis = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [user?.role]);

  async function apply(optionId) {
    setErr("");
    setMsg("");
    setBusyId(optionId);
    try {
      await api.post("/mess-swap/caterer/apply", { optionId });
      setMsg("Swap confirmed — your caterer has been updated.");
      await refreshProfile();
      load();
    } catch (e) {
      setErr(e.response?.data?.error || e.message || "Apply failed");
    } finally {
      setBusyId(null);
    }
  }

  if (user?.role !== "STUDENT") return null;

  return (
    <div>
      {pendingUpgrade && (
        <div className={`card ${styles.empty}`} style={{ marginBottom: "0.85rem", borderColor: "var(--border)" }}>
          <p style={{ margin: 0, fontSize: "0.88rem" }}>
            You have a <strong>pending mess upgradation</strong> request. Caterer swaps stay disabled until an
            admin approves or rejects it. Check{" "}
            <Link to="/app/mess-swap/history" style={{ fontWeight: 700 }}>
              My requests
            </Link>
            .
          </p>
        </div>
      )}
      {err && (
        <p className={styles.err} role="alert">
          {err}
        </p>
      )}
      {msg && <p className={styles.ok}>{msg}</p>}

      {!data && !err && <p className="muted">{isDashboard ? "Loading swap options…" : "Loading…"}</p>}

      {!isDashboard && data?.profile && (
        <div className={styles.current}>
          <div>
            <span className={styles.mutedLabel}>Current mess type</span>
            <strong>{labelEnum(data.profile.messType)}</strong>
          </div>
          <div>
            <span className={styles.mutedLabel}>Current caterer</span>
            <strong>{labelEnum(data.profile.caterer)}</strong>
          </div>
          {data.profile.registrationNo && (
            <div>
              <span className={styles.mutedLabel}>Registration no.</span>
              <strong>{data.profile.registrationNo}</strong>
            </div>
          )}
        </div>
      )}

      {isDashboard && data?.profile && (
        <p className="muted" style={{ margin: "0 0 0.75rem", fontSize: "0.85rem" }}>
          <strong>{labelEnum(data.profile.messType)}</strong> line · caterer{" "}
          <strong>{labelEnum(data.profile.caterer)}</strong>
        </p>
      )}

      {data?.options?.length === 0 && (
        <div className={`card ${styles.empty}`}>
          <p style={{ margin: 0 }}>
            No open caterer swaps for your mess line right now. Check again later or ask the admin to add
            slots.
          </p>
        </div>
      )}

      <ul className={styles.list}>
        {(data?.options || []).map((opt) => {
          const low = opt.slotsLeft > 0 && opt.slotsLeft <= 2;
          const full = opt.slotsLeft <= 0;
          return (
            <li key={opt.id} className={`card ${styles.optionCard}`}>
              <div className={styles.optionTop}>
                <div>
                  <p className={styles.swapLine}>
                    {labelEnum(opt.fromCaterer)} → {labelEnum(opt.toCaterer)}
                  </p>
                  <p className="muted" style={{ margin: "0.25rem 0 0", fontSize: "0.8rem" }}>
                    Same mess type: {labelEnum(opt.messType)}
                  </p>
                </div>
                <div className={styles.slotPill}>
                  <span className={styles.slotNum}>{opt.slotsLeft}</span>
                  <span className={styles.slotLab}>slots left</span>
                </div>
              </div>
              <p className={styles.slotMeta}>
                {opt.slotsUsed} / {opt.totalSlots} filled · FCFS
              </p>
              {low && !full && (
                <p className={styles.warn}>
                  Only {opt.slotsLeft} slot{opt.slotsLeft === 1 ? "" : "s"} left
                </p>
              )}
              <button
                type="button"
                className="btn"
                disabled={full || busyId === opt.id || pendingUpgrade}
                onClick={() => apply(opt.id)}
                style={{ marginTop: "0.75rem" }}
              >
                {pendingUpgrade
                  ? "Blocked — pending upgrade"
                  : full
                    ? "No slots left"
                    : busyId === opt.id
                      ? "Applying…"
                      : `Choose ${labelEnum(opt.toCaterer)}`}
              </button>
            </li>
          );
        })}
      </ul>

      {isDashboard && (
        <p style={{ margin: "1rem 0 0" }}>
          <Link to="/app/mess-swap/caterer" className="muted" style={{ fontSize: "0.88rem", fontWeight: 600 }}>
            Full caterer swap page →
          </Link>
        </p>
      )}
    </div>
  );
}
