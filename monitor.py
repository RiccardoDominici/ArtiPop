#!/usr/bin/env python3
"""
monitor.py — TUI di monitoraggio del sistema autonomo ArtiPop v3.

USO
    python3 monitor.py

Lanciare dalla root del repo (o da qualsiasi punto: il file usa la propria
posizione su disco per trovare logs/, IMPROVEMENTS.md, ROADMAP.md e CONTROL,
quindi funziona anche se il path del repo contiene spazi, es.
"ArtiPop v3"). Non richiede argomenti.

COSA FA
    Mostra in tempo reale (refresh ogni 2s) lo stato del loop autonomo:
    stato generale (esecuzione/attesa quota/pausa/fermo), pipeline degli
    stadi PLAN→EXEC→VERIFY con il modello in uso, riquadro deploy, avanzamento
    roadmap, contatori degli esiti, le ultime righe del registro
    (IMPROVEMENTS.md) e la coda del log dello stadio corrente.

    Legge SOLO questi file (mai scrive, tranne il file CONTROL):
      - logs/state.json          stato strutturato scritto dal loop
      - IMPROVEMENTS.md          registro append-only degli esiti
      - ROADMAP.md                milestone e relativo stato
      - logs/run<N>-<stadio>.jsonl  log grezzo (jsonl) dello stadio attivo

    Tutti i file sopra sono opzionali: se mancano o sono corrotti il monitor
    mostra un placeholder e non si interrompe mai.

TASTI (non bloccanti; attivi solo se il terminale è una TTY)
    p  scrive PAUSE nel file CONTROL (il loop autonomo si mette in pausa)
    s  scrive STOP nel file CONTROL (il loop esce pulito a fine ciclo)
    k  scrive KILL nel file CONTROL, con conferma y/n (il loop fa revert
       del ciclo corrente)
    l  apre il log completo dello stadio corrente con $PAGER (o less/more)
       sospendendo temporaneamente la Live
    q  esce dalla TUI (il loop autonomo NON viene toccato), con conferma

    La TUI scrive ESCLUSIVAMENTE nel file CONTROL. Non esegue mai comandi
    git/wrangler/rete e non modifica nessun altro file del repo.

DIPENDENZE
    Richiede la libreria di terze parti 'rich'. Se non è installata per
    l'interprete python3 in uso, il monitor stampa istruzioni per crearne
    uno virtualenv dedicato e installarla lì, poi esce con codice 1.
"""

import json
import os
import re
import select
import subprocess
import sys
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path

# --------------------------------------------------------------------------
# Dipendenza esterna 'rich': controllo esplicito con messaggio chiaro invece
# di un ImportError crudo, come richiesto dal contratto (nessun fallback
# curses: se rich manca si spiega come installarlo in un venv).
# --------------------------------------------------------------------------
try:
    from rich.console import Console, Group
    from rich.layout import Layout
    from rich.live import Live
    from rich.panel import Panel
    from rich.table import Table
    from rich.text import Text
except ImportError:
    sys.stderr.write(
        "\n"
        "ERRORE: la libreria Python 'rich' non e' installata per questo interprete.\n\n"
        f"Interprete in uso: {sys.executable}\n\n"
        "monitor.py e' una TUI e richiede 'rich' per funzionare (nessun fallback\n"
        "testuale e' previsto). Installala in un virtualenv dedicato, ad esempio:\n\n"
        "    python3 -m venv .venv-monitor\n"
        "    source .venv-monitor/bin/activate\n"
        "    pip install rich\n"
        "    python3 monitor.py\n\n"
        "In alternativa, se il sistema lo consente: pip install --user rich\n\n"
    )
    sys.exit(1)

# Solo su piattaforme POSIX (termios/tty) i tasti sono gestiti in modo non
# bloccante. Su altre piattaforme la TUI resta comunque utilizzabile in sola
# lettura (il rendering funziona, i tasti no).
try:
    import termios
    import tty

    _HAS_TERMIOS = True
except ImportError:
    _HAS_TERMIOS = False


