import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BackLink } from "../../components/BackLink.jsx";
import api from "../../api/client.js";
import { useAuth } from "../../context/AuthContext.jsx";
import styles from "./ProfilePage.module.css";
import AdvancedRequestPanel from "../../components/AdvancedRequestPanel.jsx";

const GOALS = [
  "WEIGHT_LOSS",
  "MUSCLE_GAIN",
  "MAINTENANCE",
  "HIGH_PROTEIN",
  "BALANCED",
];

export default function ProfilePage() {
  const { user, profile, logout, refreshProfile } = useAuth();
  const nav = useNavigate();
  const [goal, setGoal] = useState(profile?.healthGoal || "BALANCED");
  const [prefDate, setPrefDate] = useState(new Date().toISOString().slice(0, 10));
  const [prefNotes, setPrefNotes] = useState("");
  const [plan, setPlan] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!profile) return;
    setGoal(profile.healthGoal);
  }, [profile]);

  async function saveProfile(e) {
    e.preventDefault();
    await api.put("/profiles/student", {
      healthGoal: goal,
      profileComplete: true,
    });
    await refreshProfile();
    setMsg("Profile saved.");
  }

  async function savePreference(e) {
    e.preventDefault();
    await api.post("/preferences", {
      forDate: prefDate,
      menuType: "REGULAR",
      notes: prefNotes,
    });
    setMsg("Preference recorded for " + prefDate);
  }

  async function runMealPlan() {
    setMsg("");
    setPlan("");
    try {
      const { data } = await api.post(
        "/ai/meal-plan",
        {},
        { headers: { "Content-Type": "application/json" } }
      );
      setPlan(
        (data.text || "(No text returned)") +
          (data.mock ? "\n\n(Demo / fallback mode)" : "")
      );
    } catch (err) {
      const detail =
        err.response?.data?.error ||
        err.message ||
        "Request failed";
      setPlan(
        `Could not load meal plan: ${detail}. If you see "Profile not found", your account may be missing student profile data — contact admin.`
      );
    }
  }

  return (
    <div className="page">
      <BackLink />
      <h1>Profile</h1>
      <div className="card">
        <p>
          <strong>{user?.name}</strong>
        </p>
        <p className="muted">{user?.email}</p>
      </div>

      <div className="card">
        <h2>Your mess (assigned)</h2>
        <p className="muted" style={{ fontSize: "0.88rem", marginBottom: "0.75rem" }}>
          Mess type, hostel block, and caterer are set by administration and cannot be changed here.
        </p>
        <dl className={styles.readonly}>
          <div>
            <dt>Mess type</dt>
            <dd>{profile?.messType?.replace(/_/g, " ") || "—"}</dd>
          </div>
          <div>
            <dt>Hostel block</dt>
            <dd>{profile?.hostelBlock || "—"}</dd>
          </div>
          <div>
            <dt>Caterer</dt>
            <dd>{profile?.caterer?.replace(/_/g, " ") || "—"}</dd>
          </div>
        </dl>
      </div>

      <form className="card" onSubmit={saveProfile}>
        <h2>Health goal</h2>
        <label className="label">Goal</label>
        <select className="input" value={goal} onChange={(e) => setGoal(e.target.value)}>
          {GOALS.map((g) => (
            <option key={g} value={g}>
              {g.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <button className="btn" type="submit" style={{ marginTop: "0.75rem" }}>
          Save
        </button>
      </form>

      <div className="card">
        <h2>AI meal planner</h2>
        <p className="muted" style={{ fontSize: "0.85rem" }}>
          Suggests picks from <em>today&apos;s</em> menu for your goal.
        </p>
        <button type="button" className="btn" onClick={runMealPlan}>
          Get suggestions
        </button>
        {plan && <pre className={styles.plan}>{plan}</pre>}
      </div>

      <AdvancedRequestPanel listLimit={3} />
      <p className="muted" style={{ fontSize: "0.85rem", margin: "-0.5rem 0 1rem" }}>
        <Link to="/app/advanced-requests">Open full advanced requests page</Link> for the complete
        history.
      </p>

      <form className="card" onSubmit={savePreference}>
        <h2>Advance preference</h2>
        <label className="label">Date</label>
        <input
          className="input"
          type="date"
          value={prefDate}
          onChange={(e) => setPrefDate(e.target.value)}
        />
        <label className="label" style={{ marginTop: "0.5rem" }}>
          Notes (regular menu)
        </label>
        <textarea
          className="input"
          rows={2}
          value={prefNotes}
          onChange={(e) => setPrefNotes(e.target.value)}
        />
        <button className="btn btn-ghost" type="submit" style={{ marginTop: "0.5rem" }}>
          Save preference
        </button>
      </form>

      {msg && <p className="muted">{msg}</p>}

      <button
        type="button"
        className={`btn btn-ghost ${styles.logout}`}
        onClick={() => {
          logout();
          nav("/login");
        }}
      >
        Log out
      </button>
    </div>
  );
}
