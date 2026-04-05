import React, { useEffect, useState } from "react";
import { BackLink } from "../../components/BackLink.jsx";
import api from "../../api/client.js";
import styles from "./NotificationsPage.module.css";

export default function NotificationsPage() {
  const [list, setList] = useState([]);

  function load() {
    api.get("/notifications").then((r) => setList(r.data));
  }

  useEffect(() => {
    load();
  }, []);

  async function markRead(id) {
    await api.patch(`/notifications/${id}/read`);
    load();
  }

  async function readAll() {
    await api.post("/notifications/read-all");
    load();
  }

  return (
    <div className="page">
      <BackLink />
      <div className={styles.head}>
        <h1>Notifications</h1>
        <button type="button" className="btn-ghost btn" onClick={readAll}>
          Mark all read
        </button>
      </div>
      {list.map((n) => (
        <button
          key={n.id}
          type="button"
          className={`${styles.row} ${!n.read ? styles.unread : ""}`}
          onClick={() => !n.read && markRead(n.id)}
        >
          <div>
            <strong>{n.title}</strong>
            <div className="muted" style={{ fontSize: "0.85rem" }}>
              {n.type.replace(/_/g, " ")}
            </div>
            <p style={{ margin: "0.35rem 0 0", textAlign: "left" }}>{n.message}</p>
          </div>
          <span className="muted" style={{ fontSize: "0.72rem" }}>
            {new Date(n.createdAt).toLocaleString()}
          </span>
        </button>
      ))}
      {list.length === 0 && <p className="muted">No notifications yet.</p>}
    </div>
  );
}
