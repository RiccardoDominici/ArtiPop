#!/usr/bin/env bash
# scripts/loop-lib.sh — libreria di funzioni pure per run-loop.sh
#
# Isolare qui ogni funzione di parsing/stato rende il loop testabile senza
# dover mai invocare claude/wrangler: ogni funzione riceve un percorso file
# ed è verificabile con un semplice mini-repo di fixture (vedi self-test).
#
# Convenzione: le funzioni che leggono qualcosa STAMPANO il risultato su
# stdout (così sono componibili con $(...) e testabili con `diff`/`==`);
# le funzioni che verificano una condizione usano il solo exit code (0/1)
# così sono componibili con `if funzione ...; then`.
#
# Richiede: REPO_DIR impostata dal chiamante (run-loop.sh la calcola da
# BASH_SOURCE prima di sorgentare questo file; i self-test la puntano al
# mini-repo di fixture). Molte funzioni accettano comunque il path del file
# da leggere come argomento esplicito, per restare testabili anche senza
# un vero albero di repository.
: "${REPO_DIR:?loop-lib.sh: REPO_DIR non impostata — va definita prima del source}"

# ---------------------------------------------------------------------------
# Logging e notifiche
# ---------------------------------------------------------------------------

# log <messaggio>
# Riga timestampata (UTC, ISO8601) su logs/loop.log. Crea la directory se manca.
# Non deve mai interrompere il loop: se la scrittura fallisce (disco pieno,
# permessi) lo ignoriamo silenziosamente piuttosto che far fallire il ciclo
# per un problema di logging.
log() {
    local msg="$1"
    mkdir -p "$REPO_DIR/logs" 2>/dev/null || true
    printf '[%s] %s\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$msg" >> "$REPO_DIR/logs/loop.log" 2>/dev/null || true
}

# ntfy <titolo> <corpo>
# Notifica push via ntfy.sh. Per contratto una notifica non deve MAI far
# fallire il ciclo: -m 10 limita il blocco a 10s, `|| true` assorbe qualsiasi
# errore di rete/DNS.
ntfy() {
    local title="$1" body="$2"
    curl -s -m 10 -H "Title: $title" -d "$body" "https://ntfy.sh/riccardo-claude" >/dev/null 2>&1 || true
}

# ---------------------------------------------------------------------------
# Utility data/ora
# ---------------------------------------------------------------------------

# now_iso — timestamp ISO8601 UTC per state.json (es. 2026-07-30T10:15:00Z)
now_iso() {
    date -u +'%Y-%m-%dT%H:%M:%SZ'
}

# now_registro — timestamp nel formato usato dalla tabella IMPROVEMENTS.md
now_registro() {
    date -u +'%Y-%m-%d %H:%M UTC'
}

# iso_after_seconds <secondi> — ISO8601 UTC = ora + N secondi.
# Prova prima la sintassi GNU (`date -d`, presente nel container Docker
# Linux dove il loop gira davvero), poi ripiega sulla sintassi BSD/macOS
# (`date -v`) usata solo in sviluppo locale: nessuna delle due deve poter
# rompere il ciclo, quindi in ultima istanza stampiamo comunque now_iso.
iso_after_seconds() {
    local secs="$1"
    date -u -d "+${secs} seconds" +'%Y-%m-%dT%H:%M:%SZ' 2>/dev/null \
        || date -u -v+"${secs}"S +'%Y-%m-%dT%H:%M:%SZ' 2>/dev/null \
        || now_iso
}

# ---------------------------------------------------------------------------
# File CONTROL (scritto da monitor.py, mai dal loop se non per svuotarlo)
# ---------------------------------------------------------------------------

# control_read — stampa il contenuto (trimmato) di CONTROL, "" se assente/vuoto.
control_read() {
    local f="$REPO_DIR/CONTROL"
    [[ -f "$f" ]] || { printf ''; return; }
    tr -d '[:space:]' < "$f"
}

# control_clear — svuota CONTROL (non lo elimina: monitor.py lo tiene aperto in watch).
control_clear() {
    local f="$REPO_DIR/CONTROL"
    : > "$f" 2>/dev/null || true
}

# ---------------------------------------------------------------------------
# state.json — riscrittura SEMPRE atomica (tmp + mv), motore in python3
# (niente jq: non è garantito presente nel container).
# ---------------------------------------------------------------------------

