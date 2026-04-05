import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";
import api from "../../api/client.js";
import { BackLink } from "../../components/BackLink.jsx";
import styles from "./CalorieTrackerPage.module.css";

const CHART_COLORS = ["#2d6a4f", "#40916c", "#52b788", "#74c69d", "#95d5b2", "#b7e4c7"];

export default function CalorieTrackerPage() {
  const [summary, setSummary] = useState(null);
  const [dayData, setDayData] = useState(null);
  const [logDate, setLogDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [kcalInput, setKcalInput] = useState("");
  const [labelInput, setLabelInput] = useState("");
  const [menuDay, setMenuDay] = useState(null);
  const [busy, setBusy] = useState(false);
  /** Keys like `${itemId}-${mealSlot}` for multi-dish selection */
  const [selectedKeys, setSelectedKeys] = useState([]);

  const flatMenuItems = useMemo(() => {
    if (!menuDay?.meals) return [];
    const out = [];
    for (const m of menuDay.meals) {
      for (const it of m.items || []) {
        out.push({
          key: `${it.id}-${m.mealSlot}`,
          id: it.id,
          name: it.name,
          calories: it.calories,
          mealSlot: m.mealSlot,
        });
      }
    }
    return out;
  }, [menuDay]);

  function load() {
    api.get("/calories/summary?days=14").then((r) => setSummary(r.data));
    api.get(`/calories/entries?date=${logDate}`).then((r) => setDayData(r.data));
  }

  useEffect(() => {
    load();
  }, [logDate]);

  useEffect(() => {
    api.get(`/menus/day?date=${logDate}`).then((r) => setMenuDay(r.data)).catch(() => setMenuDay(null));
    setSelectedKeys([]);
  }, [logDate]);

  function toggleDishKey(key) {
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  const selectedPreview = useMemo(() => {
    const rows = selectedKeys
      .map((key) => flatMenuItems.find((x) => x.key === key))
      .filter(Boolean);
    const total = rows.reduce((s, r) => s + Number(r.calories || 0), 0);
    return { rows, total: Math.round(total) };
  }, [selectedKeys, flatMenuItems]);

  async function addSelectedDishes() {
    if (selectedPreview.rows.length === 0) return;
    const items = selectedPreview.rows.map((p) => ({
      menuItemId: p.id,
      calories: p.calories,
      label: `${p.name} (${p.mealSlot.replace(/_/g, " ")})`,
    }));
    setBusy(true);
    try {
      await api.post("/calories/batch", { logDate, items });
      setSelectedKeys([]);
      load();
    } finally {
      setBusy(false);
    }
  }

  async function addEntry(e) {
    e.preventDefault();
    const calories = Number(kcalInput);
    const label = labelInput.trim();

    if (!Number.isFinite(calories) || calories <= 0) return;
    setBusy(true);
    try {
      await api.post("/calories", {
        logDate,
        calories,
        label: label || null,
        menuItemId: null,
      });
      setKcalInput("");
      setLabelInput("");
      load();
    } finally {
      setBusy(false);
    }
  }

  async function removeEntry(id) {
    await api.delete(`/calories/${id}`);
    load();
  }

  const chartData =
    summary?.daily?.map((d) => ({
      ...d,
      short: d.date.slice(5),
    })) || [];

  const pieData =
    dayData?.entries?.map((e, i) => ({
      name: `${e.label || e.menuItem?.name || "Meal"} (${i + 1})`,
      value: Math.round(e.calories),
    })) || [];

  const goal = summary?.goalKcal ?? 2200;
  const todayStr = new Date().toISOString().slice(0, 10);
  const isToday = logDate === todayStr;

  return (
    <div className="page">
      <BackLink to="/app" />
      <header className={styles.head}>
        <h1>Calorie tracker</h1>
        <p className="muted">
          Daily target (from your health goal): <strong>{goal} kcal</strong>
        </p>
      </header>

      <section className="card">
        <h2>Last 14 days</h2>
        {summary && (
          <p className="muted" style={{ fontSize: "0.88rem", marginTop: 0 }}>
            7-day average: <strong>{summary.avg7d} kcal</strong>
          </p>
        )}
        <div className={styles.chartWrap}>
          {chartData.length > 0 && (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <XAxis dataKey="short" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} width={36} />
                <Tooltip
                  formatter={(v) => [`${v} kcal`, "Total"]}
                  labelFormatter={(l) => `Date ${l}`}
                />
                <ReferenceLine
                  y={goal}
                  stroke="#94a3b8"
                  strokeDasharray="4 4"
                  label={{ value: "Goal", position: "right", fill: "#64748b", fontSize: 11 }}
                />
                <Bar dataKey="total" radius={[4, 4, 0, 0]} fill="#2d6a4f" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <section className="card">
        <h2>Log meals</h2>
        <label className={styles.label}>Date</label>
        <input
          className="input"
          type="date"
          value={logDate}
          onChange={(e) => setLogDate(e.target.value)}
        />

        {menuDay?.meals?.some((m) => (m.items || []).length > 0) && (
          <>
            <label className={styles.label}>Add dishes from menu (pick several for one meal)</label>
            <p className="muted" style={{ fontSize: "0.82rem", margin: "0 0 0.5rem" }}>
              Tick everything you ate, then add all at once.
            </p>
            <div className={styles.mealGroups}>
              {menuDay.meals
                .filter((m) => m.mealSlot !== "FEAST")
                .map((meal) =>
                  (meal.items || []).length === 0 ? null : (
                    <div key={meal.mealSlot} className={styles.mealGroup}>
                      <div className={styles.mealTitle}>
                        {meal.mealSlot.replace(/_/g, " ").toLowerCase()}
                      </div>
                      <ul className={styles.dishList}>
                        {meal.items.map((it) => {
                          const key = `${it.id}-${meal.mealSlot}`;
                          const checked = selectedKeys.includes(key);
                          return (
                            <li key={key}>
                              <label className={styles.dishRow}>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleDishKey(key)}
                                />
                                <span className={styles.dishName}>{it.name}</span>
                                <span className={styles.dishKcal}>{Math.round(it.calories)} kcal</span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )
                )}
            </div>
            <div className={styles.batchBar}>
              <span className="muted">
                {selectedPreview.rows.length} dish
                {selectedPreview.rows.length !== 1 ? "es" : ""} ·{" "}
                <strong>{selectedPreview.total} kcal</strong>
              </span>
              <button
                type="button"
                className="btn"
                disabled={busy || selectedPreview.rows.length === 0}
                onClick={addSelectedDishes}
              >
                {busy ? "Saving…" : "Add selected to log"}
              </button>
            </div>
          </>
        )}

        <form onSubmit={addEntry} className={styles.form}>
          <label className={styles.label}>Or add custom calories (kcal)</label>
          <input
            className="input"
            type="number"
            min={1}
            max={5000}
            step={1}
            placeholder="e.g. 450"
            value={kcalInput}
            onChange={(e) => setKcalInput(e.target.value)}
            required
          />
          <label className={styles.label}>Label (optional)</label>
          <input
            className="input"
            placeholder="e.g. Lunch plate"
            value={labelInput}
            onChange={(e) => setLabelInput(e.target.value)}
          />
          <button className="btn" type="submit" disabled={busy}>
            {busy ? "Saving…" : "Add to log"}
          </button>
        </form>
      </section>

      <section className="card">
        <h2>
          {isToday ? "Today" : logDate} · {dayData?.dayTotal ?? 0} / {goal} kcal
        </h2>
        {dayData && dayData.entries.length === 0 && (
          <p className="muted">Nothing logged for this day yet.</p>
        )}
        {dayData && dayData.entries.length > 0 && (
          <>
            <ul className={styles.entries}>
              {dayData.entries.map((e) => (
                <li key={e.id} className={styles.entryRow}>
                  <div>
                    <strong>{Math.round(e.calories)} kcal</strong>
                    <span className="muted">
                      {" "}
                      — {e.label || e.menuItem?.name || "Entry"}
                    </span>
                  </div>
                  <button
                    type="button"
                    className={styles.remove}
                    onClick={() => removeEntry(e.id)}
                    aria-label="Remove"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
            {pieData.length > 1 && (
              <div className={styles.pieWrap}>
                <h3 className={styles.pieTitle}>Today&apos;s split</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => `${v} kcal`} />
                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </section>

      <p className="muted" style={{ fontSize: "0.85rem" }}>
        Estimates are based on mess nutrition data. For medical advice, speak to a professional.{" "}
        <Link to="/app/profile">Health goal</Link> sets your target line.
      </p>
    </div>
  );
}
