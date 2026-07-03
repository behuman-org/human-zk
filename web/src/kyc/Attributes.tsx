// Declared attributes (testnet). In production they would be attested by a regulated provider/OCR.
// Document number is used ONLY for de-dup (hash with pepper); never stored in plaintext.
import { useState } from "react";
import { Button } from "../components/ui/Button";

export interface AttributesInput {
  birthYear: number;
  countryCode: number; // ISO 3166-1 numeric (matches the circuit)
  docId: string;
}

const COUNTRIES = [
  { code: 32, name: "Argentina" },
  { code: 76, name: "Brazil" },
  { code: 152, name: "Chile" },
  { code: 858, name: "Uruguay" },
];

export function Attributes({ onNext }: { onNext: (a: AttributesInput) => void }) {
  const [birthYear, setBirthYear] = useState("");
  const [countryCode, setCountryCode] = useState(32);
  const [docId, setDocId] = useState("");

  const year = Number(birthYear);
  const valid = year >= 1900 && year <= 2026 && docId.trim().length >= 4;

  return (
    <section className="bh-card">
      <p className="bh-eyebrow">Step 2 of 3</p>
      <h2 className="bh-h2">Your details</h2>
      <p className="bh-sub">
        The circuit only proves <strong>legal age</strong> and <strong>allowed country</strong> — values are not published.
      </p>

      <label className="bh-field">
        <span className="bh-label">Year of birth</span>
        <input className="bh-input" type="number" value={birthYear} onChange={(e) => setBirthYear(e.target.value)} placeholder="1995" />
      </label>
      <label className="bh-field">
        <span className="bh-label">Country</span>
        <select className="bh-select" value={countryCode} onChange={(e) => setCountryCode(Number(e.target.value))}>
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>{c.name}</option>
          ))}
        </select>
      </label>
      <label className="bh-field">
        <span className="bh-label">Document number</span>
        <input className="bh-input" value={docId} onChange={(e) => setDocId(e.target.value)} placeholder="12345678" />
      </label>

      <div className="bh-banner bh-banner--info">
        Enter details <strong>exactly as shown on your ID</strong> (year and number). They are
        <strong> checked against the photo</strong>: if they do not match or the document cannot be read,
        upload a <strong>horizontal, centered, well-lit</strong> photo.
      </div>
      <div className="bh-actions">
        <Button disabled={!valid} onClick={() => onNext({ birthYear: year, countryCode, docId: docId.trim() })}>
          Match with ID and continue
        </Button>
      </div>
    </section>
  );
}
