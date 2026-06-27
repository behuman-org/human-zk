import { NavLink, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { brand } from "../../content/brand";
import { getUnreadMessagesCount, getUnreadNotificationCount } from "../../feed/feedApi";
import { useUser } from "../../feed/UserContext";
import { useI18n } from "../../i18n/I18nProvider";
import { UserAvatar } from "./UserAvatar";
import "./SidebarNav.css";

export function SidebarNav() {
  const { user } = useUser();
  const { t } = useI18n();
  const n = t.social.nav;
  const [unreadNotif, setUnreadNotif] = useState(0);
  const [unreadMsg, setUnreadMsg] = useState(0);

  const desktopNav = [
    { to: "/app", label: n.feed, end: true as const },
    { to: "/app/explore", label: n.threads, end: false as const },
    { to: "/app/messages", label: n.messages, end: false as const, msgBadge: true as const },
    { to: "/app/notifications", label: n.notifications, end: false as const, notifBadge: true as const },
    { to: "/app/settings", label: n.settings, end: false as const, desktopOnly: true as const },
  ];

  const mobileNav = [
    { to: "/app", label: n.feed, end: true as const },
    { to: "/app/explore", label: n.threads, end: false as const },
    { to: "/app/messages", label: n.messages, end: false as const, msgBadge: true as const },
    { to: "/app/compose", label: n.publish, end: false as const, compose: true as const },
    { to: "/app/profile", label: n.profile, end: false as const, profile: true as const },
  ];

  useEffect(() => {
    async function refresh() {
      const [notif, msg] = await Promise.all([
        getUnreadNotificationCount(),
        getUnreadMessagesCount(user.platformId),
      ]);
      setUnreadNotif(notif);
      setUnreadMsg(msg);
    }
    void refresh();
    const id = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(id);
  }, [user.platformId]);

  function renderItem(item: (typeof desktopNav)[number] | (typeof mobileNav)[number]) {
    const isCompose = "compose" in item && item.compose;
    const isProfile = "profile" in item && item.profile;
    const badgeCount =
      "msgBadge" in item && item.msgBadge
        ? unreadMsg
        : "notifBadge" in item && item.notifBadge
          ? unreadNotif
          : 0;

    if (isCompose) {
      return (
        <li key={item.to} className="sidebar-nav__mobile-compose-wrap">
          <Link to={item.to} className="sidebar-nav__mobile-compose" aria-label={item.label}>
            +
          </Link>
        </li>
      );
    }

    if (isProfile) {
      return (
        <li key={item.to}>
          <NavLink
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `sidebar-nav__link sidebar-nav__link--profile ${isActive ? "is-active" : ""}`.trim()
            }
            aria-label={item.label}
          >
            <UserAvatar user={user} size="sm" verified />
          </NavLink>
        </li>
      );
    }

    return (
      <li key={item.to} className={"desktopOnly" in item && item.desktopOnly ? "sidebar-nav__desktop-only" : ""}>
        <NavLink
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            `sidebar-nav__link ${isActive ? "is-active" : ""}`.trim()
          }
        >
          <span className="sidebar-nav__link-text">{item.label}</span>
          {badgeCount > 0 && (
            <span className="sidebar-nav__badge" aria-label={`${badgeCount} ${n.unread}`}>
              {badgeCount > 9 ? "9+" : badgeCount}
            </span>
          )}
        </NavLink>
      </li>
    );
  }

  return (
    <nav className="sidebar-nav" aria-label="Navegación principal">
      <Link to="/app" className="sidebar-nav__logo">
        <img src={brand.logoHorizontal} alt={brand.wordmark} />
      </Link>

      <ul className="sidebar-nav__list sidebar-nav__list--desktop">
        {desktopNav.map(renderItem)}
      </ul>

      <ul className="sidebar-nav__list sidebar-nav__list--mobile">
        {mobileNav.map(renderItem)}
      </ul>

      <Link to="/app/compose" className="sidebar-nav__compose">
        {n.publish}
      </Link>

      <Link to="/app/profile" className="sidebar-nav__user">
        <UserAvatar user={user} size="sm" verified />
        <span className="sidebar-nav__user-meta">
          <span className="sidebar-nav__username">{user.username}</span>
          <span className="sidebar-nav__handle">@{user.handle}</span>
        </span>
      </Link>
    </nav>
  );
}
