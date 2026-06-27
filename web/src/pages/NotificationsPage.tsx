import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  fetchNotifications,
  formatTimeAgo,
  readAllNotifications,
  readNotification,
} from "../feed/feedApi";
import { useI18n } from "../i18n/I18nProvider";
import type { AppNotification } from "../feed/types";
import "./NotificationsPage.css";
import "./SocialShell.css";

export function NotificationsPage() {
  const { t } = useI18n();
  const n = t.social.notifications;
  const [items, setItems] = useState<AppNotification[]>([]);

  function reload() {
    void fetchNotifications().then(setItems);
  }

  useEffect(() => {
    reload();
  }, []);

  async function openNotification(n: AppNotification) {
    if (!n.read) {
      await readNotification(n.id);
      reload();
    }
  }

  async function markAll() {
    await readAllNotifications();
    reload();
  }

  const unread = items.filter((n) => !n.read).length;

  return (
    <div className="notifications-page">
      <header className="feed-column__top page-header-split">
        <div>
          <h1 className="feed-column__title">{n.title}</h1>
          {unread > 0 && (
            <p className="feed-column__subtitle">
              {unread} {n.unread}
            </p>
          )}
        </div>
        {unread > 0 && (
          <div className="page-header-split__actions">
            <button type="button" className="notifications-page__mark-all" onClick={() => void markAll()}>
              {n.markAll}
            </button>
          </div>
        )}
      </header>

      <ul className="notifications-page__list">
        {items.length === 0 ? (
          <li className="feed-empty">{n.empty}</li>
        ) : (
          items.map((n) => {
            const body = (
              <>
                <span className="notifications-page__text">{n.text}</span>
                <time className="notifications-page__time">{formatTimeAgo(n.ts)}</time>
              </>
            );
            return (
              <li key={n.id} className={n.read ? "" : "is-unread"}>
                {n.href ? (
                  <Link
                    to={n.href}
                    className="notifications-page__item"
                    onClick={() => void openNotification(n)}
                  >
                    {body}
                  </Link>
                ) : (
                  <button
                    type="button"
                    className="notifications-page__item"
                    onClick={() => void openNotification(n)}
                  >
                    {body}
                  </button>
                )}
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
