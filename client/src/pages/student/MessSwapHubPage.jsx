import React from "react";
import { Link } from "react-router-dom";
import { IoSwapHorizontal, IoTrendingUp, IoTimeOutline, IoShieldCheckmarkOutline } from "react-icons/io5";
import styles from "./MessSwapHubPage.module.css";

const cards = [
  {
    to: "/app/mess-swap/caterer",
    icon: IoSwapHorizontal,
    title: "Caterer swap",
    accent: styles.cardGreen,
    body: "Same mess type (Veg / Non-veg / Special). Only the caterer changes — e.g. Zenith → SRRC. First come, first served while slots last.",
    cta: "View options",
  },
  {
    to: "/app/mess-swap/upgrade",
    icon: IoTrendingUp,
    title: "Mess upgradation",
    accent: styles.cardTeal,
    body: "Request a different mess type. Pay using the demo QR, enter your transaction ID, and wait for admin approval.",
    cta: "Start request",
  },
];

export default function MessSwapHubPage() {
  return (
    <div>
      <div className={styles.grid}>
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Link key={c.to} to={c.to} className={`${styles.card} ${c.accent}`}>
              <span className={styles.iconWrap} aria-hidden>
                <Icon size={28} />
              </span>
              <h2 className={styles.cardTitle}>{c.title}</h2>
              <p className={styles.cardBody}>{c.body}</p>
              <span className={styles.cta}>{c.cta} →</span>
            </Link>
          );
        })}
      </div>
      <div className={styles.infoRow}>
        <div className={styles.info}>
          <IoTimeOutline size={22} className={styles.infoIcon} aria-hidden />
          <div>
            <strong>FCFS caterer swaps</strong>
            <p className="muted" style={{ margin: "0.2rem 0 0", fontSize: "0.85rem" }}>
              Slots are reserved instantly when you apply — no double booking under load.
            </p>
          </div>
        </div>
        <div className={styles.info}>
          <IoShieldCheckmarkOutline size={22} className={styles.infoIcon} aria-hidden />
          <div>
            <strong>Admin-reviewed upgrades</strong>
            <p className="muted" style={{ margin: "0.2rem 0 0", fontSize: "0.85rem" }}>
              Mess type changes need payment proof and warden/admin approval.
            </p>
          </div>
        </div>
      </div>
      <p className="muted" style={{ fontSize: "0.85rem", marginTop: "1.25rem" }}>
        Track everything under <Link to="/app/mess-swap/history">My requests</Link>.
      </p>
    </div>
  );
}
