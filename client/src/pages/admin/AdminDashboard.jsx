import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  IoGridOutline,
  IoPeopleOutline,
  IoDocumentTextOutline,
  IoWarningOutline,
  IoDocumentOutline,
  IoLogoWhatsapp,
  IoChatbubblesOutline,
  IoMoonOutline,
  IoClipboardOutline,
  IoSwapHorizontal,
  IoQrCodeOutline,
  IoThumbsUpOutline,
} from "react-icons/io5";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import api from "../../api/client.js";
import FilePicker from "../../components/FilePicker.jsx";
import CommunityFeed from "../../components/CommunityFeed.jsx";
import NightMessStaffPanel from "../../components/NightMessStaffPanel.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import AppShellLayout from "../../layouts/AppShellLayout.jsx";
import styles from "./AdminDashboard.module.css";
import AdminMessSwapPanel from "./AdminMessSwapPanel.jsx";
import AdminAttendancePanel from "./AdminAttendancePanel.jsx";
import AdminVotingPlannerPanel from "./AdminVotingPlannerPanel.jsx";

const ADMIN_DRAWER = [
  {
    title: "Overview",
    items: [
      {
        id: "overview",
        label: "Dashboard",
        sub: "Stats, charts & waste",
        icon: IoGridOutline,
      },
    ],
  },
  {
    title: "Manage",
    items: [
      {
        id: "voting",
        label: "Menu voting & planner",
        sub: "Polls, results & monthly calendar",
        icon: IoThumbsUpOutline,
      },
      { id: "users", label: "Users", sub: "Create accounts & roles", icon: IoPeopleOutline },
      { id: "menu", label: "Menu import", sub: "Menu, night mess CSV & clear", icon: IoDocumentTextOutline },
      {
        id: "nightMess",
        label: "Night mess",
        sub: "Fixed menu & stock (₹)",
        icon: IoMoonOutline,
      },
      { id: "complaints", label: "Complaints", sub: "All reports", icon: IoWarningOutline },
      {
        id: "advRequests",
        label: "Advanced requests",
        sub: "Delivery & menu change approvals",
        icon: IoClipboardOutline,
      },
      {
        id: "community",
        label: "Community",
        sub: "Moderate posts & comments",
        icon: IoChatbubblesOutline,
      },
      {
        id: "messSwap",
        label: "Mess / caterer swap",
        sub: "Slots, FCFS & upgrades",
        icon: IoSwapHorizontal,
      },
      {
        id: "attendance",
        label: "Attendance",
        sub: "Meals, OTP & at-risk",
        icon: IoQrCodeOutline,
      },
    ],
  },
  {
    title: "Reports & comms",
    items: [
      { id: "pdf", label: "Monthly PDF", sub: "AI summary download", icon: IoDocumentOutline },
      { id: "whatsapp", label: "WhatsApp", sub: "Mock templates & history", icon: IoLogoWhatsapp },
    ],
  },
];

const ADMIN_BOTTOM = [
  { id: "overview", label: "Home", icon: IoGridOutline },
  { id: "voting", label: "Voting", icon: IoThumbsUpOutline },
  { id: "users", label: "Users", icon: IoPeopleOutline },
  { id: "menu", label: "Menu", icon: IoDocumentTextOutline },
  { id: "nightMess", label: "Night", icon: IoMoonOutline },
  { id: "complaints", label: "Issues", icon: IoWarningOutline },
  { id: "advRequests", label: "Requests", icon: IoClipboardOutline },
  { id: "community", label: "Feed", icon: IoChatbubblesOutline },
  { id: "messSwap", label: "Swap", icon: IoSwapHorizontal },
  { id: "attendance", label: "Attendance", icon: IoQrCodeOutline },
];

