/**
 * FlowMonitor · NOC Real-Time
 * Dashboard de monitoramento de rede com simulador embutido.
 *
 * Stack: React 18 · Tailwind CSS 3 · Recharts 2 · lucide-react
 *
 * Para usar em um projeto Vite/Tailwind:
 *  1. npm i recharts@2 lucide-react
 *  2. Copie TAILWIND_THEME (abaixo) para tailwind.config.js → theme.extend
 *  3. Carregue as fontes Chakra Petch, IBM Plex Sans e JetBrains Mono (Google Fonts)
 *  4. <FlowMonitor /> — os tokens de cor vêm do <style> que o próprio componente injeta.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, PieChart, Pie, Cell,
} from "recharts";
import {
  Activity, Globe, WifiOff, Pause, Play, Router, Cpu, MemoryStick, Thermometer,
  Clock, Smartphone, Laptop, Server, HardDrive, Tv, Speaker, Cctv, Cast, Printer,
  Lightbulb, RefreshCw, X, CircleCheck, Hourglass, CircleAlert, ArrowDown, ArrowUp,
  Unplug, Zap, Terminal, Network, TriangleAlert, Timer,
} from "lucide-react";

/* ─────────────────────────────── Tema ─────────────────────────────── */

export const TAILWIND_THEME = {
  colors: {
    bg: "rgb(var(--bg) / <alpha-value>)",
    panel: "rgb(var(--panel) / <alpha-value>)",
    inset: "rgb(var(--inset) / <alpha-value>)",
    line: "rgb(var(--line) / <alpha-value>)",
    "line-2": "rgb(var(--line-2) / <alpha-value>)",
    ink: "rgb(var(--ink) / <alpha-value>)",
    "ink-2": "rgb(var(--ink-2) / <alpha-value>)",
    muted: "rgb(var(--muted) / <alpha-value>)",
    electric: "rgb(var(--electric) / <alpha-value>)",
    neon: "rgb(var(--neon) / <alpha-value>)",
    warn: "rgb(var(--warn) / <alpha-value>)",
    crit: "rgb(var(--crit) / <alpha-value>)",
  },
  fontFamily: {
    display: ['"Chakra Petch"', "ui-sans-serif", "system-ui", "sans-serif"],
    sans: ['"IBM Plex Sans"', "ui-sans-serif", "system-ui", "sans-serif"],
    mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
  },
};

// Cores usadas dentro dos gráficos (SVG) — espelham os tokens CSS.
const C = {
  panel: "#0c1424", grid: "#16223a", axis: "#26364f", muted: "#6a7c95",
  in: "#2b8cf0", out: "#d9702f", electric: "#38a3ff",
};

const GLOBAL_CSS = `
/* Layout: cabeçalho fixo + grade de 12 colunas (status/tráfego, equipamento+log/dispositivos) */
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

/* Orbe de status */
.fm-orb{position:relative;width:84px;height:84px;border-radius:9999px;display:grid;place-items:center;flex:none;
  color:rgb(var(--state));background:radial-gradient(circle, rgb(var(--state) / .22), rgb(var(--state) / .04) 68%);
  border:1px solid rgb(var(--state) / .55);
  box-shadow:0 0 34px rgb(var(--state) / .35), inset 0 0 26px rgb(var(--state) / .22);}
.fm-orb::before,.fm-orb::after{content:"";position:absolute;inset:-1px;border-radius:inherit;border:1px solid rgb(var(--state) / .6);
  animation:fm-ring 2.4s cubic-bezier(.2,.6,.3,1) infinite}
.fm-orb::after{animation-delay:1.2s}
.fm-orb.is-down::before,.fm-orb.is-down::after{animation-duration:1.1s}
.fm-orb.is-paused::before,.fm-orb.is-paused::after{animation-play-state:paused;opacity:0}
@media (min-width:1536px){.fm-orb{width:104px;height:104px}}
.fm-orb svg{width:38%;height:38%}
@keyframes fm-ring{0%{transform:scale(1);opacity:.65}100%{transform:scale(1.65);opacity:0}}
.fm-glow-text{text-shadow:0 0 22px rgb(var(--state) / .55), 0 0 2px rgb(var(--state) / .8)}

/* Indicadores ao vivo */
.fm-live{position:relative;width:8px;height:8px;border-radius:9999px;background:rgb(var(--state));box-shadow:0 0 10px rgb(var(--state) / .9)}
.fm-live.is-on::after{content:"";position:absolute;inset:0;border-radius:inherit;background:rgb(var(--state));animation:fm-ping 1.6s ease-out infinite}
@keyframes fm-ping{0%{transform:scale(1);opacity:.7}100%{transform:scale(2.6);opacity:0}}
.fm-blink{animation:fm-blink 1s steps(2, jump-none) infinite}
@keyframes fm-blink{50%{opacity:.25}}

/* Painel frontal do roteador */
.fm-port{position:relative;display:block;border-radius:3px;background:linear-gradient(180deg,#05090f,#0a111d);
  border:1px solid rgb(var(--line-2));box-shadow:inset 0 2px 4px rgb(0 0 0 / .8);cursor:pointer;transition:border-color .15s, transform .15s}
.fm-port:hover,.fm-port:focus-visible,.fm-port.is-selected{border-color:rgb(var(--electric));outline:none}
.fm-port:focus-visible{box-shadow:0 0 0 2px rgb(var(--electric) / .5)}
.fm-led{position:absolute;top:2px;right:2px;width:5px;height:5px;border-radius:9999px;background:rgb(var(--line-2))}
.fm-led.up{background:rgb(var(--neon));box-shadow:0 0 6px rgb(var(--neon))}
.fm-led.up.act{animation:fm-flicker 1.3s infinite}
.fm-led.fail{background:rgb(var(--crit));box-shadow:0 0 7px rgb(var(--crit));animation:fm-blink .8s steps(2, jump-none) infinite}
@keyframes fm-flicker{0%,100%{opacity:1}35%{opacity:.35}42%{opacity:1}70%{opacity:.5}74%{opacity:1}}

/* Linhas da tabela de leases */
.fm-row td{border-top:1px solid rgb(var(--line) / .8)}
.fm-row-in{animation:fm-row-in 2.6s ease-out}
@keyframes fm-row-in{0%{background:rgb(var(--electric) / .22)}100%{background:transparent}}
.fm-row-out{animation:fm-row-out 1s ease-in forwards}
@keyframes fm-row-out{0%{background:rgb(var(--crit) / .16)}100%{background:rgb(var(--crit) / .04);opacity:.35}}
.fm-bar{transition:width 1s linear, background-color .3s}
.fm-bump{animation:fm-bump .5s ease-out}
@keyframes fm-bump{0%{transform:translateY(-3px);color:rgb(var(--electric))}100%{transform:none}}

/* Toasts */
.fm-toasts{position:fixed;z-index:60;right:max(16px, env(safe-area-inset-right, 0px));left:max(16px, env(safe-area-inset-left, 0px));
  bottom:calc(16px + env(safe-area-inset-bottom, 0px));display:flex;flex-direction:column;align-items:flex-end;gap:10px;pointer-events:none}
.fm-toast{pointer-events:auto;width:min(380px, 100%);animation:fm-toast-in .35s cubic-bezier(.2,.8,.2,1)}
@keyframes fm-toast-in{from{transform:translateY(12px) scale(.98);opacity:0}to{transform:none;opacity:1}}
.fm-toast-timer{animation:fm-shrink linear forwards;transform-origin:left}
@keyframes fm-shrink{from{transform:scaleX(1)}to{transform:scaleX(0)}}

.fm-scroll{scrollbar-width:thin;scrollbar-color:rgb(var(--line-2)) transparent}
.fm-btn:focus-visible{outline:2px solid rgb(var(--electric));outline-offset:2px}

@media (prefers-reduced-motion: reduce){
  .fm-orb::before,.fm-orb::after,.fm-live.is-on::after,.fm-led.up.act,.fm-blink,.fm-led.fail,
  .fm-row-in,.fm-row-out,.fm-bump,.fm-toast{animation:none!important}
  .fm-bar{transition:none}
}
`;

