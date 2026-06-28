import { Route, Routes } from "react-router-dom";
import { ArticleEditorPage } from "./pages/ArticleEditorPage";
import { ArticleViewPage } from "./pages/ArticleViewPage";
import { ArticlesPage } from "./pages/ArticlesPage";
import { AuthPage } from "./pages/AuthPage";
import { CampaignDetailPage } from "./pages/CampaignDetailPage";
import { CausesPage } from "./pages/CausesPage";
import { ComposePage } from "./pages/ComposePage";
import { ExplorePage } from "./pages/ExplorePage";
import { FeedPage } from "./pages/FeedPage";
import { LandingPage } from "./pages/LandingPage";
import { MessagesPage } from "./pages/MessagesPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { PostThreadPage } from "./pages/PostThreadPage";
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
        <Route path="articles" element={<ArticlesPage />} />
        <Route path="articles/new" element={<ArticleEditorPage />} />
        <Route path="articles/:id" element={<ArticleViewPage />} />
        <Route path="causes" element={<CausesPage />} />
        <Route path="causes/:id" element={<CampaignDetailPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="u/:platformId" element={<ProfilePage />} />
        <Route path="post/:id" element={<PostThreadPage />} />
        <Route path="compose" element={<ComposePage />} />
        <Route path="messages" element={<MessagesPage />} />
        <Route path="messages/:platformId" element={<MessagesPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route path="/login" element={<AuthPage defaultTab="login" />} />
      <Route path="/register" element={<AuthPage defaultTab="register" />} />
    </Routes>
  );
}

export default App;
