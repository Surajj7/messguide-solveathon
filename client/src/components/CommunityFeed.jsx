import React, { useCallback, useEffect, useState } from "react";
import api from "../api/client.js";
import FilePicker from "./FilePicker.jsx";
import styles from "./CommunityFeed.module.css";

const TAGS = ["complaint", "suggestion", "appreciation", "crowd", "hygiene"];

/**
 * Shared community feed (same cards as student app).
 * @param {object} props
 * @param {boolean} [props.showComposer] — show new-post form (students)
 * @param {boolean} [props.viewOnly] — hide like + add-comment (optional read-only mode)
 * @param {boolean} [props.showStaffMeta] — show author email on posts (admin)
 * @param {{ onDeletePost: (id: string) => Promise<void>, onDeleteComment: (id: string) => Promise<void> }} [props.moderation] — admin delete controls
 * @param {string} [props.title] — heading when showHeader (default "Community")
 * @param {boolean} [props.showHeader] — render title + subtitle inside feed (default true for staff; students set false when page has its own h1)
 */
export default function CommunityFeed({
  showComposer = true,
  viewOnly = false,
  showStaffMeta = false,
  moderation = null,
  title = "Community",
  showHeader = true,
}) {
  const [posts, setPosts] = useState([]);
  const [content, setContent] = useState("");
  const [tags, setTags] = useState([]);
  const [qInput, setQInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTag, setFilterTag] = useState("");
  const [sort, setSort] = useState("newest");
  const [period, setPeriod] = useState("all");
  const [expanded, setExpanded] = useState(null);
  const [postFile, setPostFile] = useState(null);

  const fetchPosts = useCallback(() => {
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set("q", searchQuery.trim());
    if (filterTag) params.set("tag", filterTag);
    if (sort) params.set("sort", sort);
    if (period && period !== "all") params.set("period", period);
    const qs = params.toString();
    return api.get(`/community${qs ? `?${qs}` : ""}`).then((r) => setPosts(r.data));
  }, [searchQuery, filterTag, sort, period]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  function applySearch() {
    setSearchQuery(qInput.trim());
  }

  async function createPost(e) {
    e.preventDefault();
    if (!content.trim() && !postFile) return;
    const fd = new FormData();
    fd.append("content", content);
    fd.append("tags", JSON.stringify(tags));
    if (postFile) fd.append("file", postFile);
    await api.post("/community", fd);
    setContent("");
    setTags([]);
    setPostFile(null);
    fetchPosts();
  }

  async function likePost(id) {
    if (viewOnly) return;
    try {
      await api.post(`/community/${id}/like`);
      fetchPosts();
    } catch {
      /* already liked */
    }
  }

  return (
    <>
      {showComposer && (
        <form className="card" onSubmit={createPost}>
          <label className="label">New post</label>
          <textarea
            className="input"
            rows={3}
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <div className={styles.tags}>
            {TAGS.map((t) => (
              <label key={t} className={styles.tagLbl}>
                <input
                  type="checkbox"
                  checked={tags.includes(t)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setTags([...tags, t]);
                    } else {
                      setTags(tags.filter((x) => x !== t));
                    }
                  }}
                />
                {t}
              </label>
            ))}
          </div>
          <label className="label" style={{ marginTop: "0.5rem" }}>
            Attach image or document (optional)
          </label>
          <FilePicker
            accept="image/*,application/pdf,.doc,.docx"
            file={postFile}
            onChange={setPostFile}
            chooseLabel="Attach to your post"
            emptySub="Share a photo or document with the community"
            hint="Optional — images or PDF."
          />
          <button className="btn" type="submit" style={{ marginTop: "0.5rem" }}>
            Post
          </button>
        </form>
      )}

      {!showComposer && !moderation && (
        <p className={styles.staffNote}>
          Like and comment on posts below. New top-level posts are created by students from the app —
          use this feed to reply publicly.
        </p>
      )}

      {!showComposer && moderation && (
        <p className={styles.staffNote}>
          Same layout as students. You can <strong>like</strong> and <strong>comment</strong> on posts.
          Use <strong>Delete post</strong> or <strong>Delete</strong> on comments to moderate.
        </p>
      )}

      {showHeader && (
        <>
          <h1 style={{ marginTop: showComposer ? "1.25rem" : 0 }}>{title}</h1>
          {!showComposer && (
            <p className="muted" style={{ fontSize: "0.88rem" }}>
              Filter and sort match the public community API — newest, by likes, or by time window.
            </p>
          )}
        </>
      )}

      <div className={styles.toolbarWide}>
        <input
          className="input"
          placeholder="Search…"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          onBlur={applySearch}
          onKeyDown={(e) => e.key === "Enter" && applySearch()}
        />
        <select className="input" value={filterTag} onChange={(e) => setFilterTag(e.target.value)}>
          <option value="">All tags</option>
          {TAGS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select className="input" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="likes">Most likes</option>
        </select>
        <select className="input" value={period} onChange={(e) => setPeriod(e.target.value)}>
          <option value="all">All time</option>
          <option value="week">Last 7 days</option>
          <option value="month">Last 30 days</option>
        </select>
      </div>
      <div className={styles.toolbar}>
        <button
          type="button"
          className="btn btn-ghost"
          style={{ gridColumn: "1 / -1" }}
          onClick={() => fetchPosts()}
        >
          Refresh feed
        </button>
      </div>

      {posts.length === 0 && (
        <p className="muted" style={{ margin: "0 0 1rem" }}>
          No posts match your filters. Try adjusting search, tags, sort, or time range.
        </p>
      )}

      {posts.map((p) => (
        <div key={p.id} className="card">
          <div className={styles.meta}>
            <div className={styles.metaLeft}>
              <strong>{p.author?.name}</strong>
              {showStaffMeta && p.author?.email && (
                <span className={styles.authorEmail}>{p.author.email}</span>
              )}
            </div>
            <div className={styles.metaRight}>
              <span className="muted">{new Date(p.createdAt).toLocaleString()}</span>
              {moderation?.onDeletePost && (
                <button
                  type="button"
                  className={styles.postDelete}
                  onClick={async () => {
                    if (
                      !window.confirm(
                        "Delete this post? All comments and likes on it will be removed too."
                      )
                    ) {
                      return;
                    }
                    await moderation.onDeletePost(p.id);
                    fetchPosts();
                  }}
                >
                  Delete post
                </button>
              )}
            </div>
          </div>
          <p style={{ margin: "0.5rem 0" }}>
            {p.content !== "(attachment)" ? p.content : <span className="muted">(attachment)</span>}
          </p>
          {p.attachmentPath && (
            <div className={styles.attachWrap}>
              {/\.pdf$/i.test(p.attachmentPath) ? (
                <a
                  href={p.attachmentPath}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.attachLink}
                >
                  Open PDF / document
                </a>
              ) : (
                <img src={p.attachmentPath} alt="Attachment" className={styles.attachImg} />
              )}
            </div>
          )}
          <div className="muted" style={{ fontSize: "0.8rem" }}>
            {(p.tagsParsed || []).join(", ")}
          </div>
          <div className={styles.actions}>
            <button
              type="button"
              className={`btn btn-ghost ${styles.likeBtn}`}
              onClick={() => likePost(p.id)}
              disabled={viewOnly}
            >
              ♥ {p._count?.likes ?? 0}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn"
              onClick={() => setExpanded(expanded === p.id ? null : p.id)}
            >
              Comments ({p._count?.comments ?? 0})
            </button>
          </div>
          {expanded === p.id && (
            <CommentBlock
              postId={p.id}
              onPosted={fetchPosts}
              viewOnly={viewOnly}
              onDeleteComment={moderation?.onDeleteComment}
            />
          )}
        </div>
      ))}
    </>
  );
}