/* ─────────────────────────── Utilitários ─────────────────────────── */

const TZ = "America/Sao_Paulo";
const HISTORY = 60;          // pontos no gráfico (1 por segundo)
const DAY = 86400;
const POOL = { prefix: "10.10.20.", start: 100, end: 250 };
const POOL_SIZE = POOL.end - POOL.start + 1;

const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const avg = (arr) => arr.reduce((s, v) => s + v, 0) / arr.length;
const cx = (...c) => c.filter(Boolean).join(" ");
const pad = (n) => String(n).padStart(2, "0");

const nf = (v, d = 0) =>
  Number(v).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });

const fmtRate = (mbps) => {
  if (mbps >= 1000) return `${nf(mbps / 1000, 2)} Gbps`;
  if (mbps >= 100) return `${nf(mbps, 0)} Mbps`;
  return `${nf(mbps, 1)} Mbps`;
};
const fmtTick = (mbps) => (mbps === 0 ? "0" : mbps >= 1000 ? `${nf(mbps / 1000, mbps % 1000 ? 1 : 0)}G` : `${mbps}M`);
const fmtMMSS = (s) => `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
const fmtUptime = (sec) => {
  const d = Math.floor(sec / DAY), h = Math.floor((sec % DAY) / 3600);
  const m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return `${d}d ${pad(h)}:${pad(m)}:${pad(s)}`;
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

/* ─────────────────────── Catálogo de dispositivos ─────────────────────── */

const ICONS = { Smartphone, Laptop, Server, HardDrive, Tv, Speaker, Cctv, Cast, Printer, Lightbulb, Thermometer };

const CATS = {
  mobile: { label: "Celulares", color: "#2b8cf0", lease: [45, 110], weight: 0.4 },
  laptop: { label: "Notebooks", color: "#d9702f", lease: [60, 150], weight: 0.26 },
  server: { label: "Servidores", color: "#16a592", lease: [150, 240], weight: 0.1 },
  iot: { label: "IoT", color: "#9479ea", lease: [70, 160], weight: 0.24 },
};
const CAT_ORDER = ["mobile", "laptop", "server", "iot"];

const TEMPLATES = {
  mobile: [
    ["iPhone de Gabriel", "Smartphone"], ["Galaxy S24 da Ana", "Smartphone"], ["Moto G84 do Lucas", "Smartphone"],
    ["Redmi Note 13 da Carla", "Smartphone"], ["iPhone 15 da Júlia", "Smartphone"], ["Galaxy A55 do Pedro", "Smartphone"],
    ["Pixel 8 do Rafael", "Smartphone"], ["iPhone de Beatriz", "Smartphone"], ["Moto Edge da Larissa", "Smartphone"],
    ["Galaxy S23 do Thiago", "Smartphone"],
  ],
  laptop: [
    ["Notebook Dell", "Laptop"], ["MacBook Pro da Júlia", "Laptop"], ["ThinkPad Financeiro", "Laptop"],
    ["Notebook Acer RH", "Laptop"], ["Dell Latitude Suporte", "Laptop"], ["MacBook Air do Diego", "Laptop"],
    ["Notebook Lenovo Recepção", "Laptop"], ["Vaio Comercial", "Laptop"],
  ],
  server: [
    ["SRV-BACKUP-01", "Server"], ["SRV-ZABBIX", "Server"], ["SRV-ERP-DB", "Server"],
    ["SRV-DOCKER-02", "Server"], ["NAS Synology", "HardDrive"], ["SRV-FILES", "Server"],
  ],
  iot: [
    ["Smart TV Sala", "Tv"], ["Echo Dot Cozinha", "Speaker"], ["Câmera IP Portaria", "Cctv"],
    ["Chromecast Reunião", "Cast"], ["Impressora HP RH", "Printer"], ["Lâmpada Wi-Fi Recepção", "Lightbulb"],
    ["Sensor Temp. Rack", "Thermometer"], ["Câmera IP Garagem", "Cctv"], ["Smart TV Diretoria", "Tv"],
  ],
};

const leaseState = (d) => {
  if (d.status === "expired" || d.remaining <= 0) return "expired";
  if (d.remaining <= Math.max(15, d.lease * 0.25)) return "expiring";
  return "active";
};

const makeMac = (cat) => {
  const b = Array.from({ length: 6 }, () => randInt(0, 255));
  // Celulares usam MAC privado/aleatório (bit "locally administered" ligado)
  b[0] = cat === "mobile" ? (b[0] & 0xfc) | 0x02 : b[0] & 0xfc;
  return b.map((x) => x.toString(16).padStart(2, "0").toUpperCase()).join(":");
};

/* ─────────────────────── Painel frontal (CCR2004) ─────────────────────── */

const PORTS = [
  { name: "ether1", kind: "rj45", speed: "1G", role: "MGMT", up: true },
  { name: "sfp-sfpplus1", kind: "sfp", speed: "10G", role: "WAN", up: true, wan: true },
  { name: "sfp-sfpplus2", kind: "sfp", speed: "10G", role: "LAN-CORE", up: true },
  { name: "sfp-sfpplus3", kind: "sfp", speed: "10G", role: "SW-ANDAR2", up: true },
  { name: "sfp-sfpplus4", kind: "sfp", speed: "10G", role: "SW-SERVIDORES", up: true },
  { name: "sfp-sfpplus5", kind: "sfp", speed: "1G", role: "SW-CFTV", up: true },
  { name: "sfp-sfpplus6", kind: "sfp", speed: "10G", role: "SW-WIFI", up: true },
  { name: "sfp-sfpplus7", kind: "sfp", up: false },
  { name: "sfp-sfpplus8", kind: "sfp", role: "LINK-BACKUP", up: false },
  { name: "sfp-sfpplus9", kind: "sfp", up: false },
  { name: "sfp-sfpplus10", kind: "sfp", up: false },
  { name: "sfp-sfpplus11", kind: "sfp", up: false },
  { name: "sfp-sfpplus12", kind: "sfp", up: false },
  { name: "sfp28-1", kind: "sfp28", speed: "25G", role: "STORAGE", up: true },
  { name: "sfp28-2", kind: "sfp28", up: false },
];

/* ───────────────────────────── Simulador ───────────────────────────── */

class NetworkSimulator {
  constructor() {
    this.tick = 0;
    this.phase = 0;
    this.wanDown = false;
    this.baseDown = 156;        // segundos de indisponibilidade já registrados nas últimas 24 h
    this.sessionDown = 0;       // indisponibilidade gerada nesta sessão
    this.uptimeSec = 38 * DAY + 14 * 3600 + 22 * 60 + 7;
    this.cores = [14, 19, 12, 17];
    this.cpu = avg(this.cores);
    this.mem = 42.6;
    this.temp = 49.5;
    this.latency = 12;
    this.jitter = 1.4;
    this.loss = 0;
    this.tr = { wanIn: 640, wanOut: 175, lanIn: 1250, lanOut: 430 };
    this.wan = [];
    this.lan = [];
    this.cpuHist = [];
    this.devices = [];
    this.log = [];
    this.seq = 0;
    this.logSeq = 0;
    this.nextJoin = randInt(4, 6);

    const now = Date.now();
    for (let i = HISTORY; i > 0; i--) {
      this.stepTraffic(now - i * 1000);
      this.stepHardware(false);
    }
    this.seedDevices(now);
  }

  addLog(topic, level, msg, t = Date.now()) {
    this.log = [...this.log, { id: ++this.logSeq, t, topic, level, msg }].slice(-80);
  }

  seedDevices(now) {
    const seeds = [
      ["mobile", 9], ["iot", 16], ["laptop", 24], ["mobile", 33], ["server", 41], ["mobile", 52],
      ["laptop", 63], ["iot", 78], ["mobile", 92], ["laptop", 118], ["server", 174], ["iot", 131],
    ];
    seeds.forEach(([cat, remaining], i) => {
      const d = this.createDevice(cat);
      d.remaining = remaining;
      d.lease = Math.max(remaining + randInt(15, 50), d.lease);
      d.joinedTick = -999;
      this.devices.push(d);
      if (i % 3 === 0) {
        this.addLog("dhcp", "info", `dhcp-lan assigned ${d.ip} for ${d.mac} "${d.name}"`, now - (d.lease - remaining) * 1000);
      }
    });
    this.log.sort((a, b) => a.t - b.t);
    this.addLog("system", "info", "user noc logged in from 10.10.10.5 via winbox", now - 95_000);
    this.addLog("netwatch", "info", "host 8.8.8.8 is up (rtt 12ms)", now - 40_000);
    this.log.sort((a, b) => a.t - b.t);
  }

  freeIp() {
    const used = new Set(this.devices.map((d) => d.ip));
    if (used.size >= POOL_SIZE) return null;
    let ip;
    do ip = POOL.prefix + randInt(POOL.start, POOL.end);
    while (used.has(ip));
    return ip;
  }

  pickCategory() {
    let r = Math.random();
    for (const k of CAT_ORDER) {
      r -= CATS[k].weight;
      if (r <= 0) return k;
    }
    return "mobile";
  }

  createDevice(cat = this.pickCategory()) {
    const used = new Set(this.devices.map((d) => d.name));
    const options = TEMPLATES[cat].filter(([n]) => !used.has(n));
    const [name, icon] = options.length ? pick(options) : [`${pick(TEMPLATES[cat])[0]} (2)`, TEMPLATES[cat][0][1]];
    const lease = randInt(...CATS[cat].lease);
    return {
      id: ++this.seq, name, icon, cat, ip: this.freeIp(), mac: makeMac(cat),
      lease, remaining: lease, status: "bound", joinedTick: this.tick,
    };
  }

  join() {
    if (this.devices.length >= POOL_SIZE) return null;
    const d = this.createDevice();
    this.devices = [...this.devices, d];
    this.addLog("dhcp", "info", `dhcp-lan assigned ${d.ip} for ${d.mac} "${d.name}"`);
    return d;
  }

  renew(id) {
    this.devices = this.devices.map((d) => {
      if (d.id !== id || d.status === "expired") return d;
      this.addLog("dhcp", "info", `dhcp-lan lease renewed ${d.ip} for ${d.mac} (${fmtMMSS(d.lease)})`);
      return { ...d, remaining: d.lease };
    });
  }

  setWanDown(down) {
    if (down === this.wanDown) return;
    this.wanDown = down;
    if (down) {
      this.addLog("interface", "warning", "sfp-sfpplus1 link down");
      this.addLog("netwatch", "critical", "host 8.8.8.8 is down — WAN unreachable");
    } else {
      this.addLog("interface", "info", "sfp-sfpplus1 link up (speed 10G, full duplex)");
      this.addLog("netwatch", "info", "host 8.8.8.8 is up (rtt 13ms)");
    }
  }

  stepTraffic(t) {
    const k = ++this.phase;
    const s = this.tr;
    if (!this.wanDown) {
      const burst = Math.random() < 0.06 ? rand(90, 220) : 0;
      const tIn = 600 + 170 * Math.sin(k / 21) + 60 * Math.sin(k / 7.3) + burst;
      const tOut = 165 + 55 * Math.sin(k / 16 + 1.2) + 20 * Math.sin(k / 5.1);
      s.wanIn = clamp(s.wanIn + 0.4 * (tIn - s.wanIn) + rand(-35, 35), 90, 985);
      s.wanOut = clamp(s.wanOut + 0.4 * (tOut - s.wanOut) + rand(-14, 14), 30, 340);
    } else {
      s.wanIn = Math.max(0, s.wanIn * 0.12 + rand(0, 0.25));
      s.wanOut = Math.max(0, s.wanOut * 0.12 + rand(0, 0.15));
    }
    const internalIn = 520 + 180 * Math.sin(k / 27 + 2) + rand(-40, 40);
    const internalOut = 260 + 90 * Math.sin(k / 19) + rand(-25, 25);
    s.lanIn = clamp(s.lanIn + 0.45 * (s.wanIn * 1.05 + internalIn - s.lanIn), 60, 2450);
    s.lanOut = clamp(s.lanOut + 0.45 * (s.wanOut * 1.08 + internalOut - s.lanOut), 40, 2000);
    this.wan = [...this.wan, { t, in: s.wanIn, out: s.wanOut }].slice(-HISTORY);
    this.lan = [...this.lan, { t, in: s.lanIn, out: s.lanOut }].slice(-HISTORY);
  }

  stepHardware(advanceUptime = true) {
    const load = (this.tr.wanIn + this.tr.lanIn) / 3400;
    this.cores = this.cores.map((c) => {
      const spike = Math.random() < 0.04 ? rand(12, 32) : 0;
      return clamp(c + 0.35 * (6 + load * 46 + rand(-5, 9) - c) + spike, 2, 98);
    });
    this.cpu = avg(this.cores);
    this.mem = clamp(this.mem + rand(-0.22, 0.24), 38, 49);
    this.temp = this.temp + 0.1 * (40 + this.cpu * 0.42 - this.temp) + rand(-0.15, 0.15);
    this.cpuHist = [...this.cpuHist, { i: this.phase, v: this.cpu }].slice(-HISTORY);
    if (advanceUptime) this.uptimeSec += 1;
  }

  stepWanHealth() {
    if (this.wanDown) {
      this.sessionDown += 1;
      this.loss = 100;
      this.latency = null;
      return;
    }
    const load = this.tr.wanIn / 1000;
    const lat = 10.5 + rand(0, 2.6) + (load > 0.75 ? rand(0, 5) : 0);
    this.jitter = 0.7 * this.jitter + 0.3 * Math.abs(lat - (this.latency ?? lat));
    this.latency = lat;
    this.loss = Math.random() < 0.04 ? rand(0.1, 0.5) : 0;
  }

  step() {
    this.tick += 1;
    const events = [];
    this.stepTraffic(Date.now());
    this.stepHardware();
    this.stepWanHealth();

    // Ciclo do lease: decrementa, marca expirado e remove no tick seguinte
    const next = [];
    for (const d of this.devices) {
      if (d.status === "expired") continue;
      const nd = { ...d, remaining: d.remaining - 1 };
      if (nd.remaining <= 0) {
        nd.remaining = 0;
        nd.status = "expired";
        this.addLog("dhcp", "info", `dhcp-lan deassigned ${nd.ip} for ${nd.mac} "${nd.name}" (lease expired)`);
        events.push({ type: "expired", device: nd });
      }
      next.push(nd);
    }
    this.devices = next;

    this.nextJoin -= 1;
    if (this.nextJoin <= 0) {
      const d = this.join();
      if (d) events.push({ type: "joined", device: d });
      this.nextJoin = randInt(5, 10);
    }
    return events;
  }

  snapshot() {
    const down = this.baseDown + this.sessionDown;
    return {
      tick: this.tick,
      now: Date.now(),
      wan: this.wan,
      lan: this.lan,
      tr: { ...this.tr },
      cpu: this.cpu,
      cores: this.cores.slice(),
      mem: this.mem,
      temp: this.temp,
      cpuHist: this.cpuHist,
      uptimeSec: this.uptimeSec,
      wanDown: this.wanDown,
      sessionDown: this.sessionDown,
      latency: this.latency,
      jitter: this.jitter,
      loss: this.loss,
      uptimePct: ((DAY - down) / DAY) * 100,
      devices: this.devices,
      log: this.log,
      nextJoin: this.nextJoin,
    };
  }
}

/* ───────────────────────── Componentes base ───────────────────────── */

function CardHeader({ icon: Icon, title, subtitle, right }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid h-8 w-8 flex-none place-items-center rounded-md border border-line-2 bg-inset text-electric">
          <Icon size={16} strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <h2 className="fm-label text-[13px] font-semibold text-ink">{title}</h2>
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

function Meter({ value, max = 100, warnAt, critAt, label }) {
  const pct = clamp((value / max) * 100, 0, 100);
  const tone = value >= critAt ? "crit" : value >= warnAt ? "warn" : "electric";
  const fill = { electric: "bg-electric", warn: "bg-warn", crit: "bg-crit" }[tone];
  const track = { electric: "bg-electric/15", warn: "bg-warn/15", crit: "bg-crit/15" }[tone];
  return (
    <div className={cx("h-1.5 w-full overflow-hidden rounded-full", track)} role="meter" aria-label={label}
      aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={max}>
      <div className={cx("fm-bar h-full rounded-full", fill)} style={{ width: `${pct}%` }} />
    </div>
  );
}

/* ───────────────────────────── Cabeçalho ───────────────────────────── */

function LiveClock() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="hidden items-center gap-2 rounded-md border border-line bg-inset/70 px-3 py-1.5 sm:flex">
      <Clock size={14} className="text-muted" />
      <span className="fm-mono text-[13px] tabular-nums text-ink">{fmtClock(now)}</span>
      <span className="fm-mono text-[10px] text-muted">BRT</span>
    </div>
  );
}

function Header({ running, onToggle, wanDown }) {
  return (
    <header className="fm-header sticky z-40 border-b border-line bg-bg/80 backdrop-blur-md">
      <div className="fm-gutter mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 py-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-lg border border-electric/40 bg-electric/10 text-electric shadow-[0_0_22px_-4px_rgb(var(--electric)/.6)]">
            <Activity size={22} strokeWidth={2.2} />
          </span>
          <div className="leading-tight">
            <div className="font-display text-[22px] font-bold tracking-tight text-ink">
              Flow<span className="text-electric">Monitor</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={cx("fm-live", running && "is-on")}
                style={{ "--state": running ? (wanDown ? "var(--crit)" : "var(--neon)") : "var(--warn)" }} />
              <span className="fm-label text-[11px] text-ink-2">NOC Real-Time</span>
              {!running && <StatePill tone="warn" icon={Pause}>Pausado</StatePill>}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="hidden items-center gap-2 rounded-md border border-line bg-inset/70 px-3 py-1.5 md:flex">
            <Router size={14} className="text-muted" />
            <span className="fm-mono text-[12px] text-ink-2">FM-EDGE-01</span>
            <span className="fm-mono text-[11px] text-muted">10.10.10.1</span>
          </div>
          <LiveClock />
          <button type="button" onClick={onToggle} aria-pressed={!running}
            className={cx(
              "fm-btn inline-flex items-center gap-2 rounded-md border px-3.5 py-2 text-[13px] font-semibold transition",
              running
                ? "border-electric/50 bg-electric/10 text-electric hover:bg-electric/20 hover:shadow-[0_0_18px_-4px_rgb(var(--electric)/.7)]"
                : "border-neon/50 bg-neon/10 text-neon hover:bg-neon/20 hover:shadow-[0_0_18px_-4px_rgb(var(--neon)/.7)]"
            )}>
            {running ? <Pause size={15} /> : <Play size={15} />}
            {running ? "Pausar Simulação" : "Retomar Simulação"}
          </button>
        </div>
      </div>
    </header>
  );
}

/* ─────────────────────── Card 1 · Status geral ─────────────────────── */

const AVAIL_HISTORY = Array.from({ length: 47 }, (_, i) => (i === 29 ? "down" : i === 12 ? "degraded" : "up"));

function StatusCard({ snap, running, onToggleFailure, activeCount }) {
  const down = snap.wanDown;
  const state = down ? "var(--crit)" : "var(--neon)";
  const current = down ? "down" : snap.sessionDown > 0 ? "degraded" : "up";
  const slots = [...AVAIL_HISTORY, current];
  const slotColor = { up: "bg-neon/70", degraded: "bg-warn", down: "bg-crit" };
  const slotLabel = { up: "Operacional", degraded: "Degradado", down: "Falha" };
  const slotTime = (i) => {
    const end = snap.now - (47 - i) * 1800_000;
    return `${fmtClock(end - 1800_000, false)}–${fmtClock(end, false)}`;
  };

  const stats = [
    { label: "Latência", sub: "ICMP 8.8.8.8", value: down ? "timeout" : `${nf(snap.latency, 1)} ms`, bad: down },
    { label: "Jitter", sub: "média móvel", value: down ? "—" : `${nf(snap.jitter, 1)} ms`, bad: down },
    { label: "Perda", sub: "pacotes", value: `${nf(snap.loss, 1)}%`, bad: snap.loss > 1 },
    { label: "Ativos", sub: "leases DHCP", value: String(activeCount), bad: false },
  ];

  return (
    <section className="fm-card flex flex-col gap-5 p-5 lg:col-span-4" aria-labelledby="status-title">
      <CardHeader icon={Network} title={<span id="status-title">Status geral da rede</span>}
        subtitle="netwatch · wan sfp-sfpplus1 → 8.8.8.8"
        right={down
          ? <StatePill tone="crit" icon={TriangleAlert} blink>Incidente</StatePill>
          : <StatePill tone="neon" icon={CircleCheck}>Normal</StatePill>} />

      <div className="flex items-center gap-4 2xl:gap-5" style={{ "--state": state }}>
        <div className={cx("fm-orb", down && "is-down", !running && "is-paused")} aria-hidden="true">
          {down ? <WifiOff strokeWidth={1.8} /> : <Globe strokeWidth={1.8} />}
        </div>
        <div className="min-w-0" role="status" aria-live="polite">
          <div className={cx("fm-glow-text whitespace-nowrap font-display text-[30px] font-bold leading-none tracking-tight sm:text-[40px] lg:text-[32px] 2xl:text-[42px]", down ? "text-crit" : "text-neon")}>
            {down ? "REDES DOWN" : "REDES UP"}
          </div>
          <p className="mt-2 text-[13px] leading-snug text-ink-2">
            {down
              ? "Sem resposta da WAN. sfp-sfpplus1 sem link; a rede interna segue operando."
              : "Todos os links operacionais. Internet via sfp-sfpplus1 (10G)."}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-line bg-inset/60 p-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className="fm-label text-[11px] text-muted">Uptime · últimas 24 h</div>
            <div className="mt-1 font-display text-[32px] font-semibold leading-none text-ink">
              {nf(snap.uptimePct, 3)}<span className="text-[20px] text-ink-2">%</span>
            </div>
          </div>
          <div className="text-right">
            <div className="fm-mono text-[11px] text-muted">meta SLA 99,500%</div>
            {snap.uptimePct >= 99.5
              ? <StatePill tone="neon" icon={CircleCheck}>Dentro do SLA</StatePill>
              : <StatePill tone="crit" icon={CircleAlert}>Abaixo do SLA</StatePill>}
          </div>
        </div>
        <div className="mt-4 flex h-6 gap-[2px]" role="img"
          aria-label={`Disponibilidade nas últimas 24 horas, em blocos de 30 minutos. Agora: ${slotLabel[current]}.`}>
          {slots.map((s, i) => (
            <span key={i} title={`${slotTime(i)} · ${slotLabel[s]}`}
              className={cx("flex-1 rounded-[2px]", slotColor[s], i === slots.length - 1 && s === "down" && "fm-blink")} />
          ))}
        </div>
        <div className="fm-mono mt-1.5 flex justify-between text-[10px] text-muted">
          <span>−24 h</span>
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

      <button type="button" onClick={onToggleFailure}
        className={cx(
          "fm-btn mt-auto inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-[13px] font-medium transition",
          down ? "border-neon/40 text-neon hover:bg-neon/10" : "border-crit/40 text-crit hover:bg-crit/10"
        )}>
        {down ? <Zap size={15} /> : <Unplug size={15} />}
        {down ? "Restaurar link WAN" : "Simular falha na WAN"}
      </button>
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

function TrafficPanel({ id, title, iface, note, data, max, ticks, capacity, down }) {
  const last = data[data.length - 1] || { in: 0, out: 0 };
  const peakIn = Math.max(...data.map((d) => d.in));
  const avgIn = avg(data.map((d) => d.in));
  const series = [
    { key: "in", name: "Download (In)", color: C.in, value: last.in, Icon: ArrowDown },
    { key: "out", name: "Upload (Out)", color: C.out, value: last.out, Icon: ArrowUp },
  ];
  return (
    <div className="min-w-0 rounded-lg border border-line bg-inset/50 p-3.5 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="fm-label text-[12px] font-semibold text-ink">{title}</span>
            <span className="fm-mono rounded border border-line-2 px-1.5 py-px text-[10px] text-ink-2">{iface}</span>
            {down && <StatePill tone="crit" icon={CircleAlert} blink>sem link</StatePill>}
          </div>
          <div className="fm-mono mt-0.5 text-[10px] text-muted">{note} · pico ↓ {fmtRate(peakIn)} · média ↓ {fmtRate(avgIn)}</div>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1">
          {series.map((s) => (
            <div key={s.key} className="flex items-center gap-2">
              <span className="h-[3px] w-4 rounded-full" style={{ background: s.color }} />
              <s.Icon size={13} className="text-muted" />
              <span className="text-[12px] text-ink-2">{s.name}</span>
              <span className="fm-mono min-w-[84px] text-right text-[14px] font-semibold tabular-nums text-ink">{fmtRate(s.value)}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 h-[150px] sm:h-[164px]">
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
              tick={{ fill: C.muted, fontSize: 10, fontFamily: "JetBrains Mono, monospace" }}
              axisLine={{ stroke: C.axis }} tickLine={false} />
            <YAxis domain={[0, max]} ticks={ticks} tickFormatter={fmtTick} width={40}
              tick={{ fill: C.muted, fontSize: 10, fontFamily: "JetBrains Mono, monospace" }}
              axisLine={false} tickLine={false} />
            {capacity && (
              <ReferenceLine y={capacity.value} stroke={C.muted} strokeOpacity={0.55}
                label={{ value: capacity.label, position: "insideTopRight", fill: C.muted, fontSize: 10, fontFamily: "JetBrains Mono, monospace" }} />
            )}
            <Tooltip content={<TrafficTooltip />} cursor={{ stroke: C.axis, strokeWidth: 1 }} isAnimationActive={false} />
            <Area type="monotone" dataKey="in" name="Download (In)" stroke={C.in} strokeWidth={2}
              fill={`url(#${id}-in)`} isAnimationActive={false}
              dot={(p) => <EndDot key={`in-${p.index}`} {...p} dataLength={data.length} color={C.in} />}
              activeDot={{ r: 4, fill: C.in, stroke: C.panel, strokeWidth: 2 }} />
            <Area type="monotone" dataKey="out" name="Upload (Out)" stroke={C.out} strokeWidth={2}
              fill={`url(#${id}-out)`} isAnimationActive={false}
              dot={(p) => <EndDot key={`out-${p.index}`} {...p} dataLength={data.length} color={C.out} />}
              activeDot={{ r: 4, fill: C.out, stroke: C.panel, strokeWidth: 2 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function TrafficCard({ snap }) {
  const total = snap.tr.wanIn + snap.tr.wanOut;
  return (
    <section className="fm-card flex min-w-0 flex-col gap-4 p-5 lg:col-span-8" aria-labelledby="traffic-title">
      <CardHeader icon={Activity} title={<span id="traffic-title">Tráfego de dados em tempo real</span>}
        subtitle="janela 60 s · amostragem 1 s · /interface monitor-traffic"
        right={
          <div className="text-right">
            <div className="fm-label text-[10px] text-muted">Throughput WAN</div>
            <div className="fm-mono text-[16px] font-semibold tabular-nums text-ink">{fmtRate(total)}</div>
          </div>
        } />
      <TrafficPanel id="wan" title="WAN · Internet" iface="sfp-sfpplus1" note="plano 1 Gbps"
        data={snap.wan} max={1100} ticks={[0, 250, 500, 750, 1000]}
        capacity={{ value: 1000, label: "plano 1 Gbps" }} down={snap.wanDown} />
      <TrafficPanel id="lan" title="LAN · Rede interna" iface="bridge-lan" note="10.10.20.0/24"
        data={snap.lan} max={2500} ticks={[0, 500, 1000, 1500, 2000, 2500]} />
    </section>
  );
}

/* ───────────────────── Card 3 · Equipamento ativo ───────────────────── */

function Faceplate({ ports, selected, onSelect }) {
  const port = (p, w, h) => {
    const fail = p.wan && !p.up;
    return (
      <button key={p.name} type="button" onMouseEnter={() => onSelect(p.name)} onFocus={() => onSelect(p.name)}
        onClick={() => onSelect(p.name)} aria-label={`${p.name}: ${p.up ? "ativa" : "inativa"}`}
        className={cx("fm-port", selected === p.name && "is-selected")} style={{ width: w, height: h }}>
        <span className={cx("fm-led", p.up && "up", p.up && "act", fail && "fail")}
          style={p.up ? { animationDelay: `${(p.name.length * 0.37) % 1.3}s` } : undefined} />
      </button>
    );
  };
  const eth = ports.find((p) => p.kind === "rj45");
  const sfp = ports.filter((p) => p.kind === "sfp");
  const top = sfp.filter((_, i) => i % 2 === 0);
  const bottom = sfp.filter((_, i) => i % 2 === 1);
  const s28 = ports.filter((p) => p.kind === "sfp28");
  return (
    <div className="overflow-x-auto fm-scroll">
      <div className="inline-flex min-w-full items-center gap-3 rounded-md border border-line-2 bg-[linear-gradient(180deg,#121c2e,#0b1220)] px-3 py-2.5 shadow-[inset_0_1px_0_rgb(255_255_255/.05)]">
        <div className="flex flex-col items-center gap-1">
          <span className="fm-mono text-[8px] text-muted">ETH</span>
          {port(eth, 24, 20)}
        </div>
        <div className="h-10 w-px bg-line-2" />
        <div className="flex flex-col gap-1.5">
          <div className="flex gap-1">{top.map((p) => port(p, 26, 16))}</div>
          <div className="flex gap-1">{bottom.map((p) => port(p, 26, 16))}</div>
        </div>
        <div className="h-10 w-px bg-line-2" />
        <div className="flex flex-col gap-1.5">{s28.map((p) => port(p, 26, 16))}</div>
        <div className="ml-auto hidden flex-col items-end sm:flex">
          <span className="font-display text-[11px] font-semibold tracking-wider text-ink-2">CCR2004</span>
          <span className="fm-mono text-[8px] text-muted">1G-12S+2XS</span>
        </div>
      </div>
    </div>
  );
}

function EquipmentCard({ snap }) {
  const [selected, setSelected] = useState("sfp-sfpplus1");
  const ports = useMemo(
    () => PORTS.map((p) => (p.wan ? { ...p, up: !snap.wanDown } : p)),
    [snap.wanDown]
  );
  const active = ports.filter((p) => p.up).length;
  const sel = ports.find((p) => p.name === selected) || ports[1];
  const memUsed = (snap.mem / 100) * 4;
  const selTraffic = sel.wan
    ? `↓ ${fmtRate(snap.tr.wanIn)} · ↑ ${fmtRate(snap.tr.wanOut)}`
    : sel.name === "sfp-sfpplus2" ? `↓ ${fmtRate(snap.tr.lanIn * 0.62)} · ↑ ${fmtRate(snap.tr.lanOut * 0.6)}` : null;

  const small = [
    {
      key: "mem", icon: MemoryStick, label: "Memória", value: `${nf(snap.mem, 1)}%`, sub: `${nf(memUsed, 2)} / 4,00 GiB`,
      meter: <Meter value={snap.mem} warnAt={80} critAt={92} label="Uso de memória" />,
    },
    {
      key: "temp", icon: Thermometer, label: "Temperatura", value: `${nf(snap.temp, 0)} °C`, sub: "cpu-temperature · alerta 70 °C",
      meter: <Meter value={snap.temp} max={90} warnAt={70} critAt={80} label="Temperatura" />,
    },
  ];
  const MetricHead = ({ icon: Icon, label }) => (
    <span className="flex items-center gap-1.5 text-ink-2"><Icon size={14} /><span className="fm-label text-[11px]">{label}</span></span>
  );

  return (
    <section className="fm-card flex flex-col gap-4 p-5" aria-labelledby="equip-title">
      <CardHeader icon={Router} title={<span id="equip-title">Equipamento ativo</span>}
        subtitle="FM-EDGE-01 · roteador de borda"
        right={<StatePill tone="neon" icon={CircleCheck}>Online</StatePill>} />

      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <div className="fm-label text-[10px] text-muted">MikroTik Cloud Core Router</div>
          <div className="font-display text-[24px] font-semibold leading-tight text-ink">CCR2004-1G-12S+2XS</div>
          <div className="fm-mono mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted">
            <span>RouterOS 7.16.2 (stable)</span><span>arm64</span><span>4 GiB RAM</span>
          </div>
        </div>
        <div className="text-right">
          <div className="flex items-center justify-end gap-1.5 text-ink-2"><Timer size={13} /><span className="fm-label text-[10px]">Tempo ligado</span></div>
          <div className="fm-mono text-[18px] font-semibold tabular-nums text-ink">{fmtUptime(snap.uptimeSec)}</div>
        </div>
      </div>

      <div className="rounded-lg border border-line bg-inset/60 p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <MetricHead icon={Cpu} label="CPU" />
            <div className="fm-mono mt-1 text-[20px] font-semibold tabular-nums text-ink">{nf(snap.cpu, 0)}%</div>
          </div>
          <span className="fm-mono text-[10px] text-muted">4 núcleos ARM64 · 1,7 GHz</span>
        </div>
        <div className="mt-2"><Meter value={snap.cpu} warnAt={70} critAt={90} label="Uso de CPU" /></div>
        <div className="mt-3 grid grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] gap-4">
          <div className="flex items-end gap-1.5" aria-label="Uso por núcleo">
            {snap.cores.map((c, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <div className="relative h-10 w-full overflow-hidden rounded-sm bg-electric/10">
                  <div className="absolute bottom-0 left-0 right-0 rounded-sm bg-electric/80" style={{ height: `${c}%`, transition: "height 1s linear" }} />
                </div>
                <span className="fm-mono text-[9px] text-muted">cpu{i}</span>
              </div>
            ))}
          </div>
          <div className="min-w-0">
            <div className="h-10">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={snap.cpuHist} margin={{ top: 2, right: 2, left: 2, bottom: 0 }}>
                  <YAxis domain={[0, 100]} hide />
                  <Area type="monotone" dataKey="v" stroke={C.electric} strokeWidth={1.5} fill={C.electric} fillOpacity={0.1}
                    isAnimationActive={false}
                    dot={(p) => <EndDot key={`cpu-${p.index}`} {...p} dataLength={snap.cpuHist.length} color={C.electric} />} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="fm-mono mt-1 text-[9px] text-muted">histórico · 60 s</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {small.map((m) => (
          <div key={m.key} className="rounded-lg border border-line bg-inset/60 p-3">
            <MetricHead icon={m.icon} label={m.label} />
            <div className="fm-mono mt-1 text-[20px] font-semibold tabular-nums text-ink">{m.value}</div>
            <div className="fm-mono mb-2 truncate text-[10px] text-muted">{m.sub}</div>
            {m.meter}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="fm-label text-[11px] text-ink-2">Interfaces físicas</span>
          <div className="flex gap-2">
            <StatePill tone="neon">{active} ativas</StatePill>
            <StatePill tone="muted">{ports.length - active} inativas</StatePill>
          </div>
        </div>
        <Faceplate ports={ports} selected={selected} onSelect={setSelected} />
        <div className="fm-mono flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-line bg-inset/50 px-3 py-2 text-[11px]">
          <span className={cx("h-2 w-2 rounded-full", sel.up ? "bg-neon shadow-[0_0_6px_rgb(var(--neon))]" : sel.wan ? "bg-crit" : "bg-line-2")} />
          <span className="text-ink">{sel.name}</span>
          {sel.role && <span className="text-electric">{sel.role}</span>}
          <span className="text-ink-2">{sel.up ? `link up · ${sel.speed} full-duplex` : sel.wan ? "link down · sem sinal óptico" : "sem link"}</span>
          {sel.up && selTraffic && <span className="text-muted">{selTraffic}</span>}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Log do sistema ───────────────────────── */

function LogCard({ log }) {
  const ref = useRef(null);
  const stick = useRef(true);
  useEffect(() => {
    const el = ref.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [log]);
  const tone = { info: "text-electric", warning: "text-warn", critical: "text-crit" };
  return (
    <section className="fm-card flex flex-col gap-3 p-5" aria-labelledby="log-title">
      <CardHeader icon={Terminal} title={<span id="log-title">Log do sistema</span>} subtitle="/log print follow" />
      <div ref={ref} onScroll={(e) => {
        const el = e.currentTarget;
        stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
      }}
        className="fm-scroll fm-mono h-[208px] overflow-auto rounded-md border border-line bg-[#050911] px-3 py-2 text-[11px] leading-[1.7]"
        role="log" aria-live="off">
        {log.map((l) => (
          <div key={l.id} className="whitespace-nowrap">
            <span className="text-muted">{fmtClock(l.t)}</span>{" "}
            <span className={cx(tone[l.level] || "text-ink-2")}>{l.topic},{l.level}</span>{" "}
            <span className={cx(l.level === "critical" ? "text-crit" : "text-ink-2")}>{l.msg}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ──────────────── Card 4 · Dispositivos conectados + DHCP ──────────────── */

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
      <div className="fm-mono mt-1 text-[11px] text-muted">{total ? nf((p.value / total) * 100, 0) : 0}% dos ativos</div>
    </div>
  );
}

function DeviceRow({ d, isNew, onRenew }) {
  const cat = CATS[d.cat];
  const Icon = ICONS[d.icon] || Smartphone;
  const st = leaseState(d);
  const pct = d.lease ? (d.remaining / d.lease) * 100 : 0;
  const bar = { active: "bg-neon", expiring: "bg-warn", expired: "bg-crit" }[st];
  return (
    <tr className={cx("fm-row", isNew && "fm-row-in", st === "expired" && "fm-row-out")}>
      <td className="py-2.5 pl-4 pr-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-7 w-7 flex-none place-items-center rounded-md border border-line-2 bg-inset" style={{ color: cat.color }}>
            <Icon size={14} />
          </span>
          <div className="min-w-0">
            <div className="max-w-[190px] truncate text-[13px] font-medium text-ink" title={d.name}>{d.name}</div>
            <div className="text-[11px] text-muted">{cat.label}</div>
          </div>
        </div>
      </td>
      <td className="px-3">
        <div className="fm-mono text-[12px] tabular-nums text-ink">{d.ip}</div>
        <div className="fm-mono text-[10px] text-muted">{d.mac}</div>
      </td>
      <td className="px-3">
        <div className="flex items-center gap-2.5">
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-line" role="progressbar"
            aria-label={`Lease restante de ${d.name}`} aria-valuenow={d.remaining} aria-valuemin={0} aria-valuemax={d.lease}>
            <div className={cx("fm-bar h-full rounded-full", bar)} style={{ width: `${pct}%` }} />
          </div>
          <span className={cx("fm-mono w-11 text-[12px] font-medium tabular-nums",
            st === "expiring" ? "text-warn" : st === "expired" ? "text-crit" : "text-ink")}>{fmtMMSS(d.remaining)}</span>
        </div>
        <div className="fm-mono mt-0.5 text-[10px] text-muted">lease {fmtMMSS(d.lease)}</div>
      </td>
      <td className="px-3">
        {st === "active" && <StatePill tone="neon" icon={CircleCheck}>Ativo</StatePill>}
        {st === "expiring" && <StatePill tone="warn" icon={Hourglass}>Expirando</StatePill>}
        {st === "expired" && <StatePill tone="crit" icon={CircleAlert}>Expirado</StatePill>}
      </td>
      <td className="pl-2 pr-4 text-right">
        <button type="button" onClick={() => onRenew(d.id)} disabled={st === "expired"}
          aria-label={`Renovar lease de ${d.name}`} title="Renovar lease"
          className="fm-btn grid h-7 w-7 place-items-center rounded-md border border-line-2 text-ink-2 transition hover:border-electric/60 hover:text-electric disabled:opacity-30">
          <RefreshCw size={13} />
        </button>
      </td>
    </tr>
  );
}

function DevicesCard({ snap, onRenew }) {
  const live = snap.devices.filter((d) => d.status !== "expired");
  const total = live.length;
  const expiring = live.filter((d) => leaseState(d) === "expiring").length;
  const pie = CAT_ORDER.map((k) => ({ key: k, label: CATS[k].label, color: CATS[k].color, value: live.filter((d) => d.cat === k).length }));
  const rows = [...snap.devices].sort((a, b) => a.remaining - b.remaining || a.id - b.id);

  return (
    <section className="fm-card flex min-w-0 flex-col gap-4 p-5" aria-labelledby="dev-title">
      <CardHeader icon={Smartphone} title={<span id="dev-title">Dispositivos conectados</span>}
        subtitle="dhcp-lan · pool 10.10.20.100–250 · /ip dhcp-server lease"
        right={<StatePill tone="electric" icon={Timer}>próxima concessão em ~{Math.max(snap.nextJoin, 0)} s</StatePill>} />

      <div className="grid grid-cols-1 items-center gap-5 md:grid-cols-[220px_1fr]">
        <div className="relative mx-auto h-[200px] w-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={pie} dataKey="value" nameKey="label" innerRadius="66%" outerRadius="96%"
                paddingAngle={total > 1 ? 2 : 0} startAngle={90} endAngle={-270} stroke={C.panel} strokeWidth={2}
                isAnimationActive={false}>
                {pie.map((p) => <Cell key={p.key} fill={p.color} />)}
              </Pie>
              <Tooltip content={<PieTooltip total={total} />} isAnimationActive={false} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
            <div>
              <div key={total} className="fm-bump font-display text-[40px] font-bold leading-none text-ink">{total}</div>
              <div className="fm-label mt-1 text-[10px] text-muted">ativos</div>
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
              <dt className="fm-label text-[10px] text-muted">Leases ativos</dt>
              <dd className="fm-mono mt-0.5 text-[18px] font-semibold tabular-nums text-ink">{total}</dd>
            </div>
            <div className="bg-panel px-3 py-2.5">
              <dt className="fm-label text-[10px] text-muted">Expirando</dt>
              <dd className={cx("fm-mono mt-0.5 text-[18px] font-semibold tabular-nums", expiring ? "text-warn" : "text-ink")}>{expiring}</dd>
            </div>
            <div className="bg-panel px-3 py-2.5">
              <dt className="fm-label text-[10px] text-muted">Uso do pool</dt>
              <dd className="fm-mono mt-0.5 text-[18px] font-semibold tabular-nums text-ink">
                {nf((total / POOL_SIZE) * 100, 1)}<span className="text-[12px] text-muted">% · {total}/{POOL_SIZE}</span>
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="fm-scroll max-h-[440px] min-w-0 overflow-auto rounded-lg border border-line">
        <table className="w-full min-w-[620px] border-collapse text-left">
          <caption className="sr-only">Leases DHCP ativos, ordenados pelo tempo restante</caption>
          <thead className="sticky top-0 z-10 bg-inset">
            <tr className="fm-label text-[10px] text-muted">
              <th scope="col" className="py-2 pl-4 pr-3 font-medium">Dispositivo</th>
              <th scope="col" className="px-3 font-medium">IP · MAC</th>
              <th scope="col" className="px-3 font-medium">Lease restante</th>
              <th scope="col" className="px-3 font-medium">Status</th>
              <th scope="col" className="pl-2 pr-4 text-right font-medium"><span className="sr-only">Ações</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-[13px] text-muted">
                Nenhum lease ativo. Aguardando novas concessões DHCP…
              </td></tr>
            )}
            {rows.map((d) => (
              <DeviceRow key={d.id} d={d} isNew={snap.tick - d.joinedTick < 3} onRenew={onRenew} />
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] leading-relaxed text-muted">
        Leases encurtados (45 s a 4 min) para o ciclo ficar visível. Ao zerar, o IP é liberado e o dispositivo sai da lista.
      </p>
    </section>
  );
}

/* ───────────────────────────── Toasts ───────────────────────────── */

const TOAST_MS = 5000;

function Toast({ t, onDismiss }) {
  useEffect(() => {
    const id = setTimeout(() => onDismiss(t.id), TOAST_MS);
    return () => clearTimeout(id);
  }, [t.id, onDismiss]);
  const tone = {
    join: { ring: "border-electric/40", icon: "text-electric bg-electric/10", bar: "bg-electric" },
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
        <button type="button" onClick={() => onDismiss(t.id)} aria-label="Fechar notificação"
          className="fm-btn -mr-1 -mt-1 grid h-7 w-7 place-items-center rounded-md text-muted hover:text-ink">
          <X size={14} />
        </button>
      </div>
      <div className={cx("fm-toast-timer h-0.5 opacity-70", tone.bar)} style={{ animationDuration: `${TOAST_MS}ms` }} />
    </div>
  );
}

/* ─────────────────────────────── App ─────────────────────────────── */

let toastSeq = 0;

export default function FlowMonitor() {
  const simRef = useRef(null);
  if (!simRef.current) simRef.current = new NetworkSimulator();
  const sim = simRef.current;

  const [snap, setSnap] = useState(() => sim.snapshot());
  const [running, setRunning] = useState(true);
  const [toasts, setToasts] = useState([]);

  const pushToast = useCallback((t) => {
    const id = ++toastSeq;
    setToasts((ts) => [...ts, { id, ...t }].slice(-4));
  }, []);
  const dismissToast = useCallback((id) => setToasts((ts) => ts.filter((t) => t.id !== id)), []);

  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => {
      const events = sim.step();
      setSnap(sim.snapshot());
      events.forEach((e) => {
        if (e.type === "joined") {
          const d = e.device;
          const Icon = ICONS[d.icon] || Smartphone;
          pushToast({
            tone: "join", icon: Icon, title: "Novo dispositivo conectado na rede",
            body: `${d.name} · ${CATS[d.cat].label}`, meta: `${d.ip} · ${d.mac} · lease ${fmtMMSS(d.lease)}`,
          });
        }
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running, sim, pushToast]);

  const toggleFailure = useCallback(() => {
    const down = !sim.wanDown;
    sim.setWanDown(down);
    setSnap(sim.snapshot());
    pushToast(down
      ? { tone: "crit", icon: WifiOff, title: "REDES DOWN · falha na WAN", body: "sfp-sfpplus1 sem link. 8.8.8.8 não responde.", meta: "netwatch,critical" }
      : { tone: "ok", icon: Globe, title: "Link WAN restabelecido", body: "sfp-sfpplus1 up (10G, full-duplex).", meta: "netwatch,info" });
  }, [sim, pushToast]);

  const renew = useCallback((id) => {
    sim.renew(id);
    setSnap(sim.snapshot());
  }, [sim]);

  const activeCount = snap.devices.filter((d) => d.status !== "expired").length;

  return (
    <div className="fm-app text-ink">
      <style>{GLOBAL_CSS}</style>
      <Header running={running} onToggle={() => setRunning((r) => !r)} wanDown={snap.wanDown} />

      <main className="fm-gutter mx-auto max-w-[1600px]" style={{ paddingBlock: 20 }}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <StatusCard snap={snap} running={running} onToggleFailure={toggleFailure} activeCount={activeCount} />
          <TrafficCard snap={snap} />
          <div className="flex min-w-0 flex-col gap-4 lg:col-span-5">
            <EquipmentCard snap={snap} />
            <LogCard log={snap.log} />
          </div>
          <div className="min-w-0 lg:col-span-7">
            <DevicesCard snap={snap} onRenew={renew} />
          </div>
        </div>
        <footer className="fm-mono mt-6 flex flex-wrap justify-between gap-2 text-[11px] text-muted">
          <span>FlowMonitor · dados simulados no navegador, nenhum equipamento real é consultado.</span>
          <span>tick #{snap.tick} · atualização 1 s</span>
        </footer>
      </main>

      <div className="fm-toasts" aria-live="polite">
        {toasts.map((t) => <Toast key={t.id} t={t} onDismiss={dismissToast} />)}
      </div>
    </div>
  );
}
