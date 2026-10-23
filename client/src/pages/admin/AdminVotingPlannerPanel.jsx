import React, { useEffect, useState } from "react";
import {
  IoAddOutline,
  IoPlayOutline,
  IoPauseOutline,
  IoCheckmarkDoneOutline,
  IoArchiveOutline,
  IoCloseCircleOutline,
  IoCheckmarkCircle,
  IoCloseOutline,
  IoCloudUploadOutline,
  IoDownloadOutline,
  IoLockClosed,
  IoLockOpenOutline,
  IoSparklesOutline,
  IoCalendarOutline,
  IoTimeOutline,
  IoStatsChartOutline,
  IoBulbOutline,
  IoCheckmark,
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
import styles from "./AdminVotingPlannerPanel.module.css";

const MESS_TYPES_ALL = ["VEG", "NON_VEG", "SPECIAL", "FOODPARK"];

export default function AdminVotingPlannerPanel() {
  const [tab, setTab] = useState("polls"); // polls | candidates | suggestions | analytics | planner | audits
  const [polls, setPolls] = useState([]);
  const [selectedPollId, setSelectedPollId] = useState("");
  const [pollDetails, setPollDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [successMsg, setSuccessMsg] = useState("");

  // Create Poll Modal
  const [showCreatePollModal, setShowCreatePollModal] = useState(false);
  const [pollForm, setPollForm] = useState({
    name: "",
    description: "",
    targetMonth: new Date().getMonth() + 2 > 12 ? 1 : new Date().getMonth() + 2,
    targetYear: new Date().getFullYear(),
    startDate: new Date().toISOString().slice(0, 16),
    endDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 16),
    messTypes: ["VEG", "NON_VEG", "SPECIAL", "FOODPARK"],
    maxSelectionsPerCategory: 3,
    allowBallotEdit: true,
    showLiveResults: true,
    allowLiveCandidateAdditions: true,
    requireCandidateApproval: true,
    fairnessPolicy: "LATE_ENTRY_FLAG",
    tieBreakerPolicy: "ADMIN_REVIEW",
    weekNumbering: "CALENDAR_WEEKS",
  });

  // Suggestion moderation
  const [suggestions, setSuggestions] = useState([]);
  const [suggFilter, setSuggFilter] = useState("ALL");

  // Monthly Planner state
  const [plans, setPlans] = useState([]);
  const [currentPlan, setCurrentPlan] = useState(null);
  const [plannerLoading, setPlannerLoading] = useState(false);
  const [plannerForm, setPlannerForm] = useState({
    targetMonth: new Date().getMonth() + 2 > 12 ? 1 : new Date().getMonth() + 2,
    targetYear: new Date().getFullYear(),
    weekConvention: "CALENDAR_WEEKS",
    messTypes: ["VEG", "NON_VEG", "SPECIAL", "FOODPARK"],
  });
  const [validationReport, setValidationReport] = useState(null);

  // Audits
  const [audits, setAudits] = useState([]);

  useEffect(() => {
    loadPolls();
    loadSuggestions();
    loadPlans();
  }, []);

  async function loadPolls() {
    try {
      setLoading(true);
      const res = await api.get("/menu-polls");
      setPolls(res.data);
      if (res.data.length > 0) {
        setSelectedPollId(res.data[0].id);
        await loadPollDetails(res.data[0].id);
      }
    } catch {} finally {
      setLoading(false);
    }
  }

  async function loadPollDetails(pollId) {
    try {
      const res = await api.get(`/menu-polls/${pollId}`);
      setPollDetails(res.data);
      loadAudits(pollId);
    } catch {}
  }

  async function loadSuggestions() {
    try {
      const res = await api.get("/dish-suggestions");
      setSuggestions(res.data);
    } catch {}
  }

  async function loadPlans() {
    try {
      const res = await api.get("/monthly-planner");
      setPlans(res.data);
      if (res.data.length > 0) {
        loadPlanDetails(res.data[0].id);
      }
    } catch {}
  }

  async function loadPlanDetails(planId) {
    try {
      setPlannerLoading(true);
      const res = await api.get(`/monthly-planner/${planId}`);
      setCurrentPlan(res.data);
      const valRes = await api.get(`/monthly-planner/${planId}/validate`);
      setValidationReport(valRes.data);
    } catch {} finally {
      setPlannerLoading(false);
    }
  }

  async function loadAudits(pollId) {
    try {
      const res = await api.get(`/menu-polls/${pollId}/audits`);
      setAudits(res.data);
    } catch {}
  }

  async function handlePollStatus(pollId, newStatus) {
    let reason = "";
    if (newStatus === "CANCELLED") {
      reason = prompt("Please provide a reason for cancelling this poll:") || "Administrative decision";
    }
    try {
      await api.post(`/menu-polls/${pollId}/status`, { status: newStatus, reason });
      setSuccessMsg(`Poll status updated to ${newStatus}.`);
      loadPolls();
      setTimeout(() => setSuccessMsg(""), 5000);
    } catch (err) {
      alert(err.response?.data?.error || "Failed to update poll status");
    }
  }

  async function handleCreatePollSubmit(e) {
    e.preventDefault();
    try {
      await api.post("/menu-polls", pollForm);
      setSuccessMsg("Poll created successfully!");
      setShowCreatePollModal(false);
      loadPolls();
      setTimeout(() => setSuccessMsg(""), 5000);
    } catch (err) {
      alert(err.response?.data?.error || "Failed to create poll");
    }
  }

  async function handleModerateCandidate(candidateId, status) {
    let rejectionReason = "";
    if (status === "REJECTED") {
      rejectionReason = prompt("Rejection reason for mess manager:") || "Does not meet menu standards";
    }
    try {
      await api.post(`/menu-polls/${selectedPollId}/candidates/${candidateId}/review`, {
        status,
        rejectionReason,
      });
      setSuccessMsg(`Candidate proposal ${status}.`);
      loadPollDetails(selectedPollId);
      setTimeout(() => setSuccessMsg(""), 5000);
    } catch (err) {
      alert(err.response?.data?.error || "Failed to review proposal");
    }
  }

  async function handleModerateSuggestion(suggId, status) {
    const reason = prompt(`Enter moderation remarks for ${status}:`) || "";
    try {
      await api.post(`/dish-suggestions/${suggId}/moderate`, {
        status,
        moderationReason: reason,
      });
      setSuccessMsg(`Suggestion marked as ${status}.`);
      loadSuggestions();
      setTimeout(() => setSuccessMsg(""), 5000);
    } catch (err) {
      alert(err.response?.data?.error || "Failed to moderate suggestion");
    }
  }

  async function handleGeneratePlan() {
    try {
      setPlannerLoading(true);
      const res = await api.post("/monthly-planner/generate", {
        pollId: selectedPollId || undefined,
        ...plannerForm,
      });
      setSuccessMsg("Date-specific monthly menu plan generated!");
      setCurrentPlan(res.data);
      loadPlans();
      const valRes = await api.get(`/monthly-planner/${res.data.id}/validate`);
      setValidationReport(valRes.data);
      setTimeout(() => setSuccessMsg(""), 5000);
    } catch (err) {
      alert(err.response?.data?.error || "Failed to generate plan");
    } finally {
      setPlannerLoading(false);
    }
  }

  async function handleToggleItemLock(item) {
    try {
      await api.patch(`/monthly-planner/items/${item.id}`, {
        isLocked: !item.isLocked,
      });
      loadPlanDetails(currentPlan.id);
    } catch (err) {
      alert(err.response?.data?.error || "Failed to toggle pin lock");
    }
  }

  async function handlePublishPlan() {
    if (!currentPlan) return;
    if (
      !confirm(
        `Are you sure you want to publish the official menu for ${currentPlan.name}? This will populate live daily menus for all students and mess managers!`
      )
    )
      return;

    try {
      const res = await api.post(`/monthly-planner/${currentPlan.id}/publish`);
      setSuccessMsg(res.data.message || "Monthly menu published successfully!");
      loadPlanDetails(currentPlan.id);
      setTimeout(() => setSuccessMsg(""), 6000);
    } catch (err) {
      alert(err.response?.data?.error || "Failed to publish monthly menu");
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.topBar}>
        <div>
          <h2 style={{ margin: "0 0 0.25rem" }}>Monthly Menu Voting & Planning System</h2>
          <p className="muted" style={{ margin: 0, fontSize: "0.88rem" }}>
            Admin control center for monthly polls, approval voting, dish candidate approvals, and date-specific menu generation.
          </p>
        </div>

        <button className="btn" onClick={() => setShowCreatePollModal(true)}>
          <IoAddOutline size={18} /> Create New Poll
        </button>
      </div>

      {successMsg && (
        <div className="card" style={{ background: "#ecfdf5", borderColor: "#a7f3d0", color: "#065f46" }}>
          <IoCheckmarkCircle size={18} /> {successMsg}
        </div>
      )}

      {/* Sub Tabs */}
      <div className={styles.subTabNav}>
        <button
          className={`${styles.subTabBtn} ${tab === "polls" ? styles.active : ""}`}
          onClick={() => setTab("polls")}
        >
          <IoTimeOutline size={16} /> Poll Lifecycle ({polls.length})
        </button>
        <button
          className={`${styles.subTabBtn} ${tab === "candidates" ? styles.active : ""}`}
          onClick={() => setTab("candidates")}
        >
          Candidate Moderation
        </button>
        <button
          className={`${styles.subTabBtn} ${tab === "suggestions" ? styles.active : ""}`}
          onClick={() => setTab("suggestions")}
        >
          <IoBulbOutline size={16} /> Student Suggestions ({suggestions.length})
        </button>
        <button
          className={`${styles.subTabBtn} ${tab === "analytics" ? styles.active : ""}`}
          onClick={() => setTab("analytics")}
        >
          <IoStatsChartOutline size={16} /> Voting Analytics
        </button>
        <button
          className={`${styles.subTabBtn} ${tab === "planner" ? styles.active : ""}`}
          onClick={() => setTab("planner")}
        >
          <IoCalendarOutline size={16} /> Monthly Menu Planner
        </button>
        <button
          className={`${styles.subTabBtn} ${tab === "audits" ? styles.active : ""}`}
          onClick={() => setTab("audits")}
        >
          Audit Logs
        </button>
      </div>

      {/* 1. POLLS TAB */}
      {tab === "polls" && (
        <div>
          <div className={styles.pollList}>
            {polls.map((p) => (
              <div key={p.id} className={styles.pollCard}>
                <div>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.25rem" }}>
                    <h3 style={{ margin: 0 }}>{p.name}</h3>
                    <span
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 999,
                        background:
                          p.status === "OPEN"
                            ? "#d1fae5"
                            : p.status === "PAUSED"
                            ? "#fef3c7"
                            : p.status === "CLOSED"
                            ? "#e0e7ff"
                            : "#f3f4f6",
                        color:
                          p.status === "OPEN"
                            ? "#065f46"
                            : p.status === "PAUSED"
                            ? "#92400e"
                            : p.status === "CLOSED"
                            ? "#3730a3"
                            : "#374151",
                      }}
                    >
                      {p.status}
                    </span>
                  </div>
                  <p className="muted" style={{ margin: "0 0 0.5rem", fontSize: "0.85rem" }}>
                    Target: Month {p.targetMonth}/{p.targetYear} | Messes: {p.messTypes?.join(", ")}
                  </p>
                  <span className="muted" style={{ fontSize: "0.8rem" }}>
                    Voting Window: {new Date(p.startDate).toLocaleDateString()} — {new Date(p.endDate).toLocaleDateString()}
                  </span>
                </div>

                <div className={styles.pollActions}>
                  {p.status === "DRAFT" && (
                    <button className="btn" onClick={() => handlePollStatus(p.id, "OPEN")}>
                      <IoPlayOutline size={16} /> Open Voting
                    </button>
                  )}
                  {p.status === "OPEN" && (
                    <>
                      <button className="btn btn-ghost" onClick={() => handlePollStatus(p.id, "PAUSED")}>
                        <IoPauseOutline size={16} /> Pause
                      </button>
                      <button className="btn" onClick={() => handlePollStatus(p.id, "CLOSED")}>
                        <IoCheckmarkDoneOutline size={16} /> Close & Freeze
                      </button>
                    </>
                  )}
                  {p.status === "PAUSED" && (
                    <>
                      <button className="btn" onClick={() => handlePollStatus(p.id, "OPEN")}>
                        <IoPlayOutline size={16} /> Resume
                      </button>
                      <button className="btn btn-ghost" onClick={() => handlePollStatus(p.id, "CLOSED")}>
                        <IoCheckmarkDoneOutline size={16} /> Close & Freeze
                      </button>
                    </>
                  )}
                  {p.status === "CLOSED" && (
                    <button className="btn btn-ghost" onClick={() => handlePollStatus(p.id, "ARCHIVED")}>
                      <IoArchiveOutline size={16} /> Archive
                    </button>
                  )}
                  {["DRAFT", "OPEN", "PAUSED"].includes(p.status) && (
                    <button
                      className="btn btn-ghost"
                      style={{ color: "var(--danger)" }}
                      onClick={() => handlePollStatus(p.id, "CANCELLED")}
                    >
                      <IoCloseCircleOutline size={16} /> Cancel
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. CANDIDATES TAB */}
      {tab === "candidates" && (
        <div>
          <div className="card" style={{ marginBottom: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3>Candidate Proposals & Moderation</h3>
              {polls.length > 0 && (
                <select
                  className="input"
                  style={{ maxWidth: 280 }}
                  value={selectedPollId}
                  onChange={(e) => {
                    setSelectedPollId(e.target.value);
                    loadPollDetails(e.target.value);
                  }}
                >
                  {polls.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {pollDetails?.categories?.map((cat) => (
            <div key={cat.id} className="card" style={{ marginBottom: "1.25rem" }}>
              <h4>{cat.name} ({cat.mealSlot})</h4>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--border)", textAlign: "left" }}>
                    <th style={{ padding: "0.5rem" }}>Dish</th>
                    <th style={{ padding: "0.5rem" }}>Mess</th>
                    <th style={{ padding: "0.5rem" }}>Status</th>
                    <th style={{ padding: "0.5rem" }}>Proposer</th>
                    <th style={{ padding: "0.5rem" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {cat.candidates?.map((cand) => (
                    <tr key={cand.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "0.6rem 0.5rem" }}>
                        <strong>{cand.dishName}</strong>
                        {cand.isLiveAddition && (
                          <span style={{ fontSize: "0.72rem", background: "#ede9fe", color: "#5b21b6", padding: "1px 5px", borderRadius: 4, marginLeft: 4 }}>
                            Late Entry
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "0.6rem 0.5rem" }}>{cand.messType}</td>
                      <td style={{ padding: "0.6rem 0.5rem" }}>
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: "0.75rem",
                            padding: "2px 6px",
                            borderRadius: 4,
                            background:
                              cand.status === "APPROVED"
                                ? "#d1fae5"
                                : cand.status === "PENDING_APPROVAL"
                                ? "#fef3c7"
                                : "#fee2e2",
                            color:
                              cand.status === "APPROVED"
                                ? "#065f46"
                                : cand.status === "PENDING_APPROVAL"
                                ? "#92400e"
                                : "#991b1b",
                          }}
                        >
                          {cand.status}
                        </span>
                      </td>
                      <td style={{ padding: "0.6rem 0.5rem", fontSize: "0.8rem", color: "var(--muted)" }}>
                        {cand.submittedByRole}
                      </td>
                      <td style={{ padding: "0.6rem 0.5rem" }}>
                        {cand.status === "PENDING_APPROVAL" && (
                          <div style={{ display: "flex", gap: "0.35rem" }}>
                            <button
                              className="btn"
                              style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                              onClick={() => handleModerateCandidate(cand.id, "APPROVED")}
                            >
                              Approve
                            </button>
                            <button
                              className="btn btn-ghost"
                              style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem", color: "var(--danger)" }}
                              onClick={() => handleModerateCandidate(cand.id, "REJECTED")}
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* 3. SUGGESTIONS MODERATION TAB */}
      {tab === "suggestions" && (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h3>Student Dish Suggestions Moderation</h3>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              {["ALL", "PENDING", "APPROVED", "REJECTED", "DUPLICATE"].map((s) => (
                <button
                  key={s}
                  className={`btn ${suggFilter === s ? "" : "btn-ghost"}`}
                  style={{ padding: "0.3rem 0.7rem", fontSize: "0.8rem" }}
                  onClick={() => setSuggFilter(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--border)", textAlign: "left" }}>
                <th style={{ padding: "0.6rem" }}>Dish</th>
                <th style={{ padding: "0.6rem" }}>Student</th>
                <th style={{ padding: "0.6rem" }}>Slot / Mess</th>
                <th style={{ padding: "0.6rem" }}>Status</th>
                <th style={{ padding: "0.6rem" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {suggestions
                .filter((s) => suggFilter === "ALL" || s.status === suggFilter)
                .map((sugg) => (
                  <tr key={sugg.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "0.6rem" }}>
                      <strong>{sugg.dishName}</strong>
                      <div className="muted" style={{ fontSize: "0.78rem" }}>
                        {sugg.description || sugg.reason || "No description"}
                      </div>
                    </td>
                    <td style={{ padding: "0.6rem" }}>
                      {sugg.user?.name}
                      <div className="muted" style={{ fontSize: "0.75rem" }}>
                        {sugg.user?.studentProfile?.registrationNo || sugg.user?.email}
                      </div>
                    </td>
                    <td style={{ padding: "0.6rem", fontSize: "0.82rem" }}>
                      {sugg.mealSlot} | {sugg.messType}
                    </td>
                    <td style={{ padding: "0.6rem" }}>
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: "0.75rem",
                          padding: "2px 6px",
                          borderRadius: 4,
                          background:
                            sugg.status === "APPROVED"
                              ? "#d1fae5"
                              : sugg.status === "PENDING"
                              ? "#fef3c7"
                              : "#fee2e2",
                          color:
                            sugg.status === "APPROVED"
                              ? "#065f46"
                              : sugg.status === "PENDING"
                              ? "#92400e"
                              : "#991b1b",
                        }}
                      >
                        {sugg.status}
                      </span>
                    </td>
                    <td style={{ padding: "0.6rem" }}>
                      <div style={{ display: "flex", gap: "0.35rem" }}>
                        <button
                          className="btn"
                          style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                          onClick={() => handleModerateSuggestion(sugg.id, "APPROVED")}
                        >
                          Approve
                        </button>
                        <button
                          className="btn btn-ghost"
                          style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem", color: "var(--danger)" }}
                          onClick={() => handleModerateSuggestion(sugg.id, "REJECTED")}
                        >
                          Decline
                        </button>
                        <button
                          className="btn btn-ghost"
                          style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                          onClick={() => handleModerateSuggestion(sugg.id, "DUPLICATE")}
                        >
                          Duplicate
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 4. ANALYTICS TAB */}
      {tab === "analytics" && (
        <div>
          {pollDetails?.results ? (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
                <div className="card" style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--accent)" }}>
                    {pollDetails.results.turnoutPercentage !== null ? `${pollDetails.results.turnoutPercentage}%` : "N/A"}
                  </div>
                  <div className="muted" style={{ fontSize: "0.8rem", fontWeight: 700 }}>TURNOUT PERCENTAGE</div>
                </div>
                <div className="card" style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--accent)" }}>
                    {pollDetails.results.uniqueVotersCount}
                  </div>
                  <div className="muted" style={{ fontSize: "0.8rem", fontWeight: 700 }}>BALLOTS SUBMITTED</div>
                </div>
                <div className="card" style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--accent)" }}>
                    {pollDetails.results.totalEligibleVoters}
                  </div>
                  <div className="muted" style={{ fontSize: "0.8rem", fontWeight: 700 }}>ELIGIBLE STUDENTS</div>
                </div>
              </div>

              {pollDetails.results.categories?.map((cat) => (
                <div key={cat.categoryId} className="card" style={{ marginBottom: "1.5rem" }}>
                  <h3>{cat.categoryName} ({cat.mealSlot}) — Valid Ballots: {cat.validSubmittedBallots}</h3>
                  <div style={{ width: "100%", height: 220, margin: "1rem 0" }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={cat.candidates.slice(0, 7)} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis type="number" unit="%" domain={[0, 100]} />
                        <YAxis dataKey="dishName" type="category" width={120} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="voteSharePercentage" fill="var(--accent)" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">No results available for this poll.</p>
          )}
        </div>
      )}

      {/* 5. MONTHLY MENU PLANNER TAB */}
      {tab === "planner" && (
        <div>
          <div className="card" style={{ marginBottom: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
              <div>
                <h3 style={{ margin: "0 0 0.25rem" }}>Date-Specific Monthly Menu Generator</h3>
                <p className="muted" style={{ margin: 0, fontSize: "0.88rem" }}>
                  Generates an independent, genuinely date-specific menu for every day of the month based on top approval votes.
                </p>
              </div>

              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button className="btn" onClick={handleGeneratePlan} disabled={plannerLoading}>
                  <IoSparklesOutline size={18} /> {plannerLoading ? "Generating…" : "Generate Draft Menu"}
                </button>
                {currentPlan && (
                  <button className="btn" style={{ background: "#065f46" }} onClick={handlePublishPlan}>
                    <IoCheckmarkCircle size={18} /> Publish Official Menu
                  </button>
                )}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", marginTop: "1rem" }}>
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 700 }}>Target Month</label>
                <select
                  className="input"
                  value={plannerForm.targetMonth}
                  onChange={(e) => setPlannerForm({ ...plannerForm, targetMonth: Number(e.target.value) })}
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {new Date(2026, i).toLocaleString("en-US", { month: "long" })}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 700 }}>Target Year</label>
                <input
                  type="number"
                  className="input"
                  value={plannerForm.targetYear}
                  onChange={(e) => setPlannerForm({ ...plannerForm, targetYear: Number(e.target.value) })}
                />
              </div>

              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 700 }}>Week Numbering</label>
                <select
                  className="input"
                  value={plannerForm.weekConvention}
                  onChange={(e) => setPlannerForm({ ...plannerForm, weekConvention: e.target.value })}
                >
                  <option value="CALENDAR_WEEKS">Calendar Weeks (Mon - Sun)</option>
                  <option value="SEQUENTIAL_7_DAYS">Sequential 7-Day Blocks</option>
                </select>
              </div>
            </div>
          </div>

          {/* Validation Report */}
          {validationReport && (
            <div className={styles.validationBox}>
              <div className={validationReport.isValid ? styles.validStatus : styles.invalidStatus}>
                <IoCheckmarkCircle size={20} />
                <span>{validationReport.summary}</span>
              </div>
              {validationReport.warnings?.length > 0 && (
                <div style={{ marginTop: "0.5rem", fontSize: "0.85rem", color: "#b45309" }}>
                  <strong>Variety Warnings:</strong>
                  {validationReport.warnings.slice(0, 3).map((w, i) => (
                    <div key={i}>• {w}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Calendar Display */}
          {currentPlan && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h4>
                  {currentPlan.name} ({currentPlan.status}) — {currentPlan.totalEntriesCount} Date-Specific Slots
                </h4>
              </div>

              <div className={styles.calendarGrid}>
                {currentPlan.calendar?.map((day) => (
                  <div key={day.date} className={styles.dayCard}>
                    <div className={styles.dayHeader}>
                      <h5 className={styles.dayTitle}>
                        {new Date(day.date).toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                      </h5>
                      <span className={styles.weekTag}>Week {day.weekNumber}</span>
                    </div>

                    {["BREAKFAST", "LUNCH", "SNACKS", "DINNER"].map((slot) => (
                      <div key={slot} className={styles.mealBlock}>
                        <div className={styles.mealSlotTitle}>{slot}</div>
                        {day.meals[slot]?.map((dish) => (
                          <div key={dish.id} className={styles.dishItem}>
                            <span>
                              {dish.dishName}{" "}
                              <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
                                ({dish.messType})
                              </span>
                            </span>
                            <button
                              className={`${styles.lockBtn} ${dish.isLocked ? styles.locked : ""}`}
                              title={dish.isLocked ? "Pinned/Locked" : "Unlocked (can be randomized)"}
                              onClick={() => handleToggleItemLock(dish)}
                            >
                              {dish.isLocked ? <IoLockClosed size={16} /> : <IoLockOpenOutline size={16} />}
                            </button>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 6. AUDIT LOGS TAB */}
      {tab === "audits" && (
        <div className="card">
          <h3>Audit Log Timeline</h3>
          <p className="muted" style={{ margin: "0 0 1rem" }}>
            Comprehensive trace of voting lifecycle events, candidate approvals, live amendments, and publications.
          </p>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.86rem" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--border)", textAlign: "left" }}>
                <th style={{ padding: "0.6rem" }}>Timestamp</th>
                <th style={{ padding: "0.6rem" }}>Action</th>
                <th style={{ padding: "0.6rem" }}>Actor</th>
                <th style={{ padding: "0.6rem" }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {audits.map((a) => (
                <tr key={a.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "0.6rem", color: "var(--muted)" }}>
                    {new Date(a.createdAt).toLocaleString()}
                  </td>
                  <td style={{ padding: "0.6rem", fontWeight: 700 }}>{a.action}</td>
                  <td style={{ padding: "0.6rem" }}>
                    {a.actor?.name} ({a.actorRole})
                  </td>
                  <td style={{ padding: "0.6rem", fontSize: "0.8rem", color: "var(--muted)" }}>
                    {a.details}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* CREATE POLL MODAL */}
      {showCreatePollModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ margin: 0 }}>Create Monthly Menu Poll</h3>
              <button className="btn-ghost" style={{ border: "none" }} onClick={() => setShowCreatePollModal(false)}>
                <IoCloseOutline size={22} />
              </button>
            </div>

            <form onSubmit={handleCreatePollSubmit}>
              <div className={styles.formGrid}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: "0.85rem", fontWeight: 700 }}>Poll Name *</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. November 2026 Campus Menu Poll"
                    value={pollForm.name}
                    onChange={(e) => setPollForm({ ...pollForm, name: e.target.value })}
                    required
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: "0.85rem", fontWeight: 700 }}>Target Month & Year *</label>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <select
                      className="input"
                      value={pollForm.targetMonth}
                      onChange={(e) => setPollForm({ ...pollForm, targetMonth: Number(e.target.value) })}
                    >
                      {Array.from({ length: 12 }, (_, i) => (
                        <option key={i + 1} value={i + 1}>
                          Month {i + 1}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      className="input"
                      value={pollForm.targetYear}
                      onChange={(e) => setPollForm({ ...pollForm, targetYear: Number(e.target.value) })}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: "0.85rem", fontWeight: 700 }}>Voting Start Date/Time</label>
                  <input
                    type="datetime-local"
                    className="input"
                    value={pollForm.startDate}
                    onChange={(e) => setPollForm({ ...pollForm, startDate: e.target.value })}
                    required
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: "0.85rem", fontWeight: 700 }}>Voting End Date/Time</label>
                  <input
                    type="datetime-local"
                    className="input"
                    value={pollForm.endDate}
                    onChange={(e) => setPollForm({ ...pollForm, endDate: e.target.value })}
                    required
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: "0.85rem", fontWeight: 700 }}>Max Votes Per Category</label>
                  <input
                    type="number"
                    className="input"
                    min={1}
                    max={10}
                    value={pollForm.maxSelectionsPerCategory}
                    onChange={(e) => setPollForm({ ...pollForm, maxSelectionsPerCategory: Number(e.target.value) })}
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: "0.85rem", fontWeight: 700 }}>Live Voting Additions</label>
                  <select
                    className="input"
                    value={pollForm.allowLiveCandidateAdditions ? "true" : "false"}
                    onChange={(e) => setPollForm({ ...pollForm, allowLiveCandidateAdditions: e.target.value === "true" })}
                  >
                    <option value="true">Allowed (Mode B / Live Nominations)</option>
                    <option value="false">Require Staging & Admin Approval (Mode A)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: "1rem" }}>
                <label style={{ fontSize: "0.85rem", fontWeight: 700 }}>Description</label>
                <textarea
                  className="input"
                  rows={2}
                  value={pollForm.description}
                  onChange={(e) => setPollForm({ ...pollForm, description: e.target.value })}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowCreatePollModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn">
                  Create Poll
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
