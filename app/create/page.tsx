"use client";

import { toPng } from "html-to-image";
import Link from "next/link";
import { ChangeEvent, forwardRef, useMemo, useRef, useState } from "react";

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
      setCardData(null);
    };
    reader.readAsDataURL(file);
  }

  function handleGenerateCard() {
    setCardData(MOCK_AI_RESPONSE);
    window.setTimeout(() => {
      document.getElementById("result-card")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
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

              <div className="grid gap-4">
                <TextInput label="Name" value={name} placeholder="Maya" onChange={setName} />
                <TextInput label="Favorite team" value={favoriteTeam} placeholder="Seattle Sounders" onChange={setFavoriteTeam} />
                <TextInput label="City" value={city} placeholder="Seattle" onChange={setCity} />
              </div>

              <button
                type="button"
                onClick={handleGenerateCard}
                disabled={!photoUrl}
                className="w-full rounded-full bg-gradient-to-r from-emerald-300 via-teal-200 to-slate-100 px-7 py-4 text-sm font-black uppercase tracking-[0.22em] text-slate-950 shadow-[0_0_34px_rgba(52,211,153,0.28)] transition enabled:hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-45"
              >
                Generate Card
              </button>
            </div>
          </div>

          <section id="result-card" className="flex flex-col items-center gap-5">
            {cardData ? (
              <>
                <FanCard
                  ref={cardRef}
                  data={cardData}
                  photoUrl={photoUrl}
                  name={displayName}
                  favoriteTeam={displayTeam}
                  city={displayCity}
                  overallRating={overallRating}
                />
                <button
                  type="button"
                  onClick={handleDownload}
                  className="rounded-full border border-emerald-200/30 bg-white px-7 py-3 text-sm font-black uppercase tracking-[0.2em] text-slate-950 shadow-xl transition hover:scale-105"
                >
                  {isDownloading ? "Preparing PNG..." : "Download PNG"}
                </button>
              </>
            ) : (
              <div className="flex min-h-[520px] w-full items-center justify-center rounded-[2rem] border border-white/10 bg-white/5 p-8 text-center backdrop-blur">
                <div className="max-w-sm space-y-3">
                  <p className="text-2xl font-black">Your card preview will appear here.</p>
                  <p className="text-slate-300">Upload a photo and generate the mock AI card to unlock the PNG download workflow.</p>
                </div>
              </div>
            )}
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
  data: AiCardResponse;
  photoUrl: string;
  name: string;
  favoriteTeam: string;
  city: string;
  overallRating: number;
}>(function FanCard({
  data,
  photoUrl,
  name,
  favoriteTeam,
  city,
  overallRating,
}, ref) {
  return (
    <div
      ref={ref}
      className="relative aspect-[2.5/3.5] w-full max-w-[390px] overflow-hidden rounded-[2rem] border-[6px] border-slate-200 bg-slate-950 p-3 shadow-[0_30px_90px_rgba(0,0,0,0.5)]"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(52,211,153,0.6),transparent_32%),linear-gradient(160deg,#03101c_0%,#123d56_48%,#03251d_100%)]" />
      <div className="absolute inset-x-5 top-8 h-20 rounded-full bg-emerald-100/20 blur-2xl" />
      <div className="absolute bottom-24 left-0 h-24 w-full bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.09)_0_2px,transparent_2px_18px)] opacity-40" />
      <div className="absolute bottom-0 left-0 h-36 w-full bg-[linear-gradient(to_top,rgba(148,163,184,0.28),transparent)] [clip-path:polygon(0_55%,18%_40%,28%_55%,42%_28%,54%_48%,67%_24%,78%_54%,90%_38%,100%_56%,100%_100%,0_100%)]" />

      <div className="relative flex h-full flex-col rounded-[1.45rem] border border-white/35 bg-white/[0.07] p-4 shadow-inner">
        <div className="mb-2 flex items-start justify-between gap-3">
          <div>
            <p className="text-[0.62rem] font-black uppercase tracking-[0.34em] text-emerald-100">Fan rating</p>
            <h2 className="mt-1 text-2xl font-black uppercase leading-none tracking-tight text-white">{data.archetype}</h2>
          </div>
          <div className="rounded-2xl border border-emerald-100/40 bg-slate-950/70 px-3 py-2 text-center shadow-lg">
            <p className="text-4xl font-black leading-none text-emerald-200">{overallRating}</p>
            <p className="text-[0.58rem] font-black uppercase tracking-[0.22em] text-slate-300">OVR</p>
          </div>
        </div>

        <div className="relative mb-3 min-h-0 flex-1 overflow-hidden rounded-[1.15rem] border border-slate-100/30 bg-slate-950/50">
          {photoUrl ? (
            <img src={photoUrl} alt={`${name} fan card photo`} className="h-full w-full object-cover" />
          ) : null}
          <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(2,6,23,0.88),transparent_58%,rgba(5,150,105,0.18))]" />
          <div className="absolute bottom-3 left-3 right-3">
            <p className="text-3xl font-black uppercase leading-none tracking-tight drop-shadow-lg">{name}</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-[0.22em] text-emerald-100">{favoriteTeam} • {city}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {statLabels.map(([key, label]) => (
            <div key={key} className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-slate-300">{label}</span>
                <span className="text-sm font-black text-emerald-100">{data.stats[key]}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-700">
                <div className="h-full rounded-full bg-gradient-to-r from-emerald-300 to-slate-100" style={{ width: `${data.stats[key]}%` }} />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 rounded-2xl border border-emerald-100/25 bg-emerald-950/65 p-3">
          <div className="grid grid-cols-2 gap-3 text-[0.66rem] leading-4">
            <div>
              <p className="font-black uppercase tracking-[0.2em] text-emerald-200">Special Ability</p>
              <p className="mt-1 font-bold text-white">{data.specialAbility}</p>
            </div>
            <div>
              <p className="font-black uppercase tracking-[0.2em] text-slate-300">Weakness</p>
              <p className="mt-1 font-bold text-white">{data.weakness}</p>
            </div>
          </div>
          <p className="mt-2 border-t border-white/10 pt-2 text-center text-xs font-semibold italic text-slate-100">
            “{data.description}”
          </p>
        </div>
      </div>
    </div>
  );
});
