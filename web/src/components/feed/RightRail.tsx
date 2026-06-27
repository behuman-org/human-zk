import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { communityLabel, fetchCommunities } from "../../feed/feedApi";
import { useUser } from "../../feed/UserContext";
import type { Community } from "../../feed/types";
import { UserAvatar } from "./UserAvatar";
import "./RightRail.css";

export function RightRail() {
  const { user } = useUser();
  const [communities, setCommunities] = useState<Community[]>([]);

  useEffect(() => {
    void fetchCommunities().then(setCommunities);
  }, []);

  const popular = [...communities].sort((a, b) => b.memberCount - a.memberCount).slice(0, 4);

  return (
    <aside className="right-rail" aria-label="Contexto del feed">
      <section className="right-rail__identity">
        <UserAvatar user={user} size="md" verified />
        <div>
          <p className="right-rail__name">{user.username || user.handle}</p>
          <p className="right-rail__handle">@{user.handle}</p>
        </div>
        <Link to="/app/profile" className="right-rail__edit">
          Editar
        </Link>
      </section>

      <section className="right-rail__card">
        <h2 className="right-rail__title">Hilos</h2>
        {popular.length === 0 ? (
          <p className="right-rail__empty">No hay hilos todavía.</p>
        ) : (
          <ul className="right-rail__list">
            {popular.map((c) => (
              <li key={c.id}>
                <NavLink to={`/app/r/${c.slug}`} className="right-rail__community">
                  <span className="right-rail__community-name">{communityLabel(c)}</span>
                  <span className="right-rail__community-meta">
                    {c.memberCount.toLocaleString("es-AR")} personas
                  </span>
                </NavLink>
              </li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  );
}
