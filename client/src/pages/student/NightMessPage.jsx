import React, { useEffect, useState } from "react";
import { BackLink } from "../../components/BackLink.jsx";
import api from "../../api/client.js";
import styles from "./NightMessPage.module.css";

export default function NightMessPage() {
  const [data, setData] = useState(null);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    api.get(`/night-mess?date=${date}`).then((r) => setData(r.data));
  }, [date]);

  const catalog = data?.items?.filter((i) => i.catalog) || [];
  const extras = data?.items?.filter((i) => i.isExtra) || [];

  return (
    <div className="page">
      <BackLink />
      <h1>Night mess</h1>
      <p className="muted">10 PM – 1 AM · prices in ₹ (INR) · stock from mess desk</p>

      <div className={styles.dateRow}>
        <label className="label" htmlFor="nm-view-date">
          Date
        </label>
        <input
          id="nm-view-date"
          className="input"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      {!data && <p className="muted">Loading…</p>}
      {data && (
        <>
          <p className="muted" style={{ marginTop: "0.5rem" }}>
            {data.date}
          </p>

          <div className={styles.grid}>
            {catalog.map((i) => (
              <div
                key={i.name}
                className={`${styles.card} ${i.notListed ? styles.cardMuted : ""}`}
              >
                <div className={styles.row}>
                  <div>
                    <strong className={styles.dish}>{i.name}</strong>
                    <div className={styles.price}>₹{i.price}</div>
                  </div>
                  <div className={styles.badge}>
                    {i.notListed ? (
                      <span className={styles.na}>Not on menu</span>
                    ) : i.soldOut ? (
                      <span className={styles.sold}>Sold out</span>
                    ) : i.lowStock ? (
                      <span className={styles.low}>Low stock</span>
                    ) : (
                      <span className={styles.ok}>In stock</span>
                    )}
                  </div>
                </div>
                {!i.notListed && (
                  <div className="muted" style={{ fontSize: "0.85rem", marginTop: "0.35rem" }}>
                    Remaining: {i.remainingQty} / {i.availableQty}
                  </div>
                )}
              </div>
            ))}
          </div>

          {extras.length > 0 && (
            <>
              <h2 className={styles.extrasHeading}>Also available</h2>
              <div className={styles.grid}>
                {extras.map((i) => (
                  <div
                    key={i.id}
                    className={`${styles.card} ${i.notListed ? styles.cardMuted : ""}`}
                  >
                    <div className={styles.row}>
                      <div>
                        <strong className={styles.dish}>{i.name}</strong>
                        <div className={styles.price}>₹{i.price}</div>
                      </div>
                      <div className={styles.badge}>
                        {i.notListed ? (
                          <span className={styles.na}>Not on menu</span>
                        ) : i.soldOut ? (
                          <span className={styles.sold}>Sold out</span>
                        ) : i.lowStock ? (
                          <span className={styles.low}>Low stock</span>
                        ) : (
                          <span className={styles.ok}>In stock</span>
                        )}
                      </div>
                    </div>
                    {!i.notListed && (
                      <div className="muted" style={{ fontSize: "0.85rem", marginTop: "0.35rem" }}>
                        Remaining: {i.remainingQty} / {i.availableQty}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
