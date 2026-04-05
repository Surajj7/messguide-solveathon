import React, { useEffect, useState } from "react";
import api from "../../api/client.js";
import SwapStatusBadge from "../../components/SwapStatusBadge.jsx";
import styles from "./MessSwapHistoryPage.module.css";

function labelEnum(s) {
  return String(s || "").replace(/_/g, " ");
}

export default function MessSwapHistoryPage() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/mess-swap/history").then((r) => setData(r.data));
  }, []);

  if (!data) {
    return <p className="muted">Loading…</p>;
  }

  return (
    <div>
      <h2 className={styles.h2}>My requests</h2>
      <p className="muted" style={{ fontSize: "0.88rem", marginTop: 0 }}>
        Caterer swaps are confirmed instantly. Mess upgrades stay pending until an admin decides.
      </p>

      <section className={styles.section}>
        <h3 className={styles.secTitle}>Caterer swaps</h3>
        {data.catererSwaps.length === 0 && <p className="muted">No caterer swap history yet.</p>}
        <ul className={styles.list}>
          {data.catererSwaps.map((r) => (
            <li key={r.id} className={`card ${styles.card}`}>
              <div className={styles.row}>
                <SwapStatusBadge status={r.status} />
                <span className={styles.date}>{new Date(r.createdAt).toLocaleString()}</span>
              </div>
              <p className={styles.main}>
                {labelEnum(r.fromCatererSnapshot)} → {labelEnum(r.toCatererSnapshot)}
              </p>
              <p className="muted" style={{ margin: "0.25rem 0 0", fontSize: "0.82rem" }}>
                Mess line: {labelEnum(r.messTypeSnapshot)}
              </p>
              {r.adminNote && (
                <p className={styles.remark}>
                  <strong>Admin note:</strong> {r.adminNote}
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section}>
        <h3 className={styles.secTitle}>Mess upgradation</h3>
        {data.messUpgrades.length === 0 && <p className="muted">No mess upgrade requests yet.</p>}
        <ul className={styles.list}>
          {data.messUpgrades.map((r) => (
            <li key={r.id} className={`card ${styles.card}`}>
              <div className={styles.row}>
                <SwapStatusBadge status={r.status} />
                <span className={styles.date}>{new Date(r.createdAt).toLocaleString()}</span>
              </div>
              <p className={styles.main}>Request upgrade to {labelEnum(r.targetMessType)}</p>
              <p className="muted" style={{ margin: "0.25rem 0 0", fontSize: "0.82rem" }}>
                Payment ID: <code className={styles.code}>{r.paymentId}</code>
              </p>
              {r.assignedCaterer && r.status === "APPROVED" && (
                <p className="muted" style={{ margin: "0.2rem 0 0", fontSize: "0.82rem" }}>
                  Assigned caterer: {labelEnum(r.assignedCaterer)}
                </p>
              )}
              {r.adminRemarks && (
                <p className={styles.remark}>
                  <strong>Admin remarks:</strong> {r.adminRemarks}
                </p>
              )}
              {r.reviewedBy && (
                <p className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.78rem" }}>
                  Reviewed by {r.reviewedBy.name}
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
