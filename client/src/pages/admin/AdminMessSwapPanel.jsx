import React, { useCallback, useEffect, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import api from "../../api/client.js";
import SwapStatusBadge from "../../components/SwapStatusBadge.jsx";
import styles from "./AdminMessSwapPanel.module.css";

const MESS_TYPES = ["VEG", "NON_VEG", "SPECIAL"];
const CATERERS = [
  "ZENITH",
  "SRRC",
  "GRACE",
  "RASSENCE",
  "PROODLE",
  "FUSION",
];

function label(s) {
  return String(s || "").replace(/_/g, " ");
}

const PIE_COLORS = ["#2d6a4f", "#95d5b2", "#e0e0e0"];

export default function AdminMessSwapPanel() {
  const [sub, setSub] = useState("overview");
  const [stats, setStats] = useState(null);
  const [options, setOptions] = useState([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsErr, setOptionsErr] = useState("");
  const [catererReqs, setCatererReqs] = useState([]);
  const [upgrades, setUpgrades] = useState([]);
  const [filters, setFilters] = useState({
    q: "",
    registrationNo: "",
    messType: "",
    status: "",
    requestType: "ALL",
    from: "",
    to: "",
  });
  const [newOpt, setNewOpt] = useState({
    messType: "VEG",
    fromCaterer: "ZENITH",
    toCaterer: "SRRC",
    totalSlots: 10,
  });
  const [busy, setBusy] = useState(false);
  const [approveId, setApproveId] = useState(null);
  const [approveCaterer, setApproveCaterer] = useState("ZENITH");
  const [approveRemarks, setApproveRemarks] = useState("");

  const loadStats = useCallback(() => {
    api.get("/admin/mess-swap/stats").then((r) => setStats(r.data));
  }, []);

  const loadOptions = useCallback(async () => {
    setOptionsErr("");
    setOptionsLoading(true);
    const normalize = (data) => (Array.isArray(data) ? data : []);
    const formatErr = (e) => {
      const d = e.response?.data;
      if (d && typeof d === "object" && d.hint) {
        return `${d.error || "Could not load options"}. ${d.hint}`;
      }
      return d?.error || e.message || "Could not load options";
    };
    try {
      try {
        const r = await api.get("/admin/mess-swap/options");
        setOptions(normalize(r.data));
      } catch (first) {
        if (first.response?.status === 404) {
          const r2 = await api.get("/mess-swap/admin/options");
          setOptions(normalize(r2.data));
        } else {
          throw first;
        }
      }
    } catch (e) {
      setOptions([]);
      setOptionsErr(formatErr(e));
    } finally {
      setOptionsLoading(false);
    }
  }, []);

  const qs = useCallback(() => {
    const p = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v) p.set(k, v);
    });
    return p.toString();
  }, [filters]);

  const loadCaterer = useCallback(() => {
    api.get(`/admin/mess-swap/caterer-requests?${qs()}`).then((r) => setCatererReqs(r.data));
  }, [qs]);

  const loadUpgrades = useCallback(() => {
    api.get(`/admin/mess-swap/upgrade-requests?${qs()}`).then((r) => setUpgrades(r.data));
  }, [qs]);

  useEffect(() => {
    if (sub === "overview") loadStats();
  }, [sub, loadStats]);

  useEffect(() => {
    if (sub === "options") loadOptions();
  }, [sub, loadOptions]);

  useEffect(() => {
    if (sub === "caterer") loadCaterer();
  }, [sub, loadCaterer]);

  useEffect(() => {
    if (sub === "upgrade") loadUpgrades();
  }, [sub, loadUpgrades]);

  async function createOption(e) {
    e.preventDefault();
    setBusy(true);
    const payload = { ...newOpt, totalSlots: Number(newOpt.totalSlots) };
    try {
      try {
        await api.post("/admin/mess-swap/options", payload);
      } catch (err) {
        if (err.response?.status === 404) {
          await api.post("/mess-swap/admin/options", payload);
        } else {
          throw err;
        }
      }
      loadOptions();
      loadStats();
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    } finally {
      setBusy(false);
    }
  }

  async function patchOption(id, body) {
    try {
      try {
        await api.patch(`/admin/mess-swap/options/${id}`, body);
      } catch (err) {
        if (err.response?.status === 404) {
          await api.patch(`/mess-swap/admin/options/${id}`, body);
        } else {
          throw err;
        }
      }
      loadOptions();
      loadStats();
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
  }

  async function cancelSwap(id) {
    const note = window.prompt("Optional note for student (reversal):", "") ?? "";
    if (note === null) return;
    try {
      await api.patch(`/admin/mess-swap/caterer-requests/${id}/cancel`, { adminNote: note });
      loadCaterer();
      loadStats();
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
  }

  async function reviewUpgrade(id, status) {
    setBusy(true);
    try {
      await api.patch(`/admin/mess-swap/upgrade-requests/${id}`, {
        status,
        assignedCaterer: status === "APPROVED" ? approveCaterer : undefined,
        adminRemarks: approveRemarks.trim() || undefined,
      });
      setApproveId(null);
      setApproveRemarks("");
      loadUpgrades();
      loadStats();
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    } finally {
      setBusy(false);
    }
  }

  const pieData =
    stats && stats.totalSlotCapacity > 0
      ? [
          { name: "Slots used", value: stats.slotsUsed },
          { name: "Slots left", value: Math.max(0, stats.slotsLeft) },
        ]
      : [
          { name: "No capacity", value: 1 },
        ];

  const barData = [
    { name: "Caterer swaps", n: stats?.totalCatererSwapRequests ?? 0 },
    { name: "Pending upgrades", n: stats?.pendingMessUpgrades ?? 0 },
    { name: "Approved upgrades", n: stats?.approvedMessUpgrades ?? 0 },
  ];

  return (
    <div className={styles.root}>
      <div className={styles.subNav}>
        {[
          { id: "overview", label: "Overview & stats" },
          { id: "options", label: "Caterer swap slots" },
          { id: "caterer", label: "Caterer applications" },
          { id: "upgrade", label: "Mess upgradation" },
        ].map((x) => (
          <button
            key={x.id}
            type="button"
            className={`${styles.subTab} ${sub === x.id ? styles.subTabOn : ""}`}
            onClick={() => setSub(x.id)}
          >
            {x.label}
          </button>
        ))}
      </div>

      {sub === "overview" && stats && (
        <>
          <div className={styles.statGrid}>
            <div className={styles.statCard}>
              <span className={styles.statLab}>Caterer swap requests</span>
              <strong className={styles.statVal}>{stats.totalCatererSwapRequests}</strong>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statLab}>Pending mess upgrades</span>
              <strong className={styles.statVal}>{stats.pendingMessUpgrades}</strong>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statLab}>Approved upgrades</span>
              <strong className={styles.statVal}>{stats.approvedMessUpgrades}</strong>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statLab}>Slot capacity / left</span>
              <strong className={styles.statVal}>
                {stats.totalSlotCapacity} / {stats.slotsLeft}
              </strong>
            </div>
          </div>
          <div className={styles.charts}>
            <div className={`card ${styles.chartCard}`}>
              <h3>Slot fill (caterer swap)</h3>
              <div style={{ height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={78}
                      label
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className={`card ${styles.chartCard}`}>
              <h3>Request volume</h3>
              <div style={{ height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="n" fill="#2d6a4f" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}

      {sub === "options" && (
        <>
          <form className={`card ${styles.formCard}`} onSubmit={createOption}>
            <h3>Create swap option</h3>
            <p className="muted" style={{ fontSize: "0.85rem", marginTop: 0 }}>
              Same mess type only. Students must currently be on <code>from</code> caterer to apply.
            </p>
            <div className={styles.formRow}>
              <div>
                <label className="label">Mess type</label>
                <select
                  className="input"
                  value={newOpt.messType}
                  onChange={(e) => setNewOpt({ ...newOpt, messType: e.target.value })}
                >
                  {MESS_TYPES.map((m) => (
                    <option key={m} value={m}>
                      {label(m)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">From caterer</label>
                <select
                  className="input"
                  value={newOpt.fromCaterer}
                  onChange={(e) => setNewOpt({ ...newOpt, fromCaterer: e.target.value })}
                >
                  {CATERERS.map((c) => (
                    <option key={c} value={c}>
                      {label(c)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">To caterer</label>
                <select
                  className="input"
                  value={newOpt.toCaterer}
                  onChange={(e) => setNewOpt({ ...newOpt, toCaterer: e.target.value })}
                >
                  {CATERERS.map((c) => (
                    <option key={c} value={c}>
                      {label(c)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Total slots</label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  value={newOpt.totalSlots}
                  onChange={(e) => setNewOpt({ ...newOpt, totalSlots: e.target.value })}
                />
              </div>
            </div>
            <button className="btn" type="submit" disabled={busy}>
              Add option
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ marginLeft: "0.5rem" }}
              disabled={optionsLoading}
              onClick={() => loadOptions()}
            >
              {optionsLoading ? "Refreshing…" : "Refresh list"}
            </button>
          </form>

          {optionsErr && (
            <p className="muted" style={{ color: "var(--danger, #b71c1c)", margin: "0.5rem 0" }} role="alert">
              {optionsErr}
            </p>
          )}

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Mess</th>
                  <th>From → To</th>
                  <th>Slots</th>
                  <th>Active</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {optionsLoading && options.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="muted" style={{ padding: "1rem" }}>
                      Loading caterer swap options…
                    </td>
                  </tr>
                ) : options.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="muted" style={{ padding: "1rem" }}>
                      No rows yet. Use the form above, or run <code>npm run db:seed</code> in the{" "}
                      <code>server</code> folder to load demo swap lines, then click Refresh list.
                    </td>
                  </tr>
                ) : (
                  options.map((o) => (
                    <tr key={o.id}>
                      <td>{label(o.messType)}</td>
                      <td>
                        {label(o.fromCaterer)} → {label(o.toCaterer)}
                      </td>
                      <td>
                        {o.slotsLeft ?? "—"} left · {o.slotsUsed ?? 0}/{o.totalSlots}
                      </td>
                      <td>{o.isActive ? "Yes" : "No"}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{ fontSize: "0.78rem", padding: "0.25rem 0.5rem" }}
                          onClick={() => {
                            const n = window.prompt("New total slots", String(o.totalSlots));
                            if (n == null) return;
                            patchOption(o.id, { totalSlots: Number(n) });
                          }}
                        >
                          Set slots
                        </button>{" "}
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{ fontSize: "0.78rem", padding: "0.25rem 0.5rem" }}
                          onClick={() => patchOption(o.id, { isActive: !o.isActive })}
                        >
                          Toggle active
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {(sub === "caterer" || sub === "upgrade") && (
        <div className={`card ${styles.filters}`}>
          <h4 style={{ margin: "0 0 0.5rem" }}>Filters</h4>
          <div className={styles.filterRow}>
            <input
              className="input"
              placeholder="Name / email / reg search"
              value={filters.q}
              onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            />
            <input
              className="input"
              placeholder="Registration no."
              value={filters.registrationNo}
              onChange={(e) => setFilters({ ...filters, registrationNo: e.target.value })}
            />
            <select
              className="input"
              value={filters.messType}
              onChange={(e) => setFilters({ ...filters, messType: e.target.value })}
            >
              <option value="">All mess types</option>
              {MESS_TYPES.map((m) => (
                <option key={m} value={m}>
                  {label(m)}
                </option>
              ))}
            </select>
            <select
              className="input"
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            >
              <option value="">All statuses</option>
              {sub === "caterer" ? (
                <>
                  <option value="CONFIRMED">Confirmed</option>
                  <option value="CANCELLED">Cancelled</option>
                  <option value="REJECTED">Rejected</option>
                </>
              ) : (
                <>
                  <option value="PENDING">Pending</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                </>
              )}
            </select>
            <input
              className="input"
              type="date"
              value={filters.from}
              onChange={(e) => setFilters({ ...filters, from: e.target.value })}
            />
            <input
              className="input"
              type="date"
              value={filters.to}
              onChange={(e) => setFilters({ ...filters, to: e.target.value })}
            />
            <button
              type="button"
              className="btn"
              onClick={() => {
                if (sub === "caterer") loadCaterer();
                else loadUpgrades();
              }}
            >
              Apply
            </button>
          </div>
        </div>
      )}

      {sub === "caterer" && (
        <div className={styles.list}>
          {catererReqs.map((r) => (
            <article key={r.id} className={`card ${styles.reqCard}`}>
              <div className={styles.reqHead}>
                <SwapStatusBadge status={r.status} />
                <span className="muted">{new Date(r.createdAt).toLocaleString()}</span>
              </div>
              <p>
                <strong>{r.user?.name}</strong> · {r.user?.email}
                {r.user?.studentProfile?.registrationNo && (
                  <> · Reg: {r.user.studentProfile.registrationNo}</>
                )}
              </p>
              <p className="muted" style={{ fontSize: "0.85rem" }}>
                {label(r.fromCatererSnapshot)} → {label(r.toCatererSnapshot)} · {label(r.messTypeSnapshot)}
              </p>
              {r.status === "CONFIRMED" && (
                <button type="button" className="btn btn-ghost" onClick={() => cancelSwap(r.id)}>
                  Reverse swap (restore caterer)
                </button>
              )}
            </article>
          ))}
          {catererReqs.length === 0 && <p className="muted">No records match filters.</p>}
        </div>
      )}

      {sub === "upgrade" && (
        <div className={styles.list}>
          {upgrades.map((r) => (
            <article key={r.id} className={`card ${styles.reqCard}`}>
              <div className={styles.reqHead}>
                <SwapStatusBadge status={r.status} />
                <span className="muted">{new Date(r.createdAt).toLocaleString()}</span>
              </div>
              <p>
                <strong>{r.user?.name}</strong> · {r.user?.email}
                {r.user?.studentProfile?.registrationNo && (
                  <> · Reg: {r.user.studentProfile.registrationNo}</>
                )}
              </p>
              <p>
                Current mess:{" "}
                <strong>{r.user?.studentProfile ? label(r.user.studentProfile.messType) : "—"}</strong> →
                Requested: <strong>{label(r.targetMessType)}</strong>
              </p>
              <p className="muted" style={{ fontSize: "0.85rem" }}>
                Payment ID: <code>{r.paymentId}</code>
              </p>
              {r.adminRemarks && <p style={{ fontSize: "0.85rem" }}>Remarks: {r.adminRemarks}</p>}
              {r.status === "PENDING" && (
                <div className={styles.approveBox}>
                  {approveId === r.id ? (
                    <>
                      <label className="label">Assigned caterer (required to approve)</label>
                      <select
                        className="input"
                        value={approveCaterer}
                        onChange={(e) => setApproveCaterer(e.target.value)}
                      >
                        {CATERERS.map((c) => (
                          <option key={c} value={c}>
                            {label(c)}
                          </option>
                        ))}
                      </select>
                      <label className="label" style={{ marginTop: "0.5rem" }}>
                        Remarks (optional)
                      </label>
                      <textarea
                        className="input"
                        rows={2}
                        value={approveRemarks}
                        onChange={(e) => setApproveRemarks(e.target.value)}
                      />
                      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                        <button
                          type="button"
                          className="btn"
                          disabled={busy}
                          onClick={() => reviewUpgrade(r.id, "APPROVED")}
                        >
                          Confirm approve
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          disabled={busy}
                          onClick={() => reviewUpgrade(r.id, "REJECTED")}
                        >
                          Reject
                        </button>
                        <button type="button" className="btn btn-ghost" onClick={() => setApproveId(null)}>
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      <button type="button" className="btn" onClick={() => setApproveId(r.id)}>
                        Approve / reject
                      </button>
                    </div>
                  )}
                </div>
              )}
            </article>
          ))}
          {upgrades.length === 0 && <p className="muted">No records match filters.</p>}
        </div>
      )}
    </div>
  );
}
