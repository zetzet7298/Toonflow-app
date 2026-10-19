// Polyfills that must run before any module code executes.
// crypto.randomUUID is only defined in secure contexts; plain HTTP over
// Tailscale/LAN is not secure, so remote browsers get a spec-faithful v4
// implementation built on getRandomValues (available in insecure contexts).
if (typeof globalThis.crypto?.randomUUID !== "function" && typeof globalThis.crypto?.getRandomValues === "function") {
  const bytes = new Uint8Array(16);
  globalThis.crypto.randomUUID = function randomUUID() {
    globalThis.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}` as `${string}-${string}-${string}-${string}-${string}`;
  };
}
