#!/usr/bin/env bash
# run-loop.sh — cuore del sistema autonomo ArtiPop v3.
#
# Orchestrazione, MAI implementazione: questo script decide COSA fare
# (modalità, modello, stadio) e verifica meccanicamente gli ESITI (grep di
# sentinelle), senza mai interpretare il merito di un piano o di un verdetto.
# Le funzioni di parsing/stato pure sono in scripts/loop-lib.sh (testabili
# in isolamento). Contratto vincolante: vedi CLAUDE.md/AUTOLOOP.md del repo.
#
# Uso: ./run-loop.sh   (da eseguire con cwd qualsiasi: il path si calcola da solo)
# Env: MAX_RUNS (default 50) — quante iterazioni di ciclo eseguire al massimo
#      in QUESTO avvio, sommate al contatore persistente .runcount.
#
# ATTENZIONE (dal contratto): il path del repo contiene uno spazio
# ("ArtiPop v3"). Ogni riferimento a $REPO_DIR va SEMPRE tra virgolette.
set -uo pipefail
# NB: niente `set -e` di proposito. Con un loop che deve sopravvivere a
# fallimenti di git/claude/wrangler e continuare al ciclo successivo,
# `set -e` costringerebbe a subshell/trap acrobatici per ogni comando che
# può fallire legittimamente. Si preferisce il controllo esplicito del
# codice di uscita ad ogni operazione git (come richiesto dal contratto),
# con log e recovery espliciti.

# --- Percorso del repo, robusto anche se lo script è invocato da altrove ---
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export REPO_DIR

# shellcheck source=scripts/loop-lib.sh
source "$REPO_DIR/scripts/loop-lib.sh"

# Identità git per i commit del loop (registro, merge, revert): nel container
# non esiste ~/.gitconfig, e senza identità git si rifiuta di committare.
# L'executor non ne ha bisogno (Claude Code gestisce la propria), il git nudo
# di questo script sì — visto fallire nel dry-run 1.
export GIT_AUTHOR_NAME="${GIT_AUTHOR_NAME:-ArtiPop Loop}"
export GIT_AUTHOR_EMAIL="${GIT_AUTHOR_EMAIL:-artipop-loop@local}"
export GIT_COMMITTER_NAME="${GIT_COMMITTER_NAME:-ArtiPop Loop}"
export GIT_COMMITTER_EMAIL="${GIT_COMMITTER_EMAIL:-artipop-loop@local}"

# --- Configurazione ---
MAX_RUNS="${MAX_RUNS:-50}"
STATE_FILE="$REPO_DIR/logs/state.json"
export STATE_FILE
PLAN_FILE="$REPO_DIR/PLAN.md"
VERDICT_FILE="$REPO_DIR/VERDICT.md"
IMPROVEMENTS_FILE="$REPO_DIR/IMPROVEMENTS.md"
ROADMAP_FILE="$REPO_DIR/ROADMAP.md"
ROLE_PLANNER="$REPO_DIR/ROLE-PLANNER.md"
ROLE_EXECUTOR="$REPO_DIR/ROLE-EXECUTOR.md"
ROLE_VERIFIER="$REPO_DIR/ROLE-VERIFIER.md"
DEPLOY_SCRIPT="$REPO_DIR/scripts/deploy.sh"
STAGE_CONTEXT_FILE="$REPO_DIR/logs/stage-context.txt"
PRODUCTION_BRANCH="auto/production"

# Timeout esterni e max-turns per stadio, dal contratto (sezione "Modelli").
TIMEOUT_A=1800; MAXTURNS_A=20
TIMEOUT_B=5400; MAXTURNS_B=80
TIMEOUT_C=2100; MAXTURNS_C=25

# Cap difensivo sui retry per errori generici di stadio (non specificato dal
# contratto in modo esplicito: senza un tetto, un errore persistente e non
# transitorio farebbe girare il loop all'infinito su un solo stadio invece
# di registrare FALLITO e proseguire. Va validato con Riccardo.
MAX_GENERIC_RETRIES=5

# Variabile globale con il motivo di arresto, letta dal trap EXIT.
STOP_REASON="arresto non pianificato (vedi log)"
STOPPING=0

# ---------------------------------------------------------------------------
# Trap di arresto: qualsiasi via d'uscita (fine normale, INT/TERM, errore
# imprevisto) deve lasciare uno stato coerente in state.json e notificare.
# ---------------------------------------------------------------------------
on_exit() {
    local rc=$?
    if (( STOPPING == 0 )); then
        STOPPING=1
        state_set stage stopped
        log "Arresto: $STOP_REASON (exit=$rc)"
        ntfy "ArtiPop loop: arresto" "$STOP_REASON"
    fi
    return "$rc"
}

on_signal() {
    STOP_REASON="segnale ricevuto (INT/TERM)"
    # L'exit qui attiva il trap EXIT sopra, che scrive stato+notifica.
    exit 130
}

# ---------------------------------------------------------------------------
# Helper git: tutte le operazioni passano da qui per garantire cwd corretta
# (path con spazio) e per centralizzare il logging degli errori.
# ---------------------------------------------------------------------------
git_safe() {
    ( cd "$REPO_DIR" && git "$@" )
}

# git_checkout_production_clean — riporta il repo su auto/production pulito.
# Usata per il recovery difensivo: se qualcosa rompe il ciclo, questo è
# sempre il punto di ritorno sicuro. Aborta eventuali merge/rebase a metà
# prima di tentare il checkout, così non resta mai in uno stato intermedio.
git_checkout_production_clean() {
    git_safe merge --abort >/dev/null 2>&1 || true
    git_safe rebase --abort >/dev/null 2>&1 || true
    if ! git_safe checkout "$PRODUCTION_BRANCH" >/dev/null 2>&1; then
        log "ERRORE: impossibile eseguire checkout di $PRODUCTION_BRANCH, ritento con -f"
        git_safe checkout -f "$PRODUCTION_BRANCH" >/dev/null 2>&1
        return $?
    fi
    return 0
}

# cleanup_cycle_branch <branch> — elimina il branch di ciclo se esiste,
# assumendo che siamo già tornati su auto/production. Mai fallire il ciclo
# per una delete fallita: al più resta un branch locale orfano, innocuo.
cleanup_cycle_branch() {
    local branch="$1"
    [[ -n "$branch" ]] || return 0
    git_safe branch -D "$branch" >/dev/null 2>&1 || true
}

