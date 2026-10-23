<img src="assets/icon.svg" width="64" height="64" alt="">

# Bug Killer

Uno sparatutto top-down dove i nemici sono i **bug aperti del backlog**. Ogni sprint è un progetto, ogni boss è il ticket peggiore del progetto, e ogni tanto un cliente scrive in chat con una missione "urgentissima".

```sh
pnpm install
pnpm dev        # http://127.0.0.1:5199
pnpm check      # typecheck + oxlint (regole Ritmo) + ritmo-devtools lint + test headless
pnpm build && pnpm serve   # produzione: gioco + server delle run su un'unica porta (PORT, default 8080)
```

`?tutti` nell'URL sblocca tutti gli sprint per la sessione.

## Come si gioca

| Comando | Azione |
|---|---|
| WASD / frecce | muoviti |
| Mouse (tieni premuto) | mira e spara |
| Spazio / Shift | dash (invulnerabile per un attimo) |
| Q / E / tasto destro | `git reset --hard`: ripulisce lo schermo |
| P / Esc | pausa |
| M | audio on/off |

Passa il mirino su un bug per leggere il ticket.

- **Priorità → tipo di nemico.** Lowest/Low sono deboli, High sono veloci, Highest sono carri armati che alla morte generano 3 regressioni.
- **Stato → comportamento.** *Blocked/On hold* hanno lo scudo (danni dimezzati), *Ready for QA/UAT/review* possono riaprirsi (`REOPENED`), *In development* si muovono a scatti.
- **Sprint.** Glacier → Side Quests (sette progettini) → Keystone → Foundry. Progetti, chiavi e ticket sono inventati (`src/content/backlog.ts`).
- **Boss.** `GLC-37` il dispenser che non si ferma se non per timeout, `QUIZ-276` il crash che riparte altrove, `KEY-3242` la 2FA che vuole un secondo fattore, `FND-2245` `TypeError: Cannot read properties of undefined`.
- **Clienti** (inventati): Ugo scrive TUTTO IN MAIUSCOLO!!!, Ornella "come da mail precedente", Kevin ti manda vocali, Samanta "già che ci sei", Gualtiero "in staging funzionava". Missione riuscita: story points e un power-up. Missione fallita: scope creep, nuovi bug `ESC-*` in arena.
- **Bug resuscitati.** Ogni tanto un cliente giura che un bug che hai chiuso "non è ancora fixato": torna in arena come zombie 🧟 (più resistente, sparisce dalle release notes finché non lo richiudi) e il cliente se la ride in chat dicendoti di lavorare più duramente.
- **Tobia** (Tech Lead) passa quando sei lento (troppo tempo senza chiudere bug, o bug che si accumulano) e chiede "stai usando gli _strumenti_??". Poi te li lascia accanto: 🤖 Strumenti, colpi a ricerca automatica.
- **Power-up:** 🔥 Hotfix, 🔀 Refactor, ☕ Caffè, 🛡️ Test verdi, ⏪ git reset, 🍕 Pizza, 🤖 Strumenti (solo da Tobia), 🧠 AI.
- A fine sprint: release notes con i ticket chiusi, copiabili in Markdown.
- **Endless:** la card ∞ sotto gli sprint. Tutti i bug aperti di tutti i progetti, pescati a caso e per sempre; ogni 6 ondate arriva uno dei quattro boss, a rotazione, e ogni boss battuto rende il round successivo più duro (bug più resistenti e veloci, ondate più grandi e ravvicinate). Finisce solo quando crolli; il record resta nel menu.
- **Call bonus:** ogni tanto un cliente ti chiama. Su Meet compare una stanza nell'arena: restaci dentro 5 secondi. Su Slack i suoi messaggi galleggiano nell'arena: vai a leggerli tutti. Rispondere vale story points e un power-up; ignorare non costa niente, solo un messaggio passivo-aggressivo. Una freccia indica dove andare se è fuori schermo.
- **Minimappa:** tutta l'arena in un riquadro, in alto a destra sotto gli story points (su telefono in basso al centro, tra i pollici): bug col colore della priorità, boss, power-up, la call da rispondere, il ticket bloccante della missione che lampeggia e il rettangolo di ciò che vedi.
- **AI:** il drop più raro. Raccolto, piazza sul posto una torretta che per 12 secondi spara da sola al bug più vicino (i punti vanno a chi l'ha raccolta). Ogni tanto ha un'allucinazione e spara al nulla.
- **Gioca in squadra:** fino a 4 sviluppatori sullo stesso backlog. Dal menu si sceglie un nome (resta salvato) e si crea una run, che ha un codice tipo `RUN-4821` e un link `?run=RUN-4821` da girare ai colleghi, oppure si entra con il codice. Nella lobby l'host sceglie lo sprint e lo fa partire. Ognuno ha il suo colore e il nome sopra la testa; i bug inseguono chi è più vicino, ondate e boss crescono col numero di giocatori. Chi va in burnout resta a terra finché un collega non gli sta vicino per qualche secondo; si perde quando sono a terra tutti. A fine run c'è la classifica del team e l'host fa partire la successiva. Chi cade dalla connessione rientra nel suo posto con lo stesso nome. Il giocatore singolo non cambia e non usa il server.
- **Musica:** un loop 8-bit originale in stile anni 80 (due canali pulse, basso triangolare, batteria a rumore), sintetizzato in WebAudio. Nel menu c'è un brano tranquillo (parte al primo tocco o tasto, come vogliono i browser); in partita il loop accelera col boss e si ferma in pausa; M lo spegne insieme agli effetti.
- **Mobile:** su touch compaiono due stick virtuali. Il sinistro muove; il destro mira e spara, con mira assistita, e se lo tieni fermo spara al bug più vicino. Ci sono anche i pulsanti DASH e ⏪ `git reset --hard`, più pausa e audio in alto. La chat si compatta e in verticale il gioco chiede di ruotare il telefono. Su Android (e iPad) avviare uno sprint passa a schermo intero bloccato in orizzontale, con il pulsante ⛶ per uscire; su iPhone, che non lo permette, il menu suggerisce "Aggiungi alla schermata Home" (il manifest apre il gioco a schermo intero).
- **Lingue:** inglese (default) e italiano, dal selettore EN/IT nel menu o con `?lang=it`; la scelta resta salvata. I titoli dei bug sono in inglese in entrambe le lingue, come in un backlog vero.

## Architettura

La simulazione è un ECS [Ritmo](https://github.com/typeonce-dev/ritmo) a passo fisso (60 Hz), deterministica e headless; il browser è solo un host.

- `src/sim/` — schema (componenti, risorse, eventi), sistemi (`player`, `waves`, `movement`, `boss`, `combat`, `missions`, `interruptions`), schedule, e l'inspector `View` che il renderer legge. Casualità solo da `Random` seedato, trigonometria da `Ops`: stesso seed + stesso input = stessa partita.
- `src/content/` — dati: il backlog inventato, livelli, clienti. Tabelle chiuse con `satisfies Record<...>`. Tutti i testi stanno in `src/content/text/{en,it}.ts`, tipizzati da `Strings` in `i18n.ts`; la simulazione legge la lingua dalla risorsa `Language`, fissa per tutto il livello.
- `src/host/` — input (tastiera + mouse + stick touch → intenti), renderer Canvas 2D, chat dei clienti (DOM), audio sintetizzato WebAudio (effetti in `audio.ts`, musica nel sequencer di `music.ts`).
- `src/net/protocol.ts` — i messaggi tra browser e server delle run (JSON su WebSocket, path `/runs`), con la validazione di tutto ciò che arriva dal browser.
- `src/server/` — le run in multiplayer: `rooms.ts` (stanze, lobby, nomi, la simulazione di ogni run, senza rete), `socket.ts` (WebSocket con `ws` su qualsiasi server HTTP Node), `main.ts` (server di produzione). In sviluppo il plugin in `vite.config.ts` attacca le run al dev server stesso: `pnpm dev` basta.
- Il server è autoritativo: fa girare la stessa simulazione a 60 Hz e manda la vista a 30 Hz; i browser mandano solo l'input e disegnano interpolando tra due frame (`src/host/net.ts`).
- `test/simulation.test.ts` — un autopilota gioca i livelli headless con gli stessi intenti di un giocatore, anche in squadra. `test/rooms.test.ts` — le stanze con browser finti.
