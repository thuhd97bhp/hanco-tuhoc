/* Hán cổ tự học — service worker: cho app mở và chạy được khi không có mạng */
var VERSION = "hanco-v20261125161518";
var SHELL = ["./", "./index.html", "./app.js", "./games.js", "./app-data.json", "./app-strokes.json"];
var CDN = [
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js",
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore-compat.js"
];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) {
    return c.addAll(SHELL).then(function () {
      return Promise.all(CDN.map(function (u) { return fetch(u, { mode: "cors" }).then(function (r) { if (r.ok) return c.put(u, r); }).catch(function () { }); }));
    });
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf("hanco-") === 0 && k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function isData(url) {
  // dữ liệu tiến độ và đăng nhập: luôn đi thẳng ra mạng, không lưu đệm
  return /firestore\.googleapis\.com|identitytoolkit|securetoken|googleapis\.com\/(identity|v1\/projects)|\/__\/auth\//.test(url);
}

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET" || isData(req.url)) return;
  var url = new URL(req.url);
  var sameOrigin = url.origin === self.location.origin;
  if (sameOrigin && /\/han\/[0-9a-f]+\.webp$/.test(url.pathname)) {
    // ảnh chữ MS Song: dùng bản đã lưu (mỗi bản phát hành đổi VERSION nên ảnh vẽ lại vẫn được tải mới), không có thì tải rồi lưu
    e.respondWith(caches.match(req, { ignoreSearch: true }).then(function (hit) {
      return hit || fetch(req).then(function (res) { if (res && res.ok) { var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put(req, copy); }); } return res; });
    }));
    return;
  }
  if (sameOrigin || req.mode === "navigate") {
    // mã app: ưu tiên bản mới trên mạng (để nhận cập nhật), mất mạng thì dùng bản đã lưu
    e.respondWith(
      fetch(req).then(function (res) {
        if (res && res.ok) { var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put(req, copy); }); }
        return res;
      }).catch(function () {
        return caches.match(req, { ignoreSearch: true }).then(function (r) { return r || caches.match("./index.html"); });
      })
    );
    return;
  }
  if (/gstatic\.com|fonts\.googleapis\.com/.test(url.host)) {
    // thư viện Firebase và phông chữ: dùng bản đã lưu, không có thì tải rồi lưu lại
    e.respondWith(caches.match(req).then(function (hit) {
      return hit || fetch(req).then(function (res) { if (res && (res.ok || res.type === "opaque")) { var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put(req, copy); }); } return res; });
    }));
  }
});