# ---------------------------------------------------------------------------
# CONTROL: PAUSE (poll bloccante) / STOP / KILL fuori da uno stadio.
# ---------------------------------------------------------------------------

# loop_check_control — lettura singola, non bloccante. Stampa GO|PAUSE|STOP|KILL.
loop_check_control() {
    local raw
    raw=$(control_read)
    case "$raw" in
        PAUSE) printf 'PAUSE' ;;
        STOP) printf 'STOP' ;;
        KILL) printf 'KILL' ;;
        "") printf 'GO' ;;
        *)
            log "CONTROL contiene un valore non riconosciuto ('$raw'): ignorato"
            printf 'GO'
            ;;
    esac
}

# loop_await_control_gate — da chiamare a inizio ciclo. Gestisce PAUSE con
# poll ogni 30s (bloccante, come da contratto). KILL qui non ha stadio da
# terminare: lo logga e lo svuota. Stampa GO o STOP.
loop_await_control_gate() {
    local st
    while true; do
        st=$(loop_check_control)
        case "$st" in
            GO) printf 'GO'; return 0 ;;
            STOP) printf 'STOP'; return 0 ;;
            KILL)
                log "CONTROL=KILL ricevuto fuori da uno stadio attivo: ignorato e svuotato"
                control_clear
                ;;
            PAUSE)
                state_set stage paused
                log "In pausa (CONTROL=PAUSE)"
                while [[ "$(loop_check_control)" == "PAUSE" ]]; do
                    sleep 30
                done
                log "Pausa terminata"
                ;;
        esac
    done
}

# ---------------------------------------------------------------------------
# Esecuzione di un singolo stadio claude, con timeout esterno, rilevamento
# KILL durante l'esecuzione, e retry per rate-limit/errori generici.
# ---------------------------------------------------------------------------

# _launch_stage_process <role_file> <model> <max_turns> <timeout_s> <out> <err>
# Avvia claude in background (dentro `timeout`) e mette il PID in STAGE_PID.
# ATTENZIONE: niente command substitution qui — il job in background deve
# nascere come figlio della shell che poi farà `wait`, altrimenti `wait`
# risponde 127 ("not a child of this shell") qualunque cosa faccia claude.
_launch_stage_process() {
    local role_file="$1" model="$2" max_turns="$3" timeout_s="$4" out_file="$5" err_file="$6"
    local prompt
    prompt="$(cat "$role_file" 2>/dev/null; echo; cat "$STAGE_CONTEXT_FILE" 2>/dev/null)"
    (
        cd "$REPO_DIR" || exit 127
        timeout "$timeout_s" claude -p "$prompt" --model "$model" --max-turns "$max_turns" \
            --dangerously-skip-permissions
    ) >>"$out_file" 2>>"$err_file" &
    STAGE_PID=$!
}

# _wait_stage_or_kill <pid> — poll ogni 5s: se compare KILL in CONTROL,
# termina il processo (TERM, poi KILL dopo una breve grazia) e mette
# "KILLED" in STAGE_WAIT_RESULT; altrimenti attende la fine naturale e vi
# mette il suo exit code. Stesso vincolo di _launch_stage_process: niente
# command substitution attorno a questa funzione — `wait` funziona solo
# nella shell madre del processo lanciato.
_wait_stage_or_kill() {
    local pid="$1" killed=0
    while kill -0 "$pid" 2>/dev/null; do
        if [[ "$(loop_check_control)" == "KILL" ]]; then
            killed=1
            kill -TERM "$pid" 2>/dev/null || true
            pkill -TERM -P "$pid" 2>/dev/null || true
            sleep 3
            if kill -0 "$pid" 2>/dev/null; then
                kill -KILL "$pid" 2>/dev/null || true
                pkill -KILL -P "$pid" 2>/dev/null || true
            fi
            break
        fi
        sleep 5
    done
    wait "$pid" 2>/dev/null
    local rc=$?
    if (( killed == 1 )); then
        STAGE_WAIT_RESULT='KILLED'
    else
        STAGE_WAIT_RESULT="$rc"
    fi
}

# _classify_stage_error <err_file> <out_file> — RATE_LIMIT se stderr O stdout
# matchano i pattern di quota/limite, altrimenti ERROR generico. Lo stdout va
# controllato perché claude scrive lì (non su stderr) il limite di spesa
# mensile ("You've hit your monthly spend limit", visto al ciclo 5): senza
# questo check la quota esaurita produceva FALLITO spuri invece dell'attesa.
_classify_stage_error() {
    local err_file="$1" out_file="${2:-}"
    local pat='rate.?limit|usage limit|overloaded|spend limit|limit reached'
    if { [[ -f "$err_file" ]] && grep -qiE "$pat" "$err_file" 2>/dev/null; } \
       || { [[ -n "$out_file" && -f "$out_file" ]] && tail -5 "$out_file" 2>/dev/null | grep -qiE "$pat"; }; then
        printf 'RATE_LIMIT'
    else
        printf 'ERROR'
    fi
}

