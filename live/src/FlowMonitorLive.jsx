/**
 * FlowMonitor · NOC Real-Time (dados reais)
 * Lê /api/snapshot da ponte flowmonitor.py (Home Assistant + Huawei Mesh Router).
 * Stack: React 18 · Tailwind CSS 3 · Recharts 2 · lucide-react
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell,
} from "recharts";
import {
  Activity, Globe, WifiOff, Pause, Play, Router, Clock, Smartphone, Laptop, Tv, HelpCircle,
  X, CircleCheck, CircleAlert, ArrowDown, ArrowUp, Network, TriangleAlert, Timer, Terminal,
  Eye, EyeOff, Wifi, Cable, UserRound, Plug, LogOut, LogIn, Database, CloudOff, Settings,
} from "lucide-react";

/* ─────────────────────────────── Tema ─────────────────────────────── */

const C = {
  panel: "#0c1424", grid: "#16223a", axis: "#26364f", muted: "#6a7c95",
  in: "#2b8cf0", out: "#d9702f", electric: "#38a3ff",
};

const GLOBAL_CSS = `
/* Layout: cabeçalho fixo + grade de 12 colunas (status/tráfego, roteador+log/dispositivos) */
:root{
  --bg:6 11 22; --panel:12 20 36; --inset:16 26 46; --line:27 40 64; --line-2:38 54 79;
  --ink:226 234 245; --ink-2:154 171 194; --muted:106 124 149;
  --electric:56 163 255; --neon:44 245 155; --warn:255 197 61; --crit:255 77 94;
  color-scheme:dark;
}
body{background:rgb(var(--bg));color:rgb(var(--ink));font-family:"IBM Plex Sans",ui-sans-serif,system-ui,sans-serif}
.fm-app{min-height:100%;background:
  radial-gradient(1200px 600px at 15% -10%, rgb(var(--electric) / .07), transparent 60%),
  radial-gradient(900px 500px at 100% 0%, rgb(var(--neon) / .035), transparent 60%),
  linear-gradient(rgb(var(--line) / .22) 1px, transparent 1px) 0 0 / 100% 40px,
  linear-gradient(90deg, rgb(var(--line) / .22) 1px, transparent 1px) 0 0 / 40px 100%,
  rgb(var(--bg));}
.fm-gutter{padding-left:max(16px, env(safe-area-inset-left, 0px));padding-right:max(16px, env(safe-area-inset-right, 0px))}
@media (min-width:768px){.fm-gutter{padding-left:max(24px, env(safe-area-inset-left, 0px));padding-right:max(24px, env(safe-area-inset-right, 0px))}}
.fm-header{top:env(safe-area-inset-top, 0px)}
.fm-card{position:relative;background:linear-gradient(180deg, rgb(var(--panel)), rgb(var(--panel) / .94));
  border:1px solid rgb(var(--line));border-radius:12px;
  box-shadow:inset 0 1px 0 rgb(255 255 255 / .035), 0 0 28px -14px rgb(var(--electric) / .28), 0 18px 40px -28px rgb(0 0 0 / .9);}
.fm-label{font-family:"Chakra Petch",ui-sans-serif,system-ui,sans-serif;text-transform:uppercase;letter-spacing:.09em}
.fm-mono{font-family:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,monospace}
.fm-tooltip{background:rgb(var(--inset) / .97);border:1px solid rgb(var(--line-2));border-radius:8px;padding:8px 10px;
  box-shadow:0 10px 30px -10px rgb(0 0 0 / .8);min-width:170px;font-size:12px}
.fm-orb{position:relative;width:84px;height:84px;border-radius:9999px;display:grid;place-items:center;flex:none;
  color:rgb(var(--state));background:radial-gradient(circle, rgb(var(--state) / .22), rgb(var(--state) / .04) 68%);
  border:1px solid rgb(var(--state) / .55);box-shadow:0 0 34px rgb(var(--state) / .35), inset 0 0 26px rgb(var(--state) / .22);}
@media (min-width:1536px){.fm-orb{width:104px;height:104px}}
.fm-orb svg{width:38%;height:38%}
.fm-orb::before,.fm-orb::after{content:"";position:absolute;inset:-1px;border-radius:inherit;border:1px solid rgb(var(--state) / .6);
  animation:fm-ring 2.4s cubic-bezier(.2,.6,.3,1) infinite}
.fm-orb::after{animation-delay:1.2s}
.fm-orb.is-down::before,.fm-orb.is-down::after{animation-duration:1.1s}
.fm-orb.is-still::before,.fm-orb.is-still::after{animation:none;opacity:0}
@keyframes fm-ring{0%{transform:scale(1);opacity:.65}100%{transform:scale(1.65);opacity:0}}
.fm-glow-text{text-shadow:0 0 22px rgb(var(--state) / .55), 0 0 2px rgb(var(--state) / .8)}
.fm-live{position:relative;width:8px;height:8px;border-radius:9999px;background:rgb(var(--state));box-shadow:0 0 10px rgb(var(--state) / .9)}
.fm-live.is-on::after{content:"";position:absolute;inset:0;border-radius:inherit;background:rgb(var(--state));animation:fm-ping 1.6s ease-out infinite}
@keyframes fm-ping{0%{transform:scale(1);opacity:.7}100%{transform:scale(2.6);opacity:0}}
.fm-blink{animation:fm-blink 1s steps(2, jump-none) infinite}
@keyframes fm-blink{50%{opacity:.25}}
.fm-row td{border-top:1px solid rgb(var(--line) / .8)}
.fm-row-in{animation:fm-row-in 2.6s ease-out}
@keyframes fm-row-in{0%{background:rgb(var(--electric) / .22)}100%{background:transparent}}
.fm-row-left{background:rgb(var(--crit) / .05)}
.fm-row-left td > *{opacity:.55}
.fm-bar{transition:width .8s ease-out, background-color .3s}
.fm-bump{animation:fm-bump .5s ease-out}
@keyframes fm-bump{0%{transform:translateY(-3px);color:rgb(var(--electric))}100%{transform:none}}
.fm-toasts{position:fixed;z-index:60;right:max(16px, env(safe-area-inset-right, 0px));left:max(16px, env(safe-area-inset-left, 0px));
  bottom:calc(16px + env(safe-area-inset-bottom, 0px));display:flex;flex-direction:column;align-items:flex-end;gap:10px;pointer-events:none}
.fm-toast{pointer-events:auto;width:min(380px, 100%);animation:fm-toast-in .35s cubic-bezier(.2,.8,.2,1)}
@keyframes fm-toast-in{from{transform:translateY(12px) scale(.98);opacity:0}to{transform:none;opacity:1}}
.fm-toast-timer{animation:fm-shrink linear forwards;transform-origin:left}
@keyframes fm-shrink{from{transform:scaleX(1)}to{transform:scaleX(0)}}
.fm-scroll{scrollbar-width:thin;scrollbar-color:rgb(var(--line-2)) transparent}
.fm-btn:focus-visible{outline:2px solid rgb(var(--electric));outline-offset:2px}
.fm-skel{background:linear-gradient(90deg, rgb(var(--inset)), rgb(var(--line)), rgb(var(--inset)));background-size:200% 100%;animation:fm-skel 1.4s linear infinite}
@keyframes fm-skel{to{background-position:-200% 0}}
@media (prefers-reduced-motion: reduce){
  .fm-orb::before,.fm-orb::after,.fm-live.is-on::after,.fm-blink,.fm-row-in,.fm-bump,.fm-toast,.fm-skel{animation:none!important}
  .fm-bar{transition:none}
}
`;

