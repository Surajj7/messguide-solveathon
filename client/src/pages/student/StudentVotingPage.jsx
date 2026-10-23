import React, { useEffect, useState, useMemo } from "react";
import {
  IoThumbsUpOutline,
  IoCheckmarkCircle,
  IoAlertCircleOutline,
  IoTimeOutline,
  IoBulbOutline,
  IoBarChartOutline,
  IoCloseOutline,
  IoCheckmark,
  IoRestaurantOutline,
  IoFlameOutline,
  IoShieldCheckmarkOutline,
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
import styles from "./StudentVotingPage.module.css";

export default function StudentVotingPage() {
  const [activeTab, setActiveTab] = useState("vote"); // vote | results | suggest
  const [polls, setPolls] = useState([]);
  const [selectedPollId, setSelectedPollId] = useState("");
  const [pollDetails, setPollDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Voting state: map of categoryId -> array of candidateIds
  const [selections, setSelections] = useState({});
  const [activeCatId, setActiveCatId] = useState("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [submittingVote, setSubmittingVote] = useState(false);
  const [voteSuccessMsg, setVoteSuccessMsg] = useState("");

  // Suggestions state
  const [mySuggestions, setMySuggestions] = useState([]);
  const [suggForm, setSuggForm] = useState({
    dishName: "",
    mealSlot: "LUNCH",
    messType: "VEG",
    description: "",
    reason: "",
  });
  const [suggSubmitting, setSuggSubmitting] = useState(false);
  const [suggSuccessMsg, setSuggSuccessMsg] = useState("");

  // Fetch active polls on mount
  useEffect(() => {
    loadPolls();
    loadSuggestions();
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
      setError(err.response?.data?.error || "Failed to load menu polls");
    } finally {
      setLoading(false);
    }
  }

  async function loadPollDetails(pollId) {
    try {
      const res = await api.get(`/menu-polls/${pollId}`);
      setPollDetails(res.data);
      if (res.data.categories?.length > 0) {
        setActiveCatId(res.data.categories[0].id);
      }
      // Populate student's previously submitted selections
      if (res.data.studentBallot) {
        setSelections(res.data.studentBallot);
      }
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load poll details");
    }
  }

  async function loadSuggestions() {
    try {
      const res = await api.get("/dish-suggestions/mine");
      setMySuggestions(res.data);
    } catch {}
  }

  const activeCategory = useMemo(() => {
    return pollDetails?.categories?.find((c) => c.id === activeCatId) || null;
  }, [pollDetails, activeCatId]);

  const currentCategorySelections = useMemo(() => {
    return selections[activeCatId] || [];
  }, [selections, activeCatId]);

  function toggleCandidate(candidateId) {
    if (!pollDetails || pollDetails.status !== "OPEN") return;
    const max = activeCategory?.maxSelections || 3;
    const current = selections[activeCatId] || [];

    if (current.includes(candidateId)) {
      setSelections({
        ...selections,
        [activeCatId]: current.filter((id) => id !== candidateId),
      });
    } else {
      if (current.length >= max) {
        alert(`You can select a maximum of ${max} dishes in ${activeCategory?.name}.`);
        return;
      }
      setSelections({
        ...selections,
        [activeCatId]: [...current, candidateId],
      });
    }
  }

  async function handleConfirmBallotSubmit() {
    if (!activeCatId) return;
    try {
      setSubmittingVote(true);
      setError(null);
      const candidateIds = selections[activeCatId] || [];
      const res = await api.put(`/menu-polls/${selectedPollId}/ballots/${activeCatId}`, {
        candidateIds,
      });
      setVoteSuccessMsg(res.data.message || "Your ballot was submitted successfully!");
      setShowConfirmModal(false);
      // Reload poll details to update vote counts & results
      await loadPollDetails(selectedPollId);
      setTimeout(() => setVoteSuccessMsg(""), 5000);
    } catch (err) {
      alert(err.response?.data?.error || "Failed to submit ballot");
    } finally {
      setSubmittingVote(false);
    }
  }

  async function handleSuggestSubmit(e) {
    e.preventDefault();
    if (!suggForm.dishName.trim()) return;
    try {
      setSuggSubmitting(true);
      setError(null);
      const res = await api.post("/dish-suggestions", suggForm);
      setSuggSuccessMsg(
        res.data.duplicateWarning
          ? `${res.data.duplicateWarning} Suggestion logged for review.`
          : "Your dish suggestion was submitted for moderation!"
      );
      setSuggForm({
        dishName: "",
        mealSlot: "LUNCH",
        messType: "VEG",
        description: "",
        reason: "",
      });
      loadSuggestions();
      setTimeout(() => setSuggSuccessMsg(""), 6000);
    } catch (err) {
      alert(err.response?.data?.error || "Failed to submit suggestion");
    } finally {
      setSuggSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <p className="muted">Loading menu voting portal…</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Page Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Menu Voting & Dish Suggestions</h1>
          <p className={styles.subTitle}>
            Vote on favorite dishes to shape next month’s official mess menu rotations.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabNav}>
        <button
          className={`${styles.tabBtn} ${activeTab === "vote" ? styles.active : ""}`}
          onClick={() => setActiveTab("vote")}
        >
          <IoThumbsUpOutline size={18} /> Cast Your Ballot
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === "results" ? styles.active : ""}`}
          onClick={() => setActiveTab("results")}
        >
          <IoBarChartOutline size={18} /> Results & Turnout
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === "suggest" ? styles.active : ""}`}
          onClick={() => setActiveTab("suggest")}
        >
          <IoBulbOutline size={18} /> Suggest a Dish
        </button>
      </div>

      {error && (
        <div className="card" style={{ borderLeft: "4px solid var(--danger)", color: "var(--danger)" }}>
          <p style={{ margin: 0 }}>{error}</p>
        </div>
      )}

      {/* VOTE TAB */}
      {activeTab === "vote" && (
        <div>
          {polls.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: "2.5rem 1rem" }}>
              <IoAlertCircleOutline size={48} color="var(--muted)" />
              <h3>No Active Menu Polls</h3>
              <p className="muted">There are currently no active polls open for your registered mess.</p>
            </div>
          ) : (
            <>
              {/* Poll Banner */}
              {pollDetails && (
                <div className={styles.pollBanner}>
                  <div className={styles.pollInfo}>
                    <h2>{pollDetails.name}</h2>
                    <p className={styles.desc} style={{ margin: "0 0 0.5rem" }}>
                      {pollDetails.description}
                    </p>
                    <div className={styles.badgeList}>
                      <span
                        className={`${styles.badge} ${
                          pollDetails.status === "OPEN"
                            ? styles.badgeSuccess
                            : styles.badgeNeutral
                        }`}
                      >
                        Status: {pollDetails.status}
                      </span>
                      <span className={`${styles.badge} ${styles.badgeNeutral}`}>
                        <IoTimeOutline /> Closes:{" "}
                        {new Date(pollDetails.endDate).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                      <span className={`${styles.badge} ${styles.badgeNeutral}`}>
                        Messes: {pollDetails.messTypes?.join(", ")}
                      </span>
                    </div>
                  </div>

                  {polls.length > 1 && (
                    <div>
                      <label style={{ fontSize: "0.8rem", fontWeight: 700, display: "block" }}>
                        Switch Poll:
                      </label>
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
                    </div>
                  )}
                </div>
              )}

              {voteSuccessMsg && (
                <div className={styles.submittedAlert}>
                  <span>
                    <IoCheckmarkCircle size={20} /> {voteSuccessMsg}
                  </span>
                  <button
                    className="btn btn-ghost"
                    style={{ padding: "0.2rem 0.6rem", fontSize: "0.8rem" }}
                    onClick={() => setVoteSuccessMsg("")}
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {/* Category Pills & Selection Limit */}
              {pollDetails?.categories?.length > 0 && (
                <div className={styles.categoryBar}>
                  <div className={styles.catPills}>
                    {pollDetails.categories.map((c) => {
                      const selCount = selections[c.id]?.length || 0;
                      return (
                        <button
                          key={c.id}
                          className={`${styles.catPill} ${activeCatId === c.id ? styles.active : ""}`}
                          onClick={() => setActiveCatId(c.id)}
                        >
                          {c.name} {selCount > 0 && `(${selCount})`}
                        </button>
                      );
                    })}
                  </div>

                  {activeCategory && (
                    <div
                      className={`${styles.limitCounter} ${
                        currentCategorySelections.length >= activeCategory.maxSelections
                          ? styles.limitReached
                          : ""
                      }`}
                    >
                      Selected {currentCategorySelections.length} / {activeCategory.maxSelections}
                    </div>
                  )}
                </div>
              )}

              {/* Candidate Dishes Grid */}
              {activeCategory?.candidates?.length === 0 ? (
                <div className="card" style={{ textAlign: "center", padding: "2rem" }}>
                  <p className="muted">No candidates registered in this category yet.</p>
                </div>
              ) : (
                <div className={styles.candidateGrid}>
                  {activeCategory?.candidates?.map((item) => {
                    const isSelected = currentCategorySelections.includes(item.id);
                    let dietaryTags = [];
                    try {
                      dietaryTags = JSON.parse(item.dietaryTags || "[]");
                    } catch {}

                    return (
                      <div
                        key={item.id}
                        className={`${styles.candidateCard} ${isSelected ? styles.selected : ""}`}
                        onClick={() => toggleCandidate(item.id)}
                      >
                        <div className={styles.cardTop}>
                          <div>
                            <h3>{item.dishName}</h3>
                            <div style={{ display: "flex", gap: "0.35rem", marginTop: "0.25rem" }}>
                              <span
                                className={`${styles.badge} ${
                                  item.messType === "VEG"
                                    ? styles.badgeSuccess
                                    : item.messType === "NON_VEG"
                                    ? styles.badgeDanger
                                    : styles.badgeWarning
                                }`}
                              >
                                {item.messType}
                              </span>
                              <span className={`${styles.badge} ${styles.badgeNeutral}`}>
                                {item.mealSlot}
                              </span>
                              {item.isLiveAddition && (
                                <span className={`${styles.badge} ${styles.badgeLate}`}>
                                  Late Entry
                                </span>
                              )}
                            </div>
                          </div>
                          <div className={styles.checkboxCircle}>
                            <IoCheckmark size={16} />
                          </div>
                        </div>

                        <p className={styles.desc}>
                          {item.description || "Freshly prepared campus kitchen recipe."}
                        </p>

                        {/* Verified Nutrition */}
                        <div className={styles.nutritionRow}>
                          <span className={styles.macroPill}>
                            <IoFlameOutline size={12} />{" "}
                            {item.calories > 0 ? `${item.calories} kcal` : "Not available"}
                          </span>
                          <span className={styles.macroPill}>
                            P: {item.proteinG > 0 ? `${item.proteinG}g` : "—"}
                          </span>
                          <span className={styles.macroPill}>
                            C: {item.carbsG > 0 ? `${item.carbsG}g` : "—"}
                          </span>
                          <span className={styles.macroPill}>
                            F: {item.fatsG > 0 ? `${item.fatsG}g` : "—"}
                          </span>
                        </div>

                        {/* Allergens */}
                        <div className={styles.allergenBox}>
                          <IoShieldCheckmarkOutline size={14} />
                          <span>
                            Allergens: {item.allergens || "Not available"}
                          </span>
                        </div>

                        {/* Dietary tags */}
                        {dietaryTags.length > 0 && (
                          <div className={styles.dietaryTags}>
                            {dietaryTags.map((t, idx) => (
                              <span key={idx} className={styles.dietPill}>
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Action Bar */}
              {pollDetails?.status === "OPEN" && (
                <div className={styles.stickyBar}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>
                      {currentCategorySelections.length} dishes selected for {activeCategory?.name}
                    </span>
                    <span className="muted" style={{ display: "block", fontSize: "0.8rem" }}>
                      {pollDetails.allowBallotEdit
                        ? "You can modify your selections anytime before poll closes."
                        : "Submissions are final for this poll."}
                    </span>
                  </div>
                  <button
                    className="btn"
                    disabled={submittingVote || currentCategorySelections.length === 0}
                    onClick={() => setShowConfirmModal(true)}
                  >
                    <IoThumbsUpOutline size={18} /> Submit Ballot
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* RESULTS TAB */}
      {activeTab === "results" && (
        <div className={styles.resultsContainer}>
          <div style={{ marginBottom: "1.5rem" }}>
            <h2>Poll Results & Analytics</h2>
            <p className="muted">
              Official approval voting count and vote share percentage calculated across eligible student ballots.
            </p>
          </div>

          {!pollDetails?.results ? (
            <div className="card" style={{ textAlign: "center", padding: "2.5rem 1rem" }}>
              <IoAlertCircleOutline size={40} color="var(--muted)" />
              <h3>Live Results Hidden</h3>
              <p className="muted">
                Results for this poll are configured to become visible once voting officially concludes.
              </p>
            </div>
          ) : (
            <div>
              {/* Turnout Overview */}
              <div className={styles.statsOverview}>
                <div className={styles.statCard}>
                  <div className={styles.statValue}>
                    {pollDetails.results.turnoutPercentage !== null
                      ? `${pollDetails.results.turnoutPercentage}%`
                      : "N/A"}
                  </div>
                  <div className={styles.statLabel}>Voter Turnout</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statValue}>{pollDetails.results.uniqueVotersCount}</div>
                  <div className={styles.statLabel}>Ballots Cast</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statValue}>
                    {pollDetails.results.totalEligibleVoters || "All"}
                  </div>
                  <div className={styles.statLabel}>Eligible Students</div>
                </div>
              </div>

              <div
                style={{
                  background: "var(--surface-2)",
                  padding: "0.75rem 1rem",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border)",
                  fontSize: "0.85rem",
                  color: "var(--muted)",
                  marginBottom: "1.5rem",
                }}
              >
                ℹ️ <strong>Calculation Method:</strong> {pollDetails.results.denominatorNote}
              </div>

              {/* Category-by-Category Breakdown */}
              {pollDetails.results.categories?.map((cat) => (
                <div key={cat.categoryId} className="card" style={{ marginBottom: "1.5rem" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      borderBottom: "1px solid var(--border)",
                      paddingBottom: "0.6rem",
                      marginBottom: "1rem",
                    }}
                  >
                    <div>
                      <h3 style={{ margin: 0 }}>{cat.categoryName}</h3>
                      <span className="muted" style={{ fontSize: "0.82rem" }}>
                        Meal Slot: {cat.mealSlot} | Valid Category Ballots: {cat.validSubmittedBallots}
                      </span>
                    </div>
                  </div>

                  {/* Chart */}
                  {cat.candidates.length > 0 && (
                    <div style={{ width: "100%", height: 240, marginBottom: "1.25rem" }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={cat.candidates.slice(0, 6)}
                          layout="vertical"
                          margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                          <XAxis type="number" unit="%" domain={[0, 100]} />
                          <YAxis
                            dataKey="dishName"
                            type="category"
                            width={110}
                            tick={{ fontSize: 11 }}
                          />
                          <Tooltip formatter={(value) => [`${value}%`, "Approval Vote Share"]} />
                          <Bar dataKey="voteSharePercentage" fill="var(--accent)" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Table */}
                  <table className={styles.rankingTable}>
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>Dish Name</th>
                        <th>Mess Type</th>
                        <th>Votes</th>
                        <th>Approval Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cat.candidates.map((cand) => (
                        <tr key={cand.id}>
                          <td>
                            <span
                              className={`${styles.rankBadge} ${
                                cand.rank === 1
                                  ? styles.rank1
                                  : cand.rank === 2
                                  ? styles.rank2
                                  : cand.rank === 3
                                  ? styles.rank3
                                  : ""
                              }`}
                            >
                              {cand.rank}
                            </span>
                            {cand.isTie && (
                              <span
                                className={styles.badge}
                                style={{ background: "#fef3c7", color: "#92400e", marginLeft: "4px" }}
                              >
                                TIE
                              </span>
                            )}
                          </td>
                          <td style={{ fontWeight: 600 }}>{cand.dishName}</td>
                          <td>
                            <span className={`${styles.badge} ${styles.badgeNeutral}`}>
                              {cand.messType}
                            </span>
                          </td>
                          <td style={{ fontWeight: 700 }}>{cand.voteCount}</td>
                          <td style={{ fontWeight: 700, color: "var(--accent)" }}>
                            {cand.voteSharePercentage}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUGGEST A DISH TAB */}
      {activeTab === "suggest" && (
        <div>
          {/* Submission Form */}
          <div className={styles.suggestionForm}>
            <div style={{ marginBottom: "1rem" }}>
              <h2 style={{ margin: "0 0 0.25rem" }}>Suggest a New Dish</h2>
              <p className="muted">
                Submit dishes you’d love to see on future mess menus. Suggestions are moderated by the mess administration before nomination.
              </p>
            </div>

            {suggSuccessMsg && (
              <div className={styles.submittedAlert} style={{ marginBottom: "1rem" }}>
                <span>
                  <IoCheckmarkCircle size={20} /> {suggSuccessMsg}
                </span>
              </div>
            )}

            <form onSubmit={handleSuggestSubmit}>
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label>Dish Name *</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Kadai Mushroom with Naan"
                    value={suggForm.dishName}
                    onChange={(e) => setSuggForm({ ...suggForm, dishName: e.target.value })}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Target Meal Slot</label>
                  <select
                    className="input"
                    value={suggForm.mealSlot}
                    onChange={(e) => setSuggForm({ ...suggForm, mealSlot: e.target.value })}
                  >
                    <option value="BREAKFAST">Breakfast</option>
                    <option value="LUNCH">Lunch</option>
                    <option value="SNACKS">Snacks</option>
                    <option value="DINNER">Dinner</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label>Preferred Mess Type</label>
                  <select
                    className="input"
                    value={suggForm.messType}
                    onChange={(e) => setSuggForm({ ...suggForm, messType: e.target.value })}
                  >
                    <option value="VEG">Veg Mess</option>
                    <option value="NON_VEG">Non-Veg Mess</option>
                    <option value="SPECIAL">Special Mess</option>
                    <option value="FOODPARK">Foodpark</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label>Description / Flavor Profile</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Mildly spiced with rich tomato cashew gravy"
                    value={suggForm.description}
                    onChange={(e) => setSuggForm({ ...suggForm, description: e.target.value })}
                  />
                </div>
              </div>

              <div className={styles.formGroup} style={{ marginBottom: "1.25rem" }}>
                <label>Why should we include this dish?</label>
                <textarea
                  className="input"
                  rows={2}
                  placeholder="e.g. High protein option, huge student demand, perfect for exam weeks"
                  value={suggForm.reason}
                  onChange={(e) => setSuggForm({ ...suggForm, reason: e.target.value })}
                />
              </div>

              <button type="submit" className="btn" disabled={suggSubmitting}>
                <IoBulbOutline size={18} /> Submit Suggestion
              </button>
            </form>
          </div>

          {/* Student's Existing Suggestions */}
          <div>
            <h3 style={{ margin: "0 0 0.85rem" }}>My Submitted Suggestions</h3>
            {mySuggestions.length === 0 ? (
              <div className="card" style={{ textAlign: "center", padding: "1.75rem" }}>
                <p className="muted">You have not submitted any dish suggestions yet.</p>
              </div>
            ) : (
              <div className={styles.suggestionsList}>
                {mySuggestions.map((item) => (
                  <div key={item.id} className={styles.suggestionItem}>
                    <div>
                      <h4 style={{ margin: "0 0 0.25rem", fontSize: "1.02rem" }}>{item.dishName}</h4>
                      <p className="muted" style={{ margin: "0 0 0.4rem", fontSize: "0.85rem" }}>
                        {item.description || item.reason || "No additional description provided."}
                      </p>
                      <span className="muted" style={{ fontSize: "0.78rem" }}>
                        Submitted on: {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <span
                        className={`${styles.badge} ${
                          item.status === "APPROVED"
                            ? styles.badgeSuccess
                            : item.status === "PENDING"
                            ? styles.badgeWarning
                            : styles.badgeDanger
                        }`}
                      >
                        {item.status}
                      </span>
                      {item.moderationReason && (
                        <p
                          style={{
                            margin: "0.35rem 0 0",
                            fontSize: "0.8rem",
                            color: "var(--muted)",
                            maxWidth: 220,
                          }}
                        >
                          Remarks: {item.moderationReason}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
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
              <h3 style={{ margin: 0 }}>Confirm Ballot Submission</h3>
              <button
                className="btn-ghost"
                style={{ padding: "0.2rem", border: "none" }}
                onClick={() => setShowConfirmModal(false)}
              >
                <IoCloseOutline size={22} />
              </button>
            </div>

            <p style={{ margin: "0 0 1rem", fontSize: "0.92rem", color: "var(--muted)" }}>
              You are casting approval votes for{" "}
              <strong>{currentCategorySelections.length} dishes</strong> in{" "}
              <strong>{activeCategory?.name}</strong>.
            </p>

            <div
              style={{
                background: "var(--surface-2)",
                padding: "0.75rem 1rem",
                borderRadius: "var(--radius-sm)",
                marginBottom: "1.25rem",
                fontSize: "0.88rem",
              }}
            >
              {currentCategorySelections.map((cid) => {
                const c = activeCategory?.candidates?.find((item) => item.id === cid);
                return (
                  <div key={cid} style={{ padding: "0.25rem 0", fontWeight: 600 }}>
                    • {c?.dishName}
                  </div>
                );
              })}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <button
                className="btn btn-ghost"
                onClick={() => setShowConfirmModal(false)}
                disabled={submittingVote}
              >
                Cancel
              </button>
              <button
                className="btn"
                onClick={handleConfirmBallotSubmit}
                disabled={submittingVote}
              >
                {submittingVote ? "Submitting…" : "Confirm & Submit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
