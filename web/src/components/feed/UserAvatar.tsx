import { avatarColor } from "../../feed/session";
import type { UserProfile } from "../../feed/types";
import "./UserAvatar.css";

interface UserAvatarProps {
  user: Pick<UserProfile, "username" | "avatarIndex">;
  size?: "sm" | "md" | "lg";
  verified?: boolean;
  className?: string;
}

export function UserAvatar({ user, size = "md", verified = false, className = "" }: UserAvatarProps) {
  const initial = (user.username[0] ?? "?").toUpperCase();
  const bg = avatarColor(user.avatarIndex);

  return (
    <span
      className={`user-avatar user-avatar--${size} ${verified ? "user-avatar--verified" : ""} ${className}`.trim()}
      style={{ backgroundColor: bg }}
      aria-hidden="true"
    >
      {initial}
    </span>
  );
}
