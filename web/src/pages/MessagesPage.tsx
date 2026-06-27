import { useCallback, useEffect, useState } from "react";
import { Link, NavLink, useNavigate, useParams } from "react-router-dom";
import { MessageThread } from "../components/feed/MessageThread";
import { UserAvatar } from "../components/feed/UserAvatar";
import {
  fetchConversations,
  formatTimeAgo,
  getUnreadMessagesCount,
  messagesPath,
} from "../feed/feedApi";
import { useUser } from "../feed/UserContext";
import { useI18n } from "../i18n/I18nProvider";
import type { Conversation } from "../feed/types";
import "./MessagesPage.css";
import "./SocialShell.css";

export function MessagesPage() {
  const { platformId: peerPlatformId } = useParams<{ platformId?: string }>();
  const { user } = useUser();
  const { t } = useI18n();
  const m = t.social.messages;
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [unreadTotal, setUnreadTotal] = useState(0);

  const reload = useCallback(async () => {
    const list = await fetchConversations(user.platformId);
    setConversations(list);
    setUnreadTotal(await getUnreadMessagesCount(user.platformId));
  }, [user.platformId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <div className={`messages-page ${peerPlatformId ? "has-thread" : ""}`.trim()}>
      <aside className="messages-page__list-pane" aria-label={m.inbox}>
        <header className="feed-column__top messages-page__top">
          <div>
            <h1 className="feed-column__title">{m.title}</h1>
            {unreadTotal > 0 && (
              <p className="feed-column__subtitle">
                {unreadTotal} {m.unread}
              </p>
            )}
          </div>
        </header>

        <ul className="messages-page__list">
          {conversations.length === 0 ? (
            <li className="feed-empty">{m.empty}</li>
          ) : (
            conversations.map((c) => (
              <li key={c.peerPlatformId}>
                <NavLink
                  to={messagesPath(c.peerPlatformId)}
                  className={({ isActive }) =>
                    `messages-page__item ${isActive ? "is-active" : ""} ${c.unreadCount > 0 ? "is-unread" : ""}`.trim()
                  }
                >
                  <UserAvatar
                    user={{
                      username: c.peerUsername,
                      avatarIndex: c.peerAvatarIndex,
                    }}
                    size="md"
                    verified
                  />
                  <span className="messages-page__body">
                    <span className="messages-page__row">
                      <span className="messages-page__name">{c.peerUsername}</span>
                      <time className="messages-page__time">{formatTimeAgo(c.lastTs)}</time>
                    </span>
                    <span className="messages-page__preview">{c.lastMessage}</span>
                  </span>
                  {c.unreadCount > 0 && (
                    <span className="messages-page__badge">{c.unreadCount}</span>
                  )}
                </NavLink>
              </li>
            ))
          )}
        </ul>
      </aside>

      <section className="messages-page__thread-pane" aria-label={m.chat}>
        {peerPlatformId ? (
          <>
            <div className="messages-page__mobile-back">
              <button type="button" onClick={() => navigate("/app/messages")}>
                ← {m.back}
              </button>
            </div>
            <MessageThread peerPlatformId={peerPlatformId} onSent={() => void reload()} />
          </>
        ) : (
          <div className="messages-page__placeholder">
            <p>{m.pick}</p>
            <Link to="/app/explore">{m.exploreHint}</Link>
          </div>
        )}
      </section>
    </div>
  );
}
