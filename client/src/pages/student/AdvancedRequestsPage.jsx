import React from "react";
import { BackLink } from "../../components/BackLink.jsx";
import AdvancedRequestPanel from "../../components/AdvancedRequestPanel.jsx";
import styles from "./AdvancedRequestsPage.module.css";

export default function AdvancedRequestsPage() {
  return (
    <div className={`page ${styles.page}`}>
      <BackLink to="/app" />
      <h1 className={styles.title}>Advanced requests</h1>
      <p className="muted" style={{ marginTop: 0, fontSize: "0.9rem" }}>
        Submit and track special mess requests. Only admins can approve; mess staff see approved items in
        their dashboard.
      </p>
      <AdvancedRequestPanel />
    </div>
  );
}
