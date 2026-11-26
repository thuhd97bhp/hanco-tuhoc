/* Hán cổ tự học — service worker: cho app mở và chạy được khi không có mạng */
var VERSION = "hanco-v20261126201957";
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
  }).then(hanCheck).then(function () { return self.clients.claim(); }).then(demNext));
});

// Ảnh chữ han/ (~3.700 ảnh, ~20 MB) lưu ở đệm RIÊNG HAN (tên không bắt đầu "hanco-" nên không bị xóa khi phát hành bản mới).
// release.py sinh han-dau.json = {mã hex: dấu nội dung}; mỗi bản mới so với danh sách dấu đã lưu → chỉ xóa (để tải lại) ảnh đã vẽ lại.
var HAN = "hanchu-v1", HAN_DAU = "./han-dau.json";
function hanCheck() {
  var nw;
  var job = fetch(HAN_DAU, { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
    if (!j) return;
    nw = j;
    return caches.open(HAN).then(function (c) {
      return c.match(HAN_DAU).then(function (o) { return o ? o.json() : null; }).then(function (old) {
        return c.keys().then(function (reqs) {
          // chưa có danh sách cũ (đệm cũ không rõ bản nào) → bỏ hết ảnh trong đệm cho chắc
          var del = reqs.filter(function (q) { var m = /\/han\/([0-9a-f]+)\.webp$/.exec(new URL(q.url).pathname); return m && (!old || !nw[m[1]] || old[m[1]] !== nw[m[1]]); });
          return Promise.all(del.map(function (q) { return c.delete(q); }));
        }).then(function () { return c.put(HAN_DAU, new Response(JSON.stringify(nw), { headers: { "Content-Type": "application/json" } })); });
      });
    });
  }).catch(function () { });
  // mạng chậm: không giữ app chờ quá 8 giây (lần phát hành sau so lại)
  return Promise.race([job, new Promise(function (r) { setTimeout(r, 8000); })]);
}

// ĐẾM DUNG LƯỢNG TẢI TỪ HOSTING (Bước 5 kế hoạch nhiều người dùng, ước tính hạn mức "tải ra 360 MB/ngày"): cộng transferSize (byte
// thật qua mạng; lấy từ đệm trình duyệt = 0, hỏi lại "chưa đổi" = vài trăm byte) của các tệp CÙNG TRANG mà service worker tải, vào 1
// tổng cộng dồn {b, t} trong đệm DEM (tên không bắt đầu "hanco-" nên không bị xóa khi phát hành). app.js đọc phần tăng thêm (demPull).
// Chỉ đếm, không đổi cách trả tệp; lỗi thì bỏ qua.
var DEM = "dem-v1", DEM_KEY = "./__dem", demQ = Promise.resolve();
try { if (self.performance && performance.setResourceTimingBufferSize) performance.setResourceTimingBufferSize(3000); } catch (e) { }
function demFlush() {
  var n = 0;
  try {
    if (!self.performance || !performance.getEntriesByType) return Promise.resolve();
    performance.getEntriesByType("resource").forEach(function (x) { if (x.name.indexOf(self.location.origin) === 0 && x.transferSize > 0) n += x.transferSize; });
    if (performance.clearResourceTimings) performance.clearResourceTimings();
  } catch (e) { return Promise.resolve(); }
  if (!n) return Promise.resolve();
  return caches.open(DEM).then(function (c) {
    return c.match(DEM_KEY).then(function (r) { return r ? r.json() : null; }).catch(function () { return null; }).then(function (j) {
      return c.put(DEM_KEY, new Response(JSON.stringify({ b: ((j && +j.b) || 0) + n, t: Date.now() }), { headers: { "Content-Type": "application/json" } }));
    });
  }).catch(function () { });
}
function demNext() { demQ = demQ.then(demFlush, demFlush); return demQ; }
function demLater(e) { // tải xong (chờ 2 giây cho Resource Timing kịp ghi; tệp chưa xong thì lần sau đếm)
  try { e.waitUntil(new Promise(function (r) { setTimeout(r, 2000); }).then(demNext)); } catch (x) { }
}

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
    // ảnh chữ MS Song: dùng bản trong đệm riêng HAN (ảnh vẽ lại đã bị hanCheck xóa khỏi đệm), không có thì tải mới rồi lưu
    var key = url.origin + url.pathname;
    demLater(e);
    e.respondWith(caches.open(HAN).then(function (c) {
      return c.match(key).then(function (hit) {
        return hit || fetch(key, { cache: "no-cache" }).then(function (res) { if (res && res.ok) c.put(key, res.clone()); return res; });
      });
    }).catch(function () { return fetch(req); }));
    return;
  }
  if (sameOrigin || req.mode === "navigate") {
    // mã app: ưu tiên bản mới trên mạng (để nhận cập nhật), mất mạng thì dùng bản đã lưu
    if (sameOrigin) demLater(e);
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