/* ─────────────────────────── Utilitários ─────────────────────────── */

const TZ = "America/Sao_Paulo";
const POLL_MS = 1500;
const cx = (...c) => c.filter(Boolean).join(" ");
const pad = (n) => String(n).padStart(2, "0");
const nf = (v, d = 0) => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
const isNum = (v) => typeof v === "number" && Number.isFinite(v);

const fmtRate = (mbps) => {
  if (!isNum(mbps)) return "—";
  if (mbps >= 1000) return `${nf(mbps / 1000, 2)} Gbps`;
  if (mbps >= 100) return `${nf(mbps, 0)} Mbps`;
  if (mbps >= 1) return `${nf(mbps, 1)} Mbps`;
  return `${nf(mbps * 1000, 0)} kbps`;
};
const fmtKB = (kBps) => fmtRate((kBps * 8) / 1000);
const fmtTick = (v) => (v === 0 ? "0" : v >= 1000 ? `${nf(v / 1000, v % 1000 ? 1 : 0)}G` : `${nf(v, v < 10 && v % 1 ? 1 : 0)}M`);
const fmtDur = (sec) => {
  if (!isNum(sec) || sec < 0) return "—";
  sec = Math.floor(sec);
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return d ? `${d}d ${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(h)}:${pad(m)}:${pad(s)}`;
};
const fmtAgo = (ms) => {
  if (!isNum(ms) || ms < 0) return "—";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ${pad(m % 60)} min`;
  return `${Math.floor(h / 24)} d ${h % 24} h`;
};
const fmtClock = (t, withSeconds = true) => {
  try {
    return new Date(t).toLocaleTimeString("pt-BR", {
      hour: "2-digit", minute: "2-digit", ...(withSeconds ? { second: "2-digit" } : {}), hour12: false, timeZone: TZ,
    });
  } catch {
    const d = new Date(t);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}${withSeconds ? ":" + pad(d.getSeconds()) : ""}`;
  }
};
// Escala com passos redondos (1, 2, 5 × 10ⁿ): 0/20/40/60 em vez de 13/25/38/50.
const niceScale = (v) => {
  if (!isNum(v) || v <= 0) return { max: 1, ticks: [0, 0.5, 1] };
  const raw = (v * 1.1) / 4;
  const exp = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 5, 10].map((m) => m * exp).find((s) => s >= raw);
  const max = Math.ceil((v * 1.1) / step) * step;
  const ticks = [];
  for (let t = 0; t <= max + step / 1000; t += step) ticks.push(Number(t.toFixed(6)));
  return { max, ticks };
};
const maskIp = (ip) => (ip ? ip.replace(/^(\d+)\.\d+\.\d+\.(\d+)$/, "$1.•••.•••.$2") : "—");

const TYPES = {
  mobile: { label: "Celulares", color: "#2b8cf0", Icon: Smartphone },
  computer: { label: "Computadores", color: "#d9702f", Icon: Laptop },
  iot: { label: "TV e IoT", color: "#16a592", Icon: Tv },
  other: { label: "Outros", color: "#9479ea", Icon: HelpCircle },
};
const TYPE_ORDER = ["mobile", "computer", "iot", "other"];

const signalBars = (rssi) => {
  if (!isNum(rssi)) return null;
  if (rssi < 0) return rssi >= -55 ? 4 : rssi >= -65 ? 3 : rssi >= -75 ? 2 : 1;
  return rssi >= 75 ? 4 : rssi >= 50 ? 3 : rssi >= 25 ? 2 : 1;
};

/* ─────────────────────────── Coleta ─────────────────────────── */

function useSnapshot(paused, apiBase) {
  const [snap, setSnap] = useState(null);
  const [offline, setOffline] = useState(null);
  const busy = useRef(false);
  const load = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
      const timer = ctrl ? setTimeout(() => ctrl.abort(), 5000) : null;
      const res = await fetch(`${apiBase || ""}/api/snapshot`, { cache: "no-store", signal: ctrl ? ctrl.signal : undefined });
      if (timer) clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSnap(await res.json());
      setOffline(null);
    } catch (e) {
      setOffline(e && e.name === "AbortError" ? "sem resposta em 5 s" : String((e && e.message) || e));
    } finally {
      busy.current = false;
    }
  }, [apiBase]);
  useEffect(() => {
    if (paused) return undefined;
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [paused, load]);
  return { snap, offline };
}

function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

/* ───────────────────────── Componentes base ───────────────────────── */

