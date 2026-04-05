import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client.js";
import { useAuth } from "../../context/AuthContext.jsx";
import DummyPaymentQR from "../../components/DummyPaymentQR.jsx";
import styles from "./MessUpgradePage.module.css";

const ALL_MESS = ["VEG", "NON_VEG", "SPECIAL"];

function labelEnum(s) {
  return String(s || "").replace(/_/g, " ");
}

export default function MessUpgradePage() {
  const { profile, refreshProfile } = useAuth();
  const [target, setTarget] = useState("");
  const [paymentId, setPaymentId] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [pending, setPending] = useState(null);

  useEffect(() => {
    api
      .get("/mess-swap/upgrade/my")
      .then((r) => {
        const p = (r.data || []).find((x) => x.status === "PENDING");
        setPending(p || null);
      })
      .catch(() => setPending(null));
  }, [ok]);

  const choices = useMemo(
    () => ALL_MESS.filter((m) => m !== profile?.messType),
    [profile?.messType]
  );

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setOk("");
    if (!target) {
      setErr("Select the mess type you want to upgrade to.");
      return;
    }
    if (!paymentId.trim()) {
      setErr("Payment / transaction ID is required.");
      return;
    }
    try {
      await api.post("/mess-swap/upgrade", {
        targetMessType: target,
        paymentId: paymentId.trim(),
      });
      setOk("Request submitted. Admin will review it — check My requests for status.");
      setPaymentId("");
      setTarget("");
      refreshProfile();
    } catch (ex) {
      setErr(ex.response?.data?.error || ex.message || "Submit failed");
    }
  }

  return (
    <div>
      <h2 className={styles.h2}>Mess upgradation</h2>
      <p className="muted" style={{ fontSize: "0.88rem", marginTop: 0 }}>
        Request a <strong>different mess type</strong>. Complete payment (per institute rules), enter your
        transaction ID, and wait for admin approval. Your allocation stays the same until approved.
      </p>

      {pending && (
        <div className="card" style={{ marginBottom: "1rem", padding: "0.9rem 1rem" }}>
          <p style={{ margin: 0, fontSize: "0.9rem" }}>
            You already have a <strong>pending</strong> mess upgradation to{" "}
            <strong>{labelEnum(pending.targetMessType)}</strong>. Submitting again is blocked until an admin
            decides. Track status under{" "}
            <Link to="/app/mess-swap/history" style={{ fontWeight: 700 }}>
              My requests
            </Link>
            .
          </p>
        </div>
      )}

      <div className={styles.split}>
        <form className={`card ${styles.form}`} onSubmit={submit}>
          <h3 className={styles.formTitle}>Request form</h3>
          {profile && (
            <p className={styles.currentLine}>
              Current: <strong>{labelEnum(profile.messType)}</strong> ·{" "}
              <strong>{labelEnum(profile.caterer)}</strong>
            </p>
          )}
          <label className="label">Upgrade to mess type</label>
          <select
            className="input"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            required
            disabled={Boolean(pending)}
          >
            <option value="">— Select —</option>
            {choices.map((m) => (
              <option key={m} value={m}>
                {labelEnum(m)}
              </option>
            ))}
          </select>
          <label className="label" style={{ marginTop: "0.65rem" }}>
            Payment / transaction ID
          </label>
          <input
            className="input"
            value={paymentId}
            onChange={(e) => setPaymentId(e.target.value)}
            placeholder="e.g. UPI ref or receipt ID"
            required
            disabled={Boolean(pending)}
          />
          <p className={styles.hint}>
            Complete payment using the QR on the right (demo), then paste the ID from your receipt or bank
            app.
          </p>
          {err && (
            <p className={styles.err} role="alert">
              {err}
            </p>
          )}
          {ok && <p className={styles.ok}>{ok}</p>}
          <button className="btn" type="submit" style={{ marginTop: "0.75rem" }} disabled={Boolean(pending)}>
            {pending ? "Already pending — wait for admin" : "Submit request"}
          </button>
        </form>
        <DummyPaymentQR title="Mess upgrade fee (demo)" />
      </div>
    </div>
  );
}
