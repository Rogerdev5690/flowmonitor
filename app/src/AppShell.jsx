/**
 * Casca do app Android: escolhe entre o painel ao vivo (lê o flowmonitor.py do PC)
 * e a simulação, e guarda a escolha no aparelho.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Activity, CircleAlert, CircleCheck, Loader2, MonitorSmartphone, Router, Wifi } from "lucide-react";
import FlowMonitor from "../../simulador/FlowMonitor.jsx";
import FlowMonitorLive from "../../live/src/FlowMonitorLive.jsx";

const STORE_KEY = "flowmonitor.app.config.v1";
const DEFAULT_PORT = 8080;

const cx = (...c) => c.filter(Boolean).join(" ");

function loadConfig() {
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveConfig(cfg) {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(cfg));
  } catch {
    /* sem armazenamento: a escolha vale só até fechar o app */
  }
}

/** "192.168.100.112" → "http://192.168.100.112:8080" */
export function normalizeServer(input) {
  let s = String(input || "").trim().replace(/\s+/g, "");
  if (!s) return "";
  if (!/^https?:\/\//i.test(s)) s = `http://${s}`;
  try {
    const u = new URL(s);
    if (!u.hostname) return "";
    if (!u.port) u.port = String(DEFAULT_PORT);
    return `${u.protocol}//${u.hostname}:${u.port}`;
  } catch {
    return "";
  }
}

async function testServer(base) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  const t0 = performance.now();
  try {
    const res = await fetch(`${base}/api/health`, { cache: "no-store", signal: ctrl.signal });
    const ms = Math.round(performance.now() - t0);
    if (!res.ok) return { ok: false, msg: `O endereço respondeu HTTP ${res.status}, mas não parece ser o FlowMonitor.` };
    let info = {};
    try { info = await res.json(); } catch { /* resposta antiga {"ok":true} */ }
    if (info.ok !== true) return { ok: false, msg: "O endereço respondeu, mas não parece ser o FlowMonitor." };
    const router = info.router ? ` · ${info.router}` : "";
    const ha = info.haOk === false ? " O Home Assistant não está respondendo no PC." : "";
    return { ok: true, msg: `FlowMonitor respondeu em ${ms} ms${router}.${ha}` };
  } catch (e) {
    if (e && e.name === "AbortError") {
      return { ok: false, msg: "Sem resposta em 5 s. O celular está no Wi-Fi de casa? O firewall do Windows liberou a porta 8080?" };
    }
    return { ok: false, msg: "Não consegui conectar. Confira o IP do PC e se o FlowMonitor está aberto com acesso pela rede liberado." };
  } finally {
    clearTimeout(timer);
  }
}

const SHELL_CSS = `
:root{--bg:6 11 22;--panel:12 20 36;--inset:16 26 46;--line:27 40 64;--line-2:38 54 79;--ink:226 234 245;--ink-2:154 171 194;--muted:106 124 149;
  --electric:56 163 255;--neon:44 245 155;--warn:255 197 61;--crit:255 77 94;color-scheme:dark}
body{background:rgb(var(--bg));color:rgb(var(--ink));font-family:"IBM Plex Sans",ui-sans-serif,system-ui,sans-serif}
.fs-wrap{min-height:100vh;background:radial-gradient(900px 500px at 10% -10%, rgb(var(--electric) / .09), transparent 60%),
  linear-gradient(rgb(var(--line) / .22) 1px, transparent 1px) 0 0 / 100% 40px,
  linear-gradient(90deg, rgb(var(--line) / .22) 1px, transparent 1px) 0 0 / 40px 100%, rgb(var(--bg));
  padding:max(20px, env(safe-area-inset-top, 0px)) max(16px, env(safe-area-inset-right, 0px)) max(24px, env(safe-area-inset-bottom, 0px)) max(16px, env(safe-area-inset-left, 0px))}
.fs-label{font-family:"Chakra Petch",ui-sans-serif,system-ui,sans-serif;text-transform:uppercase;letter-spacing:.09em}
.fs-mono{font-family:"JetBrains Mono",ui-monospace,Menlo,monospace}
.fs-card{background:rgb(var(--panel));border:1px solid rgb(var(--line));border-radius:12px}
.fs-input{background:#000;color:rgb(var(--neon));caret-color:rgb(var(--neon));border:1px solid rgb(var(--line-2))}
.fs-input:focus{outline:none;border-color:rgb(var(--electric));box-shadow:0 0 0 3px rgb(var(--electric) / .2)}
.fs-btn:focus-visible{outline:2px solid rgb(var(--electric));outline-offset:2px}
.fs-spin{animation:fs-spin 1s linear infinite}@keyframes fs-spin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion: reduce){.fs-spin{animation:none}}
`;

