import React, { useCallback, useState } from "react";
import api from "../api/client.js";
import FilePicker from "./FilePicker.jsx";
import styles from "./AdvancedRequestPanel.module.css";

const TYPES = [
  { value: "ROOM_DELIVERY", label: "Food delivery to room" },
  { value: "TEMP_MENU_CHANGE", label: "Temporary menu change" },
];

function statusLabel(s) {
  if (s === "PENDING") return "Pending review";
  if (s === "APPROVED") return "Approved";
  if (s === "REJECTED") return "Not approved";
  return s;
}

function typeLabel(v) {
  const t = TYPES.find((x) => x.value === v);
  return t?.label || v;
}

export default function AdvancedRequestPanel({ listLimit }) {
  const [requestDate, setRequestDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [requestType, setRequestType] = useState("ROOM_DELIVERY");
  const [description, setDescription] = useState("");
  const [proofFile, setProofFile] = useState(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [list, setList] = useState([]);

  const load = useCallback(() => {
    api
      .get("/advanced-requests/mine")
      .then((r) => setList(r.data))
      .catch(() => setList([]));
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setMsg("");
    if (!description.trim()) {
      setErr("Please add a description.");
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("requestDate", requestDate);
      fd.append("requestType", requestType);
      fd.append("description", description.trim());
      if (proofFile) {
        fd.append("proof", proofFile);
      }
      await api.post("/advanced-requests", fd);
      setDescription("");
      setProofFile(null);
      setMsg("Request submitted. Admin will review it; you’ll get a notification when there’s an update.");
      load();
    } catch (ex) {
      const m =
        ex.response?.data?.error || ex.message || "Could not submit request";
      setErr(String(m));
    } finally {
      setBusy(false);
    }
  }

  const shown = listLimit ? list.slice(0, listLimit) : list;

  return (
    <div className={styles.wrap}>
      <form className={`card ${styles.form}`} onSubmit={submit}>
        <h2 className={styles.formTitle}>Advanced request</h2>
        <p className="muted" style={{ fontSize: "0.85rem", marginTop: 0 }}>
          Ask for room delivery or a one-off menu change for a specific date. Optional
          image proof (e.g. medical note) can be attached. Requests go to the admin;
          once approved, mess staff are notified.
        </p>
        <label className="label">Date</label>
        <input
          className="input"
          type="date"
          value={requestDate}
          onChange={(e) => setRequestDate(e.target.value)}
          required
        />
        <label className="label" style={{ marginTop: "0.5rem" }}>
          Request type
        </label>
        <select
          className="input"
          value={requestType}
          onChange={(e) => setRequestType(e.target.value)}
        >
          {TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <label className="label" style={{ marginTop: "0.5rem" }}>
          Description
        </label>
        <textarea
          className="input"
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Explain what you need (room number if delivery, dishes or dietary reason for menu change, etc.)"
          required
        />
        <label className="label" style={{ marginTop: "0.5rem" }}>
          Proof image (optional)
        </label>
        <FilePicker
          accept="image/*"
          file={proofFile}
          onChange={setProofFile}
          chooseLabel="Attach image"
          emptySub="PNG, JPG — optional"
          hint="Max 5 MB. Not required."
        />
        {err && (
          <p className={styles.err} role="alert">
            {err}
          </p>
        )}
        {msg && <p className={styles.ok}>{msg}</p>}
        <button className="btn" type="submit" disabled={busy} style={{ marginTop: "0.75rem" }}>
          {busy ? "Submitting…" : "Submit request"}
        </button>
      </form>

      {shown.length > 0 && (
        <div className={styles.listSection}>
          <h3 className={styles.listTitle}>Your requests</h3>
          <ul className={styles.list}>
            {shown.map((r) => (
              <li key={r.id} className={`card ${styles.listCard}`}>
                <div className={styles.listTop}>
                  <span className={styles.typePill}>{typeLabel(r.requestType)}</span>
                  <span
                    className={
                      r.status === "APPROVED"
                        ? styles.statusOk
                        : r.status === "REJECTED"
                          ? styles.statusBad
                          : styles.statusPending
                    }
                  >
                    {statusLabel(r.status)}
                  </span>
                </div>
                <p className={styles.listDate}>
                  For date: {r.requestDate ? String(r.requestDate).slice(0, 10) : "—"}
                </p>
                <p className={styles.listDesc}>{r.description}</p>
                {r.proofPath && (
                  <a
                    className={styles.proofLink}
                    href={r.proofPath}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View proof image
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
