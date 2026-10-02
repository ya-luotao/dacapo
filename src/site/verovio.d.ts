// Verovio as Node loads it, for the scores engraved when the site is built (score.ts). The app
// takes the same two files by their addresses (ui/notation/verovio.ts); the package has no types.

declare module 'verovio/esm' {
  export class VerovioToolkit {
    constructor(module: unknown);
  }
}

declare module 'verovio/wasm' {
  const createModule: () => Promise<unknown>;
  export default createModule;
}
