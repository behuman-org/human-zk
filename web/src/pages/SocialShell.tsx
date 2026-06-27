import { Outlet } from "react-router-dom";
import { UserProvider } from "../feed/UserContext";
import { AppPreferencesProvider, useAppPreferences } from "../preferences/AppPreferencesProvider";
import { RightRail } from "../components/feed/RightRail";
import { SidebarNav } from "../components/feed/SidebarNav";
import "../styles/social-ui.css";
import "./SocialShell.css";

function SocialShellLayout() {
  const { resolvedTheme } = useAppPreferences();

  return (
    <div className="social-shell" data-theme={resolvedTheme}>
      <div className="social-shell__grid">
        <div className="social-shell__left">
          <SidebarNav />
        </div>
        <div className="social-shell__main">
          <Outlet />
        </div>
        <aside className="social-shell__right" aria-label="Panel contextual">
          <RightRail />
        </aside>
      </div>
    </div>
  );
}

export function SocialShell() {
  return (
    <AppPreferencesProvider>
      <UserProvider>
        <SocialShellLayout />
      </UserProvider>
    </AppPreferencesProvider>
  );
}
