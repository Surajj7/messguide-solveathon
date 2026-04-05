import React from "react";
import { BackLink } from "../../components/BackLink.jsx";
import CommunityFeed from "../../components/CommunityFeed.jsx";

export default function CommunityPage() {
  return (
    <div className="page">
      <BackLink />
      <h1>Community</h1>
      <p className="muted">Open feed — keep it respectful.</p>
      <p className="muted" style={{ fontSize: "0.82rem", marginTop: "0.35rem" }}>
        Admins may remove posts or comments that break guidelines or campus policies.
      </p>
      <CommunityFeed showComposer showHeader={false} />
    </div>
  );
}