# _state_engine <json-patch>
# Applica un merge ricorsivo (deep-merge, chiavi annidate incluse come
# "counters" e "last_deploy") dello stato corrente con la patch, poi scrive
# atomicamente. started_at e last_digest vengono impostati alla prima
# scrittura utile e mai più sovrascritti da qui: rappresentano l'inizio
# vita del loop e l'ultimo digest, non vanno "resettati" a ogni update.
_state_engine() {
    local patch_json="$1"
    python3 - "$STATE_FILE" "$patch_json" <<'PYEOF'
import json, os, sys, datetime

path, patch_json = sys.argv[1], sys.argv[2]

defaults = {
    "run": 0, "max_runs": 0, "mode": "", "stage": "idle", "stage_model": "",
    "objective": "", "milestones_done": 0, "milestones_total": 0,
    "last_result": "-",
    "counters": {"FATTO": 0, "DUPLICATO": 0, "SCARTATO": 0, "FALLITO_EXEC": 0,
                 "FALLITO_VERIFY": 0, "FALLITO_DEPLOY": 0, "BLOCCATO": 0},
    "last_deploy": {"version": "", "url": "", "smoke": "-", "ts": ""},
    "fable_escalations": 0, "started_at": "", "updated_at": "",
    "next_retry_at": None, "last_digest": "",
}


def deep_merge(base, overlay):
    for k, v in overlay.items():
        if isinstance(v, dict) and isinstance(base.get(k), dict):
            deep_merge(base[k], v)
        else:
            base[k] = v


try:
    with open(path) as f:
        current = json.load(f)
except Exception:
    current = {}

state = json.loads(json.dumps(defaults))
deep_merge(state, current)

patch = json.loads(patch_json)
deep_merge(state, patch)

now = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
if not state.get("started_at"):
    state["started_at"] = now
if not state.get("last_digest"):
    state["last_digest"] = now
state["updated_at"] = now

os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
tmp = path + ".tmp"
with open(tmp, "w") as f:
    json.dump(state, f, indent=2, ensure_ascii=False)
    f.write("\n")
os.replace(tmp, path)
PYEOF
}

# state_set <chiave> <valore> [tipo]
# tipo: str (default, valore stringa) | int | raw (valore già JSON valido,
# es. "null" o un oggetto). Solo chiavi di primo livello: per campi annidati
# vedi state_set_last_deploy / state_incr_counter.
state_set() {
    local key="$1" value="$2" type="${3:-str}"
    local patch
    case "$type" in
        int)
            patch=$(python3 -c 'import json,sys; print(json.dumps({sys.argv[1]: int(sys.argv[2])}))' "$key" "$value")
            ;;
        raw)
            patch=$(python3 -c 'import json,sys; print(json.dumps({sys.argv[1]: json.loads(sys.argv[2])}))' "$key" "$value")
            ;;
        *)
            patch=$(python3 -c 'import json,sys; print(json.dumps({sys.argv[1]: sys.argv[2]}))' "$key" "$value")
            ;;
    esac
    _state_engine "$patch"
}

