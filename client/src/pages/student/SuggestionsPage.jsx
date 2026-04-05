import React, { useEffect, useState } from "react";
import { BackLink } from "../../components/BackLink.jsx";
import api from "../../api/client.js";

const CATS = ["BREAKFAST", "LUNCH", "DINNER", "NIGHT_CANTEEN"];

export default function SuggestionsPage() {
  const [list, setList] = useState([]);
  const [text, setText] = useState("");
  const [category, setCategory] = useState("");

  function load() {
    api.get("/suggestions").then((r) => setList(r.data));
  }

  useEffect(() => {
    load();
  }, []);

  async function submit(e) {
    e.preventDefault();
    await api.post("/suggestions", { text, category: category || undefined });
    setText("");
    load();
  }

  async function upvote(id) {
    try {
      await api.post(`/suggestions/${id}/upvote`);
      load();
    } catch {
      /* duplicate */
    }
  }

  return (
    <div className="page">
      <BackLink />
      <h1>Future menu ideas</h1>
      <p className="muted">Suggest dishes — upvote your favorites.</p>

      <form className="card" onSubmit={submit}>
        <label className="label">Your suggestion</label>
        <textarea
          className="input"
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          required
        />
        <label className="label" style={{ marginTop: "0.5rem" }}>
          Category (optional)
        </label>
        <select
          className="input"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">—</option>
          {CATS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button className="btn" type="submit" style={{ marginTop: "0.75rem" }}>
          Submit
        </button>
      </form>

      {list.map((s) => (
        <div key={s.id} className="card">
          <p style={{ margin: "0 0 0.5rem" }}>{s.text}</p>
          <div className="muted" style={{ fontSize: "0.85rem" }}>
            {s.user?.name} · {s.category || "general"} · ↑ {s.upvoteCount}
          </div>
          <button type="button" className="btn btn-ghost" style={{ marginTop: "0.5rem" }} onClick={() => upvote(s.id)}>
            Upvote
          </button>
        </div>
      ))}
    </div>
  );
}
