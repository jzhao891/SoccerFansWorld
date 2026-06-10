"use client";

import { toPng } from "html-to-image";
import Link from "next/link";
import { ChangeEvent, forwardRef, useMemo, useRef, useState } from "react";

const PLAYER_TEMPLATES = [
  { id: "striker",    label: "Celebration", number: "10", img: "/players/striker.png" },
  { id: "midfielder", label: "Volley",      number: "10", img: "/players/midfielder.png" },
  { id: "defender",   label: "Dribble",     number: "10", img: "/players/defender.png" },
];

type FanStats = {
  passion: number;
  energy: number;
  style: number;
  loyalty: number;
  stamina: number;
  crowdImpact: number;
};

type AiCardResponse = {
  archetype: string;
  stats: FanStats;
  specialAbility: string;
  weakness: string;
  description: string;
};

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

const statLabels: Array<[keyof FanStats, string]> = [
  ["passion", "Passion"],
  ["energy", "Energy"],
  ["style", "Style"],
  ["loyalty", "Loyalty"],
  ["stamina", "Stamina"],
  ["crowdImpact", "Crowd Impact"],
];

export default function CreatePage() {
  const [photoUrl, setPhotoUrl] = useState<string>("");
  const [compositeUrl, setCompositeUrl] = useState<string>("");
  const [isFaceProcessing, setIsFaceProcessing] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState(PLAYER_TEMPLATES[0]);
  const [name, setName] = useState("");
  const [favoriteTeam, setFavoriteTeam] = useState("");
  const [city, setCity] = useState("");
  const [cardData, setCardData] = useState<AiCardResponse | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const displayName = name.trim() || "Emerald Regular";
  const displayTeam = favoriteTeam.trim() || "Seattle FC";
  const displayCity = city.trim() || "Seattle";

  const overallRating = useMemo(() => {
    if (!cardData) return 0;
    const values = Object.values(cardData.stats);
    return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
  }, [cardData]);

  function handlePhotoUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoUrl(String(reader.result));
      setCompositeUrl("");
      setCardData(null);
    };
    reader.readAsDataURL(file);
  }

  async function handleGenerateCard() {
    if (!photoUrl) return;
    setIsFaceProcessing(true);
    setCompositeUrl("");
    setCardData(null);
    try {
      const res = await fetch("/api/face-swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          faceImageData: photoUrl,
          playerId: selectedPlayer.id,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Face swap failed");
      setCompositeUrl(json.imageUrl);
      setCardData(MOCK_AI_RESPONSE);
    } catch (err) {
      alert(`Face swap failed: ${err}`);
    } finally {
      setIsFaceProcessing(false);
      window.setTimeout(() => {
        document.getElementById("result-card")?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 80);
    }
  }

  async function handleDownload() {
    if (!cardRef.current) return;

    setIsDownloading(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 3,
        backgroundColor: "#061521",
      });
      const link = document.createElement("a");
      link.download = `${displayName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-fan-card.png`;
      link.href = dataUrl;
      link.click();
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <main className="min-h-screen overflow-hidden px-4 py-6 text-white sm:px-6 lg:px-8">
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

              {/* Player template selection */}
              <div>
                <p className="mb-2 text-xs font-black uppercase tracking-[0.28em] text-emerald-200">Choose Player</p>
                <div className="grid grid-cols-3 gap-2">
                  {PLAYER_TEMPLATES.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => { setSelectedPlayer(p); setCompositeUrl(""); setCardData(null); }}
                      className={`relative overflow-hidden rounded-2xl border-2 transition ${
                        selectedPlayer.id === p.id
                          ? "border-emerald-300 shadow-[0_0_16px_rgba(52,211,153,0.4)]"
                          : "border-white/15 hover:border-white/35"
                      }`}
                    >
                      <img src={p.img} alt={p.label} className="h-24 w-full object-cover object-top" />
                      <div className="absolute inset-x-0 bottom-0 bg-slate-950/70 py-1 text-center text-[0.6rem] font-black uppercase tracking-wide text-white">
                        {p.label} #{p.number}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4">
                <TextInput label="Name" value={name} placeholder="Maya" onChange={setName} />
                <TextInput label="Favorite team" value={favoriteTeam} placeholder="Seattle Sounders" onChange={setFavoriteTeam} />
                <TextInput label="City" value={city} placeholder="Seattle" onChange={setCity} />
              </div>

              <button
                type="button"
                onClick={handleGenerateCard}
                disabled={!photoUrl || isFaceProcessing}
                className="w-full rounded-full bg-gradient-to-r from-emerald-300 via-teal-200 to-slate-100 px-7 py-4 text-sm font-black uppercase tracking-[0.22em] text-slate-950 shadow-[0_0_34px_rgba(52,211,153,0.28)] transition enabled:hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-45"
              >
                {isFaceProcessing ? "Swapping face…" : "Generate Card"}
              </button>
            </div>
          </div>

          <section id="result-card" className="flex flex-col items-center gap-5">
            <FanCard
              ref={cardRef}
              data={cardData}
              compositeUrl={compositeUrl}
              playerTemplateImg={selectedPlayer.img}
              isFaceProcessing={isFaceProcessing}
              name={displayName}
              favoriteTeam={displayTeam}
              city={displayCity}
              overallRating={overallRating}
            />
            {cardData ? (
              <button
                type="button"
                onClick={handleDownload}
                className="rounded-full border border-emerald-200/30 bg-white px-7 py-3 text-sm font-black uppercase tracking-[0.2em] text-slate-950 shadow-xl transition hover:scale-105"
              >
                {isDownloading ? "Preparing PNG..." : "Download PNG"}
              </button>
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

const FanCard = forwardRef<HTMLDivElement, {
  data: AiCardResponse | null;
  compositeUrl: string;
  playerTemplateImg: string;
  isFaceProcessing: boolean;
  name: string;
  favoriteTeam: string;
  city: string;
  overallRating: number;
}>(function FanCard({
  data,
  compositeUrl,
  playerTemplateImg,
  isFaceProcessing,
  name,
  favoriteTeam,
  city,
  overallRating,
}, ref) {
  return (
    <div
      ref={ref}
      className="relative aspect-[2.5/3.5] w-full max-w-[390px] overflow-hidden rounded-[1.5rem] border-4 border-white/20 bg-slate-950 shadow-[0_30px_90px_rgba(0,0,0,0.8)]"
    >
      {/* Layer 1: Stadium background */}
      <img
        src="/stadium-bg.jpg"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover"
      />

      {/* Layer 2: Subtle gradient darkening at top and bottom for text legibility */}
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.55)_0%,transparent_35%,transparent_55%,rgba(0,0,0,0.72)_100%)]" />

      {/* Layer 3: Player image — template shown by default, swapped result after generation */}
      <img
        src={compositeUrl || playerTemplateImg}
        alt=""
        aria-hidden="true"
        className="absolute inset-x-0 bottom-[18%] h-[72%] w-full object-contain object-bottom"
        style={{ mixBlendMode: "multiply" }}
      />
      {isFaceProcessing && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/30 text-slate-200">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-300 border-t-transparent" />
          <p className="text-xs font-bold uppercase tracking-widest">Swapping face…</p>
        </div>
      )}

      {/* Layer 4: Top banner — "FAN XI" + OVR */}
      <div className="absolute inset-x-0 top-0 flex items-start justify-between px-4 pt-3">
        <div>
          <p className="text-[0.55rem] font-black uppercase tracking-[0.35em] text-emerald-300 drop-shadow">Fan XI</p>
          <p className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-white/80 drop-shadow">
            {data ? data.archetype : "Soccer Stars"}
          </p>
        </div>
        {/* OVR badge */}
        <div className="rounded-xl bg-black/50 px-2.5 py-1.5 text-center backdrop-blur-sm border border-white/10">
          <p className="text-2xl font-black leading-none text-emerald-300 drop-shadow">
            {data ? overallRating : "—"}
          </p>
          <p className="text-[0.5rem] font-black uppercase tracking-widest text-slate-300">OVR</p>
        </div>
      </div>

      {/* Layer 5: Bottom — name + 6 stats bar */}
      <div className="absolute inset-x-0 bottom-0 px-3 pb-3">
        {/* Name */}
        <div className="mb-2 text-center">
          <p className="text-[0.55rem] font-black uppercase tracking-[0.3em] text-emerald-300 drop-shadow">
            {favoriteTeam} • {city}
          </p>
          <p className="text-2xl font-black uppercase leading-tight tracking-wide text-white drop-shadow-lg">
            {name}
          </p>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-6 gap-1">
          {statLabels.map(([key, label]) => (
            <div
              key={key}
              className="rounded-lg bg-black/55 py-1.5 text-center backdrop-blur-sm border border-white/10"
            >
              <p className="text-sm font-black leading-none text-white">
                {data ? data.stats[key] : "—"}
              </p>
              <p className="mt-0.5 text-[0.45rem] font-bold uppercase tracking-wide text-slate-300">
                {label.slice(0, 3)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});