# --------------------------------------------------------------------------
# Percorsi: derivati dalla posizione dello script stesso, mai da os.getcwd(),
# cosi' funziona indipendentemente dalla directory di lancio e gestisce senza
# problemi lo spazio nel nome della cartella del repo ("ArtiPop v3"), dato
# che pathlib.Path non ha bisogno di quoting da shell.
# --------------------------------------------------------------------------
REPO_DIR = Path(__file__).resolve().parent
LOGS_DIR = REPO_DIR / "logs"
STATE_FILE = LOGS_DIR / "state.json"
IMPROVEMENTS_FILE = REPO_DIR / "IMPROVEMENTS.md"
ROADMAP_FILE = REPO_DIR / "ROADMAP.md"
CONTROL_FILE = REPO_DIR / "CONTROL"

REFRESH_INTERVAL = 2.0  # secondi, come da contratto
KEY_POLL_INTERVAL = 0.15  # granularita' di risposta ai tasti

STAGE_ORDER = [("plan", "PLAN"), ("exec", "EXEC"), ("verify", "VERIFY")]

COUNTER_KEYS = [
    ("FATTO", "FATTO", "green"),
    ("DUPLICATO", "DUPLICATO", "grey62"),
    ("SCARTATO", "SCARTATO", "grey62"),
    ("FALLITO_EXEC", "FALLITO(EXEC)", "red"),
    ("FALLITO_VERIFY", "FALLITO(VERIFY)", "red"),
    ("FALLITO_DEPLOY", "FALLITO(DEPLOY)", "red"),
    ("BLOCCATO", "BLOCCATO", "magenta"),
]

MILESTONE_RE = re.compile(r"^###\s+M\d+.*·\s*(APERTA|FATTA|BLOCCATA)")


# ==========================================================================
# Caricamento dati (sola lettura, sempre tollerante a file mancanti/corrotti)
# ==========================================================================

def load_state():
    """Legge logs/state.json. Ritorna None se assente o non parsabile: il
    chiamante mostra allora un pannello 'in attesa del primo ciclo'."""
    if not STATE_FILE.exists():
        return None
    try:
        with open(STATE_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, json.JSONDecodeError):
        return None
    return data if isinstance(data, dict) else None


def parse_roadmap(path):
    """Estrae modalita' (BUILD/POLISH) e avanzamento x/y da ROADMAP.md,
    con la stessa regola del loop: presenza di '· APERTA' → BUILD."""
    result = {"mode": None, "done": 0, "total": 0}
    if not path.exists():
        return result
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return result
    statuses = []
    for line in text.splitlines():
        m = MILESTONE_RE.match(line.strip())
        if m:
            statuses.append(m.group(1))
    result["total"] = len(statuses)
    result["done"] = sum(1 for s in statuses if s == "FATTA")
    result["mode"] = "BUILD" if "APERTA" in statuses else ("POLISH" if statuses else None)
    return result


def parse_improvements(path, limit=10):
    """Estrae le ultime `limit` righe dati della tabella di IMPROVEMENTS.md.
    Tollerante: righe malformate, l'header, il separatore markdown e la riga
    d'esempio commentata (<!-- ... -->) vengono scartati senza errori."""
    if not path.exists():
        return []
    try:
        lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    except OSError:
        return []

    cols = ("data", "tipo", "area", "obiettivo", "file", "planner", "esito", "branch", "deploy")
    rows = []
    for line in lines:
        stripped = line.strip()
        if not stripped.startswith("|") or not stripped.endswith("|"):
            continue
        cells = [c.strip() for c in stripped.strip("|").split("|")]
        if not cells:
            continue
        # riga separatore markdown, es. |---|---|:---:|
        if all(re.fullmatch(r":?-{2,}:?", c) for c in cells if c):
            continue
        # riga di intestazione
        if cells[0].lower() in ("data",):
            continue
        if len(cells) < len(cols):
            continue  # riga malformata: si scarta senza far crashare il monitor
        row = dict(zip(cols, cells[: len(cols)]))
        rows.append(row)
    return rows[-limit:]