# run_stage <lettera> <stage_state_name> <role_file> <model> <max_turns> <timeout_s> <out_base>
# Esegue lo stadio con resilienza a rate-limit/errori transitori e a KILL.
# Stampa uno tra: OK | KILLED | STOP | "FALLITO:<motivo>"
run_stage() {
    local letter="$1" state_name="$2" role_file="$3" model="$4" max_turns="$5" timeout_s="$6" out_base="$7"
    local out_file="${out_base}.jsonl" err_file="${out_base}.err"
    local rl_consecutive=0 generic_attempts=0

    while true; do
        local gate
        gate=$(loop_await_control_gate)
        if [[ "$gate" == "STOP" ]]; then
            printf 'STOP'
            return 0
        fi

        state_set stage "$state_name"
        state_set stage_model "$model"

        local pid result
        _launch_stage_process "$role_file" "$model" "$max_turns" "$timeout_s" "$out_file" "$err_file"
        pid="$STAGE_PID"
        _wait_stage_or_kill "$pid"
        result="$STAGE_WAIT_RESULT"

        if [[ "$result" == "KILLED" ]]; then
            printf 'KILLED'
            return 0
        fi

        if [[ "$result" == "0" ]]; then
            printf 'OK'
            return 0
        fi

        local kind
        kind=$(_classify_stage_error "$err_file" "$out_file")
        if [[ "$kind" == "RATE_LIMIT" ]]; then
            rl_consecutive=$((rl_consecutive + 1))
            generic_attempts=0
            local wait_s=1800
            if (( rl_consecutive >= 3 )); then
                wait_s=3600
                ntfy "ArtiPop loop: rate limit" "3 rate-limit consecutivi allo stadio $letter. Attesa ${wait_s}s."
            fi
            log "Stadio $letter: rate-limit rilevato (consecutivi=$rl_consecutive), attesa ${wait_s}s"
            state_set stage waiting_quota
            state_set next_retry_at "$(iso_after_seconds "$wait_s")"
            sleep "$wait_s"
            continue
        fi

        generic_attempts=$((generic_attempts + 1))
        rl_consecutive=0
        if (( generic_attempts > MAX_GENERIC_RETRIES )); then
            printf 'FALLITO:errore persistente allo stadio %s dopo %d tentativi (ultimo exit=%s)' \
                "$letter" "$MAX_GENERIC_RETRIES" "$result"
            return 0
        fi
        log "Stadio $letter: errore (exit=$result, tentativo $generic_attempts/$MAX_GENERIC_RETRIES), attesa 300s"
        state_set stage waiting_quota
        state_set next_retry_at "$(iso_after_seconds 300)"
        sleep 300
    done
}

# ---------------------------------------------------------------------------
# stage-context.txt — scritto prima di ogni invocazione claude.
# ---------------------------------------------------------------------------

# write_stage_context <run> <mode> <objective> <model> [plan_budget_ai]
write_stage_context() {
    local run="$1" mode="$2" objective="$3" model="$4" plan_budget="${5:-}"
    {
        printf 'MODALITA: %s\n' "$mode"
        printf 'RUN: %s\n' "$run"
        printf 'OBIETTIVO_CONTESTO: %s\n' "$objective"
        printf 'MODELLO_STADIO: %s\n' "$model"
        if [[ -n "$plan_budget" ]]; then
            printf 'BUDGET_AI_DICHIARATO_DAL_PIANO: %s/10 (limite per ciclo: 10, solo preview)\n' "$plan_budget"
        else
            printf 'BUDGET_AI_DICHIARATO_DAL_PIANO: non ancora definito (limite per ciclo: 10, solo preview)\n'
        fi
        if [[ "$model" == "fable" ]]; then
            printf '\n--- ESCALATION A FABLE: log fallimenti precedenti per "%s" ---\n' "$objective"
            improvements_context_dump "$IMPROVEMENTS_FILE" "$objective"
        fi
    } > "$STAGE_CONTEXT_FILE"
}

# ---------------------------------------------------------------------------
# Scelta del modello planner (sezione "Scelta modello planner" del contratto)
# ---------------------------------------------------------------------------

# choose_build_planner_model <milestone> — stampa "opus|fable|BLOCCATO".
choose_build_planner_model() {
    local milestone="$1" fails has_fable
    read -r fails has_fable < <(improvements_milestone_stats "$IMPROVEMENTS_FILE" "$milestone")
    if (( fails == 0 )); then
        printf 'opus'
    elif [[ "$has_fable" == "0" ]]; then
        printf 'fable'
    else
        printf 'BLOCCATO'
    fi
}

# choose_polish_replan_model <slug> — dopo aver letto lo slug dal PLAN.md
# generato da opus, stampa "none" (nessuna escalation), "fable" (rifare lo
# stadio A con fable) o "BLOCCATO".
choose_polish_replan_model() {
    local slug="$1" fails has_fable
    read -r fails has_fable < <(improvements_slug_stats "$IMPROVEMENTS_FILE" "$slug")
    if (( fails == 0 )); then
        printf 'none'
    elif [[ "$has_fable" == "0" ]]; then
        printf 'fable'
    else
        printf 'BLOCCATO'
    fi
}

# ---------------------------------------------------------------------------
# Registro: ogni percorso del ciclo finisce SEMPRE qui (contratto: riga
# d'esempio sempre appesa su auto/production, mai sul branch di ciclo).
# ---------------------------------------------------------------------------

# finalize_registry <run> <tipo> <area> <obiettivo> <filelist> <planner> <esito> <branch> <deploy>
# Garantisce di essere su auto/production, appende la riga, esegue git add
# mirato (mai add -A) e commit. Se ROADMAP_DIRTY=1 (impostata dal chiamante
# quando ha marcato una milestone BLOCCATA) include anche ROADMAP.md.
finalize_registry() {
    local run="$1" tipo="$2" area="$3" obiettivo="$4" filelist="$5" planner="$6" esito="$7" branch="$8" deploy="$9"

    if ! git_checkout_production_clean; then
        log "ERRORE CRITICO: impossibile tornare su $PRODUCTION_BRANCH per registrare il ciclo $run — registro NON aggiornato per questo ciclo"
        ntfy "ArtiPop loop: errore critico" "Ciclo $run: impossibile tornare su $PRODUCTION_BRANCH, registro non aggiornato. Verificare manualmente."
        return 1
    fi

    improvements_append_row "$IMPROVEMENTS_FILE" "$(now_registro)" "$tipo" "$area" "$obiettivo" "$filelist" "$planner" "$esito" "$branch" "$deploy"

    local add_args=("$IMPROVEMENTS_FILE")
    if [[ "${ROADMAP_DIRTY:-0}" == "1" ]]; then
        add_args+=("$ROADMAP_FILE")
    fi

    if ! git_safe add "${add_args[@]}"; then
        log "ERRORE: git add del registro fallito al ciclo $run"
        return 1
    fi
    local commit_err
    if ! commit_err=$(git_safe commit -m "ciclo $run: registro — $esito ($obiettivo)" 2>&1 >/dev/null); then
        # Il motivo vero nel log: un "probabilmente" ha già nascosto un errore
        # di identità git durante il dry-run 1.
        log "ERRORE: commit del registro fallito al ciclo $run: ${commit_err:-motivo ignoto}"
    fi

    ROADMAP_DIRTY=0
    return 0
}

