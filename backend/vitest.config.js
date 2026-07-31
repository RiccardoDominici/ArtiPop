// Configurazione minima di vitest per il backend.
//
// Ambito: tests/unit/ (pure-logic) più tests/integration/ (router e
// orchestrazione con binding KV/AI/IMAGES/SELF fittizi, vedi tests/helpers/
// fakeEnv.js). Non si tocca mai src/ da qui — i test IMPORTANO da src/, non lo
// modificano né lo mockano a livello di modulo (vedi i commenti nei singoli
// file di test per i punti dove si passano invece oggetti letterali come
// env/catalog fittizi).
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.js"],
    environment: "node",
    // Suite pensata per essere istantanea (pure-logic, nessuna rete/disco):
    // un timeout basso fa fallire subito un test che per errore aspetta I/O.
    testTimeout: 5000,
    // Niente coverage di default: la suite è un gate di regressione minimo,
    // non un audit di copertura.
  },
});
