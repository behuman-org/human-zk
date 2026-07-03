// Capa 2 — Editor de artículo (long-form). Banner + cuerpo markdown con imágenes embebidas.
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Markdown } from "../components/markdown/Markdown";
import { loadAnyCredential } from "../kyc/credentialStore";
import { anchorArticle, quoteArticle } from "../identity/article";
import { createArticle } from "../feed/articlesApi";
import { useI18n } from "../i18n/useI18n";
import "../styles/behuman-ui.css";
import "./Articles.css";

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("read failed"));
    r.readAsDataURL(file);
  });
}

export function ArticleEditorPage() {
  const navigate = useNavigate();
  const { locale, t } = useI18n();
  const articles = t.social.articles;
  const ed = articles.editor;
  const common = t.social.common;
  const [cred] = useState(() => loadAnyCredential());
  const [title, setTitle] = useState("");
  const [banner, setBanner] = useState("");
  const [content, setContent] = useState("");
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quote, setQuote] = useState<{
    feeXlm: string;
    registerXlm: string;
    postXlm: string;
    alreadyRegistered: boolean;
    alreadyPosted: boolean;
  } | null>(null);
  const imgInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setContent(ed.sampleMarkdown);
  }, [locale, ed.sampleMarkdown]);

  const valid = title.trim().length >= 3 && content.trim().length >= 10;

  async function onBanner(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      setBanner(await fileToDataUrl(f));
    } catch {
      setError(ed.imageReadError);
    }
  }

  async function onInsertImage(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const url = await fileToDataUrl(f);
      setContent((c) => `${c}\n\n![image](${url})\n`);
    } catch {
      setError(ed.imageReadError);
    }
    if (imgInput.current) imgInput.current.value = "";
  }

  async function onCotizar() {
    setError(null);
    setQuote(null);
    try {
      setBusy(ed.busyQuote);
      const q = await quoteArticle({ title: title.trim(), banner, content });
      setQuote({
        feeXlm: q.feeXlm,
        registerXlm: q.registerXlm,
        postXlm: q.postXlm,
        alreadyRegistered: q.alreadyRegistered,
        alreadyPosted: q.alreadyPosted,
      });
      setBusy(null);
    } catch (e) {
      setBusy(null);
      setError(errMsg(e, ed.needVerify));
    }
  }

  async function onPublicar() {
    setError(null);
    try {
      setBusy(ed.busyPublish);
      const anchored = await anchorArticle({ title: title.trim(), banner, content });
      setBusy(ed.busySaving);
      const created = await createArticle({
        platformId: anchored.platformId,
        title: title.trim(),
        banner,
        content,
        contentHash: anchored.contentHash,
        txHash: anchored.txHash,
      });
      navigate(`/app/articles/${created.id}`);
    } catch (e) {
      setBusy(null);
      setError(errMsg(e, ed.needVerify));
    }
  }

  if (!cred) {
    return (
      <div className="bh app-page articles">
        <div className="bh-card">
          <h2 className="bh-h2">{ed.gateTitle}</h2>
          <p className="bh-p">
            {ed.gateBody}{" "}
            <Link to="/onboarding" className="bh-back">
              {common.verifyLink}
            </Link>
            .
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bh app-page articles">
      <Link to="/app/articles" className="bh-back">
        ← {articles.back}
      </Link>
      <header style={{ margin: "0.75rem 0 1rem" }}>
        <p className="bh-eyebrow">{ed.eyebrow}</p>
        <h1 className="bh-h1">{ed.title}</h1>
        <p className="bh-sub">{ed.subtitle}</p>
      </header>

      <div className="bh-card">
        <label className="bh-field">
          <span className="bh-label">{ed.fieldTitle}</span>
          <input
            className="bh-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={ed.titlePlaceholder}
          />
        </label>

        <span className="bh-label">{ed.bannerLabel}</span>
        {banner && (
          <div className="article-banner article-banner--preview" style={{ backgroundImage: `url(${banner})` }} />
        )}
        <div className="bh-actions" style={{ marginBottom: "0.5rem" }}>
          <label className="article-upload">
            {banner ? ed.changeBanner : ed.uploadBanner}
            <input type="file" accept="image/*" onChange={onBanner} hidden />
          </label>
          {banner && (
            <Button variant="ghost" onClick={() => setBanner("")}>
              {ed.removeBanner}
            </Button>
          )}
        </div>

        <div className="article-tabs">
          <button
            type="button"
            className={tab === "write" ? "is-active" : ""}
            onClick={() => setTab("write")}
          >
            {ed.tabWrite}
          </button>
          <button
            type="button"
            className={tab === "preview" ? "is-active" : ""}
            onClick={() => setTab("preview")}
          >
            {ed.tabPreview}
          </button>
        </div>

        {tab === "write" ? (
          <>
            <textarea
              className="bh-textarea article-body-input"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={16}
            />
            <div className="bh-actions">
              <label className="article-upload">
                {ed.insertImage}
                <input ref={imgInput} type="file" accept="image/*" onChange={onInsertImage} hidden />
              </label>
              <span className="bh-note" style={{ margin: 0 }}>
                {ed.markdownHint}
              </span>
            </div>
          </>
        ) : (
          <div className="article-preview">
            <Markdown>{content || ed.previewEmpty}</Markdown>
          </div>
        )}
      </div>

      <div className="bh-card">
        <h2 className="bh-h2">{ed.anchorTitle}</h2>
        <p className="bh-sub">{ed.anchorBody}</p>
        <div className="bh-actions">
          <Button variant="secondary" onClick={onCotizar} disabled={!!busy || !valid}>
            {ed.quote}
          </Button>
          <Button onClick={onPublicar} disabled={!!busy || !valid}>
            {ed.publish}
          </Button>
        </div>
        {quote && (
          <div className="bh-note bh-note--ok">
            {quote.alreadyPosted ? (
              <p style={{ margin: 0 }}>{ed.alreadyAnchored}</p>
            ) : (
              <>
                <p style={{ margin: 0 }}>{ed.quoteFee.replace("{fee}", quote.feeXlm)}</p>
                {!quote.alreadyRegistered && Number(quote.registerXlm) > 0 && (
                  <p style={{ margin: "0.25rem 0 0", fontSize: "0.8rem", opacity: 0.85 }}>
                    {ed.quoteRegister
                      .replace("{register}", quote.registerXlm)
                      .replace("{post}", quote.postXlm)}
                  </p>
                )}
                <p style={{ margin: "0.25rem 0 0", fontSize: "0.8rem", opacity: 0.85 }}>
                  {ed.quoteHashOnly}
                </p>
              </>
            )}
          </div>
        )}
        {busy && <p className="bh-note">⏳ {busy}</p>}
        {error && <p className="bh-note bh-note--err">{error}</p>}
      </div>
    </div>
  );
}

function errMsg(e: unknown, needVerify: string): string {
  const m = (e as Error).message;
  if (m === "verification_required") return needVerify;
  return m;
}
