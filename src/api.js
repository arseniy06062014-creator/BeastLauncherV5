// window.beast is injected by electron/preload.cjs. It is undefined in a plain browser.
export const api = typeof window !== 'undefined' ? window.beast : undefined;
