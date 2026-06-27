import { useNavigate } from "react-router-dom";
import { PostComposer } from "../components/feed/PostComposer";
import { GENERAL_FEED_ID, publishPost } from "../feed/feedApi";
import { useI18n } from "../i18n/I18nProvider";
import "./SocialShell.css";

export function ComposePage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const c = t.social.compose;

  async function handlePublish(content: string, communityId: string) {
    await publishPost({
      content,
      communityId: communityId === "feed" ? GENERAL_FEED_ID : communityId,
    });
    navigate("/app");
  }

  return (
    <div className="feed-column">
      <header className="feed-column__top">
        <h1 className="feed-column__title">{c.title}</h1>
        <p className="feed-column__subtitle">{c.subtitle}</p>
      </header>
      <PostComposer variant="general" onPublish={handlePublish} autoFocus />
    </div>
  );
}
