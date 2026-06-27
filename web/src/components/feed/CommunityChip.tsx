import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import type { Community } from "../../feed/types";
import { communityLabel } from "../../feed/feedApi";
import "./CommunityChip.css";

interface CommunityChipProps {
  community: Community;
  link?: boolean;
  size?: "sm" | "md";
}

export function CommunityChip({ community, link = true, size = "sm" }: CommunityChipProps) {
  const className = `community-chip community-chip--${size}`;
  const style = { "--chip-accent": community.accent } as CSSProperties;
  const label = communityLabel(community);

  if (link) {
    return (
      <Link to={`/app/r/${community.slug}`} className={className} style={style}>
        {label}
      </Link>
    );
  }

  return (
    <span className={className} style={style}>
      {label}
    </span>
  );
}
