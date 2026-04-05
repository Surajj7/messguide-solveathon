import React from "react";
import { NavLink, Outlet } from "react-router-dom";
import { BackLink } from "../components/BackLink.jsx";
import styles from "./MessSwapLayout.module.css";

const tabs = [
  { to: "/app/mess-swap", end: true, label: "Overview" },
  { to: "/app/mess-swap/caterer", label: "Caterer swap" },
  { to: "/app/mess-swap/upgrade", label: "Mess upgradation" },
  { to: "/app/mess-swap/history", label: "My requests" },
];

export default function MessSwapLayout() {
  return (
    <div className={`page ${styles.page}`}>
      <BackLink to="/app" />
      <header className={styles.head}>
        <h1 className={styles.title}>Mess / caterer swap</h1>
        <p className={styles.sub}>
          Change caterer within your mess line (FCFS), or request a mess type upgrade with payment proof.
        </p>
      </header>
      <nav className={styles.tabs} aria-label="Mess swap sections">
        {tabs.map((t) => (
          <NavLink
            key={t.to + (t.end ? "-i" : "")}
            to={t.to}
            end={t.end}
            className={({ isActive }) => `${styles.tab} ${isActive ? styles.tabActive : ""}`}
          >
            {t.label}
          </NavLink>
        ))}
      </nav>
      <div className={styles.outlet}>
        <Outlet />
      </div>
    </div>
  );
}
