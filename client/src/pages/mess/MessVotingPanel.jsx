import React, { useEffect, useState } from "react";
import {
  IoAddOutline,
  IoCloudUploadOutline,
  IoDownloadOutline,
  IoCheckmarkCircle,
  IoCloseCircle,
  IoAlertCircleOutline,
  IoEyeOutline,
  IoEyeOffOutline,
  IoTimeOutline,
  IoShieldCheckmarkOutline,
  IoCloseOutline,
} from "react-icons/io5";
import api from "../../api/client.js";
import styles from "./MessVotingPanel.module.css";

const VALID_MEALS = ["BREAKFAST", "LUNCH", "SNACKS", "DINNER"];

export default function MessVotingPanel() {
  const [subTab, setSubTab] = useState("candidates"); // candidates | csv | history
  const [polls, setPolls] = useState([]);
  const [selectedPollId, setSelectedPollId] = useState("");
  const [pollDetails, setPollDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState("");

  // Add Candidate modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    dishName: "",
    categoryId: "",
    messType: "VEG",
    mealSlot: "LUNCH",
    description: "",
    calories: 250,
    proteinG: 10,
    carbsG: 30,
    fatsG: 8,
    allergens: "",
    dietaryTagsStr: "",
  });
  const [submittingAdd, setSubmittingAdd] = useState(false);

  // CSV Importer state
  const [csvFile, setCsvFile] = useState(null);
  const [csvPreview, setCsvPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  // Audit history
  const [audits, setAudits] = useState([]);

  useEffect(() => {
    loadPolls();
  }, []);

  async function loadPolls() {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get("/menu-polls");
      setPolls(res.data);
      if (res.data.length > 0) {
        setSelectedPollId(res.data[0].id);
        await loadPollDetails(res.data[0].id);
      }
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load polls");
    } finally {
      setLoading(false);
    }
  }

  async function loadPollDetails(pollId) {
    try {
      const res = await api.get(`/menu-polls/${pollId}`);
      setPollDetails(res.data);
      if (res.data.categories?.length > 0) {
        setAddForm((prev) => ({ ...prev, categoryId: res.data.categories[0].id }));
      }
      loadAudits(pollId);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load poll details");
    }
  }

  async function loadAudits(pollId) {
    try {
      const res = await api.get(`/menu-polls/${pollId}/audits`);
      setAudits(res.data);
    } catch {}
  }

  async function handleToggleAvailability(candidate) {
    try {
      await api.patch(`/menu-polls/${selectedPollId}/candidates/${candidate.id}`, {
        isAvailable: !candidate.isAvailable,
      });
      setSuccessMsg(
        `Candidate "${candidate.dishName}" marked as ${
          candidate.isAvailable ? "UNAVAILABLE" : "AVAILABLE"
        }. Historical votes remain preserved.`
      );
      loadPollDetails(selectedPollId);
      setTimeout(() => setSuccessMsg(""), 5000);
    } catch (err) {
      alert(err.response?.data?.error || "Failed to update availability");
    }
  }

  async function handleAddCandidateSubmit(e) {
    e.preventDefault();
    if (!addForm.dishName.trim()) return;
    try {
      setSubmittingAdd(true);
      const dietaryTags = addForm.dietaryTagsStr
        ? addForm.dietaryTagsStr.split(",").map((s) => s.trim()).filter(Boolean)
        : [];

      const res = await api.post(`/menu-polls/${selectedPollId}/candidates`, {
        ...addForm,
        dietaryTags,
      });

      setSuccessMsg(
        res.data.status === "APPROVED"
          ? `Candidate "${res.data.dishName}" added successfully!`
          : `Candidate proposal for "${res.data.dishName}" submitted for Admin approval (Mode A).`
      );
      setShowAddModal(false);
      setAddForm({
        dishName: "",
        categoryId: pollDetails?.categories[0]?.id || "",
        messType: "VEG",
        mealSlot: "LUNCH",
        description: "",
        calories: 250,
        proteinG: 10,
        carbsG: 30,
        fatsG: 8,
        allergens: "",
        dietaryTagsStr: "",
      });
      loadPollDetails(selectedPollId);
      setTimeout(() => setSuccessMsg(""), 5000);
    } catch (err) {
      alert(err.response?.data?.error || "Failed to add candidate");
    } finally {
      setSubmittingAdd(false);
    }
  }

  function handleDownloadTemplate() {
    window.open(`/api/menu-polls/${selectedPollId}/candidates/template`, "_blank");
  }

  async function handlePreviewCsv() {
    if (!csvFile) return;
    try {
      setPreviewLoading(true);
      setError(null);
      const formData = new FormData();
      formData.append("file", csvFile);
      const res = await api.post(`/menu-polls/${selectedPollId}/candidates/preview`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setCsvPreview(res.data);
    } catch (err) {
      alert(err.response?.data?.error || "CSV validation error");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleCommitCsvImport() {
    if (!csvPreview?.validRows?.length) return;
    try {
      setImporting(true);
      const res = await api.post(`/menu-polls/${selectedPollId}/candidates/import`, {
        rows: csvPreview.validRows,
      });
      setSuccessMsg(
        `Imported ${res.data.importedCount} candidates successfully (Status: ${res.data.status}).`
      );
      setCsvPreview(null);
      setCsvFile(null);
      loadPollDetails(selectedPollId);
      setTimeout(() => setSuccessMsg(""), 5000);
    } catch (err) {
      alert(err.response?.data?.error || "Failed to import CSV candidates");
    } finally {
      setImporting(false);
    }
  }

  if (loading) {
    return <p className="muted">Loading candidate management...</p>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.scopeBanner}>
        <IoShieldCheckmarkOutline size={20} />
        <div>
          <strong>Authorized Mess Scope:</strong> You have active management privileges for polls associated with your assigned mess operations. Candidates proposed during live voting follow the configured approval and fairness policies.
        </div>
      </div>

      {successMsg && (
        <div className="card" style={{ background: "#ecfdf5", borderColor: "#a7f3d0", color: "#065f46" }}>
          <IoCheckmarkCircle size={18} /> {successMsg}
        </div>
      )}

      {/* Top Bar */}
      <div className={styles.topBar}>
        <div>
          <h2 style={{ margin: "0 0 0.25rem" }}>Live Candidate Management</h2>
          <p className="muted" style={{ margin: 0, fontSize: "0.88rem" }}>
            Manage candidates, propose new dishes, toggle availability, and import candidate lists via CSV.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          {polls.length > 0 && (
            <select
              className="input"
              value={selectedPollId}
              onChange={(e) => {
                setSelectedPollId(e.target.value);
                loadPollDetails(e.target.value);
              }}
            >
              {polls.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.status})
                </option>
              ))}
            </select>
          )}

          <button className="btn" onClick={() => setShowAddModal(true)}>
            <IoAddOutline size={18} /> Propose Candidate
          </button>
        </div>
      </div>

      {/* Sub Tabs */}
      <div className={styles.tabRow}>
        <button
          className={`${styles.subTabBtn} ${subTab === "candidates" ? styles.active : ""}`}
          onClick={() => setSubTab("candidates")}
        >
          Candidates Catalog
        </button>
        <button
          className={`${styles.subTabBtn} ${subTab === "csv" ? styles.active : ""}`}
          onClick={() => setSubTab("csv")}
        >
          <IoCloudUploadOutline size={16} /> CSV Importer
        </button>
        <button
          className={`${styles.subTabBtn} ${subTab === "history" ? styles.active : ""}`}
          onClick={() => setSubTab("history")}
        >
          <IoTimeOutline size={16} /> Change History & Audits
        </button>
      </div>

      {/* CANDIDATES SUB-TAB */}
      {subTab === "candidates" && (
        <div>
          {pollDetails?.categories?.map((cat) => (
            <div key={cat.id} className="card" style={{ marginBottom: "1.25rem" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderBottom: "1px solid var(--border)",
                  paddingBottom: "0.5rem",
                }}
              >
                <div>
                  <h3 style={{ margin: 0 }}>{cat.name}</h3>
                  <span className="muted" style={{ fontSize: "0.8rem" }}>
                    Meal Slot: {cat.mealSlot} | Max Votes: {cat.maxSelections} | Candidates: {cat.candidates?.length || 0}
                  </span>
                </div>
              </div>

              {cat.candidates?.length === 0 ? (
                <p className="muted" style={{ padding: "1rem 0", margin: 0 }}>
                  No candidates listed in this category yet.
                </p>
              ) : (
                <table className={styles.candidateTable}>
                  <thead>
                    <tr>
                      <th>Dish Name</th>
                      <th>Mess</th>
                      <th>Nutrition</th>
                      <th>Status</th>
                      <th>Votes</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cat.candidates.map((cand) => (
                      <tr key={cand.id}>
                        <td>
                          <strong>{cand.dishName}</strong>
                          {cand.isLiveAddition && (
                            <span
                              style={{
                                marginLeft: "6px",
                                fontSize: "0.72rem",
                                background: "#ede9fe",
                                color: "#5b21b6",
                                padding: "2px 6px",
                                borderRadius: 4,
                              }}
                            >
                              Late Entry
                            </span>
                          )}
                          <div className="muted" style={{ fontSize: "0.78rem" }}>
                            {cand.description || "No description"}
                          </div>
                        </td>
                        <td>
                          <span
                            style={{
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              padding: "2px 6px",
                              borderRadius: 4,
                              background: "var(--surface-2)",
                            }}
                          >
                            {cand.messType}
                          </span>
                        </td>
                        <td style={{ fontSize: "0.8rem" }}>
                          {cand.calories} kcal | P: {cand.proteinG}g
                        </td>
                        <td>
                          <span
                            style={{
                              fontSize: "0.75rem",
                              fontWeight: 700,
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
                        <td style={{ fontWeight: 700 }}>{cand.voteCount}</td>
                        <td>
                          <button
                            className="btn btn-ghost"
                            style={{
                              padding: "0.3rem 0.65rem",
                              fontSize: "0.78rem",
                              color: cand.isAvailable ? "var(--danger)" : "var(--accent)",
                            }}
                            onClick={() => handleToggleAvailability(cand)}
                          >
                            {cand.isAvailable ? (
                              <>
                                <IoEyeOffOutline size={14} /> Mark Unavailable
                              </>
                            ) : (
                              <>
                                <IoEyeOutline size={14} /> Mark Available
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      )}

      {/* CSV SUB-TAB */}
      {subTab === "csv" && (
        <div>
          <div className="card" style={{ marginBottom: "1rem" }}>
            <h3>CSV Candidate Importer</h3>
            <p className="muted" style={{ margin: "0 0 1rem" }}>
              Bulk upload dishes into this poll using our standardized template. Row-level validation checks ensure mess authorization, slot validity, and duplicate prevention.
            </p>

            <button className="btn btn-ghost" onClick={handleDownloadTemplate} style={{ marginBottom: "1rem" }}>
              <IoDownloadOutline size={18} /> Download Candidate CSV Template
            </button>

            <div className={styles.csvBox}>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => {
                  setCsvFile(e.target.files[0] || null);
                  setCsvPreview(null);
                }}
              />
              <p className="muted" style={{ margin: "0.5rem 0 0" }}>
                Select a valid .csv file containing candidates
              </p>
            </div>

            {csvFile && (
              <button
                className="btn"
                onClick={handlePreviewCsv}
                disabled={previewLoading}
                style={{ marginBottom: "1rem" }}
              >
                {previewLoading ? "Validating CSV…" : "Validate & Preview Rows"}
              </button>
            )}

            {csvPreview && (
              <div>
                <div
                  style={{
                    display: "flex",
                    gap: "1rem",
                    background: "var(--surface-2)",
                    padding: "0.85rem",
                    borderRadius: "var(--radius-sm)",
                    marginBottom: "1rem",
                  }}
                >
                  <span>Total Rows: <strong>{csvPreview.summary.totalRows}</strong></span>
                  <span style={{ color: "var(--accent)" }}>
                    Valid Rows: <strong>{csvPreview.summary.validRowsCount}</strong>
                  </span>
                  <span style={{ color: "var(--danger)" }}>
                    Errors/Duplicates: <strong>{csvPreview.summary.errorRowsCount}</strong>
                  </span>
                </div>

                {csvPreview.errorRows?.length > 0 && (
                  <div style={{ marginBottom: "1rem" }}>
                    <h4 style={{ color: "var(--danger)", margin: "0 0 0.5rem" }}>Validation Issues</h4>
                    <table className={styles.previewTable}>
                      <thead>
                        <tr>
                          <th>Row</th>
                          <th>Dish Name</th>
                          <th>Errors Detected</th>
                        </tr>
                      </thead>
                      <tbody>
                        {csvPreview.errorRows.map((err, i) => (
                          <tr key={i} className={styles.errorRow}>
                            <td>{err.row}</td>
                            <td>{err.dishName}</td>
                            <td>{err.errors.join("; ")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {csvPreview.validRows?.length > 0 && (
                  <div>
                    <h4 style={{ color: "var(--accent)", margin: "0 0 0.5rem" }}>
                      Ready to Import ({csvPreview.validRows.length} candidates)
                    </h4>
                    <table className={styles.previewTable} style={{ marginBottom: "1rem" }}>
                      <thead>
                        <tr>
                          <th>Row</th>
                          <th>Dish Name</th>
                          <th>Mess Type</th>
                          <th>Slot</th>
                          <th>Category</th>
                          <th>Calories</th>
                        </tr>
                      </thead>
                      <tbody>
                        {csvPreview.validRows.map((r, i) => (
                          <tr key={i} className={styles.validRow}>
                            <td>{r.row}</td>
                            <td><strong>{r.dishName}</strong></td>
                            <td>{r.messType}</td>
                            <td>{r.mealSlot}</td>
                            <td>{r.categoryName}</td>
                            <td>{r.calories} kcal</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <button
                      className="btn"
                      onClick={handleCommitCsvImport}
                      disabled={importing}
                    >
                      {importing ? "Importing…" : "Confirm & Import Valid Candidates"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* HISTORY SUB-TAB */}
      {subTab === "history" && (
        <div className="card">
          <h3>Audit Log & Change History</h3>
          <p className="muted" style={{ margin: "0 0 1rem" }}>
            Immutable audit record of candidate proposals, CSV imports, availability changes, and approvals.
          </p>

          {audits.length === 0 ? (
            <p className="muted">No audit logs recorded for this poll yet.</p>
          ) : (
            <table className={styles.candidateTable}>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Action</th>
                  <th>Actor</th>
                  <th>Candidate / Details</th>
                </tr>
              </thead>
              <tbody>
                {audits.map((a) => {
                  let details = {};
                  try {
                    details = JSON.parse(a.details || "{}");
                  } catch {}

                  return (
                    <tr key={a.id}>
                      <td style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                        {new Date(a.createdAt).toLocaleString()}
                      </td>
                      <td>
                        <strong>{a.action}</strong>
                      </td>
                      <td>
                        {a.actor?.name} ({a.actorRole})
                      </td>
                      <td style={{ fontSize: "0.84rem" }}>
                        {a.candidate?.dishName ? `${a.candidate.dishName} — ` : ""}
                        {JSON.stringify(details)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Propose Candidate Modal */}
      {showAddModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1rem",
              }}
            >
              <h3 style={{ margin: 0 }}>Propose / Add Candidate Dish</h3>
              <button
                className="btn-ghost"
                style={{ padding: "0.2rem", border: "none" }}
                onClick={() => setShowAddModal(false)}
              >
                <IoCloseOutline size={22} />
              </button>
            </div>

            <form onSubmit={handleAddCandidateSubmit}>
              <div className={styles.formGrid}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: "0.85rem", fontWeight: 700 }}>Dish Name *</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Amritsari Chole Kulche"
                    value={addForm.dishName}
                    onChange={(e) => setAddForm({ ...addForm, dishName: e.target.value })}
                    required
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: "0.85rem", fontWeight: 700 }}>Voting Category *</label>
                  <select
                    className="input"
                    value={addForm.categoryId}
                    onChange={(e) => setAddForm({ ...addForm, categoryId: e.target.value })}
                    required
                  >
                    {pollDetails?.categories?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.mealSlot})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: "0.85rem", fontWeight: 700 }}>Mess Type *</label>
                  <select
                    className="input"
                    value={addForm.messType}
                    onChange={(e) => setAddForm({ ...addForm, messType: e.target.value })}
                  >
                    <option value="VEG">Veg Mess</option>
                    <option value="NON_VEG">Non-Veg Mess</option>
                    <option value="SPECIAL">Special Mess</option>
                    <option value="FOODPARK">Foodpark</option>
                  </select>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: "0.85rem", fontWeight: 700 }}>Meal Slot *</label>
                  <select
                    className="input"
                    value={addForm.mealSlot}
                    onChange={(e) => setAddForm({ ...addForm, mealSlot: e.target.value })}
                  >
                    {VALID_MEALS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: "0.85rem", fontWeight: 700 }}>Calories (kcal)</label>
                  <input
                    type="number"
                    className="input"
                    value={addForm.calories}
                    onChange={(e) => setAddForm({ ...addForm, calories: e.target.value })}
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: "0.85rem", fontWeight: 700 }}>Protein (g)</label>
                  <input
                    type="number"
                    className="input"
                    value={addForm.proteinG}
                    onChange={(e) => setAddForm({ ...addForm, proteinG: e.target.value })}
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: "0.85rem", fontWeight: 700 }}>Carbohydrates (g)</label>
                  <input
                    type="number"
                    className="input"
                    value={addForm.carbsG}
                    onChange={(e) => setAddForm({ ...addForm, carbsG: e.target.value })}
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: "0.85rem", fontWeight: 700 }}>Fat (g)</label>
                  <input
                    type="number"
                    className="input"
                    value={addForm.fatsG}
                    onChange={(e) => setAddForm({ ...addForm, fatsG: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: "0.75rem" }}>
                <label style={{ fontSize: "0.85rem", fontWeight: 700 }}>Allergens (if any)</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Dairy, Gluten, Peanuts"
                  value={addForm.allergens}
                  onChange={(e) => setAddForm({ ...addForm, allergens: e.target.value })}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: "0.75rem" }}>
                <label style={{ fontSize: "0.85rem", fontWeight: 700 }}>Dietary Tags (comma-separated)</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. High Protein, Vegetarian, North Indian"
                  value={addForm.dietaryTagsStr}
                  onChange={(e) => setAddForm({ ...addForm, dietaryTagsStr: e.target.value })}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: "1.25rem" }}>
                <label style={{ fontSize: "0.85rem", fontWeight: 700 }}>Description</label>
                <textarea
                  className="input"
                  rows={2}
                  placeholder="Short description of dish ingredients & cooking style"
                  value={addForm.description}
                  onChange={(e) => setAddForm({ ...addForm, description: e.target.value })}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn" disabled={submittingAdd}>
                  {submittingAdd ? "Submitting…" : "Submit Candidate"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
