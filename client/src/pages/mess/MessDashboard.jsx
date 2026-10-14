import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  IoCloudUploadOutline,
  IoStarOutline,
  IoWarningOutline,
  IoPeopleOutline,
  IoBasketOutline,
  IoMoonOutline,
  IoMegaphoneOutline,
  IoRefreshOutline,
  IoChatbubblesOutline,
  IoClipboardOutline,
  IoQrCodeOutline,
} from "react-icons/io5";
import api from "../../api/client.js";
import { useAuth } from "../../context/AuthContext.jsx";
import AppShellLayout from "../../layouts/AppShellLayout.jsx";
import FilePicker from "../../components/FilePicker.jsx";
import CommunityFeed from "../../components/CommunityFeed.jsx";
import NightMessStaffPanel from "../../components/NightMessStaffPanel.jsx";
import MessAttendanceTab from "../../components/MessAttendanceTab.jsx";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import styles from "./MessDashboard.module.css";

const MESS_TYPES = ["VEG", "NON_VEG", "SPECIAL"];
const MEALS = ["BREAKFAST", "LUNCH", "SNACKS", "DINNER"];

const MESS_DRAWER = [
  {
    title: "Data & feedback",
    items: [
      {
        id: "import",
        label: "CSV import",
        sub: "Menu & night mess CSV",
        icon: IoCloudUploadOutline,
      },
      { id: "reviews", label: "Reviews", sub: "Student ratings", icon: IoStarOutline },
      { id: "complaints", label: "Complaints", sub: "Issues & escalations", icon: IoWarningOutline },
      {
        id: "community",
        label: "Community",
        sub: "Student feed & posts",
        icon: IoChatbubblesOutline,
      },
      {
        id: "advRequests",
        label: "Advanced requests",
        sub: "Admin-approved student queries",
        icon: IoClipboardOutline,
      },
    ],
  },
  {
    title: "Operations",
    items: [
      { id: "crowd", label: "Crowd status", sub: "Broadcast congestion", icon: IoPeopleOutline },
      { id: "leftovers", label: "Leftover log", sub: "Waste tracking", icon: IoBasketOutline },
      { id: "night", label: "Night mess", sub: "Fixed menu & stock", icon: IoMoonOutline },
      { id: "announce", label: "Announcements", sub: "Notify students", icon: IoMegaphoneOutline },
      {
        id: "attendance",
        label: "Attendance",
        sub: "QR scan & OTP verify",
        icon: IoQrCodeOutline,
      },
    ],
  },
];

const MESS_BOTTOM = [
  { id: "import", label: "Import", icon: IoCloudUploadOutline },
  { id: "reviews", label: "Reviews", icon: IoStarOutline },
  { id: "complaints", label: "Issues", icon: IoWarningOutline },
  { id: "community", label: "Feed", icon: IoChatbubblesOutline },
  { id: "advRequests", label: "Requests", icon: IoClipboardOutline },
  { id: "crowd", label: "Crowd", icon: IoPeopleOutline },
  { id: "attendance", label: "Attendance", icon: IoQrCodeOutline },
];

