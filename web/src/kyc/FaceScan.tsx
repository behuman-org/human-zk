// Live face scan (getUserMedia) + liveness challenges.
import { useEffect, useRef, useState } from "react";
import { Button } from "../components/ui/Button";

const CHALLENGES = [
  "Look at the camera",
  "Blink a few times",
  "Slowly turn your head side to side",
];

export function FaceScan({ onCaptured }: { onCaptured: (frames: Blob[]) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState("Starting camera…");
  const [prompt, setPrompt] = useState("");
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setStatus("Camera ready");
      } catch (e) {
        setStatus("Could not access camera: " + (e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function grabFrame(): Promise<Blob> {
    const v = videoRef.current!;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext("2d")!.drawImage(v, 0, 0);
    return new Promise((resolve) => canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.9));
  }

  async function runScan() {
    setScanning(true);
    const frames: Blob[] = [];
    for (let i = 0; i < 12; i++) {
      setPrompt(CHALLENGES[Math.floor(i / 4) % CHALLENGES.length]);
      await new Promise((r) => setTimeout(r, 420));
      frames.push(await grabFrame());
    }
    setPrompt("Processing…");
    streamRef.current?.getTracks().forEach((t) => t.stop());
    onCaptured(frames);
  }

  return (
    <section className="bh-card">
      <p className="bh-eyebrow">Step 3 of 3</p>
      <h2 className="bh-h2">Face scan</h2>
      <p className="bh-sub">{status}</p>

      <div className="bh-banner bh-banner--info">
        <strong>To validate your face:</strong>
        <ul className="bh-list">
          <li>🔆 Use <strong>good front lighting</strong> — avoid backlight and harsh shadows.</li>
          <li>🎯 Center your <strong>face in the frame</strong> at a medium distance.</li>
          <li>🙂 No dark glasses or hat; follow the prompts below.</li>
        </ul>
      </div>

      <video ref={videoRef} playsInline muted className="bh-video" />
      {prompt && <p className="bh-note" style={{ fontWeight: 600, color: "var(--color-text)" }}>{prompt}</p>}
      <div className="bh-actions">
        <Button disabled={scanning} onClick={runScan}>
          {scanning ? "Scanning…" : "Start scan"}
        </Button>
      </div>
    </section>
  );
}