# esito_to_counter_key <esito> — mappa la stringa esito sulla chiave counters.*
esito_to_counter_key() {
    case "$1" in
        FATTO) printf 'FATTO' ;;
        DUPLICATO) printf 'DUPLICATO' ;;
        SCARTATO|NESSUNA-PROPOSTA) printf 'SCARTATO' ;;
        FALLITO\(EXEC\)) printf 'FALLITO_EXEC' ;;
        FALLITO\(VERIFY\)) printf 'FALLITO_VERIFY' ;;
        FALLITO\(DEPLOY\)) printf 'FALLITO_DEPLOY' ;;
        BLOCCATO) printf 'BLOCCATO' ;;
        *) printf '' ;;
    esac
}

# record_result <esito> — unico punto che aggiorna insieme counters.* e
# last_result in state.json. Centralizzare qui la mappatura esito->contatore
# (invece di ripetere "state_incr_counter X; state_set last_result Y" ad ogni
# uscita del ciclo) evita che le due scritture si disallineino per un
# copia-incolla sbagliato in uno dei tanti punti di uscita di do_cycle.
record_result() {
    local esito="$1" key
    key=$(esito_to_counter_key "$esito")
    if [[ -n "$key" ]]; then
        state_incr_counter "$key"
    else
        log "ATTENZIONE: esito '$esito' senza contatore corrispondente in state.json"
    fi
    state_set last_result "$esito"
}

# notify_for_result <esito> <titolo-contestuale> <corpo>
# Rispetta l'elenco eventi del contratto: MAI notificare DUPLICATO/SCARTATO/
# NESSUNA-PROPOSTA (rumore atteso, non un evento).
notify_for_result() {
    local esito="$1" title="$2" body="$3"
    case "$esito" in
        DUPLICATO|SCARTATO|NESSUNA-PROPOSTA) return 0 ;;
        *) ntfy "$title" "$body" ;;
    esac
}

# ---------------------------------------------------------------------------
# Digest periodico (ogni 6h)
# ---------------------------------------------------------------------------
maybe_send_digest() {
    digest_due || return 0
    local fatto duplicato scartato fexec fverify fdeploy bloccato
    fatto=$(state_get "counters.FATTO")
    duplicato=$(state_get "counters.DUPLICATO")
    scartato=$(state_get "counters.SCARTATO")
    fexec=$(state_get "counters.FALLITO_EXEC")
    fverify=$(state_get "counters.FALLITO_VERIFY")
    fdeploy=$(state_get "counters.FALLITO_DEPLOY")
    bloccato=$(state_get "counters.BLOCCATO")
    local m_done m_total
    read -r m_total m_done < <(roadmap_counts "$ROADMAP_FILE")
    local dep_ver dep_url dep_smoke
    dep_ver=$(state_get "last_deploy.version")
    dep_url=$(state_get "last_deploy.url")
    dep_smoke=$(state_get "last_deploy.smoke")
    local body
    body="Milestone ${m_done}/${m_total}. Esiti: FATTO=${fatto} DUPLICATO=${duplicato} SCARTATO=${scartato} FALLITO(EXEC)=${fexec} FALLITO(VERIFY)=${fverify} FALLITO(DEPLOY)=${fdeploy} BLOCCATO=${bloccato}. Ultimo deploy: v=${dep_ver:-—} url=${dep_url:-—} smoke=${dep_smoke:-—}."
    ntfy "ArtiPop loop: digest 6h" "$body"
    state_set last_digest "$(now_iso)"
}

# ---------------------------------------------------------------------------
# Stop "successo" in POLISH: 5 esiti consecutivi tutti in
# {DUPLICATO, SCARTATO, NESSUNA-PROPOSTA} (letti dal registro, non da un
# contatore separato: così la regola sopravvive ai riavvii del loop).
# ---------------------------------------------------------------------------
polish_should_stop() {
    local results count=0 total=0 r
    results=$(improvements_last_n_results "$IMPROVEMENTS_FILE" 5)
    [[ -z "$results" ]] && return 1
    while IFS= read -r r; do
        [[ -z "$r" ]] && continue
        total=$((total + 1))
        case "$r" in
            DUPLICATO|SCARTATO|NESSUNA-PROPOSTA) count=$((count + 1)) ;;
        esac
    done <<< "$results"
    (( total >= 5 && count == total ))
}

# ---------------------------------------------------------------------------
# Deploy (stadio 7): scripts/deploy.sh NON è un eseguibile "fai tutto" — è una
# libreria di funzioni (deploy_preview, save_production_version,
# deploy_production, rollback_production) pensata apposta per essere
# sorgentata con `--lib` e orchestrata da qui (il suo stesso commento
# d'intestazione lo dice esplicitamente). L'orchestrazione preview → salva
# versione live → produzione → eventuale rollback è quindi compito del loop,
# così come il `git revert -m 1` del merge in caso di fallimento (deploy.sh
# non conosce i commit del loop).
# ---------------------------------------------------------------------------

