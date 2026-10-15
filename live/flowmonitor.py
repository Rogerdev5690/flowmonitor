#!/usr/bin/env python3
"""
FlowMonitor · ponte com o Home Assistant
----------------------------------------
Lê as entidades da integração "Huawei Mesh Router" pela API REST oficial do
Home Assistant, mede latência para a internet a partir deste PC e serve o
dashboard em http://localhost:8080.

Só usa a biblioteca padrão do Python (3.8+). Nada para instalar com pip.

Uso:
    py flowmonitor.py            inicia o dashboard
    py flowmonitor.py --check    só confere a conexão com o HA e lista o que encontrou
    FLOWMONITOR_BIND=0.0.0.0     libera o acesso do celular (app FlowMonitor) pela rede local
    pyw flowmonitor.py --service --open
                                 início automático (sem janela): espera o HA subir,
                                 grava log em flowmonitor.log e abre o painel

O token do Home Assistant é lido da variável FLOWMONITOR_HA_TOKEN ou pedido no
terminal ao iniciar. Ele não é gravado em arquivo.
"""
import argparse
import getpass
import json
import os
import re
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
import webbrowser
from collections import deque
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HERE = Path(__file__).resolve().parent
API_VERSION = 2
HISTORY_POINTS = 180          # 6 min com amostra de 2 s
LEFT_VISIBLE_SECONDS = 12     # quanto tempo um dispositivo que saiu continua visível
TIMELINE_MINUTES = 60

TYPE_RULES = [
    ("iot", r"android-?tv|google-?tv|webos|tizen|bravia|chromecast|fire-?tv|firestick|roku|smart-?tv|\btv\b|tv$"),
    ("iot", r"hikvision|dahua|intelbras|ezviz|imou|yoosee|net_ac|midea|gree|elgin|air-?cond|roborock|robot"),
    ("mobile", r"iphone|ipad|android|galaxy|\bsm-[a-z]\d|redmi|xiaomi|\bpoco|\bmoto|pixel|oppo|realme|vivo|oneplus|honor|nova|\bmate|celular|phone|tablet"),
    ("computer", r"desktop|laptop|notebook|macbook|imac|mac-?mini|\bpc\b|-pc\b|thinkpad|lenovo|dell|acer|asus|vaio|surface|windows|ubuntu|linux|workstation"),
    ("iot", r"\btv\b|smart-?tv|chromecast|roku|fire-?tv|firestick|echo|alexa|google-?home|nest|\bcam|camera|câmera|lamp|lâmpada|lampada|bulb|tuya|\besp|shelly|sonoff|printer|impressora|epson|canon|brother|xbox|playstation|\bps[345]\b|nintendo|tapo|kasa|kindle|watch|speaker|soundbar"),
]


def classify(*names):
    text = " ".join(n for n in names if n).lower()
    for kind, pattern in TYPE_RULES:
        if re.search(pattern, text):
            return kind
    return "other"


def iso_to_ms(value):
    if not value:
        return None
    try:
        return int(datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp() * 1000)
    except ValueError:
        return None


def num(value, default=0.0):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def now_ms():
    return int(time.time() * 1000)


# ───────────────────────────── Home Assistant ─────────────────────────────

class HomeAssistantError(Exception):
    pass


