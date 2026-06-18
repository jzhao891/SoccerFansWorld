"use client";

import Link from "next/link";
import { ChangeEvent, useRef, useState } from "react";
import type { RenderTier } from "@sfw/shared";
import type { AiCardResponse } from "@/lib/card/types";

const POSES = [
  { id: "celebration", label: "Celebration" },
  { id: "volley",      label: "Volley" },
  { id: "dribble",     label: "Dribble" },
];

// 2026 World Cup teams. To add a team, drop three pose images into
// /public/players/{id}/{celebration,volley,dribble}.png and add a row here.
const TEAMS = [
  { id: "nigeria", name: "Nigeria", flag: "🇳🇬", accent: "#16a34a" },
];

const teamPoseImg = (teamId: string, poseId: string) => `/players/${teamId}/${poseId}.png`;

const MOCK_AI_RESPONSE: AiCardResponse = {
  archetype: "Style Captain",
  stats: {
    passion: 89,
    energy: 82,
    style: 99,
    loyalty: 91,
    stamina: 72,
    crowdImpact: 87,
  },
  specialAbility: "Rainproof Glamour",
  weakness: "Will stop for every photo opportunity.",
  description: "Turns matchday into a runway without missing kickoff.",
};

export default function FanCardPage() {
  const [photoUrl, setPhotoUrl] = useState<string>("");
  const [cardImageUrl, setCardImageUrl] = useState<string>(""); // server-rendered card (free preview)
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(TEAMS[0]);
  const [selectedPose, setSelectedPose] = useState(POSES[0]);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [cardData, setCardData] = useState<AiCardResponse | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  // Hold the data we rendered with so HD re-render matches the preview exactly.
  const lastRender = useRef<{ playerImage: string; card: AiCardResponse } | null>(null);

  const displayName = name.trim() || "Emerald Regular";
  const displayTeam = selectedTeam.name;
  const displayCity = city.trim() || "Seattle";

  function resetResult() {
    setCardImageUrl("");
    setCardData(null);
    lastRender.current = null;
  }

  function handlePhotoUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoUrl(String(reader.result));
      resetResult();
    };
    reader.readAsDataURL(file);
  }

  async function renderCard(playerImage: string, card: AiCardResponse, tier: RenderTier): Promise<string> {
    const values = Object.values(card.stats);
    const overall = Math.round(values.reduce((t, v) => t + v, 0) / values.length);
    const res = await fetch("/api/card/render", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        playerImage,
        name: displayName,
        team: displayTeam,
        city: displayCity,
        overall,
        card,
        tier,
      }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Card render failed");
    return json.imageUrl as string;
  }

  async function handleGenerateCard() {
    if (!photoUrl) return;
    setIsProcessing(true);
    resetResult();
    try {
      // 1. Face-swap the photo onto the selected team/pose template.
      const swapRes = await fetch("/api/face-swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ faceImageData: photoUrl, teamId: selectedTeam.id, poseId: selectedPose.id }),
      });
      const swapJson = await swapRes.json();
      if (!swapRes.ok) throw new Error(swapJson.error ?? "Face swap failed");
      const playerImage = swapJson.imageUrl as string;

      // 2. Composite the full card server-side (free tier: watermarked, low-res).
      const card = MOCK_AI_RESPONSE;
      const preview = await renderCard(playerImage, card, "free");
      setCardData(card);
      setCardImageUrl(preview);
      lastRender.current = { playerImage, card };
    } catch (err) {
      alert(`Generation failed: ${err}`);
    } finally {
      setIsProcessing(false);
      window.setTimeout(() => {
        document.getElementById("result-card")?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 80);
    }
  }

  // Free download = the watermarked low-res preview already rendered.
  // HD download = premium only — re-render clean at full resolution.
  async function handleDownload(hd: boolean) {
    if (hd && !isPremium) {
      alert("HD download without watermark is a Premium feature. Unlock to remove the watermark and export full resolution.");
      return;
    }
    setIsDownloading(true);
    try {
      let url = cardImageUrl;
      if (hd) {
        if (!lastRender.current) throw new Error("Generate a card first");
        url = await renderCard(lastRender.current.playerImage, lastRender.current.card, "hd");
      }
      const link = document.createElement("a");
      link.download = `${displayName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-fan-card-${hd ? "hd" : "preview"}.png`;
      link.href = url;
      link.click();
    } catch (err) {
      alert(`Download failed: ${err}`);
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <main className="min-h-screen overflow-hidden px-4 py-6 text-white sm:px-6 lg:px-8">
      <Link
        href="/"
        className="fixed bottom-6 left-6 z-10 flex items-center gap-2 px-4 py-3 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-white text-sm font-medium shadow-lg hover:bg-white/30 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
        </svg>
        Watch Party Map
      </Link>
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-80 w-80 -translate-x-1/2 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="absolute bottom-12 right-0 h-72 w-72 rounded-full bg-slate-300/10 blur-3xl" />
        <div className="absolute bottom-0 h-40 w-full bg-[linear-gradient(to_top,rgba(2,6,23,0.95),transparent)]" />
      </div>

      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex items-center justify-between gap-4">
          <Link href="/" className="text-sm font-bold uppercase tracking-[0.25em] text-emerald-100">
            Soccer Fans World
          </Link>
          <span className="rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-slate-300">
            Demo mode • Mock AI
          </span>
        </header>

        <section className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div className="rounded-[2rem] border border-white/15 bg-slate-950/55 p-5 shadow-2xl backdrop-blur sm:p-7">
            <div className="mb-6">
              <p className="mb-3 text-xs font-black uppercase tracking-[0.32em] text-emerald-200">Create your card</p>
              <h1 className="text-4xl font-black tracking-tight sm:text-5xl">Upload your matchday look.</h1>
              <p className="mt-3 leading-7 text-slate-300">
                Add a real photo, share a few optional details, then generate a Seattle-inspired premium fan card.
              </p>
            </div>

            <div className="space-y-5">
              <label className="block rounded-3xl border border-dashed border-emerald-200/40 bg-emerald-300/10 p-5 text-center transition hover:bg-emerald-300/15">
                <input type="file" accept="image/*" onChange={handlePhotoUpload} className="sr-only" />
                <span className="block text-lg font-black">Upload photo</span>
                <span className="mt-1 block text-sm text-slate-300">JPG, PNG, or HEIC-style image files</span>
                {photoUrl ? (
                  <span className="mt-4 inline-flex rounded-full bg-emerald-300 px-4 py-2 text-sm font-black text-slate-950">
                    Photo ready
                  </span>
                ) : null}
              </label>

              {/* Team selection */}
              <div>
                <p className="mb-2 text-xs font-black uppercase tracking-[0.28em] text-emerald-200">Choose Team</p>
                <div className="grid grid-cols-4 gap-2">
                  {TEAMS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => { setSelectedTeam(t); resetResult(); }}
                      className={`flex flex-col items-center gap-1 rounded-2xl border-2 px-1 py-2 transition ${
                        selectedTeam.id === t.id
                          ? "border-emerald-300 bg-emerald-300/10 shadow-[0_0_16px_rgba(52,211,153,0.4)]"
                          : "border-white/15 hover:border-white/35"
                      }`}
                    >
                      <span className="text-2xl leading-none">{t.flag}</span>
                      <span className="text-[0.55rem] font-black uppercase tracking-wide text-white">{t.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Pose selection */}
              <div>
                <p className="mb-2 text-xs font-black uppercase tracking-[0.28em] text-emerald-200">Choose Pose</p>
                <div className="grid grid-cols-3 gap-2">
                  {POSES.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => { setSelectedPose(p); resetResult(); }}
                      className={`relative overflow-hidden rounded-2xl border-2 transition ${
                        selectedPose.id === p.id
                          ? "border-emerald-300 shadow-[0_0_16px_rgba(52,211,153,0.4)]"
                          : "border-white/15 hover:border-white/35"
                      }`}
                    >
                      <img
                        src={teamPoseImg(selectedTeam.id, p.id)}
                        alt={p.label}
                        className="h-24 w-full object-contain object-bottom"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-slate-950/70 py-1 text-center text-[0.6rem] font-black uppercase tracking-wide text-white">
                        {p.label}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4">
                <TextInput label="Name" value={name} placeholder="Maya" onChange={setName} />
                <TextInput label="City" value={city} placeholder="Seattle" onChange={setCity} />
              </div>

              <button
                type="button"
                onClick={handleGenerateCard}
                disabled={!photoUrl || isProcessing}
                className="w-full rounded-full bg-gradient-to-r from-emerald-300 via-teal-200 to-slate-100 px-7 py-4 text-sm font-black uppercase tracking-[0.22em] text-slate-950 shadow-[0_0_34px_rgba(52,211,153,0.28)] transition enabled:hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-45"
              >
                {isProcessing ? "Generating…" : "Generate Card"}
              </button>
            </div>
          </div>

          <section id="result-card" className="flex flex-col items-center gap-5">
            <div className="relative aspect-[2.5/3.5] w-full max-w-[390px] overflow-hidden rounded-[1.5rem] border-4 border-white/20 bg-slate-950 shadow-[0_30px_90px_rgba(0,0,0,0.8)]">
              {cardImageUrl ? (
                <img src={cardImageUrl} alt={`${displayName} fan card`} className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-slate-400">
                  {isProcessing ? "Building your card…" : "Your fan card will appear here."}
                </div>
              )}
              {isProcessing && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/40 text-slate-200">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-300 border-t-transparent" />
                  <p className="text-xs font-bold uppercase tracking-widest">Generating…</p>
                </div>
              )}
            </div>

            {cardImageUrl && cardData ? (
              <div className="flex flex-col items-center gap-3">
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleDownload(false)}
                    disabled={isDownloading}
                    className="rounded-full border border-white/20 bg-white/10 px-6 py-3 text-sm font-black uppercase tracking-[0.2em] text-white backdrop-blur transition hover:bg-white/15 disabled:opacity-50"
                  >
                    {isDownloading ? "Preparing…" : "Download (Free)"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownload(true)}
                    disabled={isDownloading}
                    className="flex items-center gap-2 rounded-full border border-emerald-200/30 bg-gradient-to-r from-emerald-300 to-teal-200 px-6 py-3 text-sm font-black uppercase tracking-[0.2em] text-slate-950 shadow-xl transition hover:scale-105 disabled:opacity-50"
                  >
                    {!isPremium && <span aria-hidden>🔒</span>}
                    Download HD
                  </button>
                </div>
                <p className="text-center text-xs text-slate-400">
                  {isPremium
                    ? "Premium unlocked — HD export, no watermark."
                    : "Free version is watermarked and low-resolution."}
                  {" "}
                  <button
                    type="button"
                    onClick={() => setIsPremium((v) => !v)}
                    className="font-bold text-emerald-300 underline underline-offset-2"
                  >
                    {isPremium ? "Lock again (demo)" : "Unlock Premium (demo)"}
                  </button>
                </p>
              </div>
            ) : null}
          </section>
        </section>
      </div>
    </main>
  );
}

function TextInput({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-200">{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-white/15 bg-slate-950/70 px-4 py-3 text-white outline-none ring-emerald-300/30 transition placeholder:text-slate-500 focus:border-emerald-200 focus:ring-4"
      />
    </label>
  );
}