# run_deploy <run> <merge_commit_sha> — stampa "OK" o "FALLITO:<motivo>".
# Effetti collaterali: aggiorna state.json (stage/last_deploy), su
# fallimento esegue `git revert -m 1` del merge su auto/production.
#
# NOTA sul parsing dell'output: deploy_preview/deploy_production/
# rollback_production stampano TUTTE una riga "VERSION: <id>" (una per
# ambiente/versione), quindi un grep grezzo "prima riga VERSION:" prenderebbe
# quella sbagliata (la preview, non la produzione). Per questo il blocco
# sotto ricalcola smoke/versione/URL di produzione dalle sole variabili
# locali del proprio stadio e li ristampa con chiavi univoche (FINAL_*) che
# scripts/deploy.sh non usa mai: deploy_extract_version/url in loop-lib.sh
# leggono quelle per prime.
run_deploy() {
    local run="$1" merge_sha="$2"
    local out_file="$REPO_DIR/logs/run${run}-deploy.log"
    local err_file="$REPO_DIR/logs/run${run}-deploy.err"

    state_set stage deploy
    state_set stage_model "-"

    (
        cd "$REPO_DIR" || exit 127
        # shellcheck source=/dev/null
        source "$DEPLOY_SCRIPT" --lib

        preview_out=$(deploy_preview); preview_rc=$?
        printf '%s\n' "$preview_out"
        smoke_preview="fail"
        printf '%s\n' "$preview_out" | grep -q '^SMOKE: ok$' && smoke_preview="ok"
        echo "FINAL_SMOKE_PREVIEW: $smoke_preview"

        if (( preview_rc != 0 )); then
            echo "RESULT: FAILED"
            echo "FAILED_STAGE: preview"
            exit 1
        fi

        live_out=$(save_production_version); live_rc=$?
        printf '%s\n' "$live_out"
        live_version=$(printf '%s\n' "$live_out" | grep -m1 '^VERSION:' | sed -E 's/^VERSION:[[:space:]]*//')
        if (( live_rc != 0 )) || [[ -z "$live_version" ]]; then
            echo "RESULT: FAILED"
            echo "FAILED_STAGE: save-live-version"
            exit 1
        fi
        echo "LIVE_VERSION_BEFORE: $live_version"

        prod_out=$(deploy_production); prod_rc=$?
        printf '%s\n' "$prod_out"
        prod_version=$(printf '%s\n' "$prod_out" | grep -m1 '^VERSION:' | sed -E 's/^VERSION:[[:space:]]*//')
        prod_url=$(printf '%s\n' "$prod_out" | grep -m1 '^URL:' | sed -E 's/^URL:[[:space:]]*//')
        smoke_prod="fail"
        printf '%s\n' "$prod_out" | grep -q '^SMOKE: ok$' && smoke_prod="ok"

        echo "FINAL_VERSION: ${prod_version:-$live_version}"
        echo "FINAL_URL: ${prod_url:-}"
        echo "FINAL_SMOKE_PROD: $smoke_prod"

        if (( prod_rc != 0 )); then
            echo "==> Deploy/smoke produzione falliti: rollback alla versione precedente $live_version"
            if rollback_production "$live_version" "deploy/smoke produzione falliti (ciclo loop run $run)"; then
                echo "ROLLBACK: done"
            else
                echo "ROLLBACK: failed"
            fi
            echo "RESULT: FAILED"
            echo "FAILED_STAGE: production"
            exit 1
        fi

        echo "ROLLBACK: none"
        echo "RESULT: SUCCESS"
    ) >"$out_file" 2>"$err_file"
    local rc=$?

    local version url smoke_prod
    version=$(deploy_extract_version "$out_file")
    url=$(deploy_extract_url "$out_file")
    smoke_prod=$(deploy_field "$out_file" "FINAL_SMOKE_PROD")

    if (( rc == 0 )) && deploy_is_success "$out_file"; then
        state_set_last_deploy "${version:-?}" "${url:-?}" "${smoke_prod:-ok}" "$(now_iso)"
        printf 'OK'
        return 0
    fi

    local failed_stage rollback_status
    failed_stage=$(deploy_field "$out_file" "FAILED_STAGE")
    rollback_status=$(deploy_field "$out_file" "ROLLBACK")
    log "Deploy fallito al ciclo $run (stadio=$failed_stage, rollback=$rollback_status). Vedi $out_file / $err_file"
    state_set_last_deploy "${version:-}" "${url:-}" "${smoke_prod:-fail}" "$(now_iso)"

    if [[ -n "$merge_sha" ]]; then
        if ! git_safe revert -m 1 --no-edit "$merge_sha" >/dev/null 2>&1; then
            log "ERRORE: git revert del merge $merge_sha fallito dopo deploy fallito — richiede intervento manuale"
            ntfy "ArtiPop loop: ERRORE CRITICO" "Deploy fallito e revert del merge $merge_sha non riuscito. Intervento manuale richiesto."
        fi
    fi

    printf 'FALLITO:deploy fallito allo stadio %s (rollback=%s)' "${failed_stage:-sconosciuto}" "${rollback_status:-n/a}"
}