class HomeAssistant:
    def __init__(self, url, token, timeout=6):
        self.url = url.rstrip("/")
        self.token = token
        self.timeout = timeout

    def _request(self, path, body=None):
        data = json.dumps(body).encode("utf-8") if body is not None else None
        req = urllib.request.Request(
            self.url + path,
            data=data,
            method="POST" if body is not None else "GET",
            headers={"Authorization": "Bearer " + self.token, "Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                raw = resp.read().decode("utf-8", errors="replace")
                ctype = resp.headers.get("Content-Type", "")
                return json.loads(raw) if "json" in ctype else raw
        except urllib.error.HTTPError as exc:
            if exc.code == 401:
                raise HomeAssistantError("token recusado pelo Home Assistant (401)")
            raise HomeAssistantError("Home Assistant respondeu HTTP %s em %s" % (exc.code, path))
        except urllib.error.URLError as exc:
            raise HomeAssistantError("não consegui acessar %s (%s)" % (self.url, exc.reason))
        except (TimeoutError, OSError) as exc:
            raise HomeAssistantError("sem resposta de %s (%s)" % (self.url, exc))

    def ping(self):
        return self._request("/api/")

    def states(self):
        return self._request("/api/states")

    def template(self, text):
        return self._request("/api/template", {"template": text})


def discover(states):
    """Encontra as entidades da integração Huawei Mesh Router pela assinatura dos atributos."""
    wan, clients, uptime, trackers = [], [], [], []
    for st in states:
        eid = st.get("entity_id", "")
        attrs = st.get("attributes") or {}
        domain = eid.split(".", 1)[0]
        if domain == "binary_sensor" and "download_rate_kilobytes_s" in attrs and "external_ip" in attrs:
            wan.append(st)
        elif domain == "sensor" and "wifi_5_clients" in attrs and "lan_clients" in attrs:
            clients.append(st)
        elif domain == "sensor" and attrs.get("device_class") == "timestamp" and "seconds" in attrs:
            uptime.append(st)
        elif domain == "device_tracker" and "interface_type" in attrs and (
            "is_guest" in attrs or "connected_via" in attrs or "upload_rate_kilobytes_s" in attrs
        ):
            trackers.append(st)
    clients.sort(key=lambda s: (0 if "total" in s["entity_id"] else 1, len(s["entity_id"])))
    uptime.sort(key=lambda s: len(s["entity_id"]))
    return {
        "wan": wan[0] if wan else None,
        "clients": clients[0] if clients else None,
        "uptime": uptime[0] if uptime else None,
        "trackers": trackers,
    }


# ─────────────────────────────── Ping ───────────────────────────────

PING_TIME = re.compile(r"(?:tempo|time|tiempo)\s*([=<])\s*([\d.,]+)\s*ms", re.IGNORECASE)


def ping_once(target):
    if os.name == "nt":
        cmd = ["ping", "-n", "1", "-w", "1000", target]
        flags = 0x08000000  # CREATE_NO_WINDOW
    else:
        cmd = ["ping", "-c", "1", "-W", "1", target]
        flags = 0
    try:
        out = subprocess.run(cmd, capture_output=True, timeout=3, creationflags=flags)
    except FileNotFoundError:
        raise
    except (subprocess.TimeoutExpired, OSError):
        return None
    text = out.stdout.decode("utf-8", errors="ignore") + out.stdout.decode("cp850", errors="ignore")
    m = PING_TIME.search(text)
    if not m:
        return None
    value = float(m.group(2).replace(",", "."))
    return 0.5 if m.group(1) == "<" else value


# ─────────────────────────────── Coletor ───────────────────────────────

class Collector:
    def __init__(self, ha, interval, ping_target):
        self.ha = ha
        self.interval = interval
        self.ping_target = ping_target
        self.lock = threading.Lock()
        self.started = now_ms()
        self.stop = threading.Event()

        self.ha_ok = None
        self.error = None
        self.last_poll = None
        self.entities = {}
        self.router = {}
        self.router_info_at = 0
        self.wan = {"found": False}
        self.clients = {}
        self.integration_updated = None
        self.history = deque(maxlen=HISTORY_POINTS)
        self.devices = {}            # mac -> device dict (online)
        self.left = {}               # mac -> device dict com leftAt
        self.first_poll = True
        self.events = deque(maxlen=200)
        self.event_id = 0

        self.on_first_ok = None      # chamado uma vez, na primeira leitura bem-sucedida do HA
        self._first_ok_done = False

        self.pings = deque(maxlen=60)
        self.minutes = {}            # minuto -> [amostras boas, amostras ruins]
        self.samples_good = 0
        self.samples_total = 0

    # eventos -------------------------------------------------------------
    def log(self, level, topic, msg, device=None):
        self.event_id += 1
        ev = {"id": self.event_id, "t": now_ms(), "level": level, "topic": topic, "msg": msg}
        if device:
            ev["device"] = {k: device.get(k) for k in ("name", "ip", "mac", "band", "type")}
        self.events.append(ev)
        stamp = datetime.now().strftime("%H:%M:%S")
        print("  %s  %-8s %s" % (stamp, topic, msg), flush=True)

    # threads -------------------------------------------------------------
    def start(self):
        threading.Thread(target=self._poll_loop, daemon=True).start()
        threading.Thread(target=self._ping_loop, daemon=True).start()

    def _ping_loop(self):
        while not self.stop.is_set():
            try:
                latency = ping_once(self.ping_target)
            except FileNotFoundError:
                with self.lock:
                    self.log("warning", "ping", "comando ping não encontrado; latência desativada")
                return
            with self.lock:
                self.pings.append((now_ms(), latency))
            self.stop.wait(2)

    def _poll_loop(self):
        while not self.stop.is_set():
            t0 = time.time()
            try:
                states = self.ha.states()
                with self.lock:
                    self._ingest(states)
                    if self.ha_ok is False:
                        self.log("info", "ha", "conexão com o Home Assistant restabelecida")
                    self.ha_ok, self.error = True, None
                if not self._first_ok_done:
                    self._first_ok_done = True
                    if self.on_first_ok:
                        threading.Thread(target=self.on_first_ok, daemon=True).start()
                if time.time() - self.router_info_at > 300:
                    self._load_router_info()
            except HomeAssistantError as exc:
                with self.lock:
                    if self.ha_ok is not False:
                        self.log("critical", "ha", "falha ao ler o Home Assistant: %s" % exc)
                    self.ha_ok, self.error = False, str(exc)
                    self._sample("down")
            except Exception as exc:  # não deixa o coletor morrer por um dado inesperado
                with self.lock:
                    self.error = "erro inesperado: %r" % (exc,)
                    self.log("warning", "ha", self.error)
            self.stop.wait(max(0.2, self.interval - (time.time() - t0)))

    def _load_router_info(self):
        self.router_info_at = time.time()
        wan_id = self.entities.get("wan")
        if not wan_id:
            return
        fields = ["model", "sw_version", "hw_version", "name", "manufacturer"]
        tpl = "|".join("{{ device_attr('%s', '%s') }}" % (wan_id, f) for f in fields)
        try:
            text = self.ha.template(tpl)
        except HomeAssistantError:
            return
        values = [v.strip() if v.strip() not in ("None", "") else None for v in str(text).split("|")]
        values += [None] * (len(fields) - len(values))
        with self.lock:
            self.router.update(dict(zip(["model", "firmware", "hardware", "name", "manufacturer"], values)))

    # processamento -------------------------------------------------------
    def _ingest(self, states):
        t = now_ms()
        self.last_poll = t
        found = discover(states)
        self.entities = {
            "wan": found["wan"]["entity_id"] if found["wan"] else None,
            "clients": found["clients"]["entity_id"] if found["clients"] else None,
            "uptime": found["uptime"]["entity_id"] if found["uptime"] else None,
            "trackers": len(found["trackers"]),
        }

        # WAN
        w = found["wan"]
        if w:
            a = w.get("attributes", {})
            connected = w.get("state") == "on" if w.get("state") in ("on", "off") else None
            prev = self.wan.get("connected")
            self.wan = {
                "found": True,
                "connected": connected,
                "externalIp": a.get("external_ip"),
                "uptimeSec": num(a.get("uptime_seconds"), None),
                "downMbps": num(a.get("download_rate_kilobytes_s")) * 8 / 1000,
                "upMbps": num(a.get("upload_rate_kilobytes_s")) * 8 / 1000,
            }
            self.integration_updated = iso_to_ms(w.get("last_updated"))
            if not self.first_poll and prev is not None and connected != prev:
                if connected:
                    self.log("info", "wan", "internet restabelecida (IP externo %s)" % (a.get("external_ip") or "?"))
                else:
                    self.log("critical", "wan", "internet caiu: o roteador reporta a WAN desconectada")
        else:
            self.wan = {"found": False}

        # Contadores
        c = found["clients"]
        if c:
            a = c.get("attributes", {})
            self.clients = {
                "total": num(c.get("state"), None),
                "wifi24": a.get("wifi_2_4_clients"), "wifi5": a.get("wifi_5_clients"),
                "lan": a.get("lan_clients"), "guest": a.get("guest_clients"), "hilink": a.get("hilink_clients"),
            }

        # Uptime do roteador
        u = found["uptime"]
        if u:
            self.router["uptimeSec"] = num(u.get("attributes", {}).get("seconds"), None)
            self.router["uptimeAt"] = t

        # Dispositivos
        online = {}
        for st in found["trackers"]:
            a = st.get("attributes", {})
            if a.get("is_router"):
                continue
            mac = (a.get("mac") or st["entity_id"]).upper()
            if st.get("state") != "home":
                continue
            name = a.get("friendly_name") or a.get("host_name") or mac
            online[mac] = {
                "mac": mac,
                "name": name,
                "host": a.get("host_name"),
                "ip": a.get("ip") or a.get("ip_address"),
                "band": a.get("interface_type"),
                "rssi": a.get("rssi"),
                "guest": bool(a.get("is_guest")),
                "hilink": bool(a.get("is_hilink")),
                "via": a.get("connected_via"),
                "type": classify(name, a.get("host_name")),
                "downKBps": num(a.get("download_rate_kilobytes_s")),
                "upKBps": num(a.get("upload_rate_kilobytes_s")),
                "since": iso_to_ms(st.get("last_changed")),
                "state": "online",
            }

        if not self.first_poll:
            for mac, d in online.items():
                if mac not in self.devices:
                    self.left.pop(mac, None)
                    self.log("info", "device", "conectou: %s (%s, %s)" % (d["name"], d["ip"] or "sem IP", d["band"] or "?"), d)
            for mac, d in self.devices.items():
                if mac not in online:
                    gone = dict(d, state="left", leftAt=t, downKBps=0, upKBps=0)
                    self.left[mac] = gone
                    self.log("warning", "device", "desconectou: %s (%s)" % (d["name"], d["ip"] or "sem IP"), d)
        else:
            self.log("info", "ha", "%d dispositivos online na primeira leitura" % len(online))
        self.devices = online
        self.left = {m: d for m, d in self.left.items() if t - d["leftAt"] < LEFT_VISIBLE_SECONDS * 1000}
        self.first_poll = False

        cli_in = sum(d["downKBps"] for d in online.values()) * 8 / 1000
        cli_out = sum(d["upKBps"] for d in online.values()) * 8 / 1000
        self.history.append({
            "t": t,
            "wanIn": round(self.wan.get("downMbps", 0.0), 3),
            "wanOut": round(self.wan.get("upMbps", 0.0), 3),
            "cliIn": round(cli_in, 3),
            "cliOut": round(cli_out, 3),
        })
        if self.wan.get("connected") is False:
            self._sample("down")
        elif self._last_ping_ok() is False:
            self._sample("degraded")
        else:
            self._sample("up")

    def _last_ping_ok(self):
        if not self.pings:
            return None
        return self.pings[-1][1] is not None

    def _sample(self, state):
        """state: 'up' | 'degraded' (WAN ok, ping falhou) | 'down' (WAN caiu ou HA sem resposta)."""
        minute = int(time.time() // 60)
        bucket = self.minutes.setdefault(minute, {"up": 0, "degraded": 0, "down": 0})
        bucket[state] += 1
        self.samples_total += 1
        self.samples_good += 0 if state == "down" else 1
        for m in [m for m in self.minutes if m < minute - TIMELINE_MINUTES]:
            del self.minutes[m]

    # snapshot ------------------------------------------------------------
    def snapshot(self):
        with self.lock:
            pings = list(self.pings)
            ok = [p for _, p in pings if p is not None]
            recent = [p for _, p in pings[-20:] if p is not None]
            jitter = (sum(abs(a - b) for a, b in zip(recent, recent[1:])) / (len(recent) - 1)) if len(recent) > 1 else None
            minute_now = int(time.time() // 60)
            timeline = []
            for m in range(minute_now - TIMELINE_MINUTES + 1, minute_now + 1):
                b = self.minutes.get(m)
                if not b:
                    state = "nodata"
                elif b["down"] and not (b["up"] or b["degraded"]):
                    state = "down"
                elif b["down"] or b["degraded"]:
                    state = "degraded"
                else:
                    state = "up"
                timeline.append({"t": m * 60000, "state": state})
            return {
                "ok": True,
                "now": now_ms(),
                "startedAt": self.started,
                "source": {
                    "haUrl": self.ha.url,
                    "haOk": self.ha_ok,
                    "error": self.error,
                    "lastPoll": self.last_poll,
                    "pollInterval": self.interval,
                    "integrationUpdated": self.integration_updated,
                    "entities": self.entities,
                },
                "router": dict(self.router),
                "wan": dict(self.wan),
                "clients": dict(self.clients),
                "ping": {
                    "target": self.ping_target,
                    "latency": pings[-1][1] if pings else None,
                    "jitter": jitter,
                    "loss": (100.0 * (len(pings) - len(ok)) / len(pings)) if pings else None,
                    "samples": len(pings),
                },
                "availability": {
                    "pct": (100.0 * self.samples_good / self.samples_total) if self.samples_total else None,
                    "samples": self.samples_total,
                    "timeline": timeline,
                },
                "history": list(self.history),
                "devices": list(self.devices.values()) + list(self.left.values()),
                "events": list(self.events)[-80:],
            }


# ─────────────────────────────── HTTP ───────────────────────────────

def make_handler(collector):
    class Handler(BaseHTTPRequestHandler):
        def _send(self, code, body, ctype):
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Cache-Control", "no-store")
            # O app Android lê a API de outra origem (http://localhost dentro do APK).
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_OPTIONS(self):
            self.send_response(204)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "*")
            self.send_header("Access-Control-Max-Age", "86400")
            self.end_headers()

        def do_GET(self):
            path = self.path.split("?", 1)[0]
            if path in ("/", "/index.html"):
                page = HERE / "dashboard.html"
                if not page.exists():
                    return self._send(500, b"dashboard.html nao encontrado ao lado do flowmonitor.py", "text/plain; charset=utf-8")
                return self._send(200, page.read_bytes(), "text/html; charset=utf-8")
            if path == "/api/snapshot":
                body = json.dumps(collector.snapshot(), ensure_ascii=False).encode("utf-8")
                return self._send(200, body, "application/json; charset=utf-8")
            if path == "/api/health":
                info = {"ok": True, "app": "flowmonitor", "version": API_VERSION, "haOk": collector.ha_ok,
                        "router": collector.router.get("model")}
                return self._send(200, json.dumps(info).encode("utf-8"), "application/json")
            self._send(404, b"not found", "text/plain")

        def log_message(self, *args):
            pass

    return Handler


# ─────────────────────────────── main ───────────────────────────────

def lan_addresses():
    """Endereços IPv4 deste PC que o celular pode usar (Wi-Fi/cabo e Tailscale)."""
    import socket
    found = []
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))  # não envia nada; só descobre a interface de saída
        found.append(s.getsockname()[0])
        s.close()
    except OSError:
        pass
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ip = info[4][0]
            if not ip.startswith("127.") and ip not in found:
                found.append(ip)
    except OSError:
        pass
    return found or ["IP-DO-PC"]


def check(ha):
    states = ha.states()
    found = discover(states)
    print("\nEntidades da integração Huawei Mesh Router:")
    print("  WAN (internet) ......", found["wan"]["entity_id"] if found["wan"] else "NÃO ENCONTRADA")
    print("  Contador de clientes ", found["clients"]["entity_id"] if found["clients"] else "não encontrado")
    print("  Uptime do roteador ..", found["uptime"]["entity_id"] if found["uptime"] else "não encontrado")
    trackers = found["trackers"]
    online = [t for t in trackers if t.get("state") == "home" and not (t.get("attributes") or {}).get("is_router")]
    print("  Dispositivos ........ %d rastreados, %d online agora" % (len(trackers), len(online)))
    for t in online[:12]:
        a = t.get("attributes") or {}
        print("     - %-28s %-15s %-7s %s" % ((a.get("friendly_name") or "")[:28], a.get("ip") or "", a.get("interface_type") or "", classify(a.get("friendly_name"), a.get("host_name"))))
    if not found["wan"]:
        print("\nA integração não apareceu. Confira em Configurações > Dispositivos e serviços se o 'Huawei Mesh Router' está configurado.")
        return 1
    print("\nTudo certo. Rode sem --check para abrir o dashboard.")
    return 0


def main():
    parser = argparse.ArgumentParser(description="FlowMonitor: ponte com o Home Assistant")
    parser.add_argument("--ha", default=os.environ.get("FLOWMONITOR_HA_URL", "http://localhost:8123"), help="URL do Home Assistant")
    parser.add_argument("--port", type=int, default=8080, help="porta do dashboard (padrão 8080)")
    parser.add_argument("--bind", default=os.environ.get("FLOWMONITOR_BIND", "127.0.0.1"),
                        help="interface de escuta (0.0.0.0 abre para o celular na rede; padrão 127.0.0.1 ou FLOWMONITOR_BIND)")
    parser.add_argument("--interval", type=float, default=2.0, help="segundos entre leituras do HA (padrão 2)")
    parser.add_argument("--ping", default="8.8.8.8", help="alvo do teste de latência (padrão 8.8.8.8)")
    parser.add_argument("--check", action="store_true", help="só confere a conexão e lista as entidades")
    parser.add_argument("--no-browser", action="store_true", help="não abrir o navegador")
    parser.add_argument("--service", action="store_true",
                        help="início automático: sem perguntas, espera o Home Assistant subir, log em flowmonitor.log")
    parser.add_argument("--open", action="store_true", help="com --service: abre o painel quando chegar a primeira leitura")
    args = parser.parse_args()
    url = "http://localhost:%d" % args.port

    if args.service:
        log_path = HERE / "flowmonitor.log"
        try:
            if log_path.exists() and log_path.stat().st_size > 1_000_000:
                log_path.unlink()
        except OSError:
            pass
        log_file = open(log_path, "a", encoding="utf-8", buffering=1)
        sys.stdout = sys.stderr = log_file
        print("\n==== início %s ====" % datetime.now().isoformat(timespec="seconds"))

    print("FlowMonitor · NOC Real-Time")

    # Já tem um FlowMonitor rodando nesta porta? Então só abre o painel.
    if not args.check:
        try:
            with urllib.request.urlopen("http://127.0.0.1:%d/api/health" % args.port, timeout=1) as resp:
                if b'"ok"' in resp.read():
                    print("O FlowMonitor já está rodando em %s" % url)
                    if not args.service and not args.no_browser:
                        webbrowser.open(url)
                    return 0
        except (urllib.error.URLError, OSError, ValueError):
            pass

    token = os.environ.get("FLOWMONITOR_HA_TOKEN", "").strip()
    if not token and args.service:
        print('FLOWMONITOR_HA_TOKEN não está definido. Rode no PowerShell: setx FLOWMONITOR_HA_TOKEN "seu-token"')
        return 2
    if not token:
        token = getpass.getpass("Token de acesso do Home Assistant (não aparece ao digitar): ").strip()
    if not token:
        print("Sem token não dá para ler o Home Assistant.")
        return 1

    ha = HomeAssistant(args.ha, token)
    if args.service:
        print("Modo serviço: o painel fica disponível em %s e espera o Home Assistant responder." % url)
    else:
        try:
            ha.ping()
        except HomeAssistantError as exc:
            print("\nErro: %s" % exc)
            print("Confira se o Home Assistant está aberto em %s e se o token está correto." % args.ha)
            return 1
        print("Conectado ao Home Assistant em %s" % args.ha)

    if args.check:
        return check(ha)

    collector = Collector(ha, args.interval, args.ping)
    if args.service and args.open:
        collector.on_first_ok = lambda: webbrowser.open(url)
    collector.start()
    try:
        server = ThreadingHTTPServer((args.bind, args.port), make_handler(collector))
    except OSError as exc:
        print("Não consegui abrir a porta %d (%s). Use --port para escolher outra." % (args.port, exc))
        collector.stop.set()
        return 1
    print("Dashboard em %s  (Ctrl+C para encerrar)" % url)
    if args.bind in ("0.0.0.0", "::"):
        for ip in lan_addresses():
            print("No celular (app FlowMonitor ou navegador): http://%s:%d" % (ip, args.port))
    else:
        print("Só este PC acessa. Para o celular, defina FLOWMONITOR_BIND=0.0.0.0 ou use --bind 0.0.0.0")
    print()
    if not args.service and not args.no_browser:
        threading.Timer(1.5, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nEncerrando…")
    finally:
        collector.stop.set()
        server.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