def extract_text_from_jsonl_event(obj):
    """Estrae un frammento leggibile da un evento JSONL di 'claude -p', in
    modo tollerante a schemi diversi (assistant/user/system/result/errori).
    Ritorna None se non trova nulla di testuale da mostrare."""
    if not isinstance(obj, dict):
        return None

    msg = obj.get("message")
    if isinstance(msg, dict):
        content = msg.get("content")
        if isinstance(content, list):
            parts = []
            for block in content:
                if not isinstance(block, dict):
                    continue
                btype = block.get("type")
                if btype == "text" and block.get("text"):
                    parts.append(block["text"])
                elif btype == "tool_use":
                    parts.append(f"[tool: {block.get('name', '?')}]")
                elif btype == "tool_result":
                    parts.append("[risultato tool]")
            if parts:
                return " ".join(p.strip() for p in parts if p.strip())
        elif isinstance(content, str) and content.strip():
            return content.strip()

    if obj.get("type") == "result":
        r = obj.get("result")
        if isinstance(r, str) and r.strip():
            return r.strip()

    for key in ("text", "summary", "error", "message"):
        val = obj.get(key)
        if isinstance(val, str) and val.strip():
            return val.strip()

    return None


def current_stage_log_path(state):
    """Ritorna il Path del log dello stadio attivo (logs/run<N>-<stadio>.jsonl)
    se lo stadio corrente e' plan/exec/verify, altrimenti None."""
    if not state:
        return None
    run_n = state.get("run")
    stage = state.get("stage")
    if run_n is None or stage not in ("plan", "exec", "verify"):
        return None
    return LOGS_DIR / f"run{run_n}-{stage}.jsonl"


def fallback_latest_log():
    """Se non c'e' uno stadio claude attivo (deploy/idle/pausa/...), mostra
    comunque l'ultimo log di stadio modificato, per contesto."""
    if not LOGS_DIR.exists():
        return None
    try:
        candidates = sorted(
            LOGS_DIR.glob("run*-*.jsonl"), key=lambda p: p.stat().st_mtime, reverse=True
        )
    except OSError:
        return None
    return candidates[0] if candidates else None


def read_tail_bytes(path, max_bytes=65536):
    """Legge solo la coda del file (max_bytes dalla fine) per restare
    efficiente anche su log lunghi, invece di rileggere tutto ogni 2s."""
    try:
        size = path.stat().st_size
    except OSError:
        return b"", False
    truncated_head = size > max_bytes
    try:
        with open(path, "rb") as f:
            if truncated_head:
                f.seek(-max_bytes, os.SEEK_END)
            data = f.read()
    except OSError:
        return b"", False
    return data, truncated_head


def tail_log_lines(path, max_lines=12, max_chars=200):
    """Ritorna le ultime `max_lines` righe leggibili del log jsonl indicato,
    estraendo il testo in modo tollerante; se una riga non e' JSON valido
    mostra la riga grezza troncata, senza mai sollevare eccezioni."""
    if path is None or not path.exists():
        return []
    data, truncated_head = read_tail_bytes(path)
    if not data:
        return []
    text = data.decode("utf-8", errors="replace")
    lines = [l for l in text.splitlines() if l.strip()]
    if truncated_head and lines:
        lines = lines[1:]  # la prima riga puo' essere tagliata a meta'
    lines = lines[-max_lines:]

    out = []
    for raw in lines:
        rendered = None
        try:
            obj = json.loads(raw)
            rendered = extract_text_from_jsonl_event(obj)
        except (json.JSONDecodeError, ValueError):
            rendered = None
        if not rendered:
            rendered = raw
        rendered = rendered.replace("\n", " ").strip()
        if len(rendered) > max_chars:
            rendered = rendered[: max_chars - 1] + "…"
        out.append(rendered)
    return out


# ==========================================================================
# Scrittura (unica azione consentita: il file CONTROL)
# ==========================================================================