function CommentBlock({ postId, onPosted, viewOnly, onDeleteComment }) {
  const [text, setText] = useState("");
  const [list, setList] = useState([]);

  useEffect(() => {
    api.get(`/community/${postId}/comments`).then((r) => setList(r.data));
  }, [postId]);

  async function submit(e) {
    e.preventDefault();
    if (!text.trim() || viewOnly) return;
    await api.post(`/community/${postId}/comment`, { content: text });
    setText("");
    const r = await api.get(`/community/${postId}/comments`);
    setList(r.data);
    await onPosted?.();
  }

  return (
    <div className={styles.comments}>
      {list.map((c) => (
        <div key={c.id} className={styles.cmt}>
          <div className={styles.cmtBody}>
            <strong>{c.author?.name}</strong>: {c.content}
          </div>
          {onDeleteComment && (
            <button
              type="button"
              className={styles.modDeleteSmall}
              onClick={async () => {
                if (!window.confirm("Delete this comment permanently?")) return;
                await onDeleteComment(c.id);
                const r = await api.get(`/community/${postId}/comments`);
                setList(r.data);
                await onPosted?.();
              }}
            >
              Delete
            </button>
          )}
        </div>
      ))}
      {!viewOnly && (
        <form onSubmit={submit}>
          <input
            className="input"
            placeholder="Add comment"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </form>
      )}
    </div>
  );
}