# ---------------------------------------------------------------------------
# do_cycle <run> — un intero ciclo: checkout branch, stadio A, [B, C, deploy],
# registrazione SEMPRE finale. Ogni uscita anticipata passa da finalize_registry.
# ---------------------------------------------------------------------------
do_cycle() {
    local run="$1"
    log "=== inizio ciclo $run ==="

    local mode
    mode=$(roadmap_mode "$ROADMAP_FILE")
    state_set mode "$mode"

    local m_total m_done
    read -r m_total m_done < <(roadmap_counts "$ROADMAP_FILE")
    state_set milestones_total "$m_total" int
    state_set milestones_done "$m_done" int

    if ! git_checkout_production_clean; then
        log "ERRORE: checkout $PRODUCTION_BRANCH fallito a inizio ciclo $run, salto il ciclo"
        return 1
    fi

    local ts branch
    ts=$(date -u +'%Y%m%d-%H%M%S')
    branch="auto/${ts}"
    if ! git_safe checkout -b "$branch" >/dev/null 2>&1; then
        log "ERRORE: creazione branch $branch fallita, salto il ciclo"
        return 1
    fi

    ROADMAP_DIRTY=0
    local planner_model="" objective_ctx="" milestone=""

    if [[ "$mode" == "BUILD" ]]; then
        milestone=$(roadmap_first_open_milestone "$ROADMAP_FILE")
        if [[ -z "$milestone" ]]; then
            # roadmap_mode ha detto BUILD ma non troviamo più la milestone:
            # incoerenza difensiva (es. modifica concorrente del file).
            log "ATTENZIONE: mode=BUILD ma nessuna milestone APERTA trovata, tratto come POLISH per questo ciclo"
            mode="POLISH"
            planner_model="opus"
            objective_ctx="POLISH"
        else
            planner_model=$(choose_build_planner_model "$milestone")
            if [[ "$planner_model" == "BLOCCATO" ]]; then
                roadmap_mark_blocked "$ROADMAP_FILE" "$milestone" "piani opus+fable falliti"
                ROADMAP_DIRTY=1
                record_result BLOCCATO
                git_checkout_production_clean
                cleanup_cycle_branch "$branch"
                finalize_registry "$run" "$mode" "-" "${milestone,,}-bloccata" "-" "-" "BLOCCATO" "-" "-"
                notify_for_result BLOCCATO "ArtiPop loop: BLOCCATO" "Milestone $milestone bloccata: piani opus e fable entrambi falliti."
                return 0
            fi
            objective_ctx="$milestone"
        fi
    else
        planner_model="opus"
        objective_ctx="POLISH"
    fi

    if [[ "$planner_model" == "fable" ]]; then
        local esc
        esc=$(state_get "fable_escalations")
        [[ -z "$esc" ]] && esc=0
        state_set fable_escalations "$((esc + 1))" int
        notify_for_result "ESCALATION" "ArtiPop loop: escalation Fable" "Ciclo $run: planner escalato a Fable per $objective_ctx (fallimenti precedenti con opus)."
    fi

    # ---- STAGE A: planner ----
    write_stage_context "$run" "$mode" "$objective_ctx" "$planner_model"
    rm -f "$PLAN_FILE"
    local a_result
    a_result=$(run_stage "a" "plan" "$ROLE_PLANNER" "$planner_model" "$MAXTURNS_A" "$TIMEOUT_A" "$REPO_DIR/logs/run${run}-a")

    if [[ "$a_result" == "STOP" ]]; then
        git_checkout_production_clean
        cleanup_cycle_branch "$branch"
        STOP_REASON="STOP da CONTROL (durante stadio A, ciclo $run)"
        return 2
    fi
    if [[ "$a_result" == "KILLED" ]]; then
        git_checkout_production_clean
        cleanup_cycle_branch "$branch"
        record_result SCARTATO
        finalize_registry "$run" "$mode" "-" "kill-stadio-a" "-" "$planner_model" "SCARTATO" "$branch" "-"
        log "Ciclo $run: KILL ricevuto durante stadio A"
        return 0
    fi
    if [[ "$a_result" != "OK" ]]; then
        git_checkout_production_clean
        cleanup_cycle_branch "$branch"
        record_result "FALLITO(EXEC)"
        finalize_registry "$run" "$mode" "-" "errore-stadio-a" "-" "$planner_model" "FALLITO(EXEC)" "$branch" "-"
        notify_for_result "FALLITO(EXEC)" "ArtiPop loop: FALLITO" "Ciclo $run: stadio A (planner) fallito: ${a_result#FALLITO:}"
        return 0
    fi

    if plan_is_no_proposal "$PLAN_FILE"; then
        git_checkout_production_clean
        cleanup_cycle_branch "$branch"
        finalize_registry "$run" "$mode" "-" "nessuna-proposta" "-" "$planner_model" "NESSUNA-PROPOSTA" "$branch" "-"
        log "Ciclo $run: NESSUNA PROPOSTA"
        if [[ "$mode" == "POLISH" ]] && polish_should_stop; then
            record_result "NESSUNA-PROPOSTA"
            STOP_REASON="successo POLISH: 5 cicli consecutivi senza proposte utili (DUPLICATO/SCARTATO/NESSUNA-PROPOSTA)"
            ntfy "ArtiPop loop: POLISH completato" "$STOP_REASON"
            return 2
        fi
        record_result "NESSUNA-PROPOSTA"
        return 0
    fi

    local slug tipo area file_list budget_ai
    slug=$(plan_get_slug "$PLAN_FILE")
    tipo=$(plan_get_tipo "$PLAN_FILE")
    area=$(plan_get_area "$PLAN_FILE")
    file_list=$(plan_get_file "$PLAN_FILE")
    # Sintesi umana del piano (prima riga della MOTIVAZIONE): accompagna ogni
    # notifica ntfy dell'esito, così dal telefono si capisce COSA stava cambiando.
    local sintesi
    sintesi=$(plan_summary "$PLAN_FILE")
    budget_ai=$(plan_get_budget_ai "$PLAN_FILE")

    if [[ -z "$slug" ]]; then
        git_checkout_production_clean
        cleanup_cycle_branch "$branch"
        finalize_registry "$run" "$mode" "$area" "piano-senza-obiettivo" "$file_list" "$planner_model" "FALLITO(EXEC)" "$branch" "-"
        notify_for_result "FALLITO(EXEC)" "ArtiPop loop: FALLITO" "Ciclo $run: PLAN.md senza campo OBIETTIVO valido"
        return 0
    fi

    # ---- Rilettura slug in POLISH: eventuale escalation a fable e nuova stadio A ----
    if [[ "$mode" == "POLISH" ]]; then
        local replan
        replan=$(choose_polish_replan_model "$slug")
        if [[ "$replan" == "BLOCCATO" ]]; then
            # POLISH non ha una milestone associata (per definizione: si entra in
            # POLISH quando ROADMAP.md non ha più nulla APERTA): il blocco qui
            # vive solo nel registro. La riga BLOCCATO per questo slug è ciò che
            # fa da "dedup" per il prossimo planner (legge IMPROVEMENTS.md e non
            # riproporrà lo stesso obiettivo).
            record_result BLOCCATO
            git_checkout_production_clean
            cleanup_cycle_branch "$branch"
            finalize_registry "$run" "$mode" "$area" "$slug" "$file_list" "$planner_model" "BLOCCATO" "$branch" "-"
            notify_for_result BLOCCATO "ArtiPop loop: BLOCCATO" "Ciclo $run: obiettivo POLISH '$slug' bloccato (piani opus+fable falliti)."
            return 0
        elif [[ "$replan" == "fable" ]]; then
            planner_model="fable"
            local esc2
            esc2=$(state_get "fable_escalations")
            [[ -z "$esc2" ]] && esc2=0
            state_set fable_escalations "$((esc2 + 1))" int
            notify_for_result "ESCALATION" "ArtiPop loop: escalation Fable" "Ciclo $run: ripiano POLISH escalato a Fable per '$slug'."
            write_stage_context "$run" "$mode" "$slug" "$planner_model"
            rm -f "$PLAN_FILE"
            a_result=$(run_stage "a" "plan" "$ROLE_PLANNER" "$planner_model" "$MAXTURNS_A" "$TIMEOUT_A" "$REPO_DIR/logs/run${run}-a")
            if [[ "$a_result" == "STOP" ]]; then
                git_checkout_production_clean; cleanup_cycle_branch "$branch"
                STOP_REASON="STOP da CONTROL (durante ripiano stadio A, ciclo $run)"
                return 2
            fi
            if [[ "$a_result" == "KILLED" ]]; then
                git_checkout_production_clean; cleanup_cycle_branch "$branch"
                finalize_registry "$run" "$mode" "$area" "kill-ripiano-stadio-a" "$file_list" "$planner_model" "SCARTATO" "$branch" "-"
                return 0
            fi
            if [[ "$a_result" != "OK" ]] || plan_is_no_proposal "$PLAN_FILE"; then
                git_checkout_production_clean; cleanup_cycle_branch "$branch"
                local esito_np="NESSUNA-PROPOSTA"
                [[ "$a_result" != "OK" ]] && esito_np="FALLITO(EXEC)"
                finalize_registry "$run" "$mode" "$area" "$slug" "$file_list" "$planner_model" "$esito_np" "$branch" "-"
                notify_for_result "$esito_np" "ArtiPop loop: $esito_np" "Ciclo $run: ripiano con Fable per '$slug' non ha prodotto un piano valido."
                return 0
            fi
            slug=$(plan_get_slug "$PLAN_FILE")
            tipo=$(plan_get_tipo "$PLAN_FILE")
            area=$(plan_get_area "$PLAN_FILE")
            file_list=$(plan_get_file "$PLAN_FILE")
            budget_ai=$(plan_get_budget_ai "$PLAN_FILE")
        fi
    fi

    local obiettivo_registro="$slug"

    # ---- STAGE B: executor (sempre sonnet) ----
    write_stage_context "$run" "$mode" "$objective_ctx" "sonnet" "$budget_ai"
    local b_result
    b_result=$(run_stage "b" "exec" "$ROLE_EXECUTOR" "sonnet" "$MAXTURNS_B" "$TIMEOUT_B" "$REPO_DIR/logs/run${run}-b")

    if [[ "$b_result" == "STOP" ]]; then
        git_checkout_production_clean; cleanup_cycle_branch "$branch"
        STOP_REASON="STOP da CONTROL (durante stadio B, ciclo $run)"
        return 2
    fi
    if [[ "$b_result" == "KILLED" ]]; then
        git_checkout_production_clean; cleanup_cycle_branch "$branch"
        finalize_registry "$run" "$mode" "$area" "$obiettivo_registro" "$file_list" "$planner_model" "SCARTATO" "$branch" "-"
        log "Ciclo $run: KILL ricevuto durante stadio B"
        return 0
    fi

    local esito_exec=""
    if [[ "$b_result" == "OK" ]]; then
        # stdout dello stadio B è in logs/run<N>-b.jsonl: la sentinella ESITO
        # deve stare tra le ULTIME righe. I modelli a volte la avvolgono in un
        # blocco di codice markdown (ciclo 2 del dry-run: lavoro perfetto perso
        # perché l'ultima riga letterale era la chiusura del fence): si
        # scartano le righe-fence e si cerca l'ultima "ESITO:" nelle ultime 15
        # righe non vuote, invece di pretendere l'ultima riga esatta.
        local last_line
        last_line=$(grep -vE '^[[:space:]]*$' "$REPO_DIR/logs/run${run}-b.jsonl" 2>/dev/null \
            | tail -15 | grep -vE '^[[:space:]]*(```|~~~)' \
            | grep -E '^[[:space:]]*ESITO:' | tail -1 \
            | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
        case "$last_line" in
            "ESITO: OK") esito_exec="OK" ;;
            ESITO:\ FALLITO\(EXEC\):*) esito_exec="FALLITO(EXEC):${last_line#ESITO: FALLITO(EXEC):}" ;;
            *) esito_exec="FALLITO(EXEC):output stadio B non conforme (nessuna sentinella ESITO nelle ultime righe)" ;;
        esac
    else
        esito_exec="FALLITO(EXEC):${b_result#FALLITO:}"
    fi

    if [[ "$esito_exec" != "OK" ]]; then
        # Il motivo va anche nel log, non solo nella notifica: due falsi
        # negativi del dry-run sono rimasti invisibili proprio per questo.
        log "Ciclo $run: stadio B fallito — ${esito_exec#FALLITO(EXEC):} (b_result=$b_result)"
        git_checkout_production_clean; cleanup_cycle_branch "$branch"
        record_result "FALLITO(EXEC)"
        finalize_registry "$run" "$mode" "$area" "$obiettivo_registro" "$file_list" "$planner_model" "FALLITO(EXEC)" "$branch" "-"
        notify_for_result "FALLITO(EXEC)" "ArtiPop loop: FALLITO(EXEC)" "Ciclo $run '$obiettivo_registro' (${sintesi:-senza sintesi}): ${esito_exec#FALLITO(EXEC):}"
        return 0
    fi

    # ---- STAGE C: verifier (sempre sonnet) ----
    rm -f "$VERDICT_FILE"
    write_stage_context "$run" "$mode" "$objective_ctx" "sonnet" "$budget_ai"
    local c_result
    c_result=$(run_stage "c" "verify" "$ROLE_VERIFIER" "sonnet" "$MAXTURNS_C" "$TIMEOUT_C" "$REPO_DIR/logs/run${run}-c")

    if [[ "$c_result" == "STOP" ]]; then
        git_checkout_production_clean; cleanup_cycle_branch "$branch"
        STOP_REASON="STOP da CONTROL (durante stadio C, ciclo $run)"
        return 2
    fi
    if [[ "$c_result" == "KILLED" ]]; then
        git_checkout_production_clean; cleanup_cycle_branch "$branch"
        finalize_registry "$run" "$mode" "$area" "$obiettivo_registro" "$file_list" "$planner_model" "SCARTATO" "$branch" "-"
        log "Ciclo $run: KILL ricevuto durante stadio C"
        return 0
    fi
    if [[ "$c_result" != "OK" ]]; then
        git_checkout_production_clean; cleanup_cycle_branch "$branch"
        record_result "FALLITO(VERIFY)"
        finalize_registry "$run" "$mode" "$area" "$obiettivo_registro" "$file_list" "$planner_model" "FALLITO(VERIFY)" "$branch" "-"
        notify_for_result "FALLITO(VERIFY)" "ArtiPop loop: FALLITO(VERIFY)" "Ciclo $run '$obiettivo_registro': stadio C fallito (${c_result#FALLITO:})"
        return 0
    fi

    if ! verdict_is_pass "$VERDICT_FILE"; then
        local reason
        reason=$(verdict_reason "$VERDICT_FILE")
        git_checkout_production_clean; cleanup_cycle_branch "$branch"
        record_result "FALLITO(VERIFY)"
        finalize_registry "$run" "$mode" "$area" "$obiettivo_registro" "$file_list" "$planner_model" "FALLITO(VERIFY)" "$branch" "-"
        notify_for_result "FALLITO(VERIFY)" "ArtiPop loop: FALLITO(VERIFY)" "Ciclo $run '$obiettivo_registro' (${sintesi:-senza sintesi}): $reason"
        return 0
    fi

    # ---- PASS: merge su auto/production ----
    local baseline_files
    baseline_files=$(verdict_baseline_files "$VERDICT_FILE")

    if ! git_checkout_production_clean; then
        log "ERRORE CRITICO: impossibile tornare su $PRODUCTION_BRANCH dopo PASS del ciclo $run"
        cleanup_cycle_branch "$branch"
        record_result "FALLITO(VERIFY)"
        # Caso limite: niente finalize_registry qui, perché non siamo nemmeno
        # riusciti a tornare su auto/production per poter committare la riga
        # del registro. Notifichiamo comunque: è uno stato che richiede
        # intervento manuale (il branch di ciclo è già stato eliminato sopra).
        ntfy "ArtiPop loop: ERRORE CRITICO" "Ciclo $run: verdetto PASS ma impossibile tornare su $PRODUCTION_BRANCH per il merge. Registro non aggiornato per questo ciclo, verificare manualmente."
        return 1
    fi

    local milestone_status_before=""
    [[ -n "$milestone" ]] && milestone_status_before=$(roadmap_milestone_status "$ROADMAP_FILE" "$milestone")

    if ! git_safe merge --no-ff "$branch" -m "ciclo ${run}: ${obiettivo_registro} — FATTO" >/dev/null 2>&1; then
        log "ERRORE: merge --no-ff di $branch fallito, verifico se e' un conflitto reale"
        git_safe merge --abort >/dev/null 2>&1 || true
        git_checkout_production_clean
        cleanup_cycle_branch "$branch"
        record_result "FALLITO(VERIFY)"
        finalize_registry "$run" "$mode" "$area" "$obiettivo_registro" "$file_list" "$planner_model" "FALLITO(VERIFY)" "$branch" "-"
        notify_for_result "FALLITO(VERIFY)" "ArtiPop loop: FALLITO(VERIFY)" "Ciclo $run '$obiettivo_registro': merge --no-ff fallito (conflitto inatteso)"
        return 0
    fi

    local merge_sha
    merge_sha=$(git_safe rev-parse HEAD)
    cleanup_cycle_branch "$branch"

    if [[ -n "$baseline_files" ]]; then
        local f copied=0
        for f in $baseline_files; do
            if [[ -f "$REPO_DIR/artifacts/$f" ]]; then
                cp -f "$REPO_DIR/artifacts/$f" "$REPO_DIR/tests/visual/baseline/$f" && copied=1
            else
                log "ATTENZIONE: BASELINE chiede di aggiornare '$f' ma artifacts/$f non esiste"
            fi
        done
        if (( copied == 1 )); then
            git_safe add "$REPO_DIR/tests/visual/baseline" >/dev/null 2>&1
            git_safe commit -m "ciclo ${run}: aggiorna baseline visiva (${obiettivo_registro})" >/dev/null 2>&1 || true
        fi
    fi

    # ---- Deploy ----
    local deploy_result
    deploy_result=$(run_deploy "$run" "$merge_sha")

    if [[ "$deploy_result" == "OK" ]]; then
        record_result FATTO
        local dep_ver dep_url
        dep_ver=$(state_get "last_deploy.version")
        dep_url=$(state_get "last_deploy.url")
        finalize_registry "$run" "$mode" "$area" "$obiettivo_registro" "$file_list" "$planner_model" "FATTO" "$branch" "$dep_ver"
        notify_for_result "FATTO" "ArtiPop loop: FATTO" "Ciclo $run '$obiettivo_registro' completato: ${sintesi:-senza sintesi}. Deploy v${dep_ver} — ${dep_url}"

        if [[ -n "$milestone" ]]; then
            local milestone_status_after
            milestone_status_after=$(roadmap_milestone_status "$ROADMAP_FILE" "$milestone")
            if [[ "$milestone_status_before" != "$milestone_status_after" && "$milestone_status_after" == "FATTA" ]]; then
                notify_for_result "FATTO" "ArtiPop loop: milestone completata" "Milestone $milestone segnata FATTA dall'executor al ciclo $run."
            fi
        fi
    else
        record_result "FALLITO(DEPLOY)"
        finalize_registry "$run" "$mode" "$area" "$obiettivo_registro" "$file_list" "$planner_model" "FALLITO(DEPLOY)" "$branch" "-"
        notify_for_result "FALLITO(DEPLOY)" "ArtiPop loop: FALLITO(DEPLOY) + rollback" "Ciclo $run '$obiettivo_registro': ${deploy_result#FALLITO:}. Merge revertito su $PRODUCTION_BRANCH."
    fi

    return 0
}

# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------
main() {
    mkdir -p "$REPO_DIR/logs" "$REPO_DIR/artifacts"
    if ! command -v timeout >/dev/null 2>&1; then
        log "ERRORE FATALE: comando 'timeout' non disponibile (richiesto da contratto per gli stadi claude)"
        STOP_REASON="ambiente privo del comando 'timeout' (GNU coreutils atteso nel container)"
        exit 1
    fi

    trap on_exit EXIT
    trap on_signal INT TERM

    state_init "$MAX_RUNS"
    log "Avvio loop (MAX_RUNS=$MAX_RUNS, REPO_DIR=$REPO_DIR)"
    ntfy "ArtiPop loop: avvio" "Loop avviato. MAX_RUNS=$MAX_RUNS."

    local run
    run=$(runcount_read)

    while (( run < MAX_RUNS )); do
        local gate
        gate=$(loop_await_control_gate)
        if [[ "$gate" == "STOP" ]]; then
            STOP_REASON="STOP da CONTROL (tra un ciclo e l'altro)"
            control_clear
            break
        fi

        run=$((run + 1))
        runcount_write "$run"
        state_set run "$run" int

        do_cycle "$run"
        local cycle_rc=$?
        if (( cycle_rc == 2 )); then
            # STOP richiesto durante uno stadio del ciclo appena concluso.
            control_clear
            break
        fi

        maybe_send_digest
    done

    if (( run >= MAX_RUNS )); then
        STOP_REASON="MAX_RUNS raggiunto (${MAX_RUNS})"
    fi
}

# Consente di sorgentare questo file (es. dai self-test) senza eseguire main.
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
