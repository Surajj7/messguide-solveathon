import React, { useState } from "react";
import { BackLink } from "../../components/BackLink.jsx";
import api from "../../api/client.js";
import styles from "./AIChatPage.module.css";

export default function AIChatPage() {
  const [messages, setMessages] = useState([
    {
      role: "bot",
      text: "Ask about high-protein items, healthy picks, or mess timings. I’m not a doctor.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(e) {
    e.preventDefault();
    if (!input.trim()) return;
    const userText = input.trim();
    setInput("");
    setMessages((m) => [...m, { role: "user", text: userText }]);
    setBusy(true);
    try {
      const { data } = await api.post(
        "/ai/chat",
        { message: userText },
        { headers: { "Content-Type": "application/json" } }
      );
      setMessages((m) => [
        ...m,
        {
          role: "bot",
          text: data.text,
          disclaimer: data.disclaimer,
          mock: data.mock,
        },
      ]);
    } catch (err) {
      const detail =
        err.response?.data?.error ||
        err.response?.statusText ||
        err.message ||
        "Network error";
      const hint =
        err.response?.status === 401
          ? " Log in again (session may have expired)."
          : err.response?.status === 403
            ? " This account may not have access."
            : "";
      setMessages((m) => [
        ...m,
        {
          role: "bot",
          text: `Could not reach assistant: ${detail}.${hint}`,
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <BackLink />
      <h1>AI assistant</h1>
      <p className="muted" style={{ fontSize: "0.85rem" }}>
        Powered by Groq when API key is set; demo text otherwise.
      </p>
      <div className={styles.thread}>
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`${styles.bubble} ${msg.role === "user" ? styles.user : styles.bot}`}
          >
            {msg.text}
            {msg.disclaimer && (
              <div className={styles.disclaimer}>{msg.disclaimer}</div>
            )}
            {msg.mock && (
              <div className={styles.mock}>Demo mode</div>
            )}
          </div>
        ))}
      </div>
      <form onSubmit={send} className={styles.form}>
        <input
          className="input"
          placeholder="e.g. What is high protein today?"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={busy}
        />
        <button className="btn" type="submit" disabled={busy}>
          Send
        </button>
      </form>
    </div>
  );
}
