// Service worker מינימלי: נדרש כדי שכרום יציע התקנה. בכוונה בלי מטמון, כדי שעדכוני גרסה יגיעו מיד.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
