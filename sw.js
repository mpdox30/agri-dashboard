/* public/sw.js
   service worker แบบเรียบง่าย เพื่อให้เปิดเว็บเร็วขึ้นและติดตั้งเป็นแอปได้ โดยตั้งใจ "ไม่แคชข้อมูล" จาก Supabase
   (ข้อมูลต้องสดเสมอ) แคชเฉพาะตัวเว็บเอง:
   - ไฟล์ใน /assets/ มีรหัสแฮชในชื่อ เปลี่ยนเนื้อหา = เปลี่ยนชื่อ จึงแคชถาวรได้ปลอดภัย
   - หน้า HTML ใช้ "เครือข่ายก่อน" เสมอ เพื่อให้ได้เวอร์ชันใหม่ทันทีหลัง deploy ใช้แคชเฉพาะตอนออฟไลน์
   วิธีถอน (ถ้ามีปัญหา): แทนไฟล์นี้ด้วยสคริปต์ที่เรียก self.registration.unregister() แล้ว deploy ใหม่ */

const CACHE = 'agri-income-v1';
const SCOPE = self.registration.scope; // เช่น https://host/agri-dashboard/
// ignoreVary: เซิร์ฟเวอร์บางตัวส่ง Vary: Origin ทำให้คำขอสคริปต์ module หาแคชไม่เจอทั้งที่เป็นไฟล์เดียวกัน

// ติดตั้ง: เก็บหน้าแรกและไฟล์ใน /assets/ ที่หน้านั้นอ้างถึง (อ่านจาก HTML) เพื่อให้เปิดแบบออฟไลน์ได้ตั้งแต่ครั้งแรกที่ติดตั้ง
async function precache() {
  const cache = await caches.open(CACHE);
  const response = await fetch(SCOPE, { cache: 'reload' });
  const html = await response.clone().text();
  const assets = Array.from(html.matchAll(/(?:src|href)="([^"]*\/assets\/[^"]+)"/g)).map((m) => new URL(m[1], SCOPE).href);
  await cache.put(SCOPE, response);
  await cache.addAll([...assets, `${SCOPE}manifest.webmanifest`, `${SCOPE}icons/icon-192.png`]);
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  // ไม่ยุ่งกับคำขอข้ามโดเมน (Supabase, Google Fonts ฯลฯ) ให้ไปเครือข่ายตามปกติ
  if (url.origin !== self.location.origin) return;
  if (!url.href.startsWith(SCOPE)) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(SCOPE, copy));
          return response;
        })
        .catch(() => caches.match(SCOPE, { ignoreVary: true }))
    );
    return;
  }

  if (url.pathname.includes('/assets/')) {
    event.respondWith(
      caches.match(request, { ignoreVary: true }).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          })
      )
    );
  }
});
