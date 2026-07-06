"use client";

import Link from "next/link";
import { ChangeEvent, useEffect, useRef, useState } from "react";
import { collection, addDoc, onSnapshot, serverTimestamp, type DocumentReference } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuthStore, type JobDoc } from "@sfw/shared";

const POSES = [
  { id: "celebration", label: "Celebration" },
  { id: "volley",      label: "Volley" },
  { id: "dribble",     label: "Dribble" },
];

const TEAMS = [
  { id: "nigeria", name: "Nigeria", flag: "🇳🇬" },
];

// ─── helpers ──────────────────────────────────────────────────────────────────

async function uploadToFal(body: Record<string, string>): Promise<string> {
  const res = await fetch("/api/fal-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Upload failed");
  return json.url as string;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Creating job…",
  queued:  "Queued — fal is processing…",
  done:    "Done",
  error:   "Failed",
};

const STATUS_COLOR: Record<string, string> = {
  pending: "text-slate-400",
  queued:  "text-yellow-300",
  done:    "text-emerald-300",
  error:   "text-red-400",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function JobTestPage() {
  const [photoUrl, setPhotoUrl]       = useState("");
  const [selectedTeam, setSelectedTeam] = useState(TEAMS[0]);
  const [selectedPose, setSelectedPose] = useState(POSES[0]);
  const [email, setEmail]             = useState("");
  const [busy, setBusy]               = useState(false);
  const [log, setLog]                 = useState<string[]>([]);
  const [job, setJob]                 = useState<JobDoc | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  const currentUser = useAuthStore((s) => s.currentUser);

  // Clean up Firestore listener on unmount
  useEffect(() => () => { unsubRef.current?.(); }, []);

  function addLog(msg: string) {
    setLog((prev) => [...prev, `${new Date().toLocaleTimeString()} — ${msg}`]);
  }

  function handlePhotoUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhotoUrl(String(reader.result));
    reader.readAsDataURL(file);
    setLog([]);
    setJob(null);
  }

  async function handleSubmit() {
    if (!photoUrl) return;
    if (!currentUser) {
      addLog("Still signing in — try again in a moment.");
      return;
    }
    setBusy(true);
    setLog([]);
    setJob(null);
    unsubRef.current?.();

    try {
      // 1. Upload face image to fal storage (server-side proxy keeps FAL_KEY secret)
      addLog("Uploading face image to fal storage…");
      const faceUrl = await uploadToFal({ base64: photoUrl, name: "face.jpg", mimeType: "image/jpeg" });
      addLog("Face uploaded.");

      // 2. Upload the player template from /public (can't be reached by fal during local dev)
      addLog(`Uploading player template (${selectedTeam.id}/${selectedPose.id})…`);
      const templateUrl = await uploadToFal({ publicPath: `players/${selectedTeam.id}/${selectedPose.id}.png` });
      addLog("Template uploaded.");

      // 3. Create Firestore job doc — Cloud Function picks this up and calls fal.queue.submit
      addLog("Creating job in Firestore…");
      const ref: DocumentReference = await addDoc(collection(db, "jobs"), {
        endpoint: "easel-ai/advanced-face-swap",
        input: {
          face_image_0:  faceUrl,
          target_image:  templateUrl,
          gender_0:      "male",
          workflow_type: "target_hair",
          upscale:       true,
        },
        jobType:   "image",
        userEmail: email || "test@example.com",
        ownerUid:  currentUser.uid,
        status:    "pending",
        createdAt: serverTimestamp(),
      });
      addLog(`Job created (ID: ${ref.id}). Waiting for Cloud Function…`);

      // 4. Listen for status updates on the job doc
      const unsub = onSnapshot(ref, (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as JobDoc;
        setJob(data);
        addLog(`Status → ${data.status}`);
        if (data.status === "done" || data.status === "error") {
          unsub();
        }
      });
      unsubRef.current = unsub;

    } catch (err) {
      addLog(`Error: ${err}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen px-4 py-6 text-white sm:px-6 lg:px-8">
      {/* Background */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-80 w-80 -translate-x-1/2 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="absolute bottom-12 right-0 h-72 w-72 rounded-full bg-slate-300/10 blur-3xl" />
      </div>

      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex items-center justify-between">
          <Link href="/" className="text-sm font-bold uppercase tracking-[0.25em] text-emerald-100">
            Soccer Fans World
          </Link>
          <span className="rounded-full border border-yellow-300/40 bg-yellow-300/10 px-3 py-1 text-xs font-bold text-yellow-200">
            Async queue test
          </span>
        </header>

        <div className="grid gap-8 lg:grid-cols-2 lg:items-start">

          {/* ── Left: inputs ── */}
          <div className="rounded-[2rem] border border-white/15 bg-slate-950/55 p-5 shadow-2xl backdrop-blur sm:p-7 space-y-5">
            <div>
              <p className="mb-1 text-xs font-black uppercase tracking-[0.32em] text-emerald-200">Async job queue test</p>
              <h1 className="text-3xl font-black tracking-tight">Face-swap via fal queue</h1>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Uploads images to fal, creates a Firestore job, and watches live status updates — no long-running API call.
              </p>
            </div>

            {/* Photo upload */}
            <label className="block rounded-3xl border border-dashed border-emerald-200/40 bg-emerald-300/10 p-5 text-center transition hover:bg-emerald-300/15 cursor-pointer">
              <input type="file" accept="image/*" onChange={handlePhotoUpload} className="sr-only" />
              <span className="block font-black">Upload face photo</span>
              <span className="mt-1 block text-sm text-slate-400">JPG or PNG</span>
              {photoUrl && (
                <img src={photoUrl} alt="preview" className="mx-auto mt-3 h-20 w-20 rounded-full object-cover ring-2 ring-emerald-300" />
              )}
            </label>

            {/* Team */}
            <div>
              <p className="mb-2 text-xs font-black uppercase tracking-[0.28em] text-emerald-200">Team</p>
              <div className="flex gap-2">
                {TEAMS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTeam(t)}
                    className={`flex flex-col items-center gap-1 rounded-2xl border-2 px-4 py-2 transition ${
                      selectedTeam.id === t.id
                        ? "border-emerald-300 bg-emerald-300/10"
                        : "border-white/15 hover:border-white/35"
                    }`}
                  >
                    <span className="text-2xl">{t.flag}</span>
                    <span className="text-[0.6rem] font-black uppercase">{t.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Pose */}
            <div>
              <p className="mb-2 text-xs font-black uppercase tracking-[0.28em] text-emerald-200">Pose</p>
              <div className="grid grid-cols-3 gap-2">
                {POSES.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPose(p)}
                    className={`relative overflow-hidden rounded-2xl border-2 transition ${
                      selectedPose.id === p.id
                        ? "border-emerald-300 shadow-[0_0_16px_rgba(52,211,153,0.4)]"
                        : "border-white/15 hover:border-white/35"
                    }`}
                  >
                    <img
                      src={`/players/${selectedTeam.id}/${selectedPose.id}.png`}
                      alt={p.label}
                      className="h-24 w-full object-contain object-bottom"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-slate-950/70 py-1 text-center text-[0.6rem] font-black uppercase text-white">
                      {p.label}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Email */}
            <label className="block">
              <span className="mb-1 block text-sm font-bold text-slate-300">Notification email (optional)</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-2xl border border-white/15 bg-slate-950/70 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-emerald-300"
              />
            </label>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={!photoUrl || busy || !currentUser}
              className="w-full rounded-full bg-gradient-to-r from-emerald-300 via-teal-200 to-slate-100 px-7 py-4 text-sm font-black uppercase tracking-[0.22em] text-slate-950 shadow-[0_0_34px_rgba(52,211,153,0.28)] transition enabled:hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {busy ? "Setting up job…" : "Submit async job"}
            </button>
          </div>

          {/* ── Right: live status + result ── */}
          <div className="flex flex-col gap-5">

            {/* Status card */}
            {(log.length > 0 || job) && (
              <div className="rounded-3xl border border-white/15 bg-slate-950/55 p-5 backdrop-blur space-y-3">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Live status</p>

                {job && (
                  <div className="flex items-center gap-3">
                    {(job.status === "pending" || job.status === "queued") && (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-300 border-t-transparent" />
                    )}
                    <span className={`text-lg font-black ${STATUS_COLOR[job.status] ?? "text-white"}`}>
                      {STATUS_LABEL[job.status] ?? job.status}
                    </span>
                  </div>
                )}

                {job?.falRequestId && (
                  <p className="font-mono text-xs text-slate-500 break-all">
                    fal request_id: {job.falRequestId}
                  </p>
                )}

                <div className="space-y-1">
                  {log.map((line, i) => (
                    <p key={i} className="font-mono text-xs text-slate-400">{line}</p>
                  ))}
                </div>

                {job?.error && (
                  <p className="rounded-xl bg-red-900/40 px-3 py-2 text-xs text-red-300">{job.error}</p>
                )}
              </div>
            )}

            {/* Result image */}
            {job?.outputUrl && (
              <div className="rounded-3xl border border-emerald-300/30 bg-slate-950/55 p-4 backdrop-blur">
                <p className="mb-3 text-xs font-black uppercase tracking-widest text-emerald-300">Result</p>
                <img
                  src={job.outputUrl}
                  alt="Generated result"
                  className="w-full rounded-2xl object-contain"
                />
                <a
                  href={job.outputUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 block rounded-full border border-emerald-300/30 bg-emerald-300/10 px-4 py-2 text-center text-xs font-black uppercase tracking-wider text-emerald-200 hover:bg-emerald-300/20 transition"
                >
                  Open full size
                </a>
              </div>
            )}

            {/* Idle placeholder */}
            {log.length === 0 && !job && (
              <div className="flex h-64 items-center justify-center rounded-3xl border border-dashed border-white/10 text-sm text-slate-500">
                Status and result will appear here after submission.
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