def write_control(word):
    """Scrive `word` nel file CONTROL in modo atomico (tmp + os.replace),
    cosi' il loop non legge mai un contenuto parziale."""
    tmp_path = CONTROL_FILE.parent / f"{CONTROL_FILE.name}.tmp{os.getpid()}"
    try:
        tmp_path.write_text(word + "\n", encoding="utf-8")
        os.replace(tmp_path, CONTROL_FILE)
        return True
    except OSError:
        try:
            tmp_path.unlink()
        except OSError:
            pass
        return False


# ==========================================================================
# Helper di formattazione
# ==========================================================================

def parse_iso(s):
    """Parsing tollerante di timestamp ISO 8601, incluso il suffisso 'Z'."""
    if not s or not isinstance(s, str):
        return None
    s2 = s.strip()
    if s2.endswith("Z"):
        s2 = s2[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(s2)
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def format_uptime(started_at):
    dt = parse_iso(started_at)
    if dt is None:
        return "—"
    total_s = max(0, int((datetime.now(timezone.utc) - dt).total_seconds()))
    h, rem = divmod(total_s, 3600)
    m, s = divmod(rem, 60)
    return f"{h:02d}:{m:02d}:{s:02d}"


def format_countdown(next_retry_at):
    dt = parse_iso(next_retry_at)
    if dt is None:
        return "—"
    total_s = int((dt - datetime.now(timezone.utc)).total_seconds())
    if total_s <= 0:
        return "ora"
    h, rem = divmod(total_s, 3600)
    m, s = divmod(rem, 60)
    if h:
        return f"{h}h{m:02d}m"
    return f"{m:02d}m{s:02d}s"


def status_info(state):
    """Mappa lo stage corrente sui 4 stati colorati richiesti dal contratto:
    esecuzione=verde, attesa quota=giallo, pausa=blu, fermo=rosso."""
    if state is None:
        return "IN ATTESA DEL PRIMO CICLO", "red"
    stage = state.get("stage")
    if stage in ("plan", "exec", "verify", "deploy"):
        return "ESECUZIONE", "green"
    if stage == "waiting_quota":
        return "ATTESA QUOTA", "yellow"
    if stage == "paused":
        return "PAUSA", "blue"
    if stage in ("idle", "stopped"):
        return "FERMO", "red"
    return f"STATO SCONOSCIUTO ({stage})", "white"


def esito_style(esito):
    if esito == "FATTO":
        return "green"
    if esito.startswith("FALLITO"):
        return "red"
    if esito == "BLOCCATO":
        return "magenta"
    return "grey62"


# ==========================================================================
# Costruzione dei pannelli rich
# ==========================================================================

def build_header(state):
    label, color = status_info(state)
    if state is None:
        run_txt, uptime_txt, countdown_txt = "—/—", "—", "—"
    else:
        run_txt = f"{state.get('run', '—')}/{state.get('max_runs', '—')}"
        uptime_txt = format_uptime(state.get("started_at"))
        countdown_txt = format_countdown(state.get("next_retry_at"))

    text = Text()
    text.append(" ArtiPop v3 ", style="bold white on grey27")
    text.append("  monitor autonomo   ", style="dim")
    text.append(f" {label} ", style=f"bold white on {color}")
    text.append(f"   run {run_txt}   uptime {uptime_txt}   next_retry {countdown_txt}")
    return Panel(text, border_style=color)


def build_stages(state):
    stage = state.get("stage") if state else None
    stage_model = state.get("stage_model") if state else None
    fable_escalations = (state or {}).get("fable_escalations", 0)

    combined = Text()
    for i, (key, label) in enumerate(STAGE_ORDER):
        if i > 0:
            combined.append("   →   ", style="dim")
        if key == "plan":
            model = stage_model if (stage == "plan" and stage_model) else "opus"
        else:
            model = "sonnet"  # Executor e Verifier sono sempre sonnet, mai escalation
        active = stage == key
        style = "bold black on cyan" if active else "dim"
        combined.append(f" {label}·{model} ", style=style)
        if key == "plan" and model == "fable":
            combined.append(" FABLE ", style="bold white on magenta")

    subtitle = f"escalation fable finora: {fable_escalations}" if state else None
    return Panel(combined, title="Pipeline", border_style="grey50", subtitle=subtitle)


def build_deploy(state):
    d = (state or {}).get("last_deploy") or {}
    version = d.get("version") or "—"
    url = d.get("url") or "—"
    smoke = d.get("smoke") or "—"
    ts = d.get("ts") or "—"
    smoke_style = {"ok": "bold green", "fail": "bold red"}.get(smoke, "grey62")

    body = Text()
    body.append("versione: ", style="dim"); body.append(f"{version}\n")
    body.append("url: ", style="dim"); body.append(f"{url}\n")
    body.append("smoke: ", style="dim"); body.append(f"{smoke}\n", style=smoke_style)
    body.append("ultimo deploy: ", style="dim"); body.append(f"{ts}")
    return Panel(body, title="Deploy", border_style="grey50")


def build_roadmap(roadmap_info):
    done, total, mode = roadmap_info["done"], roadmap_info["total"], roadmap_info["mode"]
    ratio = (done / total) if total else 0.0
    bar_width = 20
    filled = int(round(bar_width * ratio))
    bar = "█" * filled + "░" * (bar_width - filled)

    mode_style = "bold cyan" if mode == "BUILD" else ("bold yellow" if mode == "POLISH" else "grey62")
    body = Text()
    body.append("modalita': ", style="dim")
    body.append(f"{mode or '—'}\n", style=mode_style)
    body.append(f"{bar}  {done}/{total or 0}")
    return Panel(body, title="Roadmap", border_style="grey50")


def build_counters(state):
    counters = (state or {}).get("counters") or {}
    table = Table.grid(padding=(0, 1))
    table.add_column(justify="left")
    table.add_column(justify="right")
    for key, label, color in COUNTER_KEYS:
        value = counters.get(key, 0)
        table.add_row(Text(label, style=color), Text(str(value), style=f"bold {color}"))
    return Panel(table, title="Contatori esiti", border_style="grey50")


def build_registro(rows):
    table = Table(expand=True, border_style="grey50", title="Ultime righe registro (IMPROVEMENTS.md)")
    for col in ("data", "tipo", "area", "obiettivo", "planner", "esito", "deploy"):
        table.add_column(col, overflow="fold")
    if not rows:
        table.add_row("—", "—", "—", "nessuna riga in IMPROVEMENTS.md", "—", "—", "—")
    else:
        for r in rows:
            style = esito_style(r["esito"])
            table.add_row(
                r["data"], r["tipo"], r["area"], r["obiettivo"], r["planner"],
                Text(r["esito"], style=f"bold {style}"), r["deploy"],
            )
    return table


def build_logtail(lines, log_path):
    if log_path is not None:
        title = f"Tail log stadio — {log_path.name}"
    else:
        title = "Tail log stadio"
    if not lines:
        body = Text("nessun log disponibile per lo stadio corrente", style="dim italic")
    else:
        body = Text("\n".join(lines))
    return Panel(body, title=title, border_style="grey50")


def build_footer(pending_confirm, status_message):
    text = Text()
    if pending_confirm:
        text.append(
            f" Confermi {pending_confirm.upper()}? premi 'y' per confermare, "
            f"qualsiasi altro tasto per annullare ",
            style="bold white on red",
        )
    elif status_message:
        text.append(f" {status_message} ", style="bold black on green")
    else:
        text.append(
            " [p] pausa   [s] stop   [k] kill   [l] log completo   [q] esci ",
            style="dim",
        )
    return Panel(text, border_style="grey50")


def build_layout(state, roadmap_info, rows, log_lines, log_path, pending_confirm, status_message):
    """Assembla l'intero albero di Layout per il frame corrente. Racchiuso
    dal chiamante in try/except: un errore di rendering (es. terminale
    troppo piccolo) non deve mai far crashare il monitor."""
    layout = Layout()
    layout.split_column(
        Layout(name="header", size=3),
        Layout(name="stages", size=3),
        Layout(name="midrow", size=8),
        Layout(name="registro", ratio=3),
        Layout(name="logtail", ratio=3),
        Layout(name="footer", size=3),
    )
    layout["midrow"].split_row(
        Layout(name="deploy"),
        Layout(name="roadmap"),
        Layout(name="counters"),
    )

    layout["header"].update(build_header(state))
    layout["stages"].update(build_stages(state))
    layout["midrow"]["deploy"].update(build_deploy(state))
    layout["midrow"]["roadmap"].update(build_roadmap(roadmap_info))
    layout["midrow"]["counters"].update(build_counters(state))
    layout["registro"].update(build_registro(rows))
    layout["logtail"].update(build_logtail(log_lines, log_path))
    layout["footer"].update(build_footer(pending_confirm, status_message))
    return layout


def fallback_layout(error_text):
    """Rendering minimale usato se build_layout solleva un'eccezione
    (es. terminale troppo piccolo): mostra un messaggio invece di crashare."""
    return Panel(
        Text(f"Errore di rendering (il monitor continua): {error_text}", style="yellow"),
        title="ArtiPop v3 — monitor",
        border_style="red",
    )


# ==========================================================================
# Gestione tasti (non bloccante, POSIX only)
# ==========================================================================

class KeyReader:
    """Lettore di tasti non bloccante da stdin via select()/termios, in
    modalita' cbreak (non raw: i segnali come Ctrl+C restano attivi).
    Su piattaforme senza termios o se stdin non e' una TTY, si comporta come
    no-op (nessun tasto viene mai letto, il rendering resta funzionante)."""

    def __init__(self):
        self.enabled = _HAS_TERMIOS and sys.stdin.isatty()
        self._old_settings = None
        self._eof = False
        if self.enabled:
            try:
                self._old_settings = termios.tcgetattr(sys.stdin)
                tty.setcbreak(sys.stdin.fileno())
            except (termios.error, ValueError, OSError):
                self.enabled = False
                self._old_settings = None

    def poll(self, timeout=KEY_POLL_INTERVAL):
        if not self.enabled or self._eof:
            time.sleep(timeout)
            return None
        try:
            ready, _, _ = select.select([sys.stdin], [], [], timeout)
        except (OSError, ValueError):
            return None
        if not ready:
            return None
        try:
            ch = sys.stdin.read(1)
        except OSError:
            return None
        if ch == "":
            self._eof = True  # stdin chiuso/reindirizzato: smette di leggere
            return None
        return ch

    def restore(self):
        if self._old_settings is not None:
            try:
                termios.tcsetattr(sys.stdin, termios.TCSADRAIN, self._old_settings)
            except (termios.error, OSError):
                pass

    def reapply_cbreak(self):
        """Da richiamare dopo aver ceduto il terminale a un sottoprocesso
        (il pager), per essere sicuri di restare in cbreak al suo ritorno."""
        if self.enabled:
            try:
                tty.setcbreak(sys.stdin.fileno())
            except (termios.error, OSError):
                pass


def open_full_log(live, log_path):
    """Sospende la Live e apre il log completo dello stadio corrente con
    $PAGER (o less/more come fallback), dopo averlo reso leggibile
    (estrazione tollerante del testo dagli eventi jsonl, come per la tail).
    Sola lettura: nessun file del repo viene toccato."""
    if log_path is None or not log_path.exists():
        return False, "nessun log disponibile per lo stadio corrente"

    try:
        raw_text = log_path.read_text(encoding="utf-8", errors="replace")
    except OSError as e:
        return False, f"errore di lettura del log: {e}"

    raw_lines = [l for l in raw_text.splitlines() if l.strip()]
    rendered_lines = []
    for raw in raw_lines:
        try:
            obj = json.loads(raw)
            text = extract_text_from_jsonl_event(obj)
        except (json.JSONDecodeError, ValueError):
            text = None
        rendered_lines.append(text if text else raw)
    content = f"=== {log_path.name} ({len(raw_lines)} eventi) ===\n\n" + "\n\n".join(rendered_lines)

    pager_candidates = []
    env_pager = os.environ.get("PAGER")
    if env_pager:
        pager_candidates.append(env_pager)
    pager_candidates += ["less", "more"]

    tmp_name = None
    try:
        with tempfile.NamedTemporaryFile(
            "w", suffix=".log", prefix="monitor-artipop-", delete=False, encoding="utf-8"
        ) as tf:
            tf.write(content)
            tmp_name = tf.name

        live.stop()
        try:
            launched = False
            for pager in pager_candidates:
                try:
                    subprocess.run([pager, tmp_name])
                    launched = True
                    break
                except (FileNotFoundError, OSError):
                    continue
            if not launched:
                return False, "nessun pager disponibile ($PAGER, less, more)"
        finally:
            live.start()
    finally:
        if tmp_name:
            try:
                os.unlink(tmp_name)
            except OSError:
                pass

    return True, None


# ==========================================================================
# Ciclo principale
# ==========================================================================

def main():
    console = Console()
    key_reader = KeyReader()

    pending_confirm = None  # None | "kill" | "quit"
    status_message = None
    status_message_until = 0.0

    last_refresh = 0.0
    state = None
    roadmap_info = {"mode": None, "done": 0, "total": 0}
    rows = []
    log_lines = []
    log_path = None

    def refresh_data():
        nonlocal state, roadmap_info, rows, log_lines, log_path
        state = load_state()
        roadmap_info = parse_roadmap(ROADMAP_FILE)
        rows = parse_improvements(IMPROVEMENTS_FILE, limit=10)
        log_path = current_stage_log_path(state) or fallback_latest_log()
        log_lines = tail_log_lines(log_path)

    refresh_data()

    try:
        with Live(console=console, screen=True, refresh_per_second=4, transient=False) as live:
            try:
                layout = build_layout(state, roadmap_info, rows, log_lines, log_path, pending_confirm, status_message)
            except Exception as e:  # noqa: BLE001 - il rendering non deve mai crashare la TUI
                layout = fallback_layout(str(e))
            live.update(layout)

            while True:
                now = time.monotonic()

                if status_message and now > status_message_until:
                    status_message = None

                if now - last_refresh >= REFRESH_INTERVAL:
                    refresh_data()
                    last_refresh = now
                    try:
                        layout = build_layout(
                            state, roadmap_info, rows, log_lines, log_path, pending_confirm, status_message
                        )
                        live.update(layout)
                    except Exception as e:  # noqa: BLE001
                        live.update(fallback_layout(str(e)))

                key = key_reader.poll()
                if key is None:
                    continue

                redraw = False

                if pending_confirm is not None:
                    if key.lower() == "y":
                        if pending_confirm == "kill":
                            ok = write_control("KILL")
                            status_message = "KILL inviato al loop" if ok else "ERRORE: impossibile scrivere CONTROL"
                        elif pending_confirm == "quit":
                            break
                        status_message_until = time.monotonic() + 3.0
                    pending_confirm = None
                    redraw = True
                else:
                    if key == "p":
                        ok = write_control("PAUSE")
                        status_message = "PAUSE inviato al loop" if ok else "ERRORE: impossibile scrivere CONTROL"
                        status_message_until = time.monotonic() + 3.0
                        redraw = True
                    elif key == "s":
                        ok = write_control("STOP")
                        status_message = "STOP inviato al loop" if ok else "ERRORE: impossibile scrivere CONTROL"
                        status_message_until = time.monotonic() + 3.0
                        redraw = True
                    elif key == "k":
                        pending_confirm = "kill"
                        redraw = True
                    elif key == "q":
                        pending_confirm = "quit"
                        redraw = True
                    elif key == "l":
                        ok, err = open_full_log(live, log_path)
                        key_reader.reapply_cbreak()
                        status_message = err if (not ok and err) else ("log chiuso" if ok else None)
                        status_message_until = time.monotonic() + 3.0
                        redraw = True

                if redraw:
                    try:
                        layout = build_layout(
                            state, roadmap_info, rows, log_lines, log_path, pending_confirm, status_message
                        )
                        live.update(layout)
                    except Exception as e:  # noqa: BLE001
                        live.update(fallback_layout(str(e)))
    except KeyboardInterrupt:
        pass
    finally:
        key_reader.restore()


if __name__ == "__main__":
    main()