const MESS_TYPES = ["VEG", "NON_VEG", "SPECIAL"];
const HOSTEL_BLOCKS = ["A", "B", "C", "D1", "D2", "E"];
const CATERERS = ["ZENITH", "SRRC", "GRACE", "RASSENCE", "PROODLE", "FUSION"];

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [tab, setTab] = useState("overview");
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [waTemplates, setWaTemplates] = useState([]);
  const [waHistory, setWaHistory] = useState([]);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [newUser, setNewUser] = useState({
    email: "",
    password: "password123",
    name: "",
    role: "STUDENT",
    messType: "VEG",
    hostelBlock: "A",
    caterer: "ZENITH",
  });
  const [menuFile, setMenuFile] = useState(null);
  const [clearMenuFirst, setClearMenuFirst] = useState(false);
  const [deleteMenuCatalog, setDeleteMenuCatalog] = useState(false);
  const [targetMessType, setTargetMessType] = useState("ALL");
  const [menuImportResult, setMenuImportResult] = useState(null);
  const [menuImportError, setMenuImportError] = useState(null);
  const [menuImportLoading, setMenuImportLoading] = useState(false);
  const [clearMenuLoading, setClearMenuLoading] = useState(false);
  const [nightMessFile, setNightMessFile] = useState(null);
  const [nightMessImportResult, setNightMessImportResult] = useState(null);
  const [nightMessImportError, setNightMessImportError] = useState(null);
  const [nightMessImportLoading, setNightMessImportLoading] = useState(false);
  const [advRequests, setAdvRequests] = useState([]);
  const [advBusyId, setAdvBusyId] = useState(null);

  useEffect(() => {
    if (tab === "overview") {
      api.get("/admin/overview").then((r) => setOverview(r.data));
    }
    if (tab === "users") {
      api.get("/users").then((r) => setUsers(r.data));
    }
    if (tab === "complaints") {
      api.get("/admin/complaints").then((r) => setComplaints(r.data));
    }
    if (tab === "whatsapp") {
      api.get("/whatsapp/templates").then((r) => setWaTemplates(r.data));
      api.get("/whatsapp/history").then((r) => setWaHistory(r.data));
    }
    if (tab === "advRequests") {
      api.get("/advanced-requests/admin").then((r) => setAdvRequests(r.data));
    }
  }, [tab]);

  function advTypeLabel(t) {
    if (t === "ROOM_DELIVERY") return "Food delivery to room";
    if (t === "TEMP_MENU_CHANGE") return "Temporary menu change";
    return t;
  }

  const sortedAdvRequests = [...advRequests].sort((a, b) => {
    const rank = (s) => (s === "PENDING" ? 0 : s === "APPROVED" ? 1 : 2);
    const d = rank(a.status) - rank(b.status);
    if (d !== 0) return d;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  async function approveAdv(id) {
    setAdvBusyId(id);
    try {
      await api.patch(`/advanced-requests/${id}/approve`);
      const { data } = await api.get("/advanced-requests/admin");
      setAdvRequests(data);
    } finally {
      setAdvBusyId(null);
    }
  }

  async function rejectAdv(id) {
    if (!window.confirm("Reject this request? The student will be notified.")) return;
    setAdvBusyId(id);
    try {
      await api.patch(`/advanced-requests/${id}/reject`);
      const { data } = await api.get("/advanced-requests/admin");
      setAdvRequests(data);
    } finally {
      setAdvBusyId(null);
    }
  }

  async function downloadPdf() {
    setPdfBusy(true);
    try {
      const { data } = await api.post("/ai/monthly-pdf", {});
      const bin = atob(data.pdfBase64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) {
        bytes[i] = bin.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename || "report.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setPdfBusy(false);
    }
  }

  async function createUser(e) {
    e.preventDefault();
    const payload = {
      email: newUser.email,
      password: newUser.password,
      name: newUser.name,
      role: newUser.role,
      ...(newUser.role === "STUDENT"
        ? {
            messType: newUser.messType,
            hostelBlock: newUser.hostelBlock,
            caterer: newUser.caterer,
          }
        : {}),
    };
    await api.post("/users", payload);
    setNewUser({
      ...newUser,
      email: "",
      name: "",
    });
    api.get("/users").then((r) => setUsers(r.data));
  }

  async function uploadMenuCsv(e) {
    e.preventDefault();
    setMenuImportError(null);
    if (!menuFile) {
      setMenuImportError("Choose a CSV file first.");
      return;
    }
    setMenuImportLoading(true);
    setMenuImportResult(null);
    try {
      const fd = new FormData();
      fd.append("file", menuFile);
      fd.append("clearExisting", clearMenuFirst ? "true" : "false");
      fd.append("deleteMenuItems", deleteMenuCatalog ? "true" : "false");
      if (targetMessType) fd.append("targetMessType", targetMessType);
      const { data } = await api.post("/import/csv", fd);
      setMenuImportResult(data);
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.message ||
        "Import failed";
      setMenuImportError(String(msg));
    } finally {
      setMenuImportLoading(false);
    }
  }

  async function uploadNightMessCsv(e) {
    e.preventDefault();
    setNightMessImportError(null);
    if (!nightMessFile) {
      setNightMessImportError("Choose a night mess CSV file first.");
      return;
    }
    setNightMessImportLoading(true);
    setNightMessImportResult(null);
    try {
      const fd = new FormData();
      fd.append("file", nightMessFile);
      fd.append("clearExisting", clearMenuFirst ? "true" : "false");
      fd.append("deleteMenuItems", deleteMenuCatalog ? "true" : "false");
      const { data } = await api.post("/import/csv", fd);
      setNightMessImportResult(data);
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.message ||
        "Import failed";
      setNightMessImportError(String(msg));
    } finally {
      setNightMessImportLoading(false);
    }
  }

  async function clearMenuOnly() {
    const warn = deleteMenuCatalog
      ? "This removes all menu schedules and the full dish catalog. Reviews and complaints tied to dishes will be deleted. Continue?"
      : "This removes all weekly templates, dated menus, and night-mess rows. Continue?";
    if (!window.confirm(warn)) return;
    setMenuImportError(null);
    setClearMenuLoading(true);
    try {
      await api.post("/admin/clear-menu", { deleteMenuItems: deleteMenuCatalog });
      setMenuImportResult({
        ok: true,
        clearedStandalone: true,
        deletedMenuCatalog: deleteMenuCatalog,
      });
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.message ||
        "Clear failed";
      setMenuImportError(String(msg));
    } finally {
      setClearMenuLoading(false);
    }
  }

  async function sendWhatsAppMock() {
    await api.post("/whatsapp/send-mock", {
      recipientEmail: "students",
      extraMessage: "Important mess update — check the app.",
    });
    api.get("/whatsapp/history").then((r) => setWaHistory(r.data));
  }

  const chartData =
    overview?.mostLikedDishes?.map((d) => ({
      name: d.name?.slice(0, 12) || "?",
      avg: Number(d.avg?.toFixed(2)) || 0,
    })) || [];

  return (
    <AppShellLayout
      variant="admin"
      brand="Admin"
      brandKicker="Control centre"
      activeId={tab}
      onNavigate={setTab}
      onLogout={() => {
        logout();
        nav("/login");
      }}
      drawerSections={ADMIN_DRAWER}
      bottomItems={ADMIN_BOTTOM}
      drawerFooter={
        <p className="muted" style={{ margin: 0, fontSize: "0.78rem", lineHeight: 1.4 }}>
          Signed in as <strong>{user?.email}</strong>
        </p>
      }
    >
      <div className={styles.page}>
      {tab === "overview" && overview && (
        <>
          <div className={styles.stats}>
            <div className="card">
              <div className="muted">Students</div>
              <strong>{overview.totalStudents}</strong>
            </div>
            <div className="card">
              <div className="muted">Complaints</div>
              <strong>{overview.totalComplaints}</strong>
            </div>
            <div className="card">
              <div className="muted">Suggestions</div>
              <strong>{overview.totalSuggestions}</strong>
            </div>
            <div className="card">
              <div className="muted">Community posts</div>
              <strong>{overview.communityPosts}</strong>
            </div>
          </div>
          <div className="card" style={{ height: 280 }}>
            <h2>Dish ratings (avg)</h2>
            <ResponsiveContainer width="100%" height="85%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 5]} />
                <Tooltip />
                <Bar dataKey="avg" fill="#2d6a4f" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card">
            <h2>Highest waste (qty sum)</h2>
            <ul>
              {overview.highestWasteItems?.map((w) => (
                <li key={w.name}>
                  {w.name}: {w.quantity}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {tab === "users" && (
        <section className="card">
          <h2>Create user</h2>
          <form onSubmit={createUser} className={styles.form}>
            <input
              className="input"
              type="email"
              placeholder="email"
              value={newUser.email}
              onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              required
            />
            <input
              className="input"
              placeholder="name"
              value={newUser.name}
              onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
              required
            />
            <input
              className="input"
              type="password"
              placeholder="password"
              value={newUser.password}
              onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
              required
            />
            <select
              className="input"
              value={newUser.role}
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
            >
              <option value="STUDENT">STUDENT</option>
              <option value="MESS_INCHARGE">MESS_INCHARGE</option>
              <option value="ADMIN">ADMIN</option>
            </select>
            {newUser.role === "STUDENT" && (
              <>
                <label className={styles.fieldLabel}>Mess type</label>
                <select
                  className="input"
                  value={newUser.messType}
                  onChange={(e) => setNewUser({ ...newUser, messType: e.target.value })}
                >
                  {MESS_TYPES.map((m) => (
                    <option key={m} value={m}>
                      {m.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
                <label className={styles.fieldLabel}>Hostel block</label>
                <select
                  className="input"
                  value={newUser.hostelBlock}
                  onChange={(e) => setNewUser({ ...newUser, hostelBlock: e.target.value })}
                >
                  {HOSTEL_BLOCKS.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
                <label className={styles.fieldLabel}>Caterer</label>
                <select
                  className="input"
                  value={newUser.caterer}
                  onChange={(e) => setNewUser({ ...newUser, caterer: e.target.value })}
                >
                  {CATERERS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </>
            )}
            <button className="btn" type="submit">
              Create
            </button>
          </form>
          <h3>All users</h3>
          {users.map((u) => (
            <div key={u.id} className={styles.userRow}>
              <strong>{u.email}</strong> · {u.role} · {u.isActive ? "active" : "disabled"}
              {u.role === "STUDENT" && u.studentProfile && (
                <span className="muted">
                  {" "}
                  · {u.studentProfile.messType} · hostel {u.studentProfile.hostelBlock} ·{" "}
                  {u.studentProfile.caterer}
                </span>
              )}
            </div>
          ))}
        </section>
      )}

      {tab === "nightMess" && (
        <NightMessStaffPanel title="Night mess — fixed menu (admin, ₹ INR)" />
      )}

      {tab === "menu" && (
        <section className="card">
          <h2>Menu Excel &amp; CSV Import</h2>
          <p className="muted" style={{ fontSize: "0.88rem" }}>
            Upload weekly or daily schedules. Supports <strong>4-meals matrix format</strong> (each day as a row with <strong>Breakfast, Lunch, Snacks, Dinner</strong> as columns). Both Excel (<code>.xlsx</code>) and <code>.csv</code> files are supported!
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
          <form onSubmit={uploadMenuCsv} className={styles.form}>
            <label className="label">Menu Spreadsheet (.xlsx or .csv)</label>
            <FilePicker
              accept=".csv,.xlsx,.xls"
              file={menuFile}
              onChange={setMenuFile}
              chooseLabel="Select menu Excel / CSV file"
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
            <label className={styles.checkRow} style={{ marginTop: "0.5rem" }}>
              <input
                type="checkbox"
                checked={clearMenuFirst}
                onChange={(e) => setClearMenuFirst(e.target.checked)}
              />
              Clear existing menu schedule before import (weekly templates, dated menus, night mess)
            </label>
            <label className={styles.checkRow}>
              <input
                type="checkbox"
                checked={deleteMenuCatalog}
                onChange={(e) => setDeleteMenuCatalog(e.target.checked)}
              />
              Also delete dish catalog (all <code>MenuItem</code> rows). Removes reviews and
              complaints tied to those dishes — use when replacing the full menu from CSV.
            </label>
            <button className="btn" type="submit" disabled={menuImportLoading}>
              {menuImportLoading ? "Importing…" : "Upload Menu"}
            </button>
          </form>
          <div style={{ marginTop: "0.75rem" }}>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={clearMenuLoading}
              onClick={clearMenuOnly}
            >
              {clearMenuLoading ? "Clearing…" : "Clear menu data only (no upload)"}
            </button>
          </div>
          {menuImportError && (
            <p style={{ color: "var(--danger, #c62828)", marginTop: "0.75rem", fontSize: "0.9rem" }}>
              {menuImportError}
            </p>
          )}
          {menuImportResult && (
            <pre className={styles.pre}>{JSON.stringify(menuImportResult, null, 2)}</pre>
          )}

          <hr style={{ margin: "1.5rem 0", border: "none", borderTop: "1px solid var(--border, #e0e0e0)" }} />
          <h3 style={{ marginTop: 0 }}>Night mess CSV</h3>
          <p className="muted" style={{ fontSize: "0.88rem" }}>
            Rows must use <code>meal_slot</code> <strong>NIGHT_MESS</strong>, <code>service_date</code>{" "}
            (YYYY-MM-DD), <code>price</code>, <code>available_qty</code>, <code>remaining_qty</code>, and
            the usual nutrition columns.{" "}
            <a href="/sample_night_mess.csv" download>
              Download sample CSV
            </a>
            . The checkboxes above apply if you need to clear schedules before this upload.
          </p>
          <form onSubmit={uploadNightMessCsv} className={styles.form}>
            <label className="label">Night mess CSV file</label>
            <FilePicker
              accept=".csv"
              file={nightMessFile}
              onChange={setNightMessFile}
              chooseLabel="Select night mess CSV"
              emptySub="NIGHT_MESS + service_date + price + quantities"
              hint="Same API as menu import; file must contain night mess rows."
            />
            <button className="btn" type="submit" disabled={nightMessImportLoading}>
              {nightMessImportLoading ? "Importing…" : "Upload night mess CSV"}
            </button>
          </form>
          {nightMessImportError && (
            <p style={{ color: "var(--danger, #c62828)", marginTop: "0.75rem", fontSize: "0.9rem" }}>
              {nightMessImportError}
            </p>
          )}
          {nightMessImportResult && (
            <pre className={styles.pre}>{JSON.stringify(nightMessImportResult, null, 2)}</pre>
          )}
        </section>
      )}

      {tab === "advRequests" && (
        <section className="card">
          <h2>Advanced requests</h2>
          <p className="muted" style={{ fontSize: "0.88rem", marginTop: 0 }}>
            Students submit these from Profile or Advanced requests. Approving notifies mess staff and
            the student; rejecting notifies the student only.
          </p>
          {sortedAdvRequests.length === 0 && <p className="muted">No requests yet.</p>}
          {sortedAdvRequests.map((r) => (
            <article key={r.id} className={styles.complaintCard}>
              <div className={styles.complaintHead}>
                <strong>{advTypeLabel(r.requestType)}</strong>
                <span className={styles.complaintBadge}>
                  {r.status === "PENDING"
                    ? "Pending"
                    : r.status === "APPROVED"
                      ? "Approved"
                      : "Rejected"}
                </span>
              </div>
              <p className={styles.complaintMeta}>
                {r.user?.name} · {r.user?.email}
                {r.user?.studentProfile && (
                  <>
                    {" "}
                    · {r.user.studentProfile.messType} · block {r.user.studentProfile.hostelBlock}
                  </>
                )}
                <br />
                For date: {r.requestDate ? String(r.requestDate).slice(0, 10) : "—"} · Submitted{" "}
                {r.createdAt ? new Date(r.createdAt).toLocaleString() : "—"}
                {r.reviewedAt && (
                  <>
                    <br />
                    Reviewed: {new Date(r.reviewedAt).toLocaleString()}
                    {r.reviewedBy && ` · ${r.reviewedBy.name}`}
                  </>
                )}
              </p>
              <div className={styles.complaintDescLabel}>Description</div>
              <div className={styles.complaintDesc}>{r.description || "—"}</div>
              {r.proofPath && (
                <p style={{ margin: "0.5rem 0 0" }}>
                  <a href={r.proofPath} target="_blank" rel="noopener noreferrer">
                    View proof attachment
                  </a>
                </p>
              )}
              {r.status === "PENDING" && (
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="btn"
                    disabled={advBusyId === r.id}
                    onClick={() => approveAdv(r.id)}
                  >
                    {advBusyId === r.id ? "…" : "Approve"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={advBusyId === r.id}
                    onClick={() => rejectAdv(r.id)}
                  >
                    Reject
                  </button>
                </div>
              )}
            </article>
          ))}
        </section>
      )}

      {tab === "complaints" && (
        <section className="card">
          <h2>Complaints</h2>
          {complaints.map((c) => (
            <article key={c.id} className={styles.complaintCard}>
              <div className={styles.complaintHead}>
                <strong>{c.menuItem?.name || "—"}</strong>
                <span className={styles.complaintBadge}>{c.issueType?.replace(/_/g, " ")}</span>
                {c.escalated && (
                  <span className={styles.complaintEscalated}>Escalated</span>
                )}
              </div>
              <p className={styles.complaintMeta}>
                {c.user?.email} · {c.user?.name}
                {c.user?.studentProfile && (
                  <>
                    {" "}
                    · {c.user.studentProfile.messType} · {c.user.studentProfile.hostelBlock}
                  </>
                )}
                <br />
                Menu date: {c.menuDate ? String(c.menuDate).slice(0, 10) : "—"} · Status:{" "}
                {c.status || "—"} · Reported:{" "}
                {c.createdAt ? new Date(c.createdAt).toLocaleString() : "—"}
              </p>
              <div className={styles.complaintDescLabel}>Description</div>
              <div className={styles.complaintDesc}>
                {c.description?.trim()
                  ? c.description
                  : "— (no description provided)"}
              </div>
            </article>
          ))}
        </section>
      )}

      {tab === "community" && (
        <CommunityFeed
          showComposer={false}
          showStaffMeta
          title="Community"
          moderation={{
            onDeletePost: (id) => api.delete(`/admin/community/posts/${id}`),
            onDeleteComment: (id) => api.delete(`/admin/community/comments/${id}`),
          }}
        />
      )}

      {tab === "messSwap" && (
        <section className="card" style={{ margin: 0 }}>
          <h2 style={{ marginTop: 0 }}>Mess / caterer swap</h2>
          <p className="muted" style={{ fontSize: "0.88rem", marginTop: 0 }}>
            Manage caterer swap slots (FCFS), monitor applications, and approve mess type upgrades with
            assigned caterer.
          </p>
          <AdminMessSwapPanel />
        </section>
      )}

      {tab === "attendance" && (
        <section className="card" style={{ margin: 0 }}>
          <h2 style={{ marginTop: 0 }}>Meal attendance</h2>
          <p className="muted" style={{ fontSize: "0.88rem", marginTop: 0 }}>
            Use the OTP form below to mark students present (same as mess desk). Charts show participation,
            trends, and at-risk streaks (mock parent/warden logs in server console).
          </p>
          <AdminAttendancePanel />
        </section>
      )}

      {tab === "pdf" && (
        <section className="card">
          <h2>Monthly PDF (Groq + pdf-lib)</h2>
          <p className="muted" style={{ fontSize: "0.9rem" }}>
            Summarizes complaints, reviews, suggestions, leftovers, community. Add{" "}
            <code>GROQ_API_KEY</code> for richer text.
          </p>
          <button className="btn" type="button" disabled={pdfBusy} onClick={downloadPdf}>
            {pdfBusy ? "Building…" : "Download PDF"}
          </button>
        </section>
      )}

      {tab === "whatsapp" && (
        <section className="card">
          <h2>WhatsApp (mock)</h2>
          <p className="muted">Templates + mocked send + history.</p>
          <button type="button" className="btn" onClick={sendWhatsAppMock}>
            Send mock alert
          </button>
          <h3>Templates</h3>
          {waTemplates.map((t) => (
            <div key={t.id} className={styles.userRow}>
              {t.name}
            </div>
          ))}
          <h3>History</h3>
          {waHistory.map((h) => (
            <div key={h.id} className={styles.userRow}>
              {h.status} — {new Date(h.createdAt).toLocaleString()}
            </div>
          ))}
        </section>
      )}

      {tab === "voting" && <AdminVotingPlannerPanel />}
      </div>
    </AppShellLayout>
  );
}
