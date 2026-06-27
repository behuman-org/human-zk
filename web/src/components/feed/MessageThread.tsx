import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  fetchPublicProfile,
  fetchThread,
  formatTimeAgo,
  markConversationRead,
  profilePath,
  sendMessage,
} from "../../feed/feedApi";
import { useUser } from "../../feed/UserContext";
import { useI18n } from "../../i18n/I18nProvider";
import type { DirectMessage, UserProfile } from "../../feed/types";
import { ChatComposer } from "./ChatComposer";
import { UserAvatar } from "./UserAvatar";
import "./MessageThread.css";

interface MessageThreadProps {
  peerPlatformId: string;
  onSent?: () => void;
}

export function MessageThread({ peerPlatformId, onSent }: MessageThreadProps) {
  const { user } = useUser();
  const { t } = useI18n();
  const m = t.social.messages;
  const [peer, setPeer] = useState<UserProfile | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const endRef = useRef<HTMLLIElement>(null);

  const load = useCallback(async () => {
    const [thread, profile] = await Promise.all([
      fetchThread(user.platformId, peerPlatformId),
      fetchPublicProfile(peerPlatformId),
    ]);
    setMessages(thread);
    setPeer(profile);
    await markConversationRead(user.platformId, peerPlatformId);
    onSent?.();
  }, [user.platformId, peerPlatformId, onSent]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const reduced =
      document.documentElement.classList.contains("reduce-motion") ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    endRef.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
  }, [messages]);

  async function handleSend(content: string) {
    await sendMessage(user.platformId, peerPlatformId, content);
    await load();
  }

  if (!peer) {
    return <p className="feed-empty">{m.loading}</p>;
  }

  const chatLabel = m.ariaChat.replace("{name}", peer.username);

  return (
    <div className="message-thread">
      <header className="message-thread__head">
        <Link to={profilePath(peer.platformId)} className="message-thread__peer">
          <UserAvatar user={peer} size="sm" verified />
          <span>
            <span className="message-thread__name">{peer.username}</span>
            <span className="message-thread__handle">@{peer.handle}</span>
          </span>
        </Link>
      </header>

      <ul className="message-thread__list" aria-label={chatLabel}>
        {messages.length === 0 ? (
          <li className="message-thread__empty">{m.threadEmpty}</li>
        ) : (
          messages.map((m) => {
            const own = m.fromPlatformId === user.platformId;
            return (
              <li
                key={m.id}
                className={`message-thread__bubble-wrap ${own ? "is-own" : "is-peer"}`.trim()}
              >
                <div className="message-thread__bubble">
                  <p className="message-thread__text">{m.content}</p>
                  <time className="message-thread__time" dateTime={new Date(m.ts).toISOString()}>
                    {formatTimeAgo(m.ts)}
                  </time>
                </div>
              </li>
            );
          })
        )}
        <li ref={endRef} aria-hidden="true" />
      </ul>

      <ChatComposer onSend={handleSend} placeholder={m.placeholder} sendLabel={m.send} />
    </div>
  );
}
