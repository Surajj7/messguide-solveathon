import React, { useCallback, useEffect, useState } from "react";
import api from "../api/client.js";
import styles from "./NightMessStaffPanel.module.css";

export default function NightMessStaffPanel({ title = "Night mess — today’s stock" }) {
  const [serviceDate, setServiceDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);
  const [catalogItems, setCatalogItems] = useState([]);
  const [extraItems, setExtraItems] = useState([]);
  const [draft, setDraft] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setStatus(null);
    try {
      const { data } = await api.get(`/night-mess?date=${serviceDate}`);
      const cat = data.items.filter((i) => i.catalog);
      const ext = data.items.filter((i) => i.isExtra);
      setCatalogItems(cat);
      setExtraItems(ext);
      const next = {};
      for (const i of cat) {
        next[i.name] = {
          availableQty: String(i.availableQty ?? 0),
          remainingQty: String(i.remainingQty ?? 0),
        };
      }
      setDraft(next);
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.message ||
        "Failed to load";
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  }, [serviceDate]);

  useEffect(() => {
    load();
  }, [load]);

  function setQty(name, field, value) {
    setDraft((prev) => ({
      ...prev,
      [name]: { ...prev[name], [field]: value },
    }));
  }

  async function saveDay(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const entries = catalogItems.map((i) => {
        const d = draft[i.name] || { availableQty: "0", remainingQty: "0" };
        return {
          name: i.name,
          availableQty: Number(d.availableQty) || 0,
          remainingQty:
            d.remainingQty === "" || d.remainingQty === undefined
              ? undefined
              : Number(d.remainingQty),
        };
      });
      const { data } = await api.post("/night-mess/sync-day", {
        serviceDate,
        entries,
      });
      const cat = data.items.filter((i) => i.catalog);
      const ext = data.items.filter((i) => i.isExtra);
      setCatalogItems(cat);
      setExtraItems(ext);
      const next = {};
      for (const i of cat) {
        next[i.name] = {
          availableQty: String(i.availableQty ?? 0),
          remainingQty: String(i.remainingQty ?? 0),
        };
      }
      setDraft(next);
      setStatus("Saved. Students see updated quantities for this date.");
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.message ||
        "Save failed";
      setError(String(msg));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card">
      <h2>{title}</h2>
      <p className={`muted ${styles.hint}`}>
        Fixed menu prices are in <strong>₹ (INR)</strong>. Set how many portions are available for
        the chosen date; <strong>Remaining</strong> is what is left to sell (defaults to match
        available when you save if left blank). Use <strong>0</strong> available to remove an item
        from tonight&apos;s list.
      </p>

      <div className={styles.head}>
        <div className={styles.dateField}>
          <label className="label" htmlFor="nm-service-date">
            Service date
          </label>
          <input
            id="nm-service-date"
            className="input"
            type="date"
            value={serviceDate}
            onChange={(e) => setServiceDate(e.target.value)}
          />
        </div>
        <button type="button" className="btn btn-ghost" disabled={loading} onClick={load}>
          {loading ? "Loading…" : "Reload"}
        </button>
      </div>

      {error && (
        <p className={`${styles.status} ${styles.error}`} role="alert">
          {error}
        </p>
      )}
      {status && <p className={`muted ${styles.status}`}>{status}</p>}

      {!loading && (
        <form onSubmit={saveDay}>
          <div className={styles.grid}>
            {catalogItems.map((i) => {
              const d = draft[i.name] || { availableQty: "0", remainingQty: "0" };
              return (
                <div key={i.name} className={styles.itemCard}>
                  <p className={styles.itemTitle}>{i.name}</p>
                  <p className={styles.price}>₹{i.price}</p>
                  <div className={styles.field}>
                    <label htmlFor={`av-${i.name}`}>Available</label>
                    <input
                      id={`av-${i.name}`}
                      className="input"
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={d.availableQty}
                      onChange={(e) => setQty(i.name, "availableQty", e.target.value)}
                    />
                  </div>
                  <div className={styles.field}>
                    <label htmlFor={`rem-${i.name}`}>Remaining</label>
                    <input
                      id={`rem-${i.name}`}
                      className="input"
                      type="number"
                      min={0}
                      inputMode="numeric"
                      placeholder="Same as available"
                      value={d.remainingQty}
                      onChange={(e) => setQty(i.name, "remainingQty", e.target.value)}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className={styles.actions}>
            <button className="btn" type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save all for this date"}
            </button>
          </div>
        </form>
      )}

      {loading && <p className="muted">Loading menu…</p>}

      {extraItems.length > 0 && (
        <div className={styles.extras}>
          <h3>Other items (CSV / manual)</h3>
          <p className="muted" style={{ fontSize: "0.82rem", marginBottom: "0.5rem" }}>
            These are not in the fixed list. Manage via CSV import or the legacy API if needed.
          </p>
          <ul>
            {extraItems.map((x) => (
              <li key={x.id}>
                <strong>{x.name}</strong> — ₹{x.price} · available {x.availableQty} · remaining{" "}
                {x.remainingQty}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
