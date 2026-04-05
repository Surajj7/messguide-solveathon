import React, { useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { BackLink } from "../../components/BackLink.jsx";
import api from "../../api/client.js";
import styles from "./StudentCalendar.module.css";

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

export default function StudentCalendar() {
  const now = new Date();
  const [y, setY] = useState(now.getFullYear());
  const [m, setM] = useState(now.getMonth());
  const [selected, setSelected] = useState(now.toISOString().slice(0, 10));
  const [menu, setMenu] = useState(null);
  const [loading, setLoading] = useState(false);

  const grid = useMemo(() => {
    const firstDow = new Date(y, m, 1).getDay();
    const total = daysInMonth(y, m);
    const cells = [];
    for (let i = 0; i < firstDow; i++) {
      cells.push(null);
    }
    for (let d = 1; d <= total; d++) {
      cells.push(d);
    }
    return cells;
  }, [y, m]);

  useEffect(() => {
    setLoading(true);
    api
      .get(`/menus/day?date=${selected}`)
      .then((r) => setMenu(r.data))
      .finally(() => setLoading(false));
  }, [selected]);

  function pickDay(d) {
    const ds = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    setSelected(ds);
  }

  function prevMonth() {
    if (m === 0) {
      setM(11);
      setY((yy) => yy - 1);
    } else {
      setM((x) => x - 1);
    }
  }

  function nextMonth() {
    if (m === 11) {
      setM(0);
      setY((yy) => yy + 1);
    } else {
      setM((x) => x + 1);
    }
  }

  const dows = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="page">
      <BackLink />
      <h1>Menu calendar</h1>
      <div className={styles.nav}>
        <button type="button" className="btn-ghost btn" onClick={prevMonth}>
          ←
        </button>
        <span className={styles.month}>
          {new Date(y, m, 1).toLocaleString("default", { month: "long", year: "numeric" })}
        </span>
        <button type="button" className="btn-ghost btn" onClick={nextMonth}>
          →
        </button>
      </div>

      <div className={styles.grid}>
        {dows.map((d) => (
          <div key={d} className={styles.dow}>
            {d}
          </div>
        ))}
        {grid.map((d, i) =>
          d == null ? (
            <div key={`e-${i}`} />
          ) : (
            <button
              key={d}
              type="button"
              className={`${styles.day} ${
                selected ===
                `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`
                  ? styles.daySel
                  : ""
              }`}
              onClick={() => pickDay(d)}
            >
              {d}
            </button>
          )
        )}
      </div>

      <h2 style={{ marginTop: "1rem" }}>Menu — {selected}</h2>
      {loading && <p className="muted">Loading…</p>}
      {menu && !loading && (
        <>
          <p className="muted" style={{ fontSize: "0.85rem" }}>
            {menu.source === "date_override" ? "Date override" : "Weekly template"}
          </p>
          {menu.meals
            .filter((slot) => slot.mealSlot !== "FEAST")
            .map((slot) => (
            <div key={slot.mealSlot} className="card">
              <h2>{slot.mealSlot.replace(/_/g, " ")}</h2>
              {slot.items.map((it) => (
                <Link
                  key={it.id + slot.mealSlot}
                  to={`/app/item/${it.id}?date=${menu.date}`}
                  className={styles.link}
                >
                  {it.name} · {Math.round(it.calories)} kcal
                </Link>
              ))}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