# state_set_last_deploy <version> <url> <smoke> <ts>
state_set_last_deploy() {
    local version="$1" url="$2" smoke="$3" ts="$4"
    local patch
    patch=$(python3 -c '
import json, sys
version, url, smoke, ts = sys.argv[1:5]
print(json.dumps({"last_deploy": {"version": version, "url": url, "smoke": smoke, "ts": ts}}))
' "$version" "$url" "$smoke" "$ts")
    _state_engine "$patch"
}

# state_get <chiave.puntata> — legge un campo (anche annidato tipo counters.FATTO).
# Stampa "" se assente/il file non esiste ancora. Oggetti/liste -> JSON compatto.
state_get() {
    local dotted="$1"
    python3 -c '
import json, sys
path, dotted = sys.argv[1], sys.argv[2]
try:
    with open(path) as f:
        state = json.load(f)
except Exception:
    print("")
    sys.exit(0)
cur = state
for part in dotted.split("."):
    if isinstance(cur, dict) and part in cur:
        cur = cur[part]
    else:
        print("")
        sys.exit(0)
if cur is None:
    print("")
elif isinstance(cur, (dict, list)):
    print(json.dumps(cur))
else:
    print(cur)
' "$STATE_FILE" "$dotted"
}

# state_incr_counter <nome> — incrementa counters.<nome> di 1 (atomico).
state_incr_counter() {
    local name="$1"
    local current newval
    current=$(state_get "counters.$name")
    [[ -z "$current" ]] && current=0
    newval=$((current + 1))
    local patch
    patch=$(python3 -c 'import json,sys; print(json.dumps({"counters": {sys.argv[1]: int(sys.argv[2])}}))' "$name" "$newval")
    _state_engine "$patch"
}

# state_init <max_runs> — crea/aggiorna lo scheletro iniziale di state.json.
state_init() {
    local max_runs="$1"
    local patch
    patch=$(python3 -c 'import json,sys; print(json.dumps({"max_runs": int(sys.argv[1])}))' "$max_runs")
    _state_engine "$patch"
}

# digest_due — exit 0 se sono passate >6h da last_digest (o se non è mai stato inviato).
digest_due() {
    python3 -c '
import json, sys, datetime
try:
    with open(sys.argv[1]) as f:
        state = json.load(f)
except Exception:
    sys.exit(0)
last = state.get("last_digest") or ""
if not last:
    sys.exit(0)
try:
    then = datetime.datetime.strptime(last, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=datetime.timezone.utc)
except Exception:
    sys.exit(0)
now = datetime.datetime.now(datetime.timezone.utc)
sys.exit(0 if (now - then).total_seconds() > 6 * 3600 else 1)
' "$STATE_FILE"
}

# ---------------------------------------------------------------------------
# .runcount — contatore persistente dei run, sopravvive ai riavvii del loop.
# ---------------------------------------------------------------------------

runcount_read() {
    local f="$REPO_DIR/.runcount"
    if [[ -f "$f" ]]; then
        tr -d '[:space:]' < "$f"
    else
        printf '0'
    fi
}

runcount_write() {
    local n="$1" f="$REPO_DIR/.runcount" tmp
    tmp="${f}.tmp.$$"
    printf '%s\n' "$n" > "$tmp" && mv -f "$tmp" "$f"
}

# ---------------------------------------------------------------------------
# ROADMAP.md — milestone e stati (APERTA · FATTA · BLOCCATA(motivo))
# ---------------------------------------------------------------------------

# roadmap_mode <file> — "BUILD" se esiste almeno una milestone "· APERTA", altrimenti "POLISH".
roadmap_mode() {
    local file="$1"
    if grep -Fq '· APERTA' "$file" 2>/dev/null; then
        printf 'BUILD'
    else
        printf 'POLISH'
    fi
}

# roadmap_first_open_milestone <file> — id (es. "M3") della prima milestone
# APERTA nell'ordine del file, "" se nessuna.
roadmap_first_open_milestone() {
    local file="$1"
    grep -m1 -E '^### M[0-9]+ .*· APERTA[[:space:]]*$' "$file" 2>/dev/null \
        | grep -oE '^### M[0-9]+' \
        | awk '{print $2}'
}

# roadmap_milestone_status <file> <Mx> — stato corrente della milestone (parte dopo l'ultimo "· ").
roadmap_milestone_status() {
    local file="$1" mx="$2" line
    line=$(grep -m1 -E "^### ${mx} " "$file" 2>/dev/null)
    [[ -n "$line" ]] || { printf ''; return; }
    printf '%s' "${line##*· }"
}

# roadmap_mark_blocked <file> <Mx> <motivo-tra-parentesi>
# Sostituisce "· APERTA" con "· BLOCCATA(<motivo>)" SOLO sulla riga "### Mx ...".
# Riscrittura atomica (tmp+mv) come per state.json: mai lasciare il file a metà.
roadmap_mark_blocked() {
    local file="$1" mx="$2" reason="$3" tmp
    tmp="${file}.tmp.$$"
    awk -v mx="$mx" -v reason="$reason" '
        BEGIN { pattern = "^### " mx " " }
        $0 ~ pattern && index($0, "\xc2\xb7 APERTA") > 0 {
            sub(/· APERTA[[:space:]]*$/, "· BLOCCATA(" reason ")")
        }
        { print }
    ' "$file" > "$tmp" && mv -f "$tmp" "$file"
}

# roadmap_counts <file> — stampa "totale fatte" (milestone totali e milestone FATTA).
# NB: la variabile non si chiama "done" (parola riservata di bash: shellcheck
# la segnala anche se qui sarebbe sintatticamente innocua) ma "fatte".
roadmap_counts() {
    local file="$1" total fatte
    total=$(grep -cE '^### M[0-9]+ ' "$file" 2>/dev/null)
    fatte=$(grep -cE '^### M[0-9]+ .*· FATTA[[:space:]]*$' "$file" 2>/dev/null)
    printf '%s %s\n' "${total:-0}" "${fatte:-0}"
}

# ---------------------------------------------------------------------------
# IMPROVEMENTS.md — registro a tabella markdown (solo append, mai riscrittura
# salvo compattazione fatta dal planner, mai da run-loop.sh).
# ---------------------------------------------------------------------------

# md_escape <testo> — rende sicuro un testo libero per stare in una cella di
# tabella markdown a riga singola (niente "|" che romperebbe le colonne,
# niente newline).
md_escape() {
    local s="$1"
    s="${s//|//}"
    s="${s//$'\n'/ }"
    printf '%s' "$s"
}

# improvements_ensure_file <file> — crea intestazione+vocabolario se il file non esiste ancora.
# Non tocca MAI un file già esistente (il registro è solo-append per contratto).
improvements_ensure_file() {
    local file="$1"
    [[ -f "$file" ]] && return 0
    cat > "$file" <<'EOF'
# IMPROVEMENTS.md — registro dei cicli autonomi ArtiPop v3

Le sezioni descrittive stanno in alto e la tabella è l'ULTIMA sezione del
file: le righe nuove si appendono in coda e devono cadere dentro la tabella.

## Aree

deploy, test, rotte-api, generazione, cancello-misure, storia-narrativa, catalogo-tuning,
sito-web, pagina-aiuto, tuning-tool, sicurezza, docs

## Aree esaurite

(nessuna)

## Registro

| data | tipo | area | obiettivo | file | planner | esito | branch | deploy |
|---|---|---|---|---|---|---|---|---|
<!-- | 2026-01-01 00:00 UTC | BUILD | rotte-api | m0-esempio riga di esempio commentata | index.js | opus | FATTO | auto/20260101-000000 | v0 | -->
EOF
}

# improvements_append_row <file> <data> <tipo> <area> <obiettivo> <file-list> <planner> <esito> <branch> <deploy>
improvements_append_row() {
    local file="$1" data="$2" tipo="$3" area="$4" obiettivo="$5" filelist="$6" planner="$7" esito="$8" branch="$9" deploy="${10}"
    improvements_ensure_file "$file"
    printf '| %s | %s | %s | %s | %s | %s | %s | %s | %s |\n' \
        "$(md_escape "$data")" "$(md_escape "$tipo")" "$(md_escape "$area")" \
        "$(md_escape "$obiettivo")" "$(md_escape "$filelist")" "$(md_escape "$planner")" \
        "$(md_escape "$esito")" "$(md_escape "$branch")" "$(md_escape "$deploy")" \
        >> "$file"
}

# _improvements_stats_awk <file> <predicato-awk-su-obiettivo-lc>
# Motore comune a improvements_milestone_stats e improvements_slug_stats:
# scandisce le righe dati della tabella (esclude header, separatore "|---|",
# riga d'esempio commentata) e conta FALLITO/planner=fable per le righe che
# soddisfano il predicato passato (già completo, operante sulla variabile awk `ol`/`obiettivo`).
# Non esposta all'esterno: usata solo dalle due funzioni sottostanti.

# improvements_milestone_stats <file> <Mx> — stampa "fails has_fable" (interi)
# per le righe il cui slug in "obiettivo" inizia con "mx-" (case-insensitive).
# NOTA: la tabella non ha una colonna "milestone" dedicata (il contratto la
# cita ma lo schema concreto ha solo "obiettivo"): il match usa il prefisso
# dello slug, che per convenzione stabile è sempre "mx-...".
improvements_milestone_stats() {
    local file="$1" mx="$2" mx_lc
    [[ -f "$file" ]] || { printf '0 0\n'; return; }
    mx_lc=$(printf '%s' "$mx" | tr '[:upper:]' '[:lower:]')
    awk -F'|' -v prefix="${mx_lc}-" '
        function trim(s) { gsub(/^[ \t]+|[ \t]+$/, "", s); return s }
        /<!--/ { next }
        NF < 10 { next }
        {
            esito = trim($8); obiettivo = trim($5); planner = trim($7)
            if (esito == "" || esito == "esito" || esito ~ /^-+$/) next
            ol = tolower(obiettivo)
            if (index(ol, prefix) != 1) next
            if (index(esito, "FALLITO") > 0) fails++
            if (tolower(planner) == "fable") has_fable = 1
        }
        END { printf "%d %d\n", fails+0, has_fable+0 }
    ' "$file"
}

# improvements_slug_stats <file> <slug-esatto> — stampa "fails has_fable" per
# le righe la cui colonna "obiettivo" inizia esattamente con "<slug>" seguito
# da spazio o fine stringa (lo slug è seguito da 5-8 parole descrittive).
improvements_slug_stats() {
    local file="$1" slug="$2"
    [[ -f "$file" ]] || { printf '0 0\n'; return; }
    awk -F'|' -v slug="$slug" '
        function trim(s) { gsub(/^[ \t]+|[ \t]+$/, "", s); return s }
        /<!--/ { next }
        NF < 10 { next }
        {
            esito = trim($8); obiettivo = trim($5); planner = trim($7)
            if (esito == "" || esito == "esito" || esito ~ /^-+$/) next
            n = length(slug)
            head = substr(obiettivo, 1, n)
            rest = substr(obiettivo, n + 1, 1)
            if (head != slug) next
            if (rest != "" && rest != " ") next
            if (index(esito, "FALLITO") > 0) fails++
            if (tolower(planner) == "fable") has_fable = 1
        }
        END { printf "%d %d\n", fails+0, has_fable+0 }
    ' "$file"
}

# improvements_last_n_results <file> <n> — stampa (una per riga, in ordine
# cronologico) le ultime N colonne "esito" delle righe dati della tabella.
# Usata per la regola di stop POLISH (5 consecutivi DUPLICATO/SCARTATO/
# NESSUNA-PROPOSTA): leggere dal registro invece che da un contatore separato
# in state.json rende la regola resistente ai riavvii del loop, a costo zero.
improvements_last_n_results() {
    local file="$1" n="$2"
    [[ -f "$file" ]] || return 0
    awk -F'|' -v n="$n" '
        function trim(s) { gsub(/^[ \t]+|[ \t]+$/, "", s); return s }
        /<!--/ { next }
        NF < 10 { next }
        {
            esito = trim($8)
            if (esito == "" || esito == "esito" || esito ~ /^-+$/) next
            results[++count] = esito
        }
        END {
            start = count - n + 1
            if (start < 1) start = 1
            for (i = start; i <= count; i++) print results[i]
        }
    ' "$file"
}

# improvements_context_dump <file> <ago-slug-o-milestone>
# Estratto grezzo (righe intere) dei FALLITO relativi a un ago di ricerca,
# per il contesto passato allo stadio quando si fa escalation a Fable.
# Best-effort: se non trova nulla stampa solo una riga informativa.
improvements_context_dump() {
    local file="$1" needle="$2" hits
    [[ -f "$file" ]] || { printf 'Nessun registro trovato.\n'; return; }
    hits=$(grep -i "FALLITO" "$file" 2>/dev/null | grep -i -- "$needle" 2>/dev/null)
    if [[ -n "$hits" ]]; then
        printf '%s\n' "$hits"
    else
        printf 'Nessun fallimento precedente trovato in IMPROVEMENTS.md per "%s".\n' "$needle"
    fi
}

# ---------------------------------------------------------------------------
# PLAN.md — scritto dallo stadio A (planner)
# ---------------------------------------------------------------------------

# plan_is_no_proposal <file> — exit 0 se la prima riga non vuota è "NESSUNA PROPOSTA".
plan_is_no_proposal() {
    local file="$1" first_line
    [[ -f "$file" ]] || return 1
    first_line=$(grep -vE '^[[:space:]]*$' "$file" 2>/dev/null | head -1 | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
    [[ "$first_line" == "NESSUNA PROPOSTA" ]]
}

# plan_field <file> <NOME-CAMPO> — valore sulla stessa riga di "NOME-CAMPO:".
# Se l'etichetta è da sola sulla riga (il planner del dry-run 1 ha scritto
# "FILE:" e l'elenco nella riga sotto), ripiega sulla prima riga non vuota
# successiva. (I campi multi-riga come MOTIVAZIONE/PASSI/TEST/CRITERI non
# servono al loop: li leggono solo executor/verifier dal proprio prompt.)
plan_field() {
    local file="$1" name="$2"
    [[ -f "$file" ]] || { printf ''; return; }
    local val
    val=$(grep -m1 -E "^${name}:" "$file" 2>/dev/null | sed -E "s/^${name}:[[:space:]]*//" | sed -e 's/[[:space:]]*$//')
    if [[ -z "$val" ]]; then
        val=$(awk -v pat="^${name}:[[:space:]]*$" 'trovato && NF {print; exit} $0 ~ pat {trovato=1}' "$file" 2>/dev/null | sed -e 's/[[:space:]]*$//')
    fi
    printf '%s' "$val"
}

plan_get_slug() { plan_field "$1" "OBIETTIVO"; }
plan_get_tipo() { plan_field "$1" "TIPO"; }
plan_get_area() { plan_field "$1" "AREA"; }
plan_get_milestone() { plan_field "$1" "MILESTONE"; }
plan_get_file() { plan_field "$1" "FILE"; }
plan_get_budget_ai() { plan_field "$1" "BUDGET_AI"; }

# ---------------------------------------------------------------------------
# VERDICT.md — scritto dallo stadio C (verifier)
# ---------------------------------------------------------------------------

verdict_last_line() {
    local file="$1"
    [[ -f "$file" ]] || { printf ''; return; }
    grep -vE '^[[:space:]]*$' "$file" 2>/dev/null | tail -1
}

# verdict_is_pass <file> — exit 0 se l'ultima riga è esattamente "VERDETTO: PASS".
verdict_is_pass() {
    local file="$1" line
    line=$(verdict_last_line "$file")
    [[ "$line" == "VERDETTO: PASS" ]]
}

# verdict_reason <file> — motivo dopo "VERDETTO: FAIL —" (accetta anche "-" ascii).
verdict_reason() {
    local file="$1" line
    line=$(verdict_last_line "$file")
    printf '%s' "$line" | sed -E 's/^VERDETTO: FAIL[[:space:]]*(—|-)+[[:space:]]*//'
}

# verdict_baseline_files <file> — elenco spazio-separato dei file dopo
# "BASELINE: aggiorna", "" se la riga non è presente (nessun aggiornamento baseline).
verdict_baseline_files() {
    local file="$1"
    [[ -f "$file" ]] || { printf ''; return; }
    grep -m1 -E '^BASELINE: aggiorna' "$file" 2>/dev/null | sed -E 's/^BASELINE: aggiorna[[:space:]]*//' | tr ',' ' '
}

# ---------------------------------------------------------------------------
# Output del blocco di orchestrazione deploy di run-loop.sh (funzione
# run_deploy, che sorgenta scripts/deploy.sh --lib e ne chiama le funzioni
# preview/save-live-version/produzione/rollback in sequenza).
#
# scripts/deploy.sh stampa "VERSION:"/"URL:"/"SMOKE:" una volta per ogni
# funzione chiamata (preview, produzione, eventuale rollback): un grep
# "prima riga" prenderebbe quindi la versione della PREVIEW, non quella di
# produzione che serve al registro. Per questo run_deploy ristampa, in coda
# al proprio output, delle chiavi univoche FINAL_VERSION/FINAL_URL relative
# solo allo stadio di produzione: qui le leggiamo per prime, con ripiego
# sulle chiavi generiche (e infine sulla regex del Version ID di wrangler)
# solo per tolleranza a un formato leggermente diverso.
# ---------------------------------------------------------------------------

deploy_field() {
    local file="$1" name="$2"
    [[ -f "$file" ]] || { printf ''; return; }
    grep -m1 -E "^${name}:" "$file" 2>/dev/null | sed -E "s/^${name}:[[:space:]]*//" | sed -e 's/[[:space:]]*$//'
}

deploy_extract_version() {
    local file="$1" v
    v=$(deploy_field "$file" "FINAL_VERSION")
    [[ -z "$v" ]] && v=$(deploy_field "$file" "VERSION")
    if [[ -z "$v" ]]; then
        v=$(grep -oE '[0-9a-fA-F-]{36}' "$file" 2>/dev/null | head -1)
    fi
    printf '%s' "$v"
}

deploy_extract_url() {
    local file="$1" u
    u=$(deploy_field "$file" "FINAL_URL")
    [[ -z "$u" ]] && u=$(deploy_field "$file" "URL")
    printf '%s' "$u"
}

# deploy_is_success <file> — exit 0 se "RESULT: SUCCESS" (case-insensitive).
deploy_is_success() {
    local file="$1" r
    r=$(deploy_field "$file" "RESULT")
    [[ "$(printf '%s' "$r" | tr '[:lower:]' '[:upper:]')" == "SUCCESS" ]]
}
