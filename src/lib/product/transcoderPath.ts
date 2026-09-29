// Where the app serves the Basis KTX2 transcoder from, as the URL path the
// runtime loader fetches it under. This is the one module that defines it:
// scripts/basisAssets.ts derives the served folder from it, the tooling
// gates derive their vendored entry from that derivation, and the product
// decoder wiring imports it, so a moved transcoder is one edit. The module
// imports nothing on purpose: plain Node executes it straight from its .ts
// file.
export const basisTranscoderPath = '/basis/'
