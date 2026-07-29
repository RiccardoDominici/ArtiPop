# ArtiPop · Tuning

Strumento locale per il maintainer: osservare l'archivio, provare combinazioni
concept×element nel Lab, tarare i range con cui il cancello giudica un giorno
e pubblicarli in produzione. **Non fa parte del sito** né del deploy del
Worker — è un file HTML che vive nel repo e si usa da solo, sul proprio
computer.

## Come si apre

Doppio click su [`index.html`](index.html). Funziona da `file://`, senza
build e senza server locale: niente `npm install`, niente bundler. Gli script
sono classici (`<script src="...">` in ordine di dipendenza, nessun modulo
ES) perché `file://` blocca `import`/`export` e il fetch di file locali.

## Come ci si connette

In alto a sinistra:

- **URL del Worker** — di default quello di produzione
  (`https://artipop.riccardo-dominici.workers.dev`): il tool si connette da
  solo all'avvio, in **sola lettura**, per le GET pubbliche (`/api/channels`,
  `/api/archive/<canale>`, `/catalogo`, `/note`, `GET /tuning`). Per puntare a
  un worker locale (`npx wrangler dev`) basta sovrascrivere il campo.
- **Chiave admin** — richiesta solo quando serve *scrivere*: lanciare un run
  nel Lab, salvare un concept/element nel Catalogo, pubblicare un range,
  marcare un giorno. Senza chiave il tool resta comunque utilizzabile in
  lettura.

"salva credenziali" le tiene in `localStorage` (chiavi `artipop_base` e
`artipop_key`) sul browser di chi lo usa — non finiscono mai nel repo.

## Le quattro tab

| Tab | A quale domanda risponde |
|---|---|
| **Archivio** *(home)* | Cos'ha prodotto il sistema finora, e come è nato ciascuno sfondo? |
| **Lab** | Proviamo una combinazione concept×element — sapendo cosa è già successo con lei |
| **Catalogo** | Quali concept ed element esistono, e chi è usato dove? |
| **Range** | Come giudica il cancello oggi, e cosa rischio se cambio un range? |

La tab attiva e i filtri vivono nell'hash dell'URL (es.
`#archivio?concept=crescita`): il reload non perde il posto, e ogni vista può
linkare le altre. La specifica completa dell'interfaccia — layout, flussi,
componenti condivisi, criteri di accettazione — è in
[`DESIGN.md`](DESIGN.md): è la fonte di verità per qualunque intervento su
questa UI, questo file è solo l'introduzione per chi la usa.

## Struttura dei file

```
tuning/
├── index.html          solo markup + <script src> in ordine
├── tool.css
└── js/
    ├── util.js          helper condivisi, routing sull'hash, credenziali
    ├── store.js         un unico STORE: carica canali/archivi/catalogo/note/profili
    │                    in parallelo e li tiene in memoria
    ├── components.js     componenti condivisi (chip coppia, lightbox, toast)
    ├── tab-archivio.js
    ├── tab-lab.js
    ├── tab-catalogo.js
    ├── tab-range.js
    └── app.js           bootstrap: instrada le tab, avvia il primo caricamento
```

Nessun build, nessuna dipendenza esterna (niente CDN, niente `node_modules`):
chi ci mette mano aggiunge un altro `<script src>` a `index.html`, non un
passo di compilazione. Lo strumento osserva la produzione e propone modifiche
da pubblicare esplicitamente — non modifica mai la logica di generazione o
del cancello.
