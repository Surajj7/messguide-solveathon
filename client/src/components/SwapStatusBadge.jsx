import React from "react";
import styles from "./SwapStatusBadge.module.css";

const MAP = {
  PENDING: { className: styles.pending, label: "Pending" },
  APPROVED: { className: styles.approved, label: "Approved" },
  REJECTED: { className: styles.rejected, label: "Rejected" },
  CONFIRMED: { className: styles.confirmed, label: "Confirmed" },
  CANCELLED: { className: styles.cancelled, label: "Cancelled" },
  CLOSED: { className: styles.cancelled, label: "Closed" },
};

export default function SwapStatusBadge({ status }) {
  const key = status || "";
  const cfg = MAP[key] || { className: styles.neutral, label: String(key).replace(/_/g, " ") };
  return <span className={`${styles.badge} ${cfg.className}`}>{cfg.label}</span>;
}
