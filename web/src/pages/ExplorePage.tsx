import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CreateThreadModal } from "../components/feed/CreateThreadModal";
import { fetchCommunities } from "../feed/feedApi";
import { useI18n } from "../i18n/I18nProvider";
import type { Community } from "../feed/types";
import "./ExplorePage.css";
import "./SocialShell.css";

export function ExplorePage() {
  const { t, locale } = useI18n();
  const e = t.social.explore;
  const f = t.social.feed;
  const navigate = useNavigate();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [createOpen, setCreateOpen] = useState(false);

  function reload() {
    void fetchCommunities().then(setCommunities);
  }

  useEffect(() => {
    reload();
  }, []);

  return (
    <div className="explore-page">
      <header className="feed-column__top page-header-split">
        <div>
          <h1 className="feed-column__title">{e.title}</h1>
          <p className="feed-column__subtitle">{e.subtitle}</p>
        </div>
        <div className="page-header-split__actions">
          <button type="button" className="explore-page__create" onClick={() => setCreateOpen(true)}>
            {e.create}
          </button>
        </div>
      </header>
      <ul className="explore-page__list">
        {communities.map((c) => (
          <li key={c.id}>
            <Link to={`/app/r/${c.slug}`} className="explore-page__item">
              <span className="explore-page__icon">r/</span>
              <span className="explore-page__body">
                <span className="explore-page__name">{c.name}</span>
                <span className="explore-page__desc">{c.description}</span>
                <span className="explore-page__meta">
                  {c.memberCount.toLocaleString(locale === "es" ? "es-AR" : "en-US")} {f.members}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <CreateThreadModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(slug) => {
          reload();
          navigate(`/app/r/${slug}`);
        }}
      />
    </div>
  );
}
