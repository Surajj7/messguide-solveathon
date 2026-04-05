import React from "react";
import styles from "./DummyPaymentQR.module.css";

/** Placeholder “QR” for mess upgradation demo — not a real payment link. */
export default function DummyPaymentQR({ title = "Scan to pay (demo)" }) {
  const bits = [
    "11100111",
    "10000001",
    "10100101",
    "10000001",
    "10111101",
    "10000001",
    "11100111",
    "00101000",
    "11010110",
    "01001010",
  ];
  return (
    <div className={styles.panel} aria-label="Dummy payment QR placeholder">
      <p className={styles.kicker}>Payment</p>
      <h3 className={styles.title}>{title}</h3>
      <div className={styles.qrWrap}>
        <svg
          className={styles.qrSvg}
          viewBox="0 0 80 80"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden
        >
          <rect width="80" height="80" fill="#fff" rx="6" />
          {bits.map((row, r) =>
            row.split("").map((ch, c) =>
              ch === "1" ? (
                <rect
                  key={`${r}-${c}`}
                  x={8 + c * 6}
                  y={8 + r * 6}
                  width="5"
                  height="5"
                  fill="#1b4332"
                  rx="0.5"
                />
              ) : null
            )
          )}
        </svg>
      </div>
      <p className={styles.note}>
        This is a <strong>demo</strong> QR for hackathon / UI only. Complete any real payment through your
        institute process, then enter the transaction ID below.
      </p>
    </div>
  );
}
