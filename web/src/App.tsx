import { Route, Routes } from "react-router-dom";
import { AuthPage } from "./pages/AuthPage";
import { ComposePage } from "./pages/ComposePage";
import { ExplorePage } from "./pages/ExplorePage";
import { FeedPage } from "./pages/FeedPage";
import { LandingPage } from "./pages/LandingPage";
import { MessagesPage } from "./pages/MessagesPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { ProfilePage } from "./pages/ProfilePage";
import { SettingsPage } from "./pages/SettingsPage";
import { SocialShell } from "./pages/SocialShell";

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/app" element={<SocialShell />}>
        <Route index element={<FeedPage />} />
        <Route path="r/:communityId" element={<FeedPage />} />
        <Route path="explore" element={<ExplorePage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="u/:platformId" element={<ProfilePage />} />
        <Route path="compose" element={<ComposePage />} />
        <Route path="messages" element={<MessagesPage />} />
        <Route path="messages/:platformId" element={<MessagesPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="/login" element={<AuthPage defaultTab="login" />} />
      <Route path="/register" element={<AuthPage defaultTab="register" />} />
    </Routes>
  );
}

export default App;