export default function MessDashboard() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [tab, setTab] = useState("import");
  const [csvFile, setCsvFile] = useState(null);
  const [targetMessType, setTargetMessType] = useState("ALL");
  const [importResult, setImportResult] = useState(null);
  const [importError, setImportError] = useState(null);
  const [importLoading, setImportLoading] = useState(false);
  const [nightCsvFile, setNightCsvFile] = useState(null);
  const [nightImportResult, setNightImportResult] = useState(null);
  const [nightImportError, setNightImportError] = useState(null);
  const [nightImportLoading, setNightImportLoading] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [reviewSort, setReviewSort] = useState("submitted_new");
  const [complaintSort, setComplaintSort] = useState("submitted_new");
  const [crowd, setCrowd] = useState("MEDIUM");
  const [crowdNote, setCrowdNote] = useState("");
  const [leftoverMessType, setLeftoverMessType] = useState("VEG");
  const [leftoverDate, setLeftoverDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [leftoverMealSlot, setLeftoverMealSlot] = useState("LUNCH");
  const [menuForDay, setMenuForDay] = useState(null);
  const [editingItemId, setEditingItemId] = useState(null);
  const [editQty, setEditQty] = useState("");
  const [editUnit, setEditUnit] = useState("kg");
  const [leftoverLogRows, setLeftoverLogRows] = useState([]);
  const [vizFrom, setVizFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [vizTo, setVizTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [vizMenuItemId, setVizMenuItemId] = useState("");
  const [leftoverSeries, setLeftoverSeries] = useState(null);
  const [trackedItems, setTrackedItems] = useState([]);
  const [announce, setAnnounce] = useState({ title: "", body: "" });
  const [sqlHelp, setSqlHelp] = useState(null);
  const [advQueue, setAdvQueue] = useState([]);

  function loadReports() {
    api.get("/reviews/report").then((r) => setReviews(r.data));
    api.get("/complaints/report").then((r) => setComplaints(r.data));
  }

  React.useEffect(() => {
    if (tab === "reviews" || tab === "complaints") loadReports();
  }, [tab]);

  useEffect(() => {
    if (tab !== "advRequests") return;
    api
      .get("/advanced-requests/mess-queue")
      .then((r) => setAdvQueue(r.data))
      .catch(() => setAdvQueue([]));
  }, [tab]);

  function advTypeLabel(t) {
    if (t === "ROOM_DELIVERY") return "Food delivery to room";
    if (t === "TEMP_MENU_CHANGE") return "Temporary menu change";
    return t;
  }

  const loadLeftoverLogs = useCallback(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 90);
    return api
      .get(
        `/leftovers?from=${from.toISOString().slice(0, 10)}&to=${to.toISOString().slice(0, 10)}&messType=${leftoverMessType}`
      )
      .then((r) => setLeftoverLogRows(r.data));
  }, [leftoverMessType]);

  const loadTrackedItems = useCallback(() => {
    return api
      .get(`/leftovers/tracked-items?from=${vizFrom}&to=${vizTo}&messType=${leftoverMessType}`)
      .then((r) => setTrackedItems(r.data));
  }, [vizFrom, vizTo, leftoverMessType]);

  useEffect(() => {
    if (tab !== "leftovers") return;
    api
      .get(`/menus/day?date=${leftoverDate}&messType=${leftoverMessType}`)
      .then((r) => setMenuForDay(r.data))
      .catch(() => setMenuForDay(null));
  }, [tab, leftoverDate, leftoverMessType]);

  useEffect(() => {
    if (tab !== "leftovers") return;
    loadLeftoverLogs();
  }, [tab, loadLeftoverLogs]);

  useEffect(() => {
    if (tab !== "leftovers") return;
    loadTrackedItems();
  }, [tab, loadTrackedItems]);

  useEffect(() => {
    if (tab !== "leftovers" || !vizMenuItemId) {
      setLeftoverSeries(null);
      return;
    }
    api
      .get(
        `/leftovers/series?menuItemId=${vizMenuItemId}&from=${vizFrom}&to=${vizTo}&messType=${leftoverMessType}`
      )
      .then((r) => setLeftoverSeries(r.data))
      .catch(() => setLeftoverSeries(null));
  }, [tab, vizMenuItemId, vizFrom, vizTo, leftoverMessType]);

  function sortByKey(list, mode) {
    const out = [...list];
    const get = (row, key) => {
      const v = row[key];
      return v ? new Date(v).getTime() : 0;
    };
    out.sort((a, b) => {
      let ta;
      let tb;
      if (mode.startsWith("menu")) {
        ta = get(a, "menuDate");
        tb = get(b, "menuDate");
      } else {
        ta = get(a, "createdAt");
        tb = get(b, "createdAt");
      }
      const dir = mode.endsWith("new") ? -1 : 1;
      return (ta - tb) * dir;
    });
    return out;
  }

  const sortedReviews = useMemo(
    () => sortByKey(reviews, reviewSort),
    [reviews, reviewSort]
  );

  const sortedComplaints = useMemo(
    () => sortByKey(complaints, complaintSort),
    [complaints, complaintSort]
  );

  async function uploadCsv(e) {
    e.preventDefault();
    setImportError(null);
    if (!csvFile) {
      setImportError("Choose an Excel or CSV file first (use the file picker above).");
      return;
    }
    setImportLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", csvFile);
      if (targetMessType) fd.append("targetMessType", targetMessType);
      const { data } = await api.post("/import/csv", fd);
      setImportResult(data);
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.message ||
        "Upload failed";
      setImportError(String(msg));
      setImportResult(null);
    } finally {
      setImportLoading(false);
    }
  }

  async function uploadNightMessCsv(e) {
    e.preventDefault();
    setNightImportError(null);
    if (!nightCsvFile) {
      setNightImportError("Choose a night mess CSV file first.");
      return;
    }
    setNightImportLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", nightCsvFile);
      const { data } = await api.post("/import/csv", fd);
      setNightImportResult(data);
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.message ||
        "Upload failed";
      setNightImportError(String(msg));
      setNightImportResult(null);
    } finally {
      setNightImportLoading(false);
    }
  }

  async function submitCrowd(e) {
    e.preventDefault();
    const note = crowdNote.trim() || undefined;
    await api.post("/crowd", { level: crowd, note });
    alert("Crowd updated — students notified.");
    setCrowdNote("");
  }

  function openLeftoverEditor(item) {
    if (editingItemId === item.id) {
      setEditingItemId(null);
      setEditQty("");
      setEditUnit("kg");
      return;
    }
    const sameRow = (r) =>
      r.menuItemId === item.id &&
      String(r.entryDate).slice(0, 10) === leftoverDate &&
      r.mealSlot === leftoverMealSlot &&
      (r.messType === leftoverMessType || r.messType == null);
    const row = leftoverLogRows.find(sameRow);
    setEditingItemId(item.id);
    setEditQty(row != null ? String(row.quantity) : "");
    setEditUnit(row?.unit || "kg");
  }

  async function saveLeftoverForMenuItem(item) {
    const menuItemId = item?.id;
    if (!menuItemId) {
      alert("Missing dish id — reload the menu and try again.");
      return;
    }
    const q = Number(editQty);
    if (Number.isNaN(q) || q < 0) {
      alert("Enter a valid quantity.");
      return;
    }
    try {
      await api.post("/leftovers", {
        entryDate: leftoverDate,
        mealSlot: leftoverMealSlot,
        menuItemId: String(menuItemId),
        quantity: q,
        unit: (editUnit || "kg").trim() || "kg",
        messType: leftoverMessType,
      });
      setEditingItemId(null);
      setEditQty("");
      await loadLeftoverLogs();
      await loadTrackedItems();
      if (vizMenuItemId === menuItemId) {
        const { data } = await api.get(
          `/leftovers/series?menuItemId=${vizMenuItemId}&from=${vizFrom}&to=${vizTo}&messType=${leftoverMessType}`
        );
        setLeftoverSeries(data);
      }
      alert("Saved.");
    } catch (err) {
      const msg =
        err.response?.data?.error || err.response?.data?.message || err.message || "Save failed";
      alert(String(msg));
    }
  }

  const mealMenuItems = useMemo(() => {
    if (!menuForDay?.meals) return [];
    const m = menuForDay.meals.find((x) => x.mealSlot === leftoverMealSlot);
    return m?.items || [];
  }, [menuForDay, leftoverMealSlot]);

  const chartPoints = useMemo(
    () =>
      (leftoverSeries?.points || []).map((p) => ({
        date: p.date,
        qty: p.quantity,
        label: `${p.date} (${p.mealSlot})`,
      })),
    [leftoverSeries]
  );

  async function submitAnnounce(e) {
    e.preventDefault();
    await api.post("/announcements", announce);
    alert("Announcement posted.");
  }

  async function loadSqlHelp() {
    const { data } = await api.get("/import/sql-instructions");
    setSqlHelp(data);
  }

  return (
    <AppShellLayout
      variant="mess"
      brand="Mess desk"
      brandKicker="Operations"
      activeId={tab}
      onNavigate={setTab}
      onLogout={() => {
        logout();
        nav("/login");
      }}
      drawerSections={MESS_DRAWER}
      bottomItems={MESS_BOTTOM}
      drawerFooter={
        <p className="muted" style={{ margin: 0, fontSize: "0.78rem", lineHeight: 1.4 }}>
          Signed in as <strong>{user?.email}</strong>. Open another browser as a student to preview
          the app.
        </p>
      }
    >
      <div className={styles.page}>
      {tab === "import" && (
        <section className="card">
          <h2>Menu Excel &amp; CSV Import</h2>
          <p className="muted" style={{ fontSize: "0.88rem" }}>
            Upload your weekly or daily menu. Supports <strong>4-meals matrix format</strong> (each day as a row, with <strong>Breakfast, Lunch, Snacks, Dinner</strong> as columns). Both <code>.xlsx</code> and <code>.csv</code> files are supported!
          </p>
          <div style={{ display: "flex", gap: "0.5rem", margin: "0.75rem 0", flexWrap: "wrap" }}>
            <a
              href="/sample_4meals_matrix_menu.xlsx"
              download
              className="btn btn-ghost"
              style={{ fontSize: "0.84rem", textDecoration: "none" }}
            >
              📥 Download Sample Excel (.xlsx)
            </a>
            <a
              href="/sample_4meals_matrix_menu.csv"
              download
              className="btn btn-ghost"
              style={{ fontSize: "0.84rem", textDecoration: "none" }}
            >
              📥 Download Sample CSV (.csv)
            </a>
          </div>
          <form onSubmit={uploadCsv}>
            <label className="label">Menu Spreadsheet (.xlsx or .csv)</label>
            <FilePicker
              accept=".csv,.xlsx,.xls"
              file={csvFile}
              onChange={setCsvFile}
              chooseLabel="Select an Excel or CSV file"
              emptySub="Upload 4-meals matrix or legacy format"
              hint="Excel (.xlsx/.xls) or Comma-separated (.csv)"
            />
            <div style={{ marginTop: "0.75rem", maxWidth: "340px" }}>
              <label className="label">Target Mess Type (if not specified in file)</label>
              <select
                className="input"
                value={targetMessType}
                onChange={(e) => setTargetMessType(e.target.value)}
                style={{ marginTop: "0.25rem" }}
              >
                <option value="ALL">All Mess Types (Veg, Non-Veg, Special, Foodpark)</option>
                <option value="VEG">Veg Mess Only</option>
                <option value="NON_VEG">Non-Veg Mess Only</option>
                <option value="SPECIAL">Special Mess Only</option>
                <option value="FOODPARK">Foodpark Mess Only</option>
              </select>
            </div>
            <button
              className="btn"
              type="submit"
              style={{ marginTop: "0.85rem" }}
              disabled={importLoading}
            >
              {importLoading ? "Uploading…" : "Upload Menu"}
            </button>
          </form>
          {importError && (
            <p className="muted" style={{ color: "var(--danger, #c62828)", marginTop: "0.75rem" }}>
              {importError}
            </p>
          )}
          {importResult && (
            <pre className={styles.pre}>
              {JSON.stringify(importResult, null, 2)}
            </pre>
          )}
          <button type="button" className="btn btn-ghost" onClick={loadSqlHelp}>
            SQL import instructions
          </button>
          {sqlHelp && (
            <ul className="muted" style={{ fontSize: "0.85rem" }}>
              {sqlHelp.steps?.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          )}

          <hr style={{ margin: "1.25rem 0", border: "none", borderTop: "1px solid var(--border, #e0e0e0)" }} />
          <h3 style={{ marginTop: 0 }}>Night mess CSV</h3>
          <p className="muted" style={{ fontSize: "0.88rem" }}>
            Each row must use <code>meal_slot</code> <strong>NIGHT_MESS</strong> and{" "}
            <code>service_date</code> (YYYY-MM-DD), plus <code>price</code>,{" "}
            <code>available_qty</code>, <code>remaining_qty</code>. Same nutrition columns as the menu
            CSV.{" "}
            <a href="/sample_night_mess.csv" download>
              Download sample CSV
            </a>{" "}
            (also in <code>docs/sample_night_mess.csv</code>).
          </p>
          <form onSubmit={uploadNightMessCsv}>
            <label className="label">Night mess spreadsheet</label>
            <FilePicker
              accept=".csv"
              file={nightCsvFile}
              onChange={setNightCsvFile}
              chooseLabel="Select night mess CSV"
              emptySub="NIGHT_MESS rows with service_date, price, quantities"
              hint="Comma-separated values (.csv) only."
            />
            <button
              className="btn"
              type="submit"
              style={{ marginTop: "0.5rem" }}
              disabled={nightImportLoading}
            >
              {nightImportLoading ? "Uploading…" : "Upload night mess CSV"}
            </button>
          </form>
          {nightImportError && (
            <p className="muted" style={{ color: "var(--danger, #c62828)", marginTop: "0.75rem" }}>
              {nightImportError}
            </p>
          )}
          {nightImportResult && (
            <pre className={styles.pre}>
              {JSON.stringify(nightImportResult, null, 2)}
            </pre>
          )}
        </section>
      )}

      {tab === "reviews" && (
        <section className={`card ${styles.feedCard}`}>
          <div className={styles.feedHeader}>
            <div>
              <h2 className={styles.feedTitle}>Student reviews</h2>
              <p className="muted" style={{ fontSize: "0.82rem", margin: "0.25rem 0 0" }}>
                Ratings and comments by submission date.
              </p>
            </div>
            <div className={styles.feedToolbar}>
              <label className={styles.sortLabel}>
                <span>Sort</span>
                <select
                  className="input"
                  value={reviewSort}
                  onChange={(e) => setReviewSort(e.target.value)}
                >
                  <option value="submitted_new">Submission · newest</option>
                  <option value="submitted_old">Submission · oldest</option>
                  <option value="menu_new">Menu day · newest</option>
                  <option value="menu_old">Menu day · oldest</option>
                </select>
              </label>
              <button type="button" className={`btn btn-ghost ${styles.iconBtn}`} onClick={loadReports} title="Refresh">
                <IoRefreshOutline size={20} />
              </button>
            </div>
          </div>
          {sortedReviews.length === 0 && <p className="muted">No reviews yet.</p>}
          <ul className={styles.feedList}>
            {sortedReviews.map((r) => (
              <li key={r.id} className={styles.reviewItem}>
                <div className={styles.itemTop}>
                  <div className={styles.dateBadge}>
                    {r.menuDate ? String(r.menuDate).slice(0, 10) : "—"}
                    <span className={styles.dateBadgeSub}>menu day</span>
                  </div>
                  <div className={styles.starLine} aria-label={`${r.rating} out of 5`}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <span key={n} className={n <= r.rating ? styles.starOn : styles.starDim}>
                        ★
                      </span>
                    ))}
                  </div>
                </div>
                <p className={styles.dishName}>{r.menuItem?.name || "Unknown item"}</p>
                {r.comment ? <p className={styles.comment}>{r.comment}</p> : <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>No comment</p>}
                <div className={styles.itemMeta}>
                  <span>{r.user?.name || "Student"}</span>
                  <span className={styles.metaDot}>·</span>
                  <span>Submitted {r.createdAt ? new Date(r.createdAt).toLocaleString() : "—"}</span>
                  {r.attachmentPath && (
                    <>
                      <span className={styles.metaDot}>·</span>
                      <a href={r.attachmentPath} target="_blank" rel="noopener noreferrer" className={styles.attachLink}>
                        View attachment
                      </a>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === "complaints" && (
        <section className={`card ${styles.feedCard}`}>
          <div className={styles.feedHeader}>
            <div>
              <h2 className={styles.feedTitle}>Complaints</h2>
              <p className="muted" style={{ fontSize: "0.82rem", margin: "0.25rem 0 0" }}>
                Issues reported by students, sorted by report date.
              </p>
            </div>
            <div className={styles.feedToolbar}>
              <label className={styles.sortLabel}>
                <span>Sort</span>
                <select
                  className="input"
                  value={complaintSort}
                  onChange={(e) => setComplaintSort(e.target.value)}
                >
                  <option value="submitted_new">Reported · newest</option>
                  <option value="submitted_old">Reported · oldest</option>
                  <option value="menu_new">Menu day · newest</option>
                  <option value="menu_old">Menu day · oldest</option>
                </select>
              </label>
              <button type="button" className={`btn btn-ghost ${styles.iconBtn}`} onClick={loadReports} title="Refresh">
                <IoRefreshOutline size={20} />
              </button>
            </div>
          </div>
          {sortedComplaints.length === 0 && <p className="muted">No complaints yet.</p>}
          <ul className={styles.feedList}>
            {sortedComplaints.map((c) => (
              <li key={c.id} className={styles.complaintItem}>
                <div className={styles.itemTop}>
                  <div className={styles.dateBadge}>
                    {c.menuDate ? String(c.menuDate).slice(0, 10) : "—"}
                    <span className={styles.dateBadgeSub}>menu day</span>
                  </div>
                  <div className={styles.badgeRow}>
                    <span className={styles.issuePill}>{c.issueType?.replace(/_/g, " ") || "—"}</span>
                    {c.status && (
                      <span className={styles.statusPill}>{String(c.status).replace(/_/g, " ")}</span>
                    )}
                    {c.escalated && <span className={styles.escPill}>Escalated</span>}
                  </div>
                </div>
                <p className={styles.dishName}>{c.menuItem?.name || "Unknown item"}</p>
                {c.description ? <p className={styles.comment}>{c.description}</p> : <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>No extra details</p>}
                <div className={styles.itemMeta}>
                  <span>{c.user?.name || "Student"}</span>
                  <span className={styles.metaDot}>·</span>
                  <span>{c.user?.email}</span>
                  <span className={styles.metaDot}>·</span>
                  <span>Reported {c.createdAt ? new Date(c.createdAt).toLocaleString() : "—"}</span>
                  {c.attachmentPath && (
                    <>
                      <span className={styles.metaDot}>·</span>
                      <a href={c.attachmentPath} target="_blank" rel="noopener noreferrer" className={styles.attachLink}>
                        View attachment
                      </a>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === "community" && (
        <CommunityFeed showComposer={false} title="Community feed" />
      )}

      {tab === "advRequests" && (
        <section className={`card ${styles.feedCard}`}>
          <div className={styles.feedHeader}>
            <div>
              <h2 className={styles.feedTitle}>Advanced requests (approved)</h2>
              <p className="muted" style={{ fontSize: "0.82rem", margin: "0.25rem 0 0" }}>
                Only requests approved by admin appear here. You also get a notification when a new one
                is approved. Pending items are visible to admins only.
              </p>
            </div>
            <button
              type="button"
              className={`btn btn-ghost ${styles.iconBtn}`}
              title="Refresh"
              onClick={() =>
                api
                  .get("/advanced-requests/mess-queue")
                  .then((r) => setAdvQueue(r.data))
                  .catch(() => {})
              }
            >
              <IoRefreshOutline size={20} />
            </button>
          </div>
          {advQueue.length === 0 && (
            <p className="muted">No approved advanced requests yet.</p>
          )}
          <ul className={styles.feedList}>
            {advQueue.map((r) => (
              <li key={r.id} className={styles.complaintItem}>
                <div className={styles.itemTop}>
                  <div className={styles.dateBadge}>
                    {r.requestDate ? String(r.requestDate).slice(0, 10) : "—"}
                    <span className={styles.dateBadgeSub}>for date</span>
                  </div>
                  <div className={styles.badgeRow}>
                    <span className={styles.statusPill}>Approved</span>
                    <span className={styles.issuePill}>{advTypeLabel(r.requestType)}</span>
                  </div>
                </div>
                <p className={styles.dishName}>{r.user?.name || "Student"}</p>
                <p className={styles.comment}>{r.description}</p>
                <div className={styles.itemMeta}>
                  <span>{r.user?.email}</span>
                  {r.user?.studentProfile && (
                    <>
                      <span className={styles.metaDot}>·</span>
                      <span>
                        {r.user.studentProfile.messType} · {r.user.studentProfile.hostelBlock}
                      </span>
                    </>
                  )}
                  <span className={styles.metaDot}>·</span>
                  <span>Approved {r.reviewedAt ? new Date(r.reviewedAt).toLocaleString() : "—"}</span>
                </div>
                {r.proofPath && (
                  <a
                    href={r.proofPath}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.attachLink}
                    style={{ display: "inline-block", marginTop: "0.35rem" }}
                  >
                    View proof image
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === "crowd" && (
        <form className="card" onSubmit={submitCrowd}>
          <h2>Crowd status</h2>
          <p className="muted" style={{ fontSize: "0.88rem", marginTop: 0 }}>
            Students get a notification. Add a short note if you want to explain queues, counters, or wait times.
          </p>
          <label className="label" style={{ marginTop: "0.75rem" }}>
            Congestion level
          </label>
          <select
            className="input"
            value={crowd}
            onChange={(e) => setCrowd(e.target.value)}
          >
            {["LOW", "MEDIUM", "HIGH", "VERY_CROWDED"].map((x) => (
              <option key={x} value={x}>
                {x.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <label className="label" style={{ marginTop: "0.75rem" }}>
            Message for students (optional)
          </label>
          <textarea
            className="input"
            rows={3}
            value={crowdNote}
            onChange={(e) => setCrowdNote(e.target.value)}
            placeholder="e.g. North counter is closed — use south line only."
          />
          <button className="btn" type="submit" style={{ marginTop: "0.75rem" }}>
            Broadcast to students
          </button>
        </form>
      )}

      {tab === "leftovers" && (
        <>
          <section className="card">
            <h2>Log leftovers from today&apos;s menu</h2>
            <p className="muted" style={{ fontSize: "0.88rem", marginTop: 0 }}>
              Pick the calendar day and mess line, then tap a dish from that meal and enter surplus
              quantity. Saving updates the same dish for that day &amp; meal — history builds across
              days for charts below. Students see this data read-only in their app.
            </p>
            <div className={styles.loRow}>
              <div>
                <label className="label">Date</label>
                <input
                  className="input"
                  type="date"
                  value={leftoverDate}
                  onChange={(e) => setLeftoverDate(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Mess line</label>
                <select
                  className="input"
                  value={leftoverMessType}
                  onChange={(e) => setLeftoverMessType(e.target.value)}
                >
                  {MESS_TYPES.map((m) => (
                    <option key={m} value={m}>
                      {m.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Meal</label>
                <select
                  className="input"
                  value={leftoverMealSlot}
                  onChange={(e) => setLeftoverMealSlot(e.target.value)}
                >
                  {MEALS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {menuForDay && (
              <p className="muted" style={{ fontSize: "0.78rem", margin: "0.5rem 0 0" }}>
                Menu source: <strong>{menuForDay.source === "date_override" ? "Date override" : "Weekly template"}</strong>{" "}
                · {menuForDay.date}
              </p>
            )}
            <h3 className={styles.loSubhead}>Dishes on menu — {leftoverMealSlot.toLowerCase()}</h3>
            {mealMenuItems.length === 0 && (
              <p className="muted">No dishes listed for this meal on this date. Import menu CSV or check another day.</p>
            )}
            <ul className={styles.loItemList}>
              {mealMenuItems.map((it) => (
                <li key={it.id} className={styles.loItem}>
                  <div className={styles.loItemHead}>
                    <span className={styles.loItemName}>{it.name}</span>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ fontSize: "0.78rem", padding: "0.35rem 0.6rem" }}
                      onClick={() => openLeftoverEditor(it)}
                    >
                      {editingItemId === it.id ? "Cancel" : "Log quantity"}
                    </button>
                  </div>
                  {editingItemId === it.id && (
                    <div className={styles.loItemForm}>
                      <input
                        className="input"
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="Quantity"
                        value={editQty}
                        onChange={(e) => setEditQty(e.target.value)}
                      />
                      <input
                        className="input"
                        placeholder="Unit"
                        value={editUnit}
                        onChange={(e) => setEditUnit(e.target.value)}
                      />
                      <button type="button" className="btn" onClick={() => saveLeftoverForMenuItem(it)}>
                        Save / update
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section className="card">
            <h2>Trend — surplus over time</h2>
            <p className="muted" style={{ fontSize: "0.85rem" }}>
              Choose a dish that has been logged at least once and a date range.
            </p>
            <div className={styles.loRow}>
              <div>
                <label className="label">From</label>
                <input
                  className="input"
                  type="date"
                  value={vizFrom}
                  onChange={(e) => setVizFrom(e.target.value)}
                />
              </div>
              <div>
                <label className="label">To</label>
                <input
                  className="input"
                  type="date"
                  value={vizTo}
                  onChange={(e) => setVizTo(e.target.value)}
                />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label className="label">Dish</label>
                <select
                  className="input"
                  value={vizMenuItemId}
                  onChange={(e) => setVizMenuItemId(e.target.value)}
                >
                  <option value="">— Select dish —</option>
                  {trackedItems.map((t) => (
                    <option key={t.menuItemId} value={t.menuItemId}>
                      {t.itemName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {vizMenuItemId && chartPoints.length > 0 && (
              <div className={styles.loChartWrap}>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={chartPoints} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} angle={-25} textAnchor="end" height={50} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="qty"
                      name={`Quantity (${leftoverSeries?.unit || "kg"})`}
                      stroke="var(--accent, #2d6a4f)"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            {vizMenuItemId && chartPoints.length === 0 && (
              <p className="muted">No data points in this range for this dish.</p>
            )}
          </section>

          <section className="card">
            <h2>Recent entries ({leftoverMessType.replace(/_/g, " ")})</h2>
            <div style={{ overflowX: "auto" }}>
              <table className={styles.loTable}>
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
                  {leftoverLogRows.slice(0, 80).map((row) => (
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
            {leftoverLogRows.length === 0 && <p className="muted">No entries yet.</p>}
          </section>
        </>
      )}

      {tab === "night" && (
        <NightMessStaffPanel title="Night mess — fixed menu (₹ INR)" />
      )}

      {tab === "attendance" && <MessAttendanceTab />}

      {tab === "announce" && (
        <form className="card" onSubmit={submitAnnounce}>
          <h2>Announcement</h2>
          <label className="label">Title</label>
          <input
            className="input"
            value={announce.title}
            onChange={(e) => setAnnounce({ ...announce, title: e.target.value })}
          />
          <label className="label">Body</label>
          <textarea
            className="input"
            rows={3}
            value={announce.body}
            onChange={(e) => setAnnounce({ ...announce, body: e.target.value })}
          />
          <button className="btn" type="submit" style={{ marginTop: "0.5rem" }}>
            Post & notify students
          </button>
        </form>
      )}

      </div>
    </AppShellLayout>
  );
}