function CardHeader({ icon: Icon, title, subtitle, right, id }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid h-8 w-8 flex-none place-items-center rounded-md border border-line-2 bg-inset text-electric">
          <Icon size={16} strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <h2 id={id} className="fm-label text-[13px] font-semibold text-ink">{title}</h2>
          {subtitle && <p className="fm-mono truncate text-[11px] text-muted">{subtitle}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

function StatePill({ tone = "neon", icon: Icon, children, blink }) {
  const tones = {
    neon: "border-neon/30 bg-neon/10 text-neon",
    warn: "border-warn/30 bg-warn/10 text-warn",
    crit: "border-crit/35 bg-crit/10 text-crit",
    electric: "border-electric/30 bg-electric/10 text-electric",
    muted: "border-line-2 bg-inset text-ink-2",
  };
  return (
    <span className={cx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium", tones[tone], blink && "fm-blink")}>
      {Icon && <Icon size={12} strokeWidth={2.4} />}
      {children}
    </span>
  );
}

function Empty({ children }) {
  return <div className="grid min-h-[120px] place-items-center rounded-lg border border-dashed border-line-2 px-4 text-center text-[12px] text-muted">{children}</div>;
}

/* ───────────────────────────── Cabeçalho ───────────────────────────── */

function Header({ paused, onToggle, health, routerLabel, onSettings }) {
  const now = useNow();
  const state = paused ? "var(--warn)" : health === "ok" ? "var(--neon)" : health === "warn" ? "var(--warn)" : "var(--crit)";
  return (
    <header className="fm-header sticky z-40 border-b border-line bg-bg/80 backdrop-blur-md">
      <div className="fm-gutter mx-auto flex max-w-[1600px] items-center justify-between gap-3 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 flex-none place-items-center rounded-lg border border-electric/40 bg-electric/10 text-electric shadow-[0_0_22px_-4px_rgb(var(--electric)/.6)]">
            <Activity size={22} strokeWidth={2.2} />
          </span>
          <div className="min-w-0 leading-tight">
            <div className="font-display text-[20px] font-bold tracking-tight text-ink sm:text-[22px]">Flow<span className="text-electric">Monitor</span></div>
            <div className="flex items-center gap-2">
              <span className={cx("fm-live", !paused && health === "ok" && "is-on")} style={{ "--state": state }} />
              <span className="fm-label whitespace-nowrap text-[11px] text-ink-2">Ao vivo · {paused ? "pausado" : "NOC Real-Time"}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-none items-center gap-2.5">
          <div className="hidden items-center gap-2 rounded-md border border-line bg-inset/70 px-3 py-1.5 lg:flex">
            <Router size={14} className="text-muted" />
            <span className="fm-mono text-[12px] text-ink-2">{routerLabel}</span>
            <span className="fm-mono text-[11px] text-muted">via Home Assistant</span>
          </div>
          <div className="hidden items-center gap-2 rounded-md border border-line bg-inset/70 px-3 py-1.5 sm:flex">
            <Clock size={14} className="text-muted" />
            <span className="fm-mono text-[13px] tabular-nums text-ink">{fmtClock(now)}</span>
            <span className="fm-mono text-[10px] text-muted">BRT</span>
          </div>
          <button type="button" onClick={onToggle} aria-pressed={paused} aria-label={paused ? "Retomar atualização" : "Pausar atualização"}
            className={cx("fm-btn inline-flex h-10 min-w-10 items-center justify-center gap-2 rounded-md border px-2.5 text-[13px] font-semibold transition sm:px-3.5",
              paused ? "border-neon/50 bg-neon/10 text-neon hover:bg-neon/20" : "border-electric/50 bg-electric/10 text-electric hover:bg-electric/20")}>
            {paused ? <Play size={16} /> : <Pause size={16} />}
            <span className="hidden sm:inline">{paused ? "Retomar atualização" : "Pausar atualização"}</span>
          </button>
          {onSettings && (
            <button type="button" onClick={onSettings} aria-label="Conexão e modo do app"
              className="fm-btn grid h-10 w-10 place-items-center rounded-md border border-line-2 bg-inset/70 text-ink-2 transition hover:border-electric/60 hover:text-electric">
              <Settings size={17} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

function Banner({ offline, snap, apiBase }) {
  let msg = null;
  if (offline && apiBase) msg = { tone: "crit", Icon: CloudOff, title: `Sem resposta de ${apiBase.replace(/^https?:\/\//, "")}`, body: "Confira se o celular está no Wi-Fi de casa (ou no Tailscale) e se o FlowMonitor está aberto no PC com acesso pela rede liberado. O painel volta sozinho." };
  else if (offline) msg = { tone: "crit", Icon: CloudOff, title: "Coletor sem resposta", body: "O flowmonitor.py parou ou foi fechado. Rode de novo no terminal; o painel volta sozinho." };
  else if (snap && snap.source.haOk === false) msg = { tone: "crit", Icon: Database, title: "Home Assistant inacessível", body: snap.source.error || "Confira se o container está rodando (docker compose up -d)." };
  else if (snap && snap.source.haOk && !snap.wan.found) msg = { tone: "warn", Icon: TriangleAlert, title: "Integração Huawei não encontrada no HA", body: "Adicione a integração Huawei Mesh Router em Configurações → Dispositivos e serviços." };
  if (!msg) return null;
  return (
    <div className={cx("mb-4 flex items-start gap-3 rounded-lg border px-4 py-3", msg.tone === "crit" ? "border-crit/40 bg-crit/10" : "border-warn/40 bg-warn/10")} role="alert">
      <msg.Icon size={18} className={msg.tone === "crit" ? "text-crit" : "text-warn"} />
      <div className="min-w-0">
        <div className="text-[13px] font-semibold text-ink">{msg.title}</div>
        <div className="text-[12px] text-ink-2">{msg.body}</div>
      </div>
    </div>
  );
}

/* ─────────────────────── Card 1 · Status geral ─────────────────────── */

function StatusCard({ snap, paused, online }) {
  const [showIp, setShowIp] = useState(false);
  const wan = snap.wan;
  const status = !snap.source.haOk || !wan.found || wan.connected == null ? "unknown" : wan.connected ? "up" : "down";
  const state = { up: "var(--neon)", down: "var(--crit)", unknown: "var(--warn)" }[status];
  const title = { up: "REDES UP", down: "REDES DOWN", unknown: "SEM DADOS" }[status];
  const wanAge = isNum(wan.uptimeSec) && isNum(snap.source.integrationUpdated) ? wan.uptimeSec + (snap.now - snap.source.integrationUpdated) / 1000 : wan.uptimeSec;
  const p = snap.ping;
  const av = snap.availability;
  const slotColor = { up: "bg-neon/70", degraded: "bg-warn", down: "bg-crit", nodata: "bg-line" };
  const slotLabel = { up: "Operacional", degraded: "Degradado", down: "Falha", nodata: "Sem coleta" };

  const stats = [
    { label: "Latência", sub: `ICMP ${p.target}`, value: p.latency == null ? (p.samples ? "timeout" : "—") : `${nf(p.latency, p.latency < 10 ? 1 : 0)} ms`, bad: p.samples > 0 && p.latency == null },
    { label: "Jitter", sub: "últimos 20", value: isNum(p.jitter) ? `${nf(p.jitter, 1)} ms` : "—", bad: false },
    { label: "Perda", sub: "últimos 2 min", value: isNum(p.loss) ? `${nf(p.loss, 1)}%` : "—", bad: p.loss > 2 },
    { label: "Online", sub: "dispositivos", value: String(online), bad: false },
  ];

  return (
    <section className="fm-card flex flex-col gap-5 p-5 lg:col-span-4" aria-labelledby="status-title">
      <CardHeader id="status-title" icon={Network} title="Status geral da rede"
        subtitle={snap.source.entities.wan || "aguardando a integração"}
        right={status === "down" ? <StatePill tone="crit" icon={TriangleAlert} blink>Incidente</StatePill>
          : status === "up" ? <StatePill tone="neon" icon={CircleCheck}>Normal</StatePill>
            : <StatePill tone="warn" icon={CircleAlert}>Verificar</StatePill>} />

      <div className="flex items-center gap-4 2xl:gap-5" style={{ "--state": state }}>
        <div className={cx("fm-orb", status === "down" && "is-down", (paused || status === "unknown") && "is-still")} aria-hidden="true">
          {status === "down" ? <WifiOff strokeWidth={1.8} /> : <Globe strokeWidth={1.8} />}
        </div>
        <div className="min-w-0" role="status" aria-live="polite">
          <div className={cx("fm-glow-text whitespace-nowrap font-display text-[30px] font-bold leading-none tracking-tight sm:text-[40px] lg:text-[32px] 2xl:text-[42px]",
            status === "up" ? "text-neon" : status === "down" ? "text-crit" : "text-warn")}>{title}</div>
          <p className="mt-2 text-[13px] leading-snug text-ink-2">
            {status === "up" && <>Internet conectada há <span className="fm-mono text-ink">{fmtDur(wanAge)}</span>.</>}
            {status === "down" && "O AX3 reporta a WAN desconectada. A rede local continua respondendo."}
            {status === "unknown" && "Sem leitura da WAN no momento."}
          </p>
          <div className="fm-mono mt-1.5 flex items-center gap-2 text-[11px] text-muted">
            <span>IP externo {showIp ? wan.externalIp || "—" : maskIp(wan.externalIp)}</span>
            {wan.externalIp && (
              <button type="button" onClick={() => setShowIp((v) => !v)} className="fm-btn rounded p-0.5 text-muted hover:text-ink" aria-label={showIp ? "Ocultar IP externo" : "Mostrar IP externo"}>
                {showIp ? <EyeOff size={12} /> : <Eye size={12} />}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-line bg-inset/60 p-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className="fm-label text-[11px] text-muted">Disponibilidade · desde {fmtClock(snap.startedAt, false)}</div>
            <div className="mt-1 font-display text-[32px] font-semibold leading-none text-ink">
              {isNum(av.pct) ? nf(av.pct, av.pct === 100 ? 1 : 3) : "—"}<span className="text-[20px] text-ink-2">%</span>
            </div>
          </div>
          <div className="fm-mono text-right text-[11px] text-muted">{av.samples} amostras<br />WAN + ping</div>
        </div>
        <div className="mt-4 flex h-6 gap-[2px]" role="img" aria-label="Disponibilidade na última hora, em blocos de 1 minuto">
          {av.timeline.map((s) => (
            <span key={s.t} title={`${fmtClock(s.t, false)} · ${slotLabel[s.state]}`} className={cx("flex-1 rounded-[1px]", slotColor[s.state])} />
          ))}
        </div>
        <div className="fm-mono mt-1.5 flex justify-between text-[10px] text-muted">
          <span>−60 min</span>
          <span className="flex gap-3">
            <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-[2px] bg-neon/70" />ok</span>
            <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-[2px] bg-warn" />degradado</span>
            <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-[2px] bg-crit" />falha</span>
          </span>
          <span>agora</span>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line">
        {stats.map((s) => (
          <div key={s.label} className="bg-panel px-3.5 py-3">
            <dt className="flex items-baseline justify-between gap-2">
              <span className="fm-label text-[11px] text-ink-2">{s.label}</span>
              <span className="fm-mono text-[10px] text-muted">{s.sub}</span>
            </dt>
            <dd className={cx("fm-mono mt-1 text-[18px] font-medium tabular-nums", s.bad ? "text-crit" : "text-ink")}>{s.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/* ──────────────────── Card 2 · Tráfego em tempo real ──────────────────── */

function TrafficTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="fm-tooltip">
      <div className="fm-mono mb-1.5 text-[11px] text-muted">{fmtClock(label)}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2 py-0.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} />
          <span className="text-ink-2">{p.name}</span>
          <span className="fm-mono ml-auto pl-3 tabular-nums text-ink">{fmtRate(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

function EndDot({ cx: x, cy: y, index, dataLength, color }) {
  if (index !== dataLength - 1 || x == null || y == null) return null;
  return <circle cx={x} cy={y} r={4} fill={color} stroke={C.panel} strokeWidth={2} />;
}

function TrafficPanel({ id, title, tag, note, data, inKey, outKey, down }) {
  const last = data[data.length - 1] || {};
  const peak = data.length ? Math.max(...data.map((d) => d[inKey] || 0)) : 0;
  const { max, ticks } = niceScale(Math.max(peak, ...data.map((d) => d[outKey] || 0)));
  const series = [
    { key: inKey, name: "Download (In)", color: C.in, Icon: ArrowDown },
    { key: outKey, name: "Upload (Out)", color: C.out, Icon: ArrowUp },
  ];
  return (
    <div className="min-w-0 rounded-lg border border-line bg-inset/50 p-3.5 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="fm-label text-[12px] font-semibold text-ink">{title}</span>
            <span className="fm-mono rounded border border-line-2 px-1.5 py-px text-[10px] text-ink-2">{tag}</span>
            {down && <StatePill tone="crit" icon={CircleAlert} blink>sem link</StatePill>}
          </div>
          <div className="fm-mono mt-0.5 text-[10px] text-muted">{note} · pico ↓ {fmtRate(peak)}</div>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1">
          {series.map((s) => (
            <div key={s.key} className="flex items-center gap-2">
              <span className="h-[3px] w-4 rounded-full" style={{ background: s.color }} />
              <s.Icon size={13} className="text-muted" />
              <span className="text-[12px] text-ink-2">{s.name}</span>
              <span className="fm-mono min-w-[84px] text-right text-[14px] font-semibold tabular-nums text-ink">{fmtRate(last[s.key])}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 h-[150px] sm:h-[164px]">
        {data.length < 2 ? <Empty>Juntando as primeiras amostras…</Empty> : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`${id}-in`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.in} stopOpacity={0.32} />
                  <stop offset="100%" stopColor={C.in} stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id={`${id}-out`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.out} stopOpacity={0.16} />
                  <stop offset="100%" stopColor={C.out} stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={C.grid} />
              <XAxis dataKey="t" tickFormatter={(t) => fmtClock(t)} interval="preserveStartEnd" minTickGap={56}
                tick={{ fill: C.muted, fontSize: 10, fontFamily: "JetBrains Mono, monospace" }} axisLine={{ stroke: C.axis }} tickLine={false} />
              <YAxis domain={[0, max]} ticks={ticks} tickFormatter={fmtTick} width={44}
                tick={{ fill: C.muted, fontSize: 10, fontFamily: "JetBrains Mono, monospace" }} axisLine={false} tickLine={false} />
              <Tooltip content={<TrafficTooltip />} cursor={{ stroke: C.axis, strokeWidth: 1 }} isAnimationActive={false} />
              <Area type="monotone" dataKey={inKey} name="Download (In)" stroke={C.in} strokeWidth={2} fill={`url(#${id}-in)`} isAnimationActive={false}
                dot={(p) => <EndDot key={`i-${p.index}`} {...p} dataLength={data.length} color={C.in} />} activeDot={{ r: 4, fill: C.in, stroke: C.panel, strokeWidth: 2 }} />
              <Area type="monotone" dataKey={outKey} name="Upload (Out)" stroke={C.out} strokeWidth={2} fill={`url(#${id}-out)`} isAnimationActive={false}
                dot={(p) => <EndDot key={`o-${p.index}`} {...p} dataLength={data.length} color={C.out} />} activeDot={{ r: 4, fill: C.out, stroke: C.panel, strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function TrafficCard({ snap }) {
  const age = isNum(snap.source.integrationUpdated) ? snap.now - snap.source.integrationUpdated : null;
  return (
    <section className="fm-card flex min-w-0 flex-col gap-4 p-5 lg:col-span-8" aria-labelledby="traffic-title">
      <CardHeader id="traffic-title" icon={Activity} title="Tráfego de dados em tempo real"
        subtitle={`janela ${Math.round((snap.history.length * snap.source.pollInterval) / 60) || 0} min · leitura a cada ${snap.source.pollInterval} s`}
        right={<StatePill tone={age != null && age > 60000 ? "warn" : "muted"} icon={Timer}>roteador atualizou há {fmtAgo(age)}</StatePill>} />
      <TrafficPanel id="wan" title="WAN · Internet" tag="AX3 WAN" note="taxa reportada pelo roteador"
        data={snap.history} inKey="wanIn" outKey="wanOut" down={snap.wan.connected === false} />
      <TrafficPanel id="cli" title="Clientes · Wi-Fi + cabo" tag="soma por dispositivo" note="soma das taxas de cada cliente"
        data={snap.history} inKey="cliIn" outKey="cliOut" />
    </section>
  );
}

/* ───────────────────────── Card 3 · Roteador ───────────────────────── */

function RouterCard({ snap, bands }) {
  const r = snap.router;
  const uptime = isNum(r.uptimeSec) ? r.uptimeSec + (snap.now - (r.uptimeAt || snap.now)) / 1000 : null;
  const total = Math.max(1, bands.reduce((s, b) => s + b.value, 0));
  const ent = snap.source.entities;
  return (
    <section className="fm-card flex flex-col gap-4 p-5" aria-labelledby="router-title">
      <CardHeader id="router-title" icon={Router} title="Equipamento ativo" subtitle={r.name || "roteador principal"}
        right={snap.source.haOk ? <StatePill tone="neon" icon={CircleCheck}>Online</StatePill> : <StatePill tone="crit" icon={CircleAlert}>Sem leitura</StatePill>} />

      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <div className="fm-label text-[10px] text-muted">{r.manufacturer || "Huawei"}</div>
          <div className="font-display text-[24px] font-semibold leading-tight text-ink">{r.model || "WiFi AX3"}</div>
          <div className="fm-mono mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted">
            {r.firmware && <span>firmware {r.firmware}</span>}
            {r.hardware && <span>hw {r.hardware}</span>}
            {!r.firmware && !r.hardware && <span>dados do dispositivo no HA</span>}
          </div>
        </div>
        <div className="text-right">
          <div className="flex items-center justify-end gap-1.5 text-ink-2"><Timer size={13} /><span className="fm-label text-[10px]">Tempo ligado</span></div>
          <div className="fm-mono text-[18px] font-semibold tabular-nums text-ink">{fmtDur(uptime)}</div>
        </div>
      </div>

      <div className="rounded-lg border border-line bg-inset/60 p-3">
        <div className="mb-3 flex items-center justify-between">
          <span className="fm-label text-[11px] text-ink-2">Clientes por conexão</span>
          <span className="fm-mono text-[10px] text-muted">{bands.reduce((s, b) => s + b.value, 0)} online</span>
        </div>
        <div className="flex flex-col gap-2.5">
          {bands.map((b) => (
            <div key={b.key} className="grid grid-cols-[110px_1fr_36px] items-center gap-3">
              <span className="flex items-center gap-1.5 text-[12px] text-ink-2"><b.Icon size={13} className="text-muted" />{b.label}</span>
              <div className="h-1.5 overflow-hidden rounded-full bg-electric/10">
                <div className="fm-bar h-full rounded-full bg-electric" style={{ width: `${(b.value / total) * 100}%` }} />
              </div>
              <span className="fm-mono text-right text-[13px] font-semibold tabular-nums text-ink">{b.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="fm-mono grid min-w-0 gap-1 rounded-md border border-line bg-inset/50 px-3 py-2 text-[11px] text-muted">
        <div className="flex min-w-0 justify-between gap-3"><span className="flex-none">fonte</span><span className="min-w-0 truncate text-ink-2">{snap.source.haUrl}</span></div>
        <div className="flex min-w-0 justify-between gap-3"><span className="flex-none">wan</span><span className="min-w-0 truncate text-ink-2">{ent.wan || "—"}</span></div>
        <div className="flex min-w-0 justify-between gap-3"><span className="flex-none">rastreadores</span><span className="text-ink-2">{ent.trackers ?? 0} entidades</span></div>
      </div>
    </section>
  );
}

/* ───────────────────────── Log de eventos ───────────────────────── */

function LogCard({ events }) {
  const ref = useRef(null);
  const stick = useRef(true);
  const lastId = events.length ? events[events.length - 1].id : 0;
  useEffect(() => {
    const el = ref.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [lastId]);
  const tone = { info: "text-electric", warning: "text-warn", critical: "text-crit" };
  return (
    <section className="fm-card flex flex-col gap-3 p-5" aria-labelledby="log-title">
      <CardHeader id="log-title" icon={Terminal} title="Log de eventos" subtitle="registrado pela ponte flowmonitor.py" />
      <div ref={ref} onScroll={(e) => { const el = e.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24; }}
        className="fm-scroll fm-mono h-[208px] overflow-auto rounded-md border border-line bg-[#050911] px-3 py-2 text-[11px] leading-[1.7]" role="log">
        {events.length === 0 && <div className="text-muted">Sem eventos ainda.</div>}
        {events.map((l) => (
          <div key={l.id} className="whitespace-nowrap">
            <span className="text-muted">{fmtClock(l.t)}</span>{" "}
            <span className={tone[l.level] || "text-ink-2"}>{l.topic},{l.level}</span>{" "}
            <span className={l.level === "critical" ? "text-crit" : "text-ink-2"}>{l.msg}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ──────────────── Card 4 · Dispositivos conectados ──────────────── */

function PieTooltip({ active, payload, total }) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0].payload;
  return (
    <div className="fm-tooltip">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} />
        <span className="text-ink">{p.label}</span>
        <span className="fm-mono ml-auto pl-3 tabular-nums text-ink">{p.value}</span>
      </div>
      <div className="fm-mono mt-1 text-[11px] text-muted">{total ? nf((p.value / total) * 100, 0) : 0}% dos online</div>
    </div>
  );
}

function Signal({ rssi }) {
  const bars = signalBars(rssi);
  if (!bars) return null;
  return (
    <span className="inline-flex items-end gap-[2px]" title={`RSSI ${rssi}`} aria-label={`sinal ${bars} de 4`}>
      {[1, 2, 3, 4].map((i) => (
        <i key={i} className={cx("w-[3px] rounded-[1px]", i <= bars ? (bars <= 1 ? "bg-warn" : "bg-neon") : "bg-line-2")} style={{ height: 3 + i * 2.5 }} />
      ))}
    </span>
  );
}

function BandChip({ band, guest }) {
  const isLan = band === "LAN";
  const Icon = isLan ? Cable : Wifi;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="fm-mono inline-flex items-center gap-1 rounded border border-line-2 px-1.5 py-px text-[10px] text-ink-2">
        <Icon size={11} />{isLan ? "cabo" : band || "?"}
      </span>
      {guest && <span className="fm-mono rounded border border-warn/40 px-1 py-px text-[9px] text-warn">convidado</span>}
    </span>
  );
}

function DeviceRow({ d, now, isNew }) {
  const t = TYPES[d.type] || TYPES.other;
  const left = d.state === "left";
  return (
    <tr className={cx("fm-row", isNew && "fm-row-in", left && "fm-row-left")}>
      <td className="py-2.5 pl-4 pr-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-7 w-7 flex-none place-items-center rounded-md border border-line-2 bg-inset" style={{ color: t.color }}><t.Icon size={14} /></span>
          <div className="min-w-0">
            <div className="max-w-[200px] truncate text-[13px] font-medium text-ink" title={d.name}>{d.name}</div>
            <div className="max-w-[200px] truncate text-[11px] text-muted">{d.host && d.host !== d.name ? d.host : t.label}</div>
          </div>
        </div>
      </td>
      <td className="px-3">
        <div className="fm-mono text-[12px] tabular-nums text-ink">{d.ip || "—"}</div>
        <div className="fm-mono text-[10px] text-muted">{d.mac}</div>
      </td>
      <td className="px-3"><div className="flex items-center gap-2"><BandChip band={d.band} guest={d.guest} /><Signal rssi={d.rssi} /></div></td>
      <td className="fm-mono px-3 text-[11px] tabular-nums">
        <div className="text-ink">↓ {fmtKB(d.downKBps)}</div>
        <div className="text-muted">↑ {fmtKB(d.upKBps)}</div>
      </td>
      <td className="fm-mono px-3 text-[12px] tabular-nums text-ink-2">{left ? "—" : fmtAgo(isNum(d.since) ? now - d.since : null)}</td>
      <td className="pl-3 pr-4">
        {left ? <StatePill tone="crit" icon={LogOut}>Desconectado</StatePill> : <StatePill tone="neon" icon={CircleCheck}>Online</StatePill>}
      </td>
    </tr>
  );
}

/** Versão em cartão da linha da tabela, usada no celular. */
function DeviceCard({ d, now, isNew }) {
  const t = TYPES[d.type] || TYPES.other;
  const left = d.state === "left";
  return (
    <li className={cx("rounded-lg border border-line bg-inset/50 p-3", isNew && "fm-row-in", left && "fm-row-left")}>
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 flex-none place-items-center rounded-md border border-line-2 bg-inset" style={{ color: t.color }}><t.Icon size={16} /></span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-medium text-ink">{d.name}</div>
          <div className="fm-mono truncate text-[11px] text-muted">{d.ip || "—"} · {t.label}</div>
        </div>
        {left ? <StatePill tone="crit" icon={LogOut}>Saiu</StatePill> : <StatePill tone="neon" icon={CircleCheck}>Online</StatePill>}
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="flex items-center gap-2"><BandChip band={d.band} guest={d.guest} /><Signal rssi={d.rssi} /></span>
        <span className="fm-mono text-[11px] tabular-nums text-ink">↓ {fmtKB(d.downKBps)}</span>
        <span className="fm-mono text-[11px] tabular-nums text-muted">↑ {fmtKB(d.upKBps)}</span>
        <span className="fm-mono ml-auto text-[11px] tabular-nums text-ink-2">{left ? "—" : fmtAgo(isNum(d.since) ? now - d.since : null)}</span>
      </div>
    </li>
  );
}

const SORTS = [
  { key: "recent", label: "Mais recentes" },
  { key: "traffic", label: "Mais tráfego" },
  { key: "name", label: "Nome" },
];

function DevicesCard({ snap, newMacs }) {
  const [sort, setSort] = useState("recent");
  const online = snap.devices.filter((d) => d.state === "online");
  const total = online.length;
  const pie = TYPE_ORDER.map((k) => ({ key: k, label: TYPES[k].label, color: TYPES[k].color, value: online.filter((d) => (d.type || "other") === k).length }));
  const rows = useMemo(() => {
    const left = snap.devices.filter((d) => d.state === "left");
    const sorted = [...online].sort((a, b) => {
      if (sort === "traffic") return b.downKBps + b.upKBps - (a.downKBps + a.upKBps);
      if (sort === "name") return a.name.localeCompare(b.name, "pt-BR");
      return (b.since || 0) - (a.since || 0);
    });
    return [...left, ...sorted];
  }, [snap.devices, sort]); // eslint-disable-line react-hooks/exhaustive-deps
  const totalDown = online.reduce((s, d) => s + d.downKBps, 0);
  const top = [...online].sort((a, b) => b.downKBps - a.downKBps)[0];

  return (
    <section className="fm-card flex min-w-0 flex-col gap-4 p-5" aria-labelledby="dev-title">
      <CardHeader id="dev-title" icon={Smartphone} title="Dispositivos conectados" subtitle="device_tracker · Huawei Mesh Router"
        right={<StatePill tone="electric" icon={LogIn}>entradas e saídas em tempo real</StatePill>} />

      <div className="grid grid-cols-1 items-center gap-5 md:grid-cols-[220px_1fr]">
        <div className="relative mx-auto h-[200px] w-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={pie} dataKey="value" nameKey="label" innerRadius="66%" outerRadius="96%" paddingAngle={total > 1 ? 2 : 0}
                startAngle={90} endAngle={-270} stroke={C.panel} strokeWidth={2} isAnimationActive={false}>
                {pie.map((p) => <Cell key={p.key} fill={p.color} />)}
              </Pie>
              <Tooltip content={<PieTooltip total={total} />} isAnimationActive={false} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
            <div>
              <div key={total} className="fm-bump font-display text-[40px] font-bold leading-none text-ink">{total}</div>
              <div className="fm-label mt-1 text-[10px] text-muted">online</div>
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <ul className="grid grid-cols-2 gap-x-6 gap-y-2.5">
            {pie.map((p) => (
              <li key={p.key} className="flex items-center gap-2.5">
                <span className="h-3 w-3 flex-none rounded-[3px]" style={{ background: p.color }} />
                <span className="text-[13px] text-ink-2">{p.label}</span>
                <span className="fm-mono ml-auto text-[14px] font-semibold tabular-nums text-ink">{p.value}</span>
                <span className="fm-mono w-9 text-right text-[11px] tabular-nums text-muted">{total ? nf((p.value / total) * 100, 0) : 0}%</span>
              </li>
            ))}
          </ul>
          <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-line bg-line">
            <div className="bg-panel px-3 py-2.5">
              <dt className="fm-label text-[10px] text-muted">Online</dt>
              <dd className="fm-mono mt-0.5 text-[18px] font-semibold tabular-nums text-ink">{total}</dd>
            </div>
            <div className="bg-panel px-3 py-2.5">
              <dt className="fm-label text-[10px] text-muted">Download total</dt>
              <dd className="fm-mono mt-0.5 text-[16px] font-semibold tabular-nums text-ink">{fmtKB(totalDown)}</dd>
            </div>
            <div className="min-w-0 bg-panel px-3 py-2.5">
              <dt className="fm-label text-[10px] text-muted">Mais ativo</dt>
              <dd className="mt-0.5 truncate text-[13px] font-medium text-ink" title={top ? top.name : ""}>{top && top.downKBps > 0 ? top.name : "—"}</dd>
            </div>
          </dl>
          <p className="text-[11px] text-muted">Tipo estimado pelo nome de cada dispositivo. Renomeie no Home Assistant para classificar melhor.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="fm-label text-[11px] text-ink-2">Lista de clientes</span>
        <div className="inline-flex rounded-md border border-line-2 bg-inset p-0.5" role="group" aria-label="Ordenar lista">
          {SORTS.map((s) => (
            <button key={s.key} type="button" onClick={() => setSort(s.key)} aria-pressed={sort === s.key}
              className={cx("fm-btn rounded px-2.5 py-1 text-[11px] font-medium transition", sort === s.key ? "bg-electric/15 text-electric" : "text-ink-2 hover:text-ink")}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <ul className="flex flex-col gap-2 md:hidden" aria-label="Dispositivos conectados ao roteador">
        {rows.length === 0 && (
          <li className="rounded-lg border border-dashed border-line-2 px-4 py-8 text-center text-[13px] text-muted">Nenhum dispositivo online reportado pelo Home Assistant.</li>
        )}
        {rows.map((d) => <DeviceCard key={d.mac + d.state} d={d} now={snap.now} isNew={newMacs.has(d.mac)} />)}
      </ul>

      <div className="fm-scroll hidden max-h-[460px] min-w-0 overflow-auto rounded-lg border border-line md:block">
        <table className="w-full min-w-[700px] border-collapse text-left">
          <caption className="sr-only">Dispositivos conectados ao roteador</caption>
          <thead className="sticky top-0 z-10 bg-inset">
            <tr className="fm-label text-[10px] text-muted">
              <th scope="col" className="py-2 pl-4 pr-3 font-medium">Dispositivo</th>
              <th scope="col" className="px-3 font-medium">IP · MAC</th>
              <th scope="col" className="px-3 font-medium">Conexão</th>
              <th scope="col" className="px-3 font-medium">Tráfego</th>
              <th scope="col" className="px-3 font-medium">Conectado há</th>
              <th scope="col" className="pl-3 pr-4 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-[13px] text-muted">Nenhum dispositivo online reportado pelo Home Assistant.</td></tr>
            )}
            {rows.map((d) => <DeviceRow key={d.mac + d.state} d={d} now={snap.now} isNew={newMacs.has(d.mac)} />)}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ───────────────────────────── Toasts ───────────────────────────── */

const TOAST_MS = 5500;

function Toast({ t, onDismiss }) {
  useEffect(() => {
    const id = setTimeout(() => onDismiss(t.id), TOAST_MS);
    return () => clearTimeout(id);
  }, [t.id, onDismiss]);
  const tone = {
    join: { ring: "border-electric/40", icon: "text-electric bg-electric/10", bar: "bg-electric" },
    leave: { ring: "border-line-2", icon: "text-ink-2 bg-inset", bar: "bg-ink-2" },
    crit: { ring: "border-crit/50", icon: "text-crit bg-crit/10", bar: "bg-crit" },
    ok: { ring: "border-neon/40", icon: "text-neon bg-neon/10", bar: "bg-neon" },
  }[t.tone];
  const Icon = t.icon;
  return (
    <div role="status" className={cx("fm-toast overflow-hidden rounded-lg border bg-inset/95 shadow-[0_18px_40px_-16px_rgb(0_0_0/.9)] backdrop-blur", tone.ring)}>
      <div className="flex items-start gap-3 p-3.5">
        <span className={cx("grid h-8 w-8 flex-none place-items-center rounded-md", tone.icon)}><Icon size={16} /></span>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-ink">{t.title}</div>
          <div className="mt-0.5 truncate text-[12px] text-ink-2">{t.body}</div>
          {t.meta && <div className="fm-mono mt-1 truncate text-[11px] text-muted">{t.meta}</div>}
        </div>
        <button type="button" onClick={() => onDismiss(t.id)} aria-label="Fechar notificação" className="fm-btn -mr-1 -mt-1 grid h-7 w-7 place-items-center rounded-md text-muted hover:text-ink">
          <X size={14} />
        </button>
      </div>
      <div className={cx("fm-toast-timer h-0.5 opacity-70", tone.bar)} style={{ animationDuration: `${TOAST_MS}ms` }} />
    </div>
  );
}

function eventToToast(e) {
  const d = e.device || {};
  const meta = [d.ip, d.mac, d.band].filter(Boolean).join(" · ");
  if (e.topic === "device" && e.msg.startsWith("conectou")) {
    return { tone: "join", icon: (TYPES[d.type] || TYPES.other).Icon, title: "Novo dispositivo conectado na rede", body: d.name || e.msg, meta };
  }
  if (e.topic === "device" && e.msg.startsWith("desconectou")) {
    return { tone: "leave", icon: LogOut, title: "Dispositivo saiu da rede", body: d.name || e.msg, meta };
  }
  if (e.topic === "wan") {
    return e.level === "critical"
      ? { tone: "crit", icon: WifiOff, title: "REDES DOWN · internet caiu", body: e.msg }
      : { tone: "ok", icon: Globe, title: "Internet restabelecida", body: e.msg };
  }
  if (e.topic === "ha" && e.level === "critical") return { tone: "crit", icon: Database, title: "Home Assistant sem resposta", body: e.msg };
  return null;
}

/* ─────────────────────────────── App ─────────────────────────────── */

let toastSeq = 0;

export default function FlowMonitorLive({ apiBase = "", onSettings }) {
  const [paused, setPaused] = useState(false);
  const { snap, offline } = useSnapshot(paused, apiBase);
  const [toasts, setToasts] = useState([]);
  const [newMacs, setNewMacs] = useState(() => new Set());
  const lastEvent = useRef(null);

  const dismiss = useCallback((id) => setToasts((ts) => ts.filter((t) => t.id !== id)), []);

  useEffect(() => {
    if (!snap) return;
    const events = snap.events || [];
    const maxId = events.length ? events[events.length - 1].id : 0;
    if (lastEvent.current == null) { lastEvent.current = maxId; return; }
    const fresh = events.filter((e) => e.id > lastEvent.current);
    lastEvent.current = Math.max(lastEvent.current, maxId);
    if (!fresh.length) return;
    const add = fresh.map(eventToToast).filter(Boolean).map((t) => ({ id: ++toastSeq, ...t }));
    if (add.length) setToasts((ts) => [...ts, ...add].slice(-4));
    const joined = fresh.filter((e) => e.topic === "device" && e.msg.startsWith("conectou") && e.device).map((e) => e.device.mac);
    if (joined.length) {
      setNewMacs((s) => new Set([...s, ...joined]));
      setTimeout(() => setNewMacs((s) => { const n = new Set(s); joined.forEach((m) => n.delete(m)); return n; }), 3000);
    }
  }, [snap]);

  const health = offline || (snap && snap.source.haOk === false) ? "crit" : snap && (!snap.wan.found || snap.wan.connected === false) ? "warn" : "ok";
  const routerLabel = snap && snap.router.model ? `${snap.router.manufacturer || "Huawei"} ${snap.router.model}` : "Huawei AX3";

  const online = snap ? snap.devices.filter((d) => d.state === "online") : [];
  const bands = snap ? [
    { key: "5", label: "Wi-Fi 5 GHz", Icon: Wifi, value: online.filter((d) => d.band === "5GHz").length },
    { key: "24", label: "Wi-Fi 2,4 GHz", Icon: Wifi, value: online.filter((d) => d.band === "2.4GHz").length },
    { key: "lan", label: "Cabo (LAN)", Icon: Plug, value: online.filter((d) => d.band === "LAN").length },
    { key: "guest", label: "Convidados", Icon: UserRound, value: online.filter((d) => d.guest).length },
  ] : [];

  return (
    <div className="fm-app text-ink">
      <style>{GLOBAL_CSS}</style>
      <Header paused={paused} onToggle={() => setPaused((p) => !p)} health={health} routerLabel={routerLabel} onSettings={onSettings} />
      <main className="fm-gutter mx-auto max-w-[1600px]" style={{ paddingBlock: 20 }}>
        <Banner offline={offline} snap={snap} apiBase={apiBase} />
        {!snap ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            {["lg:col-span-4", "lg:col-span-8", "lg:col-span-5", "lg:col-span-7"].map((c) => (
              <div key={c} className={cx("fm-card h-[320px] p-5", c)}>
                <div className="fm-skel h-4 w-40 rounded" />
                <div className="mt-6 text-[12px] text-muted">{offline ? "Esperando o coletor responder…" : "Conectando ao coletor…"}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <StatusCard snap={snap} paused={paused} online={online.length} />
            <TrafficCard snap={snap} />
            <div className="flex min-w-0 flex-col gap-4 lg:col-span-5">
              <RouterCard snap={snap} bands={bands} />
              <LogCard events={snap.events} />
            </div>
            <div className="min-w-0 lg:col-span-7">
              <DevicesCard snap={snap} newMacs={newMacs} />
            </div>
          </div>
        )}
        <footer className="fm-mono mt-6 flex flex-wrap justify-between gap-2 text-[11px] text-muted">
          <span>FlowMonitor · dados reais do seu AX3 via Home Assistant, servidos só neste PC.</span>
          <span>{snap ? `última leitura ${fmtClock(snap.source.lastPoll || snap.now)}` : "—"}</span>
        </footer>
      </main>
      <div className="fm-toasts" aria-live="polite">
        {toasts.map((t) => <Toast key={t.id} t={t} onDismiss={dismiss} />)}
      </div>
    </div>
  );
}
