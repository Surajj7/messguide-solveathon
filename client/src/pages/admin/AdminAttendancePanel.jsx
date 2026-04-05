import React, { useEffect, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import api from "../../api/client.js";
import AttendanceOtpForm from "../../components/AttendanceOtpForm.jsx";
import styles from "./AdminAttendancePanel.module.css";

const COLORS = ["#2d6a4f", "#c62828", "#78909c"];

export default function AdminAttendancePanel() {
  const [summary, setSummary] = useState(null);
  const [trend, setTrend] = useState([]);

  function reloadStats() {
    api.get("/attendance/admin/summary").then((r) => setSummary(r.data));
    api.get("/attendance/admin/trend").then((r) => setTrend(r.data.points || []));
  }

  useEffect(() => {
    reloadStats();
  }, []);

  let pieSafe = [{ name: "No data", value: 1 }];
  if (summary) {
    const pie = [
      { name: "Present marks", value: Math.max(0, summary.presentMarksToday) },
      { name: "Absent marks", value: Math.max(0, summary.absentMarksToday) },
    ];
    const rest = Math.max(
      0,
      summary.activeStudents * 4 - summary.presentMarksToday - summary.absentMarksToday
    );
    if (rest > 0) {
      pie.push({ name: "No record yet", value: rest });
    }
    pieSafe = pie.some((p) => p.value > 0) ? pie : [{ name: "No data", value: 1 }];
  }

  return (
    <div className={styles.root}>
      <div className={`card ${styles.otpCard}`}>
        <AttendanceOtpForm onVerified={reloadStats} title="Mark attendance (OTP)" />
      </div>

      {!summary && (
        <p className="muted" style={{ marginTop: "1rem" }}>
          Loading charts…
        </p>
      )}

      {summary && (
        <>
          <div className={styles.statRow}>
            <div className={styles.stat}>
              <span className={styles.lab}>Students</span>
              <strong>{summary.activeStudents}</strong>
            </div>
            <div className={styles.stat}>
              <span className={styles.lab}>Present today</span>
              <strong>{summary.presentMarksToday}</strong>
            </div>
            <div className={styles.stat}>
              <span className={styles.lab}>Absent today</span>
              <strong>{summary.absentMarksToday}</strong>
            </div>
            <div className={styles.stat}>
              <span className={styles.lab}>At-risk (4+ streak)</span>
              <strong>{summary.atRisk?.length ?? 0}</strong>
            </div>
          </div>

          <div className={styles.charts}>
            <div className={`card ${styles.chart}`}>
              <h3 style={{ marginTop: 0 }}>Today&apos;s attendance records</h3>
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieSafe} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={88} label>
                      {pieSafe.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className={`card ${styles.chart}`}>
              <h3 style={{ marginTop: 0 }}>7-day trend (marks)</h3>
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Line type="monotone" dataKey="PRESENT" name="Present" stroke="#2d6a4f" strokeWidth={2} />
                    <Line type="monotone" dataKey="ABSENT" name="Absent" stroke="#c62828" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className={`card ${styles.risk}`}>
            <h3 style={{ marginTop: 0 }}>Students at risk</h3>
            {summary.atRisk.length === 0 && <p className="muted">None flagged right now.</p>}
            <ul className={styles.riskList}>
              {summary.atRisk.map((s) => (
                <li key={s.id}>
                  <strong>{s.name}</strong> · {s.email} · reg {s.registrationNo || "—"} · streak ~{s.streak}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
