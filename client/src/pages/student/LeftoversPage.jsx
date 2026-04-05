import React, { useEffect, useMemo, useState } from "react";
import { BackLink } from "../../components/BackLink.jsx";
import api from "../../api/client.js";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import styles from "./LeftoversPage.module.css";

export default function LeftoversPage() {
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 45);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState([]);
  const [tracked, setTracked] = useState([]);
  const [vizId, setVizId] = useState("");
  const [series, setSeries] = useState(null);

  useEffect(() => {
    const q = `from=${from}&to=${to}`;
    api.get(`/leftovers?${q}`).then((r) => setRows(r.data));
    api.get(`/leftovers/tracked-items?${q}`).then((r) => setTracked(r.data));
  }, [from, to]);

  useEffect(() => {
    if (!vizId) {
      setSeries(null);
      return;
    }
    api.get(`/leftovers/series?menuItemId=${vizId}&from=${from}&to=${to}`).then((r) => setSeries(r.data));
  }, [vizId, from, to]);

  const chartData = useMemo(
    () =>
      (series?.points || []).map((p) => ({
        date: p.date,
        qty: p.quantity,
      })),
    [series]
  );

  return (
    <div className="page">
      <BackLink />
      <h1>Leftovers &amp; surplus</h1>
      <p className="muted">
        Estimated surplus logged by mess for your mess line. You can’t edit this — it helps you see
        patterns over time.
      </p>

      <div className={`card ${styles.filters}`}>
        <div>
          <label className="label">From</label>
          <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="label">To</label>
          <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      <section className="card">
        <h2>Trend for a dish</h2>
        <label className="label">Choose a dish</label>
        <select className="input" value={vizId} onChange={(e) => setVizId(e.target.value)}>
          <option value="">— Select —</option>
          {tracked.map((t) => (
            <option key={t.menuItemId} value={t.menuItemId}>
              {t.itemName}
            </option>
          ))}
        </select>
        {vizId && chartData.length > 0 && (
          <div className={styles.chartWrap}>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} angle={-25} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="qty"
                  name={`Quantity (${series?.unit || ""})`}
                  stroke="var(--accent, #2d6a4f)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        {vizId && chartData.length === 0 && <p className="muted">No points in this range.</p>}
      </section>

      <section className="card">
        <h2>Log (read-only)</h2>
        <div style={{ overflowX: "auto" }}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Meal</th>
                <th>Item</th>
                <th>Qty</th>
                <th>Unit</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{String(row.entryDate).slice(0, 10)}</td>
                  <td>{row.mealSlot}</td>
                  <td>{row.itemName}</td>
                  <td>{row.quantity}</td>
                  <td>{row.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && <p className="muted">Nothing logged in this period yet.</p>}
      </section>
    </div>
  );
}
