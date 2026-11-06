/*
 * Service worker Pandian Smart Attendance.
 * SENGAJA minimal dan aman untuk data pribadi siswa:
 *  - TIDAK menyimpan halaman, data, atau respons API/otentikasi apa pun di cache.
 *  - Hanya menyimpan halaman "tidak ada sambungan" dan lambang sekolah.
 *  - Absensi, pemindaian QR, dan semua data tetap membutuhkan internet.
 */
const CACHE = "pandian-shell-v1";
const OFFLINE = "/offline.html";
const PRECACHE = [OFFLINE, "/logo.png", "/icons/icon-192.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || req.mode !== "navigate") return; // selain pembukaan halaman: biarkan jaringan biasa
  e.respondWith(fetch(req).catch(() => caches.match(OFFLINE)));
});