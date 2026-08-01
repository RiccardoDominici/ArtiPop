// feat-salva-il-wallpaper-con-un-nome-che-si-capisce: /w/<flusso>?dl=1 aggiunge
// content-disposition: attachment con un nome file parlante (artipop-<flusso>-<data>.<est>)
// invece del blob "natura" senza estensione che il browser userebbe di default.
import { describe, it, expect } from "vitest";
import { makeEnv, callWorker } from "../helpers/fakeEnv.js";
import { PLACEHOLDER_PNG_BYTES } from "../../src/placeholder.js";

async function seminaImmagineDiOggi(env, canale, dataOggi, contentType = "image/png") {
  const byteAttesi = new Uint8Array([137, 80, 78, 71, 1, 2, 3, 4, 5, 6, 7, 8]);
  await env.KV.put(`img:${canale}:latest`, byteAttesi, {
    metadata: { contentType, date: dataOggi, model: "test" },
  });
  return byteAttesi;
}

async function seminaArchivio(env, canale, data) {
  const byteAttesi = new Uint8Array([137, 80, 78, 71, 1, 2, 3, 4, 5, 6, 7, 8]);
  await env.KV.put(`archive:${canale}:${data}`, byteAttesi, {
    metadata: { contentType: "image/png", date: data, model: "test" },
  });
  return byteAttesi;
}

describe("/w/<flusso>?date=<d>&dl=1: salvataggio dall'archivio", () => {
  it("risponde 200 con content-disposition attachment e filename artipop-<flusso>-<data>.png", async () => {
    const env = makeEnv();
    const data = "2026-01-15";
    const byteAttesi = await seminaArchivio(env, "natura", data);

    const res = await callWorker(env, `/w/natura?date=${data}&dl=1`);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toBe(
      'attachment; filename="artipop-natura-2026-01-15.png"'
    );
    const byte = new Uint8Array(await res.arrayBuffer());
    expect(byte).toEqual(byteAttesi);
  });

  it("la stessa richiesta senza dl=1 non ha content-disposition, stesso content-type e cache-control", async () => {
    const env = makeEnv();
    const data = "2026-01-15";
    await seminaArchivio(env, "natura", data);

    const conDl = await callWorker(env, `/w/natura?date=${data}&dl=1`);
    const senzaDl = await callWorker(env, `/w/natura?date=${data}`);

    expect(senzaDl.headers.get("content-disposition")).toBeNull();
    expect(senzaDl.headers.get("content-type")).toBe(conDl.headers.get("content-type"));
    expect(senzaDl.headers.get("cache-control")).toBe(conDl.headers.get("cache-control"));
  });
});

describe("/w/<flusso>: chiamata della Shortcut (nessuna query)", () => {
  it("non ha mai content-disposition, anche con un'immagine presente", async () => {
    const env = makeEnv();
    const oggi = "2026-01-15";
    await seminaImmagineDiOggi(env, "natura", oggi);

    const res = await callWorker(env, "/w/natura");

    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toBeNull();
  });
});

describe("/w/<flusso>?dl=1 su canale vuoto", () => {
  it("serve comunque il placeholder, corpo immagine, mai JSON, nessun content-disposition", async () => {
    const env = makeEnv(); // KV vuoto

    const res = await callWorker(env, "/w/quiete?dl=1");

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("content-disposition")).toBeNull();
    const byte = new Uint8Array(await res.arrayBuffer());
    expect(byte).toEqual(PLACEHOLDER_PNG_BYTES);
  });
});

describe("/w/<flusso>?v=<oggi>&dl=1: contentType jpeg", () => {
  it("usa l'estensione .jpg quando il meta indica image/jpeg", async () => {
    const env = makeEnv();
    const oggi = "2026-01-15";
    await seminaImmagineDiOggi(env, "natura", oggi, "image/jpeg");

    const res = await callWorker(env, `/w/natura?v=${oggi}&dl=1`);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toBe(
      'attachment; filename="artipop-natura-2026-01-15.jpg"'
    );
  });
});
