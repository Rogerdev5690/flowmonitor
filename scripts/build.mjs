// Gera os HTML autocontidos a partir dos componentes React.
//   simulador/main.jsx  →  simulador/index.html   (dados simulados)
//   live/src/main.jsx   →  live/dashboard.html    (dados reais via flowmonitor.py)
//
// React, Recharts, lucide-react e Tailwind vêm de CDN; o esbuild só compila o JSX
// e troca os imports pelos globais dos builds UMD.
import * as esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const GLOBALS = {
  react: "React",
  "react-dom": "ReactDOM",
  "react-dom/client": "ReactDOM",
  recharts: "Recharts",
  "lucide-react": "LucideReact",
};

const umdGlobals = {
  name: "umd-globals",
  setup(build) {
    build.onResolve({ filter: /^(react|react-dom|react-dom\/client|recharts|lucide-react)$/ }, (a) => ({ path: a.path, namespace: "umd" }));
    build.onLoad({ filter: /.*/, namespace: "umd" }, (a) => ({ contents: `module.exports = window.${GLOBALS[a.path]};`, loader: "js" }));
  },
};

const TAILWIND = `tailwind.config = { theme: { extend: {
  colors: {
    bg: "rgb(var(--bg) / <alpha-value>)", panel: "rgb(var(--panel) / <alpha-value>)", inset: "rgb(var(--inset) / <alpha-value>)",
    line: "rgb(var(--line) / <alpha-value>)", "line-2": "rgb(var(--line-2) / <alpha-value>)",
    ink: "rgb(var(--ink) / <alpha-value>)", "ink-2": "rgb(var(--ink-2) / <alpha-value>)", muted: "rgb(var(--muted) / <alpha-value>)",
    electric: "rgb(var(--electric) / <alpha-value>)", neon: "rgb(var(--neon) / <alpha-value>)",
    warn: "rgb(var(--warn) / <alpha-value>)", crit: "rgb(var(--crit) / <alpha-value>)"
  },
  fontFamily: {
    display: ['"Chakra Petch"', "ui-sans-serif", "system-ui", "sans-serif"],
    sans: ['"IBM Plex Sans"', "ui-sans-serif", "system-ui", "sans-serif"],
    mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "Menlo", "monospace"]
  }
} } };`;

const page = (title, description, bundle) => `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${title}</title>
<meta name="description" content="${description}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap">
<style>
:root{--bg:6 11 22;--ink:226 234 245;color-scheme:dark}
body{margin:0;background:rgb(var(--bg));color:rgb(var(--ink))}
#fm-boot{display:grid;place-items:center;min-height:60vh;color:rgb(106 124 149);font:12px ui-monospace,Menlo,monospace;letter-spacing:.08em}
</style>
<script src="https://cdn.tailwindcss.com/3.4.17"></script>
<script>${TAILWIND}</script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/prop-types/15.8.1/prop-types.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/recharts@2.12.7/umd/Recharts.js"></script>
<script>window.react = window.React;</script>
<script src="https://cdn.jsdelivr.net/npm/lucide-react@0.460.0/dist/umd/lucide-react.min.js"></script>
</head>
<body>
<div id="root"><div id="fm-boot">FLOWMONITOR · INICIANDO COLETA…</div></div>
<script>
${bundle}
</script>
</body>
</html>
`;

const targets = [
  { entry: "simulador/main.jsx", out: "simulador/index.html", title: "FlowMonitor", description: "FlowMonitor: simulador de painel NOC com tráfego, equipamento e leases DHCP." },
  { entry: "live/src/main.jsx", out: "live/dashboard.html", title: "FlowMonitor", description: "FlowMonitor: rede Huawei AX3 em tempo real via Home Assistant." },
];

for (const t of targets) {
  const result = await esbuild.build({
    entryPoints: [path.join(ROOT, t.entry)],
    bundle: true,
    format: "iife",
    target: "es2019",
    jsx: "transform",
    write: false,
    legalComments: "none",
    plugins: [umdGlobals],
    define: { "process.env.NODE_ENV": '"production"' },
  });
  const bundle = result.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
  fs.writeFileSync(path.join(ROOT, t.out), page(t.title, t.description, bundle));
  console.log(`${t.out}  ${(bundle.length / 1024).toFixed(0)} KB de código`);
}