function ModeOption({ id, checked, onChange, Icon, title, text }) {
  return (
    <label htmlFor={id}
      className={cx("fs-card flex cursor-pointer items-start gap-3 p-4 transition",
        checked ? "border-electric/70 bg-electric/[.07] shadow-[0_0_24px_-10px_rgb(var(--electric))]" : "hover:border-line-2")}>
      <input id={id} type="radio" name="fm-mode" checked={checked} onChange={onChange} className="mt-1 h-4 w-4 accent-[rgb(56,163,255)]" />
      <span className={cx("grid h-9 w-9 flex-none place-items-center rounded-md border", checked ? "border-electric/50 text-electric" : "border-line-2 text-ink-2")}>
        <Icon size={18} />
      </span>
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold text-ink">{title}</span>
        <span className="mt-0.5 block text-[13px] leading-snug text-ink-2">{text}</span>
      </span>
    </label>
  );
}

function Setup({ initial, onSave, onCancel }) {
  const [mode, setMode] = useState(initial?.mode || "live");
  const [server, setServer] = useState(initial?.server ? initial.server.replace(/^http:\/\//, "") : "");
  const [test, setTest] = useState(null); // {state: 'running'|'ok'|'fail', msg}
  const [error, setError] = useState("");
  const inputRef = useRef(null);
  const base = normalizeServer(server);

  const runTest = useCallback(async () => {
    if (!base) {
      setError("Digite o IP do PC, por exemplo 192.168.100.112.");
      inputRef.current?.focus();
      return;
    }
    setError("");
    setTest({ state: "running", msg: `Testando ${base.replace(/^http:\/\//, "")}…` });
    const r = await testServer(base);
    setTest({ state: r.ok ? "ok" : "fail", msg: r.msg });
  }, [base]);

  const save = () => {
    if (mode === "live" && !base) {
      setError("Digite o IP do PC, por exemplo 192.168.100.112.");
      inputRef.current?.focus();
      return;
    }
    onSave({ mode, server: base });
  };

  return (
    <div className="fs-wrap">
      <style>{SHELL_CSS}</style>
      <main className="mx-auto flex max-w-[520px] flex-col gap-5">
        <header className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-lg border border-electric/40 bg-electric/10 text-electric shadow-[0_0_22px_-4px_rgb(var(--electric)/.6)]">
            <Activity size={24} strokeWidth={2.2} />
          </span>
          <div className="leading-tight">
            <div className="font-display text-[24px] font-bold tracking-tight text-ink">Flow<span className="text-electric">Monitor</span></div>
            <div className="fs-label text-[11px] text-ink-2">Conexão do app</div>
          </div>
        </header>

        <fieldset className="flex flex-col gap-3">
          <legend className="fs-label mb-2 text-[11px] text-muted">De onde vêm os dados</legend>
          <ModeOption id="fm-mode-live" checked={mode === "live"} onChange={() => setMode("live")} Icon={Router}
            title="Minha rede (ao vivo)" text="Lê o FlowMonitor que roda no seu PC: roteador, tráfego e dispositivos reais." />
          <ModeOption id="fm-mode-sim" checked={mode === "sim"} onChange={() => setMode("sim")} Icon={MonitorSmartphone}
            title="Simulação" text="Painel de demonstração com dados simulados. Funciona sem rede." />
        </fieldset>

        {mode === "live" && (
          <section className="fs-card flex flex-col gap-3 p-4" aria-labelledby="fm-server-label">
            <label id="fm-server-label" htmlFor="fm-server" className="fs-label text-[11px] text-ink-2">Endereço do PC</label>
            <input id="fm-server" ref={inputRef} value={server}
              onChange={(e) => { setServer(e.target.value); setTest(null); setError(""); }}
              placeholder="192.168.100.112:8080" inputMode="url" autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false}
              enterKeyHint="done" aria-invalid={!!error} aria-describedby="fm-server-help"
              className="fs-input fs-mono h-12 w-full rounded-md px-3 text-[16px]" />
            {error && <p className="text-[13px] text-crit">{error}</p>}
            <p id="fm-server-help" className="text-[12.5px] leading-relaxed text-muted">
              Use o IP do PC na rede de casa. A porta padrão é <span className="fs-mono text-ink-2">8080</span> e não precisa ser digitada.
              Fora de casa, use o IP do PC no Tailscale (começa com <span className="fs-mono text-ink-2">100.</span>).
            </p>

            <button type="button" onClick={runTest} disabled={test?.state === "running"}
              className="fs-btn inline-flex h-11 items-center justify-center gap-2 rounded-md border border-electric/50 bg-electric/10 text-[14px] font-semibold text-electric transition hover:bg-electric/20 disabled:opacity-60">
              {test?.state === "running" ? <Loader2 size={16} className="fs-spin" /> : <Wifi size={16} />}
              Testar conexão
            </button>

            {test && test.state !== "running" && (
              <div role="status" className={cx("flex items-start gap-2.5 rounded-md border px-3 py-2.5 text-[13px] leading-snug",
                test.state === "ok" ? "border-neon/40 bg-neon/10 text-ink" : "border-crit/40 bg-crit/10 text-ink")}>
                {test.state === "ok"
                  ? <CircleCheck size={16} className="mt-0.5 flex-none text-neon" />
                  : <CircleAlert size={16} className="mt-0.5 flex-none text-crit" />}
                <span>{test.msg}</span>
              </div>
            )}
            {test?.state === "running" && <p role="status" className="fs-mono text-[12px] text-muted">{test.msg}</p>}
          </section>
        )}

        <div className="flex flex-col gap-2.5">
          <button type="button" onClick={save}
            className="fs-btn h-12 rounded-md border border-neon/60 bg-neon/10 text-[15px] font-semibold text-neon transition hover:bg-neon/20">
            {mode === "live" ? "Salvar e abrir painel ao vivo" : "Abrir simulação"}
          </button>
          {onCancel && (
            <button type="button" onClick={onCancel}
              className="fs-btn h-11 rounded-md border border-line-2 text-[14px] text-ink-2 transition hover:text-ink">
              Voltar sem alterar
            </button>
          )}
        </div>

        <details className="fs-card p-4 text-[13px] leading-relaxed text-ink-2">
          <summary className="cursor-pointer font-semibold text-ink">Como liberar o acesso no PC</summary>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5">
            <li>Atualize o <span className="fs-mono">flowmonitor.py</span> para a versão do GitHub.</li>
            <li>No PowerShell: <span className="fs-mono text-ink">setx FLOWMONITOR_BIND 0.0.0.0</span></li>
            <li>Libere a porta 8080 no firewall do Windows para a rede local.</li>
            <li>Reinicie o FlowMonitor. O endereço para o celular aparece no terminal.</li>
          </ol>
        </details>
      </main>
    </div>
  );
}

export default function AppShell() {
  const [cfg, setCfg] = useState(() => loadConfig());
  const [editing, setEditing] = useState(() => !loadConfig());

  // Botão "voltar" do Android fecha a tela de ajustes antes de sair do app.
  useEffect(() => {
    if (!editing || !cfg) return undefined;
    window.history.pushState({ fmSetup: true }, "");
    const onPop = () => setEditing(false);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [editing, cfg]);

  if (editing || !cfg) {
    return (
      <Setup initial={cfg}
        onSave={(next) => { saveConfig(next); setCfg(next); setEditing(false); }}
        onCancel={cfg ? () => setEditing(false) : null} />
    );
  }
  const openSettings = () => setEditing(true);
  return cfg.mode === "live"
    ? <FlowMonitorLive key={cfg.server} apiBase={cfg.server} onSettings={openSettings} />
    : <FlowMonitor onSettings={openSettings} />;
}
