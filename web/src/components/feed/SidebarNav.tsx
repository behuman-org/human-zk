import { NavLink, Link } from "react-router-dom";
import { brand } from "../../content/brand";
import { useUser } from "../../feed/UserContext";
import { useI18n } from "../../i18n/I18nProvider";
import { UserAvatar } from "./UserAvatar";
import "./SidebarNav.css";

export function SidebarNav() {
  const { user } = useUser();
  const { t, locale } = useI18n();
  const n = t.social.nav;
  const causasLabel = locale === "es" ? "Causas" : "Causes";
  const articulosLabel = locale === "es" ? "Artículos" : "Articles";

  // Notificaciones y Mensajes ocultos por ahora (no implementados todavía).
  const desktopNav = [
    { to: "/app", label: n.feed, end: true as const },
    { to: "/app/articles", label: articulosLabel, end: false as const },
    { to: "/app/causes", label: causasLabel, end: false as const },
    { to: "/app/settings", label: n.settings, end: false as const, desktopOnly: true as const },
  ];

  const mobileNav = [
    { to: "/app", label: n.feed, end: true as const },
    { to: "/app/articles", label: articulosLabel, end: false as const },
    { to: "/app/causes", label: causasLabel, end: false as const },
    { to: "/app/compose", label: n.publish, end: false as const, compose: true as const },
    { to: "/app/profile", label: n.profile, end: false as const, profile: true as const },
  ];

  function renderItem(item: (typeof desktopNav)[number] | (typeof mobileNav)[number]) {
    const isCompose = "compose" in item && item.compose;
    const isProfile = "profile" in item && item.profile;

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
        </NavLink>
      </li>
    );
  }

  return (
    <nav className="sidebar-nav" aria-label="Navegación principal">
      <Link to="/" className="sidebar-nav__logo" aria-label={`${brand.wordmark} — inicio`}>
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
