import React from "react";
import CatererSwapPanel from "../../components/CatererSwapPanel.jsx";
import styles from "./CatererSwapPage.module.css";

export default function CatererSwapPage() {
  return (
    <div>
      <h2 className={styles.h2}>Caterer swap</h2>
      <p className="muted" style={{ fontSize: "0.88rem", marginTop: 0 }}>
        Your <strong>mess type stays the same</strong>. Only the caterer changes. Slots are limited and
        allocated instantly — first come, first served.
      </p>
      <CatererSwapPanel variant="page" />
    </div>
  );
}
