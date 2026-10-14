import React, { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { BackLink } from "../../components/BackLink.jsx";
import FilePicker from "../../components/FilePicker.jsx";
import api from "../../api/client.js";
import { useAuth } from "../../context/AuthContext.jsx";
import styles from "./MenuItemPage.module.css";

const ISSUES = [
  { v: "TOO_OILY", label: "Too oily" },
  { v: "TOO_SPICY", label: "Too spicy" },
  { v: "POOR_QUALITY", label: "Poor quality" },
  { v: "UNDERCOOKED", label: "Undercooked" },
  { v: "NOT_HYGIENIC", label: "Not hygienic" },
  { v: "QUANTITY_ISSUE", label: "Quantity issue" },
  { v: "OTHER", label: "Other" },
];

export default function MenuItemPage() {
  const { itemId } = useParams();
  const [params] = useSearchParams();
  const date = params.get("date") || new Date().toISOString().slice(0, 10);
  const { profile } = useAuth();
  const [item, setItem] = useState(null);
  const [rating, setRating] = useState(5);
  const [starHover, setStarHover] = useState(null);
  const [comment, setComment] = useState("");
  const [reviewFile, setReviewFile] = useState(null);
  const [reviewCaterer, setReviewCaterer] = useState(profile?.caterer || "ZENITH");
  const [reviewMessType, setReviewMessType] = useState(profile?.messType || "VEG");
  const [issue, setIssue] = useState("OTHER");
  const [detail, setDetail] = useState("");
  const [complaintFile, setComplaintFile] = useState(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (profile?.caterer) setReviewCaterer(profile.caterer);
    if (profile?.messType) setReviewMessType(profile.messType);
  }, [profile]);

  useEffect(() => {
    api.get(`/menus/items/${itemId}`).then((r) => setItem(r.data));
  }, [itemId]);

  async function submitReview(e) {
    e.preventDefault();
    setMsg("");
    const fd = new FormData();
    fd.append("menuItemId", itemId);
    fd.append("menuDate", date);
    fd.append("rating", String(Number(rating)));
    fd.append("caterer", reviewCaterer);
    fd.append("messType", reviewMessType);
    if (comment) fd.append("comment", comment);
    if (reviewFile) fd.append("file", reviewFile);
    await api.post("/reviews", fd);
    setMsg(`Review saved for ${reviewCaterer} (${reviewMessType.replace(/_/g, " ")}).`);
    setReviewFile(null);
  }

  async function submitComplaint(e) {
    e.preventDefault();
    setMsg("");
    const fd = new FormData();
    fd.append("menuItemId", itemId);
    fd.append("menuDate", date);
    fd.append("issueType", issue);
    fd.append("caterer", reviewCaterer);
    fd.append("messType", reviewMessType);
    if (detail) fd.append("description", detail);
    if (complaintFile) fd.append("file", complaintFile);
    await api.post("/complaints", fd);
    setMsg(`Complaint recorded for ${reviewCaterer} (${reviewMessType.replace(/_/g, " ")}).`);
    setComplaintFile(null);
  }

  if (!item) {
    return (
      <div className="page">
        <BackLink to="/app/menu" />
        <div className="emptyState" role="status">
          Loading dish details…
        </div>
      </div>
    );
  }

  return (
    <div className={`page ${styles.page}`}>
      <BackLink to="/app/menu" />
      <header className={styles.dishHeader}>
        <h1>{item.name}</h1>
        {typeof item.isVeg === "boolean" && (
          <span className={item.isVeg ? "chipVeg" : "chipNonVeg"}>
            {item.isVeg ? "Vegetarian" : "Non-vegetarian"}
          </span>
        )}
      </header>
      <div className={`card ${styles.nutritionCard}`}>
        <p className={styles.nutritionLabel}>Nutrition snapshot</p>
        <div className={styles.macroGrid}>
          <div className={`${styles.macroCell} ${styles.macroKcal}`}>
            <span className={styles.macroValue}>{Math.round(item.calories)}</span>
            <span className={styles.macroUnit}>kcal</span>
          </div>
          <div className={styles.macroCell}>
            <span className={styles.macroValue}>{item.proteinG}g</span>
            <span className={styles.macroUnit}>Protein</span>
          </div>
          <div className={styles.macroCell}>
            <span className={styles.macroValue}>{item.carbsG}g</span>
            <span className={styles.macroUnit}>Carbs</span>
          </div>
          <div className={styles.macroCell}>
            <span className={styles.macroValue}>{item.fatsG}g</span>
            <span className={styles.macroUnit}>Fats</span>
          </div>
        </div>
        <div className={styles.tagRow}>
          {(item.tags || []).map((t) => (
            <span key={t} className={styles.tag}>
              {t}
            </span>
          ))}
        </div>
      </div>

      <div className="sectionHead">
        <h2>Daily feedback — rate & review</h2>
        <p className="muted" style={{ margin: 0, fontSize: "0.86rem" }}>
          Share a star rating and optional note for this menu day.
        </p>
      </div>
      <form className="card" onSubmit={submitReview} encType="multipart/form-data">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.85rem", padding: "0.75rem", background: "rgba(255,255,255,0.03)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div>
            <label className="label" style={{ fontSize: "0.82rem", color: "#38bdf8" }}>Reviewing Caterer</label>
            <select
              className="input"
              value={reviewCaterer}
              onChange={(e) => setReviewCaterer(e.target.value)}
              style={{ marginTop: "0.25rem" }}
            >
              <option value="ZENITH">Zenith</option>
              <option value="PROODLE">Proodle</option>
              <option value="FUSION">Fusion</option>
              <option value="SRRC">SRRC</option>
              <option value="CRCL">CRCL</option>
            </select>
          </div>
          <div>
            <label className="label" style={{ fontSize: "0.82rem", color: "#38bdf8" }}>Mess Type</label>
            <select
              className="input"
              value={reviewMessType}
              onChange={(e) => setReviewMessType(e.target.value)}
              style={{ marginTop: "0.25rem" }}
            >
              <option value="VEG">Veg Mess</option>
              <option value="NON_VEG">Non-Veg Mess</option>
              <option value="SPECIAL">Special Mess</option>
              <option value="FOODPARK">Foodpark Mess</option>
            </select>
          </div>
        </div>

        <label className="label" id="rating-label">
          Rating
        </label>
        <p className="muted" style={{ fontSize: "0.82rem", margin: "0 0 0.5rem" }}>
          Tap a star — {starHover ?? rating} of 5
        </p>
        <div
          className={styles.starRow}
          role="slider"
          aria-labelledby="rating-label"
          aria-valuemin={1}
          aria-valuemax={5}
          aria-valuenow={starHover ?? rating}
          onMouseLeave={() => setStarHover(null)}
        >
          {[1, 2, 3, 4, 5].map((n) => {
            const active = n <= (starHover ?? rating);
            return (
              <button
                key={n}
                type="button"
                className={`${styles.starBtn} ${active ? styles.starOn : ""}`}
                onClick={() => setRating(n)}
                onMouseEnter={() => setStarHover(n)}
                aria-label={`${n} out of 5 stars`}
              >
                ★
              </button>
            );
          })}
        </div>
        <label className="label" style={{ marginTop: "0.5rem" }}>
          Comment
        </label>
        <textarea
          className="input"
          rows={3}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
        <label className="label" style={{ marginTop: "0.5rem" }}>
          Attach photo / document (optional)
        </label>
        <FilePicker
          accept="image/*,application/pdf,.doc,.docx"
          file={reviewFile}
          onChange={setReviewFile}
          chooseLabel="Add a photo or document"
          emptySub="Images, PDF, or Word — optional attachment for your review"
          hint="Images or PDF up to 5 MB."
        />
        <button className="btn" type="submit" style={{ marginTop: "0.75rem" }}>
          Submit review
        </button>
      </form>

      <div className="sectionHead">
        <h2>Report an issue</h2>
        <p className="muted" style={{ margin: 0, fontSize: "0.86rem" }}>
          Staff receives this with the dish and date you selected.
        </p>
      </div>
      <form className="card" onSubmit={submitComplaint}>
        <label className="label">Issue type</label>
        <select
          className="input"
          value={issue}
          onChange={(e) => setIssue(e.target.value)}
        >
          {ISSUES.map((x) => (
            <option key={x.v} value={x.v}>
              {x.label}
            </option>
          ))}
        </select>
        <label className="label" style={{ marginTop: "0.5rem" }}>
          Details
        </label>
        <textarea
          className="input"
          rows={2}
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
        />
        <label className="label" style={{ marginTop: "0.5rem" }}>
          Attach photo / document (optional)
        </label>
        <FilePicker
          accept="image/*,application/pdf,.doc,.docx"
          file={complaintFile}
          onChange={setComplaintFile}
          chooseLabel="Add evidence (optional)"
          emptySub="Screenshot or doc to help staff understand the issue"
          hint="Images or PDF up to 5 MB."
        />
        <button className="btn btn-ghost" type="submit" style={{ marginTop: "0.75rem" }}>
          Submit complaint
        </button>
      </form>

      {msg && <p className="muted">{msg}</p>}
    </div>
  );
}
