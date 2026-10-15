// Gera app/www: o FlowMonitor simulado com React, Recharts, lucide-react,
// Tailwind e fontes embutidos, para o APK funcionar sem internet.
import * as esbuild from "esbuild";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const APP = path.dirname(fileURLToPath(import.meta.url));
const WWW = path.join(APP, "www");
const NODE_MODULES = path.join(APP, "node_modules");

fs.rmSync(WWW, { recursive: true, force: true });
fs.mkdirSync(path.join(WWW, "assets"), { recursive: true });

// 1. JavaScript (React + componente)
await esbuild.build({
  entryPoints: [path.join(APP, "src/main.jsx")],
  bundle: true,
  minify: true,
  format: "iife",
  target: "es2019",
  nodePaths: [NODE_MODULES],
  define: { "process.env.NODE_ENV": '"production"' },
  legalComments: "none",
  outfile: path.join(WWW, "assets/app.js"),
});

// 2. Fontes (subconjunto latino)
await esbuild.build({
  entryPoints: [path.join(APP, "src/fonts.css")],
  bundle: true,
  minify: true,
  nodePaths: [NODE_MODULES],
  loader: { ".woff2": "file", ".woff": "file" },
  assetNames: "fonts/[name]-[hash]",
  outfile: path.join(WWW, "assets/fonts.css"),
});

// 3. Tailwind compilado (só as classes usadas no componente)
execFileSync(
  path.join(NODE_MODULES, ".bin", process.platform === "win32" ? "tailwindcss.cmd" : "tailwindcss"),
  ["-c", "tailwind.config.cjs", "-i", "src/tailwind.css", "-o", path.join(WWW, "assets/app.css"), "--minify"],
  { cwd: APP, stdio: "inherit" }
);

// 4. Página
fs.writeFileSync(path.join(WWW, "index.html"), `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#060b16">
<title>FlowMonitor</title>
<link rel="stylesheet" href="assets/fonts.css">
<link rel="stylesheet" href="assets/app.css">
<style>
html,body{margin:0;min-height:100%;background:#060b16;color:#e2eaf5;-webkit-tap-highlight-color:transparent}
#fm-boot{display:grid;place-items:center;min-height:80vh;color:#6a7c95;font:12px ui-monospace,Menlo,monospace;letter-spacing:.08em}
</style>
</head>
<body>
<div id="root"><div id="fm-boot">FLOWMONITOR · INICIANDO COLETA…</div></div>
<script src="assets/app.js"></script>
</body>
</html>
`);

const size = (f) => (fs.statSync(path.join(WWW, f)).size / 1024).toFixed(0) + " KB";
console.log(`www pronto: app.js ${size("assets/app.js")} · app.css ${size("assets/app.css")} · fonts.css ${size("assets/fonts.css")}`);
