/* Hán cổ tự học — lõi ứng dụng: dữ liệu, tiến độ, lịch 5 tuần, học mới, ôn thẻ, tập viết, bộ thủ, loại từ, câu, tra cứu */
(function () {
  "use strict";
  var HC = window.HC = window.HC || {};
  HC.games = HC.games || [];

  // ---------- helpers ----------
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function fold(s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase(); }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function pick(a, n) { return shuffle(a).slice(0, n); }
  function chars(s) { return Array.from(String(s || "")); }
  function isHan(ch) { var o = ch.codePointAt(0); return (o >= 0x2E80 && o <= 0x2FDF) || (o >= 0x3400 && o <= 0x4DBF) || (o >= 0x4E00 && o <= 0x9FFF) || (o >= 0xF900 && o <= 0xFAFF); }
  function lenCls(s) { var n = chars(s).length; return n <= 1 ? "" : n === 2 ? "l2" : n === 3 ? "l3" : n <= 5 ? "l4" : "l6"; }
  function today() { var d = new Date(); return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 864e5); }
  function dateOf(n) { var d = new Date(n * 864e5); return d.getUTCDate() + "/" + (d.getUTCMonth() + 1); }
  function fmt(n) { return Number(n).toLocaleString("vi-VN"); }
  HC.u = { $: $, $$: $$, esc: esc, fold: fold, shuffle: shuffle, pick: pick, chars: chars, isHan: isHan, lenCls: lenCls, today: today, fmt: fmt };

  // Vietnamese syllable normaliser for typed answers: tolerant to tone-mark placement, y/i, sinh/sanh, chính/chánh
  var TONES = { "̀": 1, "́": 2, "̃": 3, "̉": 4, "̣": 5 };
  function sylKey(w, strict) {
    var d = w.normalize("NFD").toLowerCase(), tone = 0, base = "";
    for (var i = 0; i < d.length; i++) { var c = d[i]; if (TONES[c]) tone = TONES[c]; else base += c; }
    base = base.normalize("NFC").replace(/[^a-zà-ỹđ0-9]/g, "");
    if (!strict) { base = fold(base); }
    base = base.replace(/^(k|l|m|t|s|n|h|v|d|đ|b|ph|th|ch|tr|gh|r|x|qu)y$/, "$1i");
    if (base === "sanh") base = "sinh"; if (base === "chanh") base = "chinh"; if (base === "tho") base = base;
    return strict ? base + tone : base;
  }
  function phrKey(s, strict) { return String(s || "").split(/[\s,;.·\-–—:()…"“”]+/).filter(Boolean).map(function (w) { return sylKey(w, strict); }).join(" "); }
  // returns 2 = exact (with dấu), 1 = right but missing/incorrect dấu, 0 = wrong
  function checkAm(input, am) {
    var alts = String(am).split(/\s*\/\s*/);
    var a = phrKey(input, true), b = phrKey(input, false);
    if (!b) return 0;
    var best = 0;
    alts.forEach(function (x) { if (phrKey(x, true) === a) best = 2; else if (best < 1 && phrKey(x, false) === b) best = 1; });
    return best;
  }
  HC.checkAm = checkAm;

  // ---------- data ----------
  var D, ITEM = {}, QC = [], QW = [], QR = [], QS = [], CHAR = {}, WORD = {}, RAD = {};
  var COMMON_C = 0, COMMON_W = 0;
  function prepData(d) {
    D = d; HC.D = d;
    d.chars.forEach(function (c, i) { c.type = "c"; c.key = c.c; c.rank = i + 1; ITEM[c.id] = c; CHAR[c.c] = c; });
    d.words.forEach(function (w, i) { w.type = "w"; w.key = w.w; w.rank = i + 1; ITEM[w.id] = w; WORD[w.w] = w; });
    d.rads.forEach(function (r) {
      r.id = "r" + r.no; r.type = "r"; r.key = r.r; r.ns = r.nghia || r.note || ""; ITEM[r.id] = r; RAD[r.no] = r;
      r.members = d.chars.filter(function (c) { return c.rad === r.no; });
      r.use = r.members.reduce(function (s, c) { return s + (c.common ? c.n : 0); }, 0);
      r.fuse = r.members.reduce(function (s, c) { return s + (c.fo ? c.n : 0); }, 0);
    });
    d.sents.forEach(function (s) { s.type = "s"; s.key = s.han; s.am = s.pa; s.ns = s.dn; ITEM[s.id] = s; });
    // thứ tự học chung (phần không thuộc kỳ nào đang học): thông dụng trước, trong mỗi phần chữ / từ lặp lại nhiều trước
    // (d.chars, d.words đã xếp theo số lần xuất hiện). Bài của từng kỳ: prepTerms (lộ trình theo kỳ).
    var cc = d.chars.filter(function (c) { return c.common; });
    QC = cc.concat(d.chars.filter(function (c) { return !c.common; }));
    COMMON_C = cc.length;
    var cw = d.words.filter(function (w) { return w.common; });
    QW = cw.concat(d.words.filter(function (w) { return !w.common; }));
    COMMON_W = cw.length;
    QR = d.rads.slice().sort(function (a, b) { return b.fuse - a.fuse || b.use - a.use || a.no - b.no; });
    QS = d.sents.slice();
    prepTerms(d);
    HC.ITEM = ITEM; HC.CHAR = CHAR; HC.WORD = WORD; HC.RAD = RAD; HC.QC = QC; HC.QW = QW;
    // loại từ lookup
    HC.LT = {}; Object.keys(d.loaitu).forEach(function (g) { d.loaitu[g].forEach(function (x) { HC.LT[x] = g; }); });
  }
  function firstAm(am) { return String(am || "").split(/\s*\/\s*/)[0]; }
  HC.firstAm = firstAm;

  // ---------- state + storage ----------
  var LS = "hanco-tuhoc-v1";
  var S, remote = { db: null, ref: null, status: "local", writing: false, pending: false };
  function blank() { return { v: 1, start: today(), set: { newC: 20, newW: 17, sound: true }, it: {}, xp: 0, streak: { d: 0, c: 0 }, best: {}, log: {}, badges: {}, upd: 0, itT: {}, gm: {}, hard: {}, pl: {}, note: {}, plans: {}, lt: {}, cup: {}, rec: {}, meo: {} }; }
  // plans[kỳ] = {s ngày bắt đầu, e ngày thi, t ms sửa, x ms bỏ (0 = đang học)} · lt[từ ngữ pháp] = [hộp, hạn ôn, số lần sai, ngày học, ms chấm]
  // hard[id] = t (ms thêm vào kho khó; âm = −ms lúc bỏ) · pl[plId] = {n tên, nt ms đặt tên, x ms xóa (0 = còn), ids {id: t như hard}}
  // note[id] = ["văn bản", ms] (văn bản rỗng = đã xóa). Gộp đồng bộ theo từng mục (mergeT) để máy nào thêm/xóa cũng không mất.
  // meo[id] = ["html", ms, pub] (Bước 8) = CÁCH NHỚ của mình (mọi người thấy, đăng ở hanco_meo/{id}_{uid}); pub = ms của bản đã đăng lên kho
  // chung (0 = chưa đăng): máy nào thấy ms > pub thì đăng. Rỗng = đã xóa (xóa luôn bản chung). Gộp: lấy ms lớn hơn, bằng nhau lấy pub lớn hơn.
  function loadLocal() { try { var t = localStorage.getItem(LS); if (t) return JSON.parse(t); } catch (e) { } return null; }
  var bigWarned = false;
  function saveLocal() {
    try {
      var t = JSON.stringify(S);
      // Firestore giới hạn 1 MiB/tài liệu: báo sớm khi tiến độ quá lớn (thường do ghi chú dài)
      if (t.length > 700000 && !bigWarned) { bigWarned = true; setTimeout(function () { toast("Tiến độ đã rất lớn (" + Math.round(t.length / 1000) + " nghìn ký tự), gần giới hạn đồng bộ. Hãy rút gọn bớt ghi chú."); }, 0); }
      localStorage.setItem(LS, t);
    } catch (e) { }
  }
  var saveTimer = null;
  function save() {
    S.upd = Date.now(); saveLocal();
    clearTimeout(saveTimer); saveTimer = setTimeout(pushRemote, 1500);
    scheduleFb();
  }
  HC.save = save;
  function pushRemote() {
    if (!remote.ref) return;
    if (remote.writing) { remote.pending = true; return; }
    remote.writing = true;
    remote.ref.set(JSON.parse(JSON.stringify(S))).then(function () {
      remote.status = "synced";
    }).catch(function (e) {
      remote.status = (e && e.code === "quota_exceeded") ? "full" : "error";
    }).then(function () {
      remote.writing = false; renderStats();
      if (remote.pending) { remote.pending = false; pushRemote(); }
    });
  }
  function initRemote() {
    if (!window.claude || typeof window.claude.use !== "function") return;
    Promise.all([window.claude.use("db"), window.claude.use("user")]).then(function (r) {
      var db = r[0], user = r[1];
      if (!db || !user) return null;
      return user.id().then(function (uid) {
        if (!uid) return null;
        remote.db = db;
        remote.ref = db.doc("data/users/" + uid + "/progress");
        return remote.ref.get();
      });
    }).then(function (snap) {
      if (!snap) return;
      var data = snap.exists ? snap.data() : null;
      if (data && data.v && (data.upd || 0) > (S.upd || 0)) {
        S = normalize(JSON.parse(JSON.stringify(data))); saveLocal(); remote.status = "synced";
        toast("Đã tải tiến độ từ tài khoản của bạn"); route();
      } else {
        remote.status = "synced"; if ((S.upd || 0) > ((data && data.upd) || 0)) pushRemote();
      }
      renderStats();
    }).catch(function () { remote.status = "error"; renderStats(); });
  }
  // ---------- đồng bộ giữa các máy qua Firebase (dự án hanco-tuhoc) ----------
  // Mỗi người: hanco_progress/{uid} = { data: <chuỗi JSON tiến độ>, upd, ver }
  //            hanco_progress/{uid}/backups/{YYYY-MM-DD} = bản sao lưu mỗi ngày (giữ 14 bản)
  var FB_CONFIG = {
    apiKey: "AIzaSyAPUZemJVnb6Pn96s7TXNGpcQ5fILpqURY",
    authDomain: "hanco-tuhoc.firebaseapp.com",
    projectId: "hanco-tuhoc",
    storageBucket: "hanco-tuhoc.firebasestorage.app",
    messagingSenderId: "487484756352",
    appId: "1:487484756352:web:b85b86841630919ea8b165"
  };
  // Tiết kiệm hạn mức (26/11/2026): gom thay đổi, ghi lên tài khoản tối đa ~1 lần / FB_GAP khi đang học; rời app / ẩn màn hình /
  // có mạng lại → ghi ngay; không có gì mới thì không ghi. KHÔNG đọc cả bản trước mỗi lần ghi: gộp (merge) với bản mới nhất nhận qua
  // onSnapshot (fb.rem, đã gộp vào S lúc nhận); chưa nhận bản nào từ máy chủ thì get() 1 lần. dirty = có thay đổi chưa lên tài khoản;
  // myW = mã lần ghi gần nhất của máy này (trường w của tài liệu) để nhận ra tiếng vọng của chính mình. localStorage FB_OK =
  // "uid|S.upd" lúc máy khớp tài khoản (tắt app đột ngột trước khi ghi → lần mở sau thấy lệch → tự ghi). Không thuộc S.
  var fb = { on: false, auth: null, db: null, user: null, ref: null, status: "off", last: 0, busy: false, again: false, timer: null, unsub: null, dirty: false, rem: null, remOk: false, myW: "", lastW: 0 };
  var FB_GAP = 60000, FB_OK = "hanco-fb-ok";
  HC.fb = fb;
  function dayKey(n) { var d = new Date(n * 864e5); return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0") + "-" + String(d.getUTCDate()).padStart(2, "0"); }
  // gộp tiến độ hai máy: không mất chữ nào đã học ở bất kỳ máy nào
  function merge(a, b) {
    var m = JSON.parse(JSON.stringify(a)), newer = (b.upd || 0) > (a.upd || 0) ? b : a;
    Object.keys(b.it || {}).forEach(function (id) {
      var x = m.it[id], y = b.it[id];
      if (!x) { m.it[id] = y.slice(); return; }
      var sx = x[1] + Math.max(x[3], 0), sy = y[1] + Math.max(y[3], 0), lap = Math.max(x[4], y[4]);
      // ưu tiên bản được chấm gần nhất (itT = giờ chấm từng mục); không phân định được thì giữ bản có hạn ôn xa hơn như cũ
      var tx = (a.itT || {})[id] || 0, ty = (b.itT || {})[id] || 0, pick = 0;
      if (tx && ty) pick = ty > tx ? 1 : tx > ty ? -1 : 0;
      else if (tx) pick = tx > (b.upd || 0) ? -1 : 0;
      else if (ty) pick = ty > (a.upd || 0) ? 1 : 0;
      if (pick === 1 || (pick === 0 && (sy > sx || (sy === sx && y[0] + y[2] > x[0] + x[2])))) m.it[id] = y.slice();
      m.it[id][4] = lap;
    });
    m.itT = Object.assign({}, a.itT || {});
    Object.keys(b.itT || {}).forEach(function (id) { if (!(m.itT[id] >= b.itT[id])) m.itT[id] = b.itT[id]; });
    // gm[id] = [số lần đúng, số lần sai, ngày chơi gần nhất] khi chơi trò chơi: lấy bản chơi gần hơn, cùng ngày thì lấy số lớn hơn
    m.gm = JSON.parse(JSON.stringify(a.gm || {}));
    Object.keys(b.gm || {}).forEach(function (id) {
      var x = m.gm[id], y = b.gm[id];
      if (!x || y[2] > x[2]) m.gm[id] = y.slice();
      else if (y[2] === x[2]) m.gm[id] = [Math.max(x[0], y[0]), Math.max(x[1], y[1]), x[2]];
    });
    m.xp = Math.max(a.xp || 0, b.xp || 0);
    var sa = a.streak || { d: 0, c: 0 }, sb = b.streak || { d: 0, c: 0 };
    m.streak = sb.d > sa.d || (sb.d === sa.d && sb.c > sa.c) ? { d: sb.d, c: sb.c } : { d: sa.d, c: sa.c };
    m.best = Object.assign({}, a.best);
    Object.keys(b.best || {}).forEach(function (k) { var x = m.best[k], y = b.best[k]; m.best[k] = x == null ? y : k === "memo" ? Math.min(x, y) : Math.max(x, y); });
    m.badges = Object.assign({}, b.badges, a.badges);
    m.log = JSON.parse(JSON.stringify(a.log || {}));
    Object.keys(b.log || {}).forEach(function (d) { var x = m.log[d] || (m.log[d] = { n: 0, r: 0, x: 0 }), y = b.log[d]; ["n", "r", "x"].forEach(function (k) { x[k] = Math.max(x[k] || 0, y[k] || 0); }); });
    m.start = newer.start; m.set = JSON.parse(JSON.stringify(newer.set));
    m.upd = Math.max(a.upd || 0, b.upd || 0);
    m.hard = mergeT(a.hard, b.hard);
    m.note = {};
    [a.note || {}, b.note || {}].forEach(function (o) {
      Object.keys(o).forEach(function (id) {
        var x = m.note[id], y = o[id];
        if (!Array.isArray(y)) return;
        if (!x || y[1] > x[1] || (y[1] === x[1] && String(y[0]) > String(x[0]))) m.note[id] = [String(y[0] || ""), +y[1] || 0];
      });
    });
    m.meo = {};
    [a.meo || {}, b.meo || {}].forEach(function (o) {
      Object.keys(o).forEach(function (id) {
        var x = m.meo[id], y = o[id];
        if (!Array.isArray(y)) return;
        y = [String(y[0] || ""), +y[1] || 0, +y[2] || 0];
        if (!x || y[1] > x[1] || (y[1] === x[1] && (y[2] > x[2] || (y[2] === x[2] && y[0] > x[0])))) m.meo[id] = y;
      });
    });
    // lộ trình từng kỳ + ôn loại từ: lấy bản sửa / chấm gần nhất của từng mục
    m.plans = {};
    [a.plans || {}, b.plans || {}].forEach(function (o) { Object.keys(o).forEach(function (k) { var x = m.plans[k], y = o[k]; if (!y || typeof y !== "object") return; if (!x || (+y.t || 0) > x.t || ((+y.t || 0) === x.t && JSON.stringify(y) > JSON.stringify(x))) m.plans[k] = { s: y.s, e: y.e, t: +y.t || 0, x: +y.x || 0 }; }); });
    m.lt = {};
    [a.lt || {}, b.lt || {}].forEach(function (o) { Object.keys(o).forEach(function (k) { var x = m.lt[k], y = o[k]; if (!Array.isArray(y)) return; if (!x || (+y[4] || 0) > x[4] || ((+y[4] || 0) === x[4] && y[0] > x[0])) m.lt[k] = y.slice(); }); });
    m.pl = {};
    [a.pl || {}, b.pl || {}].forEach(function (o) {
      Object.keys(o).forEach(function (k) {
        var y = o[k]; if (!y || typeof y !== "object") return;
        var x = m.pl[k];
        if (!x) { m.pl[k] = { n: String(y.n || ""), nt: +y.nt || 0, x: +y.x || 0, ids: mergeT(y.ids, {}) }; return; }
        if ((+y.nt || 0) > x.nt || ((+y.nt || 0) === x.nt && String(y.n || "") > x.n)) { x.n = String(y.n || ""); x.nt = +y.nt || 0; }
        x.x = Math.max(x.x, +y.x || 0);
        x.ids = mergeT(x.ids, y.ids);
      });
    });
    // Bước 7: cúp tuần {thứ Hai của tuần: hạng 1–3} — lấy hạng tốt hơn; kỷ lục: hạng tuần cao nhất (số nhỏ nhất), bài không sai theo ngày lấy số lớn hơn
    m.cup = {};
    [a.cup || {}, b.cup || {}].forEach(function (o) { Object.keys(o).forEach(function (k) { var v = +o[k]; if (v >= 1 && v <= 3 && !(m.cup[k] <= v)) m.cup[k] = v; }); });
    var ra = recNorm(JSON.parse(JSON.stringify(a.rec || {}))), rb = recNorm(JSON.parse(JSON.stringify(b.rec || {})));
    m.rec = { hb: ra.hb, hk: ra.hk, pf: ra.pf };
    if (rb.hb && (!ra.hb || rb.hb < ra.hb || (rb.hb === ra.hb && rb.hk && (!ra.hk || rb.hk < ra.hk)))) { m.rec.hb = rb.hb; m.rec.hk = rb.hk; }
    Object.keys(rb.pf).forEach(function (d) { m.rec.pf[d] = Math.max(+m.rec.pf[d] || 0, +rb.pf[d] || 0); });
    return m;
  }
  // gộp {id: t}: t > 0 = thêm lúc t, t < 0 = bỏ lúc −t. Lấy |t| lớn hơn; bằng nhau thì "bỏ" thắng (gộp theo thứ tự nào cũng ra một kết quả)
  function mergeT(a, b) {
    var m = {};
    [a || {}, b || {}].forEach(function (o) {
      Object.keys(o).forEach(function (id) {
        var y = +o[id]; if (!y) return;
        var x = m[id];
        if (x == null || Math.abs(y) > Math.abs(x) || (Math.abs(y) === Math.abs(x) && y < x)) m[id] = y;
      });
    });
    return m;
  }
  HC.merge = merge;
  function softRefresh() {
    if (tk.st !== "ok") return; // đang ở màn tài khoản: tkSet tự vẽ lại
    var c = cur || "home", name = c.split("-")[0];
    if (c.indexOf("-") < 0 && ["home", "caidat", "tra", "bo", "loaitu", "cau", "choi", "thi", "on", "viet"].indexOf(name) >= 0 && !document.querySelector(".fc, canvas.pad, .modal")) route();
    else { renderStats(); renderMenu(name); }
  }
  function applyRemote(data, silent) {
    try {
      var rem = typeof data === "string" ? JSON.parse(data) : data;
      if (!rem || !rem.it) return false;
      function sig() { return JSON.stringify(S.it) + "|" + S.xp + "|" + S.start + "|" + JSON.stringify(S.hard) + "|" + JSON.stringify(S.pl) + "|" + JSON.stringify(S.note) + "|" + JSON.stringify(S.meo) + "|" + JSON.stringify(S.plans) + "|" + JSON.stringify(S.lt); }
      var before = sig();
      S = normalize(merge(S, normalize(rem))); saveLocal();
      var changed = before !== sig();
      if (changed) { if (!silent) toast("Đã cập nhật tiến độ từ máy khác"); softRefresh(); }
      return changed;
    } catch (e) { return false; }
  }
  function fbMark() { try { if (fb.user) localStorage.setItem(FB_OK, fb.user.uid + "|" + (S.upd || 0)); } catch (e) { } }
  function fbClean() { var v = null; try { v = localStorage.getItem(FB_OK); } catch (e) { } return !!fb.user && v === fb.user.uid + "|" + (S.upd || 0); }
  // ---- CHỦ của tiến độ trên máy (dùng chung 1 máy, 26/11/2026) — không thuộc S, không đổi khóa hanco-tuhoc-v1 ----
  // localStorage OWN = uid tài khoản sở hữu bản hanco-tuhoc-v1 trên máy; "" = bản học khi chưa đăng nhập (khách); chưa có khóa = máy
  // chạy bản app cũ. Tài khoản khác đăng nhập → KHÔNG gộp: cất bản đang có vào CAT + uid chủ ({s: tiến độ, ok: đã khớp tài khoản,
  // t: ms cất}; khách = CAT + ""), nạp bản đã cất của người mới (nếu có), rồi đồng bộ với tài khoản như thường. Bản khách chỉ gộp vào
  // tài khoản khi người học bấm "Gộp". sessionStorage DN = vừa bấm Đăng nhập (phân biệt với phiên đăng nhập tự khôi phục khi mở app).
  var OWN = "hanco-chu", CAT = "hanco-cat-", DN = "hanco-dn";
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) { } }
  function sEmpty(s) { return !["it", "note", "hard", "pl", "lt", "log", "plans"].some(function (k) { return s[k] && Object.keys(s[k]).length; }) && !(s.xp > 0); }
  function catList() { // các bản đã cất trên máy: [{uid, ok, t}]
    var out = [], i, k, o;
    try { for (i = 0; i < localStorage.length; i++) { k = localStorage.key(i); if (k && k.indexOf(CAT) === 0) { o = null; try { o = JSON.parse(localStorage.getItem(k)); } catch (e) { } out.push({ uid: k.slice(CAT.length), ok: !!(o && o.ok), t: (o && +o.t) || 0 }); } } } catch (e) { }
    return out;
  }
  function catPut(uid, s, ok) {
    var v = JSON.stringify({ s: s, ok: !!ok, t: Date.now() });
    if (lsSet(CAT + uid, v)) return true;
    // bộ nhớ trình duyệt đầy: bỏ bớt bản cất ĐÃ KHỚP tài khoản (còn nguyên trên tài khoản), cũ nhất trước, rồi thử lại
    var old = catList().filter(function (c) { return c.ok && c.uid && c.uid !== uid; }).sort(function (a, b) { return a.t - b.t; });
    for (var i = 0; i < old.length; i++) { lsDel(CAT + old[i].uid); if (lsSet(CAT + uid, v)) return true; }
    return false;
  }
  function catTake(uid) { var o = null; try { o = JSON.parse(lsGet(CAT + uid)); } catch (e) { } return o && o.s && o.s.it ? o : null; }
  // thay tiến độ trên máy bằng bản đã cất của uid (hoặc bản trống); trả cờ "còn phần chưa lên tài khoản"
  function catLoad(uid) { var o = catTake(uid); S = normalize(o ? o.s : blank()); saveLocal(); lsDel(CAT + uid); return !!(o && !o.ok); }
  // vừa đăng nhập u: xác định chủ tiến độ trên máy rồi go(dirty) — dirty undefined = tính như cũ (!fbClean)
  function fbOwn(u, dn, go) {
    var own = lsGet(OWN), email = u.email || "tài khoản này";
    if (own === u.uid) return go();
    if (own === null) { // máy chạy bản cũ: chưa ghi chủ
      var okv = lsGet(FB_OK) || "", bk = lsGet("hanco-fb-backup") || "";
      var prev = okv ? okv.split("|")[0] : bk.length > 10 ? bk.slice(0, -10) : ""; // tài khoản đã đồng bộ trên máy này trước đây
      if (!dn || prev === u.uid || sEmpty(S)) { lsSet(OWN, u.uid); return go(); } // đăng nhập sẵn khi mở app → tự nhận
      own = prev; // "" = học khi chưa đăng nhập; uid khác = tiến độ của tài khoản trước
    }
    if (own === "" && sEmpty(S)) { // máy trống (vd người trước đã đăng xuất): nạp bản đã cất của người này nếu có
      var had = !!catTake(u.uid), d0 = had ? catLoad(u.uid) : false;
      lsSet(OWN, u.uid); if (had) route();
      return go(d0);
    }
    if (own === "") {
      var n = Object.keys(S.it).length, done = false;
      fb.ask = modal('<h2>Tiến độ học khi chưa đăng nhập</h2><p>Máy này có tiến độ học lúc chưa đăng nhập: <b>' + fmt(n) + '</b> mục đã học, <b>' + fmt(S.xp || 0) + ' XP</b>.</p><p>Gộp vào tài khoản <b>' + esc(email) + '</b>?</p><p class="sub">Nếu đây không phải tiến độ của bạn (máy dùng chung), chọn "Không" — tiến độ đó được cất riêng trên máy, không vào tài khoản của bạn.</p><div class="row acts"><button class="btn primary" data-gop>Gộp vào tài khoản</button><button class="btn" data-khong>Không, cất riêng</button></div>', function () { if (!done) pick(false); });
      var pick = function (gop) {
        if (done) return; done = true; var a = fb.ask; fb.ask = null; if (a) a.close();
        if (fb.user !== u) return; // đã đăng xuất / đổi tài khoản trong lúc hỏi
        if (gop) { // gộp cả bản đã cất của chính tài khoản này (nếu có) — không để sót phần chưa lên tài khoản
          var o = catTake(u.uid); if (o) { S = normalize(merge(S, normalize(o.s))); saveLocal(); lsDel(CAT + u.uid); }
          lsSet(OWN, u.uid); toast("Đã gộp tiến độ trên máy vào tài khoản"); return go(true);
        }
        if (!catPut("", S, false)) { toast("Bộ nhớ trình duyệt đầy, chưa cất được tiến độ trên máy. Đã đăng xuất để không gộp nhầm."); fb.auth.signOut(); return; }
        var d = catLoad(u.uid); lsSet(OWN, u.uid); route(); go(d);
      };
      $("[data-gop]", fb.ask.el).onclick = function () { pick(true); };
      $("[data-khong]", fb.ask.el).onclick = function () { pick(false); };
      return;
    }
    // tiến độ trên máy là của tài khoản khác: cất riêng (không gộp), nạp bản của người mới
    var ok = lsGet(FB_OK) === own + "|" + (S.upd || 0);
    if (!catPut(own, S, ok) && !ok) { toast("Máy còn tiến độ chưa đồng bộ của tài khoản khác mà bộ nhớ trình duyệt đầy. Đã đăng xuất để không làm mất tiến độ đó."); fb.auth.signOut(); return; }
    var d2 = catLoad(u.uid); lsSet(OWN, u.uid); route();
    toast("Đang dùng tiến độ của " + email);
    go(d2);
  }
  function ssGet(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function ssSet(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { } }
  function ssDel(k) { try { sessionStorage.removeItem(k); } catch (e) { } }
  // s (đã gộp với r) có gì mới hơn r không — chỉ so "lớn hơn hẳn" trên các trường gộp theo max/thời điểm nên 2 máy không ghi qua lại mãi
  function fbAhead(s, r) {
    var k, j, a, b;
    function gt(x, y) { return (+x || 0) > (+y || 0); }
    a = s.it || {}; b = r.it || {}; for (k in a) if (!b[k]) return true;
    a = s.itT || {}; b = r.itT || {}; for (k in a) if (gt(a[k], b[k])) return true;
    a = s.note || {}; b = r.note || {}; for (k in a) if (!b[k] || gt(a[k][1], b[k][1])) return true;
    a = s.meo || {}; b = r.meo || {}; for (k in a) if (!b[k] || gt(a[k][1], b[k][1]) || (a[k][1] === b[k][1] && gt(a[k][2], b[k][2]))) return true;
    a = s.hard || {}; b = r.hard || {}; for (k in a) if (!b[k] || Math.abs(a[k]) > Math.abs(b[k])) return true;
    a = s.plans || {}; b = r.plans || {}; for (k in a) if (!b[k] || gt(a[k].t, b[k].t)) return true;
    a = s.lt || {}; b = r.lt || {}; for (k in a) if (!b[k] || gt(a[k][4], b[k][4])) return true;
    a = s.gm || {}; b = r.gm || {}; for (k in a) if (!b[k] || gt(a[k][2], b[k][2])) return true;
    a = s.log || {}; b = r.log || {}; for (k in a) if (!b[k] || gt(a[k].n, b[k].n) || gt(a[k].r, b[k].r) || gt(a[k].x, b[k].x)) return true;
    a = s.badges || {}; b = r.badges || {}; for (k in a) if (b[k] == null) return true;
    a = s.best || {}; b = r.best || {}; for (k in a) if (b[k] == null || (k === "memo" ? a[k] < b[k] : a[k] > b[k])) return true;
    a = s.pl || {}; b = r.pl || {};
    for (k in a) { if (!b[k] || gt(a[k].nt, b[k].nt) || gt(a[k].x, b[k].x)) return true; for (j in a[k].ids || {}) if (!(b[k].ids || {})[j] || Math.abs(a[k].ids[j]) > Math.abs(b[k].ids[j])) return true; }
    a = s.streak || {}; b = r.streak || {}; if (gt(a.d, b.d) || (a.d === b.d && gt(a.c, b.c))) return true;
    a = s.cup || {}; b = r.cup || {}; for (k in a) if (!b[k] || gt(b[k], a[k])) return true;
    a = s.rec || {}; b = r.rec || {}; if (a.hb > 0 && (!(b.hb > 0) || a.hb < b.hb)) return true;
    a = a.pf || {}; b = b.pf || {}; for (k in a) if (gt(a[k], b[k])) return true;
    return gt(s.xp, r.xp) || (gt(s.upd, r.upd) && (s.start !== r.start || JSON.stringify(s.set) !== JSON.stringify(r.set)));
  }
  // nhận bản của tài khoản từ máy chủ (get hoặc onSnapshot): gộp vào S; máy còn phần tài khoản chưa có → dirty (sẽ ghi)
  function fbGot(d, own) {
    var first = !fb.remOk; fb.remOk = true;
    fb.rem = d && d.data ? d.data : null;
    setTimeout(planGate, 0); // đã biết bản tiến độ của tài khoản: người mới chưa có lộ trình → hộp thoại bắt buộc chọn
    if (!fb.rem) { fb.dirty = true; return; } // tài khoản chưa có bản nào
    if (own) return; // tiếng vọng lần ghi của chính máy này: S đã chứa sẵn
    applyRemote(fb.rem, first);
    var ahead = true; try { ahead = fbAhead(S, normalize(JSON.parse(fb.rem))); } catch (e) { }
    if (ahead) fb.dirty = true; else if (!fb.dirty) fbMark();
  }
  function fbSync() {
    if (!fb.ref) return Promise.resolve();
    if (fb.busy) { fb.again = true; return Promise.resolve(); }
    if (navigator.onLine === false) { fb.status = "offline"; renderStats(); return Promise.resolve(); }
    if (fb.remOk && !fb.dirty) { fb.status = "ok"; renderStats(); tkSend(); bxhSend(false); meoPub(); return Promise.resolve(); } // không có gì mới: không ghi
    fb.busy = true; fb.status = "syncing"; renderStats();
    var ref = fb.ref;
    var got = fb.remOk ? Promise.resolve() : ref.get({ source: "server" }).then(function (snap) { if (ref === fb.ref) fbGot(snap.exists ? snap.data() : null, false); });
    return got.then(function () {
      if (ref !== fb.ref || !fb.dirty) return;
      var body = JSON.stringify(S), u = S.upd, w = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      fb.dirty = false; fb.myW = w;
      return ref.set({ data: body, upd: Date.now(), ver: 1, w: w }).then(function () {
        fb.rem = body; fb.lastW = Date.now();
        if (!fb.dirty && S.upd === u) fbMark();
        return backup(body);
      }, function (e) { fb.dirty = true; throw e; });
    }).then(function () { fb.status = "ok"; fb.last = Date.now(); })
      .catch(function (e) { fb.status = navigator.onLine === false ? "offline" : "error"; try { console.warn("hanco sync", e && e.code); } catch (x) { } })
      .then(function () {
        fb.busy = false; renderStats(); tkSend(); bxhSend(false); bxhCupCheck(); meoPub(); avmBoot();
        if (fb.again) { fb.again = false; fbSync(); } else if (fb.dirty && fb.status === "ok") scheduleFb();
      });
  }
  HC.fbSync = fbSync;
  function backup(body) {
    var k = dayKey(today()), LK = "hanco-fb-backup";
    var done = null; try { done = localStorage.getItem(LK); } catch (e) { }
    if (done === fb.user.uid + k) return Promise.resolve();
    var col = fb.ref.collection("backups");
    return col.doc(k).set({ data: body, upd: Date.now() }).then(function () {
      try { localStorage.setItem(LK, fb.user.uid + k); } catch (e) { }
      return col.get().then(function (qs) {
        var ids = qs.docs.map(function (d) { return d.id; }).sort();
        var old = ids.slice(0, Math.max(0, ids.length - 14));
        try { var o = demGet(); o.nb = o.nb || {}; o.nb[fb.user.uid] = ids.length - old.length; demSave(); } catch (e) { } // số bản sao lưu (ước tính dung lượng)
        return Promise.all(old.map(function (id) { return col.doc(id).delete(); }));
      });
    });
  }
  HC.fbBackups = function () {
    if (!fb.ref) return Promise.resolve([]);
    return fb.ref.collection("backups").get().then(function (qs) { return qs.docs.map(function (d) { return { id: d.id, data: d.data().data }; }).sort(function (a, b) { return a.id < b.id ? 1 : -1; }); });
  };
  // khôi phục bản sao lưu: như trước, gộp với bản hiện có của tài khoản (không làm mất mục nào) rồi ghi ngay
  HC.fbRestore = function (data) { S = normalize(JSON.parse(data)); if (fb.rem) S = normalize(merge(S, normalize(JSON.parse(fb.rem)))); S.upd = Date.now(); saveLocal(); fb.dirty = true; return fbNow(); };
  // có thay đổi: hẹn ghi — không dời hẹn khi học liên tục; cách lần ghi trước ≥ FB_GAP (ít nhất 4 giây sau thay đổi đầu tiên)
  function scheduleFb() {
    fb.dirty = true;
    if (!fb.ref || fb.timer) return;
    fb.timer = setTimeout(function () { fb.timer = null; fbSync(); }, Math.max(4000, FB_GAP - (Date.now() - fb.lastW)));
  }
  function fbNow() { clearTimeout(fb.timer); fb.timer = null; return fbSync(); }
  HC.fbSignIn = function () {
    if (!fb.on) return toast("Chưa tải được phần đăng nhập. Kiểm tra mạng rồi tải lại trang.");
    var p = new firebase.auth.GoogleAuthProvider();
    ssSet(DN, "1"); // vừa bấm Đăng nhập (giữ được qua kiểu đăng nhập redirect)
    fb.auth.signInWithPopup(p).catch(function (e) {
      if (e && (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-environment" || e.code === "auth/cancelled-popup-request")) fb.auth.signInWithRedirect(p);
      else { ssDel(DN); if (e && e.code !== "auth/popup-closed-by-user") toast("Chưa đăng nhập được (" + (e.code || "lỗi") + ")"); }
    });
  };
  // đồng bộ ngay và chờ lần ghi đang chạy xong (tối đa ~10 giây); trả true nếu tài khoản đã có đủ phần học trên máy
  function fbFlush() {
    return fbNow().then(function () {
      return new Promise(function (res) { var n = 0; (function w() { if (!fb.busy || ++n > 100) res(); else setTimeout(w, 100); })(); });
    }).then(function () { return !!fb.ref && fb.remOk && !fb.dirty && !fb.busy; });
  }
  // Đăng xuất (dùng chung máy): đồng bộ ngay; wipe = false → cất tiến độ của mình riêng trên máy (lần sau đăng nhập có ngay);
  // wipe = true → xóa tiến độ của mình khỏi máy (vẫn còn trên tài khoản; còn phần chưa lên được thì hỏi lại). Màn trở về bản học khi
  // chưa đăng nhập đã cất (nếu có) hoặc bản trống. Trả Promise<true nếu đã đăng xuất>.
  HC.fbSignOut = function (wipe) {
    if (!fb.auth) return Promise.resolve(false);
    if (!fb.user) { fb.auth.signOut(); return Promise.resolve(true); }
    var u = fb.user;
    return fbFlush().then(function (ok) {
      if (fb.user !== u) return false;
      if (wipe && !ok && !confirm("Còn phần học chưa lên được tài khoản (có thể do mất mạng). Xóa khỏi máy thì phần đó sẽ MẤT. Vẫn đăng xuất và xóa?")) return false;
      if (!wipe && !catPut(u.uid, S, ok) && !ok) { toast("Bộ nhớ trình duyệt đầy, chưa cất được phần học chưa đồng bộ. Hãy kết nối mạng rồi đăng xuất lại."); return false; }
      if (wipe) { lsDel(CAT + u.uid); if ((lsGet(FB_OK) || "").indexOf(u.uid + "|") === 0) lsDel(FB_OK); }
      // ngắt khỏi tài khoản TRƯỚC khi đổi tiến độ trên máy (không để bản khách/bản trống bị ghi lên tài khoản này)
      if (fb.unsub) { fb.unsub(); fb.unsub = null; }
      clearTimeout(fb.timer); fb.timer = null; fb.ref = null; fb.user = null; fb.dirty = false;
      catLoad(""); lsSet(OWN, "");
      fb.auth.signOut(); route();
      return true;
    });
  };
  // ---------- BỘ ĐẾM HẠN MỨC (Bước 5 kế hoạch nhiều người dùng) ----------
  // App không đọc được số hạn mức chính thức (chỉ có ở console) → MỖI MÁY tự đếm: lượt đọc r / ghi w / xóa x Firestore, byte tải từ
  // Firestore b (ước tính = độ dài dữ liệu nhận + ~100), byte tải từ Hosting h (sw.js đếm tệp đi qua service worker vào đệm "dem-v1";
  // tệp không qua service worker thì trang tự đếm bằng Resource Timing). Chia NGÀY HẠN MỨC theo giờ Thái Bình Dương (Google đặt lại hạn
  // mức ngày lúc 0 giờ PT = 15:00 giờ VN, 14:00 mùa hè bên Mỹ). localStorage DEM_LS = {id mã máy, d, r,w,x,b,h, y {hôm trước}, mo, m {tháng},
  // hs tổng byte sw.js đã tính, t}. Gửi kèm bản thống kê (tk.q[id máy]) ≤ 1 lần/giờ; máy quản trị ghi hanco_qt/dem. Tất cả là ƯỚC TÍNH.
  var DEM_LS = "hanco-dem", DEM_SW = "dem-v1", DEM_KEY = "./__dem", DEM_K = ["r", "w", "x", "b", "h"], dem = null, demT = null;
  var PT_F = null; try { PT_F = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", year: "numeric", month: "numeric", day: "numeric" }); } catch (e) { }
  function ptDay(ms) {
    if (ms == null) ms = Date.now();
    if (PT_F) { try { var p = PT_F.format(new Date(ms)).replace(/[^\d\/]/g, "").split("/"), d = Math.round(Date.UTC(+p[2], +p[0] - 1, +p[1]) / 864e5); if (d > 0) return d; } catch (e) { } }
    return Math.floor((ms - 8 * 3600e3) / 864e5); // không có Intl: coi như UTC−8
  }
  function ptMon(d) { var x = new Date(d * 864e5); return x.getUTCFullYear() * 100 + x.getUTCMonth() + 1; }
  function demZero() { return { r: 0, w: 0, x: 0, b: 0, h: 0 }; }
  function demGet() {
    if (dem) return dem;
    var o = jget(DEM_LS);
    if (!o.id) o.id = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-3);
    DEM_K.forEach(function (k) { o[k] = +o[k] || 0; });
    if (!o.m) o.m = demZero();
    dem = o; demRoll(); return dem;
  }
  function demRoll() { // sang ngày / tháng hạn mức mới
    var o = dem, t = ptDay(), mo = ptMon(t);
    if (o.d !== t) {
      if (o.d) { o.y = { d: o.d }; DEM_K.forEach(function (k) { o.y[k] = Math.round(o[k]); }); }
      DEM_K.forEach(function (k) { o[k] = 0; }); o.d = t;
    }
    if (o.mo !== mo) { o.m = demZero(); o.mo = mo; }
  }
  function demAdd(k, n) {
    if (!(n > 0)) return;
    try {
      var o = demGet(); demRoll(); o[k] += n; o.m[k] += n; o.t = Date.now();
      if (!demT) demT = setTimeout(demSave, 3000);
    } catch (e) { }
  }
  function demSave() { clearTimeout(demT); demT = null; if (dem) lsSet(DEM_LS, JSON.stringify(dem)); }
  HC.demAdd = demAdd;
  // bản gửi đi (bỏ hs; làm tròn)
  function demOut() {
    var o = demGet(); demRoll();
    var e = { d: o.d, mo: o.mo, t: o.t || Date.now(), m: {} };
    DEM_K.forEach(function (k) { e[k] = Math.round(o[k]); e.m[k] = Math.round(o.m[k] || 0); });
    if (o.y) e.y = o.y;
    return e;
  }
  HC.demOut = demOut;
  // byte Hosting sw.js đã đếm (tổng cộng dồn trong đệm DEM_SW) → cộng phần tăng thêm vào h
  function demPull() {
    if (!window.caches || !caches.open) return Promise.resolve();
    return caches.open(DEM_SW).then(function (c) { return c.match(DEM_KEY); }).then(function (r) { return r ? r.json() : null; }).then(function (j) {
      if (!j || !(+j.b >= 0)) return;
      var o = demGet(), b = +j.b, hs = +o.hs || 0, d = b >= hs ? b - hs : b; // đệm bị xóa → sw.js đếm lại từ 0
      o.hs = b; if (d > 0) demAdd("h", d); else demSave();
    }).catch(function () { });
  }
  HC.demPull = demPull;
  // tệp cùng trang KHÔNG qua service worker (lần mở đầu tiên, trình duyệt không có service worker): trang tự đếm (workerStart = 0)
  function demPerf() {
    try {
      if (!window.PerformanceObserver) return;
      var me = location.origin;
      var po = new PerformanceObserver(function (l) {
        l.getEntries().forEach(function (e) { if (e.name.indexOf(me) === 0 && !(e.workerStart > 0) && e.transferSize > 0) demAdd("h", e.transferSize); });
      });
      po.observe({ type: "resource", buffered: true });
    } catch (e) { }
  }
  // gắn bộ đếm vào thư viện Firestore (compat) — CHỈ đếm, trả nguyên kết quả lệnh gốc; thư viện khác dạng thì không gắn
  function demPatch() {
    var F = window.firebase && firebase.firestore;
    if (!F || F.__dem || !F.DocumentReference || !F.Query) return;
    F.__dem = 1;
    function wrap(P, name, fn) { if (P && typeof P[name] === "function") { var o = P[name]; P[name] = function () { return fn.call(this, o, arguments); }; } }
    function sz(s) { try { return s && s.exists !== false && s.data ? JSON.stringify(s.data() || {}).length + 100 : 100; } catch (e) { return 100; } }
    function one(s) { if (s && s.metadata && !s.metadata.fromCache) { demAdd("r", 1); demAdd("b", sz(s)); } return s; }
    function many(q, docs) { if (q && q.metadata && !q.metadata.fromCache) { demAdd("r", Math.max(1, docs.length)); docs.forEach(function (d) { demAdd("b", sz(d)); }); if (!docs.length) demAdd("b", 100); } return q; }
    function after(p, k, n) { return p && p.then ? p.then(function (v) { demAdd(k, n); return v; }) : p; }
    var D = F.DocumentReference.prototype, Q = F.Query.prototype;
    wrap(D, "get", function (o, a) { return o.apply(this, a).then(one); });
    wrap(D, "set", function (o, a) { return after(o.apply(this, a), "w", 1); });
    wrap(D, "update", function (o, a) { return after(o.apply(this, a), "w", 1); });
    wrap(D, "delete", function (o, a) { return after(o.apply(this, a), "x", 1); });
    function qget(o, a) { return o.apply(this, a).then(function (q) { return many(q, q.docs || []); }); }
    wrap(Q, "get", qget);
    if (F.CollectionReference && F.CollectionReference.prototype.hasOwnProperty("get")) wrap(F.CollectionReference.prototype, "get", qget);
    // nghe theo thời gian thực: tính bản từ máy chủ có dữ liệu khác bản trước (bỏ bản từ đệm, bản đang chờ ghi, chỉ đổi metadata)
    function lis(isQ) {
      return function (o, a) {
        var args = Array.prototype.slice.call(a), last = null, first = true, i;
        function seen(s) {
          try {
            var m = s.metadata || {}, live = !m.fromCache && !m.hasPendingWrites;
            if (isQ) {
              if (!live) return;
              if (first) { first = false; many(s, s.docs || []); return; }
              var dd = (s.docChanges ? s.docChanges() : []).filter(function (c) { return c.type !== "removed"; }).map(function (c) { return c.doc; });
              if (dd.length) many(s, dd);
            } else {
              var j = s.exists ? JSON.stringify(s.data() || {}) : "";
              if (live && (first || j !== last)) { first = false; demAdd("r", 1); demAdd("b", j.length + 100); }
              last = j;
            }
          } catch (e) { }
        }
        for (i = 0; i < args.length; i++) {
          if (typeof args[i] === "function") { args[i] = (function (f) { return function (s) { seen(s); return f.apply(this, arguments); }; })(args[i]); break; }
          if (args[i] && typeof args[i].next === "function") {
            args[i] = (function (ob) { return { next: function (s) { seen(s); return ob.next.apply(ob, arguments); }, error: ob.error && ob.error.bind(ob), complete: ob.complete && ob.complete.bind(ob) }; })(args[i]);
            break;
          }
        }
        return o.apply(this, args);
      };
    }
    wrap(D, "onSnapshot", lis(false));
    wrap(Q, "onSnapshot", lis(true));
    var B = F.WriteBatch && F.WriteBatch.prototype;
    if (B) {
      wrap(B, "set", function (o, a) { this.__w = (this.__w || 0) + 1; return o.apply(this, a); });
      wrap(B, "update", function (o, a) { this.__w = (this.__w || 0) + 1; return o.apply(this, a); });
      wrap(B, "delete", function (o, a) { this.__x = (this.__x || 0) + 1; return o.apply(this, a); });
      wrap(B, "commit", function (o, a) { var me = this; return o.apply(this, a).then(function (v) { demAdd("w", me.__w || 0); demAdd("x", me.__x || 0); return v; }); });
    }
    var T = F.Transaction && F.Transaction.prototype; // transaction chạy lại khi xung đột → đếm dư chút ít
    if (T) {
      wrap(T, "get", function (o, a) { return o.apply(this, a).then(function (s) { demAdd("r", 1); demAdd("b", sz(s)); return s; }); });
      wrap(T, "set", function (o, a) { demAdd("w", 1); return o.apply(this, a); });
      wrap(T, "update", function (o, a) { demAdd("w", 1); return o.apply(this, a); });
      wrap(T, "delete", function (o, a) { demAdd("x", 1); return o.apply(this, a); });
    }
  }
  try { addEventListener("pagehide", demSave); document.addEventListener("visibilitychange", function () { if (document.hidden) { demSave(); tkSend(); } }); } catch (e) { }
  function fbInit() {
    if (!window.firebase || !firebase.initializeApp) return tkNoFb();
    try {
      var app = firebase.apps && firebase.apps.length ? firebase.app() : firebase.initializeApp(FB_CONFIG);
      try { demPatch(); demPerf(); } catch (e) { }
      fb.auth = firebase.auth(); fb.db = firebase.firestore(); fb.on = true;
      fb.auth.languageCode = "vi"; // email xác nhận / đặt lại mật khẩu + trang bấm link bằng tiếng Việt
      if (TK_EMU) { fb.auth.useEmulator("http://127.0.0.1:9099", { disableWarnings: true }); fb.db.useEmulator("127.0.0.1", 8080); }
    } catch (e) { return tkNoFb(); }
    fb.status = "signedout";
    fb.auth.getRedirectResult().catch(function (e) { if (e && e.code && e.code !== "auth/popup-closed-by-user") toast(tkErr(e)); });
    fb.auth.onAuthStateChanged(function (u) {
      if (fb.unsub) { fb.unsub(); fb.unsub = null; }
      clearTimeout(fb.timer); fb.timer = null;
      if (fb.ask) { var a = fb.ask; fb.ask = null; a.close(); } // khung hỏi gộp của lần đăng nhập trước
      fb.user = u; fb.ref = null; // chỉ gắn tài khoản sau khi xác định xong chủ tiến độ trên máy (fbOwn)
      fb.rem = null; fb.remOk = false; fb.myW = "";
      try { sachRefresh(); } catch (e) { }
      tkStop();
      if (!u) { fb.status = "signedout"; lsDel(TK_LS); tkSet(TK_GATE ? "vao" : "ok"); renderStats(); softRefresh(); return; }
      var dn = ssGet(DN); ssDel(DN);
      tkStart(u, dn); // tài khoản "ok" → tkGo → fbOwn → fbAttach như cũ
    });
    fb.attach = fbAttach;
    function fbAttach(u, dirty) {
      fb.ref = fb.db.collection("hanco_progress").doc(u.uid);
      try { sachRefresh(); } catch (e) { } // khung sách / thẻ Cài đặt đang hiện: nay đọc được kho chung (Bước 6)
      fb.dirty = dirty == null ? !fbClean() : dirty; // máy có phần chưa lên tài khoản (học khi chưa đăng nhập / tắt app trước khi kịp ghi)
      var ref = fb.ref, started = false;
      function start() { if (started || ref !== fb.ref) return; started = true; fbSync().then(softRefresh); }
      // nghe tài khoản theo thời gian thực: bản đầu tiên từ máy chủ = mốc để gộp (thay cho get), các bản sau = máy khác vừa ghi
      fb.unsub = ref.onSnapshot({ includeMetadataChanges: true }, function (snap) {
        if (ref !== fb.ref || snap.metadata.hasPendingWrites || snap.metadata.fromCache) return;
        var d = snap.exists ? snap.data() : null;
        if (fb.remOk && d && d.data === fb.rem) return; // không có gì mới (vd chỉ đổi trạng thái đã lên máy chủ)
        fbGot(d, !!(d && d.w && d.w === fb.myW));
        fb.last = Date.now();
        if (!started) start(); else { if (fb.dirty) scheduleFb(); renderStats(); }
      }, function () { if (ref === fb.ref) { fb.unsub = null; start(); } }); // nghe lỗi → đồng bộ kiểu get 1 lần
      setTimeout(start, 8000); // mạng chậm / chưa nhận bản nào: tự get
    }
    document.addEventListener("visibilitychange", function () {
      if (!fb.ref) return;
      if (document.visibilityState === "hidden") fbNow();
    });
    window.addEventListener("pagehide", function () { if (fb.ref) fbNow(); });
    window.addEventListener("online", function () { if (fb.ref) { var had = fb.dirty; fbNow().then(function () { if (had && fb.status === "ok") toast("Có mạng trở lại: đã đồng bộ phần học lúc ngoại tuyến"); }); } else renderStats(); });
    window.addEventListener("offline", function () { if (fb.ref) { fb.status = "offline"; } renderStats(); });
  }

  // ---------- TÀI KHOẢN (nhiều người dùng, Bước 3 — 26/11/2026) ----------
  // Chưa đăng nhập / chưa xác nhận email / chưa đăng ký xong / bị khóa → KHÓA giao diện: route() chỉ hiện màn tài khoản (tkView).
  // Firestore (luật ở firestore.rules): hanco_users/{uid} hồ sơ {ten, hoten, hk, email, st, tao, upd}; hanco_ten/{khóa họ tên}
  // danh sách họ tên thật {ten, uid|null} (không ai liệt kê được trừ quản trị); hanco_cfg/dk {tran, dem, mo}. Đăng ký = 1 transaction:
  // tạo hồ sơ + giữ tên + dem+1 (luật kiểm còn chỗ, tên còn trống, email đã xác nhận). Nghe hồ sơ theo thời gian thực → bị khóa là
  // ra màn "Tài khoản đang tạm khóa" ngay, ngắt đồng bộ. localStorage TK_LS = trạng thái hồ sơ lần gần nhất (mở app ngoại tuyến được);
  // DK_LS = thông tin đăng ký đang chờ xác nhận email. Không thuộc S. Quản trị viên (mã 000) = ADMIN_UID: luôn được phép.
  var ADMIN_UID = "PoB9oWSF4WRAPkWYtKaXfAHSX7F3", TK_LS = "hanco-tk", DK_LS = "hanco-dk";
  var TK_GATE = !(window.claude && typeof window.claude.use === "function"); // chạy trong Claude (bản cũ) thì không khóa
  var TK_EMU = /[?&]emu\b/.test(location.search) && /^(localhost|127\.0\.0\.1)$/.test(location.hostname); // thử ở máy với bộ giả lập
  var tk = { st: "cho", prof: null, unsub: null, u: null, dn: null, going: false, view: "vao", msg: "", poll: null };
  (function () { var c = tkCache(); tk.st = !TK_GATE ? "ok" : c && c.st === "ok" ? "ok" : "cho"; })(); // mở app: khỏi nháy màn chờ
  HC.tk = tk;
  function tkCache() { try { var c = JSON.parse(lsGet(TK_LS)); return c && c.uid ? c : null; } catch (e) { return null; } }
  function isAdmin() { return !!(fb.user && fb.user.uid === ADMIN_UID); }
  HC.isAdmin = isAdmin;
  function tkSet(st, msg) {
    if (msg != null) tk.msg = msg;
    if (tk.st === st && st === "ok") return;
    tk.st = st; route();
  }
  HC.tkSet = tkSet;
  // chuẩn hóa họ tên: Unicode NFC, bỏ ký tự vô hình, gộp khoảng trắng. Khóa so khớp: + chữ thường, dấu thanh tách khỏi vị trí đặt
  // (Hòa = Hoà, Thúy = Thuý — kiểu bỏ dấu cũ/mới) nhưng LOẠI dấu thanh + dấu mũ/trăng/móc + đ vẫn phải đúng.
  function nameNorm(s) {
    s = String(s == null ? "" : s); if (s.normalize) s = s.normalize("NFC");
    return s.replace(/[​-‍⁠﻿]/g, "").replace(/[Ð]/g, "Đ").replace(/[ð]/g, "đ").replace(/\//g, " ").replace(/\s+/g, " ").trim();
  }
  var TONE = { "̀": "f", "́": "s", "̉": "r", "̃": "x", "̣": "j" };
  function nameKey(s) {
    s = nameNorm(s).toLowerCase();
    return s.split(" ").map(function (w) {
      var d = w.normalize ? w.normalize("NFD") : w, t = "";
      d = d.replace(/[̣̀́̉̃]/g, function (m) { t += TONE[m]; return ""; });
      if (d.normalize) d = d.normalize("NFC");
      return d + (t ? "_" + t.split("").sort().join("") : "");
    }).join(" ");
  }
  HC.nameKey = nameKey; HC.nameNorm = nameNorm;
  function tkErr(e) {
    var c = (e && e.code) || "";
    var m = {
      "auth/invalid-email": "Email chưa đúng dạng (vd ten@gmail.com).",
      "auth/missing-password": "Hãy nhập mật khẩu.",
      "auth/weak-password": "Mật khẩu phải có ít nhất 6 ký tự.",
      "auth/email-already-in-use": "Email này đã có tài khoản. Hãy đăng nhập (đăng ký bằng Google thì bấm nút Google), hoặc bấm \"Quên mật khẩu?\".",
      "auth/invalid-credential": "Email hoặc mật khẩu chưa đúng. Nếu bạn đăng ký bằng Google, hãy bấm nút \"Đăng nhập bằng Google\".",
      "auth/wrong-password": "Email hoặc mật khẩu chưa đúng.",
      "auth/user-not-found": "Email hoặc mật khẩu chưa đúng.",
      "auth/invalid-login-credentials": "Email hoặc mật khẩu chưa đúng.",
      "auth/user-disabled": "Tài khoản này đã bị tắt. Liên hệ quản trị viên.",
      "auth/too-many-requests": "Thử quá nhiều lần. Hãy chờ vài phút rồi thử lại (hoặc bấm \"Quên mật khẩu?\").",
      "auth/network-request-failed": "Không có mạng. Kiểm tra kết nối rồi thử lại.",
      "auth/popup-blocked": "Trình duyệt chặn cửa sổ đăng nhập. Hãy thử lại.",
      "auth/requires-recent-login": "Hãy đăng nhập lại rồi thử lại.",
      "auth/account-exists-with-different-credential": "Email này đã đăng ký bằng mật khẩu. Hãy đăng nhập bằng email + mật khẩu.",
      "unavailable": "Không có mạng. Kiểm tra kết nối rồi thử lại."
    }[c];
    return m || "Chưa làm được (" + (c || (e && e.message) || "lỗi") + "). Hãy thử lại.";
  }
  function tkActs() { return { url: location.origin + location.pathname }; } // bấm link trong email xong → nút "Tiếp tục" về app
  // không có Firebase (mất mạng lần đầu, bị chặn): còn nhớ tài khoản "ok" thì học ngoại tuyến được, không thì báo cần mạng
  function tkNoFb() { if (!TK_GATE) return; var c = tkCache(); tkSet(c && c.st === "ok" ? "ok" : "mang"); }
  function tkStop() {
    if (tk.unsub) { tk.unsub(); tk.unsub = null; }
    tk.u = null; tk.prof = null; tk.going = false;
  }
  // tài khoản "ok": gắn tiến độ như Bước 2 (xác định chủ tiến độ trên máy → đồng bộ)
  function tkGo() {
    var u = tk.u;
    if (!u || fb.user !== u || fb.ref || tk.going) return;
    tk.going = true;
    fbOwn(u, tk.dn, function (dirty) { tk.going = false; tk.dn = null; if (fb.user === u && !fb.ref && tk.st === "ok") { fb.attach(u, dirty); chungLoad(); } });
  }
  // bị khóa / bị xóa: ngắt đồng bộ ngay (tiến độ trên máy giữ nguyên)
  function tkDetach() {
    if (fb.unsub) { fb.unsub(); fb.unsub = null; }
    clearTimeout(fb.timer); fb.timer = null; fb.ref = null; tk.going = false;
    if (fb.ask) { var a = fb.ask; fb.ask = null; a.close(); }
  }
  function tkStart(u, dn) {
    tk.u = u; tk.dn = dn;
    if (!TK_GATE || u.uid === ADMIN_UID) {
      if (u.uid === ADMIN_UID) { lsSet(TK_LS, JSON.stringify({ uid: u.uid, st: "ok" })); qtCfgEnsure(); }
      var was = tk.st === "ok";
      tkSet("ok"); tkGo();
      if (was && u.uid === ADMIN_UID) { renderMenu(); if (/^qt/.test(cur || "")) route(); } // tab Quản trị chỉ hiện khi đã biết là quản trị
      return;
    }
    if (!u.emailVerified) { tkSet("xac", ""); return; }
    var c = tkCache();
    if (c && c.uid === u.uid) tkApply(c.st); else tkSet("cho", "");
    tkListen(u);
  }
  function tkApply(st) {
    if (st === "ok") { tkSet("ok"); tkGo(); return; }
    tkDetach(); tkSet(st === "xoa" ? "xoa" : "khoa");
  }
  // nghe hồ sơ của mình theo thời gian thực (khóa / mở khóa có hiệu lực ngay)
  function tkListen(u) {
    var ref = fb.db.collection("hanco_users").doc(u.uid);
    tk.unsub = ref.onSnapshot(function (snap) {
      if (fb.user !== u || tk.u !== u) return;
      if (!snap.exists) {
        tk.prof = null; lsDel(TK_LS);
        if (tk.st === "ok") tkDetach();
        tkSet("dk"); tkAutoClaim(u); return;
      }
      var d = snap.data(); tk.prof = d;
      lsSet(TK_LS, JSON.stringify({ uid: u.uid, st: d.st, ten: d.ten, hoten: d.hoten, email: d.email }));
      tkApply(d.st);
    }, function () { if (tk.u === u && tk.st === "cho") tkSet("cho", "Chưa kiểm tra được tài khoản. Kiểm tra mạng rồi bấm Thử lại."); });
  }
  // kiểm tra trước khi đăng ký: còn chỗ + đang mở + họ tên có trong danh sách và còn trống. Trả {ten: họ tên đúng như danh sách}
  function tkCheck(hoten) {
    var k = nameKey(hoten);
    if (k.length < 2) return Promise.reject(new Error("Hãy nhập họ tên đầy đủ của bạn."));
    var db = fb.db;
    return db.collection("hanco_cfg").doc("dk").get().then(function (c) {
      var d = c.exists ? c.data() : null;
      if (!d || !d.mo) throw new Error("Đăng ký đang tạm đóng. Liên hệ quản trị viên.");
      if (!((+d.dem || 0) < (+d.tran || 0))) throw new Error("App đã đủ người");
      return db.collection("hanco_ten").doc(k).get().then(function (n) {
        if (!n.exists) throw new Error("Đây không phải tên thật hoặc chưa đúng họ tên đầy đủ của bạn");
        return { k: k, ten: n.data().ten, dem: +d.dem || 0 };
      }, function (e) {
        if (e && e.code === "permission-denied") throw new Error("Họ tên này đã có tài khoản, liên hệ quản trị viên");
        throw e;
      });
    });
  }
  // hoàn tất đăng ký (email đã xác nhận / Google): tạo hồ sơ + giữ tên + dem+1 trong 1 transaction (luật kiểm lại tất cả)
  function tkClaim(u, ten, hoten) {
    ten = nameNorm(ten);
    if (ten.length < 2 || ten.length > 30) return Promise.reject(new Error("Tên hiển thị dài 2–30 ký tự."));
    var db = fb.db, FV = firebase.firestore.FieldValue;
    return u.getIdToken(true).then(function () { return tkCheck(hoten); }).then(function (r) {
      var cref = db.collection("hanco_cfg").doc("dk"), nref = db.collection("hanco_ten").doc(r.k), uref = db.collection("hanco_users").doc(u.uid);
      return db.runTransaction(function (tx) {
        return tx.get(cref).then(function (c) {
          var d = c.exists ? c.data() : {};
          if (!d.mo) throw new Error("Đăng ký đang tạm đóng. Liên hệ quản trị viên.");
          if (!((+d.dem || 0) < (+d.tran || 0))) throw new Error("App đã đủ người");
          tx.set(uref, { ten: ten, hoten: r.ten, hk: r.k, email: u.email, st: "ok", tao: FV.serverTimestamp(), upd: Date.now() });
          tx.update(nref, { uid: u.uid, t: FV.serverTimestamp() });
          tx.update(cref, { dem: (+d.dem || 0) + 1 });
        });
      }).catch(function (e) {
        if (e && e.code === "permission-denied") return tkCheck(hoten).then(function () { throw new Error("Chưa đăng ký được. Hãy thử lại."); });
        throw e;
      });
    }).then(function () { lsDel(DK_LS); toast("Đăng ký xong! Chào mừng " + ten); });
  }
  function tkPending(u) { try { var p = JSON.parse(lsGet(DK_LS)); return p && u && u.email && String(p.email).toLowerCase() === u.email.toLowerCase() ? p : null; } catch (e) { return null; } }
  // vừa xác nhận email: tự hoàn tất bằng thông tin đã điền lúc đăng ký (không bắt điền lại)
  function tkAutoClaim(u) {
    var p = tkPending(u); if (!p || tk.busy) return;
    tk.busy = true; tk.msg = "Đang hoàn tất đăng ký…"; route();
    tkClaim(u, p.ten, p.hoten).then(function () { tk.busy = false; tk.msg = ""; }, function (e) { tk.busy = false; tk.msg = e.message && !e.code ? e.message : tkErr(e); if (tk.st === "dk") route(); });
  }
  function tkOut() {
    var u = fb.user;
    if (u && lsGet(OWN) === u.uid) return HC.fbSignOut(false);
    if (fb.auth) fb.auth.signOut();
    return Promise.resolve(true);
  }
  // quản trị: tạo cấu hình đăng ký mặc định nếu chưa có (trần 120, đang mở)
  function qtCfgEnsure() {
    var ref = fb.db.collection("hanco_cfg").doc("dk");
    ref.get().then(function (c) { if (!c.exists) return ref.set({ tran: 120, dem: 0, mo: true }); }).catch(function () { });
    bxhEnsure(); // bảng xếp hạng (Bước 7)
    vaiLoad(); // hai vai của quản trị (27/11/2026)
  }

  // màn tài khoản (thay cho mọi màn khi chưa vào được app)
  function tkView(v) {
    var st = tk.st, u = fb.user, msg = tk.msg ? '<p class="tkmsg" role="alert">' + esc(tk.msg) + "</p>" : "";
    var head = '<div class="tkhead"><span class="seal" aria-hidden="true">學</span><div><b>Hán cổ tự học</b><small>Khoa Phật học từ xa · Khóa XI</small></div></div>';
    var eye = '<button type="button" class="btn sm ghost tkeye" data-eye aria-label="Hiện mật khẩu">Hiện</button>';
    var h = "", cleanup = null;
    if (st === "vao" && tk.view === "tao") {
      h = '<h1>Tạo tài khoản</h1>' + msg + '<form class="tkf" data-f="tao" novalidate>' +
        '<div class="field"><label for="tke">Email</label><input id="tke" type="email" autocomplete="email" inputmode="email" required></div>' +
        '<div class="field"><label for="tkt">Tên hiển thị</label><input id="tkt" type="text" maxlength="30" autocomplete="nickname" required><small>Người khác thấy tên này (vd bảng xếp hạng).</small></div>' +
        '<div class="field"><label for="tkh">Họ tên đầy đủ của bạn</label><input id="tkh" type="text" maxlength="80" autocomplete="name" required><small>Chỉ quản trị viên thấy. Gõ đúng họ tên thật, có dấu.</small></div>' +
        '<div class="field"><label for="tkp">Mật khẩu (ít nhất 6 ký tự)</label><div class="tkpw"><input id="tkp" type="password" autocomplete="new-password" minlength="6" required>' + eye + '</div></div>' +
        '<p class="sub">Quản trị viên xem được thống kê học của bạn. Sau khi bấm "Tạo tài khoản", mở email để xác nhận địa chỉ.</p>' +
        '<div class="row acts"><button class="btn primary" type="submit">Tạo tài khoản</button></div></form>' +
        '<p class="tklinks"><a href="#" data-to="vao">Đã có tài khoản? Đăng nhập</a></p>';
    } else if (st === "vao" && tk.view === "quen") {
      h = '<h1>Quên mật khẩu</h1>' + msg + '<p class="sub">Nhập email đã đăng ký. App gửi một đường link để bạn đặt mật khẩu MỚI (không gửi lại được mật khẩu cũ).</p><form class="tkf" data-f="quen" novalidate>' +
        '<div class="field"><label for="tke">Email</label><input id="tke" type="email" autocomplete="email" inputmode="email" required></div>' +
        '<div class="row acts"><button class="btn primary" type="submit">Gửi link đặt mật khẩu mới</button></div></form>' +
        '<p class="tklinks"><a href="#" data-to="vao">← Quay lại đăng nhập</a></p>';
    } else if (st === "vao") {
      h = '<h1>Đăng nhập để học</h1>' + msg + '<div class="row"><button class="btn primary tkg" type="button" data-google>Đăng nhập bằng Google</button></div>' +
        '<div class="tkor"><span>hoặc dùng email</span></div><form class="tkf" data-f="vao" novalidate>' +
        '<div class="field"><label for="tke">Email</label><input id="tke" type="email" autocomplete="email" inputmode="email" required></div>' +
        '<div class="field"><label for="tkp">Mật khẩu</label><div class="tkpw"><input id="tkp" type="password" autocomplete="current-password" required>' + eye + '</div></div>' +
        '<div class="row acts"><button class="btn" type="submit">Đăng nhập</button></div></form>' +
        '<p class="tklinks"><a href="#" data-to="quen">Quên mật khẩu?</a><a href="#" data-to="tao">Chưa có tài khoản? Tạo tài khoản</a></p>';
    } else if (st === "xac") {
      h = '<h1>Xác nhận email</h1>' + msg + '<p>App đã gửi thư xác nhận tới <b>' + esc(u && u.email) + '</b>. Mở thư, bấm vào đường link trong thư, rồi quay lại đây.</p><p class="sub">Không thấy thư? Xem cả mục Thư rác / Quảng cáo. Trang này tự kiểm tra mỗi vài giây.</p>' +
        '<div class="row acts"><button class="btn primary" type="button" data-xn>Tôi đã xác nhận</button><button class="btn" type="button" data-gl>Gửi lại thư</button></div>' +
        '<p class="tklinks"><a href="#" data-doi>Gõ sai email? Tạo lại</a><a href="#" data-out>Đăng xuất</a></p>';
    } else if (st === "dk") {
      var p = tkPending(u) || {}, isG = u && u.providerData.some(function (x) { return x.providerId === "google.com"; });
      if (tk.busy) h = '<h1>Hoàn tất đăng ký</h1><p class="sub">Đang hoàn tất đăng ký…</p>';
      else h = '<h1>Hoàn tất đăng ký</h1>' + msg + '<p class="sub">Tài khoản <b>' + esc(u && u.email) + '</b>' + (isG ? " (Google)" : "") + ' chưa đăng ký vào app. Điền 2 ô dưới đây.</p><form class="tkf" data-f="dk" novalidate>' +
        '<div class="field"><label for="tkt">Tên hiển thị</label><input id="tkt" type="text" maxlength="30" autocomplete="nickname" required value="' + esc(p.ten || (u && u.displayName ? String(u.displayName).slice(0, 30) : "")) + '"><small>Người khác thấy tên này (vd bảng xếp hạng).</small></div>' +
        '<div class="field"><label for="tkh">Họ tên đầy đủ của bạn</label><input id="tkh" type="text" maxlength="80" autocomplete="name" required value="' + esc(p.hoten || "") + '"><small>Chỉ quản trị viên thấy. Gõ đúng họ tên thật, có dấu.</small></div>' +
        '<p class="sub">Quản trị viên xem được thống kê học của bạn.</p>' +
        '<div class="row acts"><button class="btn primary" type="submit">Hoàn tất đăng ký</button></div></form>' +
        '<p class="tklinks"><a href="#" data-out>Đăng xuất</a></p>';
    } else if (st === "khoa") {
      h = '<h1>Tài khoản đang tạm khóa</h1><p>Tài khoản <b>' + esc(u && u.email) + '</b> đang bị quản trị viên tạm khóa. Liên hệ quản trị viên để được mở lại.</p><p class="sub">Tiến độ học của bạn vẫn được giữ. Khi được mở khóa, app tự vào lại.</p><div class="row acts"><button class="btn" type="button" data-out>Đăng xuất</button></div>';
    } else if (st === "xoa") {
      h = '<h1>Tài khoản đã bị xóa khỏi app</h1><p>Tài khoản <b>' + esc(u && u.email) + '</b> không còn dùng được app. Liên hệ quản trị viên nếu có nhầm lẫn.</p><div class="row acts"><button class="btn" type="button" data-out>Đăng xuất</button></div>';
    } else if (st === "mang") {
      h = '<h1>Cần kết nối mạng</h1><p>Lần đầu mở app (hoặc chưa đăng nhập) cần có mạng để đăng nhập.</p><div class="row acts"><button class="btn primary" type="button" data-reload>Tải lại trang</button></div>';
    } else { // cho
      h = '<h1>Đang mở app…</h1>' + (tk.msg ? msg + '<div class="row acts"><button class="btn primary" type="button" data-reload>Thử lại</button>' + (u ? '<button class="btn" type="button" data-out>Đăng xuất</button>' : "") + "</div>" : '<p class="sub">Đang kiểm tra tài khoản…</p>');
      if (!tk.msg) cleanup = (function () { var t = setTimeout(function () { if (tk.st === "cho" && !tk.msg) { tk.msg = "Chưa kết nối được. Kiểm tra mạng rồi bấm Thử lại."; route(); } }, 12000); return function () { clearTimeout(t); }; })();
    }
    v.innerHTML = '<div class="tkwrap"><div class="card tk">' + head + h + "</div></div>";
    function busy(b, on) { if (b) { b.disabled = on; } }
    function show(m) { tk.msg = m; var el = $(".tkmsg", v); if (el) el.textContent = m; else { var f = $("h1", v); if (f) f.insertAdjacentHTML("afterend", '<p class="tkmsg" role="alert">' + esc(m) + "</p>"); } }
    function err(e) { return e && e.message && !e.code ? e.message : tkErr(e); }
    $$("[data-to]", v).forEach(function (a) { a.onclick = function (e) { e.preventDefault(); var em = $("#tke", v); tk.view = a.getAttribute("data-to"); tk.msg = ""; route(); var e2 = $("#tke"); if (em && e2 && em.value) e2.value = em.value; }; });
    $$("[data-eye]", v).forEach(function (b) { b.onclick = function () { var i = b.parentNode.querySelector("input"); var sh = i.type === "password"; i.type = sh ? "text" : "password"; b.textContent = sh ? "Ẩn" : "Hiện"; b.setAttribute("aria-label", sh ? "Ẩn mật khẩu" : "Hiện mật khẩu"); }; });
    $$("[data-out]", v).forEach(function (b) { b.onclick = function (e) { e.preventDefault(); tk.msg = ""; tk.view = "vao"; tkOut(); }; });
    $$("[data-reload]", v).forEach(function (b) { b.onclick = function () { location.reload(); }; });
    var g = $("[data-google]", v); if (g) g.onclick = function () { tk.msg = ""; HC.fbSignIn(); };
    var f = $("form.tkf", v);
    if (f) f.onsubmit = function (e) {
      e.preventDefault();
      var kind = f.getAttribute("data-f"), btn = $("[type=submit]", f), val = function (id) { var i = $(id, f); return i ? i.value : ""; };
      var email = val("#tke").trim(), pw = val("#tkp"), ten = nameNorm(val("#tkt")), hoten = nameNorm(val("#tkh"));
      if (!fb.on) return show("Chưa tải được phần đăng nhập. Kiểm tra mạng rồi tải lại trang.");
      if (kind === "vao") {
        if (!email || !pw) return show("Hãy nhập email và mật khẩu.");
        busy(btn, true); ssSet(DN, "1");
        fb.auth.signInWithEmailAndPassword(email, pw).then(function () { tk.msg = ""; }, function (x) { ssDel(DN); busy(btn, false); show(tkErr(x)); });
      } else if (kind === "quen") {
        if (!/^\S+@\S+\.\S+$/.test(email)) return show("Hãy nhập đúng email đã đăng ký.");
        busy(btn, true);
        fb.auth.sendPasswordResetEmail(email, tkActs()).then(ok, function (x) { if (x && (x.code === "auth/user-not-found" || x.code === "auth/invalid-credential")) ok(); else { busy(btn, false); show(tkErr(x)); } });
        function ok() { busy(btn, false); show("Nếu email này đã đăng ký, thư đặt mật khẩu mới đã được gửi tới " + email + ". Xem cả mục Thư rác. Đăng ký bằng Google thì không cần mật khẩu: bấm \"Đăng nhập bằng Google\"."); }
      } else if (kind === "tao") {
        if (!/^\S+@\S+\.\S+$/.test(email)) return show("Email chưa đúng dạng (vd ten@gmail.com).");
        if (ten.length < 2) return show("Tên hiển thị dài 2–30 ký tự.");
        if (nameKey(hoten).length < 2) return show("Hãy nhập họ tên đầy đủ của bạn.");
        if (pw.length < 6) return show("Mật khẩu phải có ít nhất 6 ký tự.");
        busy(btn, true); show("Đang kiểm tra…");
        tkCheck(hoten).then(function () {
          lsSet(DK_LS, JSON.stringify({ email: email, ten: ten, hoten: hoten, t: Date.now() }));
          ssSet(DN, "1");
          return fb.auth.createUserWithEmailAndPassword(email, pw);
        }).then(function (cr) {
          tk.msg = "";
          return cr.user.sendEmailVerification(tkActs()).catch(function () { tk.msg = "Chưa gửi được thư xác nhận. Bấm \"Gửi lại thư\"."; if (tk.st === "xac") route(); });
        }).catch(function (x) { ssDel(DN); busy(btn, false); show(err(x)); });
      } else if (kind === "dk") {
        if (ten.length < 2) return show("Tên hiển thị dài 2–30 ký tự.");
        if (nameKey(hoten).length < 2) return show("Hãy nhập họ tên đầy đủ của bạn.");
        busy(btn, true); show("Đang kiểm tra…");
        tkClaim(u, ten, hoten).then(function () { tk.msg = ""; }, function (x) { busy(btn, false); show(err(x)); });
      }
    };
    if (st === "xac" && u) {
      var check = function (manual) {
        var cu = fb.auth.currentUser; if (!cu || cu !== u) return;
        cu.reload().then(function () {
          if (fb.auth.currentUser === u && u.emailVerified && tk.st === "xac") { tk.msg = ""; tkStart(u, tk.dn); }
          else if (manual) show("Chưa thấy xác nhận. Hãy bấm đường link trong thư rồi thử lại.");
        }, function (x) { if (manual) show(tkErr(x)); });
      };
      $("[data-xn]", v).onclick = function () { check(true); };
      var gl = $("[data-gl]", v);
      gl.onclick = function () {
        if (Date.now() - (tk.sent || 0) < 60000) return show("Vừa gửi xong. Chờ 1 phút rồi gửi lại.");
        gl.disabled = true;
        u.sendEmailVerification(tkActs()).then(function () { tk.sent = Date.now(); gl.disabled = false; show("Đã gửi lại thư xác nhận tới " + u.email + "."); }, function (x) { gl.disabled = false; show(tkErr(x)); });
      };
      var doi = $("[data-doi]", v); if (doi) doi.onclick = function (e) {
        e.preventDefault(); tk.view = "tao"; tk.msg = "";
        u.delete().catch(function () { return fb.auth.signOut(); });
      };
      var iv = setInterval(function () { if (document.visibilityState === "visible") check(false); }, 5000);
      var vis = function () { if (document.visibilityState === "visible") check(false); };
      document.addEventListener("visibilitychange", vis);
      cleanup = function () { clearInterval(iv); document.removeEventListener("visibilitychange", vis); };
    }
    var first = $("form.tkf input:not([value]), form.tkf input[value='']", v);
    if (first && matchMedia("(pointer: fine)").matches) try { first.focus({ preventScroll: true }); } catch (e) { }
    return cleanup;
  }

  // thẻ Tài khoản trong Cài đặt (người học): tên hiển thị, email, họ tên, đổi mật khẩu
  function tkCard(el) {
    if (!el || !fb.user) return;
    var u = fb.user, p = tk.prof || tkCache() || {}, adm = isAdmin();
    var pw = u.providerData.some(function (x) { return x.providerId === "password"; });
    el.innerHTML = '<h2>Tài khoản</h2>' + (adm ? '<p class="sub">Tài khoản quản trị viên (mã 000).</p>' : "") +
      (u.email ? '<p>Email: <b>' + esc(u.email) + '</b></p>' : "") + (p.hoten ? '<p>Họ tên đầy đủ: <b>' + esc(p.hoten) + '</b> <span class="sub">(chỉ bạn và quản trị viên thấy)</span></p>' : "") +
      (adm ? "" : '<div class="row" style="align-items:end"><div class="field" style="flex:1 1 200px"><label for="tkten">Tên hiển thị (người khác thấy)</label><input id="tkten" type="text" maxlength="30" value="' + esc(p.ten || "") + '"></div><button class="btn" type="button" id="tktenok">Lưu tên</button></div>') +
      (pw ? '<div class="row" style="margin-top:8px"><button class="btn" type="button" id="tkpwr">Đổi mật khẩu (gửi link qua email)</button></div>' : "") +
      (adm ? "" : '<p class="sub">Quản trị viên xem được thống kê học của bạn.</p>');
    var b = $("#tktenok", el); if (b) b.onclick = function () {
      var t = nameNorm($("#tkten", el).value);
      if (t.length < 2 || t.length > 30) return toast("Tên hiển thị dài 2–30 ký tự");
      b.disabled = true;
      fb.db.collection("hanco_users").doc(u.uid).update({ ten: t, upd: Date.now() }).then(function () { b.disabled = false; toast("Đã đổi tên hiển thị"); if (tk.prof) tk.prof.ten = t; meoRename(); }, function (e) { b.disabled = false; toast(tkErr(e)); });
    };
    var r = $("#tkpwr", el); if (r) r.onclick = function () {
      r.disabled = true;
      fb.auth.sendPasswordResetEmail(u.email, tkActs()).then(function () { toast("Đã gửi link đổi mật khẩu tới " + u.email); }, function (e) { r.disabled = false; toast(tkErr(e)); });
    };
    if (adm) { var vb = document.createElement("div"); vb.id = "vaibox"; el.appendChild(vb); vaiCard(vb); qtPwCard(el, pw); }
  }
  // quản trị: khung "Hai vai của tôi" (tên + ảnh từng vai, chọn hiện vai nào ở từng chỗ, ẩn khỏi bảng xếp hạng) — người dùng yêu cầu 27/11/2026
  function vaiCard(box) {
    if (!box || !isAdmin()) return;
    if (!VAI.ld) {
      box.innerHTML = '<h3 class="vaih">Hai vai của tôi</h3><p class="sub">Đang tải cài đặt vai…</p>';
      vaiLoad().then(function (c) { if (!box.isConnected) return; if (c) vaiCard(box); else box.innerHTML = '<h3 class="vaih">Hai vai của tôi</h3><p class="tkmsg">Chưa tải được cài đặt vai. Kiểm tra mạng rồi mở lại Cài đặt.</p>'; });
      return;
    }
    var c = vaiGet(), u = fb.user, hasHv = !!(c.th && c.hv);
    function one(w, lab, id, ten, note) {
      return '<div class="vaic"><div class="row vaihd">' + (id ? avHTML(id, ten, avVer(id), "lg", true) : '<span class="av lg" aria-hidden="true">?</span>') + '<div class="vait"><b>' + lab + "</b><small class=\"muted\">" + note + "</small></div></div>" +
        '<div class="field"><label for="vai-' + w + '">Tên ' + lab.toLowerCase() + "</label><input id=\"vai-" + w + '" type="text" maxlength="30" value="' + esc(ten || "") + '" placeholder="' + (w === "th" ? "vd Minh An" : "Quản trị viên") + '"></div>' +
        '<div class="row"><button class="btn sm" type="button" data-vten="' + w + '">Lưu tên</button>' + (id ? '<button class="btn sm ghost" type="button" data-vanh="' + esc(id) + '">' + (avVer(id) > 0 ? "Đổi ảnh" : "Tải ảnh lên") + "</button>" : '<span class="muted nsm">Đặt tên trước, rồi mới tải ảnh được.</span>') + "</div></div>";
    }
    function opt(name, val, lab, on, dis) { return '<label class="vaio' + (dis ? " dis" : "") + '"><input type="radio" name="' + name + '" value="' + val + '"' + (on ? " checked" : "") + (dis ? " disabled" : "") + "> " + lab + "</label>"; }
    box.innerHTML = '<h3 class="vaih">Hai vai của tôi</h3><p class="sub">Người khác thấy bạn bằng vai bạn chọn ở từng chỗ. <b>Mọi số liệu là một</b> (XP, cấp, chuỗi ngày, huy hiệu, cúp đều từ cùng một tiến độ học) — đổi vai chỉ đổi tên và ảnh. Vai người học có mã riêng, không ai biết đó là bạn.</p>' +
      '<div class="vai2">' + one("tq", "Vai quản trị", u.uid, c.tq, "người khác thấy bạn là quản trị viên") + one("th", "Vai người học", c.hv, c.th, hasHv ? "trông như một học viên bình thường" : "chưa đặt tên") + "</div>" +
      '<div class="vaich"><div class="vaiq"><b>Bảng xếp hạng + cúp tuần</b><div class="vaios">' + opt("vbx", "qt", "Vai quản trị", c.bx === "qt") + opt("vbx", "hv", "Vai người học", c.bx === "hv", !hasHv) + opt("vbx", "an", "Ẩn (không ai thấy tôi)", c.bx === "an") + "</div></div>" +
      '<div class="vaiq"><b>Cách nhớ chung</b><div class="vaios">' + opt("vme", "qt", "Vai quản trị", c.me === "qt") + opt("vme", "hv", "Vai người học", c.me === "hv", !hasHv) + "</div></div></div>" +
      '<p class="sub vaimsg" role="status" aria-live="polite"></p>';
    avFill(box);
    var msg = $(".vaimsg", box);
    function lock(on) { $$("button, input", box).forEach(function (x) { if (on) { x.__d = x.disabled; x.disabled = true; } else x.disabled = !!x.__d; }); }
    function done(t) { toast(t); vaiCard(box); renderStats(); }
    function bad(e) { var t = e && e.message && !e.code ? e.message : "Chưa lưu được (" + tkErr(e) + ")"; vaiCard(box); var mm = $(".vaimsg", box); if (mm) mm.textContent = t; toast(t); }
    $$("[data-vten]", box).forEach(function (b) { b.onclick = function () {
      var w = b.getAttribute("data-vten"), t = $("#vai-" + w, box).value;
      lock(true); msg.textContent = "Đang lưu tên…";
      vaiSetName(w, t).then(function (n) { done("Đã đổi tên " + (w === "tq" ? "vai quản trị" : "vai người học") + ": " + n); }, bad);
    }; });
    $$("[data-vanh]", box).forEach(function (b) { b.onclick = function () { avPick(b.getAttribute("data-vanh")); }; });
    $$('input[name="vbx"]', box).forEach(function (r) { r.onchange = function () {
      var m = r.value; lock(true); msg.textContent = "Đang đổi vai trên bảng xếp hạng…";
      vaiSetBx(m).then(function () { done(m === "an" ? "Đã ẩn bạn khỏi bảng xếp hạng" : "Bảng xếp hạng giờ hiện " + (m === "hv" ? "vai người học" : "vai quản trị")); }, bad);
    }; });
    $$('input[name="vme"]', box).forEach(function (r) { r.onchange = function () {
      var m = r.value; lock(true); msg.textContent = "Đang chuyển cách nhớ của bạn sang vai mới…";
      vaiSetMe(m).then(function (n) { done("Cách nhớ chung giờ hiện " + (m === "hv" ? "vai người học" : "vai quản trị") + (n ? " (đã chuyển " + n + " cách nhớ, giữ nguyên số sao)" : "")); }, bad);
    }; });
  }
  // quản trị: đổi mật khẩu ngay trong app (tài khoản email + mật khẩu: gõ mật khẩu hiện tại → mật khẩu mới); tài khoản Google: mật khẩu do Google quản lý
  function qtPwCard(el, pw) {
    var b = document.createElement("div"); b.className = "vaipw"; el.appendChild(b);
    var g = fb.user.providerData.some(function (x) { return x.providerId === "google.com"; });
    var eye = '<button type="button" class="btn sm ghost tkeye" aria-label="Hiện mật khẩu">Hiện</button>';
    b.innerHTML = '<h3 class="vaih">Mật khẩu</h3>' +
      (pw ? '<form class="tkf vaipwf" novalidate><div class="field"><label for="pw0">Mật khẩu hiện tại</label><div class="tkpw"><input id="pw0" type="password" autocomplete="current-password" required>' + eye + "</div></div>" +
        '<div class="field"><label for="pw1">Mật khẩu mới (ít nhất 6 ký tự)</label><div class="tkpw"><input id="pw1" type="password" autocomplete="new-password" minlength="6" required>' + eye + "</div></div>" +
        '<div class="field"><label for="pw2">Gõ lại mật khẩu mới</label><div class="tkpw"><input id="pw2" type="password" autocomplete="new-password" minlength="6" required>' + eye + "</div></div>" +
        '<div class="row"><button class="btn" type="submit">Đổi mật khẩu</button><span class="sub vaipwm" role="status" aria-live="polite"></span></div></form>' : "") +
      (g ? '<p class="sub">' + (pw ? "Bạn cũng đăng nhập được bằng Google: mật khẩu Google" : "Bạn đăng nhập bằng Google: mật khẩu") + ' do Google quản lý, đổi ở <a href="https://myaccount.google.com/security" target="_blank" rel="noopener">trang bảo mật tài khoản Google</a>.</p>' : "") +
      (!pw && !g ? '<p class="sub">Tài khoản này không đăng nhập bằng mật khẩu.</p>' : "");
    $$(".tkeye", b).forEach(function (x) { x.onclick = function () { var i = x.parentNode.querySelector("input"); i.type = i.type === "password" ? "text" : "password"; x.textContent = i.type === "password" ? "Hiện" : "Ẩn"; }; });
    var f = $(".vaipwf", b); if (!f) return;
    f.onsubmit = function (e) {
      e.preventDefault();
      var m = $(".vaipwm", b), p0 = $("#pw0", b).value, p1 = $("#pw1", b).value, p2 = $("#pw2", b).value, sb = f.querySelector("[type=submit]");
      if (!p0) return (m.textContent = "Gõ mật khẩu hiện tại.");
      if (p1.length < 6) return (m.textContent = "Mật khẩu mới ít nhất 6 ký tự.");
      if (p1 !== p2) return (m.textContent = "Hai lần gõ mật khẩu mới không khớp.");
      if (p1 === p0) return (m.textContent = "Mật khẩu mới phải khác mật khẩu hiện tại.");
      var u = fb.user; sb.disabled = true; m.textContent = "Đang đổi…";
      u.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(u.email, p0)).then(function () { return u.updatePassword(p1); }).then(function () {
        f.reset(); sb.disabled = false; m.textContent = "Đã đổi mật khẩu."; toast("Đã đổi mật khẩu");
      }, function (x) {
        sb.disabled = false;
        m.textContent = x && (x.code === "auth/wrong-password" || x.code === "auth/invalid-credential" || x.code === "auth/invalid-login-credentials") ? "Mật khẩu hiện tại không đúng." : x && x.code === "auth/weak-password" ? "Mật khẩu mới yếu quá." : tkErr(x);
      });
    };
  }

  // Danh sách họ tên thật (tab Quản trị → Họ tên): mỗi dòng 1 họ tên (dán từ Excel được: bỏ cột STT / số thứ tự đầu dòng).
  // Xem trước đúng từng tên sẽ lưu rồi mới ghi.
  function qtParse(text) {
    var out = [], seen = {}, dup = [], bad = [];
    String(text || "").split(/\r?\n/).forEach(function (line) {
      if (!line.trim()) return;
      var cells = line.split("\t").map(function (c) { return c.trim(); }).filter(function (c) { return /[A-Za-zÀ-ɏḀ-ỿ]/.test(c) && !/^\d+$/.test(c); });
      var s = nameNorm((cells[0] || "").replace(/^\s*\d+\s*[\.\)\-:]?\s+/, ""));
      if (!s) { bad.push(line.trim()); return; }
      if (/\d/.test(s) || s.length < 3 || s.indexOf(" ") < 0 || nameKey(s).length > 200) { bad.push(line.trim()); return; }
      var k = nameKey(s);
      if (seen[k]) { dup.push(s); return; }
      seen[k] = 1; out.push({ k: k, ten: s });
    });
    return { list: out, dup: dup, bad: bad };
  }
  HC.qtParse = qtParse;

  // ---------- CẤU HÌNH CHUNG do quản trị đặt (Bước 4, 26/11/2026) ----------
  // hanco_cfg/chung = {tb: {h thông báo (chữ thường), t ms đăng}, thi: {mã kỳ: ngày thi (số ngày)}, tx: {bat, n, k, mien: [uid]}}.
  // Người học đọc khi vào app + tối đa 1 lần/giờ (localStorage CH_LS = {t, u, d}); "Ẩn" thông báo = localStorage TB_AN (t của bản đã ẩn);
  // "Bỏ qua" ngày thi chung = localStorage THI_AN {mã kỳ: ngày}. Không thuộc S. Ngày thi chung KHÔNG tự đổi lộ trình: người học bấm
  // "Áp dụng" mới ghi S.plans (như khung Chọn kỳ học); khung Chọn kỳ học lấy sẵn ngày này làm ngày thi mặc định.
  var CH_LS = "hanco-chung", TB_AN = "hanco-tb-an", THI_AN = "hanco-thi-an", CH_GAP = 3600e3;
  var CHG = (function () { try { var c = JSON.parse(lsGet(CH_LS)); return c && c.d ? c.d : {}; } catch (e) { return {}; } })();
  function chungLoad(force) {
    if (!fb.db || !fb.user || tk.st !== "ok") return;
    var c = null; try { c = JSON.parse(lsGet(CH_LS)); } catch (e) { }
    if (!force && c && c.u === fb.user.uid && Date.now() - (c.t || 0) < CH_GAP) return;
    fb.db.collection("hanco_cfg").doc("chung").get().then(function (s) { chungSet(s.exists ? s.data() : {}); }, function () { });
  }
  function chungSet(d, quiet) {
    var old = JSON.stringify(CHG), oam = JSON.stringify(CHG.amx || []); CHG = d || {};
    if (JSON.stringify(CHG.amx || []) !== oam) setTimeout(function () { try { avmBoot(true); } catch (e) { } }, 0); // ảnh mặc định bị xóa / khôi phục
    lsSet(CH_LS, JSON.stringify({ t: Date.now(), u: fb.user ? fb.user.uid : "", d: CHG }));
    if (!quiet && old !== JSON.stringify(CHG)) softRefresh();
  }
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") chungLoad(); });
  function thiChung(k, t0) { var e = +((CHG.thi || {})[k]) || 0; return e > t0 ? e : 0; }
  function tbHTML(s) { // thông báo: chữ thường, giữ xuống dòng, link http(s) bấm được
    return esc(s).replace(/https?:\/\/[^\s<]+/g, function (u) { return '<a href="' + u + '" target="_blank" rel="noopener">' + u + "</a>"; }).replace(/\n/g, "<br>");
  }
  function jget(k) { try { return JSON.parse(lsGet(k)) || {}; } catch (e) { return {}; } }
  // các kỳ có ngày thi chung mà lộ trình của người học chưa theo (chưa học kỳ đó / ngày thi khác)
  function thiRows(t0) {
    var an = jget(THI_AN), out = [];
    TERMS.forEach(function (T) {
      var k = T.k, e = thiChung(k, t0); if (!e || an[k] === e) return;
      var p = S.plans[k], act = !!(p && !p.x && t0 <= p.e); if (act && p.e === e) return;
      var P = {}; Object.keys(S.plans).forEach(function (j) { var q = S.plans[j]; if (q && !q.x && t0 <= q.e) P[j] = q; });
      P[k] = { s: act ? p.s : t0, e: e, t: 1, x: 0 };
      var pp = buildPlans(P, t0).ps.filter(function (x) { return x.k === k; })[0], pd = pp ? perDay(pp, t0) : null;
      out.push({ k: k, T: T, e: e, act: act, p: p, c: pd ? pd.c.per : 0, w: pd ? pd.w.per : 0 });
    });
    return out;
  }
  function chungCards(t0) {
    var h = "", tb = CHG.tb;
    if (tb && tb.h && lsGet(TB_AN) !== String(tb.t)) h += '<div class="card tbc" role="status"><div class="row"><h2 style="margin:0">Thông báo</h2><span class="spacer"></span><button class="btn sm ghost" type="button" data-tban="' + esc(tb.t) + '">Ẩn</button></div><p class="tbh">' + tbHTML(tb.h) + "</p></div>";
    var rows = thiRows(t0);
    if (rows.length) h += '<div class="card tbc"><h2>Ngày thi chung</h2>' + rows.map(function (r) {
      return '<div class="thir"><p><b>' + esc(r.T.name) + "</b> thi ngày <b>" + dateY(r.e) + "</b> (quản trị viên đặt). Lộ trình của bạn: " + (r.act ? "thi ngày " + dateY(r.p.e) : "chưa học kỳ này") + ". Áp dụng thì mỗi ngày học khoảng " + r.c + " chữ + " + r.w + " từ." +
        (r.c > 20 ? ' <span class="chip warn">Khá nặng: hơn 20 chữ/ngày</span>' : "") + '</p><div class="row"><button class="btn primary sm" type="button" data-thiok="' + r.k + '">Áp dụng ngày thi này</button><button class="btn sm ghost" type="button" data-thian="' + r.k + '">Bỏ qua</button></div></div>';
    }).join("") + "</div>";
    return h;
  }
  function chungBind(v) {
    $$("[data-tban]", v).forEach(function (b) { b.onclick = function () { lsSet(TB_AN, b.getAttribute("data-tban")); route(); }; });
    $$("[data-thian]", v).forEach(function (b) { b.onclick = function () { var k = b.getAttribute("data-thian"), an = jget(THI_AN); an[k] = thiChung(k, today()); lsSet(THI_AN, JSON.stringify(an)); route(); }; });
    $$("[data-thiok]", v).forEach(function (b) {
      b.onclick = function () {
        var k = b.getAttribute("data-thiok"), t0 = today(), e = thiChung(k, t0), p = S.plans[k], act = !!(p && !p.x && t0 <= p.e); if (!e) return;
        S.plans[k] = { s: act ? p.s : t0, e: e, t: Date.now(), x: 0 }; save();
        toast("Đã đổi ngày thi " + (TERM[k] ? TERM[k].short : k) + ", app đã xếp lại lịch học"); route();
      };
    });
  }

  // ---------- NGƯỜI HỌC MỚI: bắt buộc chọn lộ trình (người dùng yêu cầu 26/11/2026) ----------
  // Tài khoản vào app mà CHƯA có lộ trình nào (S.plans trống) → hộp thoại "Chọn lộ trình học" không đóng được, tới khi chọn ít nhất
  // 1 kỳ + ngày thi. Chỉ hỏi sau khi đã nhận bản tiến độ từ tài khoản (fb.remOk: máy thứ 2 của người đã chọn không bị hỏi nhầm).
  // Quản trị viên không bị hỏi. Chỉ ghi S.plans như khung Chọn kỳ học.
  function needPlan() { return TK_GATE && tk.st === "ok" && !!fb.user && !isAdmin() && !!fb.ref && fb.remOk && TERMS.length > 0 && !Object.keys(S.plans || {}).length; }
  var gateBox = null;
  function planGate() {
    var open = !!(gateBox && document.body.contains(gateBox));
    if (!needPlan()) { if (open) layer.innerHTML = ""; gateBox = null; return; }
    if (open) return;
    var names = TERMS.map(function (T) { return T.name; }).join(", ");
    layer.innerHTML = '<div class="modal kygate" role="dialog" aria-modal="true" aria-labelledby="kyg-h"><div class="box">' +
      '<h1 id="kyg-h" style="margin-top:0">Chọn lộ trình học</h1><p>Chào mừng bạn! Trước khi học, hãy cho app biết bạn ôn thi kỳ nào và ngày thi, để app tự chia bài mỗi ngày cho vừa kịp.</p><ol class="kyg">' +
      "<li><b>Chọn kỳ</b> (đánh dấu ô): " + esc(names) + ". Mỗi kỳ gồm các chữ, từ, loại từ và câu có trong đề cương / đề thi của kỳ đó. Học nhiều kỳ cùng lúc được.</li>" +
      "<li><b>Chọn ngày thi</b> của từng kỳ (hoặc bấm 4 / 6 / 8 / 10 tuần). Ngày thi càng gần thì mỗi ngày học càng nhiều: dòng chữ dưới mỗi kỳ cho biết mỗi ngày bao nhiêu chữ, bao nhiêu từ.</li>" +
      "<li><b>App tự xếp lịch:</b> chữ + từ học từ ngày đầu (chữ, từ hay gặp học trước); loại từ từ 1/5 chặng; câu từ nửa chặng; cứ 7 ngày có 1 ngày chỉ ôn; những ngày cuối chỉ ôn + thi thử. Mỗi ngày mở mục <b>Hôm nay</b>, làm hết \"Việc hôm nay\" là kịp.</li>" +
      "<li>Chữ, từ trùng giữa các kỳ chỉ học 1 lần, ở kỳ thi sớm hơn.</li></ol>" +
      '<p class="sub">Đổi kỳ hoặc ngày thi lúc nào cũng được ở mục <b>Tiến độ &amp; cài đặt → Chọn kỳ học</b>; chữ đã học vẫn giữ nguyên.</p><div id="kygpick"></div></div></div>';
    gateBox = layer.firstChild;
    planPick($("#kygpick", gateBox), function () {
      if (needPlan()) return;
      gateBox = null; layer.innerHTML = ""; toast("Đã xếp lộ trình. Bắt đầu học thôi!"); route();
    }, { gate: true });
  }

  // ---------- BẢN THỐNG KÊ TÓM TẮT (Bước 4) ----------
  // Mỗi người học gửi lên hanco_users/{uid}.tk TỐI ĐA 1 lần/giờ, chỉ khi có thay đổi (thêm 1 lần khi "ngày học cuối" đổi, để quản trị
  // thấy đúng lần học cuối). Chỉ số liệu, KHÔNG có ghi chú. Quản trị tính lại bằng chính sumOf() từ tiến độ đọc được (màn chi tiết).
  // tk = {v, t ms, d ngày tính, last ngày học cuối (có lượt học/ôn), sc chuỗi ngày, sd ngày cuối của chuỗi, xp, xw XP tuần (từ thứ Hai),
  // la/lx 30 ngày gần nhất (lượt học+ôn / XP, cũ → mới), n {c,w,r,s,lt} đã học, due thẻ quá hạn, ky [{k, s, e, p %, ch chậm, nh nhanh}],
  // ex {điểm thi thử cao nhất}, hq [10 id chữ hay quên], sz độ dài tiến độ (ký tự)}. localStorage TKS_LS = lần gửi gần nhất.
  var TKS_LS = "hanco-tk-gui", TK_GAP = 3600e3;
  function weekStart(d) { return d - (d + 3) % 7; } // thứ Hai của tuần chứa ngày d (ngày 0 = thứ Năm 1/1/1970)
  function dayOfMs(ms) { var d = new Date(ms); return Math.floor((ms - d.getTimezoneOffset() * 60000) / 864e5); }
  function withS(o, fn) { var keep = S; S = o; try { return fn(); } finally { S = keep; } } // tính số liệu trên tiến độ của người khác
  function sumOf(s) {
    return withS(s, function () {
      var t0 = today(), last = 0, la = [], lx = [], xw = 0, ws = weekStart(t0), d;
      Object.keys(S.log).forEach(function (k) { var dd = +k, l = S.log[k] || {}; if ((+l.n || 0) + (+l.r || 0) > 0 && dd > last && dd <= t0) last = dd; if (dd >= ws && dd <= t0) xw += +l.x || 0; });
      for (d = t0 - 29; d <= t0; d++) { var l = S.log[d] || {}; la.push((+l.n || 0) + (+l.r || 0)); lx.push(+l.x || 0); }
      var n = { c: 0, w: 0, r: 0, s: 0, lt: Object.keys(S.lt).length };
      Object.keys(S.it).forEach(function (id) { var it = ITEM[id]; if (it && n[it.type] != null) n[it.type]++; });
      var ky = buildPlans(S.plans, t0).ps.map(function (p) {
        var dd = t0 - p.s, g = 0, tot = 0, tg = 0;
        PTY.forEach(function (t) { g += pgot(p, t); tot += p.Q[t].length; tg += dd < 0 ? 0 : ptarget(p, t, dd); });
        return { k: p.k, s: p.s, e: p.e, p: tot ? Math.round(100 * g / tot) : 100, ch: Math.max(0, tg - g), nh: Math.max(0, g - tg) };
      });
      var ex = {}; Object.keys(S.best || {}).forEach(function (k) { if (k.indexOf("exam") === 0 && typeof S.best[k] === "number") ex[k] = S.best[k]; });
      return {
        v: 1, t: Date.now(), d: t0, last: last, sc: S.streak.d >= t0 - 1 ? S.streak.c : 0, sd: S.streak.d || 0, xp: S.xp || 0, xw: xw,
        la: la, lx: lx, n: n, due: due("r").length + due("w").length, ky: ky, ex: ex,
        hq: HC.hard().slice(0, 10).map(function (it) { return it.id; }), sz: JSON.stringify(S).length
      };
    });
  }
  HC.sumOf = sumOf;
  // bộ đếm hạn mức (Bước 5): gửi kèm tk.q {mã máy: số đếm} (giữ dòng của máy khác cùng tài khoản, bỏ máy im > 40 ngày, tối đa 6 máy)
  // + tk.nb số bản sao lưu. Chỉ số đếm thay đổi thì KHÔNG tự gửi, trừ khi đã quá 1 giờ VÀ dùng nhiều (≥ 20 lượt / ≥ 1 MB) kể từ lần gửi
  // trước — chính lần gửi bản thống kê (1 ghi) không đủ để gửi lại → không có vòng gửi mãi khi để app mở.
  function demBusy(g) {
    var e = demOut(), ops = e.m.r + e.m.w + e.m.x, by = e.m.b + e.m.h;
    var big = g.qmo !== e.mo ? ops + by > 0 : ops - (+g.qo || 0) >= 20 || by - (+g.qb || 0) >= 1048576;
    return { e: e, big: big, ops: ops, by: by };
  }
  function demQ(prev, e) {
    var id = demGet().id, q = {}, now = Date.now(), ks;
    Object.keys(prev || {}).forEach(function (k) { var x = prev[k]; if (k !== id && x && +x.t > now - 40 * 864e5) q[k] = x; });
    q[id] = e;
    ks = Object.keys(q).sort(function (a, b) { return (+q[b].t || 0) - (+q[a].t || 0); });
    ks.slice(6).forEach(function (k) { delete q[k]; });
    return q;
  }
  function tkSend() {
    if (!TK_GATE || !fb.user || tk.st !== "ok" || !fb.ref || !fb.remOk || tk.sending) return;
    var u = fb.user;
    if (!isAdmin() && !tk.prof) return;
    tk.sending = true;
    demPull().then(function () {
      if (fb.user !== u) return;
      if (isAdmin()) return demQtSend(u);
      var g = jget(TKS_LS); if (g.u !== u.uid) g = {};
      var s; try { s = sumOf(S); } catch (e) { return; }
      var sig = JSON.stringify(s, function (k, v) { return k === "t" ? undefined : v; });
      var bz = demBusy(g), late = Date.now() - (g.t || 0) >= TK_GAP;
      if (sig === g.h) { if (!late || !bz.big) return; } // không có gì mới (số đếm hạn mức: xem trên)
      else if (!late && s.last === g.l) return; // ≤ 1 lần/giờ (trừ khi ngày học cuối vừa đổi)
      var pt = (tk.prof && tk.prof.tk) || {}, nb = (demGet().nb || {})[u.uid];
      s.q = demQ(pt.q, bz.e);
      if (nb >= 0) s.nb = nb; else if (pt.nb >= 0) s.nb = pt.nb;
      return fb.db.collection("hanco_users").doc(u.uid).update({ tk: s, upd: Date.now() }).then(function () {
        lsSet(TKS_LS, JSON.stringify({ u: u.uid, t: Date.now(), h: sig, l: s.last, qmo: bz.e.mo, qo: bz.ops, qb: bz.by }));
      }, function () { });
    }).then(function () { tk.sending = false; }, function () { tk.sending = false; });
  }
  // máy quản trị không gửi bản thống kê → ghi số đếm vào hanco_qt/dem {q: {mã máy: số đếm}} (cùng nhịp ≤ 1 lần/giờ khi dùng nhiều)
  var DEM_QT = "hanco-dem-qt";
  function demQtSend(u) {
    var g = jget(DEM_QT), bz = demBusy(g);
    if (Date.now() - (+g.t || 0) < TK_GAP || !bz.big) return;
    var q = {}; q[demGet().id] = bz.e;
    return qtRef("hanco_qt", "dem").set({ q: q }, { merge: true }).then(function () {
      lsSet(DEM_QT, JSON.stringify({ t: Date.now(), qmo: bz.e.mo, qo: bz.ops, qb: bz.by }));
    }, function () { });
  }
  HC.tkSend = tkSend;

  // ---------- TAB QUẢN TRỊ (Bước 4) — chỉ tài khoản quản trị (ADMIN_UID) thấy ----------
  // Đọc khi mở tab (đệm 2 phút, nút "Tải lại"): hanco_users (hồ sơ + bản tóm tắt tk), hanco_cfg/dk + chung, và tài liệu chỉ quản trị
  // hanco_qt/ma {so: {uid: số}, next} = MÃ SỐ tài khoản (000 = quản trị; 001… cấp theo thứ tự đăng ký khi mở tab; KHÔNG dùng lại số),
  // hanco_qt/daxoa {ds: [{uid, ma, hoten, ten, email, tao, xoa, cach "chan"|"lai", ly "tay"|"tu"}]} = lịch sử người bị xóa,
  // hanco_qt/tuxoa {kh: {uid: ngày bị tự khóa}}, hanco_qt/nk-YYYY-MM {e: [{t, a việc, m mã, n họ tên, c chi tiết}]} = nhật ký.
  // Xóa người: "chan" = hồ sơ st "xoa" (giữ họ tên → không đăng ký lại được); "lai" = xóa hồ sơ + trả họ tên (đăng ký lại → số mới).
  // Cả 2: xóa tiến độ + sao lưu (+ sach riêng), trả 1 chỗ (dem − 1), ghi lịch sử. Tự xóa: chạy khi quản trị mở tab (gói Spark).
  // Ghi chú riêng của người học KHÔNG bao giờ hiện (bản tóm tắt không có; màn chi tiết chỉ dùng sumOf).
  var QT = null, QT_NHAC = "hanco-qt-nhac", qtSort = { k: "ma", d: 1 }, qtQ = { q: "", st: "" };
  function pad3(n) { return ("00" + n).slice(-3); }
  function qtMa(uid) { var n = QT && QT.ma && QT.ma.so ? QT.ma.so[uid] : 0; return isMine(uid) && isAdmin() ? "000" : n ? pad3(n) : "—"; }
  function qtRef(c, d) { return fb.db.collection(c).doc(d); }
  function qtFV() { return firebase.firestore.FieldValue; }
  function pad2(n) { return ("0" + n).slice(-2); }
  function hm(ms) { var d = new Date(ms); return d.getDate() + "/" + (d.getMonth() + 1) + "/" + d.getFullYear() + " " + pad2(d.getHours()) + ":" + pad2(d.getMinutes()); }
  function qtLog(a, u, c) {
    var d = new Date(), id = "nk-" + d.getFullYear() + "-" + pad2(d.getMonth() + 1);
    var e = { t: Date.now(), a: a, m: u ? qtMa(u.uid) : "", n: u ? (u.hoten || u.ten || "") : "", c: c || "" };
    return qtRef("hanco_qt", id).set({ e: qtFV().arrayUnion(e) }, { merge: true }).catch(function () { });
  }
  function qtLoad() {
    var db = fb.db;
    return Promise.all([
      db.collection("hanco_users").get(), qtRef("hanco_qt", "ma").get(), qtRef("hanco_qt", "daxoa").get(), qtRef("hanco_qt", "tuxoa").get(),
      qtRef("hanco_cfg", "dk").get(), qtRef("hanco_cfg", "chung").get(),
      // hạn mức (Bước 5): số đếm các máy quản trị, độ dài hình sách đã đưa lên, dung lượng bản Hosting (release.py ghi), byte sw.js đã đếm
      qtRef("hanco_qt", "dem").get().catch(function () { return null; }),
      fb.ref ? fb.ref.collection("sach").doc("info").get().catch(function () { return null; }) : null,
      fetch("dung-luong.json", { cache: "no-store" }).then(function (x) { return x.ok ? x.json() : null; }).catch(function () { return null; }),
      demPull(),
      qtRef("hanco_sach", "info").get().catch(function () { return null; }) // kho hình sách chung (Bước 6)
    ]).then(function (r) {
      var users = r[0].docs.filter(function (d) { return d.id !== ADMIN_UID; }).map(function (d) {
        var x = d.data(); x.uid = d.id; x.taoMs = x.tao && x.tao.toMillis ? x.tao.toMillis() : (+x.upd || 0); return x;
      });
      QT = {
        t: Date.now(), users: users, ma: r[1].exists ? r[1].data() : { so: {}, next: 1 }, dx: r[2].exists ? (r[2].data().ds || []) : [],
        kh: r[3].exists ? (r[3].data().kh || {}) : {}, dk: r[4].exists ? r[4].data() : { tran: 120, dem: 0, mo: true }, ch: r[5].exists ? r[5].data() : {}, msg: "",
        dem: r[6] && r[6].exists ? r[6].data() : {}, sach: r[7] && r[7].exists ? r[7].data() : {}, sachPub: r[10] && r[10].exists ? r[10].data() : {}, host: r[8] && +r[8].b > 0 ? r[8] : null,
        real: QT && QT.real, realMsg: QT && QT.realMsg
      };
      if (!QT.ma.so) QT.ma.so = {};
      chungSet(QT.ch, true);
      return qtNumber();
    }).then(qtAuto);
  }
  // cấp mã số cho người chưa có (không tính người đã bị xóa), theo thứ tự đăng ký
  function qtNumber() {
    var need = QT.users.filter(function (u) { return u.st !== "xoa" && !QT.ma.so[u.uid]; }).sort(function (a, b) { return a.taoMs - b.taoMs; });
    if (!need.length) return;
    var ref = qtRef("hanco_qt", "ma");
    return fb.db.runTransaction(function (tx) {
      return tx.get(ref).then(function (s) {
        var m = s.exists ? s.data() : {}; m.so = m.so || {}; m.next = +m.next || 1;
        need.forEach(function (u) { if (!m.so[u.uid]) m.so[u.uid] = m.next++; });
        tx.set(ref, m); return m;
      });
    }).then(function (m) {
      QT.ma = m;
      need.forEach(function (u) { qtLog("Cấp mã số", u, (u.email || "") + " · đăng ký " + (u.taoMs ? hm(u.taoMs) : "?")); });
    });
  }
  function qtLast(u) { var t = u.tk || {}; return t.last || (u.taoMs ? dayOfMs(u.taoMs) : today()); }
  // khóa / mở khóa (auto = tự khóa vì không học → nhớ ngày khóa để tự xóa sau k ngày; mở khóa tay → bỏ khỏi danh sách tự xóa)
  function qtSetSt(u, st, auto, why) {
    var b = fb.db.batch(), t0 = today(), kh = {};
    kh[u.uid] = auto ? t0 : qtFV().delete();
    b.update(qtRef("hanco_users", u.uid), { st: st, upd: Date.now() });
    b.set(qtRef("hanco_qt", "tuxoa"), { kh: kh }, { merge: true });
    return b.commit().then(function () {
      u.st = st; if (auto) QT.kh[u.uid] = t0; else delete QT.kh[u.uid];
      qtLog(auto ? "Tự khóa" : st === "khoa" ? "Khóa" : "Mở khóa", u, why);
      return bxhLock(u.uid, st); // khóa → ẩn khỏi bảng xếp hạng; mở khóa → hiện lại (trừ khi quản trị ẩn tay)
    });
  }
  function qtWipe(uid) { // xóa tiến độ + sao lưu + hình sách riêng của 1 người
    var ref = qtRef("hanco_progress", uid);
    function sub(n) { return ref.collection(n).get().then(function (qs) { return Promise.all(qs.docs.map(function (d) { return d.ref.delete(); })); }); }
    return sub("backups").then(function () { return sub("sach").catch(function () { }); }).then(function () { return ref.delete(); });
  }
  function qtDelete(u, cach, ly, why) {
    var FV = qtFV(), b = fb.db.batch(), ma = qtMa(u.uid), o = {}, kh = {};
    var entry = { uid: u.uid, ma: ma, hoten: u.hoten || "", ten: u.ten || "", email: u.email || "", tao: u.taoMs || 0, xoa: Date.now(), cach: cach, ly: ly };
    if (cach === "lai") { b.delete(qtRef("hanco_users", u.uid)); if (u.hk) b.update(qtRef("hanco_ten", u.hk), { uid: null }); }
    else b.update(qtRef("hanco_users", u.uid), { st: "xoa", upd: Date.now() });
    if (u.st !== "xoa") b.set(qtRef("hanco_cfg", "dk"), { dem: FV.increment(-1) }, { merge: true }); // trả 1 chỗ
    o[u.uid] = FV.delete(); kh[u.uid] = FV.delete();
    b.set(qtRef("hanco_qt", "ma"), { so: o }, { merge: true });
    b.set(qtRef("hanco_qt", "tuxoa"), { kh: kh }, { merge: true });
    b.set(qtRef("hanco_qt", "daxoa"), { ds: FV.arrayUnion(entry) }, { merge: true });
    // ghi trạng thái trước (máy người học ngắt đồng bộ ngay), rồi mới xóa tiến độ
    return b.commit().then(function () {
      qtLog(ly === "tu" ? "Tự xóa" : "Xóa", u, (cach === "lai" ? "cho đăng ký lại" : "chặn luôn") + (why ? " · " + why : ""));
      if (u.st !== "xoa") QT.dk.dem = Math.max(0, (+QT.dk.dem || 0) - 1);
      QT.dx.push(entry); delete QT.ma.so[u.uid]; delete QT.kh[u.uid];
      if (cach === "lai") QT.users = QT.users.filter(function (x) { return x !== u; }); else u.st = "xoa";
      bxhDrop(u.uid); // bỏ dòng trên bảng xếp hạng
      avCol().doc(u.uid).delete().catch(function () { }); // ảnh đại diện (27/11/2026)
      meoWipe(u.uid).then(function (n) { if (n) qtLog("Xóa cách nhớ của người bị xóa", u, n + " cách nhớ"); }, function () { }); // Bước 8
      return qtWipe(u.uid).catch(function () { toast("Đã xóa tài khoản nhưng chưa xóa hết tiến độ. Bấm Tải lại rồi thử lại sau."); });
    });
  }
  // tự khóa / tự xóa người không học (chỉ khi bật; quản trị + danh sách miễn không bao giờ bị)
  function qtAuto() {
    var tx = (QT.ch && QT.ch.tx) || {}; if (!tx.bat) return;
    var n = Math.max(7, +tx.n || 30), k = Math.max(1, +tx.k || 7), mien = tx.mien || [], t0 = today(), jobs = [], nk = 0, nx = 0;
    QT.users.slice().forEach(function (u) {
      if (u.st === "xoa" || mien.indexOf(u.uid) >= 0) return;
      var idle = t0 - qtLast(u);
      if (u.st === "ok" && idle >= n) jobs.push(function () { nk++; return qtSetSt(u, "khoa", true, "không học " + idle + " ngày"); });
      else if (u.st === "khoa" && QT.kh[u.uid] != null && t0 - QT.kh[u.uid] >= k) jobs.push(function () { nx++; return qtDelete(u, "lai", "tu", "không học " + idle + " ngày"); });
    });
    return jobs.reduce(function (p, f) { return p.then(f); }, Promise.resolve()).then(function () {
      if (nk || nx) { QT.msg = "Tự xóa vừa chạy: khóa " + nk + " người, xóa " + nx + " người (xem Nhật ký)."; toast(QT.msg); }
    }, function (e) { QT.msg = "Tự xóa chưa chạy xong (" + tkErr(e) + ")."; });
  }
  function qtRow(u) {
    var t = u.tk || {}, t0 = today(), ky = t.ky || [], ld = t.last || 0, ex = t.ex || {}, best = null, ch = 0, nh = 0, p = 0;
    ky.forEach(function (x) { ch += +x.ch || 0; nh += +x.nh || 0; p += +x.p || 0; });
    Object.keys(ex).forEach(function (k) { if (best == null || ex[k] > best) best = ex[k]; });
    return {
      u: u, ma: qtMa(u.uid), last: ld, idle: ld ? t0 - ld : null, sc: t.sd >= t0 - 1 ? (t.sc || 0) : 0,
      xw: t.d != null && weekStart(t.d) === weekStart(t0) ? (t.xw || 0) : 0, xp: t.xp || 0,
      pct: ky.length ? Math.round(p / ky.length) : null, lag: ky.length ? ch - nh : null, due: t.due != null ? t.due : null, ex: best, tk: !!u.tk
    };
  }
  function qtLastTxt(r) { return r.last ? (r.idle <= 0 ? "hôm nay" : r.idle === 1 ? "hôm qua" : r.idle + " ngày trước") : r.tk ? "chưa học" : "chưa có số liệu"; }
  function qtLagTxt(r) { return r.lag == null ? "—" : r.lag > 0 ? '<span class="chip warn">chậm ' + r.lag + " mục</span>" : r.lag < 0 ? '<span class="chip ok">nhanh ' + (-r.lag) + " mục</span>" : "đúng lịch"; }
  function qtStTxt(st) { return st === "khoa" ? '<span class="chip warn">đang khóa</span>' : st === "xoa" ? '<span class="chip k10">đã chặn</span>' : '<span class="chip ok">đang học</span>'; }
  // ---------- DUNG LƯỢNG & HẠN MỨC (Bước 5) — cộng số đếm của mọi máy, so với hạn mức gói Spark. ƯỚC TÍNH ±10–20%. ----------
  // Hạn mức (kiểm tra lại ở trang giá Firebase khi cần): Firestore 50.000 đọc / 20.000 ghi / 20.000 xóa mỗi ngày, lưu 1 GiB, tải ra
  // 10 GiB/tháng; Hosting lưu 10 GB, tải ra 360 MB/ngày. Ngày hạn mức theo giờ Thái Bình Dương (ptDay).
  var QT_LIM = { r: 50000, w: 20000, x: 20000, hd: 360 * 1048576, bm: 10 * 1073741824, fs: 1073741824, hs: 10 * 1073741824 };
  var QT_USAGE = "https://console.firebase.google.com/project/hanco-tuhoc/usage";
  function fmtB(n) {
    n = +n || 0;
    var u = ["B", "KB", "MB", "GB"], i = 0;
    while (n >= 1024 && i < 3) { n /= 1024; i++; }
    return (i ? n.toLocaleString("vi-VN", { maximumFractionDigits: n < 10 ? 1 : 0 }) : Math.round(n)) + " " + u[i];
  }
  function qtUse() {
    var t = ptDay(), mo = ptMon(t), all = {}, me = demGet().id;
    function put(id, e, who) { if (e && typeof e === "object" && (!all[id] || (+e.t || 0) >= (+all[id].e.t || 0))) all[id] = { e: e, who: who }; }
    QT.users.forEach(function (u) { var q = u.tk && u.tk.q; if (q && typeof q === "object") Object.keys(q).forEach(function (id) { put(id, q[id], u); }); });
    var dq = (QT.dem && QT.dem.q) || {};
    Object.keys(dq).forEach(function (id) { put(id, dq[id], null); });
    put(me, demOut(), null); // máy quản trị đang dùng: số mới nhất ở máy
    function add(dst, src) { DEM_K.forEach(function (k) { dst[k] += +src[k] || 0; }); }
    var sum = { d: demZero(), y: demZero(), m: demZero() }, per = {}, nDev = 0;
    Object.keys(all).forEach(function (id) {
      var e = all[id].e, w = all[id].who, key = w ? w.uid : "qt", p = per[key] || (per[key] = { u: w, d: demZero(), y: demZero(), m: demZero(), n: 0 });
      var yy = e.d === t - 1 ? e : e.y && e.y.d === t - 1 ? e.y : null, used = false;
      if (e.d === t) { add(sum.d, e); add(p.d, e); used = true; }
      if (yy) { add(sum.y, yy); add(p.y, yy); used = true; }
      if (e.mo === mo && e.m) { add(sum.m, e.m); add(p.m, e.m); used = true; }
      if (used) { p.n++; nDev++; }
    });
    // dung lượng Firestore: tiến độ × (1 + số bản sao lưu) + hồ sơ (kèm bản thống kê) + hình sách + phần khác, cộng ~15% chỉ mục
    var t0 = today(), prog = 0, prof = 0, sach = 0, other = 50 * 1024;
    QT.users.forEach(function (u) {
      try { prof += JSON.stringify(u).length + 200; } catch (e) { }
      if (u.st === "xoa" || !u.tk || !(u.tk.sz > 0)) return;
      var nb = u.tk.nb >= 0 ? +u.tk.nb : Math.min(14, Math.max(1, t0 - dayOfMs(u.taoMs || Date.now()) + 1));
      prog += u.tk.sz * (1 + nb);
    });
    var nbA = (demGet().nb || {})[fb.user ? fb.user.uid : ""];
    prog += JSON.stringify(S).length * (1 + (nbA >= 0 ? nbA : 14));
    [(QT.sach && QT.sach.sz) || {}, (QT.sachPub && QT.sachPub.sz) || {}].forEach(function (ss) { Object.keys(ss).forEach(function (k) { sach += (+ss[k] || 0) + 200; }); }); // bản riêng cũ + kho chung (Bước 6)
    try { other += JSON.stringify([QT.ma, QT.dx, QT.kh, QT.ch, QT.dk, QT.dem]).length + QT.users.length * 150; } catch (e) { }
    var nAnh = 0; if (BXH.d && BXH.d.u) Object.keys(BXH.d.u).forEach(function (k) { if (+BXH.d.u[k].a > 0) nAnh++; });
    var anh = nAnh * AV_EST; // ảnh đại diện: ~40 KB/người có ảnh (27/11/2026)
    var fs = Math.round((prog + prof + sach + anh + other) * 1.15);
    return { t: t, mo: mo, sum: sum, per: per, nDev: nDev, st: { prog: prog, prof: prof, sach: sach, anh: anh, nAnh: nAnh, other: other, fs: fs }, host: QT.host };
  }
  // số dùng cho thanh: đọc/ghi/xóa lấy SỐ THẬT (Google Cloud) nếu vừa lấy được, còn lại là ước tính
  function qtVal(U, per, k) { var R = QT.real; return R && R[per] && R[per][k] != null ? { v: R[per][k], real: true } : { v: U.sum[per][k], real: false }; }
  function qtPct(v, lim) { return lim ? v / lim * 100 : 0; }
  function qtBar(lbl, v, lim, f, sub) {
    var p = qtPct(v, lim), c = p > 80 ? "bad" : p >= 50 ? "mid" : "ok", w = Math.min(100, p);
    return '<div class="qtbar ' + c + '"><div class="qtbl"><b>' + lbl + "</b><span>" + f(v) + " / " + f(lim) + " · <b>" + (p > 0 && p < 1 ? "&lt;1" : Math.round(p)) + "%</b></span></div>" +
      '<div class="qtbt" role="progressbar" aria-label="' + esc(lbl.replace(/<[^>]+>/g, "")) + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(w) + '"><i style="width:' + w.toFixed(1) + '%"></i></div>' +
      (sub ? "<small>" + sub + "</small>" : "") + "</div>";
  }
  function fmtN(n) { return fmt(Math.round(+n || 0)); }
  function qtDayBars(U, per) {
    var r = qtVal(U, per, "r"), w = qtVal(U, per, "w"), x = qtVal(U, per, "x"), tag = function (o) { return o.real ? ' <span class="chip ok">số thật</span>' : ""; };
    return qtBar("Firestore — đọc" + tag(r), r.v, QT_LIM.r, fmtN) + qtBar("Firestore — ghi" + tag(w), w.v, QT_LIM.w, fmtN) + qtBar("Firestore — xóa" + tag(x), x.v, QT_LIM.x, fmtN) +
      qtBar("Hosting — tải ra", U.sum[per].h, QT_LIM.hd, fmtB) +
      '<p class="sub qtnote">Firestore tải ra: ' + fmtB(U.sum[per].b) + " (hạn mức tính theo tháng, xem dưới).</p>";
  }
  // các thanh đỏ (> 80%) → cảnh báo ở đầu tab Quản trị
  function qtRed(U) {
    var out = [], L = QT_LIM;
    [["d", "hôm nay"], ["y", "hôm qua"]].forEach(function (a) {
      [["r", "đọc"], ["w", "ghi"], ["x", "xóa"]].forEach(function (k) { if (qtPct(qtVal(U, a[0], k[0]).v, L[k[0]]) > 80) out.push("Firestore " + k[1] + " " + a[1]); });
      if (qtPct(U.sum[a[0]].h, L.hd) > 80) out.push("Hosting tải ra " + a[1]);
    });
    if (qtPct(U.sum.m.b, L.bm) > 80) out.push("Firestore tải ra tháng này");
    if (qtPct(U.st.fs, L.fs) > 80) out.push("dung lượng Firestore");
    if (U.host && qtPct(U.host.b, L.hs) > 80) out.push("dung lượng Hosting");
    return out;
  }
  function qtWarn(el) {
    if (!el || !QT) return;
    var red = []; try { red = qtRed(qtUse()); } catch (e) { }
    el.innerHTML = red.length ? '<p class="tkmsg qtred" role="alert">⚠ Sắp chạm hạn mức gói miễn phí (trên 80%): ' + esc(red.join(", ")) +
      '. Vượt hạn mức thì phần đó của Firebase tạm ngừng cho CẢ app. <a href="#qt-han">Xem mục Hạn mức</a> · <a href="' + QT_USAGE + '" target="_blank" rel="noopener">số chính xác</a></p>' : "";
  }
  function qtLinks() {
    return '<div class="row qtlinks"><a class="btn sm" href="' + QT_USAGE + '" target="_blank" rel="noopener">Xem số chính xác (Firebase Usage)</a>' +
      '<a class="btn sm ghost" href="https://console.firebase.google.com/project/hanco-tuhoc/firestore/databases/-default-/usage" target="_blank" rel="noopener">Firestore</a>' +
      '<a class="btn sm ghost" href="https://console.firebase.google.com/project/hanco-tuhoc/hosting/sites/hanco-tuhoc" target="_blank" rel="noopener">Hosting</a></div>';
  }
  // thẻ tóm tắt ở Tổng quan
  function qtHanSum() {
    var U = qtUse();
    return '<div class="card"><h2>Dung lượng &amp; hạn mức <small class="sub">(ước tính)</small></h2><div class="qtbars">' +
      qtDayBars(U, "d").replace(/<p class="sub qtnote">[\s\S]*?<\/p>/, "") +
      qtBar("Firestore — tải ra tháng này", U.sum.m.b, QT_LIM.bm, fmtB) + qtBar("Firestore — dung lượng lưu", U.st.fs, QT_LIM.fs, fmtB) +
      '</div><p class="sub">Hôm nay = từ 15:00 giờ VN (giờ Google đặt lại hạn mức ngày). Số từ ' + U.nDev + ' máy, có thể chậm tới 1 giờ.</p><div class="row"><a class="btn sm" href="#qt-han">Xem chi tiết</a><a class="btn sm ghost" href="' + QT_USAGE + '" target="_blank" rel="noopener">Số chính xác (Firebase)</a></div></div>';
  }
  function qtHan(box, redraw) {
    var U = qtUse(), L = QT_LIM, h = "", R = QT.real, H = U.host;
    h += '<div class="card"><h2>Hạn mức gói miễn phí (Spark) — ƯỚC TÍNH</h2><p class="sub">Mỗi máy tự đếm số lượt đọc / ghi / xóa Firestore và dung lượng tải về, gửi kèm bản thống kê (tối đa 1 lần/giờ) — đang cộng từ <b>' + U.nDev +
      ' máy</b>. Sai số khoảng ±10–20%, số "hôm nay" chậm tới 1 giờ; máy chưa cập nhật app thì chưa đếm. Ngày hạn mức của Google đặt lại lúc <b>15:00 giờ VN</b> (14:00 khi bên Mỹ dùng giờ mùa hè). Vượt hạn mức ngày → phần đó tạm ngừng tới lần đặt lại; vượt hạn mức tháng → ngừng tới hết tháng, cho CẢ app.</p>' +
      qtLinks() + '<div class="row"><button class="btn sm" type="button" id="qtcl">Lấy số thật từ Google Cloud (thử)</button></div>' +
      (QT.realMsg ? '<p class="sub" role="status">' + esc(QT.realMsg) + "</p>" : "") + "</div>";
    if (R) {
      var row = function (lbl, k) { return "<tr><td>" + lbl + "</td>" + ["d", "y", "m"].map(function (p) { return "<td>" + (R[p][k] != null ? fmtN(R[p][k]) : "—") + '<br><small class="sub">ước tính ' + fmtN(U.sum[p][k]) + "</small></td>"; }).join("") + "</tr>"; };
      h += '<div class="card"><h2>Số thật từ Google Cloud</h2><p class="sub">Lấy lúc ' + hm(R.t) + " (Cloud Monitoring, chậm vài phút). Các thanh đọc / ghi / xóa bên dưới đang dùng số này cho tới khi tải lại.</p>" +
        '<div class="qtwrap"><table class="t"><thead><tr><th></th><th>Hôm nay</th><th>Hôm qua</th><th>Tháng này</th></tr></thead><tbody>' + row("Đọc", "r") + row("Ghi", "w") + row("Xóa", "x") + "</tbody></table></div></div>";
    }
    h += '<div class="cols2"><div class="card"><h2>Hôm nay <small class="sub">(tới giờ)</small></h2><div class="qtbars">' + qtDayBars(U, "d") + "</div></div>" +
      '<div class="card"><h2>Hôm qua <small class="sub">(cả ngày)</small></h2><div class="qtbars">' + qtDayBars(U, "y") + "</div></div></div>";
    h += '<div class="card"><h2>Tháng này</h2><div class="qtbars">' + qtBar("Firestore — tải ra", U.sum.m.b, L.bm, fmtB) + "</div>" +
      '<p class="sub qtnote">Cộng cả tháng: ' + fmtN(U.sum.m.r) + " đọc · " + fmtN(U.sum.m.w) + " ghi · " + fmtN(U.sum.m.x) + " xóa · Hosting tải ra " + fmtB(U.sum.m.h) + ".</p></div>";
    var st = U.st;
    h += '<div class="card"><h2>Dung lượng lưu</h2><div class="qtbars">' + qtBar("Firestore", st.fs, L.fs, fmtB) +
      (H && H.b ? qtBar("Hosting (bản đang chạy)", H.b, L.hs, fmtB) : "") + "</div>" +
      '<ul class="qtls"><li>Tiến độ + sao lưu (tối đa 14 bản/người): ' + fmtB(st.prog) + "</li><li>Hồ sơ + bản thống kê: " + fmtB(st.prof) + "</li><li>Hình trang sách (kho chung + bản riêng cũ nếu còn): " + fmtB(st.sach) +
      "</li><li>Ảnh đại diện (" + fmtN(st.nAnh) + " người có ảnh, ~40 KB/ảnh, đếm theo bảng xếp hạng): " + fmtB(st.anh) + "</li><li>Khác (danh sách họ tên, mã số, nhật ký…): " + fmtB(st.other) + "</li><li>Đã cộng thêm ~15% cho chỉ mục của Firestore.</li><li>Cách nhớ chung: chưa có (bước sau).</li></ul>" +
      '<p class="sub qtnote">' + (H && H.b ? "Hosting: bản phát hành lúc " + hm(H.t) + ", " + fmtN(H.n) + " tệp, " + fmtB(H.b) + " (release.py ghi). Firebase giữ cả các bản phát hành cũ và tính vào dung lượng — có thể đặt số bản giữ lại trong console → Hosting (lịch sử bản phát hành)." :
        "Hosting: chưa có số (tệp dung-luong.json do release.py ghi ở lần phát hành tới).") + "</p></div>";
    // ai dùng nhiều nhất (hôm qua + hôm nay)
    var ps = Object.keys(U.per).map(function (k) { var p = U.per[k], o = demZero(); DEM_K.forEach(function (x) { o[x] = p.d[x] + p.y[x]; }); return { p: p, o: o, s: o.r + o.w + o.x }; })
      .filter(function (a) { return a.s + a.o.b + a.o.h > 0; }).sort(function (a, b) { return b.s - a.s || (b.o.b + b.o.h) - (a.o.b + a.o.h); }).slice(0, 10);
    h += '<div class="card"><h2>Dùng nhiều nhất <small class="sub">(hôm qua + hôm nay)</small></h2>' + (ps.length ? '<div class="qtwrap"><table class="t"><thead><tr><th>Mã</th><th>Tên</th><th>Số máy</th><th>Đọc</th><th>Ghi</th><th>Xóa</th><th>Tải Firestore</th><th>Tải Hosting</th></tr></thead><tbody>' +
      ps.map(function (a) { var u = a.p.u; return "<tr><td>" + (u ? qtMa(u.uid) : "000") + "</td><td>" + esc(u ? (u.hoten || u.ten || "") : "Quản trị viên") + "</td><td>" + a.p.n + "</td><td>" + fmtN(a.o.r) + "</td><td>" + fmtN(a.o.w) + "</td><td>" + fmtN(a.o.x) + "</td><td>" + fmtB(a.o.b) + "</td><td>" + fmtB(a.o.h) + "</td></tr>"; }).join("") +
      "</tbody></table></div>" : '<p class="sub">Chưa có số liệu.</p>') + "</div>";
    box.innerHTML = h;
    $("#qtcl", box).onclick = function () { qtCloud(this, redraw); };
  }
  // SỐ THẬT qua Google Cloud Monitoring: đăng nhập Google lại để xin thêm quyền CHỈ ĐỌC số liệu (monitoring.read). Mã truy cập chỉ giữ
  // trong lúc gọi (không lưu). Không hứa chạy được: API Cloud Monitoring có thể chưa bật / tài khoản quản trị không đăng nhập bằng Google.
  function qtCloud(btn, redraw) {
    var u = fb.user; if (!u || !window.firebase || !firebase.auth.GoogleAuthProvider) return;
    var pv = new firebase.auth.GoogleAuthProvider();
    pv.addScope("https://www.googleapis.com/auth/monitoring.read");
    if (u.email) pv.setCustomParameters({ login_hint: u.email });
    btn.disabled = true; btn.textContent = "Đang lấy…";
    function done(msg) { QT.realMsg = msg; redraw(); }
    u.reauthenticateWithPopup(pv).then(function (r) {
      var tok = r && r.credential && r.credential.accessToken;
      if (!tok) throw { code: "no-token" };
      var end = new Date(), start = new Date(end.getTime() - 33 * 864e5);
      var M = { r: "firestore.googleapis.com/document/read_count", w: "firestore.googleapis.com/document/write_count", x: "firestore.googleapis.com/document/delete_count" };
      return Promise.all(Object.keys(M).map(function (k) {
        var url = "https://monitoring.googleapis.com/v3/projects/" + FB_CONFIG.projectId + "/timeSeries?filter=" + encodeURIComponent('metric.type="' + M[k] + '"') +
          "&interval.startTime=" + encodeURIComponent(start.toISOString()) + "&interval.endTime=" + encodeURIComponent(end.toISOString()) +
          "&aggregation.alignmentPeriod=3600s&aggregation.perSeriesAligner=ALIGN_SUM&aggregation.crossSeriesReducer=REDUCE_SUM";
        return fetch(url, { headers: { Authorization: "Bearer " + tok } }).then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (j) { if (!res.ok) throw { code: "api", st: res.status, msg: (j.error && j.error.message) || "" }; return [k, j]; });
        });
      }));
    }).then(function (rs) {
      var t = ptDay(), mo = ptMon(t), R = { t: Date.now(), d: { r: 0, w: 0, x: 0 }, y: { r: 0, w: 0, x: 0 }, m: { r: 0, w: 0, x: 0 } };
      rs.forEach(function (a) {
        (a[1].timeSeries || []).forEach(function (ts) {
          (ts.points || []).forEach(function (p) {
            var v = +((p.value || {}).int64Value || (p.value || {}).doubleValue || 0), d = ptDay(Date.parse(p.interval.endTime) - 1);
            if (d === t) R.d[a[0]] += v; if (d === t - 1) R.y[a[0]] += v; if (ptMon(d) === mo) R.m[a[0]] += v;
          });
        });
      });
      QT.real = R; done("Đã lấy số thật lúc " + hm(R.t) + ".");
    }).catch(function (e) {
      var c = (e && e.code) || "", m = "Chưa lấy được số thật";
      if (c === "auth/popup-blocked") m += ": trình duyệt chặn cửa sổ đăng nhập — cho phép cửa sổ bật lên rồi bấm lại.";
      else if (c === "auth/popup-closed-by-user" || c === "auth/cancelled-popup-request") m += ": bạn đã đóng cửa sổ Google.";
      else if (c === "auth/user-mismatch") m += ": cần chọn đúng tài khoản Google quản trị.";
      else if (c === "auth/no-such-provider" || c === "auth/provider-already-linked") m += ": tài khoản quản trị không đăng nhập bằng Google.";
      else if (c === "no-token") m += ": Google không trả quyền đọc số liệu.";
      else if (c === "api") m += " (Google Cloud báo " + e.st + (e.msg ? ": " + String(e.msg).slice(0, 160) : "") + "). Nếu báo API chưa bật: mở console.cloud.google.com → APIs → bật «Cloud Monitoring API» cho dự án hanco-tuhoc rồi thử lại.";
      else m += " (" + tkErr(e) + ").";
      done(m + " Vẫn xem được số chính xác ở trang Usage của Firebase.");
    });
  }
  function vAdmin(v, args) {
    if (!isAdmin()) { v.innerHTML = '<p class="sub">Chỉ quản trị viên mở được mục này.</p>'; return; }
    var sec = args[0] || "tong", ep = HC.epoch;
    var tabs = [["tong", "Tổng quan"], ["nguoi", "Người học"], ["nhac", "Cần nhắc"], ["ten", "Họ tên"], ["cai", "Cài đặt"], ["sach", "Hình sách"], ["han", "Hạn mức"], ["bxh", "Xếp hạng"], ["anh", "Ảnh mặc định"], ["meo", "Cách nhớ"], ["nk", "Nhật ký"]];
    v.innerHTML = '<div class="row"><h1 style="margin:0">Quản trị</h1><span class="spacer"></span><button class="btn sm ghost" type="button" id="qtre">Tải lại</button></div>' +
      '<nav class="qtnav" aria-label="Các mục quản trị">' + tabs.map(function (a) { return '<a class="btn sm" href="#qt-' + a[0] + '"' + (a[0] === sec ? ' aria-current="page"' : "") + ">" + a[1] + "</a>"; }).join("") + '</nav><div id="qtwarn"></div><div id="qtb"><p class="sub">Đang tải…</p></div>';
    var box = $("#qtb", v);
    function draw() {
      if (HC.epoch !== ep) return;
      try { qtWarn($("#qtwarn", v)); } catch (e) { }
      try { ({ tong: qtTong, nguoi: qtNguoi, nhac: qtNhac, ten: qtTen, cai: qtCai, sach: qtSach, han: qtHan, bxh: qtBxh, anh: qtAnh, meo: qtMeo, nk: qtNk }[sec] || qtTong)(box, draw); } catch (e) { box.innerHTML = '<p class="tkmsg">Lỗi hiển thị: ' + esc(e && e.message) + "</p>"; }
    }
    function load() {
      box.innerHTML = '<p class="sub">Đang tải…</p>';
      qtLoad().then(draw, function (e) { if (HC.epoch === ep) box.innerHTML = '<p class="tkmsg">Chưa tải được (' + esc(tkErr(e)) + "). Kiểm tra mạng rồi bấm Tải lại.</p>"; });
    }
    $("#qtre", v).onclick = load;
    if (!QT || Date.now() - QT.t > 120000) load(); else draw();
  }
  // ---------- QUẢN TRỊ → XẾP HẠNG (Bước 7): ẩn 1 người khỏi bảng, đặt lại XP bất thường, soát XP lạ, chốt lại cúp tuần ----------
  // Ngưỡng "XP lạ" (XP 1 ngày trong 7 ngày gần nhất) nhớ ở localStorage máy quản trị QT_XPLA (mặc định 1.500). Đặt lại = rs[uid] = hôm nay
  // + xóa dòng: máy người đó tự tính lại XP bảng từ hôm nay (XP + cấp thật trong tiến độ KHÔNG đổi). Bỏ đặt lại = xóa rs + xóa dòng.
  var QT_XPLA = "hanco-qt-xpla";
  function qtXpla() { var n = +lsGet(QT_XPLA); return n >= 100 ? n : 1500; }
  function qtBxh(box, redraw) {
    box.innerHTML = '<p class="sub">Đang tải bảng xếp hạng…</p>';
    var k = cupWeek();
    Promise.all([bxhLoad(true), bxhRef("c" + k).get().then(function (s) { return s.exists ? s.data() : null; }).catch(function () { return null; })]).then(function (r) {
      if (cur !== "qt-bxh") return;
      var T = r[0], c = r[1], t0 = today(), lim = qtXpla(), h = "";
      if (!T) { box.innerHTML = '<div class="card"><h2>Bảng xếp hạng</h2><p class="tkmsg">Chưa có tài liệu bảng (hanco_bxh/tong). Tải lại trang để app tạo, hoặc kiểm tra luật Firestore đã deploy chưa.</p></div>'; return; }
      var U = T.u || {}, an = T.an || {}, rs = T.rs || {}, byId = {};
      QT.users.forEach(function (u) { byId[u.uid] = u; });
      var ids = Object.keys(U); Object.keys(an).concat(Object.keys(rs)).forEach(function (id) { if (ids.indexOf(id) < 0) ids.push(id); });
      var rows = ids.map(function (uid) {
        var vc = vaiGet(), x = U[uid] || {}, u = byId[uid] || (uid === ADMIN_UID ? { uid: uid, ten: vc.tq, hoten: "(bạn — vai quản trị)" } : vc.hv && uid === vc.hv ? { uid: uid, ten: vc.th, hoten: "(bạn — vai người học)" } : null);
        return { uid: uid, x: x, u: u, ma: isMine(uid) ? "000" : u ? qtMa(uid) : "—", xw: bxhVal(x, "w", t0), xm: +x.xm || 0, xp: +x.xp || 0, an: an[uid] || 0, rs: rs[uid] || 0, la: (+x.xm || 0) > lim };
      }).sort(function (a, b) { return (b.la ? 1 : 0) - (a.la ? 1 : 0) || b.xw - a.xw || b.xp - a.xp; });
      var nla = rows.filter(function (x) { return x.la; }).length;
      h += '<div class="card"><h2>Bảng xếp hạng</h2><p class="sub">' + Object.keys(U).length + " dòng trên bảng · " + Object.keys(an).length + " người đang ẩn · " + Object.keys(rs).length + " người đã đặt lại XP. Bảng chỉ hiện TÊN HIỂN THỊ (cột Họ tên chỉ bạn thấy). Người bị khóa tự ẩn, mở khóa thì hiện lại; xóa người thì bỏ luôn dòng.</p>" +
        '<div class="row" style="align-items:end"><div class="field"><label for="qtxl">Ngưỡng XP lạ (XP trong 1 ngày)</label><input id="qtxl" type="number" min="100" step="100" value="' + lim + '"></div><button class="btn" type="button" id="qtxlok">Lưu ngưỡng</button></div>' +
        (nla ? '<p class="tkmsg" role="status">' + nla + " người có ngày nhiều hơn " + fmt(lim) + " XP trong 7 ngày gần nhất (đánh dấu XP lạ, xếp đầu bảng). Xem chi tiết người đó ở mục Người học trước khi đặt lại.</p>" : '<p class="sub">Không ai vượt ngưỡng XP lạ trong 7 ngày gần nhất.</p>') + "</div>";
      h += '<div class="card"><div class="qtwrap"><table class="t qtbx"><thead><tr><th>Mã</th><th>Tên hiển thị</th><th>Họ tên</th><th>XP tuần</th><th>XP/ngày cao nhất (7 ngày)</th><th>Tổng XP bảng</th><th>Trạng thái</th><th></th></tr></thead><tbody>' +
        (rows.length ? rows.map(function (x) {
          var st = x.an === 1 ? '<span class="chip warn">ẩn (tay)</span>' : x.an === 2 ? '<span class="chip warn">ẩn (đang khóa)</span>' : '<span class="chip ok">đang hiện</span>';
          if (x.rs) st += ' <span class="chip">tính từ ' + dateY(x.rs) + "</span>";
          if (!x.u) st += ' <span class="chip k10">không còn tài khoản</span>';
          var bt = (x.u ? '<button class="btn sm" data-an="' + esc(x.uid) + '">' + (x.an ? "Hiện lại" : "Ẩn khỏi bảng") + "</button>" +
            (x.rs ? '<button class="btn sm ghost" data-unrs="' + esc(x.uid) + '">Bỏ đặt lại</button>' : '<button class="btn sm bad" data-rs="' + esc(x.uid) + '">Đặt lại XP</button>') : '<button class="btn sm bad" data-drop="' + esc(x.uid) + '">Bỏ dòng</button>');
          return "<tr><td class=\"num\">" + x.ma + "</td><td>" + esc(x.x.ten || (x.u && x.u.ten) || "?") + "</td><td>" + esc(x.u ? x.u.hoten || "" : "") + '</td><td class="num">' + fmt(x.xw) + '</td><td class="num">' + fmt(x.xm) + (x.la ? ' <span class="chip k10">XP lạ</span>' : "") + '</td><td class="num">' + fmt(x.xp) + "</td><td>" + st + '</td><td><div class="row" style="gap:4px;flex-wrap:nowrap">' + bt + "</div></td></tr>";
        }).join("") : '<tr><td colspan="8" class="muted">Chưa ai có dòng trên bảng.</td></tr>') + "</tbody></table></div></div>";
      var top = c && c.e ? c.e.slice(0, 3) : [];
      h += '<div class="card"><h2>Cúp tuần ' + dateOf(k) + " – " + dateY(k + 6) + "</h2>" + (c ? '<p class="sub">Đã chốt' + (c.t && c.t.toMillis ? " lúc " + hm(c.t.toMillis()) : "") + ". " + (top.length ? top.map(function (e, i) { var x = U[e.u] || {}; return "Hạng " + (i + 1) + ": " + esc(x.ten || "?") + " (" + fmt(e.v) + " XP)"; }).join(" · ") : "Không ai có XP tuần đó.") + "</p>" : '<p class="sub">Chưa chốt (người đầu tiên mở app sau 12 giờ trưa thứ Hai sẽ chốt).</p>') +
        '<p class="sub">Chốt lại = xóa bản chốt rồi tính lại từ bảng hiện tại (vd sau khi ẩn / đặt lại XP một người gian lận). Cúp người học đã nhận ở máy họ không tự mất.</p><div class="row"><button class="btn" id="qtcup">Chốt lại cúp tuần này</button></div></div>';
      box.innerHTML = h;
      function who(uid) { return byId[uid] || { uid: uid, ten: (U[uid] || {}).ten || "", hoten: "" }; }
      function busy(b) { $$("button", box).forEach(function (x) { x.disabled = true; }); b.textContent = "Đang lưu…"; }
      function fail(e) { toast("Chưa lưu được (" + tkErr(e) + ")"); redraw(); }
      $("#qtxlok", box).onclick = function () { var n = Math.max(100, Math.round(+$("#qtxl", box).value || 1500)); lsSet(QT_XPLA, String(n)); toast("Đã lưu ngưỡng XP lạ: " + fmt(n)); redraw(); };
      $$("[data-an]", box).forEach(function (b) { b.onclick = function () {
        var uid = b.getAttribute("data-an"), on = !an[uid], u = who(uid);
        busy(b); bxhRef().set(bxhMap("an", uid, on ? 1 : undefined), { merge: true }).then(function () { qtLog(on ? "Ẩn khỏi bảng xếp hạng" : "Hiện lại trên bảng xếp hạng", u, ""); toast(on ? "Đã ẩn khỏi bảng xếp hạng" : "Đã hiện lại"); redraw(); }, fail);
      }; });
      $$("[data-rs]", box).forEach(function (b) { b.onclick = function () {
        var uid = b.getAttribute("data-rs"), u = who(uid), ma = uid === ADMIN_UID ? "000" : qtMa(uid);
        var a = prompt("Đặt lại XP bảng xếp hạng của " + ma + " " + (u.hoten || u.ten || "") + ": bảng chỉ tính XP từ hôm nay (" + dateY(t0) + ").\nXP và cấp thật trong tiến độ người học KHÔNG đổi; cúp đã nhận vẫn giữ.\nGõ mã số " + ma + " để xác nhận:");
        if (a == null) return; if (String(a).trim() !== ma) { toast("Mã số không khớp — chưa đặt lại"); return; }
        var o = bxhMap("rs", uid, t0); o.u = bxhMap("u", uid).u;
        busy(b); bxhRef().set(o, { merge: true }).then(function () { qtLog("Đặt lại XP bảng xếp hạng", u, "tính từ " + dateY(t0) + " · trước đó " + fmt(+(U[uid] || {}).xp || 0) + " XP"); toast("Đã đặt lại. Máy người đó tự tính lại khi mở app."); redraw(); }, fail);
      }; });
      $$("[data-unrs]", box).forEach(function (b) { b.onclick = function () {
        var uid = b.getAttribute("data-unrs"), u = who(uid);
        if (!confirm("Bỏ đặt lại XP: bảng tính lại toàn bộ XP của người này (máy họ tự gửi lại khi mở app)?")) return;
        var o = bxhMap("rs", uid); o.u = bxhMap("u", uid).u;
        busy(b); bxhRef().set(o, { merge: true }).then(function () { qtLog("Bỏ đặt lại XP bảng xếp hạng", u, ""); redraw(); }, fail);
      }; });
      $$("[data-drop]", box).forEach(function (b) { b.onclick = function () {
        var uid = b.getAttribute("data-drop");
        if (!confirm("Bỏ dòng của tài khoản không còn tồn tại khỏi bảng?")) return;
        busy(b); bxhDrop(uid).then(function () { qtLog("Bỏ dòng bảng xếp hạng", who(uid), "không còn tài khoản"); redraw(); });
      }; });
      $("#qtcup", box).onclick = function () {
        var b = this; if (!confirm("Chốt lại cúp tuần " + dateOf(k) + " – " + dateY(k + 6) + " từ bảng hiện tại?")) return;
        busy(b); delete BXH.cup[k];
        (c ? bxhRef("c" + k).delete() : Promise.resolve()).then(function () { return bxhCupMake(k); }).then(function (n) {
          var e = (n && n.e) || [];
          qtLog("Chốt lại cúp tuần", null, dateOf(k) + " – " + dateY(k + 6) + ": " + e.slice(0, 3).map(function (x) { return ((U[x.u] || {}).ten || "?") + " " + x.v; }).join(", "));
          toast(n ? "Đã chốt lại cúp tuần" : "Chưa chốt được"); redraw();
        }, fail);
      };
    }, function (e) { if (cur === "qt-bxh") box.innerHTML = '<div class="card"><h2>Bảng xếp hạng</h2><p class="tkmsg">Chưa tải được (' + esc(tkErr(e)) + "). Luật Firestore mới (Bước 7) đã deploy chưa?</p></div>"; });
  }
  // ---------- QUẢN TRỊ → ẢNH MẶC ĐỊNH (27/11/2026): xem hình nào ai đang dùng, xóa hình không hợp (hanco_cfg/chung.amx), khôi phục ----------
  // Xóa = ẩn khỏi app (không chia / không cho chọn; người đang dùng tự đổi hình khi mở app). Tệp ảnh vẫn ở hosting (số hình phải cố định).
  function qtAnh(box, redraw) {
    box.innerHTML = '<p class="sub">Đang tải bảng xếp hạng…</p>';
    bxhLoad(true).then(function (T) {
      if (cur !== "qt-anh") return;
      var U = (T && T.u) || {}, gone = avmGone(), byId = {}, who = {}, nUse = 0, ng = 0, cells = [];
      QT.users.forEach(function (u) { byId[u.uid] = u; });
      Object.keys(U).forEach(function (k) { var r = U[k] || {}; if (+r.a > 0 && !r.ms) return; if (avmOk(r.mc, {})) (who[r.mc] = who[r.mc] || []).push(k); });
      function nm(k) { var r = U[k] || {}, u = byId[k], vc = vaiGet(); var hz = u ? u.hoten : k === ADMIN_UID ? "bạn — vai quản trị" : vc.hv && k === vc.hv ? "bạn — vai người học" : ""; return esc(r.ten || (u && u.ten) || "?") + (hz ? ' <span class="muted">(' + esc(hz) + ")</span>" : ""); }
      for (var i = 0; i < AVM_N; i++) {
        var ws = who[i] || [], g = !!gone[i], names = ws.map(nm).join(", ");
        if (g) ng++; else if (ws.length) nUse++;
        cells.push('<div class="qtam' + (g ? " gone" : "") + '"><img src="' + avmUrl(i) + '" alt="Hình số ' + (i + 1) + '" width="72" height="72" loading="lazy"><b>Hình ' + (i + 1) + "</b><small>" +
          (g ? "Đã xóa" + (ws.length ? " · chờ đổi hình: " + names : "") : ws.length ? "Đang dùng: " + names : '<span class="muted">Trống</span>') + "</small>" +
          (g ? '<button class="btn sm" type="button" data-amk="' + i + '">Khôi phục</button>' : '<button class="btn sm bad" type="button" data-amx="' + i + '">Xóa hình này</button>') + "</div>");
      }
      box.innerHTML = '<div class="card"><h2>Ảnh đại diện mặc định</h2><p class="sub">' + AVM_N + " hình · " + nUse + " đang có người dùng · " + (AVM_N - ng - nUse) + " trống · " + ng + " đã xóa.</p>" +
        '<p class="sub">Người chưa tự tải ảnh lên được app chia 1 hình riêng (không trùng ai; hết hình mới vòng lại). Người học tự chọn được trong các hình trống. ' +
        "Xóa hình = không ai được chia / chọn hình đó nữa; người đang dùng tự được đổi sang hình trống khác khi mở app. Khôi phục = cho dùng lại (người đã bị đổi không tự quay về).</p>" +
        '<p class="sub">Hình: Microsoft Fluent Emoji, giấy phép MIT.</p></div><div class="qtamg">' + cells.join("") + "</div>";
      function save(b, i, del) {
        var arr = Object.keys(avmGone()).map(Number).filter(function (x) { return x !== i; });
        if (del) arr.push(i); arr.sort(function (x, y) { return x - y; });
        $$("button", box).forEach(function (x) { x.disabled = true; }); b.textContent = "Đang lưu…";
        qtRef("hanco_cfg", "chung").set({ amx: arr }, { merge: true }).then(function () {
          var d = JSON.parse(JSON.stringify(CHG || {})); d.amx = arr; chungSet(d, true);
          qtLog(del ? "Xóa ảnh đại diện mặc định" : "Khôi phục ảnh đại diện mặc định", null, "Hình " + (i + 1) + ((who[i] || []).length ? " · đang dùng: " + who[i].map(function (k) { return (U[k] || {}).ten || "?"; }).join(", ") : ""));
          toast(del ? "Đã xóa hình " + (i + 1) + " khỏi app" : "Đã khôi phục hình " + (i + 1)); redraw();
        }, function (e) { toast("Chưa lưu được (" + tkErr(e) + ")"); redraw(); });
      }
      $$("[data-amx]", box).forEach(function (b) { b.onclick = function () {
        var i = +b.getAttribute("data-amx"), ws = (who[i] || []).map(function (k) { return (U[k] || {}).ten || "?"; });
        if (!confirm("Xóa hình " + (i + 1) + " khỏi app?" + (ws.length ? "\nĐang có người dùng: " + ws.join(", ") + " — họ sẽ tự được đổi sang hình trống khác khi mở app." : ""))) return;
        save(b, i, true);
      }; });
      $$("[data-amk]", box).forEach(function (b) { b.onclick = function () { save(b, +b.getAttribute("data-amk"), false); }; });
    }, function (e) { if (cur === "qt-anh") box.innerHTML = '<div class="card"><h2>Ảnh đại diện mặc định</h2><p class="tkmsg">Chưa tải được (' + esc(tkErr(e)) + "). Kiểm tra mạng rồi bấm Tải lại.</p></div>"; });
  }
  function qtActive() { return QT.users.filter(function (u) { return u.st !== "xoa"; }); }
  function qtTong(box) {
    var t0 = today(), ws = weekStart(t0), us = qtActive(), rows = us.map(qtRow);
    var nd = rows.filter(function (r) { return r.last === t0; }).length, nw = rows.filter(function (r) { return r.last >= ws; }).length;
    var nk = us.filter(function (u) { return u.st === "khoa"; }).length, nt = rows.filter(function (r) { return !r.tk; }).length;
    var tx = (QT.ch && QT.ch.tx) || {}, h = "";
    if (QT.msg) h += '<p class="tkmsg" role="status">' + esc(QT.msg) + "</p>";
    h += '<div class="card"><div class="qtst">' +
      "<div><small>Thành viên / trần</small><b>" + fmt(+QT.dk.dem || 0) + " / " + fmt(+QT.dk.tran || 0) + "</b><small>" + (QT.dk.mo ? "đang cho đăng ký" : "đang đóng đăng ký") + "</small></div>" +
      "<div><small>Học hôm nay</small><b>" + nd + "</b><small>trên " + us.length + " người</small></div>" +
      "<div><small>Học tuần này</small><b>" + nw + "</b><small>từ thứ Hai</small></div>" +
      "<div><small>Đang khóa</small><b>" + nk + "</b><small>" + QT.dx.length + " lượt xóa (lịch sử)</small></div></div>" +
      '<p class="sub" style="margin-top:8px">Số liệu học lấy từ bản thống kê mỗi máy gửi lên (tối đa 1 lần/giờ), nên có thể chậm tới 1 giờ.' + (nt ? " " + nt + " người chưa gửi số liệu lần nào." : "") + " Cập nhật lúc " + hm(QT.t) + ".</p></div>";
    // tự xóa: ai sắp bị khóa / xóa
    if (tx.bat) {
      var n = Math.max(7, +tx.n || 30), k = Math.max(1, +tx.k || 7), mien = tx.mien || [], soon = [];
      us.forEach(function (u) {
        if (mien.indexOf(u.uid) >= 0) return;
        var idle = t0 - qtLast(u);
        if (u.st === "ok" && idle >= n - 3) soon.push([u, "không học " + idle + " ngày → tự khóa sau " + Math.max(0, n - idle) + " ngày"]);
        else if (u.st === "khoa" && QT.kh[u.uid] != null) soon.push([u, "đã tự khóa ngày " + dateY(QT.kh[u.uid]) + " → tự xóa sau " + Math.max(0, k - (t0 - QT.kh[u.uid])) + " ngày"]);
      });
      h += '<div class="card"><h2>Tự xóa đang BẬT</h2><p class="sub">Không học ' + n + " ngày → khóa; khóa thêm " + k + " ngày → xóa (cho đăng ký lại). Chỉ chạy khi bạn mở tab này. Đổi ở mục Cài đặt.</p>" +
        (soon.length ? '<ul class="qtls">' + soon.map(function (x) { return "<li><b>" + qtMa(x[0].uid) + "</b> " + esc(x[0].hoten || x[0].ten) + " — " + esc(x[1]) + "</li>"; }).join("") + "</ul>" : '<p class="sub">Chưa ai sắp bị tự khóa / tự xóa.</p>') + "</div>";
    }
    var tb = (QT.ch && QT.ch.tb) || null;
    h += '<div class="card"><h2>Thông báo chung đang hiện</h2>' + (tb && tb.h ? '<p class="tbh">' + tbHTML(tb.h) + '</p><p class="sub">Đăng lúc ' + hm(tb.t) + "</p>" : '<p class="sub">Không có. Đăng ở mục Cài đặt.</p>') + "</div>";
    try { h += qtHanSum(); } catch (e) { h += '<div class="card"><h2>Dung lượng &amp; hạn mức</h2><p class="sub">Chưa tính được (' + esc(e && e.message) + ").</p>" + qtLinks() + "</div>"; }
    box.innerHTML = h;
  }
  var QT_COLS = [["ma", "Mã"], ["ten", "Tên hiển thị"], ["hoten", "Họ tên"], ["email", "Email"], ["last", "Học lần cuối"], ["sc", "Chuỗi"], ["xw", "XP tuần"], ["pct", "Lộ trình"], ["lag", "So với lịch"], ["due", "Quá hạn"], ["ex", "Thi thử"], ["st", "Trạng thái"]];
  function qtSortVal(r, k) {
    if (k === "ma") return r.ma === "—" ? 1e9 : +r.ma;
    if (k === "ten" || k === "hoten" || k === "email") return String(r.u[k] || "").toLowerCase();
    if (k === "st") return r.u.st || "";
    if (k === "last") return r.last || -1;
    var x = r[k]; return x == null ? -1e9 : x;
  }
  function qtNguoi(box, redraw) {
    var q = nameKey(qtQ.q), rows = QT.users.map(qtRow).filter(function (r) {
      if (qtQ.st && (r.u.st || "ok") !== qtQ.st) return false;
      if (!q) return true;
      return [r.ma, r.u.ten, r.u.hoten, r.u.email].some(function (s) { return nameKey(s).indexOf(q) >= 0; });
    });
    rows.sort(function (a, b) { var x = qtSortVal(a, qtSort.k), y = qtSortVal(b, qtSort.k); return (x < y ? -1 : x > y ? 1 : 0) * qtSort.d; });
    var h = '<div class="card"><div class="row" style="align-items:end"><div class="field" style="flex:1 1 220px"><label for="qtq">Tìm (mã, tên, họ tên, email)</label><input id="qtq" type="search" value="' + esc(qtQ.q) + '"></div>' +
      '<div class="field" style="flex:0 1 170px"><label for="qtst">Trạng thái</label><select id="qtst"><option value="">Tất cả</option><option value="ok">Đang học</option><option value="khoa">Đang khóa</option><option value="xoa">Đã chặn</option></select></div>' +
      '<button class="btn" type="button" id="qtcsv">Xuất CSV</button></div><p class="sub">' + rows.length + " người. Bấm tên để xem chi tiết, khóa / mở khóa / xóa. Bấm tiêu đề cột để xếp.</p>" +
      '<div class="qtwrap"><table class="t qtt"><thead><tr>' + QT_COLS.map(function (c) { return '<th><button type="button" data-sk="' + c[0] + '">' + c[1] + (qtSort.k === c[0] ? (qtSort.d > 0 ? " ▲" : " ▼") : "") + "</button></th>"; }).join("") + "</tr></thead><tbody>" +
      (rows.length ? rows.map(function (r) {
        var u = r.u;
        return "<tr><td class=\"num\">" + r.ma + '</td><td><button type="button" class="lnk" data-qu="' + esc(u.uid) + '">' + esc(u.ten || "(chưa đặt)") + "</button></td><td>" + esc(u.hoten || "") + "</td><td>" + esc(u.email || "") + "</td><td>" + qtLastTxt(r) + '</td><td class="num">' + r.sc + '</td><td class="num">' + fmt(r.xw) + '</td><td class="num">' + (r.pct == null ? "—" : r.pct + "%") + "</td><td>" + qtLagTxt(r) + '</td><td class="num">' + (r.due == null ? "—" : r.due) + '</td><td class="num">' + (r.ex == null ? "—" : r.ex) + "</td><td>" + qtStTxt(u.st) + "</td></tr>";
      }).join("") : '<tr><td colspan="12" class="muted">Không có ai.</td></tr>') + "</tbody></table></div></div>";
    // lịch sử người bị xóa
    var dx = QT.dx.slice().sort(function (a, b) { return b.xoa - a.xoa; });
    h += '<div class="card"><h2>Lịch sử đã xóa</h2>' + (dx.length ? '<div class="qtwrap"><table class="t"><thead><tr><th>Mã</th><th>Họ tên</th><th>Tên hiển thị</th><th>Email</th><th>Đăng ký</th><th>Xóa</th><th>Cách</th></tr></thead><tbody>' +
      dx.map(function (x) { return '<tr><td class="num">' + esc(x.ma) + "</td><td>" + esc(x.hoten) + "</td><td>" + esc(x.ten) + "</td><td>" + esc(x.email) + "</td><td>" + (x.tao ? hm(x.tao) : "—") + "</td><td>" + hm(x.xoa) + "</td><td>" + (x.cach === "lai" ? "cho đăng ký lại" : "chặn luôn") + (x.ly === "tu" ? " (tự xóa)" : "") + "</td></tr>"; }).join("") + "</tbody></table></div>" : '<p class="sub">Chưa xóa ai.</p>') + "</div>";
    box.innerHTML = h;
    $("#qtst", box).value = qtQ.st;
    var qi = $("#qtq", box), tmo = 0;
    qi.oninput = function () { clearTimeout(tmo); tmo = setTimeout(function () { qtQ.q = qi.value; redraw(); var n = $("#qtq"); if (n) { n.focus(); try { n.setSelectionRange(n.value.length, n.value.length); } catch (e) { } } }, 250); };
    $("#qtst", box).onchange = function () { qtQ.st = this.value; redraw(); };
    $$("[data-sk]", box).forEach(function (b) { b.onclick = function () { var k = b.getAttribute("data-sk"); if (qtSort.k === k) qtSort.d = -qtSort.d; else { qtSort.k = k; qtSort.d = /^(last|sc|xw|xp|pct|lag|due|ex)$/.test(k) ? -1 : 1; } redraw(); }; });
    $$("[data-qu]", box).forEach(function (b) { b.onclick = function () { qtDetail(b.getAttribute("data-qu"), redraw); }; });
    $("#qtcsv", box).onclick = function () { qtCSV(rows); };
  }
  function qtCSV(rows) {
    var out = [["Mã", "Tên hiển thị", "Họ tên", "Email", "Ngày đăng ký", "Học lần cuối", "Chuỗi ngày", "XP", "XP tuần", "Lộ trình (%)", "Chậm (+) / nhanh (−) mục", "Thẻ quá hạn", "Thi thử cao nhất", "Trạng thái"]];
    rows.forEach(function (r) {
      var u = r.u;
      out.push([r.ma === "—" ? "" : '="' + r.ma + '"', u.ten || "", u.hoten || "", u.email || "", u.taoMs ? hm(u.taoMs) : "", r.last ? dateY(r.last) : "", r.sc, r.xp, r.xw, r.pct == null ? "" : r.pct, r.lag == null ? "" : r.lag, r.due == null ? "" : r.due, r.ex == null ? "" : r.ex, u.st === "khoa" ? "đang khóa" : u.st === "xoa" ? "đã chặn" : "đang học"]);
    });
    var csv = "﻿" + out.map(function (r) { return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(","); }).join("\r\n");
    var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = "hanco-nguoi-hoc-" + dayKey(today()) + ".csv"; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  var QT_EXN = { examHK1: "Đề Kỳ 1 (Hán 1)", examHK2: "Đề Kỳ 2 (Hán 2)" };
  function qtExName(k) { if (QT_EXN[k]) return QT_EXN[k]; var e = (D.exams || []).filter(function (x) { return x.best === k; })[0]; return e ? e.name : k; }
  // chi tiết 1 người: đọc tiến độ mới nhất (1 lượt đọc) → sumOf; không đọc được thì dùng bản tóm tắt. Không hiện ghi chú.
  function qtDetail(uid, redraw) {
    var u = QT.users.filter(function (x) { return x.uid === uid; })[0]; if (!u) return;
    var m = modal('<div id="qtd"><h2>' + qtMa(uid) + " · " + esc(u.ten || "") + '</h2><p class="sub">Đang tải tiến độ…</p></div>');
    var el = $("#qtd", m.el);
    qtRef("hanco_progress", uid).get().then(function (snap) {
      var t = null; try { if (snap.exists && snap.data().data) t = sumOf(normalize(JSON.parse(snap.data().data))); } catch (e) { t = null; }
      show(t ? t : u.tk, t ? "tiến độ mới nhất" : u.tk ? "bản tóm tắt gửi lúc " + hm(u.tk.t) : "");
    }, function () { show(u.tk, u.tk ? "bản tóm tắt gửi lúc " + hm(u.tk.t) : ""); });
    function show(t, src) {
      if (!document.body.contains(el)) return;
      var t0 = today(), h = "<h2>" + qtMa(uid) + " · " + esc(u.ten || "") + " " + qtStTxt(u.st) + "</h2>";
      h += "<p>Họ tên: <b>" + esc(u.hoten || "") + "</b><br>Email: " + esc(u.email || "") + "<br>Đăng ký: " + (u.taoMs ? hm(u.taoMs) : "—") + "</p>";
      if (!t) h += '<p class="sub">Người này chưa có số liệu học nào.</p>';
      else {
        var r = qtRow({ uid: uid, tk: t, st: u.st }), n = t.n || {};
        h += '<p class="sub">Số liệu tính từ ' + esc(src) + ".</p>";
        h += '<div class="qtst sm"><div><small>Học lần cuối</small><b>' + qtLastTxt(r) + "</b></div><div><small>Chuỗi ngày</small><b>" + r.sc + "</b></div><div><small>Tổng XP</small><b>" + fmt(t.xp || 0) + "</b><small>" + fmt(r.xw) + " XP tuần này</small></div><div><small>Thẻ quá hạn</small><b>" + (t.due || 0) + "</b></div></div>";
        h += '<p class="sub">Đã học: ' + (n.c || 0) + " chữ · " + (n.w || 0) + " từ · " + (n.r || 0) + " bộ thủ · " + (n.s || 0) + " câu · " + (n.lt || 0) + " loại từ. Tiến độ dài " + fmt(Math.round((t.sz || 0) / 1000)) + " nghìn ký tự.</p>";
        var la = t.la || [], lx = t.lx || [], base = (t.d || t0) - 29;
        h += "<h3>30 ngày gần nhất</h3><div class=\"qtcal\" role=\"img\" aria-label=\"Lịch học 30 ngày\">" + la.map(function (a, i) { var lv = a <= 0 ? 0 : a < 10 ? 1 : a < 30 ? 2 : a < 60 ? 3 : 4; return '<i class="l' + lv + '" title="' + dateOf(base + i) + ": " + a + " lượt học/ôn, " + (lx[i] || 0) + ' XP"></i>'; }).join("") + '</div><p class="sub qtcalk"><span>' + dateOf(base) + "</span><span>ô càng đậm = học càng nhiều</span><span>" + dateOf(base + 29) + "</span></p>";
        h += "<h3>Lộ trình</h3>" + ((t.ky || []).length ? '<table class="t"><tbody>' + t.ky.map(function (x) { var rr = { lag: (x.ch || 0) - (x.nh || 0) }; return "<tr><td>" + esc(TERM[x.k] ? TERM[x.k].name : x.k) + "</td><td>" + dateOf(x.s) + " → thi " + dateY(x.e) + '</td><td class="num">' + x.p + "%</td><td>" + qtLagTxt(rr) + "</td></tr>"; }).join("") + "</tbody></table>" : '<p class="sub">Chưa chọn kỳ nào (hoặc các kỳ đã thi xong).</p>');
        var ex = t.ex || {}, ek = Object.keys(ex);
        h += "<h3>Thi thử (điểm cao nhất)</h3>" + (ek.length ? "<p>" + ek.map(function (k) { return esc(qtExName(k)) + ": <b>" + ex[k] + "</b>"; }).join(" · ") + "</p>" : '<p class="sub">Chưa thi thử.</p>');
        var hq = (t.hq || []).map(function (id) { return ITEM[id]; }).filter(Boolean);
        h += "<h3>Chữ hay quên</h3>" + (hq.length ? '<div class="minis">' + hq.map(function (it) { return '<span class="mini"><span class="han">' + esc(it.key) + "</span>" + esc(firstAm(it.am)) + "</span>"; }).join("") + "</div>" : '<p class="sub">Chưa có.</p>');
      }
      h += '<div id="qtdact" class="row" style="margin-top:12px">' + (u.st === "xoa" ? "" : u.st === "khoa" ? '<button class="btn" type="button" data-a="mo">Mở khóa</button>' : '<button class="btn" type="button" data-a="khoa">Khóa</button>') +
        '<button class="btn bad" type="button" data-a="xoa">' + (u.st === "xoa" ? "Cho đăng ký lại…" : "Xóa…") + "</button></div>";
      el.innerHTML = h;
      var act = $("#qtdact", el);
      function done(msg) { toast(msg); m.close(); redraw(); }
      function fail(e) { $$("button", act).forEach(function (b) { b.disabled = false; }); toast(tkErr(e)); }
      $$("[data-a]", act).forEach(function (b) {
        b.onclick = function () {
          var a = b.getAttribute("data-a");
          if (a === "khoa") { if (!confirm("Khóa tài khoản " + qtMa(uid) + " " + (u.hoten || "") + "? Người này bị đẩy ra màn \"Tài khoản đang tạm khóa\" ngay (tiến độ vẫn giữ).")) return; b.disabled = true; qtSetSt(u, "khoa", false).then(function () { done("Đã khóa"); }, fail); }
          else if (a === "mo") { b.disabled = true; qtSetSt(u, "ok", false).then(function () { done("Đã mở khóa"); }, fail); }
          else delForm();
        };
      });
      function delForm() {
        var ma = qtMa(uid), code = ma !== "—" ? ma : "XOA", blocked = u.st === "xoa";
        act.outerHTML = '<div class="qtdel" id="qtdel"><h3>' + (blocked ? "Cho đăng ký lại" : "Xóa tài khoản") + "</h3>" +
          (blocked ? '<p>Trả họ tên <b>' + esc(u.hoten || "") + '</b> về danh sách: người này đăng ký lại được (nhận mã số mới). Dòng lịch sử cũ vẫn giữ.</p>' :
            '<p>Xóa <b>vĩnh viễn</b> tiến độ học và các bản sao lưu của người này trên tài khoản (không khôi phục được), trả lại 1 chỗ; máy của người đó ngắt đồng bộ ngay. Lịch sử (mã số, họ tên, email, ngày đăng ký, ngày xóa) vẫn được lưu.</p>' +
            '<label class="qtopt"><input type="radio" name="qtc" value="chan"> <span><b>Chặn luôn</b>: giữ họ tên này, người đó KHÔNG đăng ký lại được (kể cả bằng email khác).</span></label>' +
            '<label class="qtopt"><input type="radio" name="qtc" value="lai"> <span><b>Cho đăng ký lại</b>: trả họ tên về danh sách; đăng ký lại thì nhận mã số mới.</span></label>') +
          '<div class="field" style="max-width:260px"><label for="qtcf">Gõ <b>' + code + '</b> để xác nhận</label><input id="qtcf" type="text" inputmode="numeric" autocomplete="off"></div>' +
          '<div class="row"><button class="btn bad" type="button" id="qtgo">' + (blocked ? "Cho đăng ký lại" : "Xóa vĩnh viễn") + '</button><button class="btn ghost" type="button" id="qtno">Thôi</button></div></div>';
        var f = $("#qtdel", el);
        $("#qtno", f).onclick = function () { show(t, src); };
        $("#qtgo", f).onclick = function () {
          var c = blocked ? "lai" : ($("input[name=qtc]:checked", f) || {}).value;
          if (!c) return toast("Hãy chọn Chặn luôn hoặc Cho đăng ký lại");
          if ($("#qtcf", f).value.trim().toUpperCase() !== code) return toast("Gõ đúng " + code + " để xác nhận");
          this.disabled = true; var me = this;
          qtDelete(u, c, "tay").then(function () { done(blocked ? "Đã cho đăng ký lại" : "Đã xóa tài khoản"); }, function (e) { me.disabled = false; toast(tkErr(e)); });
        };
        try { $("input", f).focus({ preventScroll: true }); } catch (e) { }
      }
    }
  }
  function qtNhac(box) {
    var nd = Math.max(1, parseInt(lsGet(QT_NHAC), 10) || 3), t0 = today(), list = [];
    QT.users.forEach(function (u) {
      if (u.st !== "ok") return;
      var r = qtRow(u), why = [], idle = t0 - qtLast(u);
      if (idle >= nd) why.push(r.last ? idle + " ngày chưa học" : "chưa học buổi nào (đăng ký " + idle + " ngày)");
      (u.tk && u.tk.ky || []).forEach(function (x) { var lag = (x.ch || 0) - (x.nh || 0); if (lag >= 10) why.push("chậm " + lag + " mục so với lịch " + (TERM[x.k] ? TERM[x.k].short : x.k)); });
      if (why.length) list.push([u, why.join("; "), idle]);
    });
    list.sort(function (a, b) { return b[2] - a[2]; });
    var txt = "Danh sách cần nhắc học (" + dateY(t0) + "):\n" + list.map(function (x, i) { return (i + 1) + ". " + (x[0].hoten || x[0].ten) + " — " + x[1]; }).join("\n");
    box.innerHTML = '<div class="card"><h2>Danh sách cần nhắc</h2><div class="row" style="align-items:end"><div class="field" style="flex:0 1 200px"><label for="qtnd">Lâu không học từ (ngày)</label><input id="qtnd" type="number" min="1" max="60" value="' + nd + '"></div></div>' +
      '<p class="sub">Người đang học mà lâu không học, hoặc chậm từ 10 mục trở lên so với lịch. Bấm "Chép" rồi dán vào Zalo (chỉ chép họ tên + lý do, không chép mã số).</p>' +
      (list.length ? '<ol class="qtls">' + list.map(function (x) { return "<li><b>" + qtMa(x[0].uid) + "</b> " + esc(x[0].hoten || x[0].ten) + " — " + esc(x[1]) + "</li>"; }).join("") + '</ol><textarea id="qtnt" readonly aria-label="Nội dung để chép">' + esc(txt) + '</textarea><div class="row acts"><button class="btn primary" type="button" id="qtcp">Chép danh sách</button></div>' : '<p class="sub">Không có ai cần nhắc. Tốt lắm!</p>') + "</div>";
    $("#qtnd", box).onchange = function () { lsSet(QT_NHAC, String(Math.max(1, parseInt(this.value, 10) || 3))); qtNhac(box); };
    var cp = $("#qtcp", box); if (cp) cp.onclick = function () {
      var ta = $("#qtnt", box);
      function fb2() { ta.select(); try { document.execCommand("copy"); toast("Đã chép"); } catch (e) { toast("Chưa chép được, hãy tự chọn chữ rồi chép"); } }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ta.value).then(function () { toast("Đã chép, dán vào Zalo được rồi"); }, fb2); else fb2();
    };
  }
  function qtTen(box) {
    var db = fb.db, byUid = {};
    QT.users.forEach(function (u) { byUid[u.uid] = u; });
    box.innerHTML = '<div class="card"><h2>Danh sách họ tên thật</h2><p class="sub">Chỉ người có họ tên trong danh sách này mới đăng ký được (mỗi họ tên 1 tài khoản). Dán mỗi dòng 1 họ tên đầy đủ, có dấu (dán thẳng từ Excel được: app tự bỏ cột số thứ tự). Không ai ngoài quản trị đọc được danh sách.</p>' +
      '<textarea id="qtten" aria-label="Danh sách họ tên" placeholder="Nguyễn Văn An&#10;Trần Thị Bình"></textarea><div class="row" style="margin-top:8px"><button class="btn" type="button" id="qtxem">Xem trước</button><button class="btn" type="button" id="qtds">Xem danh sách đã lưu</button></div><div id="qtkq"></div></div>';
    var el = box;
    function saved() { return db.collection("hanco_ten").get().then(function (qs) { var m = {}; qs.docs.forEach(function (d) { m[d.id] = d.data(); }); return m; }); }
    var kq = $("#qtkq", el);
    $("#qtxem", el).onclick = function () {
      var r = qtParse($("#qtten", el).value);
      if (!r.list.length && !r.bad.length) { kq.innerHTML = '<p class="sub">Chưa dán họ tên nào.</p>'; return; }
      kq.innerHTML = '<p class="sub">Đang so với danh sách đã lưu…</p>';
      saved().then(function (m) {
        var neu = r.list.filter(function (x) { return !m[x.k]; }), co = r.list.filter(function (x) { return m[x.k]; });
        kq.innerHTML = '<p><b>' + neu.length + '</b> họ tên mới sẽ được thêm, đúng như dưới đây (kiểm tra kỹ dấu):</p>' +
          (neu.length ? '<ol class="qtl">' + neu.map(function (x) { return "<li>" + esc(x.ten) + "</li>"; }).join("") + "</ol>" : "") +
          (co.length ? '<p class="sub">' + co.length + " họ tên đã có sẵn trong danh sách (bỏ qua): " + co.map(function (x) { return esc(m[x.k].ten); }).join(", ") + "</p>" : "") +
          (r.dup.length ? '<p class="sub">Trùng trong ô dán (chỉ lấy 1 lần): ' + r.dup.map(esc).join(", ") + "</p>" : "") +
          (r.bad.length ? '<p class="tkmsg">Dòng bị bỏ qua (có chữ số / chỉ 1 chữ / không phải họ tên) — sửa rồi dán lại: ' + r.bad.map(esc).join(" · ") + "</p>" : "") +
          (neu.length ? '<div class="row"><button class="btn primary" type="button" id="qtghi">Thêm ' + neu.length + ' họ tên vào danh sách</button></div>' : "");
        var ghi = $("#qtghi", el); if (ghi) ghi.onclick = function () {
          ghi.disabled = true;
          var chunks = []; for (var i = 0; i < neu.length; i += 400) chunks.push(neu.slice(i, i + 400));
          chunks.reduce(function (pr, ch) {
            return pr.then(function () { var b = db.batch(); ch.forEach(function (x) { b.set(db.collection("hanco_ten").doc(x.k), { ten: x.ten, uid: null }); }); return b.commit(); });
          }, Promise.resolve()).then(function () {
            toast("Đã thêm " + neu.length + " họ tên"); $("#qtten", el).value = ""; kq.innerHTML = '<p>Đã thêm <b>' + neu.length + "</b> họ tên vào danh sách.</p>";
            qtLog("Thêm họ tên", null, neu.length + " họ tên: " + neu.slice(0, 20).map(function (x) { return x.ten; }).join(", ") + (neu.length > 20 ? "…" : ""));
          }, function (e) { ghi.disabled = false; toast(tkErr(e)); });
        };
      }, function (e) { kq.innerHTML = '<p class="tkmsg">' + esc(tkErr(e)) + "</p>"; });
    };
    $("#qtds", el).onclick = function () {
      kq.innerHTML = '<p class="sub">Đang tải…</p>';
      saved().then(function (m) {
        var ks = Object.keys(m).sort(function (a, b) { return m[a].ten.localeCompare(m[b].ten, "vi"); }), n = ks.filter(function (k) { return m[k].uid; }).length;
        kq.innerHTML = '<p>' + ks.length + ' họ tên trong danh sách: <b>' + n + '</b> đã có tài khoản, <b>' + (ks.length - n) + '</b> chưa.</p>' +
          (ks.length ? '<div class="qtwrap"><table class="t"><tbody>' + ks.map(function (k) {
            var uid = m[k].uid, u = uid ? byUid[uid] : null;
            return "<tr><td>" + esc(m[k].ten) + "</td><td>" + (uid ? "đã có tài khoản" + (u ? " · mã " + qtMa(uid) + " · " + esc(u.email || "") + (u.st === "xoa" ? " (đã chặn)" : u.st === "khoa" ? " (đang khóa)" : "") : "") : '<span class="muted">chưa</span>') + "</td><td>" + (uid ? "" : '<button class="btn sm ghost" type="button" data-qtx="' + esc(k) + '" aria-label="Xóa họ tên này">✕</button>') + "</td></tr>";
          }).join("") + "</tbody></table></div>" : "");
        $$("[data-qtx]", kq).forEach(function (bx) { bx.onclick = function () {
          var k = bx.getAttribute("data-qtx");
          if (!confirm("Xóa \"" + m[k].ten + "\" khỏi danh sách? Người này sẽ không đăng ký được.")) return;
          db.collection("hanco_ten").doc(k).delete().then(function () { toast("Đã xóa"); qtLog("Xóa họ tên", null, m[k].ten); $("#qtds", el).click(); }, function (e) { toast(tkErr(e)); });
        }; });
      }, function (e) { kq.innerHTML = '<p class="tkmsg">' + esc(tkErr(e)) + "</p>"; });
    };
  }
  function qtCai(box, redraw) {
    var d = QT.dk, ch = QT.ch || {}, tb = ch.tb || {}, thi = ch.thi || {}, tx = ch.tx || {}, mien = (tx.mien || []).slice(), t0 = today();
    var cref = qtRef("hanco_cfg", "chung");
    function saveCh(o, what) { return cref.set(o, { merge: true }).then(function () { return cref.get(); }).then(function (s) { QT.ch = s.exists ? s.data() : {}; chungSet(QT.ch, true); toast("Đã lưu"); qtLog("Cài đặt", null, what); redraw(); }, function (e) { toast(tkErr(e)); }); }
    var others = QT.users.filter(function (u) { return u.st !== "xoa"; }).sort(function (a, b) { return qtMa(a.uid) < qtMa(b.uid) ? -1 : 1; });
    function uname(uid) { var u = QT.users.filter(function (x) { return x.uid === uid; })[0]; return u ? qtMa(uid) + " " + (u.hoten || u.ten) : uid; }
    box.innerHTML = '<div class="cols2">' +
      '<div class="card"><h2>Đăng ký tài khoản</h2><p>Đã đăng ký: <b>' + fmt(d.dem || 0) + "</b> / " + fmt(d.tran || 0) + ' người (không tính quản trị viên).</p>' +
      '<div class="row" style="align-items:end"><div class="field" style="flex:0 1 160px"><label for="qttran">Trần số người</label><input id="qttran" type="number" min="0" max="1000" value="' + (+d.tran || 0) + '"></div>' +
      '<button class="btn" type="button" id="qtluu">Lưu</button></div><label class="qtchk"><input type="checkbox" id="qtmo"' + (d.mo ? " checked" : "") + '> Cho người mới đăng ký</label>' +
      '<p class="sub">Bỏ chọn "Cho người mới đăng ký" = tạm không nhận thêm người mới dù còn chỗ (người đã có tài khoản vẫn học bình thường). Hết chỗ thì người mới thấy "App đã đủ người".</p></div>' +
      '<div class="card"><h2>Thông báo chung</h2><p class="sub">Hiện ở đầu mục Hôm nay của mọi người (người học bấm Ẩn được; đăng thông báo mới thì hiện lại). Chỉ chữ thường; link http(s) tự bấm được.</p>' +
      '<textarea id="qttb" maxlength="1000" aria-label="Nội dung thông báo">' + esc(tb.h || "") + '</textarea><div class="row" style="margin-top:8px"><button class="btn primary" type="button" id="qttbok">Đăng thông báo</button>' + (tb.h ? '<button class="btn ghost" type="button" id="qttbx">Gỡ thông báo</button>' : "") + "</div>" + (tb.h ? '<p class="sub">Đang hiện từ ' + hm(tb.t) + ".</p>" : "") + "</div>" +
      '<div class="card"><h2>Ngày thi chung</h2><p class="sub">Đặt ngày thi của từng kỳ cho cả lớp. Người học thấy thẻ "Ngày thi chung" ở mục Hôm nay, bấm Áp dụng thì lịch tự nén cho kịp (app báo nếu phải học hơn 20 chữ/ngày); khung Chọn kỳ học lấy sẵn ngày này. Không tự đổi lộ trình của ai khi họ chưa bấm.</p>' +
      TERMS.map(function (T) { var e = +thi[T.k] || 0; return '<div class="row" style="align-items:end"><div class="field" style="flex:0 1 200px"><label for="qtthi-' + T.k + '">' + esc(T.name) + '</label><input type="date" id="qtthi-' + T.k + '" data-thi="' + T.k + '" value="' + (e ? ymd(e) : "") + '"></div>' + (e && e <= t0 ? '<span class="sub">đã qua</span>' : "") + "</div>"; }).join("") +
      '<div class="row" style="margin-top:8px"><button class="btn" type="button" id="qtthiok">Lưu ngày thi</button></div><p class="sub">Xóa ô ngày = bỏ ngày thi chung của kỳ đó.</p></div>' +
      '<div class="card"><h2>Tự xóa người không học</h2><label class="qtchk"><input type="checkbox" id="qttx"' + (tx.bat ? " checked" : "") + '> Bật tự xóa</label>' +
      '<div class="row" style="align-items:end"><div class="field" style="flex:0 1 190px"><label for="qtn">Không học bao nhiêu ngày thì khóa</label><input id="qtn" type="number" min="7" max="365" value="' + (+tx.n || 30) + '"></div>' +
      '<div class="field" style="flex:0 1 190px"><label for="qtk">Khóa thêm bao nhiêu ngày thì xóa</label><input id="qtk" type="number" min="1" max="90" value="' + (+tx.k || 7) + '"></div></div>' +
      '<p class="sub">"Không học" = không có lượt học / ôn nào (chỉ mở app không tính). Bị xóa theo cách "cho đăng ký lại". Chỉ chạy khi bạn mở tab Quản trị; quản trị viên và người trong danh sách miễn không bao giờ bị. Lưu ý: ai học khi mất mạng nhiều ngày có thể bị khóa nhầm (mở khóa lại được).</p>' +
      "<h3>Danh sách miễn</h3>" + (mien.length ? '<ul class="qtls">' + mien.map(function (uid) { return "<li>" + esc(uname(uid)) + ' <button class="btn sm ghost" type="button" data-mx="' + esc(uid) + '" aria-label="Bỏ khỏi danh sách miễn">✕</button></li>'; }).join("") + "</ul>" : '<p class="sub">Chưa có ai.</p>') +
      '<div class="row" style="align-items:end"><div class="field" style="flex:1 1 220px"><label for="qtma">Thêm người được miễn</label><select id="qtma"><option value="">— chọn —</option>' + others.filter(function (u) { return mien.indexOf(u.uid) < 0; }).map(function (u) { return '<option value="' + esc(u.uid) + '">' + esc(qtMa(u.uid) + " " + (u.hoten || u.ten)) + "</option>"; }).join("") + '</select></div><button class="btn" type="button" id="qtmadd">Thêm</button></div>' +
      '<div class="row" style="margin-top:8px"><button class="btn primary" type="button" id="qttxok">Lưu cài đặt tự xóa</button></div></div></div>';
    var dref = qtRef("hanco_cfg", "dk");
    $("#qtluu", box).onclick = function () {
      var t = Math.max(0, Math.min(1000, parseInt($("#qttran", box).value, 10) || 0)), mo = $("#qtmo", box).checked;
      dref.set({ tran: t, mo: mo }, { merge: true }).then(function () { QT.dk.tran = t; QT.dk.mo = mo; if (QT.dk.dem == null) QT.dk.dem = 0; toast("Đã lưu"); qtLog("Cài đặt", null, "trần " + t + " người, " + (mo ? "cho" : "đóng") + " đăng ký"); redraw(); }, function (e) { toast(tkErr(e)); });
    };
    $("#qttbok", box).onclick = function () { var h = $("#qttb", box).value.replace(/\s+$/, ""); if (!h.trim()) return toast("Hãy nhập nội dung thông báo"); saveCh({ tb: { h: h.slice(0, 1000), t: Date.now() } }, "đăng thông báo: " + h.slice(0, 80)); };
    var tbx = $("#qttbx", box); if (tbx) tbx.onclick = function () { saveCh({ tb: qtFV().delete() }, "gỡ thông báo"); };
    $("#qtthiok", box).onclick = function () {
      var o = {}, ds = [];
      $$("[data-thi]", box).forEach(function (i) { var k = i.getAttribute("data-thi"), n = fromYmd(i.value); o[k] = n ? n : qtFV().delete(); if (n) ds.push((TERM[k] ? TERM[k].short : k) + " " + dateY(n)); });
      saveCh({ thi: o }, "ngày thi chung: " + (ds.join(", ") || "không có"));
    };
    $$("[data-mx]", box).forEach(function (b) { b.onclick = function () { var uid = b.getAttribute("data-mx"); mien = mien.filter(function (x) { return x !== uid; }); tx.mien = mien; saveCh({ tx: { mien: mien } }, "bỏ miễn tự xóa: " + uname(uid)); }; });
    $("#qtmadd", box).onclick = function () { var uid = $("#qtma", box).value; if (!uid) return; mien.push(uid); saveCh({ tx: { mien: mien } }, "miễn tự xóa: " + uname(uid)); };
    $("#qttxok", box).onclick = function () {
      var bat = $("#qttx", box).checked, n = Math.max(7, Math.min(365, parseInt($("#qtn", box).value, 10) || 30)), k = Math.max(1, Math.min(90, parseInt($("#qtk", box).value, 10) || 7));
      if (bat && !tx.bat && !confirm("Bật tự xóa: ai không học " + n + " ngày sẽ bị khóa, khóa thêm " + k + " ngày sẽ bị XÓA tiến độ (không khôi phục được). Việc này chạy mỗi lần bạn mở tab Quản trị. Bật?")) return;
      saveCh({ tx: { bat: bat, n: n, k: k, mien: mien } }, "tự xóa " + (bat ? "BẬT" : "tắt") + ": khóa sau " + n + " ngày, xóa sau thêm " + k + " ngày");
    };
  }
  function qtNk(box) {
    var d = new Date(), a = "nk-" + d.getFullYear() + "-" + pad2(d.getMonth() + 1), p = new Date(d.getFullYear(), d.getMonth() - 1, 1), b = "nk-" + p.getFullYear() + "-" + pad2(p.getMonth() + 1);
    box.innerHTML = '<div class="card"><h2>Nhật ký quản trị</h2><p class="sub">Đang tải…</p></div>';
    Promise.all([qtRef("hanco_qt", a).get(), qtRef("hanco_qt", b).get()]).then(function (r) {
      var e = []; r.forEach(function (s) { if (s.exists) e = e.concat(s.data().e || []); });
      e.sort(function (x, y) { return y.t - x.t; }); e = e.slice(0, 300);
      box.innerHTML = '<div class="card"><h2>Nhật ký quản trị</h2><p class="sub">Tháng này và tháng trước (tối đa 300 dòng mới nhất).</p>' + (e.length ? '<div class="qtwrap"><table class="t"><thead><tr><th>Lúc</th><th>Việc</th><th>Mã</th><th>Họ tên</th><th>Chi tiết</th></tr></thead><tbody>' +
        e.map(function (x) { return "<tr><td>" + hm(x.t) + "</td><td>" + esc(x.a) + '</td><td class="num">' + esc(x.m || "") + "</td><td>" + esc(x.n || "") + "</td><td>" + esc(x.c || "") + "</td></tr>"; }).join("") + "</tbody></table></div>" : '<p class="sub">Chưa có việc nào.</p>') + "</div>";
    }, function (e) { box.innerHTML = '<div class="card"><h2>Nhật ký quản trị</h2><p class="tkmsg">' + esc(tkErr(e)) + "</p></div>"; });
  }

  function normalize(s) {
    // tiến độ cũ (trước 26/11/2026) chưa có plans: giữ lộ trình 5 tuần giữa kỳ 3 đang học (bắt đầu S.start, 35 ngày)
    if (s.plans == null && typeof s.start === "number") s.plans = { GK3: { s: s.start, e: s.start + 34, t: 0, x: 0 } };
    if (typeof s.plans !== "object" || Array.isArray(s.plans)) s.plans = {};
    Object.keys(s.plans).forEach(function (k) { var p = s.plans[k]; if (!p || typeof p !== "object" || typeof p.s !== "number" || typeof p.e !== "number") delete s.plans[k]; else { p.t = +p.t || 0; p.x = +p.x || 0; } });
    if (typeof s.lt !== "object" || Array.isArray(s.lt)) s.lt = {};
    Object.keys(s.lt).forEach(function (k) { if (!Array.isArray(s.lt[k]) || s.lt[k].length < 5) delete s.lt[k]; });
    return normalize0(s);
  }
  function normalize0(s) { var b = blank(); Object.keys(b).forEach(function (k) { if (s[k] == null) s[k] = b[k]; }); Object.keys(b.set).forEach(function (k) { if (s.set[k] == null) s.set[k] = b.set[k]; }); ["hard", "pl", "note", "cup", "rec", "meo"].forEach(function (k) { if (typeof s[k] !== "object" || Array.isArray(s[k])) s[k] = {}; }); recNorm(s.rec); return s; }
  // kỷ lục (Bước 7): rec = {hb hạng tuần cao nhất (0 = chưa có), hk tuần đạt hạng đó, pf {ngày: số bài không sai}}
  function recNorm(r) { r.hb = +r.hb > 0 ? +r.hb : 0; r.hk = +r.hk || 0; if (typeof r.pf !== "object" || !r.pf || Array.isArray(r.pf)) r.pf = {}; return r; }

  // ---------- SRS ----------
  // it[id] = [rBox, rDue, wBox, wDue, lapses, introDay]; wBox = -1 when the item has no writing card
  var INT = [0, 1, 3, 7, 14, 30, 60, 120];
  function rec(id) { return S.it[id]; }
  function introduced(id) { return !!S.it[id]; }
  function hasWrite(it) { return it.type === "c" || it.type === "w"; }
  function stamp(id) { (S.itT || (S.itT = {}))[id] = Date.now(); } // giờ chấm gần nhất của mục — dùng khi gộp đồng bộ
  function introduce(id, firstTryOk) {
    var it = ITEM[id], t = today();
    if (S.it[id]) return;
    S.it[id] = [firstTryOk ? 1 : 0, firstTryOk ? t + 1 : t, hasWrite(it) ? 0 : -1, t, 0, t];
    stamp(id);
    addLog("n", 1); addXP(3);
  }
  function grade(id, card, g) { // card 'r' | 'w'; g 0 quên, 1 mờ, 2 rõ
    var r = S.it[id]; if (!r) return;
    var bi = card === "w" ? 2 : 0, t = today();
    if (r[bi] < 0) return;
    stamp(id);
    if (g === 0) { r[bi] = 1; r[bi + 1] = t + 1; r[4]++; }
    else if (g === 1) { r[bi] = Math.max(1, r[bi]); r[bi + 1] = t + 1; }
    else { r[bi] = Math.min(INT.length - 1, r[bi] + 1); r[bi + 1] = t + INT[r[bi]]; }
    addLog("r", 1); addXP(g === 2 ? 2 : g === 1 ? 1 : 0);
  }
  HC.grade = grade; HC.introduce = introduce; HC.introduced = introduced;
  function due(card) {
    var t = today(), bi = card === "w" ? 2 : 0;
    return Object.keys(S.it).filter(function (id) { var r = S.it[id]; return ITEM[id] && r[bi] >= 0 && r[bi + 1] <= t; })
      .sort(function (a, b) { return S.it[a][bi + 1] - S.it[b][bi + 1]; });
  }
  function level(id, card) { var r = S.it[id]; if (!r) return -1; return card === "w" ? r[2] : r[0]; }
  HC.level = level;
  function learnedOf(type) { return Object.keys(S.it).filter(function (id) { return ITEM[id] && ITEM[id].type === type; }).map(function (id) { return ITEM[id]; }); }
  HC.learnedOf = learnedOf;
  // pool for games: CHỈ mục đã học (người dùng yêu cầu 24/11/2026: không lấy chữ chưa học); thiếu thì trò chơi tự khóa (need = số còn thiếu)
  HC.pool = function (type, min) {
    var l = learnedOf(type);
    return { items: l, preview: false, need: Math.max(0, (min || 0) - l.length) };
  };
  // ---------- trò chơi: ưu tiên mục chưa thuộc + ghi nhận đúng/sai ----------
  // chưa thuộc = ôn đúng < 3 lần (bậc < 3) hoặc khi chơi sai nhiều hơn đúng
  function gmOf(id) { return (S.gm || {})[id] || [0, 0, 0]; }
  function isWeak(id) { var r = S.it[id], g = gmOf(id); return !r || r[0] < 3 || g[1] > g[0]; }
  function weakW(id) { var r = S.it[id] || [0, 0, 0, 0, 0], g = gmOf(id); return Math.max(1, 1 + (3 - Math.min(r[0], 3)) + Math.min(r[4], 4) * 0.5 + g[1] * 2 - g[0] * 0.5); }
  function wpick(a, n) { // chọn n mục không lặp, mục có trọng số cao dễ được chọn hơn
    var pool = a.slice(), out = [];
    while (out.length < n && pool.length) {
      var tot = 0, k, x = 0; pool.forEach(function (it) { tot += weakW(it.id); });
      var rnd = Math.random() * tot;
      for (k = 0; k < pool.length; k++) { x += weakW(pool[k].id); if (rnd < x) break; }
      out.push(pool.splice(Math.min(k, pool.length - 1), 1)[0]);
    }
    return out;
  }
  var WEAK_SHARE = 0.7; // ~70% mục chưa thuộc, ~30% mục đã thuộc
  HC.isWeak = isWeak;
  HC.pickWeak = function (items, n) {
    var weak = items.filter(function (it) { return isWeak(it.id); }), strong = items.filter(function (it) { return !isWeak(it.id); });
    n = Math.min(n, items.length);
    var nw = Math.min(weak.length, Math.round(n * WEAK_SHARE));
    if (strong.length < n - nw) nw = Math.min(weak.length, n - strong.length);
    return shuffle(wpick(weak, nw).concat(pick(strong, n - nw)));
  };
  HC.pickOne = function (items) {
    var weak = items.filter(function (it) { return isWeak(it.id); }), strong = items.filter(function (it) { return !isWeak(it.id); });
    if (weak.length && (!strong.length || Math.random() < WEAK_SHARE)) return wpick(weak, 1)[0];
    return strong[Math.floor(Math.random() * strong.length)];
  };
  // ghi nhận một lượt chơi: mỗi mục tính tối đa 1 lần đúng + 1 lần sai mỗi lượt.
  // Sai = chưa thuộc: thẻ đọc lùi 1 bậc, ôn lại muộn nhất ngày mai, +1 lần quên. Đúng: chỉ ghi nhận (không đẩy lịch ôn xa hơn).
  HC.gameRec = function () {
    var okSeen = {}, badSeen = {}, bad = [], good = [];
    function g(id) { var t = today(), x = (S.gm || (S.gm = {}))[id] || (S.gm[id] = [0, 0, t]); x[2] = t; return x; }
    return {
      ok: function (it) { if (!it || !S.it[it.id] || okSeen[it.id]) return; okSeen[it.id] = 1; good.push(it); g(it.id)[0]++; save(); },
      bad: function (it) {
        if (!it || !S.it[it.id] || badSeen[it.id]) return; badSeen[it.id] = 1; bad.push(it);
        var r = S.it[it.id], t = today();
        g(it.id)[1]++;
        r[0] = Math.max(Math.min(r[0], 1), r[0] - 1); r[1] = Math.min(r[1], t + 1); r[4]++;
        stamp(it.id); save();
      },
      bad_: bad, good_: good
    };
  };
  // trò chơi của kho khó: CHỈ ghi đúng/sai vào S.gm — KHÔNG đổi lịch ôn (S.it); ghi được cả mục chưa học (kho khó thêm từ Tra cứu)
  HC.gmRec = function () {
    var okSeen = {}, badSeen = {}, bad = [], good = [];
    function g(id) { var t = today(), x = (S.gm || (S.gm = {}))[id] || (S.gm[id] = [0, 0, t]); x[2] = t; return x; }
    var r = {
      ok: function (it) { if (!it || !ITEM[it.id] || okSeen[it.id]) return; okSeen[it.id] = 1; good.push(it); g(it.id)[0]++; save(); },
      bad: function (it) { if (!it || !ITEM[it.id] || badSeen[it.id]) return; badSeen[it.id] = 1; bad.push(it); g(it.id)[1]++; save(); },
      // "Tôi viết đúng mà": đổi lần sai vừa ghi thành đúng
      fix: function (it) {
        if (it && badSeen[it.id]) { delete badSeen[it.id]; var k = bad.indexOf(it); if (k >= 0) bad.splice(k, 1); var x = g(it.id); x[1] = Math.max(0, x[1] - 1); }
        r.ok(it);
      },
      bad_: bad, good_: good, kho: true
    };
    return r;
  };
  HC.hard = function () {
    return Object.keys(S.it).filter(function (id) { return ITEM[id] && S.it[id][4] >= 2; })
      .sort(function (a, b) { return S.it[b][4] - S.it[a][4]; }).map(function (id) { return ITEM[id]; });
  };
  // ---------- kho khó (người học tự thêm, khác HC.hard() = chữ quên ≥ 2 lần) + ghi chú ----------
  function isHard(id) { return (S.hard[id] || 0) > 0; }
  HC.isHard = isHard;
  HC.toggleHard = function (id, on) {
    if (on == null) on = !isHard(id);
    var t = Date.now();
    S.hard[id] = on ? t : -t;
    // bỏ khỏi kho → bỏ luôn khỏi mọi playlist (đánh dấu "đã bỏ", để thêm lại vào kho sau này không tự hiện lại ở playlist cũ)
    if (!on) Object.keys(S.pl).forEach(function (k) { var p = S.pl[k]; if (p.ids[id] > 0) p.ids[id] = -t; });
    save();
    return on;
  };
  HC.hardList = function () {
    return Object.keys(S.hard).filter(function (id) { return S.hard[id] > 0 && ITEM[id]; })
      .sort(function (a, b) { return S.hard[b] - S.hard[a]; }).map(function (id) { return ITEM[id]; });
  };
  // ---------- playlist của kho khó: S.pl[plId] = {n, nt, x, ids}; mục hiển thị = ids ∩ kho khó ----------
  var PL_MAX = 40;
  function plName(s) { return String(s || "").replace(/\s+/g, " ").trim().slice(0, PL_MAX); }
  function plLive(k) { var p = S.pl[k]; return p && !p.x ? p : null; }
  function plHas(k, id) { var p = plLive(k); return !!p && p.ids[id] > 0 && isHard(id); }
  function plIds(k) {
    var p = plLive(k); if (!p) return [];
    return Object.keys(p.ids).filter(function (id) { return p.ids[id] > 0 && isHard(id) && ITEM[id]; })
      .sort(function (a, b) { return p.ids[b] - p.ids[a]; });
  }
  HC.plHas = plHas; HC.plIds = plIds;
  HC.plList = function () {
    return Object.keys(S.pl).filter(plLive).map(function (k) { return { id: k, n: S.pl[k].n, ids: plIds(k) }; })
      .sort(function (a, b) { return a.n.localeCompare(b.n, "vi", { numeric: true }); });
  };
  HC.plCreate = function (name) {
    name = plName(name); if (!name) return null;
    var t = Date.now(), k = "p" + t.toString(36) + Math.random().toString(36).slice(2, 7);
    S.pl[k] = { n: name, nt: t, x: 0, ids: {} }; save();
    return k;
  };
  HC.plRename = function (k, name) { var p = plLive(k); name = plName(name); if (!p || !name) return false; p.n = name; p.nt = Date.now(); save(); return true; };
  HC.plDelete = function (k) { var p = plLive(k); if (!p) return; p.x = Date.now(); save(); };
  // thêm / bớt nhiều mục một lần; thêm vào playlist thì tự vào kho khó
  HC.plSet = function (k, ids, on) {
    var p = plLive(k); if (!p) return 0;
    var t = Date.now(), n = 0;
    ids.forEach(function (id) {
      if (!ITEM[id] || plHas(k, id) === on) return;
      p.ids[id] = on ? t : -t; n++;
      if (on && !isHard(id)) S.hard[id] = t;
    });
    if (n) save();
    return n;
  };
  HC.plToggle = function (k, id, on) { if (on == null) on = !plHas(k, id); HC.plSet(k, [id], on); return on; };
  var NOTE_MAX = 2000;
  // k = "meo" → Ô 1 «Cách nhớ» (S.meo, mọi người thấy — Bước 8); khác → Ô 2 «Ghi chú khác» (S.note cũ, chỉ chủ nhân thấy)
  function noteOf(id, k) { var n = (k === "meo" ? S.meo : S.note)[id]; return n && n[0] ? String(n[0]) : ""; }
  HC.noteOf = noteOf;
  // văn bản ghi chú: chữ thường (ghi chú cũ) hoặc HTML đã lọc bằng noteClean (ô soạn có định dạng). Rỗng = đã xóa.
  HC.setNote = function (id, text, k) {
    var h = noteClean(text).replace(/(<br>|<div><br><\/div>|\s)+$/, "");
    if (!noteTxt(h).replace(/[\s ]+/g, "")) h = "";
    if (h.length > NOTE_HTML_MAX) return false;
    if (k === "meo") {
      var o = S.meo[id];
      if (o ? String(o[0]) === h : !h) return true; // không đổi gì → không đăng lại
      S.meo[id] = [h, Date.now(), o ? +o[2] || 0 : 0]; save(); meoSoon(); return true;
    }
    S.note[id] = [h, Date.now()]; save(); return true;
  };

  // ---------- XP, streak, log, badges ----------
  function addLog(k, n) { var t = today(); var l = S.log[t] || (S.log[t] = { n: 0, r: 0, x: 0 }); l[k] = (l[k] || 0) + n; }
  function addXP(n, el) {
    if (!n) return; var l0 = lvl().l; S.xp += n; addLog("x", n);
    var t = today();
    if (S.streak.d !== t) { S.streak.c = (S.streak.d === t - 1) ? S.streak.c + 1 : 1; S.streak.d = t; }
    if (n > 0) xpShow(n, el, lvl().l > l0 ? lvl().l : 0); // MỌI lần cộng điểm đều hiện "+N XP" + âm thanh (người dùng yêu cầu 26/11/2026)
  }
  HC.addXP = function (n, el) { addXP(n, el); };
  function lvl() { var x = S.xp, l = 1, need = 100; while (x >= need) { x -= need; l++; need = Math.round(need * 1.15); } return { l: l, cur: x, need: need }; }
  var BADGES = [ // thành tích đặc biệt 1 cấp (các huy hiệu cũ khác nay là cấp của nhóm huy hiệu — BFAM bên dưới)
    { id: "c594", g: "通", t: "Xong chữ thông dụng", ok: function () { return QC.slice(0, COMMON_C).every(function (c) { return introduced(c.id); }); } },
    { id: "w492", g: "詞", t: "Xong từ thông dụng", ok: function () { return QW.slice(0, COMMON_W).every(function (w) { return introduced(w.id); }); } },
    { id: "r214", g: "部", t: "Đủ 214 bộ", ok: function () { return learnedOf("r").length >= 214; } }
  ];
  // ---------- HUY HIỆU NHIỀU CẤP + KỶ LỤC (Bước 7, 27/11/2026) ----------
  // Mỗi nhóm huy hiệu có nhiều cấp (kiểu Duolingo). S.badges[id] = ngày nhận (giữ id huy hiệu cũ: s7, s30, c100, c300, c1222, w50, exam
  // là các cấp tương ứng → ngày đã nhận không mất). BADGES (ở trên) còn lại = thành tích đặc biệt 1 cấp.
  function streakMax(s) { // chuỗi dài nhất: số ngày liên tiếp có học / ôn / XP trong nhật ký (không nhỏ hơn chuỗi hiện tại)
    s = s || S; var ds = [], best = 0, run = 0, prev = null;
    Object.keys(s.log || {}).forEach(function (k) { var l = s.log[k] || {}; if ((+l.x || 0) + (+l.n || 0) + (+l.r || 0) > 0) ds.push(+k); });
    ds.sort(function (a, b) { return a - b; }).forEach(function (d) { run = prev != null && d === prev + 1 ? run + 1 : 1; prev = d; if (run > best) best = run; });
    return Math.max(best, +((s.streak || {}).c) || 0);
  }
  function examBest() { var b = 0; Object.keys(S.best || {}).forEach(function (k) { if (k.indexOf("exam") === 0 && typeof S.best[k] === "number" && S.best[k] > b) b = S.best[k]; }); return b; }
  function lvTo(a, all) { return a.filter(function (x) { return x < all; }).concat([all]); }
  function pfSum() { var n = 0, p = (S.rec && S.rec.pf) || {}; Object.keys(p).forEach(function (d) { n += +p[d] || 0; }); return n; }
  var BFAM = [
    { id: "st", g: "火", t: "Chuỗi ngày", u: "ngày", lv: function () { return [3, 7, 14, 30, 60, 100, 180, 365]; }, old: { 7: "s7", 30: "s30" }, val: function () { return streakMax(); } },
    { id: "xp", g: "經", t: "Kinh nghiệm", u: "XP", lv: function () { return [100, 500, 1000, 2500, 5000, 10000, 25000, 50000]; }, val: function () { return S.xp || 0; } },
    { id: "ch", g: "字", t: "Chữ đã học", u: "chữ", lv: function () { return lvTo([50, 100, 300, 600, 1000], D.chars.length); }, old: { 100: "c100", 300: "c300" }, het: "c1222", val: function () { return learnedOf("c").length; } },
    { id: "tu", g: "詞", t: "Từ đã học", u: "từ", lv: function () { return lvTo([50, 100, 300, 600], D.words.length); }, het: "tuhet", val: function () { return learnedOf("w").length; } },
    { id: "vi", g: "筆", t: "Viết đúng", u: "lần", lv: function () { return [10, 50, 100, 300, 1000, 3000]; }, old: { 50: "w50" }, val: function () { return +S.best.writeOk || 0; } },
    { id: "th", g: "試", t: "Thi thử", u: "điểm", lv: function () { return [50, 65, 80, 90, 100]; }, old: { 80: "exam" }, val: examBest },
    { id: "cu", g: "冠", t: "Top 3 tuần", u: "lần", lv: function () { return [1, 3, 5, 10, 25, 52]; }, val: function () { return Object.keys(S.cup || {}).length; } }
  ];
  // các cấp của 1 nhóm: [{th mốc, id, on đã đạt, v số hiện có}] — đã nhận rồi thì giữ (dù số hiện tại thấp hơn)
  function famLv(f) {
    var ls = f.lv(), v = 0; try { v = f.val(); } catch (e) { }
    return ls.map(function (th, i) {
      var id = i === ls.length - 1 && f.het ? f.het : (f.old && f.old[th]) || f.id + th;
      return { th: th, id: id, on: !!S.badges[id] || v >= th, v: v };
    });
  }
  function famN(f) { return famLv(f).filter(function (x) { return x.on; }).length; }
  function checkBadges() {
    if (!D) return;
    var got = [], t = today();
    BFAM.forEach(function (f) { famLv(f).forEach(function (x, i) { if (x.on && !S.badges[x.id]) { S.badges[x.id] = t; got.push(f.t + " cấp " + (i + 1)); } }); });
    BADGES.forEach(function (b) { if (!S.badges[b.id] && b.ok()) { S.badges[b.id] = t; got.push(b.t); } });
    if (got.length === 1) toast("Huy hiệu mới: " + got[0]);
    else if (got.length) toast("Nhận " + got.length + " huy hiệu mới — xem ở Xếp hạng → Hồ sơ của tôi");
  }
  HC.checkBadges = checkBadges;
  // bài không sai câu nào (trò chơi xong không sai mục nào / thi thử 100 điểm) — games.js gọi
  HC.perfect = function () { var t = today(); recNorm(S.rec); S.rec.pf[t] = (+S.rec.pf[t] || 0) + 1; };
  // nhật ký XP: tổng các kỳ (chỉ tính từ ngày r0 nếu bị đặt lại XP bảng xếp hạng) + kỷ lục (tính trên cả nhật ký)
  function perKey(p, d) { if (p === "w" || p === "wp") return weekStart(d) - (p === "wp" ? 7 : 0); var x = new Date(d * 864e5), y = x.getUTCFullYear(), m = x.getUTCMonth(); return p === "m" ? y * 12 + m : p === "q" ? y * 4 + Math.floor(m / 3) : y; }
  function perName(p, k) { return p === "m" ? "Tháng " + (k % 12 + 1) + "/" + Math.floor(k / 12) : p === "q" ? "Quý " + (k % 4 + 1) + "/" + Math.floor(k / 4) : p === "y" ? "Năm " + k : "Tuần " + dateOf(k) + " – " + dateY(k + 6); }
  function xpStat(r0) {
    var t0 = today(), P = ["w", "wp", "m", "q", "y"], K = {}, V = {}, all = 0, xd = 0, xm = 0, wk = {}, xk = 0;
    P.forEach(function (p) { K[p] = perKey(p, t0); V[p] = 0; });
    Object.keys(S.log || {}).forEach(function (k) {
      var d = +k, x = +((S.log[k] || {}).x) || 0; if (x <= 0 || d > t0) return;
      if (x > xd) xd = x;
      var w = weekStart(d); wk[w] = (wk[w] || 0) + x; if (wk[w] > xk) xk = wk[w];
      if (r0 && d < r0) return;
      all += x; if (d >= t0 - 6 && x > xm) xm = x;
      P.forEach(function (p) { if (perKey(p === "wp" ? "w" : p, d) === K[p]) V[p] += x; });
    });
    return { K: K, V: V, all: all, xd: xd, xk: xk, xm: xm };
  }
  function myRecs() {
    var s = xpStat(0);
    return { sm: streakMax(), xd: s.xd, xk: s.xk, hb: (S.rec && S.rec.hb) || 0, hk: (S.rec && S.rec.hk) || 0, ex: examBest(), pf: pfSum() };
  }

  // ---------- BẢNG XẾP HẠNG (Bước 7, 27/11/2026) ----------
  // Firestore hanco_bxh/tong = {u {uid: dòng}, an {uid: 1 ẩn tay | 2 đang khóa}, rs {uid: ngày đặt lại}} — CẢ bảng 1 tài liệu: mở bảng = 1 lượt
  // đọc (đệm 3 phút); mỗi người chỉ sửa dòng của mình (luật kiểm), ≤ 1 lần/15 phút khi đang học + ngay khi rời app (chỉ khi có gì mới).
  // Dòng = {ten tên hiển thị (KHÔNG BAO GIỜ họ tên thật), xp, w/wp/m/q/y [mã kỳ, XP] (tuần này / tuần trước / tháng / quý / năm),
  // sc + sd chuỗi hiện tại + ngày cuối, sm chuỗi dài nhất, lv cấp, bd {nhóm huy hiệu: cấp, sp: số thành tích đặc biệt}, cp [số cúp vàng,
  // bạc, đồng], rc {xd, xk, ex, hb, pf} kỷ lục, xm XP nhiều nhất 1 ngày trong 7 ngày (quản trị soát XP lạ), r ngày đặt lại, upd}.
  // Bị quản trị đặt lại XP: chỉ tính XP từ ngày đặt lại (XP + cấp thật trong S KHÔNG đổi). Cúp tuần: hanco_bxh/c<thứ Hai> = {k, e [{u uid, v XP}]
  // giảm dần, t}, người đầu tiên mở app sau 12 giờ trưa thứ Hai tuần sau chốt (luật kiểm 3 người đầu khớp bảng) → ai trong top 3 tự ghi
  // vào S.cup; hạng tuần cao nhất vào S.rec. localStorage MỚI: hanco-bxh-gui (lần ghi dòng gần nhất), hanco-bxh-cup (tuần đã kiểm cúp),
  // hanco-qt-xpla (ngưỡng XP lạ của máy quản trị). Không thuộc S.
  var BXH = { d: null, t: 0, u: "", rs: 0, err: "", sending: false, timer: null, cup: {}, cupTry: {} }, BXH_LS = "hanco-bxh-gui", BXH_CUP = "hanco-bxh-cup", BXH_GAP = 15 * 60e3, BXH_TTL = 180e3;
  var MEDAL = ["", "vàng", "bạc", "đồng"];
  HC.bxh = BXH;
  function bxhRef(d) { return fb.db.collection("hanco_bxh").doc(d || "tong"); }
  function bxhOk() { return !!(TK_GATE && fb.on && fb.user && tk.st === "ok" && fb.ref && (isAdmin() || (tk.prof && tk.prof.ten))); }
  // ---------- HAI VAI CỦA QUẢN TRỊ VIÊN (người dùng yêu cầu 27/11/2026) ----------
  // Với người khác, quản trị viên hiện bằng 1 trong 2 vai: VAI QUẢN TRỊ (tên tq, mã = ADMIN_UID, ảnh hanco_anh/{ADMIN_UID}) hoặc VAI NGƯỜI HỌC
  // (tên th, mã riêng ngẫu nhiên hv trông như uid thường → không ai nối được với quản trị, ảnh hanco_anh/{hv}). Chọn theo từng chỗ:
  // bx = bảng xếp hạng + cúp tuần (qt | hv | an = ẩn hẳn, xóa dòng), me = cách nhớ chung (qt | hv).
  // MỌI SỐ LIỆU LÀ MỘT (người dùng chốt): XP, cấp, chuỗi, huy hiệu, cúp đều tính từ S của quản trị — đổi vai chỉ đổi tên + ảnh + mã dòng.
  // Cấu hình ở hanco_qt/vai (chỉ quản trị đọc; luật đọc hv để cho quản trị ghi ảnh / cách nhớ dưới mã đó) + bản trên máy VAI_LS. Không thuộc S.
  // Máy chưa đọc được cấu hình (VAI.ld) thì KHÔNG ghi dòng bảng xếp hạng / cách nhớ (tránh ghi nhầm vai).
  var VAI_LS = "hanco-qt-vai", VAI_DEF = { tq: "Quản trị viên", th: "", hv: "", bx: "qt", me: "qt" }, VAI = { ld: 0, job: null, busy: false };
  function vaiGet() {
    var o = jget(VAI_LS), r = {};
    Object.keys(VAI_DEF).forEach(function (k) { r[k] = o[k] != null && o[k] !== "" ? String(o[k]) : VAI_DEF[k]; });
    if (!r.th || !r.hv) { if (r.bx === "hv") r.bx = "qt"; if (r.me === "hv") r.me = "qt"; } // chưa đặt tên vai người học → dùng vai quản trị
    if (["qt", "hv", "an"].indexOf(r.bx) < 0) r.bx = "qt"; if (["qt", "hv"].indexOf(r.me) < 0) r.me = "qt";
    return r;
  }
  function vaiPut(c) { var o = {}; Object.keys(VAI_DEF).forEach(function (k) { o[k] = c[k] || ""; }); lsSet(VAI_LS, JSON.stringify(o)); }
  function vaiRef() { return fb.db.collection("hanco_qt").doc("vai"); }
  function vaiLoad() {
    if (!isAdmin() || !fb.db) return Promise.resolve(null);
    if (VAI.job) return VAI.job;
    return (VAI.job = vaiRef().get().then(function (s) {
      VAI.job = null; if (!isAdmin()) return null;
      var d = s.exists ? s.data() : {}, c = {}; Object.keys(VAI_DEF).forEach(function (k) { c[k] = d[k] || ""; });
      vaiPut(c); VAI.ld = 1; VAI.t = Date.now(); renderStats();
      setTimeout(function () { bxhSend(true); meoPub(); }, 0);
      return vaiGet();
    }, function () { VAI.job = null; return null; }));
  }
  // máy khác của quản trị có thể vừa đổi vai → đọc lại cấu hình mỗi 30 phút (1 lượt đọc, chỉ quản trị)
  function vaiReady() { if (!isAdmin()) return true; if (!VAI.ld || Date.now() - (VAI.t || 0) > 1800e3) vaiLoad(); return !!VAI.ld && !VAI.busy; }
  function vaiNewId() { // mã vai người học: 28 ký tự chữ + số ngẫu nhiên, giống uid Firebase
    var A = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789", b = new Uint8Array(28), s = "";
    try { crypto.getRandomValues(b); } catch (e) { for (var j = 0; j < 28; j++) b[j] = Math.floor(Math.random() * 256); }
    for (var i = 0; i < 28; i++) s += A.charAt(b[i] % 62);
    return s;
  }
  // mã của mình ở chỗ p ("bx" bảng xếp hạng | "me" cách nhớ): người học = uid; quản trị theo vai đã chọn; "" = quản trị đang ẩn khỏi bảng
  function myKey(p) { var u = fb.user; if (!u) return ""; if (!isAdmin()) return u.uid; var c = vaiGet(); return c[p] === "an" ? "" : c[p] === "hv" ? c.hv : u.uid; }
  function myName(p) { if (!isAdmin()) return String((tk.prof && tk.prof.ten) || ""); var c = vaiGet(); return c[p] === "hv" ? c.th : c.tq; }
  function isMine(uid) { var u = fb.user; if (!u || !uid) return false; return uid === u.uid || (isAdmin() && uid === vaiGet().hv); }
  function myKeys() { var u = fb.user; if (!u) return []; var c = isAdmin() ? vaiGet() : {}; return c.hv ? [u.uid, c.hv] : [u.uid]; }
  HC.myKey = myKey; HC.isMine = isMine;
  function bxhTen() { return myName("bx"); }
  function bxhRow() {
    var r0 = BXH.u === fb.user.uid ? +BXH.rs || 0 : 0, st = xpStat(r0), xp = r0 ? st.all : Math.max(S.xp || 0, st.all), bd = {}, cp = [0, 0, 0];
    function pv(p) { return [st.K[p], Math.min(st.V[p], xp)]; }
    BFAM.forEach(function (f) { var n = famN(f); if (n) bd[f.id] = n; });
    var sp = BADGES.filter(function (b) { return S.badges[b.id]; }).length; if (sp) bd.sp = sp;
    Object.keys(S.cup || {}).forEach(function (k) { var v = S.cup[k]; if (v >= 1 && v <= 3) cp[v - 1]++; });
    var rc = { xd: st.xd, xk: st.xk, ex: examBest(), hb: (S.rec && S.rec.hb) || 0, pf: pfSum() };
    var row = { ten: bxhTen(), xp: xp, w: pv("w"), wp: pv("wp"), m: pv("m"), q: pv("q"), y: pv("y"), sc: +S.streak.c || 0, sd: +S.streak.d || 0, sm: streakMax(), lv: lvl().l, bd: bd, cp: cp, rc: rc, xm: st.xm, r: r0 };
    var me = myKey("bx") || fb.user.uid, av = avMyV(me), old = BXH.u === fb.user.uid && BXH.d && BXH.d.u && BXH.d.u[me]; // a = phiên bản ảnh đại diện (27/11/2026); quản trị: ảnh của vai đang hiện
    if (old && +old.a > av) av = +old.a;
    if (av > 0) row.a = av;
    var mo = avmLocal(me); if (old && +old.mt > (+mo.t || 0)) mo = { m: old.mc, s: old.ms, t: old.mt }; // ảnh mặc định (27/11/2026): lần chọn mới nhất thắng
    var mcv = mo.m != null ? +mo.m : old && typeof old.mc === "number" ? old.mc : -1, msv = mo.s != null ? (mo.s ? 1 : 0) : old && old.ms ? 1 : 0;
    if (avmOk(mcv)) row.mc = mcv; if (msv) row.ms = 1; if (+mo.t > 0) row.mt = +mo.t;
    return row;
  }
  function bxhLoad(force) {
    var uid = fb.user && fb.user.uid;
    if (!force && BXH.d && BXH.u === uid && Date.now() - BXH.t < BXH_TTL) return Promise.resolve(BXH.d);
    return bxhRef().get().then(function (s) {
      BXH.d = s.exists ? s.data() : null; BXH.t = Date.now(); BXH.u = uid; BXH.err = s.exists ? "" : "none";
      BXH.rs = BXH.d && BXH.d.rs && +BXH.d.rs[myKey("bx") || uid] || 0;
      try { avSeen(); } catch (e) { }
      try { if (avmEnsure()) setTimeout(function () { bxhSend(true); }, 0); } catch (e) { }
      try { vaiTidy(); } catch (e) { }
      return BXH.d;
    }, function (e) { BXH.err = e && e.code === "permission-denied" ? "denied" : "net"; throw e; });
  }
  // ghi dòng của mình: chỉ khi khác lần trước; force = bỏ qua nhịp 15 phút (rời app / ẩn màn hình / chốt cúp)
  function bxhSend(force, again) {
    if (!bxhOk() || BXH.sending) return Promise.resolve(false);
    var u = fb.user, row;
    if (!vaiReady()) return Promise.resolve(false); // quản trị: chưa biết đang hiện vai nào → chưa ghi
    var key = myKey("bx"); if (!key) return Promise.resolve(false); // quản trị đang ẩn khỏi bảng
    if (!avKnown(key) && !(BXH.d && BXH.u === u.uid)) { avMineCheck(key); return Promise.resolve(false); } // chưa biết phiên bản ảnh: chờ, không ghi mất cột a
    try { row = bxhRow(); } catch (e) { return Promise.resolve(false); }
    if (!row.ten) return Promise.resolve(false);
    var sig = JSON.stringify(row), g = jget(BXH_LS); if (g.u !== key) g = {};
    if (sig === g.h) return Promise.resolve(true);
    var wait = BXH_GAP - (Date.now() - (+g.t || 0));
    if (!force && wait > 0) { if (!BXH.timer) BXH.timer = setTimeout(function () { BXH.timer = null; bxhSend(false); }, wait + 1000); return Promise.resolve(false); }
    clearTimeout(BXH.timer); BXH.timer = null; BXH.sending = true;
    var FS = firebase.firestore, val = JSON.parse(sig), job;
    try { val.upd = FS.FieldValue.serverTimestamp(); job = bxhRef().update(new FS.FieldPath("u", key), val); } catch (e) { BXH.sending = false; return Promise.resolve(false); }
    return job.then(function () {
      BXH.sending = false;
      lsSet(BXH_LS, JSON.stringify({ u: key, t: Date.now(), h: sig }));
      if (BXH.d && BXH.u === u.uid) { BXH.d.u = BXH.d.u || {}; BXH.d.u[key] = JSON.parse(sig); }
      return true;
    }, function (e) {
      BXH.sending = false;
      // bị từ chối: có thể quản trị vừa đặt lại XP (cần ghi đúng ngày đặt lại) → đọc lại bảng rồi thử đúng 1 lần
      if (!again && e && e.code === "permission-denied" && fb.user === u) return bxhLoad(true).then(function () { return bxhSend(true, true); }, function () { return false; });
      lsSet(BXH_LS, JSON.stringify({ u: key, t: Date.now(), h: g.h || "" })); // chờ đủ nhịp rồi mới thử lại
      return false;
    });
  }
  HC.bxhSend = bxhSend;
  // ---- hai vai của quản trị: dọn dòng thừa, đổi vai, đổi tên ----
  // dòng của các mã khác của mình (vai không còn hiện trên bảng) → xóa. Gọi sau mỗi lần tải bảng (không tốn thêm lượt đọc).
  function vaiTidy() {
    if (!isAdmin() || !VAI.ld || !BXH.d || BXH.u !== fb.user.uid) return Promise.resolve(false);
    var U = BXH.d.u || {}, cur = myKey("bx"), stale = myKeys().filter(function (k) { return k !== cur && U[k]; });
    if (!stale.length) return Promise.resolve(false);
    var FS = firebase.firestore, args = [];
    stale.forEach(function (k) { args.push(new FS.FieldPath("u", k), FS.FieldValue.delete()); });
    var ref = bxhRef();
    return ref.update.apply(ref, args).then(function () { stale.forEach(function (k) { delete U[k]; }); return true; }, function () { return false; });
  }
  // bảng xếp hạng + cúp tuần: hiện vai quản trị (qt) / vai người học (hv) / ẩn (an)
  function vaiSetBx(mode) {
    if (!isAdmin() || !VAI.ld) return Promise.reject(new Error("Chưa đọc được cài đặt vai. Kiểm tra mạng rồi thử lại."));
    var c = vaiGet(); if (mode === "hv" && !(c.th && c.hv)) return Promise.reject(new Error("Hãy đặt tên vai người học trước."));
    VAI.busy = true;
    return vaiRef().set({ bx: mode }, { merge: true }).then(function () {
      c.bx = mode; vaiPut(c); lsDel(BXH_LS);
      return bxhLoad(true);
    }).then(function () { return vaiTidy(); }).then(function () {
      VAI.busy = false; BXH.rs = BXH.d && BXH.d.rs && +BXH.d.rs[myKey("bx") || fb.user.uid] || 0;
      return mode === "an" ? true : bxhSend(true);
    }, function (e) { VAI.busy = false; throw e; });
  }
  // cách nhớ chung: chuyển các cách nhớ đã đăng sang vai mới (giữ nguyên nội dung + số sao người khác đã chấm; tạo bản mới + xóa bản cũ trong cùng 1 lô)
  function vaiMoveMeo(oldK, newK, ten) {
    if (!oldK || !newK || oldK === newK) return Promise.resolve(0);
    var FV = firebase.firestore.FieldValue;
    return meoCol().where("uid", "==", oldK).get().then(function (q) {
      var docs = []; q.forEach(function (d) { docs.push(d); });
      var p = Promise.resolve();
      for (var i = 0; i < docs.length; i += 200) (function (part) {
        p = p.then(function () {
          var b = fb.db.batch();
          part.forEach(function (d) { var x = d.data(); b.set(meoCol().doc(x.id + "_" + newK), { id: x.id, uid: newK, ten: ten, h: x.h, upd: FV.serverTimestamp(), r: x.r || {} }); b.delete(d.ref); });
          return b.commit();
        });
      })(docs.slice(i, i + 200));
      MEO.cache = {};
      return p.then(function () { return docs.length; });
    });
  }
  function vaiSetMe(mode) {
    if (!isAdmin() || !VAI.ld) return Promise.reject(new Error("Chưa đọc được cài đặt vai. Kiểm tra mạng rồi thử lại."));
    var c = vaiGet(); if (mode === "hv" && !(c.th && c.hv)) return Promise.reject(new Error("Hãy đặt tên vai người học trước."));
    var oldK = myKey("me");
    return meoPub(true).then(function () {
      VAI.busy = true; MEO.busy = true;
      var back = c.me === mode ? null : c.me; // vai cũ (để trả về nếu chuyển lỗi)
      var n = c; n.me = mode;
      var newK = mode === "hv" ? c.hv : fb.user.uid, ten = mode === "hv" ? c.th : c.tq;
      // lưu vai trước rồi chuyển; chuyển lỗi → trả cài đặt về vai cũ (không để cài đặt một đằng, cách nhớ một nẻo)
      return vaiRef().set({ me: mode }, { merge: true }).then(function () {
        vaiPut(n);
        return vaiMoveMeo(oldK, newK, ten).catch(function (e) {
          if (!back) throw e;
          n.me = back; vaiPut(n);
          return vaiRef().set({ me: back }, { merge: true }).then(function () { throw e; }, function () { throw e; });
        });
      });
    }).then(function (k) { VAI.busy = false; MEO.busy = false; MEO.gone = {}; return k; }, function (e) { VAI.busy = false; MEO.busy = false; throw e; });
  }
  // đổi tên 1 vai (w = "tq" | "th"); vai người học đặt tên lần đầu → tạo mã riêng hv (lưu trước khi dùng: luật đọc hv từ hanco_qt/vai)
  function vaiSetName(w, t) {
    t = nameNorm(t);
    if (t.length < 2 || t.length > 30) return Promise.reject(new Error("Tên dài 2–30 ký tự."));
    if (!isAdmin() || !VAI.ld) return Promise.reject(new Error("Chưa đọc được cài đặt vai. Kiểm tra mạng rồi thử lại."));
    var c = vaiGet(), o = {}, other = w === "tq" ? c.th : c.tq;
    if (other && nameKey(other) === nameKey(t)) return Promise.reject(new Error("Hai vai phải có tên khác nhau."));
    o[w] = t; if (w === "th" && !c.hv) o.hv = vaiNewId();
    // tên không trùng tên hiển thị của người khác trên bảng xếp hạng (tải bảng nếu chưa có — 1 lượt đọc, giữ 5 phút)
    return (bxhOk() ? bxhLoad(false).catch(function () { return null; }) : Promise.resolve(null)).then(function () {
      var U = (BXH.d && BXH.d.u) || {}, dup = Object.keys(U).filter(function (k) { return !isMine(k) && U[k] && nameKey(U[k].ten || "") === nameKey(t); })[0];
      if (dup) throw new Error("Đã có người học dùng tên hiển thị này trên bảng xếp hạng. Hãy chọn tên khác.");
      return vaiRef().set(o, { merge: true });
    }).then(function () {
      Object.keys(o).forEach(function (k) { c[k] = o[k]; }); vaiPut(c);
      var on = w === "tq" ? "qt" : "hv";
      if (c.bx === on) bxhSend(true);
      if (c.me === on) meoRename();
      renderStats();
      return t;
    });
  }
  try { addEventListener("pagehide", function () { bxhSend(true); }); document.addEventListener("visibilitychange", function () { if (document.hidden) bxhSend(true); else bxhCupCheck(); }); } catch (e) { }
  // ---------- ẢNH ĐẠI DIỆN (người dùng yêu cầu 27/11/2026) ----------
  // hanco_anh/{uid} = {d ảnh (data URL webp, máy không hỗ trợ thì jpeg; vuông AV_PX px, cắt giữa), v phiên bản (ms lúc đổi), upd giờ máy chủ}.
  // Mỗi người tự tải ảnh của mình. ĐỔI ảnh = ghi đè cả tài liệu → ảnh cũ mất luôn. KHÔNG có nút gỡ ảnh (người dùng yêu cầu); chỉ quản trị
  // xóa (khi xóa người). Thành viên "ok" đọc. Dòng bảng xếp hạng có a = phiên bản ảnh → máy khác chỉ đọc lại ảnh khi a đổi; ảnh đã tải giữ ở
  // Cache Storage AV_C (không bắt đầu bằng "hanco-" → không bị xóa khi phát hành). localStorage AV_LS = {uid: phiên bản ảnh của mình, 0 = chưa có}.
  // Không thuộc S. Chưa có ảnh → chữ cái đầu của tên hiển thị trên nền tròn.
  var AV_LS = "hanco-anh", AV_C = "anh-v1", AV_PX = 384, AV_MAX = 190000, AV_EST = 40000, AV = { mem: {}, job: {}, mine: {} };
  var AV_BG = ["#b5523b", "#3b6fb5", "#3b8a57", "#8a5ab5", "#a0782c", "#2f8c99", "#a5486e", "#5f6b7a"];
  function avCol() { return fb.db.collection("hanco_anh"); }
  function avCan() { return !!(fb.on && fb.user && fb.db && (isAdmin() || tk.st === "ok")); }
  function avKnown(uid) { return jget(AV_LS)[uid] != null; }
  function avMyV(uid) { var u = fb.user; return u ? +jget(AV_LS)[uid || u.uid] || 0 : 0; } // uid = một mã của mình (quản trị: mã vai người học)
  function avSetMyV(uid, v) { var o = jget(AV_LS); o[uid] = v; lsSet(AV_LS, JSON.stringify(o)); }
  function avMyTen() { var u = fb.user; if (!u) return ""; if (isAdmin()) return vaiGet().tq; var p = tk.prof || tkCache() || {}; return String(p.ten || u.displayName || (u.email || "").split("@")[0] || ""); }
  function avVer(uid) { // phiên bản ảnh của một người: của mình = bản trên máy; người khác = cột a trên bảng xếp hạng (đã tải)
    var r = BXH.d && BXH.d.u && BXH.d.u[uid], b = r ? +r.a || 0 : 0;
    return isMine(uid) ? Math.max(avMyV(uid), b) : b;
  }
  function avKey(uid) { return "./__anh/" + encodeURIComponent(uid); }
  function avCacheGet(uid) {
    if (AV.mem[uid]) return Promise.resolve(AV.mem[uid]);
    if (!window.caches || !caches.open) return Promise.resolve(null);
    return caches.open(AV_C).then(function (c) { return c.match(avKey(uid)); }).then(function (r) { return r ? r.json() : null; })
      .then(function (j) { if (j && j.d) { AV.mem[uid] = j; return j; } return null; }).catch(function () { return null; });
  }
  function avCachePut(uid, j) {
    AV.mem[uid] = j;
    if (!window.caches || !caches.open) return;
    caches.open(AV_C).then(function (c) { return c.put(avKey(uid), new Response(JSON.stringify(j), { headers: { "Content-Type": "application/json" } })); }).catch(function () { });
  }
  // ảnh của uid, phiên bản v → Promise<data URL | "">: bản trên máy đủ mới thì dùng, cũ hơn thì đọc 1 lần (gộp các lần gọi trùng)
  function avGet(uid, v) {
    if (!uid || !(v > 0)) return Promise.resolve("");
    var k = uid + "|" + v;
    if (AV.job[k]) return AV.job[k];
    return (AV.job[k] = avCacheGet(uid).then(function (j) {
      if (j && +j.v >= v) return j.d;
      if (!fb.db || !fb.user) { delete AV.job[k]; return j ? j.d : ""; }
      return avCol().doc(uid).get().then(function (s) {
        var x = s.exists ? s.data() : null;
        if (!x || !x.d) return j ? j.d : "";
        avCachePut(uid, { v: +x.v || v, d: x.d });
        return x.d;
      }, function () { delete AV.job[k]; return j ? j.d : ""; });
    }));
  }
  // máy chưa biết mình có ảnh chưa (máy mới / tài khoản mới trên máy) → đọc ảnh của mình 1 lần (thất bại thì ≥ 60 giây sau mới thử lại)
  function avMineCheck(id) {
    var u = fb.user; id = typeof id === "string" && id ? id : u && u.uid; if (!u || !avCan() || avKnown(id)) return;
    if (Date.now() - (AV.mine[id] || 0) < 60e3) return;
    AV.mine[id] = Date.now();
    avCol().doc(id).get().then(function (s) {
      var x = s.exists ? s.data() : null, v = x && x.d ? +x.v || 1 : 0;
      if (v) avCachePut(id, { v: v, d: x.d });
      if (fb.user === u) { avSetMyV(id, v); renderStats(); avmBoot(); }
    }, function () { });
  }
  // bảng xếp hạng vừa tải: máy khác của mình đã đổi ảnh (a mới hơn) → nhận phiên bản mới
  function avSeen() {
    var u = fb.user; if (!u || BXH.u !== u.uid || !BXH.d || !BXH.d.u) return;
    myKeys().forEach(function (k) { var r = BXH.d.u[k]; if (r && +r.a > avMyV(k)) { avSetMyV(k, +r.a); renderStats(); avRefresh(k); } });
  }
  function avInit(ten) {
    ten = String(ten || "").trim(); if (!ten) return "?";
    if (ten === "Quản trị viên") return "Q";
    var w = ten.split(/\s+/); return w[w.length - 1].charAt(0).toUpperCase();
  }
  // ---------- ẢNH MẶC ĐỊNH (người dùng yêu cầu 27/11/2026) ----------
  // anh-mac-dinh/NNN.webp (+ NNN.jpg cho máy không đọc được WebP), AVM_N hình (Microsoft Fluent Emoji 3D, giấy phép MIT), sinh bằng
  // tools/anhmd.py từ tools/work/anhmd/ds.txt — CHỈ THÊM VÀO CUỐI (số hình đã lưu trên bảng xếp hạng). Người chưa tự tải ảnh (hoặc tự chọn
  // hình hệ thống) GIỮ 1 hình riêng: cột mc trên dòng bảng xếp hạng của mình; ms = 1 → đang dùng hình hệ thống thay ảnh đã tải lên.
  // KHÔNG TRÙNG: nhận / chọn hình chưa ai dùng (đọc bảng mới nhất); 2 người lỡ trùng khi còn hình trống → người có mã lớn hơn tự đổi
  // hình khác; hết hình mới vòng lại (hình ít người dùng nhất). Hình quản trị xóa: hanco_cfg/chung.amx = [số hình] → không ai được
  // chia / chọn nữa, người đang dùng tự đổi sang hình trống. Máy giữ bản của mình ở localStorage AVM_LS {mã: {m số hình | -1, s 0|1}}.
  // localStorage AVM_WEBP = "1" / "0" (máy đọc được WebP không). Không thuộc S. Ảnh tải 1 lần rồi ở đệm riêng anhmd-v1 (sw.js).
  var AVM_N = 150, AVM_LS = "hanco-anh-md", AVM_WEBP = "hanco-webp", AVM = { job: null, boot: {} };
  function avmExt() {
    var w = lsGet(AVM_WEBP);
    if (w !== "1" && w !== "0") { // đoán nhanh lần đầu (canvas), rồi thử giải mã thật 1 ảnh WebP nhỏ → nhớ cho các lần sau
      w = "0"; try { var c = document.createElement("canvas"); c.width = c.height = 1; if (c.toDataURL("image/webp").indexOf("data:image/webp") === 0) w = "1"; } catch (e) { }
      if (!AVM.job) { AVM.job = 1; try { var im = new Image(); im.onload = function () { lsSet(AVM_WEBP, im.width > 0 ? "1" : "0"); }; im.onerror = function () { lsSet(AVM_WEBP, "0"); }; im.src = "data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA"; } catch (e) { } }
      AVM.guess = w;
    }
    return (w === "1" || w === "0" ? w : AVM.guess) === "1" ? "webp" : "jpg";
  }
  function avmUrl(i) { return "./anh-mac-dinh/" + pad3(i) + "." + avmExt(); }
  HC.avmUrl = avmUrl;
  function avmGone() { var o = {}; (Array.isArray(CHG.amx) ? CHG.amx : []).forEach(function (i) { o[+i] = 1; }); return o; }
  function avmOk(m, gone) { return typeof m === "number" && m >= 0 && m < AVM_N && Math.floor(m) === m && !(gone || avmGone())[m]; }
  function avmLocal(id) { var o = jget(AVM_LS)[id]; return o && typeof o === "object" ? o : {}; }
  function avmSetLocal(id, v, t) { var o = jget(AVM_LS); v.t = t || Date.now(); o[id] = v; lsSet(AVM_LS, JSON.stringify(o)); } // t = lúc chọn (lần chọn mới nhất thắng giữa các máy)
  // bản của mình: máy này hay dòng bảng (máy khác của mình vừa chọn: mt mới hơn) — bản nào chọn sau thì dùng
  function avmMine(id) {
    var o = avmLocal(id), r = avmRow(id);
    if (r && +r.mt > (+o.t || 0)) return { m: typeof r.mc === "number" ? r.mc : -1, s: r.ms ? 1 : 0, t: +r.mt, row: 1 };
    return o;
  }
  function avmRow(uid) { return BXH.d && BXH.d.u ? BXH.d.u[uid] : null; }
  // trạng thái ảnh mặc định của uid: {s 1 = dùng hình hệ thống thay ảnh đã tải, m số hình | -1}
  function avmState(uid) {
    var r = avmRow(uid) || {}, s = r.ms ? 1 : 0, m = typeof r.mc === "number" ? r.mc : -1;
    if (isMine(uid)) { var o = avmMine(uid); if (o.s != null) s = o.s ? 1 : 0; if (o.m != null) m = +o.m; }
    return { s: s, m: avmOk(m) ? m : -1 };
  }
  // hình đang có người khác dùng (bỏ người đang hiện ảnh tự tải): {số hình: [mã]}
  function avmUsed(me) {
    var U = (BXH.d && BXH.d.u) || {}, gone = avmGone(), c = {};
    Object.keys(U).forEach(function (k) {
      if (k === me) return; var r = U[k] || {};
      if (+r.a > 0 && !r.ms) return;
      if (avmOk(r.mc, gone)) (c[r.mc] = c[r.mc] || []).push(k);
    });
    return c;
  }
  function avmFree(used, gone) { var f = []; for (var i = 0; i < AVM_N; i++) if (!gone[i] && !used[i]) f.push(i); return f; }
  function avmNext(used, gone) { // hình trống số nhỏ nhất; hết hình trống → vòng lại: hình ít người dùng nhất
    var f = avmFree(used, gone); if (f.length) return f[0];
    var best = -1, n = 1e9; for (var i = 0; i < AVM_N; i++) if (!gone[i] && used[i].length < n) { n = used[i].length; best = i; }
    return best;
  }
  // bảng vừa tải: kiểm hình của mình (chưa có / bị xóa / trùng người khác khi vẫn còn hình trống) → nhận hình mới, trả true nếu đổi
  function avmEnsure() {
    var u = fb.user; if (!u || !BXH.d || BXH.u !== u.uid || !bxhOk()) return false;
    var me = myKey("bx"); if (!me || !avKnown(me)) return false; // chưa biết mình có ảnh tự tải không → chờ
    var o = avmMine(me), r = avmRow(me) || {}, s = o.s != null ? (o.s ? 1 : 0) : r.ms ? 1 : 0;
    var m = o.m != null ? +o.m : typeof r.mc === "number" ? r.mc : -1, old = m, gone = avmGone(), used = avmUsed(me), why = "";
    if (avMyV(me) > 0 && !s) m = -1; // đang hiện ảnh tự tải → nhả hình cho người khác
    else if (!avmOk(m, gone)) { if (m >= 0) why = "xóa"; m = avmNext(used, gone); }
    else if (used[m] && avmFree(used, gone).length && used[m].some(function (k) { return k < me; })) { why = "trùng"; m = avmNext(used, gone); }
    var rm = avmOk(r.mc, gone) ? r.mc : -1, rs = r.ms ? 1 : 0; // bản đang ở trên bảng
    var lo = avmLocal(me), chg = lo.s == null || +lo.m !== m || (lo.s ? 1 : 0) !== s; // bản trên máy có đổi không (→ vẽ lại ảnh)
    if (o.m !== m || o.s == null || (o.s ? 1 : 0) !== s) avmSetLocal(me, { m: m, s: s }); // quyết định mới → giờ mới
    else if (o.row) avmSetLocal(me, { m: m, s: s }, o.t); // nhận bản máy khác đã chọn (giữ giờ chọn của máy đó)
    if (rm === m && rs === s) { if (chg) { avRefresh(me); renderStats(); } return false; } // bảng đã đúng → không cần ghi
    if (why && old >= 0 && m >= 0) toast(why === "xóa" ? "Hình đại diện cũ của bạn đã bị gỡ khỏi app, app đổi sang hình khác" : "Hình đại diện vừa có người khác chọn trước, app đổi sang hình khác cho bạn");
    avRefresh(me); renderStats();
    return true;
  }
  // vào app / quản trị vừa xóa hình: máy chưa có hình (hoặc hình đã bị xóa) → đọc bảng 1 lần rồi nhận hình
  function avmBoot(force) {
    var u = fb.user; if (!u) return;
    if (!bxhOk()) { // hồ sơ tài khoản / tiến độ chưa tải xong → thử lại sau 3 giây (tối đa 10 lần mỗi lần vào app)
      if ((AVM.retry || 0) < 10 && !AVM.rt) { AVM.retry = (AVM.retry || 0) + 1; AVM.rt = setTimeout(function () { AVM.rt = null; avmBoot(force); }, 3000); }
      return;
    }
    AVM.retry = 0;
    var me = myKey("bx"); if (!me) return;
    if (!avKnown(me)) { avMineCheck(me); return; } // avMineCheck xong tự gọi lại
    var o = avmMine(me);
    if (!force && o.m != null && (o.m < 0 || avmOk(+o.m))) return;
    if (!force && Date.now() - (AVM.boot[me] || 0) < 60e3) return; AVM.boot[me] = Date.now(); // ≤ 1 lần/phút mỗi tài khoản (quản trị xóa hình → kiểm ngay)
    bxhLoad(!!force).then(function () { if (avmEnsure()) bxhSend(true); }, function () { });
  }
  HC.avmBoot = avmBoot; HC.avmState = avmState;
  // vòng tròn ảnh: view = bấm để xem ảnh to (chỉ khi có ảnh tự tải đang hiện); v null = tra theo avVer
  // chưa có ảnh tự tải / đang dùng hình hệ thống → ảnh mặc định (số hình giữ trên bảng); chưa biết số hình → chữ cái đầu
  function avHTML(uid, ten, v, cls, view) {
    var h = 0, s = String(uid || ""); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    v = v == null ? avVer(s) : +v || 0;
    var st = avmState(s); if (st.s) v = 0;
    var md = !v && st.m >= 0, want = !!view; view = view && v > 0;
    var tag = view ? "button" : "span";
    return "<" + tag + (view ? ' type="button" data-avview="' + esc(ten || "") + '" aria-label="Xem ảnh đại diện của ' + esc(ten || "") + '" title="Xem ảnh đại diện"' : ' aria-hidden="true"') +
      ' class="av' + (cls ? " " + cls : "") + (md ? " img md" : "") + '" data-av="' + esc(s) + '" data-avt="' + esc(ten || "") + '"' + (want ? ' data-avw="1"' : "") + ' data-avv="' + v + '" style="--avbg:' + AV_BG[h % AV_BG.length] + (md ? ';background-image:url(&quot;' + avmUrl(st.m) + '&quot;)' : "") + '">' + esc(avInit(ten)) + "</" + tag + ">";
  }
  HC.avHTML = avHTML;
  function avFill(root) {
    $$("[data-av]", root || document).forEach(function (el) {
      var uid = el.getAttribute("data-av"), v = +el.getAttribute("data-avv") || 0;
      if (!v || el.__avv === v) return; el.__avv = v;
      avGet(uid, v).then(function (d) { if (d && el.__avv === v) { el.style.backgroundImage = 'url("' + d + '")'; el.classList.add("img"); el.classList.remove("md"); } });
    });
  }
  HC.avFill = avFill;
  function avRefresh(uid) { // ảnh của uid vừa đổi (ảnh tự tải hoặc ảnh mặc định): vẽ lại mọi vòng tròn đang hiện
    $$('[data-av="' + uid + '"]').forEach(function (el) {
      var cls = String(el.className || "").split(/\s+/).filter(function (c) { return c && c !== "av" && c !== "img" && c !== "md"; }).join(" ");
      var w = document.createElement("div"); w.innerHTML = avHTML(uid, el.getAttribute("data-avt") || "", null, cls, el.getAttribute("data-avw") === "1");
      var n = w.firstChild; if (n && el.parentNode) el.parentNode.replaceChild(n, el);
    });
    avFill();
  }
  // cách nhớ: cần số phiên bản ảnh của người khác (cột a bảng xếp hạng) → bảng chưa tải lần nào trong phiên này thì tải 1 lần rồi tô
  function avFillBx(root, ten) {
    function go() {
      $$("[data-avs]", root).forEach(function (el) { // chỗ để trống chờ biết phiên bản → thay bằng vòng tròn (có ảnh thì bấm xem được)
        var uid = el.getAttribute("data-avs"); el.outerHTML = avHTML(uid, el.getAttribute("data-avt"), null, "sm", true);
      });
      avFill(root);
    }
    if (BXH.d || !bxhOk()) return go();
    bxhLoad(false).then(go, go);
  }
  function avSlot(uid, ten) { return '<span class="av sm" data-avs="' + esc(uid) + '" data-avt="' + esc(ten || "") + '" aria-hidden="true">' + esc(avInit(ten)) + "</span>"; }
  // khung ảnh: lớp RIÊNG trên cùng (không dùng #layer → không đóng khung chi tiết / khung cách nhớ đang mở bên dưới)
  function avModal(html) {
    var m = document.createElement("div"); m.className = "modal avmodal"; m.setAttribute("role", "dialog"); m.setAttribute("aria-modal", "true");
    m.innerHTML = '<div class="box"><button class="btn sm ghost x" type="button" data-x aria-label="Đóng">✕</button>' + html + "</div>";
    document.body.appendChild(m);
    function close() { m.remove(); window.removeEventListener("keydown", k, true); }
    function k(e) { if (e.key === "Escape") { e.stopImmediatePropagation(); close(); } } // Esc chỉ đóng khung ảnh, không đóng khung bên dưới
    m.addEventListener("click", function (e) { if (e.target === m || e.target.closest("[data-x]")) close(); });
    window.addEventListener("keydown", k, true);
    var f = m.querySelector(".acts .btn"); if (f) try { f.focus(); } catch (e) { }
    return { el: m, close: close };
  }
  // xem ảnh to
  function avView(uid, ten) {
    avMenuClose();
    var v = avVer(uid), mine = isMine(uid);
    var m = avModal('<h2>' + esc(ten || "Ảnh đại diện") + '</h2><div class="avbig"><span class="muted">Đang tải ảnh…</span></div><div class="row acts">' +
      (mine ? '<button class="btn primary" type="button" data-avchg>Đổi ảnh đại diện</button>' : "") + '<button class="btn" type="button" data-x>Đóng</button></div>');
    avGet(uid, v).then(function (d) {
      var b = $(".avbig", m.el); if (!b) return;
      b.innerHTML = d ? '<img alt="Ảnh đại diện của ' + esc(ten || "") + '" src="' + d + '">' : '<span class="muted">Chưa tải được ảnh. Kiểm tra mạng rồi thử lại.</span>';
    });
    var c = $("[data-avchg]", m.el); if (c) c.onclick = function () { m.close(); avPick(uid); };
  }
  HC.avView = avView;
  try {
    document.addEventListener("click", function (e) {
      var b = e.target && e.target.closest ? e.target.closest("[data-avview]") : null;
      if (!b) return;
      e.preventDefault(); e.stopPropagation();
      avView(b.getAttribute("data-av"), b.getAttribute("data-avview"));
    }, true);
  } catch (e) { }
  // nút ảnh trên thanh trên cùng / thanh dọc → menu tài khoản (theo mẫu người dùng gửi; KHÔNG có "Gỡ ảnh")
  function avTopHTML() {
    var u = fb.user; if (!u) return "";
    avMineCheck();
    try { avmBoot(); } catch (e) { } // chưa có ảnh mặc định / hình đã bị xóa → nhận hình (máy đã có hình hợp lệ thì không làm gì)
    return '<button type="button" class="avtop" id="avbtn" aria-haspopup="menu" aria-expanded="false" aria-label="Tài khoản: ' + esc(avMyTen()) + '" title="Tài khoản">' + avHTML(u.uid, avMyTen(), avMyV(), "", false) + "</button>";
  }
  var avMenuOff = null;
  function avMenuClose() {
    var m = document.getElementById("avmenu"); if (m) m.remove();
    if (avMenuOff) { avMenuOff(); avMenuOff = null; }
    var b = document.getElementById("avbtn"); if (b) b.setAttribute("aria-expanded", "false");
  }
  function avMenu(btn) {
    if (document.getElementById("avmenu")) return avMenuClose();
    var u = fb.user; if (!u) return;
    var v = avMyV(), ten = avMyTen(), mk = myKey("bx") || u.uid, ms = avmState(mk).s && avMyV(mk) > 0;
    var el = document.createElement("div"); el.id = "avmenu"; el.className = "avmenu"; el.setAttribute("role", "menu"); el.setAttribute("aria-label", "Tài khoản");
    el.innerHTML = '<div class="avm-hd">' + avHTML(u.uid, ten, v, "lg", true) + '<div class="avm-t"><small class="muted">Đang đăng nhập</small><b>' + esc(ten) + "</b>" + (u.email ? '<span class="muted">' + esc(u.email) + "</span>" : "") + "</div></div>" +
      (v > 0 && !ms ? '<button type="button" role="menuitem" data-avm="xem"><span class="avm-ic" aria-hidden="true">◉</span>Xem ảnh đại diện</button>' : "") +
      '<button type="button" role="menuitem" data-avm="chon"><span class="avm-ic" aria-hidden="true">▦</span>Chọn ảnh có sẵn</button>' +
      (ms ? '<button type="button" role="menuitem" data-avm="cu"><span class="avm-ic" aria-hidden="true">↺</span>Dùng lại ảnh đã tải lên</button>' : "") +
      '<button type="button" role="menuitem" data-avm="doi"><span class="avm-ic" aria-hidden="true">⇪</span>' + (v > 0 ? (ms ? "Tải ảnh khác lên" : "Đổi ảnh đại diện") : "Tải ảnh đại diện lên") + "</button>" +
      '<button type="button" role="menuitem" data-avm="tk"><span class="avm-ic" aria-hidden="true">⚙</span>Tài khoản &amp; cài đặt</button>' +
      '<hr><button type="button" role="menuitem" data-avm="out"><span class="avm-ic" aria-hidden="true">⇥</span>Đăng xuất</button>';
    document.body.appendChild(el);
    avFill(el);
    // vị trí: thanh trên → ngay dưới nút, canh phải; thanh dọc bên trái → bên phải thanh, canh đáy nút
    var r = btn.getBoundingClientRect(), W = window.innerWidth || 360, H = window.innerHeight || 640, w = el.offsetWidth, h = el.offsetHeight, x, y;
    if (menuIsTop()) { x = r.right - w; y = r.bottom + 6; }
    else { var tb = document.querySelector(".topbar"); x = (tb ? tb.getBoundingClientRect().right : r.right) + 8; y = r.bottom - h; }
    x = Math.max(8, Math.min(x, W - w - 8)); y = Math.max(8, Math.min(y, H - h - 8));
    el.style.left = x + "px"; el.style.top = y + "px";
    btn.setAttribute("aria-expanded", "true");
    el.addEventListener("click", function (e) {
      var b = e.target.closest("[data-avm]"); if (!b) return;
      var k = b.getAttribute("data-avm"); avMenuClose();
      if (k === "xem") avView(u.uid, ten);
      else if (k === "doi") avPick();
      else if (k === "chon") avmPick();
      else if (k === "cu") avmUseOwn(mk);
      else if (k === "tk") HC.go("caidat");
      else if (k === "out") HC.fbSignOut(false).then(function (ok) { if (ok) toast("Đã đăng xuất. Tiến độ của bạn được cất riêng trên máy này"); });
    });
    function out(e) { if (!el.contains(e.target) && !btn.contains(e.target)) avMenuClose(); }
    function key(e) { if (e.key === "Escape") { avMenuClose(); try { btn.focus(); } catch (x) { } } }
    function rs() { avMenuClose(); }
    document.addEventListener("pointerdown", out, true); document.addEventListener("keydown", key); window.addEventListener("resize", rs); window.addEventListener("hashchange", rs);
    avMenuOff = function () { document.removeEventListener("pointerdown", out, true); document.removeEventListener("keydown", key); window.removeEventListener("resize", rs); window.removeEventListener("hashchange", rs); };
    var f = el.querySelector("[data-avm]"); if (f) try { f.focus(); } catch (e) { }
  }
  HC.avMenu = function () { var b = document.getElementById("avbtn"); if (b) avMenu(b); };
  // chọn ảnh có sẵn (27/11/2026): chỉ hiện hình chưa ai dùng (đọc bảng mới nhất: 1 lượt đọc) + hình mình đang dùng; bấm = đổi (ghi dòng bảng)
  function avmPick() {
    var u = fb.user; if (!u || !avCan() || !bxhOk()) return toast("Cần đăng nhập và đăng ký xong tài khoản mới chọn được ảnh có sẵn");
    var me = myKey("bx"); if (!me) return toast("Bạn đang ẩn khỏi bảng xếp hạng nên chưa chọn được ảnh có sẵn (Cài đặt → Tài khoản → Hai vai của tôi)");
    avMenuClose();
    var m = avModal('<h2>Chọn ảnh có sẵn</h2><p class="sub">Chỉ hiện các hình chưa ai dùng. Bấm một hình để dùng làm ảnh đại diện.</p><div class="avmgrid"><p class="muted">Đang tải danh sách hình…</p></div><div class="row acts"><button class="btn" type="button" data-x>Đóng</button></div>');
    bxhLoad(true).then(function () {
      var g = $(".avmgrid", m.el); if (!g) return;
      var used = avmUsed(me), gone = avmGone(), st = avmState(me), now = avMyV(me) > 0 && !st.s ? -1 : st.m, list = [];
      for (var i = 0; i < AVM_N; i++) if (!gone[i] && (!used[i] || i === now)) list.push(i);
      g.innerHTML = list.length ? list.map(function (i) {
        return '<button type="button" class="avmc" data-avmi="' + i + '" aria-label="Hình số ' + (i + 1) + (i === now ? " (đang dùng)" : "") + '"' + (i === now ? ' aria-current="true"' : "") + '><img src="' + avmUrl(i) + '" alt="" width="72" height="72" loading="lazy"></button>';
      }).join("") : '<p class="muted">Hiện không còn hình trống nào.</p>';
      g.onclick = function (e) {
        var b = e.target.closest ? e.target.closest("[data-avmi]") : null; if (!b) return;
        var i = +b.getAttribute("data-avmi");
        avmSetLocal(me, { m: i, s: avMyV(me) > 0 ? 1 : 0 });
        m.close(); avRefresh(me); renderStats(); bxhSend(true);
        toast("Đã đổi ảnh đại diện");
      };
    }, function (e) { var g = $(".avmgrid", m.el); if (g) g.innerHTML = '<p class="tkmsg">Chưa tải được danh sách hình (' + esc(tkErr(e)) + "). Kiểm tra mạng rồi thử lại.</p>"; });
  }
  HC.avmPick = avmPick;
  // đang dùng hình hệ thống mà đã có ảnh tự tải → quay về ảnh tự tải (nhả hình hệ thống)
  function avmUseOwn(me) {
    if (!(avMyV(me) > 0)) return;
    avmSetLocal(me, { m: -1, s: 0 }); avRefresh(me); renderStats(); bxhSend(true);
    toast("Đã dùng lại ảnh bạn tải lên");
  }
  // chọn ảnh → cắt vuông giữa, thu nhỏ, nén → xem trước → lưu (ghi đè ảnh cũ)
  // id = mã nhận ảnh (mặc định: mình; quản trị: mã vai người học khi đổi ảnh vai đó)
  function avId(id) { return typeof id === "string" && id && isMine(id) ? id : fb.user ? fb.user.uid : ""; }
  function avPick(id) {
    if (!avCan()) return toast("Cần đăng nhập và đăng ký xong tài khoản mới đổi được ảnh đại diện");
    id = avId(id);
    var inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*"; inp.style.display = "none";
    inp.onchange = function () { var f = inp.files && inp.files[0]; inp.remove(); if (f) avFile(f, id); };
    document.body.appendChild(inp); inp.click();
    setTimeout(function () { if (inp.isConnected) inp.remove(); }, 600e3);
  }
  HC.avPick = avPick;
  function avFile(f, id) {
    if (!f || !/^image\//.test(f.type || "")) return toast("Hãy chọn một tệp ảnh (jpg, png, webp…)");
    if (f.size > 15 * 1024 * 1024) return toast("Ảnh lớn quá (tối đa 15 MB)");
    id = avId(id);
    return avShrink(f).then(function (d) { avConfirm(d, id); }, function (e) { toast(e && e.message === "big" ? "Ảnh này nén vẫn còn quá lớn. Hãy thử ảnh khác." : "Không đọc được ảnh này. Hãy thử ảnh khác (jpg hoặc png)."); });
  }
  HC.avFile = avFile;
  function avShrink(f) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(f), im = new Image();
      im.onload = function () {
        try {
          var w = im.naturalWidth, h = im.naturalHeight, s = Math.min(w, h), d = "";
          if (!s) throw new Error("size");
          var tries = [[AV_PX, 0.85], [AV_PX, 0.7], [320, 0.6], [256, 0.5]];
          for (var i = 0; i < tries.length; i++) {
            var px = tries[i][0], c = document.createElement("canvas"); c.width = c.height = px;
            var g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, px, px); // ảnh trong suốt → nền trắng
            g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
            g.drawImage(im, (w - s) / 2, (h - s) / 2, s, s, 0, 0, px, px);
            d = c.toDataURL("image/webp", tries[i][1]);
            if (d.indexOf("data:image/webp;base64,") !== 0) d = c.toDataURL("image/jpeg", tries[i][1]);
            if (d.length <= AV_MAX) break;
          }
          URL.revokeObjectURL(url);
          if (d.length > AV_MAX) return rej(new Error("big"));
          if (!/^data:image\/(webp|jpeg);base64,/.test(d)) return rej(new Error("fmt"));
          res(d);
        } catch (e) { URL.revokeObjectURL(url); rej(e); }
      };
      im.onerror = function () { URL.revokeObjectURL(url); rej(new Error("img")); };
      im.src = url;
    });
  }
  function avConfirm(d, id) {
    id = avId(id);
    var had = avMyV(id) > 0;
    var m = avModal('<h2>' + (had ? "Đổi ảnh đại diện" : "Ảnh đại diện") + '</h2><p class="sub">Ảnh được cắt vuông ở giữa và thu nhỏ. Mọi người trong app thấy ảnh này (bảng xếp hạng, cách nhớ).' +
      (had ? " Ảnh cũ sẽ được thay hẳn bằng ảnh mới." : "") + '</p><div class="avbig"><img alt="Ảnh mới chọn" src="' + d + '"></div>' +
      '<div class="row acts"><button class="btn primary" type="button" id="avok">Dùng ảnh này</button><button class="btn" type="button" id="avre">Chọn ảnh khác</button><button class="btn ghost" type="button" data-x>Thôi</button></div>');
    var ok = $("#avok", m.el);
    ok.onclick = function () {
      ok.disabled = true; ok.textContent = "Đang lưu…";
      avSave(d, id).then(function () { m.close(); toast(had ? "Đã đổi ảnh đại diện" : "Đã lưu ảnh đại diện"); }, function (e) { ok.disabled = false; ok.textContent = "Dùng ảnh này"; toast("Chưa lưu được ảnh (" + tkErr(e) + ")"); });
    };
    $("#avre", m.el).onclick = function () { m.close(); avPick(id); };
  }
  function avSave(d, id) {
    var u = fb.user; if (!u || !avCan()) return Promise.reject(new Error("signedout"));
    var v = Date.now(); id = avId(id);
    // set() ghi đè CẢ tài liệu: ảnh cũ mất luôn (không còn bản nào)
    return avCol().doc(id).set({ d: d, v: v, upd: firebase.firestore.FieldValue.serverTimestamp() }).then(function () {
      avCachePut(id, { v: v, d: d }); avSetMyV(id, v); avmSetLocal(id, { m: -1, s: 0 }); // tải ảnh mới → hiện ảnh này, nhả hình mặc định
      renderStats(); avRefresh(id);
      bxhSend(true); // báo phiên bản ảnh mới cho máy khác (cột a trên bảng xếp hạng)
    });
  }
  HC.avSave = avSave;
  // ---- cúp tuần ----
  function cupAt(k) { return (k + 7) * 864e5 - 7 * 3600e3 + 12 * 3600e3; } // 12 giờ trưa thứ Hai tuần sau (giờ VN)
  function cupWeek() { var ws = weekStart(today()); return Date.now() >= cupAt(ws - 7) ? ws - 7 : ws - 14; } // tuần gần nhất đã chốt được
  function wkVal(r, k) { return r && r.w && r.w[0] === k ? +r.w[1] || 0 : r && r.wp && r.wp[0] === k ? +r.wp[1] || 0 : 0; }
  function bxhRank(T, k) { // xếp hạng tuần k từ bảng (bỏ người bị ẩn, XP > 0): [{u uid, v XP}] giảm dần (Firestore không cho mảng lồng mảng)
    var an = (T && T.an) || {}, U = (T && T.u) || {}, out = [];
    Object.keys(U).forEach(function (uid) { if (an[uid]) return; var v = wkVal(U[uid], k); if (v > 0) out.push({ u: uid, v: v }); });
    return out.sort(function (a, b) { return b.v - a.v || (a.u < b.u ? -1 : 1); }).slice(0, 300);
  }
  function bxhCupGet(k) {
    if (BXH.cup[k] !== undefined) return Promise.resolve(BXH.cup[k]);
    return bxhRef("c" + k).get().then(function (s) { var c = s.exists ? s.data() : null; if (c) BXH.cup[k] = c; return c; });
  }
  function bxhCupMake(k) { // chốt cúp tuần k: đẩy dòng của mình lên trước, đọc bảng, ai tới trước thì chốt (đã có thì đọc bản đã chốt)
    return bxhSend(true).then(function () { return bxhLoad(true); }).then(function (T) {
      if (!T) return null;
      var e = bxhRank(T, k);
      return bxhRef("c" + k).set({ k: k, e: e, t: firebase.firestore.FieldValue.serverTimestamp() }).then(function () { BXH.cup[k] = { k: k, e: e }; return BXH.cup[k]; },
        function () { delete BXH.cup[k]; return bxhRef("c" + k).get().then(function (s) { var c = s.exists ? s.data() : null; if (c) BXH.cup[k] = c; return c; }); });
    });
  }
  function cupApply(c) { // bản chốt có mình: ghi cúp (top 3) + hạng tuần cao nhất
    if (!c || !c.e || !fb.user) return;
    var i = -1, k = +c.k;
    c.e.forEach(function (x, j) { if (x && isMine(x.u) && i < 0) i = j; }); // quản trị: dòng của vai nào cũng là của mình (1 tiến độ)
    if (i < 0) return;
    var rank = 1; while (rank <= i && c.e[rank - 1].v > c.e[i].v) rank++; // đồng XP → đồng hạng
    var ch = false; recNorm(S.rec);
    if (rank <= 3 && !(S.cup[k] <= rank)) { S.cup[k] = rank; ch = true; toast("Bạn đạt cúp " + MEDAL[rank] + " tuần " + dateOf(k) + " – " + dateOf(k + 6) + "!"); }
    if (!S.rec.hb || rank < S.rec.hb) { S.rec.hb = rank; S.rec.hk = k; ch = true; }
    if (ch) { save(); checkBadges(); renderStats(); }
  }
  function bxhCupCheck() {
    if (!bxhOk()) return;
    var uid = fb.user.uid, k = cupWeek(), key = uid + "|" + k;
    if (lsGet(BXH_CUP) === key || Date.now() - (BXH.cupTry[key] || 0) < 3600e3) return;
    BXH.cupTry[key] = Date.now();
    bxhCupGet(k).then(function (c) { return c || (Date.now() >= cupAt(k) ? bxhCupMake(k) : null); }).then(function (c) {
      if (!c || !fb.user || fb.user.uid !== uid) return;
      cupApply(c); lsSet(BXH_CUP, key);
    }).catch(function () { });
  }
  // quản trị: tạo tài liệu bảng lần đầu; ẩn khi khóa (an = 2) / hiện khi mở khóa; bỏ dòng khi xóa người
  function bxhEnsure() { var r = bxhRef(); r.get().then(function (s) { if (!s.exists) return r.set({ u: {}, an: {}, rs: {} }); }).catch(function () { }); }
  function bxhMap(f, uid, v) { var o = {}, m = {}; m[uid] = v === undefined ? firebase.firestore.FieldValue.delete() : v; o[f] = m; return o; }
  function bxhLock(uid, st) {
    return bxhLoad(true).then(function (T) {
      if (!T) return; var a = (T.an || {})[uid];
      if (st === "khoa" && !a) return bxhRef().set(bxhMap("an", uid, 2), { merge: true });
      if (st === "ok" && a === 2) return bxhRef().set(bxhMap("an", uid), { merge: true });
    }).catch(function () { });
  }
  function bxhDrop(uid) { var o = bxhMap("u", uid); o.an = bxhMap("an", uid).an; o.rs = bxhMap("rs", uid).rs; return bxhRef().set(o, { merge: true }).catch(function () { }); }

  // ---- màn Xếp hạng ----
  function bxhVal(r, kind, t0) {
    if (kind === "xp") return +r.xp || 0;
    if (kind === "st") return r.sd >= t0 - 1 ? +r.sc || 0 : 0;
    if (kind === "bd") { var n = 0, b = r.bd || {}; Object.keys(b).forEach(function (k) { if (k !== "sp") n += +b[k] || 0; }); return n; }
    var k = perKey(kind, t0); return r[kind] && r[kind][0] === k ? +r[kind][1] || 0 : 0;
  }
  function bxhList(T, kind) { // [{uid, r, v, rank, me, hid}] — dòng của mình luôn là bản tính tại máy
    var t0 = today(), me = fb.user ? myKey("bx") : "", self = !me && !!fb.user, an = (T && T.an) || {}, U = Object.assign({}, (T && T.u) || {}), out = [];
    if (self) me = fb.user.uid; // quản trị đang ẩn: chỉ mình thấy dòng của mình (đánh dấu "đang ẩn")
    myKeys().forEach(function (k) { if (k !== me) delete U[k]; }); // dòng vai khác của mình (chưa kịp dọn) không hiện
    if (bxhOk()) U[me] = bxhRow();
    Object.keys(U).forEach(function (uid) {
      var r = U[uid]; if (!r || (an[uid] && uid !== me)) return;
      var v = bxhVal(r, kind, t0); if (v <= 0 && uid !== me) return;
      out.push({ uid: uid, r: r, v: v, me: uid === me, hid: !!an[uid] || (self && uid === me), s2: kind === "st" ? +r.sm || 0 : kind === "bd" ? (r.cp || []).reduce(function (a, b) { return a + (+b || 0); }, 0) : 0 });
    });
    out.sort(function (a, b) { return b.v - a.v || b.s2 - a.s2 || String(a.r.ten).localeCompare(String(b.r.ten), "vi"); });
    out.forEach(function (x, i) { x.rank = i && out[i - 1].v === x.v && out[i - 1].s2 === x.s2 ? out[i - 1].rank : i + 1; });
    return out;
  }
  function rkHTML(n) { return '<span class="rk' + (n <= 3 ? " rk" + n : "") + '" aria-label="Hạng ' + n + '">' + n + "</span>"; }
  function bxhLi(x, unit, sub) {
    return '<li class="xhr' + (x.me ? " me" : "") + '">' + rkHTML(x.rank) + avHTML(x.uid, x.r.ten, x.me ? avMyV(x.uid) : +x.r.a || 0, "", true) + '<span class="xht"><button type="button" class="xhn" data-pf="' + esc(x.uid) + '">' + esc(x.r.ten || "?") + "</button>" + (x.me ? ' <span class="chip">Bạn</span>' : "") + (x.hid ? ' <span class="chip warn">đang ẩn</span>' : "") +
      (sub ? '<small class="muted">' + sub + "</small>" : "") + '</span><b class="num">' + fmt(x.v) + " " + unit + "</b></li>";
  }
  function bxhBoard(list, unit, subf) {
    var top = list.slice(0, 50), me = list.filter(function (x) { return x.me; })[0];
    var h = '<ol class="xhls">' + top.map(function (x) { return bxhLi(x, unit, subf && subf(x)); }).join("") + "</ol>";
    if (me && top.indexOf(me) < 0) h += '<ol class="xhls xhme">' + bxhLi(me, unit, subf && subf(me)) + "</ol>";
    return h;
  }
  function famHTML(f, lvN, full) {
    var ls = f.lv(), n = lvN != null ? lvN : famN(f), all = ls.length;
    if (!full) return '<div class="bdg' + (n ? " on" : "") + '" title="' + esc(f.t) + '"><div class="m">' + f.g + "</div>" + esc(f.t) + "<small>" + (n ? "cấp " + n + "/" + all : "chưa có") + "</small></div>";
    var L = famLv(f), next = L.filter(function (x) { return !x.on; })[0], v = L[0].v;
    return '<div class="bfam' + (n ? " on" : "") + '"><div class="m" aria-hidden="true">' + f.g + '</div><div class="bft"><b>' + esc(f.t) + ' <span class="muted num">cấp ' + n + "/" + all + "</span></b>" +
      '<div class="bfl" aria-hidden="true">' + L.map(function (x) { return "<i" + (x.on ? ' class="on"' : "") + ' title="' + fmt(x.th) + " " + f.u + '"></i>'; }).join("") + "</div>" +
      "<small>" + (next ? "Hiện có " + fmt(v) + " " + f.u + " · cấp " + (n + 1) + " khi đạt " + fmt(next.th) + " " + f.u : "Đã đạt cấp cao nhất (" + fmt(ls[all - 1]) + " " + f.u + ")") + "</small></div></div>";
  }
  function badgesHome() { // thẻ Hôm nay: huy hiệu nhiều cấp (tóm tắt)
    return '<div class="badges">' + BFAM.map(function (f) { return famHTML(f); }).join("") + BADGES.map(function (b) { return '<div class="bdg' + (S.badges[b.id] ? " on" : "") + '"><div class="m">' + b.g + "</div>" + esc(b.t) + "</div>"; }).join("") + "</div>";
  }
  function recGrid(rc, r) { // kỷ lục cá nhân
    var it = [["Chuỗi dài nhất", fmt(r.sm || 0) + " ngày"], ["XP nhiều nhất 1 ngày", fmt(rc.xd || 0)], ["XP nhiều nhất 1 tuần", fmt(rc.xk || 0)], ["Hạng tuần cao nhất", rc.hb ? "hạng " + rc.hb : "chưa có"], ["Thi thử cao nhất", rc.ex ? fmt(rc.ex) + " điểm" : "chưa thi"], ["Bài không sai câu nào", fmt(rc.pf || 0)]];
    return '<div class="qtst sm">' + it.map(function (x) { return "<div><small>" + x[0] + "</small><b>" + x[1] + "</b></div>"; }).join("") + "</div>";
  }
  function cupHTML(cp) { cp = cp || [0, 0, 0]; return [1, 2, 3].map(function (i) { return '<span class="cupc rk' + i + '" title="Cúp ' + MEDAL[i] + '"><span class="han">冠</span> ' + MEDAL[i] + " <b>" + (+cp[i - 1] || 0) + "</b></span>"; }).join(""); }
  function bxhProfile(uid, list) {
    var x = list.filter(function (y) { return y.uid === uid; })[0]; if (!x) return;
    if (x.me) return HC.go("xh-toi");
    var r = x.r, t0 = today(), bd = r.bd || {};
    var pm = modal('<div class="row avpf">' + avHTML(uid, r.ten, +r.a || 0, "xl", true) + '<div><h2>' + esc(r.ten || "?") + '</h2><p class="sub">Hồ sơ công khai — chỉ có tên hiển thị, ảnh đại diện và số liệu học.</p></div></div><div class="qtst sm"><div><small>Cấp</small><b>' + (+r.lv || 1) + "</b></div><div><small>Tổng XP</small><b>" + fmt(+r.xp || 0) + "</b></div><div><small>Chuỗi hiện tại</small><b>" + (r.sd >= t0 - 1 ? +r.sc || 0 : 0) + " ngày</b></div><div><small>XP tuần này</small><b>" + fmt(bxhVal(r, "w", t0)) + "</b></div></div>" +
      '<h3>Cúp tuần</h3><p class="cups">' + cupHTML(r.cp) + '</p><h3>Huy hiệu</h3><div class="badges">' + BFAM.map(function (f) { return famHTML(f, +bd[f.id] || 0); }).join("") + "</div>" + (bd.sp ? '<p class="sub">+ ' + bd.sp + " thành tích đặc biệt</p>" : "") +
      "<h3>Kỷ lục</h3>" + recGrid(r.rc || {}, r) + '<div class="row acts"><button class="btn" data-x>Đóng</button></div>');
    avFill(pm.el);
  }
  var XH_TABS = [["", "Tuần"], ["thang", "Tháng"], ["quy", "Quý"], ["nam", "Năm"], ["tat", "Toàn thời gian"], ["toi", "Hồ sơ của tôi"]];
  function xhKind(sec, sub) { return sec === "tat" ? (sub === "chuoi" ? "st" : sub === "huy" ? "bd" : "xp") : ({ thang: "m", quy: "q", nam: "y" }[sec] || "w"); }
  function vRank(v, args) {
    var sec = args[0] || "", sub = args[1] || "xp", ep = HC.epoch;
    if (XH_TABS.every(function (a) { return a[0] !== sec; })) sec = "";
    v.innerHTML = '<div class="row"><h1 style="margin:0">Xếp hạng</h1><span class="spacer"></span>' + (sec === "toi" ? "" : '<button class="btn sm ghost" type="button" id="xhre">Tải lại</button>') + "</div>" +
      '<nav class="qtnav" aria-label="Các bảng xếp hạng">' + XH_TABS.map(function (a) { return '<a class="btn sm" href="#xh' + (a[0] ? "-" + a[0] : "") + '"' + (a[0] === sec ? ' aria-current="page"' : "") + ">" + a[1] + "</a>"; }).join("") + '</nav><div id="xhb"></div>';
    var box = $("#xhb", v);
    checkBadges();
    if (sec === "toi") { xhMe(box); return; }
    var kind = xhKind(sec, sub);
    function draw(T) {
      if (HC.epoch !== ep) return;
      var t0 = today(), h = "", L = bxhList(T, kind);
      if (sec === "tat") {
        h += '<nav class="qtnav xhsub" aria-label="Toàn thời gian">' + [["xp", "Tổng XP"], ["chuoi", "Chuỗi ngày"], ["huy", "Huy hiệu"]].map(function (a) { return '<a class="btn sm" href="#xh-tat-' + a[0] + '"' + (a[0] === sub ? ' aria-current="page"' : "") + ">" + a[1] + "</a>"; }).join("") + "</nav>";
        h += '<div class="card"><h2>' + (kind === "st" ? "Chuỗi ngày học (hiện tại · dài nhất)" : kind === "bd" ? "Huy hiệu (tổng số cấp · cúp tuần)" : "Tổng XP từ trước tới nay") + "</h2>" +
          (L.length ? bxhBoard(L, kind === "st" ? "ngày" : kind === "bd" ? "cấp" : "XP", kind === "st" ? function (x) { return "dài nhất " + fmt(+x.r.sm || 0) + " ngày"; } : kind === "bd" ? function (x) { var c = x.r.cp || []; return "cúp vàng " + (+c[0] || 0) + " · bạc " + (+c[1] || 0) + " · đồng " + (+c[2] || 0); } : function (x) { return "cấp " + (+x.r.lv || 1); }) : '<p class="sub">Chưa có ai trên bảng.</p>') + "</div>";
      } else {
        var K = perKey(kind, t0), me = L.filter(function (x) { return x.me; })[0], has = L.filter(function (x) { return x.v > 0 || x.me; });
        h += '<div class="card"><h2>' + perName(kind, K) + "</h2>";
        if (kind === "w") h += '<p class="sub">Tính từ 0 giờ thứ Hai · còn ' + (K + 7 - t0) + " ngày (hết Chủ nhật " + dateY(K + 6) + "). Top 3 nhận cúp vàng · bạc · đồng.</p>";
        if (me) {
          var i = L.indexOf(me), up = null; for (var j = i - 1; j >= 0; j--) if (L[j].v > me.v) { up = L[j]; break; }
          h += '<p class="xhyou">' + (me.v > 0 ? "Bạn đang hạng <b>" + me.rank + "</b> với <b>" + fmt(me.v) + " XP</b>." + (up ? " Cần <b>" + fmt(up.v - me.v + 1) + " XP</b> để vượt " + esc(up.r.ten) + "." : me.rank === 1 ? " Bạn đang dẫn đầu!" : "") : "Bạn chưa có XP trong " + ({ w: "tuần", m: "tháng", q: "quý", y: "năm" }[kind]) + " này — học hoặc ôn để lên bảng.") + (me.hid ? (isAdmin() ? " (Bạn đang ẩn khỏi bảng: người khác không thấy bạn. Đổi ở Cài đặt → Hai vai của tôi.)" : " (Quản trị viên đang ẩn bạn khỏi bảng: người khác không thấy bạn.)") : "") + "</p>";
        }
        var nz = Object.keys((T && T.u) || {}).filter(function (uid) { return !(T.an || {})[uid] && !isMine(uid) && bxhVal(T.u[uid], kind, t0) <= 0; }).length;
        h += (L.some(function (x) { return x.v > 0; }) ? bxhBoard(has, "XP") : '<p class="sub">Chưa ai có XP trong kỳ này.</p>') + (nz > 0 ? '<p class="sub">' + nz + " người khác chưa có XP trong kỳ này.</p>" : "") + "</div>";
        if (kind === "w") h += '<div class="card" id="xhlw"><h2>Cúp tuần trước</h2><p class="sub">Đang tải…</p></div>';
      }
      box.innerHTML = h;
      avFill(box);
      $$("[data-pf]", box).forEach(function (b) { b.onclick = function () { bxhProfile(b.getAttribute("data-pf"), L); }; });
      if (kind === "w") xhLastWeek($("#xhlw", box), T, ep);
    }
    function fail(e) {
      if (HC.epoch !== ep) return;
      var m = !bxhOk() ? "Bảng xếp hạng cần đăng nhập tài khoản và đồng bộ xong. Chờ một lát rồi bấm Tải lại." : BXH.err === "denied" || BXH.err === "none" ? "Bảng xếp hạng chưa sẵn sàng (quản trị viên chưa bật). Hồ sơ, huy hiệu và kỷ lục của bạn vẫn xem được ở \"Hồ sơ của tôi\"." : "Chưa tải được bảng xếp hạng (" + esc(tkErr(e)) + "). Kiểm tra mạng rồi bấm Tải lại.";
      box.innerHTML = '<div class="card"><p class="tkmsg">' + m + '</p><p><a class="btn" href="#xh-toi">Hồ sơ của tôi</a></p></div>';
    }
    function load(force) {
      if (!bxhOk()) return fail();
      box.innerHTML = '<p class="sub">Đang tải…</p>';
      bxhLoad(force).then(function (T) { if (!T) return fail(); draw(T); bxhSend(false); bxhCupCheck(); }, fail);
    }
    $("#xhre", v).onclick = function () { load(true); };
    load(false);
  }
  function xhLastWeek(el, T, ep) {
    if (!el) return;
    var k = perKey("wp", today()), fin = Date.now() >= cupAt(k);
    function show(e, note) {
      if (HC.epoch !== ep || !el.isConnected) return;
      var top = [], i;
      for (i = 0; i < e.length && i < 12; i++) { var r = (T.u || {})[e[i].u]; top.push({ uid: e[i].u, v: e[i].v, ten: r ? r.ten : "(đã rời bảng)", a: r ? +r.a || 0 : 0 }); }
      top.forEach(function (x, j) { x.rank = j && top[j - 1].v === x.v ? top[j - 1].rank : j + 1; });
      top = top.filter(function (x) { return x.rank <= 3; });
      el.innerHTML = '<h2>Cúp tuần trước</h2><p class="sub">' + perName("w", k) + " · " + note + "</p>" + (top.length ? '<ol class="xhls">' + top.map(function (x) { return '<li class="xhr' + (isMine(x.uid) ? " me" : "") + '">' + rkHTML(x.rank) + avHTML(x.uid, x.ten, isMine(x.uid) ? avVer(x.uid) : x.a, "", true) + '<span class="xht"><span class="xhn">' + esc(x.ten) + '</span><small class="muted">cúp ' + MEDAL[x.rank] + '</small></span><b class="num">' + fmt(x.v) + " XP</b></li>"; }).join("") + "</ol>" : '<p class="sub">Tuần trước chưa ai có XP.</p>');
      avFill(el);
    }
    if (!fin) return show(bxhRank(T, k), "tạm tính — chốt lúc 12 giờ trưa thứ Hai");
    bxhCupGet(k).then(function (c) { return c || bxhCupMake(k); }).then(function (c) { if (c) { cupApply(c); show(c.e || [], "đã chốt"); } else show(bxhRank(T, k), "chưa chốt được — tạm tính"); }, function () { show(bxhRank(T, k), "tạm tính"); });
  }
  function xhMe(box) {
    var rc = myRecs(), cups = Object.keys(S.cup || {}).map(Number).sort(function (a, b) { return b - a; }), cp = [0, 0, 0], L = lvl();
    cups.forEach(function (k) { cp[S.cup[k] - 1]++; });
    // quản trị: hiện vai đang dùng trên bảng xếp hạng (ẩn → vai quản trị) + lời nhắc đổi ở Cài đặt
    var mk = fb.user ? myKey("bx") || fb.user.uid : "", mt = fb.user ? (isAdmin() ? (vaiGet().bx === "hv" ? vaiGet().th : vaiGet().tq) : avMyTen()) : "";
    var vn = isAdmin() ? ' <a href="#caidat">Đổi ở Cài đặt → Hai vai của tôi</a>.' : "", vx = isAdmin() ? { qt: "Bảng xếp hạng đang hiện vai quản trị.", hv: "Bảng xếp hạng đang hiện vai người học.", an: "Bạn đang ẩn khỏi bảng xếp hạng." }[vaiGet().bx] + vn : "Ảnh đại diện và tên hiển thị là những gì người khác thấy.";
    var me = fb.user ? '<div class="card"><div class="row avpf">' + avHTML(mk, mt, avMyV(mk), "xl", true) + '<div><h2>' + esc(mt) + '</h2><p class="sub">' + vx + "</p>" +
      (avCan() ? '<button class="btn sm" type="button" id="xhavc">' + (avMyV(mk) > 0 ? "Đổi ảnh đại diện" : "Tải ảnh đại diện lên") + "</button>" : "") + "</div></div></div>" : "";
    box.innerHTML = me + '<div class="card"><h2>Kỷ lục cá nhân</h2><p class="sub">Cấp ' + L.l + " · " + fmt(S.xp || 0) + " XP · chuỗi hiện tại " + (S.streak.d >= today() - 1 ? S.streak.c : 0) + " ngày.</p>" + recGrid(rc, rc) +
      (rc.hb && rc.hk ? '<p class="sub" style="margin-top:8px">Hạng tuần cao nhất đạt ở ' + perName("w", rc.hk).toLowerCase() + ".</p>" : "") + "</div>" +
      '<div class="card"><h2>Huy hiệu</h2><div class="bfams">' + BFAM.map(function (f) { return famHTML(f, null, true); }).join("") + "</div><h3>Thành tích đặc biệt</h3>" +
      '<div class="badges">' + BADGES.map(function (b) { return '<div class="bdg' + (S.badges[b.id] ? " on" : "") + '"><div class="m">' + b.g + "</div>" + esc(b.t) + "</div>"; }).join("") + "</div></div>" +
      '<div class="card"><h2>Cúp tuần</h2><p class="cups">' + cupHTML(cp) + "</p>" + (cups.length ? '<ul class="qtls">' + cups.slice(0, 30).map(function (k) { return "<li>" + perName("w", k) + ": cúp " + MEDAL[S.cup[k]] + "</li>"; }).join("") + "</ul>" : '<p class="sub">Chưa có. Vào top 3 XP của một tuần để nhận cúp (chốt 12 giờ trưa thứ Hai tuần sau).</p>') + "</div>";
    avFill(box);
    var avc = $("#xhavc", box); if (avc) avc.onclick = function () { avPick(mk); };
  }


  // ---------- LỘ TRÌNH THEO KỲ (người dùng yêu cầu 26/11/2026; kế hoạch: .claude/ke-hoach/lo-trinh-nhieu-ky.md) ----------
  // Người học tự chọn kỳ (D.terms) + ngày thi từng kỳ, học nhiều kỳ cùng lúc được. S.plans[k] = {s ngày bắt đầu, e ngày thi, t, x}.
  // Mỗi kỳ dài L = e − s + 1 ngày: chữ + từ học mới từ ngày đầu; loại từ từ 1/5 chặng (LT_AT); câu từ 1/2 chặng (S_AT);
  // ~15% cuối (2–7 ngày) chỉ ôn + thi thử. Cứ 7 ngày (tính từ ngày bắt đầu kỳ) có 1 ngày chỉ ôn.
  // Mục thuộc nhiều kỳ chỉ học 1 lần, ở kỳ có ngày thi sớm hơn. Trong mỗi kỳ mục lặp lại nhiều học trước (người dùng yêu cầu).
  // Mục đã học trước ngày bắt đầu kỳ không tính vào bài của kỳ. Phần không thuộc kỳ nào ("Chung") học khi không có kỳ nào đang học,
  // mỗi ngày S.set.newC chữ + S.set.newW từ. Bộ thủ vẫn theo S.start như cũ. CHỈ ĐỌC S (trừ khung chọn kỳ khi bấm Lưu).
  var LT_AT = 0.2, S_AT = 0.5, TAIL = 0.15, TAIL_MIN = 2, TAIL_MAX = 7, CAP = { c: 40, w: 34, lt: 8, s: 4 }, REST_S = 2;
  var TERMS = [], TERM = {}, LTI = {}, PTY = ["c", "w", "lt", "s"], PTN = { c: "chữ", w: "từ", lt: "loại từ", s: "câu" };
  function dayIdx() { return today() - S.start; }
  function learnDay(di) { if (di < 0) return 0; var w = Math.floor(di / 7), dow = di % 7; return w * 6 + Math.min(dow, 5) + 1; } // ngày thứ 7 mỗi tuần là ngày ôn
  function isReviewDay(di) { return di % 7 === 6; }
  function targetR(k) { return k <= 0 ? 0 : k <= 6 ? Math.round(40 * k / 6) : Math.min(QR.length, 40 + Math.round(174 * (k - 6) / 24)); }
  function owed(q, n) { var m = 0; for (var i = 0; i < n && i < q.length; i++) if (!introduced(q[i].id)) m++; return m; } // mục chưa học trong n vị trí đầu
  function byN(a) { return a.map(function (x, i) { return [x, i]; }).sort(function (p, q) { return (q[0].n || 0) - (p[0].n || 0) || p[1] - q[1]; }).map(function (p) { return p[0]; }); }
  function prepTerms(d) {
    TERMS = d.terms || []; TERM = {}; LTI = {};
    function sScore(s) { var cs = chars(s.han).filter(function (ch) { return CHAR[ch]; }); return cs.reduce(function (a, ch) { return a + CHAR[ch].n; }, 0) / Math.max(1, cs.length); }
    TERMS.forEach(function (T) {
      TERM[T.k] = T;
      var inT = function (x) { return (x.kt || []).indexOf(T.k) >= 0; };
      // câu: câu đã ra đề thi trước, rồi câu có nhiều chữ phổ biến
      var ss = d.sents.filter(inT).map(function (s, i) { return [s, (s.k10 ? 1e6 : 0) + sScore(s), i]; }).sort(function (a, b) { return b[1] - a[1] || a[2] - b[2]; }).map(function (x) { return x[0]; });
      var K = (d.ltk || []).filter(function (K) { return K.k === T.lt; })[0] || { g: {}, am: {} }, lt = [];
      Object.keys(K.g).forEach(function (g) {
        K.g[g].forEach(function (x) {
          var it = chars(x).length > 1 ? WORD[x] : CHAR[x], o = { id: "lt:" + x, type: "lt", x: x, key: x, g: g, it: it, am: (K.am || {})[x] || (it ? firstAm(it.am) : ""), n: it ? it.n : 0 };
          lt.push(o); if (!LTI[x]) LTI[x] = o;
        });
      });
      T.groups = Object.keys(K.g);
      T.Q = { c: d.chars.filter(inT), w: d.words.filter(inT), s: ss, lt: byN(lt) }; // d.chars / d.words đã xếp theo số lần xuất hiện
      T.has = {}; PTY.forEach(function (t) { T.Q[t].forEach(function (it) { T.has[it.id] = 1; }); });
    });
    HC.TERMS = TERMS; HC.TERM = TERM; HC.LTI = LTI;
  }
  function plansOf(P, day) { // các kỳ đang học (chưa qua ngày thi; day = null → cả kỳ đã thi), kỳ thi sớm trước
    return Object.keys(P || {}).filter(function (k) { var p = P[k]; return TERM[k] && p && !p.x && (day == null || day <= p.e); })
      .map(function (k) { return { k: k, T: TERM[k], s: P[k].s, e: P[k].e }; })
      .sort(function (a, b) { return a.e - b.e || TERMS.indexOf(a.T) - TERMS.indexOf(b.T); });
  }
  function ltGot(x) { return !!S.lt[x]; }
  function got(t, it) { return t === "lt" ? ltGot(it.x) : introduced(it.id); }
  function buildPlans(P, day) {
    var ps = plansOf(P, day), all = plansOf(P, null), own = {};
    ps.forEach(function (p) { PTY.forEach(function (t) { p.T.Q[t].forEach(function (it) { if (!own[it.id]) own[it.id] = p.k; }); }); });
    ps.forEach(function (p) {
      var L = Math.max(1, p.e - p.s + 1), tail = Math.max(0, Math.min(L - 1, Math.max(TAIL_MIN, Math.min(TAIL_MAX, Math.round(L * TAIL)))));
      p.L = L; p.tail = tail; p.newEnd = L - tail; p.ltS = Math.floor(L * LT_AT); p.sS = Math.floor(L * S_AT); p.Q = {}; p.days = {};
      PTY.forEach(function (t) {
        p.Q[t] = p.T.Q[t].filter(function (it) {
          var r = t === "lt" ? S.lt[it.x] : S.it[it.id];
          if (r && r[t === "lt" ? 3 : 5] < p.s) return false; // đã học trước khi bắt đầu kỳ này → không tính vào bài của kỳ
          // mục trùng với kỳ thi sớm hơn: thuộc kỳ đó; kỳ đó đã thi xong mà mục còn chưa học → chuyển sang kỳ này
          for (var i = 0; i < all.length && all[i].k !== p.k; i++) if (all[i].T.has[it.id]) return day > all[i].e && !r;
          return true;
        });
        var from = t === "lt" ? p.ltS : t === "s" ? p.sS : 0, ds = [], d;
        for (d = from; d < p.newEnd; d++) if (d % 7 !== 6) ds.push(d);
        if (!ds.length) for (d = p.newEnd - 1; d >= 0; d--) if (d % 7 !== 6) { ds.push(d); break; }
        if (!ds.length) ds.push(0);
        p.days[t] = ds;
      });
    });
    return { ps: ps, own: own };
  }
  var PCK = "", PC = null;
  function PLN() { var t = today(), k = t + "|" + JSON.stringify(S.plans) + "|" + Object.keys(S.it).length + "|" + Object.keys(S.lt).length; if (k !== PCK || !PC) { PC = buildPlans(S.plans, t); PCK = k; } return PC; }
  function planOf(k) { return PLN().ps.filter(function (p) { return p.k === k; })[0] || null; }
  function ptarget(p, t, d) { var ds = p.days[t], n = 0; for (var i = 0; i < ds.length && ds[i] <= d; i++) n++; return Math.round(p.Q[t].length * n / ds.length); }
  function powed(p, t, n) { var q = p.Q[t], m = 0; for (var i = 0; i < n && i < q.length; i++) if (!got(t, q[i])) m++; return m; }
  function pgot(p, t) { var m = 0; p.Q[t].forEach(function (it) { if (got(t, it)) m++; }); return m; }
  function pstate(p, day) { // trạng thái kỳ p ngày day: d (ngày thứ mấy, từ 0), ngày ôn, chặng ôn cuối, bài mới (đã gồm phần trễ dồn lại)
    var d = day - p.s, o = { d: d, rv: d >= 0 && d < p.newEnd && d % 7 === 6, tail: d >= p.newEnd, q: { c: 0, w: 0, lt: 0, s: 0 } };
    if (d < 0 || o.rv) return o;
    PTY.forEach(function (t) { o.q[t] = Math.min(CAP[t], powed(p, t, ptarget(p, t, d))); });
    return o;
  }
  function phaseOf(p, d) { return d >= p.newEnd ? "ôn cuối + thi thử" : d >= p.sS ? "chữ, từ, loại từ, câu" : d >= p.ltS ? "chữ, từ, loại từ" : "chữ, từ"; }
  function introOn(day) { var m = { c: 0, w: 0, r: 0, s: 0 }; Object.keys(S.it).forEach(function (id) { var it = ITEM[id]; if (it && S.it[id][5] === day && m[it.type] != null) m[it.type]++; }); return m; }
  function restQuota(day) { // mục "Chung": bộ thủ (theo S.start như cũ) + phần không thuộc kỳ nào khi không còn kỳ nào đang học
    var P = PLN(), q = { c: 0, w: 0, r: 0, s: 0, lt: 0 }, di = day - S.start;
    if (di >= 0 && !isReviewDay(di)) q.r = Math.min(16, owed(QR, targetR(learnDay(di))));
    if (!P.ps.length) { var n = introOn(day); q.c = Math.max(0, S.set.newC - n.c); q.w = Math.max(0, S.set.newW - n.w); q.s = Math.max(0, REST_S - n.s); }
    return q;
  }
  function secQ(sec) { // hàng đợi của một mục: mã kỳ hoặc "chung" (phần không thuộc kỳ nào đang học)
    if (sec === "chung") { var own = PLN().own, nf = function (x) { return !own[x.id]; }; return { c: QC.filter(nf), w: QW.filter(nf), s: QS.filter(nf), lt: [] }; }
    var p = planOf(sec); return p ? p.Q : null;
  }
  function secQuota(sec) { if (sec === "chung") return restQuota(today()); var p = planOf(sec); return p ? pstate(p, today()).q : { c: 0, w: 0, lt: 0, s: 0 }; }
  function secOf(id) { return PLN().own[id] || "chung"; }
  function dueSec(card, sec) { var own = PLN().own; return due(card).filter(function (id) { return (own[id] || "chung") === sec; }); }
  function ltDue(sec) { var t = today(), own = PLN().own; return Object.keys(S.lt).filter(function (x) { return LTI[x] && S.lt[x][1] <= t && (own["lt:" + x] || "chung") === sec; }).sort(function (a, b) { return S.lt[a][1] - S.lt[b][1]; }).map(function (x) { return LTI[x]; }); }
  function sections() { return PLN().ps.map(function (p) { return p.k; }).concat(["chung"]); }
  function newTotal() { var n = 0; sections().forEach(function (k) { var q = secQuota(k); n += (q.c || 0) + (q.w || 0) + (q.s || 0) + (q.r || 0); }); return n; }
  function secName(k, short) { return k === "chung" ? "Chung" : TERM[k] ? (short ? TERM[k].short : TERM[k].name) : k; }
  HC.focusLt = function () { var p = PLN().ps[0]; return p ? p.T.lt : null; }; // bảng loại từ của kỳ thi gần nhất đang học
  HC.secName = secName;
  // loại từ: ôn ngắt quãng riêng (S.lt[từ] = [hộp, hạn ôn, số lần sai, ngày học, ms]); chung thang INT với thẻ chữ
  function ltIntro(x, ok) { var t = today(); if (S.lt[x]) return; S.lt[x] = [ok ? 1 : 0, ok ? t + 1 : t, 0, t, Date.now()]; addLog("n", 1); addXP(3); }
  function ltGrade(x, ok, practice) { // practice = câu thêm cho đủ bài (không đến hạn): đúng thì giữ lịch, sai thì ôn lại ngày mai
    var r = S.lt[x], t = today(); if (!r) return;
    if (ok) { if (practice) return; r[0] = Math.min(INT.length - 1, r[0] + 1); r[1] = t + INT[r[0]]; }
    else { r[0] = 1; r[1] = t + 1; r[2]++; }
    r[4] = Date.now(); addLog("r", 1); addXP(ok ? 2 : 0);
  }
  HC.ltIntro = ltIntro; HC.ltGrade = ltGrade;
  HC._plan = { PLN: PLN, pstate: pstate, buildPlans: buildPlans, ptarget: ptarget, secQuota: secQuota, dueSec: dueSec, ltDue: ltDue, perDay: perDay }; // để kiểm tra / mô phỏng lịch trong console
  // ngày số ↔ "YYYY-MM-DD" (ô chọn ngày)
  function ymd(n) { var d = new Date(n * 864e5); return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0") + "-" + String(d.getUTCDate()).padStart(2, "0"); }
  function fromYmd(s) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || "")); return m ? Math.round(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 864e5) : null; }
  function dateY(n) { var d = new Date(n * 864e5); return d.getUTCDate() + "/" + (d.getUTCMonth() + 1) + "/" + d.getUTCFullYear(); }
  // số mục mỗi ngày còn phải học để kịp (từ hôm nay tới hết chặng học mới) — dùng ở khung chọn kỳ + lịch trình
  function perDay(p, day) {
    var d = Math.max(0, day - p.s), o = {};
    PTY.forEach(function (t) {
      var left = p.Q[t].length - pgot(p, t), ds = p.days[t].filter(function (x) { return x >= d; }).length;
      o[t] = { left: left, days: ds, per: left ? Math.ceil(left / Math.max(1, ds)) : 0, from: p.days[t][0] };
    });
    return o;
  }

  // ---------- lịch trình chi tiết + tình trạng tiến độ của từng kỳ (màn Cài đặt) ----------
  var schedSel = null;
  function wdName(day) { return ["CN", "T2", "T3", "T4", "T5", "T6", "T7"][new Date(day * 864e5).getUTCDay()]; }
  function half(x) { var r = Math.round(x * 2) / 2; return String(r).replace(".", ","); }
  function nLearned(a) { var m = 0; a.forEach(function (x) { if (introduced(x.id)) m++; }); return m; }
  function introMap() { // ngày → số mục học mới thật sự hôm đó (theo ngày học)
    var m = {}, add = function (d, t) { var x = m[d] || (m[d] = { c: 0, w: 0, r: 0, s: 0, lt: 0 }); if (x[t] != null) x[t]++; };
    Object.keys(S.it).forEach(function (id) { var it = ITEM[id]; if (it) add(S.it[id][5], it.type); });
    Object.keys(S.lt).forEach(function (x) { add(S.lt[x][3], "lt"); });
    return m;
  }
  function planSched(p, t0, im) {
    var d = t0 - p.s, kd = Math.min(d - 1, p.L - 1), T = {}, worst = 0, h = "";
    PTY.forEach(function (t) {
      var tot = p.Q[t].length, exp = kd < 0 ? 0 : ptarget(p, t, kd), sh = tot / Math.max(1, p.days[t].length);
      T[t] = { tot: tot, got: pgot(p, t), exp: exp, behind: powed(p, t, exp), sh: Math.max(1, sh) };
      if (t === "c" || t === "w") worst = Math.max(worst, T[t].behind / T[t].sh);
    });
    var minor = !worst && (T.lt.behind || T.s.behind), cls, ic, head;
    if (worst > 0) { cls = worst > 1 ? "bad" : "warn"; ic = "遲"; head = worst >= 0.5 ? "Đang chậm ~" + half(worst) + " ngày học" : "Chậm một chút so với kế hoạch"; }
    else if (minor) { cls = "warn"; ic = "遲"; head = "Chậm một chút so với kế hoạch"; }
    else { cls = "good"; ic = "正"; head = "Đúng tiến độ"; }
    var pd = perDay(p, t0), late = PTY.filter(function (t) { return T[t].behind; }).map(function (t) { return T[t].behind + " " + PTN[t]; });
    var left = PTY.filter(function (t) { return pd[t].left; });
    h += '<div class="kysched"><h3>' + esc(p.T.name) + ' <small class="muted">' + dateOf(p.s) + " → thi " + dateY(p.e) + " · " + p.L + " ngày</small></h3>";
    h += '<div class="pace ' + cls + '"><div class="pi" aria-hidden="true">' + ic + '</div><div><b class="ph">' + head + '</b><p class="sub">Hôm nay: ngày ' + (d + 1) + "/" + p.L + " · chặng " + phaseOf(p, d) + "." + (late.length ? " Còn trễ: " + late.join(", ") + " (app đã dồn vào bài hôm nay)." : "") + "</p>" +
      '<p class="sub">' + (!left.length ? "Bạn đã học hết phần mới của " + esc(p.T.short) + ". Giờ chỉ cần ôn thẻ đều và làm đề thi thử." : d >= p.newEnd ? "Đã sang chặng ôn cuối: còn " + left.map(function (t) { return pd[t].left + " " + PTN[t]; }).join(", ") + " chưa học, nên học nốt sớm." : "Để kịp: mỗi ngày học ~" + left.map(function (t) { return pd[t].per + " " + PTN[t] + (pd[t].from > d ? " (từ ngày " + (pd[t].from + 1) + ")" : ""); }).join(", ") + ".") + "</p></div></div>";
    h += '<div class="pbars">' + PTY.map(function (t) {
      var x = T[t], w = function (n) { return Math.min(100, Math.round(1000 * n / Math.max(1, x.tot)) / 10) + "%"; };
      var c = !x.behind ? "good" : x.behind <= x.sh ? "warn" : "bad";
      var tag = x.behind ? '<span class="chip ' + (c === "bad" ? "k10" : "warn") + '">Trễ ' + x.behind + "</span>" : '<span class="chip ok">Đúng hạn</span>';
      var nx = null; for (var i = 0; i < p.Q[t].length; i++) if (!got(t, p.Q[t][i])) { nx = p.Q[t][i]; break; }
      var nxt = nx ? "Mục tiếp theo: " + (t === "s" ? "câu " + esc(String(nx.no)) + " (" + esc(nx.set) + ")" : '<span class="han">' + esc(nx.key) + "</span> " + esc(t === "lt" ? nx.am + " · " + nx.g : firstAm(nx.am))) : "Đã học hết";
      return '<div class="pb"><div class="lab"><b>' + PTN[t].charAt(0).toUpperCase() + PTN[t].slice(1) + '</b><span class="num muted">' + fmt(x.got) + " / " + fmt(x.tot) + " · kế hoạch đến hôm nay " + fmt(x.exp) + " " + tag + '</span></div><div class="bar2"><i class="' + c + '" style="width:' + w(x.got) + '"></i><s style="left:' + w(x.exp) + '"></s></div><small class="muted">' + nxt + "</small></div>";
    }).join("") + "</div>";
    // dải lịch theo tuần (tuần tính từ ngày bắt đầu kỳ)
    function cell(di) {
      var day = p.s + di, past = day < t0, a = im[day] || { c: 0, w: 0 }, lg = S.log[day] || {}, c = "dc", lab;
      if (di >= p.L) return '<span class="dc end" aria-hidden="true"></span>';
      var np = (di === 0 ? ptarget(p, "c", 0) : ptarget(p, "c", di) - ptarget(p, "c", di - 1)) + (di === 0 ? ptarget(p, "w", 0) : ptarget(p, "w", di) - ptarget(p, "w", di - 1));
      var nc = di === 0 ? ptarget(p, "c", 0) : ptarget(p, "c", di) - ptarget(p, "c", di - 1);
      if (di === p.L - 1) { c += " fin"; lab = "thi"; }
      else if (di >= p.newEnd || di % 7 === 6 || !np) { c += di >= p.newEnd ? " fin" : " rv"; lab = di >= p.newEnd ? "ôn" : "ôn"; if (past) c += (lg.r || a.c + a.w) ? " did" : " miss"; }
      else { lab = past ? a.c : nc || "+"; if (past) c += a.c + a.w >= np * 0.9 ? " ok" : a.c + a.w > 0 ? " part" : " miss"; }
      if (day === t0) { c += " now"; lab = "nay"; }
      if (schedSel && schedSel.k === p.k && schedSel.d === di) c += " sel";
      return '<button class="' + c + '" data-day="' + p.k + "|" + di + '" title="' + wdName(day) + " " + dateOf(day) + '">' + lab + "</button>";
    }
    h += '<div class="wkh"><span class="wl"></span>' + [0, 1, 2, 3, 4, 5, 6].map(function (x) { return "<span>" + wdName(p.s + x) + "</span>"; }).join("") + "</div>";
    for (var w = 0; w * 7 < p.L; w++) { var cs = ""; for (var x = w * 7; x < w * 7 + 7; x++) cs += cell(x); h += '<div class="wkr"><span class="wl"><b>Tuần ' + (w + 1) + "</b><small>" + dateOf(p.s + w * 7) + "–" + dateOf(p.s + w * 7 + 6) + "</small></span>" + cs + "</div>"; }
    h += '<div class="lday" data-lday="' + p.k + '"></div></div>';
    return h;
  }
  function schedHTML() {
    var P = PLN(), t0 = today(), im = introMap();
    var h = '<div class="row"><h2 style="margin:0">Lịch trình và tiến độ của bạn</h2><span class="spacer"></span><a class="btn sm" href="#caidat-ky">Chọn kỳ / đổi thời gian</a></div>';
    if (!P.ps.length) h += '<p class="sub">Bạn chưa chọn kỳ học nào (hoặc các kỳ đã chọn đã qua ngày thi). Hãy chọn kỳ muốn học và ngày thi ở khung "Chọn kỳ học". Hiện app giao mỗi ngày ' + S.set.newC + " chữ + " + S.set.newW + " từ, chữ / từ lặp lại nhiều học trước.</p>";
    P.ps.forEach(function (p) { h += planSched(p, t0, im); });
    if (P.ps.length) h += '<div class="legend" style="margin-top:8px"><span style="--k:var(--good-soft)">học đủ</span><span style="--k:var(--warn-soft)">học thiếu</span><span style="--k:var(--seal-soft)">bỏ lỡ</span><span style="--k:var(--accent)">hôm nay</span><span style="--k:var(--surface-2)">ngày ôn</span><span style="--k:var(--accent-soft)">ôn cuối + thi thử</span></div><p class="sub">Số trong ô = số chữ mới (ngày đã qua: số bạn đã học thật; ngày tới: số dự kiến). Bấm vào một ngày để xem học gì. Phần không thuộc kỳ nào bạn đang học được học sau khi các kỳ thi xong (' + S.set.newC + " chữ + " + S.set.newW + " từ mỗi ngày, đổi ở mục Kế hoạch).</p>";
    return h;
  }
  function dayHTML(p, di) {
    var day = p.s + di, t0 = today(), past = day < t0, isT = day === t0, im = introMap()[day] || { c: 0, w: 0, r: 0, s: 0, lt: 0 };
    var h = '<div class="dayd"><div class="row"><b>' + esc(p.T.short) + " · " + wdName(day) + " " + dateOf(day) + " · ngày " + (di + 1) + "/" + p.L + (isT ? " · hôm nay" : "") + '</b><span class="spacer"></span><button class="btn sm ghost" data-close-day>Đóng</button></div>';
    if (di === p.L - 1) h += '<p class="sub">Ngày thi ' + esc(p.T.name) + ".</p>";
    else if (di >= p.newEnd) h += '<p class="sub">Chặng ôn cuối: không thêm bài mới. Ôn thẻ, tập viết, làm đề thi thử ' + esc(p.T.name) + ".</p>";
    else if (di % 7 === 6) h += '<p class="sub">Ngày ôn của tuần: không có bài mới. Ôn thẻ đến hạn, tập viết, chơi Đấu cuối tuần.</p>';
    var any = false;
    if (di < p.newEnd && di % 7 !== 6) PTY.forEach(function (t) {
      var a = di === 0 ? 0 : ptarget(p, t, di - 1), b = ptarget(p, t, di); if (b <= a) return; any = true;
      var list = p.Q[t].slice(a, b), ok = list.filter(function (it) { return got(t, it); }).length;
      h += "<h3>" + PTN[t].charAt(0).toUpperCase() + PTN[t].slice(1) + " mới: " + list.length + ' <small class="muted">· đã học ' + ok + "/" + list.length + '</small></h3><div class="minis">' + list.map(function (it) {
        var k = got(t, it) ? " got" : "", op = t === "lt" ? (it.it ? ' data-open="' + it.it.id + '"' : "") : ' data-open="' + it.id + '"';
        return t === "s" ? '<span class="mini' + k + '"' + op + '><span class="han">' + esc(chars(it.han).slice(0, 8).join("")) + "…</span></span>" : '<span class="mini' + k + '"' + op + '><span class="han">' + esc(it.key) + "</span>" + esc(t === "lt" ? it.am + " · " + it.g : firstAm(it.am)) + "</span>";
      }).join("") + "</div>";
    });
    if (!any && di < p.newEnd && di % 7 !== 6) h += '<p class="sub">Không có bài mới.</p>';
    if (past) h += '<p class="sub" style="margin-top:8px">Hôm đó bạn đã học mới: ' + im.c + " chữ, " + im.w + " từ, " + im.lt + " loại từ, " + im.s + " câu · ôn " + ((S.log[day] || {}).r || 0) + " lượt.</p>";
    else if (isT) { var q = pstate(p, t0).q; h += '<p class="sub" style="margin-top:8px">Hôm nay app giao: ' + q.c + " chữ, " + q.w + " từ, " + q.lt + " loại từ, " + q.s + " câu (đã gồm phần trễ dồn lại). " + '<a href="#hoc-' + p.k + '">Học ngay</a></p>'; }
    return h + "</div>";
  }
  function bindSched(box) {
    function showDay() {
      $$("[data-lday]", box).forEach(function (el) { el.innerHTML = ""; });
      if (!schedSel) return; var p = planOf(schedSel.k), el = $('[data-lday="' + schedSel.k + '"]', box);
      if (p && el) el.innerHTML = dayHTML(p, schedSel.d);
    }
    function draw() { box.innerHTML = schedHTML(); showDay(); }
    box.onclick = function (e) {
      var b = e.target.closest("[data-day]"), x = e.target.closest("[data-close-day]");
      if (b) { var a = b.getAttribute("data-day").split("|"); schedSel = { k: a[0], d: +a[1] }; $$(".dc.sel", box).forEach(function (c) { c.classList.remove("sel"); }); b.classList.add("sel"); showDay(); }
      else if (x) { schedSel = null; $$(".dc.sel", box).forEach(function (c) { c.classList.remove("sel"); }); showDay(); }
    };
    if (!schedSel) { var p0 = PLN().ps[0]; if (p0) schedSel = { k: p0.k, d: Math.max(0, Math.min(p0.L - 1, today() - p0.s)) }; }
    draw();
    return draw;
  }

  // ---------- khung "Chọn kỳ học": tick kỳ, chọn ngày thi (hoặc 4/6/8 tuần), xem trước mỗi ngày học bao nhiêu ----------
  // opts.gate = hộp thoại bắt buộc của người mới (không có tiêu đề riêng; phải chọn ít nhất 1 kỳ; nút Lưu dính đáy).
  // Ngày thi mặc định của kỳ chưa học = ngày thi chung do quản trị đặt (nếu có), không thì 5 tuần.
  function planPick(box, onSave, opts) {
    var t0 = today(), dr = {}, gate = !!(opts && opts.gate);
    TERMS.forEach(function (T) { var p = S.plans[T.k], on = !!(p && !p.x && t0 <= p.e); dr[T.k] = { on: on, s: on ? p.s : t0, e: on ? p.e : (thiChung(T.k, t0) || t0 + 34), old: on }; });
    function hypo() { var P = {}; Object.keys(dr).forEach(function (k) { if (dr[k].on) P[k] = { s: dr[k].s, e: dr[k].e, t: 1, x: 0 }; }); return P; }
    function preview(k) {
      var B = buildPlans(hypo(), t0), p = B.ps.filter(function (x) { return x.k === k; })[0]; if (!p) return "";
      var pd = perDay(p, t0), d = t0 - p.s, heavy = pd.c.per + pd.w.per > 40;
      var parts = [pd.c.per + " chữ + " + pd.w.per + " từ mỗi ngày"];
      parts.push(pd.lt.left ? "loại từ " + (pd.lt.from > d ? "từ ngày " + (pd.lt.from + 1) + " (" + dateOf(p.s + pd.lt.from) + ")" : "từ hôm nay") + ", ~" + pd.lt.per + " từ/ngày" : "loại từ: đã học hết");
      parts.push(pd.s.left ? "câu " + (pd.s.from > d ? "từ ngày " + (pd.s.from + 1) + " (" + dateOf(p.s + pd.s.from) + ")" : "từ hôm nay") + ", ~" + pd.s.per + " câu/ngày" : "câu: đã học hết");
      var shared = B.ps[0] && B.ps[0].k !== k ? " Mục trùng với kỳ thi sớm hơn đã tính ở kỳ đó." : "";
      return (p.e < t0 + 1 ? "" : "<b>" + p.L + " ngày</b> (" + dateOf(p.s) + " → thi " + dateY(p.e) + "): ") + parts.join("; ") + ". " + p.tail + " ngày cuối chỉ ôn + thi thử; cứ 7 ngày có 1 ngày ôn." + shared + (heavy ? ' <span class="chip warn">Khá nặng: nên chọn ngày thi xa hơn nếu được</span>' : "");
    }
    function draw() {
      var h = (gate ? "" : '<div class="row"><h2 style="margin:0">Chọn kỳ học</h2></div><p class="sub">Chọn kỳ muốn học và ngày thi của từng kỳ (học nhiều kỳ cùng lúc được). App tự xếp lịch: chữ + từ học từ ngày đầu (chữ, từ lặp lại nhiều học trước), loại từ từ 1/5 chặng, câu từ nửa chặng, những ngày cuối chỉ ôn + thi thử. Chữ đã học giữ nguyên.</p>') + '<div class="kypick">';
      TERMS.forEach(function (T) {
        var x = dr[T.k];
        h += '<div class="kyp' + (x.on ? " on" : "") + '"><label class="row kyon"><input type="checkbox" data-on="' + T.k + '"' + (x.on ? " checked" : "") + '><b>' + esc(T.name) + '</b><small class="muted">' + T.n.c + " chữ · " + T.n.w + " từ · " + T.n.lt + " loại từ · " + T.n.s + " câu</small></label>";
        if (x.on) h += '<div class="row kyset"><div class="field"><label for="ke-' + T.k + '">Ngày thi</label><input type="date" id="ke-' + T.k + '" data-e="' + T.k + '" value="' + ymd(x.e) + '" min="' + ymd(t0 + 1) + '"></div><div class="row kywk">' + [4, 6, 8, 10].map(function (n) { return '<button type="button" class="btn sm" data-wk="' + T.k + "|" + n + '">' + n + " tuần</button>"; }).join("") + "</div>" + (x.old ? '<button type="button" class="btn sm ghost" data-rs="' + T.k + '">Bắt đầu lại từ hôm nay</button>' : "") + (thiChung(T.k, t0) && thiChung(T.k, t0) !== x.e ? '<button type="button" class="btn sm ghost" data-tc="' + T.k + '">Dùng ngày thi chung ' + dateY(thiChung(T.k, t0)) + "</button>" : "") + '</div>' + (thiChung(T.k, t0) ? '<p class="sub">Ngày thi chung do quản trị viên đặt: <b>' + dateY(thiChung(T.k, t0)) + "</b>.</p>" : "") + '<p class="sub kypv">' + preview(T.k) + "</p>";
        h += "</div>";
      });
      h += '</div><div class="row' + (gate ? " acts" : "") + '"><button type="button" class="btn primary" id="kysave">' + (gate ? "Lưu lộ trình và bắt đầu học" : "Lưu lộ trình") + '</button><span class="muted" id="kymsg" style="font-size:0.85rem" role="status"></span></div>';
      box.innerHTML = h;
      $$("[data-on]", box).forEach(function (c) { c.onchange = function () { var x = dr[c.getAttribute("data-on")]; x.on = c.checked; if (x.on && !x.old) { x.s = t0; } draw(); }; });
      $$("[data-e]", box).forEach(function (c) { c.onchange = function () { var n = fromYmd(c.value), x = dr[c.getAttribute("data-e")]; if (n == null || n <= t0) { toast("Hãy chọn ngày thi sau hôm nay"); draw(); return; } x.e = n; draw(); }; });
      $$("[data-wk]", box).forEach(function (b) { b.onclick = function () { var a = b.getAttribute("data-wk").split("|"), x = dr[a[0]]; x.e = Math.max(t0, x.s) + 7 * (+a[1]) - 1; if (x.e <= t0) x.e = t0 + 1; draw(); }; });
      $$("[data-tc]", box).forEach(function (b) { b.onclick = function () { var k = b.getAttribute("data-tc"), x = dr[k]; x.e = thiChung(k, t0) || x.e; draw(); }; });
      $$("[data-rs]", box).forEach(function (b) { b.onclick = function () { var x = dr[b.getAttribute("data-rs")]; x.s = t0; if (x.e <= t0) x.e = t0 + 34; draw(); $("#kymsg", box).textContent = "Bấm Lưu lộ trình để áp dụng."; }; });
      $("#kysave", box).onclick = function () {
        var now = Date.now(), n = 0;
        if (gate && !Object.keys(dr).some(function (k) { return dr[k].on; })) { $("#kymsg", box).textContent = "Hãy chọn ít nhất 1 kỳ và ngày thi."; toast("Hãy chọn ít nhất 1 kỳ và ngày thi"); var kp = $(".kypick", box); if (kp && kp.scrollIntoView) try { kp.scrollIntoView({ block: "start", behavior: "smooth" }); } catch (e) { } return; }
        Object.keys(dr).forEach(function (k) {
          var x = dr[k], p = S.plans[k], act = !!(p && !p.x && t0 <= p.e);
          if (x.on && (!act || p.s !== x.s || p.e !== x.e)) { S.plans[k] = { s: x.s, e: x.e, t: now, x: 0 }; n++; }
          else if (!x.on && act) { S.plans[k] = { s: p.s, e: p.e, t: now, x: now }; n++; }
        });
        if (n) { save(); toast("Đã lưu lộ trình, app đã xếp lại lịch học"); } else toast("Lộ trình không đổi");
        if (onSave) onSave(); else draw();
      };
    }
    draw();
  }
  function nextBatch(sec, q, extra) { // bài học mới của một mục: chữ/từ/bộ thủ (cw), câu (s), loại từ (lt)
    var Q = secQ(sec); if (!Q) return { cw: [], s: [], lt: [] };
    q = q || secQuota(sec); extra = extra || 0;
    var cs = Q.c.filter(function (c) { return !introduced(c.id); }).slice(0, (q.c || 0) + extra);
    var known = {}; learnedOf("c").forEach(function (c) { known[c.c] = 1; }); cs.forEach(function (c) { known[c.c] = 1; });
    var wsAll = Q.w.filter(function (w) { return !introduced(w.id); }), nw = (q.w || 0) + Math.round(extra * 0.8);
    var ready = wsAll.filter(function (w) { return chars(w.w).every(function (ch) { return known[ch] || !CHAR[ch]; }); });
    var ws = ready.slice(0, nw);
    if (ws.length < nw) ws = ws.concat(wsAll.filter(function (w) { return ws.indexOf(w) < 0; }).slice(0, nw - ws.length));
    var rs = sec === "chung" ? QR.filter(function (r) { return !introduced(r.id); }).slice(0, q.r || 0) : [];
    var ss = Q.s.filter(function (s) { return !introduced(s.id); }).slice(0, q.s || 0);
    var ls = Q.lt.filter(function (x) { return !ltGot(x.x); }).slice(0, q.lt || 0);
    return { cw: rs.concat(cs, ws), s: ss, lt: ls };
  }

  // ---------- UI basics ----------
  var layer;
  function toast(msg) { var t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); t.textContent = msg; document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2600); }
  HC.toast = toast;
  // Hiện điểm cộng: chữ "+N XP" bay lên từ nút vừa bấm (không có nút → huy hiệu nổi gần ô XP / đầu màn hình);
  // cộng liên tiếp trong 0,6 giây gộp thành 1 huy hiệu; lên cấp → khung chúc mừng. Chỉ chữ Latinh (không qua songWatch), không thuộc S.
  var xpBox = null, xpTot = 0, xpTm = 0, xpSnd = 0;
  function visEl(e) { if (!e || !e.getBoundingClientRect || !document.body.contains(e)) return null; var r = e.getBoundingClientRect(); return (r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight) ? r : null; }
  function xpShow(n, el, newLv) {
    try {
      var pill = document.querySelector("#stats .pill.xp");
      if (pill) { pill.textContent = fmt(S.xp) + " XP"; pill.classList.remove("bump"); void pill.offsetWidth; pill.classList.add("bump"); }
      var now = Date.now(), r = null;
      if (xpBox && now - xpTm < 600 && document.body.contains(xpBox)) xpTot += n;
      else {
        if (xpBox) xpBox.remove();
        var a = document.activeElement;
        r = visEl(el) || (a && a !== document.body && /^(BUTTON|A|INPUT|LABEL)$/.test(a.tagName) ? visEl(a) : null);
        xpBox = document.createElement("div"); xpTot = n;
        if (r) { xpBox.className = "xpfly"; xpBox.style.left = Math.max(8, Math.min(innerWidth - 90, r.left + r.width / 2 - 34)) + "px"; xpBox.style.top = Math.max(8, r.top - 8) + "px"; }
        else {
          xpBox.className = "xpfly xpbadge"; var pr = visEl(pill);
          if (pr) { xpBox.style.left = Math.max(8, Math.min(innerWidth - 110, pr.left + pr.width / 2 - 45)) + "px"; xpBox.style.top = (pr.bottom + 50 > innerHeight ? pr.top - 44 : pr.bottom + 6) + "px"; } // thanh dọc: ô XP ở đáy → hiện phía trên
        }
        document.body.appendChild(xpBox);
      }
      xpTm = now;
      xpBox.textContent = "+" + xpTot + " XP"; xpBox.classList.remove("go"); void xpBox.offsetWidth; xpBox.classList.add("go");
      var box = xpBox; clearTimeout(box._t); box._t = setTimeout(function () { box.remove(); if (xpBox === box) xpBox = null; }, 1300);
      if (newLv) lvUp(newLv); else if (now - xpSnd > 110) { xpSnd = now; coin(n); }
    } catch (e) { }
  }
  function flyXP(n, el) { // Ôn thẻ / Tập viết gọi sau grade(): dời "+N XP" vừa hiện (trong addXP) về đúng nút vừa bấm
    try { var r = visEl(el); if (!r || !xpBox || Date.now() - xpTm > 600) return; xpBox.className = "xpfly go"; xpBox.style.left = Math.max(8, Math.min(innerWidth - 90, r.left + r.width / 2 - 34)) + "px"; xpBox.style.top = Math.max(8, r.top - 8) + "px"; } catch (e) { }
  }
  function lvUp(L) {
    var o = document.createElement("div"); o.className = "lvup"; o.setAttribute("role", "status");
    o.innerHTML = '<div class="lvcard"><div class="lvs">★ ★ ★</div><b>Lên cấp ' + L + '!</b><span>Giỏi lắm, học tiếp nào!</span></div>';
    document.body.appendChild(o); setTimeout(function () { o.remove(); }, 2600);
    tones([523, 659, 784, 1047, 1319], 0.1, 0.07);
  }
  function coin(n) { var k = n >= 8 ? 4 : n >= 4 ? 3 : n >= 2 ? 2 : 1; tones([988, 1319, 1568, 1976].slice(0, k), 0.07, 0.05, 0.12); }
  function tones(fs, step, vol, delay) { // nốt ngắn kiểu đồng xu; theo công tắc âm thanh trong Cài đặt
    if (!S || !S.set.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      var t0 = actx.currentTime + (delay || 0);
      fs.forEach(function (f, i) {
        var o = actx.createOscillator(), g = actx.createGain(), t = t0 + i * step; o.connect(g); g.connect(actx.destination);
        o.type = "triangle"; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + (i === fs.length - 1 ? 0.35 : 0.16));
        o.start(t); o.stop(t + 0.4);
      });
    } catch (e) { }
  }
  var actx = null;
  function beep(ok) {
    if (!S || !S.set.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      var o = actx.createOscillator(), g = actx.createGain(); o.connect(g); g.connect(actx.destination);
      o.type = "sine"; o.frequency.value = ok ? 880 : 220; g.gain.setValueAtTime(0.06, actx.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + (ok ? 0.18 : 0.3));
      o.start(); o.stop(actx.currentTime + 0.32);
      if (ok) { var o2 = actx.createOscillator(), g2 = actx.createGain(); o2.connect(g2); g2.connect(actx.destination); o2.frequency.value = 1320; g2.gain.setValueAtTime(0.04, actx.currentTime + 0.09); g2.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + 0.3); o2.start(actx.currentTime + 0.09); o2.stop(actx.currentTime + 0.32); }
    } catch (e) { }
  }
  HC.beep = beep;
  function modal(html, onClose) {
    layer.innerHTML = '<div class="modal" role="dialog" aria-modal="true"><div class="box"><button class="btn sm ghost x" data-x aria-label="Đóng">✕</button>' + html + "</div></div>";
    var m = layer.firstChild;
    function close() { layer.innerHTML = ""; document.removeEventListener("keydown", k); if (onClose) onClose(); }
    function k(e) { if (e.key === "Escape") close(); }
    m.addEventListener("click", function (e) { if (e.target === m || e.target.closest("[data-x]")) close(); });
    document.addEventListener("keydown", k);
    return { el: m, close: close };
  }
  HC.modal = modal;

  // meaning html for any item
  function meanHTML(it) {
    var h = "";
    if (it.ns) h += '<div class="ns">' + esc(it.ns) + "</div>";
    if (it.nb) h += '<div class="nb">' + esc(it.nb) + "</div>";
    return h;
  }
  HC.meanHTML = meanHTML;
  function kindLabel(it) { return { c: "Chữ", w: it && chars(it.w).length > 2 ? "Cụm từ" : "Từ", r: "Bộ thủ", s: "Câu" }[it.type]; }
  HC.kindLabel = kindLabel;

  // ---------- dạng rút gọn (giản thể) + các dạng của bộ khi nằm trong chữ ----------
  // chữ / từ: gt = dạng rút gọn (tài liệu không ghi → tra bằng OpenCC, hiện ※); gtc = chữ khác cùng dạng rút gọn (發, 髮 → 发);
  // gts = dạng rút gọn trùng một chữ phồn thể khác (後 → 后); dt = dị thể; bf = bộ của chữ viết theo dạng nào (氵 trong 法).
  // bộ: forms = [{f dạng, k bo|gt|kh, p vị trí, src GT giáo trình HK1 | TD tra từ điển, note, ex chữ ví dụ}] (tools/work/forms.txt)
  var FKIND = { bo: "Khi làm bộ trong chữ", gt: "Dạng rút gọn (giản thể)", kh: "Dạng khác / chữ liên quan" };
  var FPOS = { "trái": "đứng bên trái", "phải": "đứng bên phải", "trên": "ở trên", "dưới": "ở dưới", "bao": "bao bên trái và bên dưới" };
  function posText(p) { return String(p || "").split("/").map(function (x) { return FPOS[x] || x; }).join(" hoặc "); }
  function linkCh(ch) { var c = CHAR[ch]; return c ? '<a href="#" class="lk" data-open="' + c.id + '"><span class="han">' + esc(ch) + "</span> " + esc(firstAm(c.am)) + "</a>" : '<span class="han">' + esc(ch) + "</span>"; }
  function radOfKey(ch) { for (var k in RAD) if (RAD[k].r === ch) return RAD[k]; return null; }
  function gtHTML(it) {
    var oth = chars(it.gtc || "");
    if (!it.gt && !oth.length) return "";
    var h = '<div class="alt"><div class="facts"><span class="k">Dạng rút gọn (giản thể)</span></div>';
    if (it.gt) {
      h += '<div class="altrow">' + aniHTML(it.gt, { cls: "sm" }) + '<div class="altt"><div><span class="han gtt">' + esc(it.gt) + '</span></div><div class="nb">tra từ điển (OpenCC), tài liệu không ghi · bài thi viết chữ phồn thể <span class="han">' + esc(it.key) + "</span></div>";
      if (oth.length) h += '<div>Dạng rút gọn <span class="han">' + esc(it.gt) + "</span> dùng chung cho: " + oth.map(linkCh).join(", ") + " — đọc theo nghĩa câu để biết là chữ nào</div>";
      if (it.gts && oth.indexOf(it.gt) < 0) h += '<div class="nb"><span class="han">' + esc(it.gt) + "</span> cũng là một chữ phồn thể khác" + (CHAR[it.gt] ? ": " + linkCh(it.gt) : "") + ", đừng nhầm với <span class=\"han\">" + esc(it.key) + "</span></div>";
      h += "</div></div>";
    } else h += '<div>Chữ <span class="han">' + esc(it.key) + "</span> viết rút gọn vẫn như cũ, và cũng là dạng rút gọn của: " + oth.map(linkCh).join(", ") + ' <span class="nb">tra từ điển</span></div>';
    return h + "</div>";
  }
  function formsHTML(r) {
    var fs = r.forms || [];
    if (!fs.length) return "";
    var h = '<div class="alt"><div class="facts"><span class="k">Các dạng khác của bộ <span class="han">' + esc(r.r) + "</span> " + esc(r.am) + "</span></div>";
    ["bo", "gt", "kh"].forEach(function (k) {
      fs.filter(function (f) { return f.k === k; }).forEach(function (f) {
        h += '<div class="altrow">' + aniHTML(f.f, { cls: "sm", still: true }) + '<div class="altt"><div><b>' + FKIND[k] + "</b>" + (f.p ? " · " + posText(f.p) : "") + "</div><div>" + (f.src === "GT" ? '<span class="muted">Dạng <span class="han">' + esc(f.f) + "</span> có trong bảng 214 bộ thủ (giáo trình HK1)</span>" : '<span class="nb">dạng <span class="han">' + esc(f.f) + "</span> tra từ điển, giáo trình không ghi</span>") + "</div>" + (f.note ? '<div class="nb">' + esc(f.note) + "</div>" : "");
        if (f.ex) h += '<div class="fex">' + f.ex.slice(0, 4).map(function (ch) {
          var c = CHAR[ch], g = k === "gt" && c && c.gt;
          return '<span class="fx">' + aniHTML(g ? c.gt : ch, { cls: "xs", still: true, rad: !g }) + "<span>" + linkCh(ch) + (g ? ' → <span class="han">' + esc(c.gt) + "</span>" : "") + "</span></span>";
        }).join("") + "</div>" + (f.ex.length > 4 ? '<div class="muted" style="font-size:0.82rem">Chữ khác: ' + f.ex.slice(4).map(linkCh).join(", ") + "</div>" : "");
        h += "</div></div>";
      });
    });
    return h + '<div class="muted" style="font-size:0.8rem">Trong chữ ví dụ, phần tô màu là bộ <span class="han">' + esc(r.r) + "</span>. Bấm vào ô chữ để xem viết lại.</div></div>";
  }
  HC.gtHTML = gtHTML; HC.formsHTML = formsHTML;

  // ---------- detail sheet ----------
  function detailHTML(it) {
    // câu: không hiện chữ to ở đầu (câu đã hiện đầy đủ kèm âm ở dưới)
    // chữ / từ / bộ thủ: hoạt hình thứ tự nét (aniHTML), chữ không có dữ liệu nét thì hiện chữ MS Song như cũ
    var big = it.type === "s" ? "" : aniHTML(it.key, { rad: it.type === "c" && !!it.bf });
    var own = !!it.id; // MỌI mục (chữ, từ, câu, bộ thủ — người dùng yêu cầu 25/11/2026) có ⋯ (kho khó, playlist, ghi chú)
    var h = '<div class="learn" data-detail="' + it.id + '"><div class="top' + (big ? "" : " nobig") + '">' + big + '<div class="facts">';
    h += '<div class="row"><span class="chip">' + kindLabel(it) + "</span>" + (it.k10 ? '<span class="chip k10">Đề K10</span>' : "") + (it.tag || []).map(function (t) { return '<span class="chip warn">' + esc(t) + "</span>"; }).join("") + (it.n ? '<span class="chip ok num">' + it.n + " lần</span>" : "") + (own ? '<span class="chip hs' + (isHard(it.id) ? "" : " hide") + '" data-hs="' + it.id + '">★ Kho khó</span><span class="spacer"></span>' + moreBtn(it.id) : "") + "</div>";
    h += '<div style="font-size:1.4rem;font-weight:700">' + esc(it.am) + "</div>" + meanHTML(it);
    if (it.type === "c") {
      var bits = [];
      if (it.dt) bits.push('Dị thể (cách viết khác): <span class="han">' + esc(chars(it.dt).join(" ")) + "</span>");
      if (it.net) bits.push(it.net + " nét");
      if (it.rad) { var r = RAD[it.rad]; bits.push('Bộ <a href="#" data-open="' + r.id + '" class="han">' + esc(r.r) + "</a> " + esc(r.am) + (r.ns ? " (" + esc(r.ns) + ")" : "") + (it.bf && it.bf !== r.r ? ' — trong chữ này viết <b class="han" style="font-size:1.3em">' + esc(it.bf) + "</b>" : "") + (it.bf ? " (phần tô màu trong hoạt hình)" : "")); }
      else if (it.bo) bits.push("Bộ " + esc(it.bo));
      if (bits.length) h += '<div class="muted" style="font-size:0.88rem">' + bits.join(" · ") + "</div>";
    }
    if (it.type === "r") {
      h += '<div class="muted" style="font-size:0.88rem">Bộ số ' + it.no + " · " + (it.net || "?") + " nét" + (it.forms ? "" : it.vars ? ' · dạng khác: <span class="han">' + esc(chars(it.vars).join(" ")) + "</span>" : "") + "</div>";
      if (it.verse) h += '<div class="muted" style="font-size:0.88rem">Vần nhớ (bảng 214 bộ của HT. Thích Hoàn Quan): <b>' + esc(it.verse) + "</b>" + (it.note ? " — " + esc(it.note) : "") + "</div>";
    }
    if (it.type === "s") h += '<div class="muted" style="font-size:0.85rem">' + esc(it.set) + " · câu " + it.no + (it.write ? " · phần viết chữ Hán" : "") + "</div>";
    h += "</div></div>";
    if (it.type === "c" || it.type === "w") h += gtHTML(it);
    if (it.type === "r") h += formsHTML(it);
    if (it.type === "c") { var rk = radOfKey(it.key); if (rk) h += formsHTML(rk); }
    if (it.type === "c") {
      var ws = (it.inw || []).map(function (id) { return ITEM[id]; }).filter(Boolean);
      if (ws.length) h += '<div><div class="facts"><span class="k">Có trong các từ</span></div><div class="minis">' + ws.map(miniHTML).join("") + "</div></div>";
      var ss = (it.ins || []).map(function (id) { return ITEM[id]; }).filter(Boolean);
      if (ss.length) h += '<div><div class="facts"><span class="k">Có trong câu</span></div>' + ss.map(function (s) { return '<div class="mini" data-open="' + s.id + '" style="margin-bottom:6px"><span class="han">' + esc(s.han) + "</span><br><small class=\"muted\">" + esc(s.pa) + "</small></div>"; }).join("") + "</div>";
    }
    if (it.type === "w") {
      var parts = chars(it.w).map(function (ch) { return CHAR[ch]; }).filter(Boolean);
      h += '<div><div class="facts"><span class="k">Từng chữ</span></div><div class="minis">' + parts.map(miniHTML).join("") + "</div></div>";
    }
    if (it.type === "r" && it.members.length) {
      h += '<div><div class="facts"><span class="k">Chữ thuộc bộ này (' + it.members.length + ")</span></div><div class=\"minis\">" + it.members.slice(0, 40).map(miniHTML).join("") + "</div></div>";
    }
    if (it.type === "s") {
      h += '<div class="sent">' + rubyHTML(it, false, true) + '</div><div style="font-weight:600">' + esc(it.pa) + '</div><div>' + esc(it.dn) + "</div>";
      h += sentCharsHTML(it);
    }
    if (it.type === "c" || it.type === "r") h += giaiHTML(it) + sachHTML(it);
    if (own) h += noteHTML(it.id);
    if (it.type === "c" || it.type === "w") h += occHTML(it);
    var r2 = S.it[it.id];
    h += '<div class="muted" style="font-size:0.82rem">' + (r2 ? "Đã học từ " + dateOf(r2[5]) + " · mức nhớ " + r2[0] + (r2[2] >= 0 ? " · mức viết " + r2[2] : "") + (r2[4] ? " · quên " + r2[4] + " lần" : "") : "Chưa học") + "</div>";
    return h + "</div>";
  }
  // "Xuất hiện mấy lần, ở đâu" — CÙNG MỘT DẠNG cho mọi chữ / từ (khung chi tiết, học mới, tra cứu; bản gọn ở mặt sau thẻ ôn).
  // Số lần: it.f theo từng tài liệu trong D.srcs. Ở đâu: it.src (vị trí trong danh sách từ vựng / bảng loại từ / từ ngữ pháp);
  // mục không nằm trong danh sách nào vẫn có dòng "Ở đâu" ghi rõ là chỉ gặp trong bài, câu, từ ghép.
  function occHTML(it, compact) {
    var fx = it.f || {}, list = (D.srcs || []).filter(function (s) { return !compact || fx[s.k]; });
    var cnt = list.map(function (s) { return esc(s.name) + " " + (fx[s.k] || 0); }).join(" · ");
    var where = it.src && it.src.length ? esc(it.src.join("; ")) : "không nằm trong danh sách từ vựng hay bảng loại từ nào của tài liệu — chỉ gặp trong bài, câu hoặc từ ghép";
    if (compact) return '<div class="extra">Xuất hiện ' + (it.n || 0) + " lần: " + cnt + "<br>Ở đâu: " + where + "</div>";
    return '<div class="muted" style="font-size:0.82rem"><div><b>Xuất hiện ' + (it.n || 0) + " lần</b> trong " + list.length + " tài liệu: " + cnt + "</div><div><b>Ở đâu:</b> " + where + "</div></div>";
  }
  HC.occHTML = occHTML;
  // câu: hàng "Từng chữ" (bỏ chữ trùng, bỏ dấu câu) — bấm vào chữ để mở chi tiết chữ đó
  function sentCharsHTML(s) {
    var seen = {}, list = chars(s.han).filter(function (ch) { if (!isHan(ch) || seen[ch]) return false; seen[ch] = 1; return true; });
    if (!list.length) return "";
    return '<div><div class="facts"><span class="k">Từng chữ (' + list.length + ')</span></div><div class="minis">' + list.map(function (ch) { return CHAR[ch] ? miniHTML(CHAR[ch]) : '<span class="mini nolk"><span class="han">' + esc(ch) + "</span></span>"; }).join("") + "</div></div>";
  }
  HC.sentCharsHTML = sentCharsHTML;
  function miniHTML(it) { return '<span class="mini" data-open="' + it.id + '"><span class="han">' + esc(it.key) + "</span>" + esc(firstAm(it.am)) + "</span>"; }
  HC.miniHTML = miniHTML;
  function openDetail(id) { var it = ITEM[id]; if (it) modal(detailHTML(it)); }
  HC.openDetail = openDetail;
  document.addEventListener("click", function (e) { var o = e.target.closest("[data-open]"); if (o) { e.preventDefault(); openDetail(o.getAttribute("data-open")); } });

  // ---------- nút ⋯ của mỗi chữ / từ / câu: kho khó, ghi chú (playlist: Bước 2, giải thích: Bước 4) ----------
  function moreBtn(id) { return '<button type="button" class="more' + (isHard(id) ? " on" : "") + '" data-more="' + id + '" aria-label="Thêm: kho khó, playlist, cách nhớ, ghi chú" title="Kho khó, playlist, cách nhớ, ghi chú">⋯</button>'; }
  HC.moreBtn = moreBtn;
  var pop = null;
  function closePop() { if (pop) { pop.remove(); pop = null; } var mm = document.getElementById("mmore"); if (mm) mm.setAttribute("aria-expanded", "false"); }
  function inDetailOf(el, id) { var d = el.closest("[data-detail]"); return !!d && d.getAttribute("data-detail") === id; }
  function openMore(btn) {
    var id = btn.getAttribute("data-more"), it = ITEM[id];
    if (!it) return;
    if (pop && pop.getAttribute("data-for") === id) { closePop(); return; }
    closePop();
    var hard = isHard(id), nt = noteOf(id), nm = noteOf(id, "meo");
    var h = '<div class="ph"><span class="han">' + esc(it.type === "s" ? it.han.slice(0, 14) + (it.han.length > 14 ? "…" : "") : it.key) + "</span> " + esc(kindLabel(it)) + "</div>" +
      '<button type="button" data-pm="hard">' + (hard ? "★ Bỏ khỏi kho khó" : "☆ Thêm vào kho khó") + "</button>" +
      '<button type="button" data-pm="pl">≡ Thêm vào playlist…</button>' +
      '<button type="button" data-pm="meo">✎ ' + (nm ? "Sửa cách nhớ" : "Cách nhớ (mọi người thấy)") + "</button>" +
      '<button type="button" data-pm="note">✎ ' + (nt ? "Sửa ghi chú khác" : "Ghi chú khác (chỉ bạn thấy)") + "</button>" +
      '<button type="button" data-pm="all">☰ Cách nhớ của mọi người</button>' +
      (it.type === "c" || it.type === "r" ? '<button type="button" data-pm="giai">※ Giải thích</button>' : "") +
      (inDetailOf(btn, id) ? "" : '<button type="button" data-pm="open">ⓘ Xem chi tiết</button>');
    pop = document.createElement("div");
    pop.className = "pop"; pop.setAttribute("role", "menu"); pop.setAttribute("data-for", id); pop.innerHTML = h;
    document.body.appendChild(pop);
    var r = btn.getBoundingClientRect(), W = window.innerWidth, H = window.innerHeight, pw = pop.offsetWidth, ph = pop.offsetHeight;
    var x = Math.max(8, Math.min(r.right - pw, W - pw - 8)), y = r.bottom + 6;
    if (y + ph > H - 8) y = Math.max(8, r.top - ph - 6);
    pop.style.left = x + "px"; pop.style.top = y + "px";
    pop.addEventListener("click", function (e) {
      var b = e.target.closest("[data-pm]"); if (!b) return;
      e.stopPropagation();
      var a = b.getAttribute("data-pm"); closePop();
      if (a === "hard") { var on = HC.toggleHard(id); refreshHard(id); toast(on ? "Đã thêm vào kho khó" : "Đã bỏ khỏi kho khó"); }
      else if (a === "note") editNote(id, "ghi");
      else if (a === "meo") editNote(id, "meo");
      else if (a === "all") meoSheet(id);
      else if (a === "pl") pickPl(id);
      else if (a === "giai") showGiai(id);
      else if (a === "open") openDetail(id);
    });
    try { pop.querySelector("button").focus({ preventScroll: true }); } catch (e) { }
  }
  function refreshHard(id) {
    var on = isHard(id);
    $$('[data-more="' + id + '"]').forEach(function (b) { b.classList.toggle("on", on); });
    $$('[data-hs="' + id + '"]').forEach(function (s) { s.classList.toggle("hide", !on); });
    if (khoRender) khoRender();
  }
  var khoRender = null; // màn Kho khó đang mở → vẽ lại khi kho / playlist đổi

  // ---------- chọn playlist cho 1 mục: khung riêng nằm TRÊN khung chi tiết (không đóng khung chi tiết đang mở) ----------
  var sheetEl = null;
  function closeSheet() { if (sheetEl) { var f = sheetEl._onClose; sheetEl.remove(); sheetEl = null; if (f) f(); } }
  function plSheet(html, onClose) {
    closeSheet();
    sheetEl = document.createElement("div");
    sheetEl.className = "modal sheet"; sheetEl.setAttribute("role", "dialog"); sheetEl.setAttribute("aria-modal", "true");
    sheetEl.innerHTML = '<div class="box"><button type="button" class="btn sm ghost x" data-sx aria-label="Đóng">✕</button>' + html + "</div>";
    sheetEl._onClose = onClose;
    sheetEl.addEventListener("click", function (e) { if (e.target === sheetEl || e.target.closest("[data-sx]")) closeSheet(); });
    document.body.appendChild(sheetEl);
    return sheetEl;
  }
  document.addEventListener("keydown", function (e) { if (sheetEl && e.key === "Escape") { e.stopPropagation(); closeSheet(); } }, true);
  window.addEventListener("hashchange", closeSheet);
  function itemTitle(it) { return it.type === "s" ? it.han.slice(0, 14) + (it.han.length > 14 ? "…" : "") : it.key; }
  function pickPl(id) {
    var it = ITEM[id]; if (!it) return;
    var el = plSheet('<h2 style="margin:0 40px 4px 0">Thêm vào playlist · <span class="han">' + esc(itemTitle(it)) + '</span></h2><p class="sub">Đánh dấu để thêm, bỏ dấu để bớt. Mục ở trong playlist thì cũng ở trong kho khó.</p><div class="plpick" id="plp"></div><div class="row plnew"><input type="text" id="pln" maxlength="' + PL_MAX + '" placeholder="Tên playlist mới, vd Bài 3" aria-label="Tên playlist mới"><button type="button" class="btn primary" id="plc">Tạo và thêm</button></div>', function () { refreshHard(id); });
    var box = el.querySelector("#plp"), inp = el.querySelector("#pln");
    function draw() {
      var L = HC.plList();
      box.innerHTML = L.length ? L.map(function (p) {
        return '<label class="plck"><input type="checkbox" data-pk="' + p.id + '"' + (plHas(p.id, id) ? " checked" : "") + '><span>' + esc(p.n) + '</span><span class="chip num">' + p.ids.length + "</span></label>";
      }).join("") : '<p class="sub">Chưa có playlist nào. Gõ tên bên dưới để tạo.</p>';
    }
    box.addEventListener("change", function (e) {
      var c = e.target.closest("[data-pk]"); if (!c) return;
      HC.plToggle(c.getAttribute("data-pk"), id, c.checked); draw(); refreshHard(id);
    });
    function create() {
      var k = HC.plCreate(inp.value);
      if (!k) { toast("Hãy gõ tên playlist"); inp.focus(); return; }
      HC.plToggle(k, id, true); inp.value = ""; draw(); refreshHard(id); toast("Đã tạo playlist và thêm mục");
    }
    el.querySelector("#plc").onclick = create;
    inp.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); create(); } });
    draw();
  }
  HC.pickPl = pickPl;
  // bắt ở pha capture: bấm ⋯ không lật thẻ, không mở chi tiết, không đóng khung
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-more]");
    if (b) { e.preventDefault(); e.stopPropagation(); openMore(b); return; }
    var mm = e.target.closest && e.target.closest("#mmore"); // nút » của thanh mục (định nghĩa ở phần router)
    if (mm) { e.preventDefault(); e.stopPropagation(); openMenuMore(mm); return; }
    if (pop && !e.target.closest(".pop")) { closePop(); }
  }, true);
  document.addEventListener("keydown", function (e) { if (pop && e.key === "Escape") { e.stopPropagation(); closePop(); } }, true);
  window.addEventListener("resize", closePop);
  window.addEventListener("scroll", closePop, true);
  window.addEventListener("hashchange", closePop);

  // ---------- ghi chú (chỉ lưu trong tiến độ của người học) ----------
  // Ô soạn có định dạng (contenteditable): đậm/nghiêng/gạch chân, màu chữ tc1–6, tô nền hl1–4, cỡ chữ fs1–4 (fs2 = thường),
  // link http/https. Màu/cỡ lưu bằng LỚP (đổi theo chế độ sáng/tối), không lưu mã màu. Tự lưu sau khi ngừng gõ 0,7 giây.
  var NOTE_HTML_MAX = 8000, NOTE_N = { tc: 6, hl: 4, fs: 4 }, NOTE_G = ["", "tc", "hl", "fs", "x"];
  var NOTE_SKIP = { script: 1, style: 1, template: 1, noscript: 1, title: 1, head: 1, iframe: 1, object: 1, embed: 1, svg: 1, math: 1, img: 1, video: 1, audio: 1, input: 1, textarea: 1, select: 1, button: 1 };
  function noteRich(t) { return /<\/?(b|i|u|br|div|span|a|p|font|strong|em)(\s[^>]*)?\/?>/i.test(t) || /&(amp|lt|gt|quot|nbsp|#\d+);/.test(t); }
  function noteDoc(t) { try { return new DOMParser().parseFromString("<!doctype html><body>" + t, "text/html").body; } catch (e) { return null; } }
  function noteTxt(t) { t = String(t || ""); if (!noteRich(t)) return t; var b = noteDoc(t); return b ? b.textContent : t; }
  function noteClean(t) {
    t = String(t || ""); if (!t) return "";
    if (!noteRich(t)) return esc(t).replace(/\r?\n/g, "<br>");
    var body = noteDoc(t); if (!body) return esc(t);
    function okCls(c) { var m = /^(tc|hl|fs)(\d)$/.exec(c); return !!m && +m[2] <= NOTE_N[m[1]] && c !== "fs0"; }
    function walk(n) {
      var h = "";
      for (var c = n.firstChild; c; c = c.nextSibling) {
        if (c.nodeType === 3) { h += esc(c.nodeValue); continue; }
        if (c.nodeType !== 1) continue;
        var tg = c.tagName.toLowerCase();
        if (NOTE_SKIP[tg]) continue;
        var w = walk(c);
        if (tg === "br") h += "<br>";
        else if (tg === "div" || tg === "p") h += "<div>" + (w || "<br>") + "</div>";
        else if (!w) continue;
        else if (tg === "b" || tg === "strong") h += "<b>" + w + "</b>";
        else if (tg === "i" || tg === "em") h += "<i>" + w + "</i>";
        else if (tg === "u") h += "<u>" + w + "</u>";
        else if (tg === "a") { var hr = c.getAttribute("href") || ""; h += /^https?:\/\/[^\s"'<>]+$/i.test(hr) ? '<a href="' + esc(hr) + '" target="_blank" rel="noopener noreferrer">' + w + "</a>" : w; }
        else if (tg === "span" || tg === "font") {
          var st = c.style, cl = String(c.getAttribute("class") || "").split(/\s+/).filter(okCls);
          if (st && /bold|^[6-9]00$/.test(st.fontWeight || "")) w = "<b>" + w + "</b>";
          if (st && /italic/.test(st.fontStyle || "")) w = "<i>" + w + "</i>";
          if (st && /underline/.test((st.textDecorationLine || "") + " " + (st.textDecoration || ""))) w = "<u>" + w + "</u>";
          h += cl.length ? '<span class="' + cl.join(" ") + '">' + w + "</span>" : w;
        }
        else h += w;
      }
      return h;
    }
    return walk(body);
  }
  HC.noteClean = noteClean;
  // 2 ô (Bước 8): k = "meo" (Cách nhớ — mọi người thấy) | "ghi" (Ghi chú khác = S.note cũ, chỉ mình thấy). Không truyền k = cả 2 ô.
  function noteHTML(id, k) {
    if (!k) return noteHTML(id, "meo") + noteHTML(id, "ghi");
    return '<div class="note" data-note="' + id + '" data-nk="' + k + '">' + noteInner(id, "view", k) + "</div>";
  }
  function nkOf(box) { return box.getAttribute("data-nk") === "meo" ? "meo" : "ghi"; }
  var NOTE_TB = '<div class="ntb" role="toolbar" aria-label="Định dạng ghi chú">' +
    '<button type="button" data-ncmd="bold" title="In đậm (Ctrl+B)" aria-label="In đậm"><b>B</b></button>' +
    '<button type="button" data-ncmd="italic" title="In nghiêng (Ctrl+I)" aria-label="In nghiêng"><i>I</i></button>' +
    '<button type="button" data-ncmd="underline" title="Gạch chân (Ctrl+U)" aria-label="Gạch chân"><u>U</u></button>' +
    '<button type="button" data-npop="tc" title="Màu chữ" aria-label="Màu chữ"><span class="tbA">A</span></button>' +
    '<button type="button" data-npop="hl" title="Tô nền chữ" aria-label="Tô nền chữ"><span class="tbH">ab</span></button>' +
    '<button type="button" data-npop="fs" title="Cỡ chữ" aria-label="Cỡ chữ"><small>a</small>A</button>' +
    '<button type="button" data-npop="ln" title="Gắn link" aria-label="Gắn link">🔗</button>' +
    '<button type="button" data-ncmd="clear" title="Xóa định dạng" aria-label="Xóa định dạng"><s>T</s></button>' +
    "</div>";
  function notePopHTML(k) {
    var h = "", i;
    if (k === "tc") { for (i = 1; i <= NOTE_N.tc; i++) h += '<button type="button" class="sw tc' + i + '" data-nset="tc' + i + '" aria-label="Màu ' + i + '">A</button>'; h += '<button type="button" class="sw" data-nset="tc0">Bỏ màu</button>'; }
    else if (k === "hl") { for (i = 1; i <= NOTE_N.hl; i++) h += '<button type="button" class="sw hl' + i + '" data-nset="hl' + i + '" aria-label="Tô nền ' + i + '">ab</button>'; h += '<button type="button" class="sw" data-nset="hl0">Bỏ tô</button>'; }
    else if (k === "fs") ["Nhỏ", "Thường", "To", "Rất to"].forEach(function (n, j) { h += '<button type="button" class="sw" data-nset="fs' + (j + 1) + '">' + n + "</button>"; });
    else h = '<input type="url" inputmode="url" placeholder="https://…" aria-label="Địa chỉ link"><button type="button" class="sw" data-nlink="add">Gắn</button><button type="button" class="sw" data-nlink="del">Bỏ link</button>';
    return h;
  }
  // inSheet = ô nằm trong hộp thoại "Cách nhớ của mọi người" → không có nút mở lại chính hộp thoại đó
  function noteInner(id, mode, k, inSheet) {
    var meo = k === "meo", t = noteOf(id, k);
    var head = meo ? '<div class="facts nhd"><span class="k">Cách nhớ của bạn</span><span class="muted nsub">Mọi người sẽ thấy cách nhớ này</span></div>'
      : '<div class="facts nhd"><span class="k">Ghi chú khác</span><span class="muted nsub">Chỉ bạn thấy</span></div>';
    var all = meo && !inSheet ? '<button type="button" class="btn sm ghost" data-nact="all" title="Cách nhớ của mọi người, chấm sao">Cách nhớ của mọi người ⋯</button>' : "";
    if (mode === "edit") return head + NOTE_TB + '<div class="ntpop hide"></div><div class="ned nt" contenteditable="true" role="textbox" aria-multiline="true" aria-label="' + (meo ? "Cách nhớ" : "Ghi chú khác") + '" data-ph="' + (meo ? "Ví dụ: tách chữ thành bộ phận, câu vè, liên tưởng giúp nhớ…" : "Ví dụ: chỗ hay nhầm, ghi chú riêng…") + '">' + noteClean(t) + '</div><div class="row nfoot">' + all + '<span class="muted nc">Tự động lưu</span><span class="spacer"></span><button type="button" class="btn sm ghost" data-nact="del">Xóa</button><button type="button" class="btn sm primary" data-nact="done">Xong</button></div>';
    if (mode === "del") return head + '<div class="nt">' + noteClean(t) + '</div><div class="row"><span>' + (meo ? "Xóa cách nhớ này (cả ở danh sách chung)?" : "Xóa ghi chú này?") + '</span><span class="spacer"></span><button type="button" class="btn sm" data-nact="cancel">Thôi</button><button type="button" class="btn sm bad" data-nact="delyes">Xóa</button></div>';
    if (!t) return '<div class="row nempty"><button type="button" class="btn sm ghost" data-nact="edit">✎ ' + (meo ? "Viết cách nhớ" : "Thêm ghi chú khác") + "</button>" + all + "</div>";
    return head + '<div class="nt">' + noteClean(t) + "</div>" + (meo ? meoStat(id) : "") + '<div class="row">' + all + '<span class="spacer"></span><button type="button" class="btn sm" data-nact="edit">Sửa</button><button type="button" class="btn sm ghost" data-nact="del">Xóa</button></div>';
  }
  // ---- tự lưu: box đang chờ lưu giữ lại cả khi khung đã đóng (đã tách khỏi trang) nên vẫn lưu được
  var noteCur = null, noteTm = 0;
  function noteStat(box, s, bad) { var n = box.querySelector(".nc"); if (n) { n.textContent = s; n.classList.toggle("bad", !!bad); } }
  function noteSched(box) { noteCur = box; clearTimeout(noteTm); noteTm = setTimeout(noteFlush, 700); noteStat(box, "Đang lưu…"); }
  function noteFlush() {
    clearTimeout(noteTm); var box = noteCur; noteCur = null; if (!box) return true;
    var ed = box.querySelector(".ned"); if (!ed) return true;
    var id = box.getAttribute("data-note"), k = nkOf(box), n = noteTxt(noteClean(ed.innerHTML)).length;
    if (n > NOTE_MAX) { noteStat(box, "Dài " + n + " / " + NOTE_MAX + " ký tự — bớt lại mới lưu được", true); return false; }
    if (!HC.setNote(id, ed.innerHTML, k)) { noteStat(box, "Quá nhiều định dạng — chưa lưu được", true); return false; }
    noteStat(box, "Đã lưu" + (k === "meo" ? " · tự đăng cho mọi người sau ít giây" : "") + (n > NOTE_MAX - 300 ? " · " + n + " / " + NOTE_MAX : ""));
    refreshNotes(id, box, k);
    return true;
  }
  window.addEventListener("pagehide", noteFlush);
  document.addEventListener("visibilitychange", function () { if (document.hidden) noteFlush(); });
  // ---- giữ vùng chữ đang chọn (bấm nút công cụ / gõ địa chỉ link làm mất vùng chọn trên máy cảm ứng)
  function noteEdOf(n) { var e = n && (n.nodeType === 1 ? n : n.parentNode); return e && e.closest ? e.closest(".ned") : null; }
  document.addEventListener("selectionchange", function () {
    var s = window.getSelection(); if (!s || !s.rangeCount) return;
    var ed = noteEdOf(s.anchorNode); if (ed) ed._rng = s.getRangeAt(0).cloneRange();
  });
  function noteRestore(ed) {
    try { ed.focus(); } catch (e) { }
    var s = window.getSelection(), r = ed._rng;
    if (!r || !ed.contains(r.startContainer)) { r = document.createRange(); r.selectNodeContents(ed); r.collapse(false); }
    s.removeAllRanges(); s.addRange(r);
  }
  // màu / nền / cỡ / xóa định dạng: tô bằng màu "đánh dấu" #01gg0v rồi đổi thẻ font đó thành span có lớp (g = nhóm, v = mức)
  function noteMark(ed) {
    $$("font[color], span[style]", ed).forEach(function (f) {
      var c = (f.getAttribute("color") || f.style.color || "").toLowerCase(), m = /^#01(0[1-4])0(\d)$/.exec(c) || /^rgb\(1, ([1-4]), (\d)\)$/.exec(c);
      if (!m) return;
      var g = NOTE_G[+m[1]], v = +m[2], s = document.createElement("span");
      s.className = g === "x" ? "tc0 hl0 fs2" : g + v;
      while (f.firstChild) s.appendChild(f.firstChild);
      f.parentNode.replaceChild(s, f);
      $$("span, b, i, u", s).forEach(function (x) {
        if (g === "x") { while (x.firstChild) x.parentNode.insertBefore(x.firstChild, x); x.parentNode.removeChild(x); return; }
        if (x.tagName === "SPAN") x.className = x.className.split(/\s+/).filter(function (k) { return k && k.slice(0, 2) !== g; }).join(" ");
      });
    });
  }
  function noteSet(ed, cls) {
    var g = cls === "x" ? 4 : NOTE_G.indexOf(cls.slice(0, 2)), v = cls === "x" ? 0 : +cls.slice(2);
    noteRestore(ed);
    if (g === 4) document.execCommand("removeFormat", false, null);
    try { document.execCommand("styleWithCSS", false, false); } catch (e) { }
    document.execCommand("foreColor", false, "#010" + g + "0" + v);
    noteMark(ed);
  }
  function noteLink(ed, box, add) {
    var inp = box.querySelector(".ntpop input"), u = inp ? inp.value.trim() : "";
    noteRestore(ed);
    if (!add) { document.execCommand("unlink", false, null); return true; }
    if (!u) { if (inp) inp.focus(); return false; }
    if (!/^https?:\/\//i.test(u)) u = "https://" + u.replace(/^\/+/, "");
    if (!/^https?:\/\/[^\s"'<>]+\.[^\s"'<>]+$/i.test(u)) { toast("Địa chỉ link chưa đúng"); if (inp) inp.focus(); return false; }
    var s = window.getSelection();
    var r0 = s.rangeCount && s.getRangeAt(0), pre = r0 && r0.startContainer.nodeType === 3 && /\S/.test(r0.startContainer.nodeValue.charAt(r0.startOffset - 1)) ? " " : "";
    if (s.isCollapsed) document.execCommand("insertHTML", false, pre + '<a href="' + esc(u) + '">' + esc(u) + "</a>&nbsp;");
    else document.execCommand("createLink", false, u);
    return true;
  }
  function notePop(box, k) {
    var p = box.querySelector(".ntpop"), same = p.getAttribute("data-k") === k && !p.classList.contains("hide");
    $$(".ntb [data-npop]", box).forEach(function (b) { b.classList.toggle("on", !same && b.getAttribute("data-npop") === k); });
    if (same || !k) { p.classList.add("hide"); p.removeAttribute("data-k"); return; }
    p.setAttribute("data-k", k); p.innerHTML = notePopHTML(k); p.classList.remove("hide");
    if (k === "ln") {
      var inp = p.querySelector("input"), s = window.getSelection(), a = s && s.anchorNode && (s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentNode).closest("a");
      if (a && box.contains(a)) inp.value = a.getAttribute("href") || "";
      inp.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); var ed = box.querySelector(".ned"); if (noteLink(ed, box, true)) { notePop(box, ""); noteSched(box); } } });
      try { inp.focus(); } catch (e) { }
    }
  }
  function noteMode(box, mode) {
    if (noteCur === box) noteFlush();
    var id = box.getAttribute("data-note"), k = nkOf(box);
    box.innerHTML = noteInner(id, mode, k, !!box.closest(".meosheet"));
    if (mode === "edit") {
      var ed = box.querySelector(".ned");
      ed.addEventListener("input", function (e) { noteMark(ed); if (!e.isComposing) sgEdit(ed); noteSched(box); });
      ed.addEventListener("compositionend", function () { sgEdit(ed); }); // máy không có MS Song: chữ Hán vừa gõ → ảnh MS Song
      sgEdit(ed);
      ed.addEventListener("blur", function () { if (noteCur === box) noteFlush(); });
      ed.addEventListener("paste", function (e) {
        var cd = e.clipboardData || window.clipboardData; if (!cd) return;
        e.preventDefault(); document.execCommand("insertText", false, cd.getData("text") || "");
      });
      ed.addEventListener("click", function (e) { var a = e.target.closest("a"); if (a && (e.ctrlKey || e.metaKey)) window.open(a.href, "_blank", "noopener"); });
      // bấm nút công cụ không làm mất vùng chọn (máy tính)
      box.querySelector(".ntb").addEventListener("mousedown", function (e) { if (e.target.closest("button")) e.preventDefault(); });
      box.querySelector(".ntpop").addEventListener("mousedown", function (e) { if (e.target.closest("button")) e.preventDefault(); });
      noteRestore(ed);
    }
  }
  function refreshNotes(id, except, k) { $$('[data-note="' + id + '"]' + (k ? '[data-nk="' + k + '"]' : "")).forEach(function (b) { if (b !== except && !b.querySelector(".ned")) noteMode(b, "view"); }); }
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-nact],[data-ncmd],[data-npop],[data-nset],[data-nlink]"); if (!b) return;
    var box = b.closest("[data-note]"); if (!box) return;
    e.preventDefault();
    var id = box.getAttribute("data-note"), ed = box.querySelector(".ned"), a;
    if ((a = b.getAttribute("data-ncmd")) && ed) {
      if (a === "clear") noteSet(ed, "x"); else { noteRestore(ed); document.execCommand(a, false, null); }
      noteSched(box); return;
    }
    if ((a = b.getAttribute("data-npop")) && ed) { notePop(box, a); return; }
    if ((a = b.getAttribute("data-nset")) && ed) { noteSet(ed, a); notePop(box, ""); noteSched(box); return; }
    if ((a = b.getAttribute("data-nlink")) && ed) { if (noteLink(ed, box, a === "add")) { notePop(box, ""); noteSched(box); } return; }
    a = b.getAttribute("data-nact"); var k = nkOf(box);
    if (a === "edit") noteMode(box, "edit");
    else if (a === "done") { if (noteCur === box && !noteFlush()) return; noteMode(box, "view"); if (k === "meo") meoDone(box); } // xong cách nhớ → đăng ngay
    else if (a === "del") { if (noteCur === box) noteFlush(); noteMode(box, noteOf(id, k) ? "del" : "view"); }
    else if (a === "cancel") noteMode(box, "view");
    else if (a === "delyes") { HC.setNote(id, "", k); noteMode(box, "view"); refreshNotes(id, box, k); toast(k === "meo" ? "Đã xóa cách nhớ" : "Đã xóa ghi chú"); if (k === "meo") meoDone(box); }
    else if (a === "all") { if (noteCur === box) noteFlush(); meoSheet(id); }
  });
  // mở ô ghi chú: có khung chi tiết đang hiện thì sửa ngay ở đó; không thì mở khung nhỏ chỉ có chữ + ô đó (không lộ đáp án thẻ ôn)
  function editNote(id, k) {
    k = k === "meo" ? "meo" : "ghi";
    var sel = '[data-note="' + id + '"][data-nk="' + k + '"]', box = $(sel);
    if (!box) {
      var it = ITEM[id];
      modal('<h2 style="margin:0 40px 8px 0">' + (k === "meo" ? "Cách nhớ" : "Ghi chú khác") + ' · <span class="han">' + esc(it.type === "s" ? it.han : it.key) + "</span></h2>" + noteHTML(id, k), function () { if (k === "meo") { noteFlush(); setTimeout(function () { meoPub(true); }, 0); } });
      box = $(sel);
    }
    noteMode(box, "edit");
    try { box.scrollIntoView({ block: "nearest" }); } catch (e) { }
  }
  HC.editNote = editNote; HC.noteHTML = noteHTML;

  // ---------- CÁCH NHỚ CHUNG (Bước 8, người dùng duyệt 27/11/2026) ----------
  // hanco_meo/{id}_{uid} = {id, uid, ten (tên hiển thị), h (HTML đã lọc noteClean), upd (giờ máy chủ), r {uid người chấm: 1–5}}.
  // Tác giả tạo / sửa h, ten, upd / xóa; người khác chỉ sửa r.<uid mình> (không chấm của mình); quản trị xóa.
  // hanco_bao/{mã cách nhớ}_{uid người báo} = {m, id, a (uid tác giả), u, ly (lý do), t}: chỉ tạo (mỗi người 1 lần / cách nhớ), quản trị đọc + xóa.
  // Đăng: S.meo[id] = [html, ms, pub]; ms > pub → đăng 30 giây sau lần sửa cuối, ngay khi bấm Xong / đóng khung / sau mỗi lần đồng bộ
  // (gắn tài khoản, ẩn màn hình, có mạng lại) / rời app. Danh sách chỉ tải khi bấm "Cách nhớ của mọi người", giữ 5 phút.
  // Cách nhớ của người khác LUÔN hiện qua noteClean. Viết / chấm KHÔNG cộng XP (người dùng duyệt).
  var MEO_GAP = 30000, MEO_TTL = 300000, MEO_BAO = "hanco-meo-bao", MEO_LY = ["Sai kiến thức", "Không liên quan tới mục này", "Lời lẽ không phù hợp", "Quảng cáo / spam", "Khác"];
  var MEO = { tm: 0, busy: false, gone: {}, cache: {} };
  function meoOk() { return bxhOk() && !!fb.db; }
  function meoCol() { return fb.db.collection("hanco_meo"); }
  function meoSoon() { clearTimeout(MEO.tm); MEO.tm = setTimeout(meoPub, MEO_GAP); }
  // force = đăng cả mục đang mở ô soạn (bấm Xong / đóng khung / rời app); không thì chờ người học soạn xong (không đăng chữ đang gõ dở)
  function meoEditing(id) { return !!document.querySelector('[data-note="' + id + '"][data-nk="meo"] .ned'); }
  function meoPub(force) {
    clearTimeout(MEO.tm);
    if (!meoOk() || MEO.busy || !vaiReady()) return Promise.resolve(false);
    var me = fb.user, uid = myKey("me"), FV = firebase.firestore.FieldValue, done = {}, wait = false; // uid = mã tác giả (quản trị: theo vai ở cách nhớ)
    var ids = Object.keys(S.meo).filter(function (id) { var m = S.meo[id]; if (!(m && m[1] > (+m[2] || 0) && ITEM[id])) return false; if (force !== true && meoEditing(id)) { wait = true; return false; } return true; });
    if (wait) meoSoon();
    if (!ids.length) return Promise.resolve(true);
    MEO.busy = true;
    return ids.reduce(function (p, id) {
      return p.then(function () {
        if (fb.user !== me || myKey("me") !== uid) return;
        var m = S.meo[id], ms = m[1], ref = meoCol().doc(id + "_" + uid);
        var w = m[0] ? ref.set({ id: id, uid: uid, ten: myName("me"), h: m[0], upd: FV.serverTimestamp() }, { merge: true }) : ref.delete();
        return w.then(function () { done[id] = ms; delete MEO.gone[id]; delete MEO.cache[id]; }, function () { });
      });
    }, Promise.resolve()).then(function () {
      MEO.busy = false;
      var n = 0;
      if (fb.user === me) Object.keys(done).forEach(function (id) { var m = S.meo[id]; if (m && m[1] === done[id] && m[2] !== done[id]) { m[2] = done[id]; n++; } });
      if (n) { save(); Object.keys(done).forEach(function (id) { refreshNotes(id, null, "meo"); }); }
      return true;
    });
  }
  HC.meoPub = meoPub;
  try { addEventListener("pagehide", function () { meoPub(true); }); document.addEventListener("visibilitychange", function () { if (document.hidden) meoPub(true); }); } catch (e) { }
  // đổi tên hiển thị → đổi tên trên các cách nhớ của mình
  function meoRename() {
    if (!meoOk()) return;
    var uid = myKey("me"), t = myName("me");
    meoCol().where("uid", "==", uid).get().then(function (q) {
      var b = fb.db.batch(), n = 0;
      q.forEach(function (d) { if (d.data().ten !== t) { b.update(d.ref, { ten: t, upd: firebase.firestore.FieldValue.serverTimestamp() }); n++; } });
      MEO.cache = {};
      return n ? b.commit() : null;
    }).catch(function () { });
  }
  function meoStat(id) {
    var m = S.meo[id]; if (!m || !m[0]) return "";
    if (MEO.gone[id]) return '<div class="nsm bad">Quản trị viên đã gỡ cách nhớ này khỏi danh sách chung — giờ chỉ bạn thấy.</div>';
    if (m[1] > (+m[2] || 0)) return '<div class="nsm muted">Chưa đăng lên danh sách chung — app tự đăng sau ít giây (cần có mạng).</div>';
    return "";
  }
  function meoLoad(id, force) {
    var c = MEO.cache[id];
    if (!force && c && Date.now() - c.t < MEO_TTL) return Promise.resolve(c.L);
    return meoCol().where("id", "==", id).get().then(function (q) {
      var L = []; q.forEach(function (d) { var x = d.data(); x.k = d.id; L.push(x); });
      MEO.cache[id] = { t: Date.now(), L: L };
      return L;
    });
  }
  function meoMs(x) { return x && x.upd && x.upd.toMillis ? x.upd.toMillis() : +(x && x.upd) || 0; }
  // điểm xếp hạng: trung bình sao thêm 2 lượt 3 sao ảo (1 lượt 5 sao không vượt 20 lượt 4,8 sao); hiện trung bình thật
  function meoAvg(x) {
    var r = x.r || {}, n = 0, s = 0;
    Object.keys(r).forEach(function (u) { var v = +r[u]; if (u !== x.uid && v >= 1 && v <= 5) { n++; s += v; } });
    return { n: n, a: n ? s / n : 0, w: (s + 6) / (n + 2) };
  }
  function meoSort(L) {
    return L.slice().sort(function (a, b) {
      var A = meoAvg(a), B = meoAvg(b);
      if (!A.n !== !B.n) return A.n ? -1 : 1;
      if (A.n && B.n && A.w !== B.w) return B.w - A.w;
      if (A.n !== B.n) return B.n - A.n;
      return meoMs(b) - meoMs(a);
    });
  }
  HC.meoSort = meoSort; HC.meoAvg = meoAvg;
  function meoAvgTxt(x) { var a = meoAvg(x); return a.n ? '<span class="meo-avg" title="Trung bình ' + a.a.toFixed(1).replace(".", ",") + " sao, " + a.n + ' lượt chấm"><b>★ ' + a.a.toFixed(1).replace(".", ",") + "</b> · " + a.n + " lượt</span>" : '<span class="meo-avg muted">Chưa ai chấm</span>'; }
  function meoWho(uid, ten) { var u = QT && QT.users ? QT.users.filter(function (x) { return x.uid === uid; })[0] : null; return u || { uid: uid, ten: ten || "" }; }
  // quản trị xóa 1 cách nhớ: xóa tài liệu + mọi báo cáo về nó, ghi nhật ký
  function meoDel(x, why) {
    var it = ITEM[x.id];
    return meoCol().doc(x.k).delete().then(function () {
      return fb.db.collection("hanco_bao").where("m", "==", x.k).get().then(function (q) { var b = fb.db.batch(); q.forEach(function (d) { b.delete(d.ref); }); return q.size ? b.commit() : null; }).catch(function () { });
    }).then(function () {
      delete MEO.cache[x.id];
      qtLog("Xóa cách nhớ", meoWho(x.uid, x.ten), (it ? kindLabel(it) + " " + itemTitle(it) : x.id) + (why ? " · " + why : "") + " · " + noteTxt(noteClean(x.h || "")).slice(0, 80));
    });
  }
  // xóa người (qtDelete): xóa mọi cách nhớ của người đó + báo cáo về chúng
  function meoWipe(uid) {
    var db = fb.db;
    return Promise.all([meoCol().where("uid", "==", uid).get(), db.collection("hanco_bao").where("a", "==", uid).get()]).then(function (r) {
      var refs = []; r[0].forEach(function (d) { refs.push(d.ref); }); r[1].forEach(function (d) { refs.push(d.ref); });
      var p = Promise.resolve();
      for (var i = 0; i < refs.length; i += 400) (function (part) { p = p.then(function () { var b = db.batch(); part.forEach(function (x) { b.delete(x); }); return b.commit(); }); })(refs.slice(i, i + 400));
      MEO.cache = {};
      return p.then(function () { return r[0].size; });
    });
  }
  function meoBao() { return jget(MEO_BAO); }
  function meoItemHTML(x, mine, my) {
    var bao = !mine && fb.user && meoBao()[x.k + "_" + fb.user.uid], adm = isAdmin() && !isMine(x.uid); // dấu "đã báo" theo từng tài khoản (khóa = mã báo cáo)
    var h = '<div class="meo-it' + (mine ? " mine" : "") + '" data-mk="' + esc(x.k) + '"><div class="row meo-hd">' + (x.uid ? (mine ? avHTML(x.uid, x.ten, avVer(x.uid), "sm", true) : avSlot(x.uid, x.ten)) : "") + '<b class="meo-ten">' + esc(x.ten || "?") + "</b>" + (mine ? '<span class="chip ok">Của bạn</span>' : "") + '<span class="spacer"></span>' + meoAvgTxt(x) + "</div>";
    if (bao && !x._show) return h + '<div class="row meo-ft"><span class="muted">Bạn đã báo cách nhớ này cho quản trị viên.</span><span class="spacer"></span><button type="button" class="btn sm ghost" data-mact="hien">Hiện</button></div></div>';
    h += '<div class="nt">' + noteClean(x.h || "") + "</div>";
    h += '<div class="row meo-ft">';
    if (!mine) {
      h += '<span class="stars" role="group" aria-label="Chấm sao cho cách nhớ này">';
      for (var i = 1; i <= 5; i++) h += '<button type="button" class="star' + (my >= i ? " on" : "") + '" data-star="' + i + '" aria-label="' + i + ' sao" aria-pressed="' + (my === i) + '" title="' + (my === i ? "Bấm lần nữa để bỏ chấm" : i + " sao") + '">★</button>';
      h += "</span>" + (my ? '<span class="muted nsm">bạn chấm ' + my + " sao</span>" : "");
    } else h += '<span class="muted nsm">Không chấm được cách nhớ của chính mình</span>';
    h += '<span class="spacer"></span>';
    if (!mine) h += bao ? '<span class="muted nsm">Đã báo</span>' : '<button type="button" class="btn sm ghost" data-mact="bao">Báo không phù hợp</button>';
    if (adm && !mine) h += '<button type="button" class="btn sm bad" data-mact="qxoa">Xóa (quản trị)</button>';
    return h + '</div><div class="meo-form"></div></div>';
  }
  // bấm Xong / xóa cách nhớ → đăng ngay; ô nằm trong hộp thoại "Cách nhớ của mọi người" → đăng xong tải lại danh sách
  function meoDone(box) {
    var p = meoPub(true), sh = box.closest(".meosheet");
    if (sh && sh._meoLoad) p.then(function () { if (sh.isConnected) sh._meoLoad(); });
  }
  // Hộp thoại "Cách nhớ của mọi người" (người dùng yêu cầu 27/11/2026): mở được cả khi đang soạn cách nhớ ở dưới (ô đó giữ nguyên, đóng hộp thoại
  // thì gõ tiếp); "Viết cách nhớ của bạn" soạn NGAY trong hộp thoại. Chỉ 1 ô soạn mỗi lúc: ô đang soạn ở dưới được lưu + tạm về chế độ xem,
  // đóng hộp thoại thì lưu, đăng, ô đó mở lại chế độ soạn với nội dung mới nhất.
  function meoSheet(id) {
    var it = ITEM[id]; if (!it) return;
    closePop();
    var SEL = '[data-note="' + id + '"][data-nk="meo"]', prev = $(SEL + " .ned"), back = [], opened = false;
    var el = plSheet('<h2 style="margin:0 40px 4px 0">Cách nhớ · <span class="han">' + esc(itemTitle(it)) + '</span></h2><p class="sub">Cách nhớ mọi người chia sẻ, hay nhất ở trên. Bấm sao để chấm (1–5, đổi được; bấm lại sao đang chọn để bỏ).</p>' +
      '<div id="meoapp"></div><div id="meoed"></div><div class="meo-list" id="meol"><p class="sub">Đang tải…</p></div>' +
      '<div class="row acts"><button type="button" class="btn primary" id="meow">✎ ' + (noteOf(id, "meo") ? "Sửa cách nhớ của bạn" : "Viết cách nhớ của bạn") + '</button><span class="spacer"></span><button type="button" class="btn ghost" id="meor">Tải lại</button></div>', function () {
        if (!opened) { if (prev && prev.isConnected) noteRestore(prev); return; } // đang soạn ở dưới → gõ tiếp
        noteFlush(); meoPub(true); refreshNotes(id, null, "meo");
        back.forEach(function (b) { if (b.isConnected) noteMode(b, "edit"); });
      });
    el.classList.add("meosheet");
    var list = el.querySelector("#meol"), L = null, uid = fb.user ? fb.user.uid : "";
    if (it.type === "c" || it.type === "r") giaiData(it.key).then(function (j) {
      if (j && j.mn && el.isConnected) el.querySelector("#meoapp").innerHTML = '<div class="meo-it app"><div class="row meo-hd"><b>Mẹo nhớ của app</b><span class="spacer"></span><span class="nb">tự soạn, không có trong tài liệu · không chấm sao</span></div><div class="nt">' + hanTxt(j.mn) + "</div></div>";
    }, function () { });
    function draw() {
      if (!L) return;
      var my = S.meo[id], mk = myKey("me"), mineDoc = L.filter(function (x) { return x.uid === mk; })[0];
      // của mình: đã đăng xong mà không còn trên danh sách chung → quản trị đã gỡ
      if (my && my[0] && my[2] >= my[1] && !mineDoc && !MEO.busy) MEO.gone[id] = 1; else delete MEO.gone[id];
      var S2 = meoSort(L), h = "";
      if (MEO.gone[id]) h += '<p class="tkmsg">Quản trị viên đã gỡ cách nhớ của bạn khỏi danh sách chung.</p>';
      else if (my && my[0] && my[1] > (+my[2] || 0)) h += '<p class="sub">Cách nhớ bạn vừa sửa chưa đăng xong — app tự đăng sau ít giây.</p>';
      h += S2.length ? S2.map(function (x) { return meoItemHTML(x, isMine(x.uid), +((x.r || {})[uid]) || 0); }).join("") : '<p class="sub">Chưa ai chia sẻ cách nhớ cho mục này. Hãy là người đầu tiên!</p>';
      list.innerHTML = h;
      avFillBx(list);
      refreshNotes(id, null, "meo");
    }
    function load(force) {
      if (!meoOk()) { list.innerHTML = '<p class="tkmsg">Cần đăng nhập (tài khoản đang hoạt động) và có mạng để xem cách nhớ của mọi người.</p>'; return; }
      list.innerHTML = '<p class="sub">Đang tải…</p>';
      meoPub().then(function () { return meoLoad(id, force); }).then(function (r) { L = r; if (el.isConnected) draw(); }, function (e) {
        if (el.isConnected) list.innerHTML = '<p class="tkmsg">Chưa tải được (' + esc(e && e.code === "permission-denied" ? "chưa được phép — luật Firestore mới (Bước 8) đã deploy chưa?" : tkErr(e)) + ").</p>";
      });
    }
    el.querySelector("#meor").onclick = function () { load(true); };
    el._meoLoad = function () { load(); };
    el.querySelector("#meow").onclick = function () {
      var w = el.querySelector("#meoed");
      noteFlush();
      $$(SEL).forEach(function (b) { if (b.querySelector(".ned")) { back.push(b); noteMode(b, "view"); } });
      w.innerHTML = noteHTML(id, "meo"); opened = true;
      noteMode(w.firstChild, "edit");
      this.style.display = "none";
      try { w.scrollIntoView({ block: "nearest" }); } catch (e) { }
    };
    list.addEventListener("click", function (e) {
      var b = e.target.closest("[data-star],[data-mact],[data-ly]"); if (!b || !L) return;
      var card = b.closest("[data-mk]"), k = card && card.getAttribute("data-mk"), x = L.filter(function (y) { return y.k === k; })[0]; if (!x) return;
      var a = b.getAttribute("data-mact");
      if (b.hasAttribute("data-star")) {
        if (isMine(x.uid)) return;
        var v = +b.getAttribute("data-star"), cur = +((x.r || {})[uid]) || 0, o = {}, FV = firebase.firestore.FieldValue;
        o["r." + uid] = v === cur ? FV.delete() : v;
        $$("[data-star]", card).forEach(function (s) { s.disabled = true; });
        meoCol().doc(k).update(o).then(function () {
          x.r = x.r || {}; if (v === cur) delete x.r[uid]; else x.r[uid] = v;
          toast(v === cur ? "Đã bỏ chấm" : "Đã chấm " + v + " sao"); draw();
        }, function (er) { toast("Chưa chấm được (" + tkErr(er) + ")"); draw(); });
      } else if (a === "hien") { x._show = 1; draw(); }
      else if (a === "bao") {
        var f = card.querySelector(".meo-form");
        f.innerHTML = '<div class="meo-bao"><div class="facts"><span class="k">Báo cách nhớ này cho quản trị viên</span></div><div class="lyck">' + MEO_LY.map(function (t, i) { return '<label><input type="radio" name="ly-' + esc(k) + '" value="' + i + '"' + (i ? "" : " checked") + "> " + esc(t) + "</label>"; }).join("") + '</div><input type="text" maxlength="200" placeholder="Ghi thêm (không bắt buộc)" aria-label="Ghi thêm lý do"><div class="row"><span class="muted nsm">Người viết không biết ai đã báo.</span><span class="spacer"></span><button type="button" class="btn sm" data-mact="thoi">Thôi</button><button type="button" class="btn sm bad" data-mact="gui">Gửi báo cáo</button></div></div>';
        b.disabled = true;
      } else if (a === "thoi") { draw(); }
      else if (a === "gui") {
        var fm = card.querySelector(".meo-bao"), ck = fm.querySelector("input[type=radio]:checked"), more = fm.querySelector("input[type=text]").value.trim().slice(0, 200);
        var ly = MEO_LY[ck ? +ck.value : 0] + (more ? ": " + more : "");
        b.disabled = true; b.textContent = "Đang gửi…";
        var mark = function () { var m = meoBao(); m[k + "_" + uid] = Date.now(); lsSet(MEO_BAO, JSON.stringify(m)); draw(); };
        fb.db.collection("hanco_bao").doc(k + "_" + uid).set({ m: k, id: id, a: x.uid, u: uid, ly: ly, t: firebase.firestore.FieldValue.serverTimestamp() }).then(function () { toast("Đã gửi báo cáo cho quản trị viên. Cảm ơn bạn!"); mark(); }, function (er) {
          if (er && er.code === "permission-denied") { toast("Có thể bạn đã báo cách nhớ này rồi."); mark(); } else { toast("Chưa gửi được (" + tkErr(er) + ")"); draw(); }
        });
      } else if (a === "qxoa") {
        if (!b.classList.contains("sure")) { b.classList.add("sure"); b.textContent = "Bấm lần nữa để xóa"; setTimeout(function () { if (b.isConnected) { b.classList.remove("sure"); b.textContent = "Xóa (quản trị)"; } }, 4000); return; }
        b.disabled = true;
        meoDel(x, "xóa ở khung cách nhớ").then(function () { L = L.filter(function (y) { return y !== x; }); toast("Đã xóa cách nhớ"); draw(); }, function (er) { toast(tkErr(er)); draw(); });
      }
    });
    load(false);
  }
  HC.meoSheet = meoSheet;

  // ---------- QUẢN TRỊ → CÁCH NHỚ (Bước 8): báo cáo "không phù hợp" + cách nhớ mới viết ----------
  var qtMeoN = 50;
  function qtMeo(box, redraw) {
    box.innerHTML = '<p class="sub">Đang tải cách nhớ…</p>';
    var db = fb.db;
    Promise.all([db.collection("hanco_bao").get(), meoCol().orderBy("upd", "desc").limit(qtMeoN).get()]).then(function (r) {
      var rep = {}, recent = [];
      r[0].forEach(function (d) { var x = d.data(); x.k = d.id; (rep[x.m] = rep[x.m] || []).push(x); });
      r[1].forEach(function (d) { var x = d.data(); x.k = d.id; recent.push(x); });
      var keys = Object.keys(rep);
      return Promise.all(keys.map(function (k) { return meoCol().doc(k).get().then(function (s) { if (!s.exists) return null; var x = s.data(); x.k = s.id; return x; }, function () { return null; }); })).then(function (docs) {
        if (cur !== "qt-meo") return;
        var M = {}; keys.forEach(function (k, i) { M[k] = docs[i]; });
        function who(uid, ten) { var u = meoWho(uid, ten); return '<span class="num">' + qtMa(uid) + "</span> " + esc(u.ten || ten || "?") + (u.hoten ? ' <span class="muted">(' + esc(u.hoten) + ")</span>" : ""); }
        function itl(id) { var it = ITEM[id]; return it ? '<a href="#" data-open="' + id + '">' + esc(kindLabel(it)) + ' <span class="han">' + esc(itemTitle(it)) + "</span></a>" : esc(id); }
        keys.sort(function (a, b) { return rep[b].length - rep[a].length; });
        var h = '<div class="card"><h2>Bị báo không phù hợp (' + keys.length + ')</h2><p class="sub">Người học bấm "Báo không phù hợp" ở danh sách cách nhớ. Xóa cách nhớ = gỡ khỏi danh sách chung (người viết vẫn giữ bản riêng); Giữ lại = bỏ các báo cáo.</p>';
        h += keys.length ? keys.map(function (k) {
          var x = M[k], R = rep[k], f = R[0];
          return '<div class="meo-it qtmeo" data-qk="' + esc(k) + '"><div class="row meo-hd">' + itl(f.id) + ' · viết bởi ' + who(f.a, x && x.ten) + '<span class="spacer"></span><span class="chip warn">' + R.length + " lượt báo</span>" + (x ? meoAvgTxt(x) : "") + "</div>" +
            (x ? '<div class="nt">' + noteClean(x.h || "") + "</div>" : '<p class="sub">Cách nhớ này không còn (người viết đã xóa).</p>') +
            '<ul class="qtbao">' + R.map(function (b) { return "<li>" + who(b.u) + " · " + esc(b.ly || "") + (b.t && b.t.toMillis ? ' <span class="muted">' + hm(b.t.toMillis()) + "</span>" : "") + "</li>"; }).join("") + "</ul>" +
            '<div class="row">' + (x ? '<button type="button" class="btn sm bad" data-qm="xoa">Xóa cách nhớ</button><button type="button" class="btn sm" data-qm="giu">Giữ lại (bỏ báo cáo)</button>' : '<button type="button" class="btn sm" data-qm="giu">Bỏ báo cáo</button>') + "</div></div>";
        }).join("") : '<p class="sub">Không có báo cáo nào.</p>';
        h += '</div><div class="card"><h2>Cách nhớ mới viết</h2><p class="sub">' + recent.length + ' cách nhớ mới nhất (mới sửa ở trên).</p>';
        h += recent.length ? recent.map(function (x) {
          return '<div class="meo-it qtmeo" data-rk="' + esc(x.k) + '"><div class="row meo-hd">' + itl(x.id) + " · " + who(x.uid, x.ten) + '<span class="spacer"></span>' + meoAvgTxt(x) + (meoMs(x) ? '<span class="muted nsm">' + hm(meoMs(x)) + "</span>" : "") + '</div><div class="nt">' + noteClean(x.h || "") + '</div><div class="row"><span class="spacer"></span><button type="button" class="btn sm bad" data-qm="rxoa">Xóa</button></div></div>';
        }).join("") : '<p class="sub">Chưa có cách nhớ nào.</p>';
        if (recent.length >= qtMeoN) h += '<div class="row"><button type="button" class="btn sm" data-qm="them">Xem thêm</button></div>';
        box.innerHTML = h + "</div>";
        box.onclick = function (e) {
          var b = e.target.closest("[data-qm]"); if (!b) return;
          var a = b.getAttribute("data-qm"), c = b.closest("[data-qk],[data-rk]");
          if (a === "them") { qtMeoN += 50; redraw(); return; }
          var k = c.getAttribute("data-qk") || c.getAttribute("data-rk"), x = M[k] || recent.filter(function (y) { return y.k === k; })[0];
          function sure() { if (b.classList.contains("sure")) return true; b.classList.add("sure"); b.textContent = "Bấm lần nữa để chắc chắn"; setTimeout(function () { if (b.isConnected) { b.classList.remove("sure"); b.textContent = a === "giu" ? "Giữ lại (bỏ báo cáo)" : a === "xoa" ? "Xóa cách nhớ" : "Xóa"; } }, 4000); return false; }
          if (!sure()) return;
          $$("button", c).forEach(function (y) { y.disabled = true; });
          var p;
          if (a === "giu") {
            var bb = db.batch(); (rep[k] || []).forEach(function (y) { bb.delete(db.collection("hanco_bao").doc(y.k)); });
            p = bb.commit().then(function () { var f = (rep[k] || [])[0] || {}; qtLog("Giữ lại cách nhớ bị báo", meoWho(f.a, x && x.ten), (ITEM[f.id] ? itemTitle(ITEM[f.id]) : f.id) + " · bỏ " + (rep[k] || []).length + " báo cáo"); toast("Đã giữ lại, bỏ báo cáo"); });
          } else p = meoDel(x, a === "xoa" ? (rep[k] || []).length + " lượt báo" : "soát cách nhớ mới").then(function () { toast("Đã xóa cách nhớ"); });
          p.then(redraw, function (er) { toast(tkErr(er)); redraw(); });
        };
      });
    }).catch(function (e) { if (cur === "qt-meo") box.innerHTML = '<div class="card"><h2>Cách nhớ</h2><p class="tkmsg">Chưa tải được (' + esc(tkErr(e)) + "). Luật Firestore mới (Bước 8) đã deploy chưa?</p></div>"; });
  }

  // ---------- giải thích từng chữ (tự soạn, KHÔNG có trong tài liệu → luôn ghi ※) ----------
  // giai/<mã hex>.json sinh bằng tools/build_giai.py từ tools/work/giai/dot*.txt (định dạng: README.txt ở đó), mỗi chữ / bộ thủ 1 file,
  // tải khi mở (như net/). {c, py pinyin, pyo âm khác tự động, pyx 1 = đa âm chưa soát, py2 âm khác kèm nghĩa, n [nghĩa + từ loại],
  // lt lục thư, bp bộ phận, cg nguồn gốc, mn mẹo nhớ, cc ghi thêm}. Chữ chưa soạn chỉ có pinyin. Không tải được → ẩn khung, không báo lỗi.
  var GDATA = {};
  function giaiData(ch) {
    var k = hanKey(ch);
    if (!GDATA[k]) GDATA[k] = fetch("giai/" + k + ".json").then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }).then(null, function (e) { delete GDATA[k]; throw e; });
    return GDATA[k];
  }
  HC.giaiData = giaiData;
  function giaiHTML(it) { return '<div class="giai" data-giai="' + esc(it.key) + '" data-gid="' + it.id + '" hidden></div>'; }
  function hanTxt(s) { // chữ Hán trong lời giải thích hiện bằng phông chữ Hán
    return esc(s).replace(/(?:[⺀-⿟㐀-䶿一-鿿豈-﫿]|[\uD840-\uD87F][\uDC00-\uDFFF])+/g, function (m) { return '<span class="han">' + m + "</span>"; });
  }
  function giaiInner(j, open) {
    var py = '<div class="gpy"><span class="k">Pinyin</span> <b>' + esc(j.py || "?") + "</b>" + (j.pyo && j.pyo.length ? ' <span class="muted">· âm khác: ' + esc(j.pyo.join(", ")) + "</span>" : "") + (j.pyx ? ' <span class="muted">(chữ nhiều âm — chưa soát)</span>' : "") + "</div>";
    if (j.py2) py += '<div class="gpy"><span class="k">Âm khác</span> ' + hanTxt(j.py2) + "</div>";
    var h = '<div class="facts"><span class="k">Giải thích</span> <span class="gsx">※ bổ sung, không có trong tài liệu</span></div>' + py;
    if (!j.n) return h + '<div class="muted gnone">Chưa soạn phần nghĩa, cấu tạo, mẹo nhớ cho chữ này.</div>';
    var row = function (lab, v, cls) { return v ? '<div class="gr' + (cls ? " " + cls : "") + '"><div class="gk">' + lab + '</div><div class="gv">' + v + "</div></div>" : ""; };
    var b = row("Nghĩa", '<ul class="gn">' + j.n.map(function (x) { return "<li>" + hanTxt(x) + "</li>"; }).join("") + "</ul>") +
      row("Loại chữ", j.lt ? hanTxt(j.lt) + ' <span class="muted">(lục thư)</span>' : "") +
      row("Cấu tạo", j.bp && hanTxt(j.bp)) +
      row("Nguồn gốc", j.cg && hanTxt(j.cg) + '<div class="muted gsm">theo Thuyết văn giải tự và tư liệu chữ cổ</div>') +
      row("Mẹo nhớ", j.mn && hanTxt(j.mn) + '<div class="muted gsm">mẹo tự đặt để dễ nhớ, không phải nguồn gốc thật</div>', "gmn") +
      row("Ghi thêm", j.cc && hanTxt(j.cc));
    return h + '<details class="gd"' + (open ? " open" : "") + "><summary>Nghĩa, cấu tạo, nguồn gốc, mẹo nhớ</summary>" + b + "</details>";
  }
  function giaiFill(el) {
    if (el.getAttribute("data-ld")) return;
    el.setAttribute("data-ld", "1");
    giaiData(el.getAttribute("data-giai")).then(function (j) {
      el.innerHTML = giaiInner(j, el.getAttribute("data-go") === "1");
      el.hidden = false;
      if (el.getAttribute("data-go") === "1") { el.removeAttribute("data-go"); giaiScroll(el); }
    }, function () { el.removeAttribute("data-ld"); });
  }
  function giaiScroll(el) { // cuộn tới khung; cuộn lại 1 lần nữa vì hoạt hình chữ ở trên có thể tải xong sau, đẩy khung xuống
    var go = function () { try { el.scrollIntoView({ block: "start" }); } catch (e) { } };
    go(); setTimeout(go, 450);
  }
  function showGiai(id) { // mục "Giải thích" ở ⋯: mở khung chi tiết (nếu chưa mở) tới phần giải thích
    var box = $('[data-detail="' + id + '"] .giai');
    if (!box) { openDetail(id); box = $('[data-detail="' + id + '"] .giai'); }
    if (!box) return;
    if (box.getAttribute("data-ld") && !box.hidden) {
      var d = box.querySelector("details"); if (d) d.open = true;
      giaiScroll(box);
    } else { box.setAttribute("data-go", "1"); if (!box.getAttribute("data-ld")) giaiFill(box); }
  }
  HC.showGiai = showGiai;

  // ---------- HÌNH TRANG SÁCH "Tìm về cội nguồn chữ Hán" (ảnh quét, có bản quyền) ----------
  // sach.json (trên hosting, KHÔNG có hình) = {v, m: {id: vị trí | [["nhãn thành phần", vị trí], ...]}}, sinh bằng tools/sach_pack.py
  // từ tools/work/sach/khop.txt. Hình (PNG base64) ở KHO CHUNG Firestore (Bước 6): hanco_sach/p<vị trí> = {b, vt, upd}, hanco_sach/info =
  // {sz: {vị trí: độ dài base64}, upd} — thành viên đang "ok" đọc, chỉ quản trị đưa lên (tab Quản trị → Hình sách, file tools/work/sach/sach.pack).
  // Bản RIÊNG cũ hanco_progress/{uid}/sach/… (trước Bước 6, chỉ còn đọc + xóa) dùng dự phòng khi kho chung chưa có trang đó.
  // Máy giữ hình đã xem trong Cache Storage "sach-v1" (KHÔNG bắt đầu bằng "hanco-" nên sw.js không xóa khi đổi VERSION), trừ khi bật
  // "Không lưu hình sách trên máy này" (localStorage hanco-sach-noluu — tiện ích từng máy, không thuộc S). Không động tới S.
  var SACH_BOOK = "Tìm về cội nguồn chữ Hán", SACH_CACHE = "sach-v1", SACH_NOLUU = "hanco-sach-noluu";
  var sachMapPr = null, SURL = {};
  function sachMap() {
    if (!sachMapPr) sachMapPr = fetch("sach.json").then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }).then(function (j) { return j.m || {}; }, function (e) { sachMapPr = null; throw e; });
    return sachMapPr;
  }
  function sachPages(m) { var o = {}; Object.keys(m).forEach(function (k) { var v = m[k]; if (typeof v === "number") o[v] = 1; else v.forEach(function (x) { o[x[1]] = 1; }); }); return Object.keys(o).map(Number).sort(function (a, b) { return a - b; }); }
  function sachPg(vt) { return vt < 251 ? vt : vt - 2; } // số trang in trên sách (bản quét có 2 trang chụp trùng ở vị trí 251, 252)
  function sachNoLuu() { if (!window.caches) return true; try { return localStorage.getItem(SACH_NOLUU) === "1"; } catch (e) { return false; } }
  function sachKey(vt) { return location.origin + location.pathname.replace(/[^\/]*$/, "") + "__sach__/p" + vt + ".png"; } // khóa trong bộ đệm, không phải địa chỉ thật
  function sachCacheGet(vt) {
    if (!window.caches) return Promise.resolve(null);
    return caches.open(SACH_CACHE).then(function (c) { return c.match(sachKey(vt)); }).then(function (r) { return r ? r.blob() : null; }).then(null, function () { return null; });
  }
  function sachCachePut(vt, blob) {
    if (sachNoLuu()) return Promise.resolve();
    return caches.open(SACH_CACHE).then(function (c) { return c.put(sachKey(vt), new Response(blob, { headers: { "Content-Type": "image/png" } })); }).then(null, function () { });
  }
  function b64Blob(b64) { var s = atob(b64), n = s.length, u = new Uint8Array(n); for (var i = 0; i < n; i++) u[i] = s.charCodeAt(i); return new Blob([u], { type: "image/png" }); }
  function sachErr(code) { var e = new Error(code); e.code = code; return e; }
  function sachRef() { return fb.ref ? fb.ref.collection("sach") : null; } // bản riêng cũ (fb.ref chỉ có khi tài khoản đang "ok")
  function sachPub() { return fb.ref && fb.db ? fb.db.collection("hanco_sach") : null; } // kho chung
  function sachFetch(vt) { // đọc 1 trang: kho chung trước, chưa có (hoặc luật chưa cho) thì bản riêng cũ → Blob (đã lưu vào bộ đệm nếu được phép)
    var col = sachRef(), pub = sachPub();
    if (!col || !pub) return Promise.reject(sachErr(fb.on ? "signedout" : "nofb"));
    if (navigator.onLine === false) return Promise.reject(sachErr("offline"));
    var e1 = null;
    return pub.doc("p" + vt).get().then(function (d) { return d.exists ? d.data() : null; }, function (e) { e1 = e; return null; }).then(function (x) {
      if (x && x.b) return x;
      return col.doc("p" + vt).get().then(function (d) { return d.exists ? d.data() : null; }, function (e) { if (e1) throw e1; return null; });
    }).then(function (x) {
      if (!x || !x.b) throw sachErr("missing");
      var blob = b64Blob(x.b);
      return sachCachePut(vt, blob).then(function () { return blob; });
    });
  }
  function sachImg(vt) { // → Promise<địa chỉ blob của hình>; bản trên máy trước, không có thì Firestore
    if (!SURL[vt]) SURL[vt] = sachCacheGet(vt).then(function (b) { return b || sachFetch(vt); }).then(function (b) { return URL.createObjectURL(b); }, function (e) { delete SURL[vt]; throw e; });
    return SURL[vt];
  }
  HC.sachImg = sachImg;
  function sachHTML(it) { return '<div class="sach" data-sach="' + it.id + '" hidden></div>'; }
  function sachFill(el) {
    if (el.getAttribute("data-ld")) return;
    el.setAttribute("data-ld", "1");
    sachMap().then(function (m) {
      var v = m[el.getAttribute("data-sach")];
      if (v == null) return; // không có trong sách, cả thành phần cũng không → không hiện gì
      var one = typeof v === "number", list = one ? [[null, v]] : v;
      el.innerHTML = '<div class="facts"><span class="k">Sách «' + esc(SACH_BOOK) + '»</span> <span class="gsx">※ tư liệu tham khảo, không có trong tài liệu</span></div>' +
        '<div class="muted ssub">' + (one ? "Có trong sách, trang " + sachPg(v) + ". Bấm vào hình để xem to." : "Chữ này không có trang riêng trong sách; các thành phần cấu tạo có trong sách:") + "</div>" +
        '<div class="sgrid' + (one ? " one" : "") + '">' + list.map(function (x) {
          return '<figure class="sfig" data-svt="' + x[1] + '">' + (x[0] ? '<figcaption><span class="han">' + esc(x[0]) + "</span> · trang " + sachPg(x[1]) + "</figcaption>" : "") + '<div class="simg"><span class="muted snote">Đang tải hình…</span></div></figure>';
        }).join("") + "</div>";
      el.hidden = false;
      $$(".sfig", el).forEach(sachFig);
    }, function () { el.removeAttribute("data-ld"); });
  }
  function sachFig(fig) {
    var vt = +fig.getAttribute("data-svt"), box = fig.querySelector(".simg");
    sachImg(vt).then(function (u) {
      box.innerHTML = '<button type="button" class="sbtn" data-szoom="' + vt + '" aria-label="Xem to trang ' + sachPg(vt) + '"><img alt="Trang ' + sachPg(vt) + " sách " + esc(SACH_BOOK) + '" src="' + u + '"></button>';
    }, function (e) {
      var c = e && (e.code || e.message), t;
      if (c === "signedout") t = 'Đăng nhập để xem hình trang sách. <button type="button" class="btn sm" data-sin>Đăng nhập</button>';
      else if (c === "nofb") t = "Cần đăng nhập để xem hình trang sách.";
      else if (c === "missing") t = isAdmin() ? 'Kho hình sách chung chưa có trang này — đưa lên ở <a href="#qt-sach">Quản trị → Hình sách</a>.' : "Kho hình sách chung chưa có trang này (quản trị viên chưa đưa lên).";
      else if (c === "permission-denied") t = "Chưa đọc được hình: máy chủ chưa cho phép đọc hình sách.";
      else if (c === "offline" || c === "unavailable") t = "Cần mạng để tải hình này (hình chưa lưu trên máy).";
      else t = "Chưa tải được hình.";
      box.innerHTML = '<span class="muted snote">' + t + "</span>";
    });
  }
  function sachRefresh() { // đăng nhập / đăng xuất xong: vẽ lại các khung sách đang hiện
    SURL = {};
    $$(".sach[data-sach]").forEach(function (el) { el.removeAttribute("data-ld"); el.hidden = true; el.innerHTML = ""; sachFill(el); });
    var ss = $("#sach-set"); if (ss && ss._redraw) ss._redraw(); // thẻ Cài đặt (route caidat-sach không được softRefresh vẽ lại)
  }
  // khung xem to: nằm trên khung chi tiết; ‹ › chuyển giữa các hình trong cùng khung sách; Phóng to = rộng hết khung, cuộn dọc
  var sviewEl = null;
  function closeSview() { if (sviewEl) { sviewEl.remove(); sviewEl = null; } }
  function sachView(vt, list) {
    closeSview();
    list = list && list.length ? list : [vt];
    var i = Math.max(0, list.indexOf(vt)), big = false;
    sviewEl = document.createElement("div");
    sviewEl.className = "modal sview"; sviewEl.setAttribute("role", "dialog"); sviewEl.setAttribute("aria-modal", "true");
    sviewEl.innerHTML = '<div class="box"><div class="row sbar"><b class="stt"></b><span class="spacer"></span>' +
      (list.length > 1 ? '<button type="button" class="btn sm" data-sp="-1" aria-label="Hình trước">‹</button><button type="button" class="btn sm" data-sp="1" aria-label="Hình sau">›</button>' : "") +
      '<button type="button" class="btn sm" data-sbig>Phóng to</button><button type="button" class="btn sm ghost" data-sx aria-label="Đóng">✕</button></div><div class="sbody"></div></div>';
    var body = sviewEl.querySelector(".sbody"), tt = sviewEl.querySelector(".stt"), bb = sviewEl.querySelector("[data-sbig]");
    function draw() {
      var v = list[i];
      tt.textContent = "Trang " + sachPg(v) + (list.length > 1 ? " (" + (i + 1) + "/" + list.length + ")" : "");
      body.innerHTML = '<span class="muted snote">Đang tải hình…</span>';
      sachImg(v).then(function (u) { if (list[i] !== v || !sviewEl) return; body.innerHTML = '<img alt="Trang ' + sachPg(v) + " sách " + esc(SACH_BOOK) + '" src="' + u + '">'; body.scrollTop = 0; }, function () { body.innerHTML = '<span class="muted snote">Chưa tải được hình.</span>'; });
    }
    function setBig(b) { big = b; sviewEl.classList.toggle("szoom", big); bb.textContent = big ? "Thu nhỏ" : "Phóng to"; }
    sviewEl.addEventListener("click", function (e) {
      if (e.target === sviewEl || e.target.closest("[data-sx]")) return closeSview();
      var p = e.target.closest("[data-sp]");
      if (p) { i = (i + +p.getAttribute("data-sp") + list.length) % list.length; draw(); return; }
      if (e.target.closest("[data-sbig]")) return setBig(!big);
    });
    body.addEventListener("dblclick", function () { setBig(!big); });
    document.body.appendChild(sviewEl);
    draw();
    try { bb.focus(); } catch (e) { }
  }
  document.addEventListener("keydown", function (e) {
    if (!sviewEl) return;
    if (e.key === "Escape") { e.stopPropagation(); closeSview(); }
    else if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && sviewEl.querySelector("[data-sp]")) { e.stopPropagation(); e.preventDefault(); sviewEl.querySelector('[data-sp="' + (e.key === "ArrowLeft" ? -1 : 1) + '"]').click(); }
  }, true);
  window.addEventListener("hashchange", closeSview);
  // bấm hình / nút Đăng nhập trong khung sách: bắt ở pha capture để không lật thẻ, không mở/đóng khung khác
  document.addEventListener("click", function (e) {
    var z = e.target.closest && e.target.closest("[data-szoom]"), s = !z && e.target.closest && e.target.closest(".sach [data-sin]");
    if (!z && !s) return;
    e.stopPropagation(); e.preventDefault();
    if (s) return HC.fbSignIn();
    var box = z.closest(".sach"), list = box ? $$(".sfig", box).map(function (f) { return +f.getAttribute("data-svt"); }) : [];
    sachView(+z.getAttribute("data-szoom"), list);
  }, true);

  // Cài đặt → thẻ "Hình trang sách"
  function fmtMB(b) { return (b / 1048576).toFixed(b < 10485760 ? 1 : 0).replace(".", ",") + " MB"; }
  function sachCacheStat() { // → {n trang, b byte} đang lưu trên máy này
    if (!window.caches) return Promise.resolve({ n: 0, b: 0 });
    return caches.open(SACH_CACHE).then(function (c) {
      return c.keys().then(function (ks) {
        return Promise.all(ks.map(function (k) { return c.match(k).then(function (r) { return r ? r.blob() : null; }).then(function (b) { return b ? b.size : 0; }); }));
      });
    }).then(function (a) { return { n: a.length, b: a.reduce(function (s, x) { return s + x; }, 0) }; }, function () { return { n: 0, b: 0 }; });
  }
  function sachInfo() { var col = sachPub(); return col ? col.doc("info").get().then(function (d) { return (d.exists && d.data()) || {}; }) : Promise.reject(sachErr("signedout")); } // info kho chung
  function sachErrText(e) { var c = e && (e.code || e.message); return c === "permission-denied" ? "máy chủ chưa cho phép (cần cập nhật quy tắc Firestore)" : c === "offline" || c === "unavailable" ? "không có mạng" : "lỗi " + (c || "không rõ"); }
  function sachPool(list, work, done) { // chạy 4 việc song song; dừng ở lỗi đầu tiên
    var k = 0, i = 0, fail = null, run = 0;
    return new Promise(function (res, rej) {
      function next() {
        if (fail) { if (!run) rej(fail); return; }
        if (i >= list.length) { if (!run) res(k); return; }
        var x = list[i++]; run++;
        work(x).then(function () { k++; done(k); }, function (e) { fail = fail || e; }).then(function () { run--; next(); });
      }
      for (var j = 0; j < 4; j++) next();
    });
  }
  function sachSettings(el) { // thẻ Cài đặt: tình trạng kho chung + hình trên máy. "Tải hết về máy này" CHỈ quản trị (người dùng chốt 27/11/2026: tiết kiệm hạn mức)
    if (!el) return;
    var busy = false, cachesOk = !!window.caches;
    function draw() {
      var noluu = sachNoLuu(), adm = isAdmin(), acc = !!sachPub();
      el.innerHTML = '<h2>Hình trang sách</h2><p class="sub">Hình trang sách «' + esc(SACH_BOOK) + '» lưu ở kho chung của app, thành viên đã đăng nhập xem được. Hình hiện trong khung chi tiết chữ và bộ thủ: chữ có trong sách → trang của chữ; chữ không có → trang từng thành phần cấu tạo. Trang đã xem được giữ lại trên máy, lần sau mở không cần tải lại.</p>' +
        '<div class="srow"><span class="k">Kho chung</span> <span id="sst-acc">' + (acc ? "đang kiểm tra…" : fb.on ? "cần đăng nhập" : "không dùng được trên trang này") + "</span></div>" +
        '<div class="srow"><span class="k">Trên máy này</span> <span id="sst-dev">' + (cachesOk ? "đang tính…" : "trình duyệt này không lưu hình được") + "</span></div>" +
        '<div class="row" style="margin-top:8px">' +
        (acc ? (adm ? '<a class="btn" href="#qt-sach">Đưa hình lên (Quản trị)</a>' + (cachesOk ? '<button class="btn" id="sall"' + (noluu ? " disabled" : "") + ">Tải hết về máy này</button>" : "") : "") : fb.on ? '<button class="btn primary" id="sin">Đăng nhập</button>' : "") +
        (cachesOk ? '<button class="btn ghost" id="sdel">Xóa hình sách đã lưu</button>' : "") + "</div>" +
        '<div id="sconf"></div><div id="sprog" class="sprog" hidden><div class="bar"><i></i></div><span class="muted"></span></div>' +
        (cachesOk ? '<label class="row" style="margin-top:10px"><input type="checkbox" id="snl"' + (noluu ? " checked" : "") + "> Không lưu hình sách trên máy này (mỗi lần xem tải lại, cần mạng)</label>" : "") +
        (adm && acc && cachesOk ? '<p class="sub" style="margin-top:8px">"Tải hết về máy này" (chỉ quản trị viên thấy) lấy khoảng 35 MB để xem khi không có mạng.</p>' : "");
      var b;
      if ((b = $("#sin", el))) b.onclick = HC.fbSignIn;
      if ((b = $("#sall", el))) b.onclick = function () { if (!busy && isAdmin()) fetchAll(); };
      if ((b = $("#sdel", el))) b.onclick = function () {
        if (busy) return;
        $("#sconf", el).innerHTML = '<div class="row" style="margin-top:8px"><span>Xóa hết hình sách đã lưu trên máy này? (Kho chung vẫn còn.)</span><button class="btn sm bad" id="sdy">Xóa</button><button class="btn sm" id="sdn">Thôi</button></div>';
        $("#sdy", el).onclick = function () { caches.delete(SACH_CACHE).then(function () { SURL = {}; toast("Đã xóa hình sách trên máy này"); draw(); }, function () { toast("Chưa xóa được"); }); };
        $("#sdn", el).onclick = function () { $("#sconf", el).innerHTML = ""; };
      };
      if ((b = $("#snl", el))) b.onchange = function () {
        try { if (this.checked) localStorage.setItem(SACH_NOLUU, "1"); else localStorage.removeItem(SACH_NOLUU); } catch (e) { }
        toast(this.checked ? "Từ giờ không lưu hình sách trên máy này (hình đã lưu vẫn còn — bấm Xóa nếu muốn)" : "Từ giờ giữ lại hình sách đã xem trên máy này");
        draw();
      };
      stat();
    }
    function stat() {
      var a = $("#sst-acc", el), d = $("#sst-dev", el);
      if (cachesOk) sachCacheStat().then(function (s) { if (d && d.isConnected) d.textContent = s.n ? s.n + " trang · " + fmtMB(s.b) : "chưa lưu hình nào"; });
      if (sachPub()) Promise.all([sachMap(), sachInfo()]).then(function (r) {
        var tot = sachPages(r[0]).length, n = Object.keys(r[1].sz || {}).length;
        if (a && a.isConnected) a.textContent = n ? n + "/" + tot + " trang" + (r[1].upd ? " (cập nhật " + new Date(r[1].upd).toLocaleDateString("vi-VN") + ")" : "") : "chưa có hình (quản trị viên chưa đưa lên)";
      }, function (e) { if (a && a.isConnected) a.textContent = "chưa kiểm tra được: " + sachErrText(e); });
    }
    function prog(k, n, txt) {
      var p = $("#sprog", el); if (!p) return;
      p.hidden = false; p.querySelector("i").style.width = (n ? Math.round(k * 100 / n) : 0) + "%"; p.querySelector("span").textContent = txt;
    }
    function fetchAll() {
      busy = true; prog(0, 1, "Đang kiểm tra…");
      sachMap().then(function (m) {
        var ps = sachPages(m);
        return Promise.all(ps.map(function (vt) { return sachCacheGet(vt).then(function (b) { return b ? null : vt; }); })).then(function (a) {
          var todo = a.filter(function (x) { return x != null; }), n = todo.length;
          if (!n) { prog(1, 1, "Máy này đã có đủ " + ps.length + " trang."); return; }
          prog(0, n, "Đang tải 0/" + n + " trang…");
          return sachPool(todo, sachFetch, function (k) { prog(k, n, "Đang tải " + k + "/" + n + " trang…"); }).then(function () { prog(n, n, "Xong: máy này đã có đủ " + ps.length + " trang."); }, function (e) {
            prog(0, 1, (e && e.code === "missing" ? "Kho chung chưa có đủ hình (cần đưa lên trước)." : "Dừng giữa chừng (" + sachErrText(e) + "). Bấm lại để tải tiếp."));
          });
        });
      }).then(null, function (e) { prog(0, 1, "Chưa tải được: " + sachErrText(e) + "."); }).then(function () { busy = false; stat(); });
    }
    el._redraw = function () { if (!busy && el.isConnected) draw(); };
    draw();
  }

  // Quản trị → Hình sách (Bước 6): đưa gói hình (tools/work/sach/sach.pack) lên KHO CHUNG hanco_sach — chỉ trang mới / đổi (so độ dài với
  // hanco_sach/info.sz), dừng giữa chừng thì bấm lại để đưa tiếp; xóa bản riêng cũ hanco_progress/{quản trị}/sach/* khi kho chung đã đủ.
  // Việc đang chạy vẫn chạy khi rời mục (qtSachSt giữ tiến độ để vẽ lại).
  var qtSachSt = null;
  function qtSachProg(k, n, txt, busy) {
    qtSachSt = { k: k, n: n, txt: txt, busy: !!busy };
    var p = document.getElementById("qsprog"); if (!p) return;
    p.hidden = false; p.querySelector("i").style.width = (n ? Math.round(k * 100 / n) : 0) + "%"; p.querySelector("span").textContent = txt;
    $$("#qsup, #qsdel").forEach(function (b) { if (busy) b.disabled = true; });
  }
  function qtSach(box, redraw) {
    box.innerHTML = '<p class="sub">Đang tính…</p>';
    sachMap().then(function (m) {
      var pub = (QT.sachPub && QT.sachPub.sz) || {}, own = (QT.sach && QT.sach.sz) || {};
      var all = sachPages(m), tot = all.length, nPub = Object.keys(pub).length, nOwn = Object.keys(own).length;
      var miss = all.filter(function (vt) { return !pub[vt]; }).length, ownLeft = Object.keys(own).filter(function (k) { return !pub[k]; }).length;
      var szOf = function (o) { return Object.keys(o).reduce(function (s, k) { return s + (+o[k] || 0); }, 0); };
      var busy = !!(qtSachSt && qtSachSt.busy), canDel = nOwn > 0 && !miss && !ownLeft;
      var h = '<div class="card"><h2>Kho hình sách chung</h2><div class="qtst">' +
        "<div><small>Trang đã có</small><b>" + fmt(nPub) + " / " + fmt(tot) + "</b><small>" + (miss ? "còn thiếu " + fmt(miss) + " trang" : "đủ") + "</small></div>" +
        "<div><small>Dung lượng</small><b>" + fmtB(szOf(pub)) + "</b><small>trên Firestore</small></div>" +
        "<div><small>Cập nhật</small><b>" + (QT.sachPub && QT.sachPub.upd ? dateY(dayOfMs(QT.sachPub.upd)) : "—") + "</b><small>lần đưa lên gần nhất</small></div></div>" +
        '<p class="sub" style="margin-top:8px">Mọi thành viên đang hoạt động xem được hình trong khung chi tiết chữ / bộ thủ; chỉ bạn đưa lên được. Mỗi trang thành viên mở lần đầu trên một máy tốn 2 lượt đọc và ~77 KB tải ra (trang đã xem được giữ lại trên máy). "Tải hết về máy này" chỉ quản trị viên có.</p>' +
        '<div class="row" style="margin-top:8px"><button class="btn primary" id="qsup"' + (busy ? " disabled" : "") + '>Đưa hình sách lên kho chung</button><input type="file" id="qsupf" accept=".pack,application/json" hidden></div>' +
        '<div id="qsprog" class="sprog" hidden><div class="bar"><i></i></div><span class="muted"></span></div>' +
        '<p class="sub" style="margin-top:8px">Chọn file <code>tools/work/sach/sach.pack</code> (từ máy tính có file này). Chỉ trang mới hoặc trang đã đổi được ghi; dừng giữa chừng thì bấm lại và chọn file để đưa tiếp. Sau khi chạy lại <code>sach_pack.py</code> có trang mới → đưa lại ở đây.</p></div>';
      h += '<div class="card"><h2>Bản riêng cũ trên tài khoản của bạn</h2>' + (nOwn ?
        '<p class="sub">Trước Bước 6, hình sách lưu riêng trong tài khoản của bạn: ' + fmt(nOwn) + " trang · " + fmtB(szOf(own)) + ". App vẫn dùng bản này làm dự phòng khi kho chung chưa có trang. " +
        (canDel ? "Kho chung đã có đủ — có thể xóa bản riêng để bớt dung lượng Firestore." : "Chỉ xóa được khi kho chung đã có đủ mọi trang (" + (miss ? "còn thiếu " + fmt(miss) + " trang" : "còn " + fmt(ownLeft) + " trang của bản riêng chưa có ở kho chung") + ").") + "</p>" +
        '<div class="row"><button class="btn bad" id="qsdel"' + (canDel && !busy ? "" : " disabled") + '>Xóa bản riêng cũ</button></div><div id="qsconf"></div>' :
        '<p class="sub">Không còn bản riêng (đã xóa hoặc chưa từng đưa lên).</p>') + "</div>";
      box.innerHTML = h;
      if (qtSachSt) qtSachProg(qtSachSt.k, qtSachSt.n, qtSachSt.txt, qtSachSt.busy);
      $("#qsup", box).onclick = function () { if (!(qtSachSt && qtSachSt.busy)) $("#qsupf", box).click(); };
      $("#qsupf", box).onchange = function () { var f = this.files && this.files[0]; this.value = ""; if (f) qtSachUp(f, redraw); };
      var d = $("#qsdel", box);
      if (d) d.onclick = function () {
        if (!canDel || (qtSachSt && qtSachSt.busy)) return;
        $("#qsconf", box).innerHTML = '<div class="row" style="margin-top:8px"><span>Xóa ' + fmt(nOwn) + ' trang bản riêng cũ? Không hoàn tác được (kho chung vẫn đủ, gói hình vẫn còn ở máy tính).</span><button class="btn sm bad" id="qsdy">Xóa</button><button class="btn sm" id="qsdn">Thôi</button></div>';
        $("#qsdn", box).onclick = function () { $("#qsconf", box).innerHTML = ""; };
        $("#qsdy", box).onclick = function () { qtSachDel(Object.keys(own), redraw); };
      };
    }, function (e) { box.innerHTML = '<p class="tkmsg">Chưa đọc được sach.json (' + esc(e && e.message) + ").</p>"; });
  }
  function qtSachUp(file, redraw) {
    qtSachProg(0, 1, "Đang đọc file…", true);
    var fr = new FileReader();
    fr.onerror = function () { qtSachProg(0, 1, "Không đọc được file.", false); };
    fr.onload = function () {
      var pk; try { pk = JSON.parse(fr.result); } catch (e) { pk = null; }
      fr = null;
      if (!pk || pk.v !== 1 || !pk.pages || typeof pk.pages !== "object") { qtSachProg(0, 1, "File không đúng: hãy chọn tools/work/sach/sach.pack.", false); return; }
      var col = fb.db.collection("hanco_sach"), big = [];
      col.doc("info").get().then(function (d) {
        var info = (d.exists && d.data()) || {}, sz = info.sz || {}, lastSave = 0;
        var todo = Object.keys(pk.pages).filter(function (vt) {
          var b = pk.pages[vt];
          if (!/^\d+$/.test(vt) || +vt <= 0 || typeof b !== "string" || !b) return false;
          if (b.length > 400000) { big.push(vt); return false; } // luật chặn trang > 400.000 ký tự
          return sz[vt] !== b.length;
        });
        var n = todo.length, skip = Object.keys(pk.pages).length - n - big.length;
        var bigTxt = big.length ? " " + big.length + " trang quá lớn bị bỏ qua (vị trí " + big.slice(0, 5).join(", ") + (big.length > 5 ? "…" : "") + ")." : "";
        if (!n) { qtSachProg(1, 1, "Kho chung đã có đủ " + Object.keys(sz).length + " trang, không cần đưa lên." + bigTxt, false); return; }
        qtSachProg(0, n, "Đang đưa lên 0/" + n + " trang" + (skip ? " (bỏ qua " + skip + " trang đã có)" : "") + "…", true);
        var saveInfo = function () { var x = { sz: sz, upd: Date.now() }; QT.sachPub = x; return col.doc("info").set(x); };
        return sachPool(todo, function (vt) {
          var b = pk.pages[vt];
          return col.doc("p" + vt).set({ b: b, vt: +vt, upd: Date.now() }).then(function () {
            sz[vt] = b.length;
            if (Object.keys(sz).length - lastSave >= 25) { lastSave = Object.keys(sz).length; return saveInfo(); }
          });
        }, function (k) { qtSachProg(k, n, "Đang đưa lên " + k + "/" + n + " trang…", true); }).then(function () {
          return saveInfo().then(function () {
            qtSachProg(n, n, "Xong: đã đưa lên " + n + " trang. Kho chung có " + Object.keys(sz).length + " trang." + bigTxt, false);
            toast("Đã đưa hình sách lên kho chung");
            qtLog("Đưa hình sách lên kho chung", null, n + " trang, kho có " + Object.keys(sz).length);
          });
        }, function (e) {
          return saveInfo().then(null, function () { }).then(function () { qtSachProg(0, 1, "Dừng giữa chừng (" + sachErrText(e) + "). Bấm lại và chọn file để đưa tiếp phần còn lại.", false); });
        });
      }).then(null, function (e) { qtSachProg(0, 1, "Chưa đưa lên được: " + sachErrText(e) + ".", false); }).then(function () {
        pk = null; SURL = {};
        if (cur === "qt-sach") redraw();
      });
    };
    fr.readAsText(file);
  }
  function qtSachDel(keys, redraw) { // xóa theo danh sách trang đã biết (info.sz) — không đọc lại từng trang
    var col = sachRef(); if (!col) return;
    var ids = keys.map(function (k) { return "p" + k; }).concat(["info"]), parts = [], done = 0;
    for (var i = 0; i < ids.length; i += 400) parts.push(ids.slice(i, i + 400));
    qtSachProg(0, ids.length, "Đang xóa bản riêng cũ…", true);
    parts.reduce(function (p, part) {
      return p.then(function () {
        var b = fb.db.batch(); part.forEach(function (id) { b.delete(col.doc(id)); });
        return b.commit().then(function () { done += part.length; qtSachProg(done, ids.length, "Đang xóa " + done + "/" + ids.length + "…", true); });
      });
    }, Promise.resolve()).then(function () {
      QT.sach = {}; SURL = {};
      qtSachProg(ids.length, ids.length, "Đã xóa bản riêng cũ (" + keys.length + " trang).", false);
      toast("Đã xóa bản riêng cũ"); qtLog("Xóa hình sách bản riêng cũ", null, keys.length + " trang");
    }, function (e) { qtSachProg(0, 1, "Xóa dừng giữa chừng (" + sachErrText(e) + "). Bấm Tải lại rồi xóa tiếp.", false); }).then(function () { if (cur === "qt-sach") redraw(); });
  }

  // ruby: ghép từng chữ với âm trong phiên âm của đề cương (nếu khớp số âm tiết), không thì lấy âm từ từ điển
  function rubyHTML(s, hide, link) {
    var hs = chars(s.han), syl = String(s.pa).replace(/\.\.\.|…/g, " ").split(/[\s,;.:]+/).filter(Boolean);
    var hanOnly = hs.filter(isHan);
    var useSyl = syl.length === hanOnly.length, k = 0;
    return '<span class="' + (hide ? "norubies" : "") + '">' + hs.map(function (ch) {
      if (!isHan(ch)) return esc(ch);
      var am = useSyl ? syl[k++] : (CHAR[ch] ? firstAm(CHAR[ch].am) : "");
      var c = link && CHAR[ch];
      return "<ruby" + (c ? ' class="rk" data-open="' + c.id + '" title="Xem chữ ' + esc(ch) + '"' : "") + ">" + esc(ch) + "<rt>" + esc(String(am).toLowerCase()) + "</rt></ruby>";
    }).join("") + "</span>";
  }
  HC.rubyHTML = rubyHTML;

  // ---------- chấm chữ viết tự động ----------
  var SK_A = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_", SK = null, skP = null;
  function loadStrokes() {
    if (SK) return Promise.resolve(SK);
    if (!skP) skP = fetch("app-strokes.json").then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }).then(function (j) { SK = j.d; return SK; }, function (e) { skP = null; throw e; });
    return skP;
  }
  HC.loadStrokes = loadStrokes;
  function skOf(ch) {
    var s = SK && SK[ch]; if (!s) return null;
    return s.split(" ").map(function (t) { var p = []; for (var i = 0; i + 1 < t.length; i += 2) p.push([SK_A.indexOf(t.charAt(i)) * 16, SK_A.indexOf(t.charAt(i + 1)) * 16]); return p; });
  }
  function gD(a, b) { var dx = a[0] - b[0], dy = a[1] - b[1]; return Math.sqrt(dx * dx + dy * dy); }
  function gLen(p) { var L = 0; for (var i = 1; i < p.length; i++) L += gD(p[i], p[i - 1]); return L; }
  function gRes(p, n) {
    var L = gLen(p), out = [[p[0][0], p[0][1]]], k;
    if (!(L > 0)) { for (k = 1; k < n; k++) out.push([p[0][0], p[0][1]]); return out; }
    var step = L / (n - 1), need = step, i = 1, a = p[0];
    while (i < p.length && out.length < n) {
      var b = p[i], d = gD(a, b);
      if (d >= need && d > 0) { var t = need / d; a = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; out.push(a); need = step; }
      else { need -= d; a = b; i++; }
    }
    var z = p[p.length - 1]; while (out.length < n) out.push([z[0], z[1]]);
    return out;
  }
  function gBox(ss) {
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    ss.forEach(function (s) { s.forEach(function (q) { if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0]; if (q[1] < y0) y0 = q[1]; if (q[1] > y1) y1 = q[1]; }); });
    return { w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
  }
  function gClamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  // Chấm theo HÌNH chữ (không xét số nét / thứ tự nét): rải điểm đều trên các nét người viết và trên nét mẫu,
  // đưa về cùng khung, đo độ lệch hai chiều (vị trí + hướng nét). Đúng = trong ~1.200 chữ có dữ liệu,
  // chữ giống nhất với hình bạn viết chính là chữ cần viết (hoặc gần như ngang bằng), và độ lệch không quá lớn.
  var G_P = 72, G_LAM = 0.12, G_ABS = 0.13, G_TIE = 1.2, G_OFF = 0.12, G_LAM2 = 0.25, G_RUN = 0.2, G_LRUN = 0.22, G_SHIFT = 0.12, TPL = {};
  // nét thừa / phần thiếu: một ĐOẠN LIỀN dài hơn G_RUN (thừa) / G_LRUN (thiếu) — tính theo khung chữ = 1 — mà mọi điểm đều cách nét kia quá G_OFF
  function gCloud(ss, n) { // điểm rải đều theo chiều dài + hướng nét tại điểm đó (không phân biệt chiều viết)
    var L = 0, out = []; ss.forEach(function (s) { L += gLen(s); });
    ss.forEach(function (s) {
      var k = Math.max(2, Math.round(n * (L > 0 ? gLen(s) / L : 1 / ss.length)) + 1), p = gRes(s, k);
      for (var i = 0; i < p.length; i++) {
        var a = p[Math.max(0, i - 1)], b = p[Math.min(p.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], h = Math.sqrt(dx * dx + dy * dy);
        out.push(h > 1e-9 ? [p[i][0], p[i][1], dx / h, dy / h, 1] : [p[i][0], p[i][1], 0, 0, 0]);
      }
    });
    return out;
  }
  function gT(P, t) { return P.map(function (p) { return [t.ax * p[0] + t.bx, t.ay * p[1] + t.by, p[2], p[3], p[4]]; }); }
  function gNormT(P) { var b = gBox([P]), M = Math.max(b.w, b.h) || 1; return { ax: 1 / M, bx: -b.cx / M, ay: 1 / M, by: -b.cy / M }; }
  function gNN(a, Y, lam) {
    var m = 1e9, mi = 0; if (lam == null) lam = G_LAM;
    for (var j = 0; j < Y.length; j++) {
      var b = Y[j], dx = a[0] - b[0], dy = a[1] - b[1], d2 = dx * dx + dy * dy;
      if (d2 >= m * m) continue;
      var c = Math.sqrt(d2) + lam * a[4] * b[4] * Math.abs(a[2] * b[3] - a[3] * b[2]);
      if (c < m) { m = c; mi = j; }
    }
    return [m, mi];
  }
  function gHalf(X, Y) { var t = 0; for (var i = 0; i < X.length; i++) t += gNN(X[i], Y)[0]; return t / X.length; }
  function gCham(A, B) { return (gHalf(A, B) + gHalf(B, A)) / 2; }
  function tpl(ch) {
    if (TPL[ch]) return TPL[ch];
    var E = skOf(ch); if (!E) return null;
    var c = gCloud(E, G_P), t = gNormT(c);
    var P = gT(c, t);
    return (TPL[ch] = { E: E, t: t, P: P, F: gFeat(P) });
  }
  // đặc trưng thô để lọc nhanh: lưới 6 x 6 x 4 hướng nét, có làm nhòe sang ô bên cạnh
  function gFeat(P) {
    var G = 6, F = new Array(G * G * 4), i, tot = 0; for (i = 0; i < F.length; i++) F[i] = 0;
    P.forEach(function (p) {
      var gx = (p[0] + 0.5) * G - 0.5, gy = (p[1] + 0.5) * G - 0.5, o = 0;
      if (p[4]) { var ang = Math.atan2(p[3], p[2]); if (ang < 0) ang += Math.PI; o = Math.round(ang / (Math.PI / 4)) % 4; }
      for (var dx = -1; dx <= 1; dx++) for (var dy = -1; dy <= 1; dy++) {
        var cx = Math.round(gx) + dx, cy = Math.round(gy) + dy; if (cx < 0 || cy < 0 || cx >= G || cy >= G) continue;
        var w = Math.max(0, 1 - Math.sqrt((cx - gx) * (cx - gx) + (cy - gy) * (cy - gy)) / 1.5);
        F[(cy * G + cx) * 4 + o] += w; tot += w;
      }
    });
    for (i = 0; i < F.length; i++) F[i] /= tot || 1;
    return F;
  }
  function gFD(A, B) { var d = 0; for (var i = 0; i < A.length; i++) d += Math.abs(A[i] - B[i]); return d; }
  function gFit(U, T) { // chỉnh tỉ lệ ngang/dọc + vị trí chữ người viết cho khớp mẫu (vài vòng ICP, giới hạn méo)
    var t = { ax: 1, bx: 0, ay: 1, by: 0 };
    for (var it = 0; it < 3; it++) {
      var X = gT(U, t), S = [0, 0, 0, 0, 0, 0, 0, 0, 0];
      var acc = function (u, q) { S[0] += u[0]; S[1] += u[1]; S[2] += u[0] * u[0]; S[3] += u[1] * u[1]; S[4] += q[0]; S[5] += q[1]; S[6] += u[0] * q[0]; S[7] += u[1] * q[1]; S[8]++; };
      X.forEach(function (x, i) { acc(U[i], T[gNN(x, T)[1]]); });
      T.forEach(function (q) { acc(U[gNN(q, X)[1]], q); });
      var m = S[8], vx = S[2] - S[0] * S[0] / m, vy = S[3] - S[1] * S[1] / m;
      var ax = vx > 1e-9 ? (S[6] - S[0] * S[4] / m) / vx : 1, ay = vy > 1e-9 ? (S[7] - S[1] * S[5] / m) / vy : 1;
      ax = gClamp(ax, 0.75, 1.33); ay = gClamp(ay, 0.75, 1.33);
      if (ax < 0.75 * ay) ax = 0.75 * ay; if (ay < 0.75 * ax) ay = 0.75 * ax;
      t = { ax: ax, bx: (S[4] - ax * S[0]) / m, ay: ay, by: (S[5] - ay * S[1]) / m };
    }
    return t;
  }
  // nhận dạng: chữ người viết (U = các nét) giống chữ nào nhất, và cách chữ cần viết bao xa
  function gRecog(U, target) {
    var Uc = gCloud(U, G_P), nu = gNormT(Uc), Un = gT(Uc, nu), sc = [];
    var Fu = gFeat(Un), pre = [];
    Object.keys(SK).forEach(function (k) { var T = tpl(k); if (T) pre.push([gFD(Fu, T.F), k]); });
    pre.sort(function (a, b) { return a[0] - b[0]; });
    pre.slice(0, 40).forEach(function (x) { sc.push([gCham(Un, tpl(x[1]).P), x[1]]); });
    sc.sort(function (a, b) { return a[0] - b[0]; });
    var top = sc.slice(0, 12).map(function (x) { return x[1]; }); if (top.indexOf(target) < 0) top.push(target);
    var fin = top.map(function (k) { var T = tpl(k), f = gFit(Un, T.P); return { k: k, d: gCham(gT(Un, f), T.P), f: f }; });
    fin.sort(function (a, b) { return a.d - b.d; });
    var me = null; fin.forEach(function (x) { if (x.k === target) me = x; });
    var f = me.f;
    return { d: me.d, best: fin[0].k, bestD: fin[0].d, rank: fin.indexOf(me), full: { ax: f.ax * nu.ax, bx: f.ax * nu.bx + f.bx, ay: f.ay * nu.ay, by: f.ay * nu.by + f.by } };
  }
  function gradeShape(U, ch) {
    var r = { ch: ch, k: U.length, ok: false, uOk: U.map(function () { return false; }), miss: [] };
    var T = tpl(ch); if (!T) { r.nodata = true; return r; }
    if (!U.length) return r;
    var g = gRecog(U, ch);
    r.d = g.d; r.best = g.best; r.rank = g.rank;
    r.recog = g.d <= G_ABS && (g.rank === 0 || g.d <= g.bestD * G_TIE);
    // nhìn ra chữ chưa đủ: không được có nét thừa (kể cả đường nối giữa các nét) và không được thiếu phần nào của chữ
    if (!T.D) T.D = gDense(T.E, T.t);
    var Tf = gFlat(T.D), Ud0 = gDense(U, g.full), sh = Ud0.map(function (s) { return gShift(s, Tf); });
    var Ud = Ud0.map(function (s, i) { return gMove(s, sh[i]); }), Uf = gFlat(Ud), ex = gRuns(Ud, Tf);
    var lk = gRuns(T.D.map(function (s) { return gMove(s, gShift(s, Uf)); }), Uf);
    r.extra = ex.max; r.lack = lk.max;
    r.ok = r.recog && r.extra <= G_RUN && r.lack <= G_LRUN;
    if (r.ok) { r.uOk = U.map(function () { return true; }); return r; }
    // tô màu: đoạn thừa (đổi về toạ độ ô viết) tô đỏ; nét mẫu có đoạn thiếu dài → vẽ nét đứt đỏ
    var f = g.full;
    r.uOk = ex.runs.map(function (rs) { return !rs.length; });
    r.badSegs = ex.runs.map(function (rs, i) { return rs.map(function (seg) { return seg.map(function (q) { return [(q[0] - sh[i][0] - f.bx) / f.ax, (q[1] - sh[i][1] - f.by) / f.ay]; }); }); });
    lk.runs.forEach(function (rs, j) { if (rs.length) r.miss.push(j); });
    return r;
  }
  HC.gradeShape = gradeShape;
  // cho từng nét người viết xê dịch một chút (tối đa G_SHIFT) cho khớp chỗ của nó trong chữ mẫu: chữ viết tay hay lệch từng bộ phận
  function gShift(s, Y) {
    var v = [0, 0];
    for (var it = 0; it < 2; it++) {
      var sx = 0, sy = 0;
      s.forEach(function (q) { var m = [q[0] + v[0], q[1] + v[1], q[2], q[3], q[4]], t = Y[gNN(m, Y, G_LAM2)[1]]; sx += t[0] - m[0]; sy += t[1] - m[1]; });
      v = [v[0] + sx / s.length, v[1] + sy / s.length];
      var L = Math.sqrt(v[0] * v[0] + v[1] * v[1]); if (L > G_SHIFT) v = [v[0] * G_SHIFT / L, v[1] * G_SHIFT / L];
    }
    return v;
  }
  function gMove(s, v) { return s.map(function (q) { return [q[0] + v[0], q[1] + v[1], q[2], q[3], q[4]]; }); }
  function gFlat(A) { var o = []; A.forEach(function (a) { o = o.concat(a); }); return o; }
  function gDense(ss, t) { // từng nét đổi sang khung chuẩn rồi rải điểm dày (cách ~0.02) kèm hướng
    return ss.map(function (s) { var p = s.map(function (q) { return [t.ax * q[0] + t.bx, t.ay * q[1] + t.by]; }); return gDirs(gRes(p, Math.max(2, Math.ceil(gLen(p) / 0.02) + 1))); });
  }
  function gRuns(A, Y) { // các đoạn liền của A nằm xa Y quá G_OFF (bỏ đoạn quá ngắn); trả về cả độ dài đoạn dài nhất
    var mx = 0, lim = Math.min(G_RUN, G_LRUN) / 2, runs = A.map(function (s) {
      var out = [], cur = null, L = 0;
      s.forEach(function (q) {
        if (gNN(q, Y, G_LAM2)[0] > G_OFF) { if (!cur) { cur = [q]; L = 0; } else { L += gD(q, cur[cur.length - 1]); cur.push(q); } if (L > mx) mx = L; }
        else if (cur) { if (L >= lim) out.push(cur); cur = null; }
      });
      if (cur && L >= lim) out.push(cur);
      return out;
    });
    return { max: mx, runs: runs };
  }
  function gDirs(s) { // các điểm gốc của một nét kèm hướng nét (để tô màu đúng từng đoạn)
    return s.map(function (p, i) {
      var a = s[Math.max(0, i - 2)], b = s[Math.min(s.length - 1, i + 2)], dx = b[0] - a[0], dy = b[1] - a[1], h = Math.sqrt(dx * dx + dy * dy);
      return h > 1e-9 ? [p[0], p[1], dx / h, dy / h, 1] : [p[0], p[1], 0, 0, 0];
    });
  }
  // lời nhận xét cho một chữ
  function gradeMsg(r) {
    if (r.nodata) return "chưa có dữ liệu để chấm tự động chữ này — tự so với chữ mẫu";
    if (!r.k) return "chưa viết";
    if (r.ok) return "Đúng — nhìn ra được chữ " + r.ch;
    var t = [];
    if (r.extra > G_RUN) t.push("có nét thừa không thuộc chữ " + r.ch + " (đoạn tô đỏ)");
    if (r.lack > G_LRUN) t.push("còn thiếu một phần của chữ (nét đứt đỏ)");
    if (!r.recog && r.best && r.best !== r.ch && r.rank > 0) t.push("trông giống chữ " + r.best + " hơn chữ " + r.ch);
    else if (!r.recog && !t.length) t.push("chưa nhìn ra chữ " + r.ch);
    return "Sai: " + t.join("; ");
  }
  HC.gradeMsg = gradeMsg;

  // ---------- chữ mẫu MS Song trên máy không cài MS Song ----------
  // Ảnh han/<mã hex>.webp vẽ sẵn bằng MS Song (tools/render_han.py): 320 x 320, chữ cỡ 256px, tâm ở giữa ảnh.
  // Máy có MS Song: vẫn dùng font như cũ. Máy không có (điện thoại): chữ mẫu ở ô tập viết + chữ to (.big) dùng ảnh.
  var HAN_IMG_K = 320 / 256, HIMG = {}, LOCAL_SONG = null;
  function localSong() {
    if (LOCAL_SONG !== null) return LOCAL_SONG;
    if (/[?&]song=img/.test(location.search)) return (LOCAL_SONG = false); // thử giao diện điện thoại trên máy có MS Song
    try {
      var c = document.createElement("canvas"); c.width = c.height = 40; var x = c.getContext("2d");
      var sig = function (f) { x.clearRect(0, 0, 40, 40); x.font = "32px " + f; x.textBaseline = "top"; x.fillText("學道", 2, 2); var d = x.getImageData(0, 0, 40, 40).data, s = 0; for (var i = 3; i < d.length; i += 4) s = (s * 31 + d[i]) % 1000000007; return s; };
      var a = sig('"MS Song", monospace'), a2 = sig('"MS Song", serif');
      LOCAL_SONG = a === a2 && a !== sig("monospace") && a2 !== sig("serif");
    } catch (e) { LOCAL_SONG = false; }
    return LOCAL_SONG;
  }
  HC.localSong = localSong;
  function hanKey(ch) { return (ch.codePointAt ? ch.codePointAt(0) : ch.charCodeAt(0)).toString(16); }
  function hanImg(ch, cb) { // cb(img) khi tải xong; chữ không có ảnh thì không gọi
    var k = hanKey(ch), h = HIMG[k];
    if (h) { if (h.ok) cb(h.img); else if (!h.bad) h.q.push(cb); return; }
    h = HIMG[k] = { q: [cb], img: new Image() };
    h.img.onload = function () { h.ok = 1; var q = h.q; h.q = []; q.forEach(function (f) { f(h.img); }); };
    h.img.onerror = function () { h.bad = 1; h.q = []; };
    h.img.src = "han/" + k + ".webp";
  }
  function tintImg(img, color) { // tô màu ảnh chữ (ảnh gốc chữ đen nền trong)
    var key = "t" + color; if (img[key]) return img[key];
    var c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
    var x = c.getContext("2d"); x.drawImage(img, 0, 0); x.globalCompositeOperation = "source-in"; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
    return (img[key] = c);
  }
  function songify(el) { // thay chữ to (.big) bằng ảnh MS Song, giữ nguyên màu (mask) và cỡ chữ
    var t = el.textContent, cs = chars(t.trim());
    if (!cs.length || !cs.every(isHan)) return;
    var got = 0, bad = false;
    cs.forEach(function (ch) { hanImg(ch, function () { if (++got === cs.length && !bad && el.textContent === t) { el.setAttribute("aria-label", t.trim()); el.innerHTML = cs.map(function (c) { var u = "url(han/" + hanKey(c) + ".webp)"; return '<span class="songimg" aria-hidden="true" style="-webkit-mask-image:' + u + ";mask-image:" + u + '"></span>'; }).join(""); } }); var h = HIMG[hanKey(ch)]; if (h && h.bad) bad = true; });
  }
  // Mọi chữ Hán khác trên trang (danh sách, câu, trò chơi, chữ xen trong nghĩa…): bọc từng chữ thành <span class="sg">chữ</span>.
  // Chữ thật vẫn ở trong trang (textContent, chọn/chép, trò chơi chấm không đổi); khi ảnh tải xong thêm lớp "on": chữ trong suốt,
  // ảnh MS Song (mặt nạ, màu theo chữ) hiện đè lên. Ảnh lỗi/chưa có → chữ vẫn hiện bằng phông dự phòng như cũ.
  var SG_SKIP = "script,style,textarea,input,select,option,svg,canvas,[contenteditable],.big,.sg,.songimg"; // ô soạn ghi chú: bọc riêng bằng sgEdit (giữ con trỏ); input/textarea: lớp đè inOv
  function sgChar(ch) {
    var o = ch.codePointAt(0);
    return isHan(ch) || (o >= 0x20000 && o <= 0x3FFFF) || (o >= 0x3001 && o <= 0x3003) || (o >= 0x3008 && o <= 0x3011) || o === 0xFF01 || o === 0xFF08 || o === 0xFF09 || o === 0xFF0C || o === 0xFF0E || o === 0xFF1A || o === 0xFF1B || o === 0xFF1F;
  }
  // Ảnh tải xong: bật lớp "on" cho mọi chữ đang chờ — gộp lại 1 lần mỗi khung hình (trước đây mỗi chữ trên trang quét cả trang 1 lần → chậm).
  var sgMarkWait = false;
  function sgMark() {
    sgMarkWait = false;
    Array.prototype.forEach.call(document.querySelectorAll(".sg:not(.on)"), function (x) { var h = HIMG[x.getAttribute("data-k")]; if (h && h.ok) x.className = "sg on"; });
  }
  function sgLoaded() { if (sgMarkWait) return; sgMarkWait = true; (window.requestAnimationFrame || setTimeout)(sgMark); }
  function sgText(tn) {
    var t = tn.nodeValue, p = tn.parentNode;
    if (!t || !p || p.nodeType !== 1 || tn._sg === t || !/[^\x00-⹿]/.test(t) || (p.closest && p.closest(SG_SKIP))) return;
    sgWrap(tn);
  }
  function sgWrap(tn) { // bọc từng chữ Hán của 1 nút chữ thành .sg; trả về true nếu đã thay nút
    var t = tn.nodeValue, p = tn.parentNode;
    var cs = chars(t); if (!cs.some(sgChar)) return false;
    var f = document.createDocumentFragment(), buf = "", made = 0;
    var flush = function () { if (buf) { var x = document.createTextNode(buf); x._sg = buf; f.appendChild(x); buf = ""; } }; // _sg: chữ do mình tạo, không xử lý lại
    cs.forEach(function (ch) {
      if (!sgChar(ch)) { buf += ch; return; }
      var k = hanKey(ch), h = HIMG[k];
      flush(); made++;
      var s = document.createElement("span"); s.className = h && h.ok ? "sg on" : "sg"; s.setAttribute("data-k", k); s.textContent = ch; f.appendChild(s);
      if (h && h.bad) return; // chữ không có ảnh (chữ ngoài dữ liệu, gõ trong ghi chú / ô tìm): vẫn bọc .sg → phông Tống dự phòng (CSS), không hẹn tải ảnh
      s.style.setProperty("--sg", "url(han/" + k + ".webp)");
      if (!(h && h.ok) && !(h && h.sgw)) { hanImg(ch, sgLoaded); HIMG[k].sgw = 1; } // mỗi chữ chỉ hẹn 1 lần
    });
    // Không có chữ nào đổi sang ảnh → KHÔNG thay nút chữ. (Lỗi đơ app: thay bằng nút chữ y hệt → MutationObserver thấy nút mới
    // → lại thay → lặp vô tận, trình duyệt treo cứng trên máy không có MS Song, gặp chữ không có ảnh như ký hiệu thanh mục 查 設.)
    if (!made) { tn._sg = t; return false; }
    flush();
    p.replaceChild(f, tn);
    return true;
  }
  function sgScan(n) {
    if (n.nodeType === 3) return sgText(n);
    if (n.nodeType !== 1 || n.closest(SG_SKIP)) return;
    var w = document.createTreeWalker(n, NodeFilter.SHOW_TEXT, null, false), list = [], x;
    while ((x = w.nextNode())) list.push(x);
    list.forEach(sgText);
  }
  function songWatch() {
    if (localSong() || !window.MutationObserver) return;
    var scan = function (n) { if (n.nodeType !== 1) return; if (n.classList.contains("big")) songify(n); Array.prototype.forEach.call(n.querySelectorAll(".big"), songify); };
    new MutationObserver(function (ms) {
      ms.forEach(function (m) {
        Array.prototype.forEach.call(m.addedNodes, function (n) { if (n.nodeType === 1 && n.classList.contains("sg")) return; scan(n); if (n.parentNode) sgScan(n); }); // .sg = chữ mình vừa bọc, không cần quét
        var t = m.target.nodeType === 1 ? m.target : m.target.parentNode;
        var b = t && t.closest ? t.closest(".big") : null; if (b) songify(b);
        if (m.type === "characterData" && m.target.parentNode) sgText(m.target);
      });
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
    scan(document.body); sgScan(document.body);
    inWatch();
  }
  // ---- ô soạn ghi chú (contenteditable) trên máy không có MS Song: bọc chữ Hán thành .sg ngay trong ô (chữ thật vẫn ở trong,
  // noteClean bỏ lớp span khi lưu). Chỉ chạy khi bộ gõ đã chốt chữ (không đụng chữ đang soạn của Telex / Pinyin), giữ vị trí con trỏ.
  function edOff(ed, node, off) { var r = document.createRange(); r.setStart(ed, 0); r.setEnd(node, off); return r.toString().length; }
  function edAt(ed, pos) { // vị trí con trỏ theo số ký tự → [nút, offset]; đứng ở mép chữ .sg thì đặt NGOÀI span (gõ tiếp không lọt vào span)
    var w = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT, null, false), x, cum = 0, r = document.createRange();
    while ((x = w.nextNode())) {
      var n = x.nodeValue.length, sg = x.parentNode.closest ? x.parentNode.closest(".sg") : null;
      if (pos <= cum + n) {
        if (sg && pos === cum + n) r.setStartAfter(sg); else if (sg && pos === cum) r.setStartBefore(sg); else r.setStart(x, pos - cum);
        return r;
      }
      cum += n;
    }
    r.selectNodeContents(ed); r.collapse(false); return r;
  }
  function sgEdit(ed) {
    if (!ed || localSong()) return;
    var sel = window.getSelection(), a = -1, f = -1, ch = 0;
    if (sel && sel.rangeCount && ed.contains(sel.anchorNode) && ed.contains(sel.focusNode)) { a = edOff(ed, sel.anchorNode, sel.anchorOffset); f = edOff(ed, sel.focusNode, sel.focusOffset); }
    // xóa chữ .sg rồi gõ tiếp → trình duyệt chép kiểu của nó sang chữ mới (font face=…, span style="-webkit-text-fill-color: transparent" → chữ vô hình): gỡ
    $$("font[face], [style]", ed).forEach(function (x) {
      if (x.classList.contains("sg")) return;
      if (x.tagName === "FONT") x.removeAttribute("face");
      else { x.style.removeProperty("-webkit-text-fill-color"); x.style.removeProperty("font-family"); if (!x.getAttribute("style")) x.removeAttribute("style"); }
      if (!x.attributes.length && (x.tagName === "FONT" || x.tagName === "SPAN")) { while (x.firstChild) x.parentNode.insertBefore(x.firstChild, x); x.parentNode.removeChild(x); }
      ch++;
    });
    $$(".sg", ed).forEach(function (s) { // span chỉ được chứa đúng 1 chữ Hán: gõ lọt vào / xóa hết chữ → gỡ span, chữ (nếu còn) bọc lại bên dưới
      var t = s.textContent, cs = chars(t);
      if (cs.length === 1 && sgChar(t) && s.childNodes.length === 1 && s.firstChild.nodeType === 3) return;
      while (s.firstChild) s.parentNode.insertBefore(s.firstChild, s);
      s.parentNode.removeChild(s); ch++;
    });
    var w = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT, null, false), list = [], x;
    while ((x = w.nextNode())) if (!x.parentNode.closest(".sg") && chars(x.nodeValue).some(sgChar)) list.push(x);
    list.forEach(function (tn) { if (sgWrap(tn)) ch++; });
    if (!ch || a < 0) return;
    var ra = edAt(ed, a), rf = edAt(ed, f);
    try { sel.removeAllRanges(); if (sel.setBaseAndExtent) sel.setBaseAndExtent(ra.startContainer, ra.startOffset, rf.startContainer, rf.startOffset); else sel.addRange(ra); } catch (e) { }
  }
  HC.sgEdit = sgEdit;
  // ---- ô gõ (input chữ / tìm, textarea) trên máy không có MS Song: chữ thật trong ô trong suốt, lớp .inov ngay sau ô hiện cùng nội dung
  // (MutationObserver ở trên tự đổi chữ Hán của lớp này sang ảnh), canh đúng vị trí, cỡ chữ, cuộn ngang/dọc của ô.
  var INOV = [], inTm = 0;
  function inOk(el) { return !!el && ((el.tagName === "INPUT" && (el.type === "text" || el.type === "search")) || el.tagName === "TEXTAREA"); }
  function inOv(el) {
    var ov = el._ov, i = INOV.indexOf(el);
    if (!el.isConnected || !el.offsetParent || !chars(el.value).some(sgChar)) {
      if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
      el._ov = null; el.classList.remove("inhan"); if (i >= 0) INOV.splice(i, 1);
      if (!INOV.length) { clearInterval(inTm); inTm = 0; }
      return;
    }
    if (!ov) { ov = el._ov = document.createElement("div"); ov.className = "inov"; ov.setAttribute("aria-hidden", "true"); ov.appendChild(document.createElement("span")); }
    if (ov.previousSibling !== el) el.parentNode.insertBefore(ov, el.nextSibling);
    el.classList.add("inhan");
    if (i < 0) { INOV.push(el); if (!inTm) inTm = setInterval(inAll, 150); } // đổi giá trị bằng mã / bố cục đổi → tự canh lại
    var cs = getComputedStyle(el), ta = el.tagName === "TEXTAREA", sp = ov.firstChild;
    var px = function (k) { return parseFloat(cs[k]) || 0; };
    var r = el.getBoundingClientRect();
    var sb = Math.max(0, el.offsetWidth - el.clientWidth - px("borderLeftWidth") - px("borderRightWidth")); // thanh cuộn của textarea
    if (el.type === "search") sb += px("fontSize") * 1.1; // nút ✕ xóa của ô tìm chiếm chỗ cuối ô: đừng vẽ chữ đè lên
    var ch = el.clientHeight - px("paddingTop") - px("paddingBottom");
    var st = "width:" + r.width + "px;height:" + r.height + "px;" +
      "font:" + cs.font + ";letter-spacing:" + cs.letterSpacing + ";text-align:" + cs.textAlign + ";text-indent:" + cs.textIndent + ";" +
      "padding:" + cs.paddingTop + " " + (px("paddingRight") + sb) + "px " + cs.paddingBottom + " " + cs.paddingLeft + ";border-width:" + cs.borderTopWidth + " " + cs.borderRightWidth + " " + cs.borderBottomWidth + " " + cs.borderLeftWidth + ";border-radius:" + cs.borderRadius + ";" +
      (ta ? "white-space:pre-wrap;overflow-wrap:" + (cs.overflowWrap || "break-word") + ";line-height:" + cs.lineHeight : "white-space:pre;line-height:" + Math.max(0, ch) + "px");
    if (ov._st !== st) { ov.style.cssText = st + ";left:" + (ov._x || 0) + "px;top:" + (ov._y || 0) + "px"; ov._st = st; }
    // vị trí: đo lệch giữa lớp đè và ô rồi bù (khung chứa có thể là khối có transform/contain — offsetParent không cho biết)
    var o = ov.getBoundingClientRect(), dx = r.left - o.left, dy = r.top - o.top;
    if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) { ov._x = (ov._x || 0) + dx; ov._y = (ov._y || 0) + dy; ov.style.left = ov._x + "px"; ov.style.top = ov._y + "px"; }
    if (sp.textContent !== el.value) sp.textContent = el.value;
    var tf = "translate(" + -el.scrollLeft + "px," + -el.scrollTop + "px)";
    if (sp.style.transform !== tf) sp.style.transform = tf;
  }
  function inAll() { INOV.slice().forEach(inOv); }
  function inFind(n) { if (n.nodeType !== 1) return; if (inOk(n)) { if (n.value) inOv(n); return; } if (n.querySelectorAll) Array.prototype.forEach.call(n.querySelectorAll("input,textarea"), function (x) { if (inOk(x) && x.value) inOv(x); }); }
  function inWatch() {
    var on = function (e) { var t = e.target; if (inOk(t)) inOv(t); };
    ["input", "focusin", "keyup", "click", "select", "change"].forEach(function (k) { document.addEventListener(k, on, true); });
    document.addEventListener("scroll", on, true); // cuộn chữ trong ô
    window.addEventListener("resize", inAll);
    new MutationObserver(function (ms) { ms.forEach(function (m) { Array.prototype.forEach.call(m.addedNodes, function (n) { if (!(n.classList && (n.classList.contains("sg") || n.classList.contains("inov")))) inFind(n); }); }); })
      .observe(document.body, { childList: true, subtree: true });
    inFind(document.body);
  }

  // ---------- hoạt hình thứ tự nét (thay chữ to ở thẻ học / khung chi tiết) ----------
  // net/<mã hex>.json sinh bằng tools/build_order.py (Make Me a Hanzi qua hanzi-writer-data, giấy phép Arphic — cùng dữ liệu
  // trang hanzii.net dùng): s = viền từng nét (path SVG), m = đường giữa từng nét [x,y,x,y…] theo hướng đưa bút;
  // khung 1024, trục y hướng lên, đường chân y = 900. Chữ không có dữ liệu hoặc mất mạng chưa tải được: hiện chữ MS Song (.big).
  var ODATA = {}, OSEQ = 0, AGRID = '<path class="agrid" d="M0 0L1024 1024M1024 0L0 1024M512 0V1024M0 512H1024"/>';
  function orderData(ch) {
    var k = hanKey(ch);
    if (!ODATA[k]) ODATA[k] = fetch("net/" + k + ".json").then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }).then(null, function (e) { delete ODATA[k]; throw e; });
    return ODATA[k];
  }
  HC.orderData = orderData;
  // o (tùy chọn): cls = lớp thêm (sm, xs: ô nhỏ), still = hiện sẵn cả chữ (bấm mới viết), rad = tô màu phần bộ (net r)
  function aniHTML(text, o) {
    o = o || {};
    var cs = chars(text), n = cs.length;
    if (!n || !cs.every(isHan)) return '<div class="big ' + lenCls(text) + (o.cls ? " " + o.cls : "") + '" lang="zh-Hant">' + esc(text) + "</div>";
    return '<div class="ani n' + (n === 1 ? 1 : n === 2 ? 2 : n <= 5 ? 4 : 6) + (o.cls ? " " + o.cls : "") + '"' + (o.still ? ' data-still="1"' : "") + (o.rad ? ' data-rad="1"' : "") + ' lang="zh-Hant" role="img" aria-label="' + esc(text) + ' (hoạt hình thứ tự nét)"><div class="acells" title="Bấm để xem viết lại">' +
      cs.map(function (ch) { return '<span class="acell" data-ch="' + esc(ch) + '"><svg viewBox="0 0 1024 1024" aria-hidden="true">' + AGRID + "</svg></span>"; }).join("") +
      '<button type="button" class="areplay hide" aria-label="Viết lại">↻</button></div><div class="anote"></div></div>';
  }
  HC.aniHTML = aniHTML;
  function aniBuild(cell, d, rad) {
    var id = "an" + (++OSEQ), defs = "", bg = "", fg = "", lens = [], rb = {};
    if (rad && d.r) d.r.forEach(function (i) { rb[i] = 1; }); // nét thuộc bộ → lớp rb (tô màu khác)
    d.s.forEach(function (outline, i) {
      var m = d.m[i] || [], pts = [], j, len = 0;
      for (j = 0; j + 1 < m.length; j += 2) pts.push([m[j], m[j + 1]]);
      if (pts.length > 1) { // kéo dài đầu nét lùi thêm 100 để nét bút phủ kín đầu nét (như hanzi-writer)
        var a = pts[0], b = pts[1], dx = a[0] - b[0], dy = a[1] - b[1], l = Math.sqrt(dx * dx + dy * dy) || 1;
        pts.unshift([a[0] + dx / l * 100, a[1] + dy / l * 100]);
      }
      for (j = 1; j < pts.length; j++) len += Math.sqrt(Math.pow(pts[j][0] - pts[j - 1][0], 2) + Math.pow(pts[j][1] - pts[j - 1][1], 2));
      len = Math.max(1, Math.ceil(len)); lens.push(len);
      defs += '<clipPath id="' + id + "-" + i + '"><path d="' + outline + '"/></clipPath>';
      bg += '<path class="ao' + (rb[i] ? " rb" : "") + '" d="' + outline + '"/>';
      fg += '<path class="as' + (rb[i] ? " rb" : "") + '" clip-path="url(#' + id + "-" + i + ')" d="M' + pts.map(function (q) { return Math.round(q[0]) + " " + Math.round(q[1]); }).join("L") + '" stroke-dasharray="' + len + " " + (len + 400) + '" stroke-dashoffset="' + len + '"/>';
    });
    cell.innerHTML = '<svg viewBox="0 0 1024 1024" aria-hidden="true">' + AGRID + "<defs>" + defs + '</defs><g transform="translate(0 900) scale(1 -1)">' + bg + fg + "</g></svg>";
    return { ps: $$(".as", cell), lens: lens };
  }
  function aniStart(el) {
    if (el.getAttribute("data-on")) return;
    el.setAttribute("data-on", "1");
    var cells = $$(".acell", el), btn = $(".areplay", el), note = $(".anote", el), run = 0, boxes = [];
    Promise.all(cells.map(function (c) {
      var ch = c.getAttribute("data-ch");
      return orderData(ch).then(function (d) {
        var it = CHAR[ch];
        if (it && it.net && +it.net !== d.s.length) note.textContent += (note.textContent ? " " : "") + ch + ": hoạt hình theo dữ liệu nét có " + d.s.length + " nét, đề cương ghi " + it.net + " nét.";
        return aniBuild(c, d, el.getAttribute("data-rad"));
      }, function () { c.classList.add("nodata"); c.innerHTML = '<span class="big">' + esc(ch) + "</span>"; return null; });
    })).then(function (bs) {
      boxes = bs.filter(Boolean);
      if (!boxes.length) return;
      btn.classList.remove("hide");
      $(".acells", el).onclick = play;
      var still = el.getAttribute("data-still") || window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (still) show(); else play();
    });
    function show() { run++; boxes.forEach(function (b) { b.ps.forEach(function (p) { p.classList.remove("on"); p.classList.add("dn"); p.setAttribute("stroke-dashoffset", 0); }); }); }
    function play() {
      var my = ++run, steps = [];
      boxes.forEach(function (b, bi) { b.ps.forEach(function (p, i) { p.classList.remove("on", "dn"); p.setAttribute("stroke-dashoffset", b.lens[i]); steps.push({ p: p, len: b.lens[i], gap: i ? 200 : bi ? 600 : 350 }); }); });
      var k = 0, t0 = null;
      function frame(t) {
        if (my !== run || !document.body.contains(el)) return; // đã bấm viết lại / đã rời thẻ: dừng
        var s = steps[k];
        if (t0 === null) t0 = t + s.gap;
        var x = (t - t0) / ((s.len + 600) / 2.8); // thời gian một nét (ms) theo độ dài nét
        if (x >= 0) { s.p.classList.remove(x >= 1 ? "on" : "dn"); s.p.classList.add(x >= 1 ? "dn" : "on"); s.p.setAttribute("stroke-dashoffset", Math.round(s.len * (1 - Math.min(1, x)))); }
        if (x >= 1) { k++; t0 = null; if (k >= steps.length) return; }
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    }
  }
  function aniWatch() {
    var scan = function (n) { if (n.nodeType !== 1) return; if (n.classList.contains("ani")) aniStart(n); $$(".ani", n).forEach(aniStart); if (n.classList.contains("giai")) giaiFill(n); $$(".giai[data-giai]", n).forEach(giaiFill); if (n.classList.contains("sach")) sachFill(n); $$(".sach[data-sach]", n).forEach(sachFill); };
    if (window.MutationObserver) new MutationObserver(function (ms) { ms.forEach(function (m) { Array.prototype.forEach.call(m.addedNodes, scan); }); }).observe(document.body, { childList: true, subtree: true });
    scan(document.body);
  }

  // ---------- writing pad (米字格) ----------
  function makePad(box, text, opts) {
    opts = opts || {};
    var cs = chars(text).filter(isHan);
    var n = Math.max(1, cs.length), maxCols = opts.cols || 4;
    var cols = Math.min(n, maxCols), rows = Math.ceil(n / cols);
    var avail = Math.max(200, (box.clientWidth || 320) - 4);
    var cell = Math.min(opts.cell || 300, avail / cols);
    // vừa cả CHIỀU CAO màn hình (máy tính bảng / laptop nằm ngang): ô viết + thanh nút (.acts) phải nằm trong màn hình.
    // Ưu tiên vừa ngay khi mở; nếu chỗ còn lại quá ít thì cho vừa sau khi kéo ô viết lên sát thanh trên.
    var vh = window.innerHeight || 0, reserve = opts.reserve == null ? 72 : opts.reserve;
    if (vh) {
      // thanh mục nằm dọc bên trái (màn ngang) thì không chiếm chiều cao
      var tb = document.querySelector(".topbar"), tbH = tb && tb.offsetWidth < (window.innerWidth || 0) * 0.5 ? 0 : tb ? tb.offsetHeight : 0;
      var top = box.getBoundingClientRect().top + (window.pageYOffset || 0);
      var hCell = (vh - top - reserve) / rows;
      if (hCell < 160) hCell = (vh - tbH - reserve - 12) / rows;
      cell = Math.min(cell, Math.max(hCell, Math.min(cell, 100)));
    }
    cell = Math.floor(cell);
    var dpr = window.devicePixelRatio || 1;
    var cv = document.createElement("canvas"); cv.className = "pad";
    cv.width = cols * cell * dpr; cv.height = rows * cell * dpr; cv.style.width = cols * cell + "px"; cv.style.height = rows * cell + "px";
    cv.setAttribute("aria-label", "Ô tập viết");
    box.innerHTML = ""; box.appendChild(cv);
    var ctx = cv.getContext("2d"); ctx.scale(dpr, dpr);
    var strokes = [], cur = null, showModel = false, res = null, song = {}, graded = null;
    var css = getComputedStyle(document.documentElement);
    function col(v) { return css.getPropertyValue(v).trim() || "#000"; }
    function line(s) { ctx.beginPath(); s.forEach(function (p, j) { if (j) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }); if (s.length === 1) ctx.lineTo(s[0][0] + 0.1, s[0][1]); ctx.stroke(); }
    function cellXY(i) { return [(i % cols) * cell, Math.floor(i / cols) * cell]; }
    function draw() {
      ctx.clearRect(0, 0, cols * cell, rows * cell);
      ctx.lineWidth = 1; ctx.strokeStyle = col("--line");
      for (var i = 0; i < n; i++) {
        var x = cellXY(i)[0], y = cellXY(i)[1];
        ctx.setLineDash([]); ctx.strokeRect(x + 0.5, y + 0.5, cell - 1, cell - 1);
        ctx.setLineDash([4, 5]); ctx.beginPath();
        ctx.moveTo(x, y + cell / 2); ctx.lineTo(x + cell, y + cell / 2); ctx.moveTo(x + cell / 2, y); ctx.lineTo(x + cell / 2, y + cell);
        ctx.moveTo(x, y); ctx.lineTo(x + cell, y + cell); ctx.moveTo(x + cell, y); ctx.lineTo(x, y + cell); ctx.stroke();
        if (showModel || opts.trace) {
          ctx.setLineDash([]); ctx.globalAlpha = showModel ? 0.38 : 0.16; ctx.fillStyle = showModel ? col("--seal") : col("--muted");
          var F = cell * 0.8, im = cs[i] && song[cs[i]];
          if (im) { var W = F * HAN_IMG_K; ctx.drawImage(tintImg(im, ctx.fillStyle), x + cell / 2 - W / 2, y + cell / 2 + cell * 0.03 - W / 2, W, W); }
          else { ctx.font = Math.round(F) + "px " + (col("--f-han") || "serif"); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(cs[i] || "", x + cell / 2, y + cell / 2 + cell * 0.03); }
          ctx.globalAlpha = 1;
        }
      }
      ctx.setLineDash([]); ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.lineWidth = Math.max(3, cell / 30);
      var ok = {};
      var segs = {};
      if (res) res.forEach(function (r) { (r.ids || []).forEach(function (si, j) { ok[si] = r.nodata ? 0 : r.ok ? 1 : -1; if (r.badSegs) segs[si] = r.badSegs[j]; }); });
      // chữ đúng: xanh; chữ sai: nét viết màu mực, đoạn thừa đè đỏ
      strokes.forEach(function (s, si) { ctx.strokeStyle = !res || ok[si] <= 0 ? col("--ink") : col("--good"); line(s); if (segs[si]) { ctx.strokeStyle = col("--seal"); segs[si].forEach(line); } });
      if (cur) { ctx.strokeStyle = col("--ink"); line(cur); }
      if (res) res.forEach(function (r, i) { // nét chuẩn còn thiếu / chưa khớp: vẽ nét đứt đỏ ở đúng chỗ trên chữ mẫu
        if (r.nodata || !r.miss || !r.miss.length || !r.E) return;
        var x = cellXY(i)[0] + cell / 2, y = cellXY(i)[1] + cell / 2 + cell * 0.03, k = cell * 0.8 / 1024;
        ctx.strokeStyle = col("--seal"); ctx.lineWidth = Math.max(2, cell / 45); ctx.setLineDash([Math.max(3, cell / 28), Math.max(3, cell / 28)]);
        r.miss.forEach(function (j) { line(r.E[j].map(function (q) { return [x + (q[0] - 512) * k, y + (q[1] - 512) * k]; })); });
        ctx.setLineDash([]);
      });
    }
    function pos(e) { var r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * (cols * cell / r.width), (e.clientY - r.top) * (rows * cell / r.height)]; }
    cv.addEventListener("pointerdown", function (e) { e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (x) { } if (res) { res = null; if (opts.onEdit) opts.onEdit(); } cur = [pos(e)]; draw(); });
    cv.addEventListener("pointermove", function (e) { if (!cur) return; cur.push(pos(e)); draw(); });
    function end() { if (cur) { strokes.push(cur); cur = null; draw(); } }
    cv.addEventListener("pointerup", end); cv.addEventListener("pointercancel", end); cv.addEventListener("pointerleave", end);
    if (document.fonts && document.fonts.load) { document.fonts.load(Math.round(cell * 0.8) + "px " + (col("--f-han") || "serif"), cs.join("")).then(draw, draw); }
    if (!localSong()) cs.forEach(function (ch) { hanImg(ch, function (img) { song[ch] = img; draw(); }); });
    draw();
    // chấm: chia nét theo ô (theo tâm nét), so với nét chuẩn của từng chữ; trả về mảng kết quả từng chữ
    function grade() {
      return loadStrokes().then(function () {
        var per = cs.map(function () { return []; });
        strokes.forEach(function (s, si) {
          var b = gBox([s]), c = gClamp(Math.floor(b.cx / cell), 0, cols - 1), rr = gClamp(Math.floor(b.cy / cell), 0, rows - 1), i = Math.min(rr * cols + c, per.length - 1);
          if (i >= 0) per[i].push(si);
        });
        res = cs.map(function (ch, i) {
          var r = gradeShape(per[i].map(function (si) { return strokes[si]; }), ch);
          r.ids = per[i]; r.E = skOf(ch); r.msg = gradeMsg(r);
          return r;
        });
        graded = { s: strokes.map(function (st) { return st.map(function (q) { return [Math.round(q[0]), Math.round(q[1])]; }); }), res: res };
        showModel = true; draw();
        return res;
      });
    }
    return {
      clear: function () { strokes = []; res = null; draw(); },
      undo: function () { strokes.pop(); res = null; draw(); },
      model: function (v) { showModel = v == null ? !showModel : v; draw(); return showModel; },
      empty: function () { return !strokes.length; },
      grade: grade,
      graded: function () { return graded; },
      // sau khi chấm: ô nào chấm sai mà nét lại khớp chữ khác (vd dạng rút gọn) → true (để báo "bạn viết dạng rút gọn")
      alsoIs: function (text2) { var c2 = chars(text2).filter(isHan); return (res || []).map(function (r, i) { return !!(c2[i] && c2[i] !== cs[i] && !r.ok && !r.nodata && r.ids.length && gradeShape(r.ids.map(function (si) { return strokes[si]; }), c2[i]).ok); }); },
      size: { cell: cell, cols: cols }
    };
  }
  HC.makePad = makePad;

  // ---------- multiple choice helper ----------
  // đáp án nhiễu: ưu tiên mục đã học, thiếu mới lấy thêm từ từ điển; any = true → như cũ (thi thử)
  function distract(it, n, field, any) {
    var pool = (it.type === "c" ? D.chars : it.type === "w" ? D.words : it.type === "r" ? D.rads : D.sents);
    var near = pool.filter(function (x) { return x !== it && x[field] && x[field] !== it[field] && (it.type !== "w" || chars(x.w).length === chars(it.w).length); });
    if (any) return pick(near.slice(0, 400), n);
    var lea = near.filter(function (x) { return introduced(x.id); });
    if (lea.length >= n) return pick(lea, n);
    return shuffle(lea.concat(pick(near.filter(function (x) { return !introduced(x.id); }).slice(0, 400), n - lea.length)));
  }
  HC.distract = distract;
  function meaningShort(it) { var m = it.ns || it.nb || ""; return m.length > 70 ? m.slice(0, 68) + "…" : m; }
  HC.meaningShort = meaningShort;

  // ---------- router ----------
  var VIEWS = [
    ["home", "Hôm nay"], ["hoc", "Học mới"], ["on", "Ôn tập"], ["kho", "Kho khó"], ["viet", "Tập viết"], ["choi", "Trò chơi"],
    ["bo", "Bộ thủ"], ["loaitu", "Loại từ"], ["cau", "Câu"], ["thi", "Thi thử"], ["xh", "Xếp hạng"], ["tra", "Tra cứu"], ["caidat", "Tiến độ & cài đặt"], ["qt", "Quản trị"]
  ];
  function viewList() { return VIEWS.filter(function (v) { return v[0] !== "qt" || isAdmin(); }); } // tab Quản trị: chỉ quản trị viên
  // ký hiệu chữ Hán (chỉ để trang trí, không phải nội dung thi) + nhãn ngắn cho thanh mục dọc hẹp
  var MENU_IC = {
    home: ["今", "Hôm nay"], hoc: ["新", "Học mới"], on: ["溫", "Ôn tập"], kho: ["難", "Kho khó"], viet: ["書", "Tập viết"], choi: ["戲", "Trò chơi"],
    bo: ["部", "Bộ thủ"], loaitu: ["類", "Loại từ"], cau: ["句", "Câu"], thi: ["試", "Thi thử"], xh: ["榜", "Xếp hạng"], tra: ["查", "Tra cứu"], caidat: ["設", "Cài đặt"], qt: ["管", "Quản trị"]
  };
  var cleanup = null;
  // THỨ TỰ các mục trên thanh menu: người học tự xếp (người dùng yêu cầu 25/11/2026), nhớ RIÊNG từng máy ở localStorage
  // "hanco-menu-thu-tu" (mảng tên màn), KHÔNG thuộc S. Luôn đủ mọi mục của VIEWS: mục lạ / trùng bị bỏ, mục mới thêm vào cuối.
  var MENU_KEY = "hanco-menu-thu-tu", menuCur = null, menuBadge = {};
  function menuOrder() {
    var ids = viewList().map(function (v) { return v[0]; }), saved = null, out = [];
    try { saved = JSON.parse(localStorage.getItem(MENU_KEY) || "null"); } catch (e) { saved = null; }
    if (Object.prototype.toString.call(saved) === "[object Array]") saved.forEach(function (k) { if (typeof k === "string" && ids.indexOf(k) >= 0 && out.indexOf(k) < 0) out.push(k); });
    ids.forEach(function (k) { if (out.indexOf(k) < 0) out.push(k); });
    return out;
  }
  function menuSaveOrder(order) { try { if (order) localStorage.setItem(MENU_KEY, JSON.stringify(order)); else localStorage.removeItem(MENU_KEY); } catch (e) { } }
  function viewName(k) { for (var i = 0; i < VIEWS.length; i++) if (VIEWS[i][0] === k) return VIEWS[i][1]; return k; }
  function badgeHTML(b) { return b ? '<span class="badge">' + (b > 99 ? "99+" : b) + "</span>" : ""; }
  function renderMenu(cur) {
    if (cur) menuCur = cur; cur = menuCur;
    var dr = due("r").length, dw = due("w").length, nq = newTotal();
    menuBadge = { on: dr, viet: dw, hoc: nq };
    $("#menu").innerHTML = menuOrder().map(function (k) {
      var name = viewName(k), ic = MENU_IC[k] || ["", name];
      return '<a href="#' + k + '" data-v="' + k + '" title="' + esc(name) + '"' + (k === cur ? ' aria-current="page"' : "") + '><span class="ic" aria-hidden="true">' + ic[0] + '</span><span class="lb">' + name + '</span><span class="sl" aria-hidden="true">' + ic[1] + "</span>" + badgeHTML(menuBadge[k]) + "</a>";
    }).join("") + '<button type="button" class="mmore mhid" id="mmore" aria-haspopup="menu" aria-expanded="false" title="Các mục khác" aria-label="Các mục khác">»<span class="dot" aria-hidden="true"></span></button>' +
      '<button type="button" class="msrt" data-msort title="Đổi vị trí các mục trên thanh menu"><span class="ic" aria-hidden="true">⇅</span><span>Sắp xếp mục</span></button>';
    fitMenu();
    var a = $('#menu a[aria-current="page"]:not(.mhid)'); if (a && a.scrollIntoView) { try { a.scrollIntoView({ block: "nearest", inline: "nearest" }); } catch (e) { } }
  }
  // thanh mục ở TRÊN (màn hẹp / dọc): mục nào không vừa 1 hàng thì ẩn, dồn vào nút » ở cuối hàng. Thanh dọc bên trái: hiện đủ.
  function menuIsTop() { var tb = $(".topbar"); return !!tb && tb.offsetWidth >= (window.innerWidth || 0) * 0.5; }
  function fitMenu() {
    var nav = $("#menu"), more = $("#mmore"); if (!nav || !more) return;
    var links = $$("a[data-v]", nav);
    links.forEach(function (a) { a.classList.remove("mhid"); });
    more.classList.add("mhid"); more.classList.remove("cur", "has-b");
    if (!menuIsTop()) return;
    nav.scrollLeft = 0;
    if (nav.scrollWidth <= nav.clientWidth + 1) return; // vừa hết, không cần »
    more.classList.remove("mhid");
    var left = nav.getBoundingClientRect().left, limit = nav.clientWidth - more.offsetWidth - 6, cut = -1;
    var rights = links.map(function (a) { return a.getBoundingClientRect().right - left; }); // đo hết rồi mới ẩn (ẩn làm xê dịch mục sau)
    for (var i = 0; i < rights.length; i++) if (rights[i] > limit) { cut = i; break; }
    if (cut < 0) { more.classList.add("mhid"); return; }
    for (var j = cut; j < links.length; j++) {
      links[j].classList.add("mhid");
      if (links[j].getAttribute("aria-current")) more.classList.add("cur");
      if (menuBadge[links[j].getAttribute("data-v")]) more.classList.add("has-b");
    }
  }
  var fitRaf = 0;
  window.addEventListener("resize", function () { if (fitRaf) return; fitRaf = (window.requestAnimationFrame || setTimeout)(function () { fitRaf = 0; fitMenu(); }); });
  try { if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitMenu); } catch (e) { }
  // bấm »: danh sách các mục đang ẩn (dùng chung khung bật lên .pop với nút ⋯)
  function openMenuMore(btn) {
    if (pop && pop.getAttribute("data-for") === "#menu") { closePop(); return; }
    closePop();
    var hid = $$("#menu a.mhid[data-v]");
    var h = hid.map(function (a) {
      var k = a.getAttribute("data-v"), name = viewName(k), ic = MENU_IC[k] || ["", name];
      return '<a class="pmi" role="menuitem" href="#' + k + '"' + (k === menuCur ? ' aria-current="page"' : "") + '><span class="ic" aria-hidden="true">' + ic[0] + "</span><span>" + name + "</span>" + badgeHTML(menuBadge[k]) + "</a>";
    }).join("") + '<hr><button type="button" role="menuitem" data-msort>⇅ Sắp xếp vị trí các mục…</button>';
    pop = document.createElement("div");
    pop.className = "pop"; pop.setAttribute("role", "menu"); pop.setAttribute("data-for", "#menu"); pop.innerHTML = h;
    pop.style.maxHeight = (window.innerHeight - 16) + "px"; pop.style.overflowY = "auto"; // không dùng vh: Chrome Android tính vh theo cả màn hình
    document.body.appendChild(pop);
    var r = btn.getBoundingClientRect(), W = window.innerWidth, H = window.innerHeight, pw = pop.offsetWidth, ph = pop.offsetHeight;
    var x = Math.max(8, Math.min(r.right - pw, W - pw - 8)), y = r.bottom + 6;
    if (y + ph > H - 8) y = Math.max(8, H - ph - 8);
    pop.style.left = x + "px"; pop.style.top = y + "px";
    btn.setAttribute("aria-expanded", "true");
    pop.addEventListener("click", function (e) { if (e.target.closest("a.pmi")) closePop(); });
    var f = pop.querySelector("a.pmi, button"); if (f) try { f.focus({ preventScroll: true }); } catch (e) { }
  }
  // khung "Sắp xếp thanh mục": nút ▲ ▼ từng mục (không kéo-thả: trên màn cảm ứng dễ trượt nhầm thành cuộn trang)
  function openMenuSort() {
    closePop();
    var m = modal('<h2>Sắp xếp thanh mục</h2><p class="sub">Bấm ▲ ▼ để đổi vị trí. Thứ tự lưu riêng trên máy này. Ở màn hẹp, các mục đầu hiện trên thanh, các mục sau nằm trong nút ».</p><ol class="msort" id="msl"></ol>' +
      '<div class="row acts"><button class="btn" type="button" id="msreset">Đặt lại mặc định</button><button class="btn primary" type="button" id="msdone">Xong</button></div>');
    var el = m.el;
    function draw(focusK, dir) {
      var o = menuOrder(), vis = $$("#menu a[data-v]:not(.mhid)").map(function (a) { return a.getAttribute("data-v"); });
      var top = menuIsTop() && $("#mmore") && !$("#mmore").classList.contains("mhid");
      $("#msl", el).innerHTML = o.map(function (k, i) {
        var name = viewName(k), ic = MENU_IC[k] || ["", name];
        return "<li" + (top && vis.indexOf(k) >= 0 ? ' class="vis" title="Đang hiện trên thanh"' : "") + '><span class="no">' + (i + 1) + '</span><span class="ic" aria-hidden="true">' + ic[0] + '</span><span class="lb">' + name + "</span>" +
          '<button class="btn sm" type="button" data-up="' + i + '" aria-label="Đưa ' + esc(name) + ' lên"' + (i ? "" : " disabled") + ">▲</button>" +
          '<button class="btn sm" type="button" data-dn="' + i + '" aria-label="Đưa ' + esc(name) + ' xuống"' + (i < o.length - 1 ? "" : " disabled") + ">▼</button></li>";
      }).join("");
      if (focusK) { var i2 = o.indexOf(focusK), b = $("[data-" + dir + '="' + i2 + '"]', el); if (!b || b.disabled) b = $("[data-" + (dir === "up" ? "dn" : "up") + '="' + i2 + '"]', el); if (b) try { b.focus({ preventScroll: true }); } catch (e) { } }
    }
    function move(i, d) {
      var o = menuOrder(), j = i + d; if (j < 0 || j >= o.length) return;
      var k = o[i]; o[i] = o[j]; o[j] = k;
      menuSaveOrder(o); renderMenu(); draw(k, d < 0 ? "up" : "dn");
    }
    $("#msl", el).addEventListener("click", function (e) {
      var u = e.target.closest("[data-up]"), d = e.target.closest("[data-dn]");
      if (u) move(+u.getAttribute("data-up"), -1); else if (d) move(+d.getAttribute("data-dn"), 1);
    });
    $("#msreset", el).onclick = function () { menuSaveOrder(null); renderMenu(); draw(); toast("Đã đặt lại thứ tự mặc định"); };
    $("#msdone", el).onclick = m.close;
    draw();
  }
  HC.openMenuSort = openMenuSort;
  document.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest("[data-msort]");
    if (t) { e.preventDefault(); openMenuSort(); }
  });
  // nút « / » thu gọn thanh mục dọc (chỉ hiện khi màn ngang ≥ 1000px); nhớ theo từng máy, không thuộc S
  function menuGonSync() {
    var gon = document.documentElement.classList.contains("menu-gon"), t = $("#mtog"); if (!t) return;
    t.textContent = gon ? "»" : "«"; t.title = gon ? "Mở rộng thanh mục" : "Thu gọn thanh mục"; t.setAttribute("aria-label", t.title); t.setAttribute("aria-expanded", gon ? "false" : "true");
  }
  (function () {
    var t = $("#mtog"); if (!t) return;
    t.onclick = function () {
      var gon = document.documentElement.classList.toggle("menu-gon");
      try { localStorage.setItem("hanco-menu-gon", gon ? "1" : "0"); } catch (e) { }
      menuGonSync();
      try { window.dispatchEvent(new Event("resize")); } catch (e) { } // đóng menu bật lên đang mở (vị trí đã đổi)
    };
    menuGonSync();
  })();
  function renderStats() {
    if (!S) return;
    var L = lvl();
    var sync = fb.on ? (fb.user ? "Đã đăng nhập (" + esc(fb.user.email || "") + "). Tiến độ tự lưu lên Firebase và tự đồng bộ với mọi máy bạn đăng nhập cùng tài khoản. Mỗi ngày tự sao lưu 1 bản, giữ 14 ngày." : "Chưa đăng nhập. Bấm Đăng nhập bằng Google (chỉ 1 lần trên máy này) để tự đồng bộ giữa các máy.") : remote.status === "synced" ? "Đã lưu vào tài khoản" : remote.status === "error" ? "Chưa đồng bộ được, đang lưu trên máy này" : remote.status === "full" ? "Bộ nhớ tài khoản đầy" : "Lưu trên trình duyệt này";
    var cloud = "";
    if (fb.on) {
      if (!fb.user) cloud = '<button class="pill cl" id="fbin" style="cursor:pointer;color:var(--seal)" title="Đăng nhập Google một lần để tự đồng bộ giữa các máy">☁ <span class="lb">Đăng nhập</span></button>';
      else {
        var fst = fb.status === "syncing" ? "Đang lưu…" : fb.status === "offline" ? "Ngoại tuyến · đã lưu trên máy" : fb.status === "error" ? "Chưa lưu được" : "Đã đồng bộ";
        cloud = '<span class="pill cl" title="' + esc(fst + " · " + (fb.user.email || "")) + '" style="color:' + (fb.status === "error" ? "var(--seal)" : fb.status === "offline" ? "var(--warn)" : "var(--good)") + '">☁ <span class="lb">' + fst + "</span></span>";
      }
    }
    var mOpen = !!document.getElementById("avmenu");
    $("#stats").innerHTML = cloud + '<span class="pill streak" title="Chuỗi ngày học liên tục">🔥 ' + (S.streak.d >= today() - 1 ? S.streak.c : 0) + '</span><span class="pill lv" title="' + esc(sync) + '">Cấp ' + L.l + '</span><span class="pill xp num">' + fmt(S.xp) + " XP</span>" + (fb.on && fb.user ? avTopHTML() : "");
    var fi = $("#fbin"); if (fi) fi.onclick = HC.fbSignIn;
    var ab = $("#avbtn"); if (ab) { ab.onclick = function () { avMenu(ab); }; avFill(ab); if (mOpen) ab.setAttribute("aria-expanded", "true"); }
    else avMenuClose();
  }
  HC.renderStats = renderStats;
  var cur = null;
  function route() {
    if (cur == null) cur = (location.hash || "#home").slice(1);
    HC.epoch = (HC.epoch || 0) + 1;
    if (cleanup) { try { cleanup(); } catch (e) { } cleanup = null; }
    layer.innerHTML = "";
    // KHÓA giao diện khi chưa vào được tài khoản (chưa đăng nhập / chưa xác nhận email / chưa đăng ký xong / bị khóa)
    var gated = tk.st !== "ok";
    document.documentElement.classList.toggle("gate", gated);
    if (gated) {
      var gv = $("#view"); gv.innerHTML = "";
      cleanup = tkView(gv) || null;
      window.scrollTo(0, 0);
      return;
    }
    var h = (cur || "home").split("-");
    var name = h[0]; if (!viewList().some(function (v) { return v[0] === name; })) name = "home";
    renderMenu(name); renderStats();
    var view = $("#view"); view.innerHTML = "";
    var fn = { home: vHome, hoc: vLearn, on: vReview, kho: vKho, viet: vWrite, choi: vGames, bo: vRad, loaitu: vLT, cau: vSent, thi: vExam, xh: vRank, tra: vLookup, caidat: vSettings, qt: vAdmin }[name];
    cleanup = fn(view, h.slice(1)) || null;
    planGate(); // người mới chưa có lộ trình: hộp thoại bắt buộc chọn (route vừa xóa lớp hộp thoại)
    try { view.focus({ preventScroll: true }); } catch (e) { }
    window.scrollTo(0, 0);
  }
  HC.route = route;
  // hẹn giờ chỉ chạy nếu người học vẫn ở màn hình đã đặt hẹn
  HC.later = function (fn, ms) { var ep = HC.epoch; return setTimeout(function () { if (HC.epoch === ep) fn(); }, ms); };
  HC.go = function (h) {
    cur = h;
    try { history.replaceState(null, "", h === "home" ? location.pathname + location.search : "#" + h); } catch (e) { }
    route();
  };
  document.addEventListener("click", function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey) return;
    e.preventDefault(); HC.go(a.getAttribute("href").slice(1));
  });
  HC.after = function () { save(); checkBadges(); renderStats(); renderMenu((cur || "home").split("-")[0]); };

  // ---------- HOME ----------
  function bars(label, total, a, b, c) {
    function w(x) { return Math.round(100 * x / Math.max(1, total)) + "%"; }
    return '<div class="prog"><div class="lab"><b>' + label + '</b><span class="num muted">' + fmt(a) + " đã học · " + fmt(b) + " nhớ" + (c >= 0 ? " · " + fmt(c) + " viết được" : "") + " / " + fmt(total) + '</span></div><div class="bar"><i class="a" style="width:' + w(a) + '"></i><i class="b" style="width:' + w(b) + '"></i>' + (c >= 0 ? '<i class="c" style="width:' + w(c) + '"></i>' : "") + "</div></div>";
  }
  function stat(list) {
    var a = 0, b = 0, c = 0;
    list.forEach(function (x) { var r = S.it[x.id]; if (r) { a++; if (r[0] >= 3) b++; if (r[2] >= 3) c++; } });
    return [a, b, c];
  }
  function ltStat(list) { var a = 0, b = 0; list.forEach(function (x) { var r = S.lt[x.x]; if (r) { a++; if (r[0] >= 3) b++; } }); return [a, b]; }
  // một dòng lộ trình của kỳ: tên, ngày thứ mấy, thanh chặng (chữ + từ → + loại từ → + câu → ôn cuối + thi thử), vạch = hôm nay
  function kyRow(p, t0) {
    var d = t0 - p.s, L = p.L, pct = function (x) { return (100 * x / L).toFixed(2) + "%"; }, left = p.e - t0;
    var segs = [[0, p.ltS, "chữ, từ"], [p.ltS, p.sS, "+ loại từ"], [p.sS, p.newEnd, "+ câu"], [p.newEnd, L, "ôn + thi thử"]];
    return '<div class="kyrow"><div class="row"><b>' + esc(p.T.name) + '</b><span class="muted num">ngày ' + (d + 1) + "/" + L + " · thi " + dateY(p.e) + (left > 0 ? " (còn " + left + " ngày)" : " (hôm nay)") + "</span></div>" +
      '<div class="phbar" aria-hidden="true">' + segs.map(function (s, i) { return s[1] > s[0] ? '<span class="ph' + i + '" style="width:' + pct(s[1] - s[0]) + '"><small>' + s[2] + "</small></span>" : ""; }).join("") + '<i style="left:' + pct(Math.min(L, d + 0.5)) + '"></i></div>' +
      '<small class="muted">Đang ở chặng: ' + phaseOf(p, d) + " · loại từ từ ngày " + (p.ltS + 1) + " · câu từ ngày " + (p.sS + 1) + " · ôn cuối từ ngày " + (p.newEnd + 1) + "</small></div>";
  }
  // "Việc hôm nay" chia theo từng kỳ đang học (người dùng yêu cầu 26/11/2026) + mục Chung (phần không thuộc kỳ nào, bộ thủ, trò chơi)
  function todayTasks(P, t0) {
    var h = "", multi = P.ps.length > 0, anyRv = false;
    P.ps.forEach(function (p) {
      var st = pstate(p, t0), q = st.q, T = p.T, n = q.c + q.w + q.s, dR = dueSec("r", p.k).length, dW = dueSec("w", p.k).length, lN = q.lt, lD = ltDue(p.k).length;
      if (st.rv) anyRv = true;
      h += '<h3 class="ksec">' + esc(T.name) + ' <small class="muted">ngày ' + (st.d + 1) + "/" + p.L + " · thi " + dateOf(p.e) + "</small></h3>";
      var sub = st.rv ? "Hôm nay là ngày ôn của " + T.short + ": không có bài mới. Muốn học trước thì bấm Học thêm." : n ? [q.c && q.c + " chữ", q.w && q.w + " từ", q.s && q.s + " câu"].filter(Boolean).join(" · ") : st.tail ? "Chặng ôn cuối: không thêm bài mới." : "Đã xong phần mới của hôm nay.";
      h += task("新", "", "Học mới", sub, '<a class="btn' + (n ? " primary" : "") + '" href="#hoc-' + p.k + '">' + (n ? "Bắt đầu" : "Học thêm") + "</a>");
      if (st.d >= p.ltS || lD) h += task("類", "", "Loại từ", lN || lD ? [lN && lN + " từ mới", lD && lD + " từ đến hạn ôn"].filter(Boolean).join(" · ") + " · làm bài kiểu đề" : "Đã xong hôm nay. Muốn làm thêm thì bấm Luyện.", '<a class="btn' + (lN || lD ? " primary" : "") + '" href="#hoc-' + p.k + '-lt">' + (lN || lD ? "Làm bài" : "Luyện") + "</a>");
      h += task("溫", "green", "Ôn thẻ đến hạn", dR ? dR + " thẻ cần ôn" : "Không có thẻ đến hạn", dR ? '<a class="btn primary" href="#on-' + p.k + '">Ôn ngay</a>' : '<a class="btn" href="#choi">Chơi trò ôn</a>');
      h += task("筆", "amber", "Tập viết", dW ? dW + " chữ / từ cần viết lại" : "Không có chữ cần viết hôm nay", '<a class="btn' + (dW ? " primary" : "") + '" href="#viet-' + p.k + '">Viết</a>');
      if (st.tail) h += task("試", "red", "Thi thử " + T.short, "Chặng ôn cuối: làm đề thi thử theo cấu trúc đề, xem phần sai rồi ôn lại", '<a class="btn primary" href="#thi-' + T.exam + '">Làm đề</a>');
    });
    var q = restQuota(t0), n = q.c + q.w + q.s + q.r, dR = dueSec("r", "chung").length, dW = dueSec("w", "chung").length, lD = ltDue("chung").length;
    if (multi) h += '<h3 class="ksec">Chung <small class="muted">phần không thuộc kỳ nào bạn đang học</small></h3>';
    if (n || !multi) h += task("新", "", "Học mới", n ? [q.c && q.c + " chữ", q.w && q.w + " từ", q.r && q.r + " bộ thủ", q.s && q.s + " câu"].filter(Boolean).join(" · ") : "Đã xong phần mới của hôm nay.", '<a class="btn' + (n ? " primary" : "") + '" href="#hoc-chung">' + (n ? "Bắt đầu" : "Học thêm") + "</a>");
    if (dR || !multi) h += task("溫", "green", multi ? "Ôn thẻ khác" : "Ôn thẻ đến hạn", dR ? dR + " thẻ cần ôn" : "Không có thẻ đến hạn", dR ? '<a class="btn primary" href="#on-chung">Ôn ngay</a>' : '<a class="btn" href="#choi">Chơi trò ôn</a>');
    if (dW || !multi) h += task("筆", "amber", multi ? "Tập viết khác" : "Tập viết", dW ? dW + " chữ / từ cần viết lại" : "Không có chữ cần viết hôm nay", '<a class="btn' + (dW ? " primary" : "") + '" href="#viet-chung">Viết</a>');
    if (lD) h += task("類", "", "Ôn loại từ", lD + " từ đến hạn ôn · làm bài kiểu đề", '<a class="btn primary" href="#hoc-chung-lt">Làm bài</a>');
    if (anyRv) h += task("試", "red", "Đấu cuối tuần", "Ngày ôn của tuần: làm bài thi ngắn trên những gì đã học", '<a class="btn primary" href="#choi-weekly">Vào đấu</a>');
    h += task("戲", "red", "Trò chơi ôn tập", HC.games.length + " trò chơi dùng đúng những chữ bạn đã học", '<a class="btn" href="#choi">Chơi</a>');
    return h;
  }
  function vHome(v) {
    var P = PLN(), t0 = today(), L = lvl();
    var h = '<div class="grid">';
    if (fb.on && !fb.user) h += '<div class="card" style="border-color:var(--seal)"><div class="row"><div style="flex:1;min-width:220px"><h2 style="margin:0">Đăng nhập Google để tự đồng bộ</h2><p class="sub" style="margin:0">Chỉ cần làm 1 lần trên máy này. Sau đó tiến độ tự lưu và tự đồng bộ với mọi máy khác của bạn.</p></div><button class="btn primary" id="fbin2">Đăng nhập bằng Google</button></div></div>';
    h += chungCards(t0); // thông báo chung + ngày thi chung (quản trị đặt)
    h += '<div class="card hero"><div class="row"><h1 style="margin:0">Lộ trình ôn thi</h1><span class="spacer"></span>' + (P.ps.length ? '<a class="btn sm" href="#caidat-ky">Chọn kỳ / đổi thời gian</a>' : "") + "</div>";
    h += P.ps.length ? P.ps.map(function (p) { return kyRow(p, t0); }).join("") : '<div id="kyhome"></div>';
    h += "</div>";
    h += '<div class="card"><h2>Việc hôm nay</h2>' + todayTasks(P, t0) + "</div>";
    // progress
    var cc = QC.slice(0, COMMON_C), ww = QW.slice(0, COMMON_W);
    var s1 = stat(cc), s2 = stat(D.chars), s3 = stat(ww), s4 = stat(D.words), s5 = stat(D.rads), s6 = stat(D.sents);
    h += '<div class="cols2"><div class="card"><div class="row"><h2 style="margin:0">Tiến độ</h2><span class="spacer"></span><a class="btn sm" href="#caidat-lich">Xem lịch trình</a></div><div class="legend"><span style="--k:color-mix(in srgb, var(--accent) 35%, transparent)">đã học</span><span style="--k:var(--accent)">nhớ (ôn đúng ≥ 3 lần)</span><span style="--k:var(--good)">viết được</span></div>';
    P.ps.forEach(function (p) {
      var T = p.T, a = stat(T.Q.c), b = stat(T.Q.w), c = stat(T.Q.s), l = ltStat(T.Q.lt);
      h += bars("Chữ " + T.short, T.Q.c.length, a[0], a[1], a[2]) + bars("Từ " + T.short, T.Q.w.length, b[0], b[1], b[2]) + bars("Loại từ " + T.short, T.Q.lt.length, l[0], l[1], -1) + bars("Câu " + T.short, T.Q.s.length, c[0], c[1], -1);
    });
    h += bars("Chữ thông dụng", COMMON_C, s1[0], s1[1], s1[2]) + bars("Từ thông dụng", COMMON_W, s3[0], s3[1], s3[2]) + bars("Toàn bộ chữ", D.chars.length, s2[0], s2[1], s2[2]) + bars("Toàn bộ từ", D.words.length, s4[0], s4[1], s4[2]) + bars("214 bộ thủ", 214, s5[0], s5[1], -1) + bars(D.sents.length + " câu đề cương", D.sents.length, s6[0], s6[1], -1);
    h += "</div>";
    h += '<div class="card"><h2>Cấp ' + L.l + ' · ' + fmt(S.xp) + ' XP</h2><div class="bar" aria-label="Kinh nghiệm"><i class="b" style="width:' + Math.round(100 * L.cur / L.need) + '%"></i></div><p class="sub" style="margin-top:6px">Còn ' + (L.need - L.cur) + " XP để lên cấp " + (L.l + 1) + ". Chuỗi ngày học: " + (S.streak.d >= today() - 1 ? S.streak.c : 0) + " ngày.</p>";
    h += '<div class="row" style="margin-top:14px"><h3 style="margin:0">Huy hiệu</h3><span class="spacer"></span><a class="btn sm" href="#xh-toi">Kỷ lục &amp; huy hiệu</a></div>' + badgesHome();
    var hard = HC.hard().slice(0, 12);
    var nk = HC.hardList().length;
    h += '<h3>Chữ hay quên</h3>' + (hard.length ? '<div class="minis">' + hard.map(miniHTML).join("") + '</div><p style="margin-top:8px"><a class="btn sm" href="#on-kho">Ôn riêng chữ hay quên</a></p>' : '<p class="sub">Chưa có. Chữ nào bạn quên từ 2 lần trở lên sẽ tự vào đây.</p>');
    h += '<h3>Kho khó</h3><p class="sub">' + (nk ? nk + " mục bạn tự đánh dấu là khó." : "Bấm nút ⋯ cạnh chữ, từ, câu để thêm vào kho khó.") + '</p><p style="margin-top:8px"><a class="btn sm" href="#kho">Mở kho khó</a></p>';
    h += "</div></div></div>";
    v.innerHTML = h;
    var b2 = $("#fbin2", v); if (b2) b2.onclick = HC.fbSignIn;
    chungBind(v);
    var kh = $("#kyhome", v); if (kh) planPick(kh, function () { route(); });
  }
  function task(ic, cls, title, sub, btn) { return '<div class="task"><div class="ic ' + cls + '" aria-hidden="true">' + ic + "</div><div><b>" + esc(title) + "</b><small>" + esc(sub) + "</small></div><div>" + btn + "</div></div>"; }

  // ---------- LEARN (học mới) ----------
  // #hoc = mục có bài hôm nay (nhiều mục → chọn) · #hoc-<kỳ> / #hoc-chung = bài của một mục · #hoc-<kỳ>-lt = loại từ (học mới + bài kiểu đề)
  function vLearn(v, args) {
    var sec = args[0], secs = sections();
    if (sec && sec !== "chung" && !planOf(sec)) sec = null;
    if (sec && args[1] === "lt") return ltRun(v, sec);
    if (!sec) {
      var work = secs.filter(function (k) { var q = secQuota(k); return q.c + q.w + q.s + (q.r || 0) > 0; });
      if (work.length > 1) {
        v.innerHTML = '<div class="card"><h1>Học mới</h1><p class="sub">Hôm nay có bài mới ở ' + work.length + " mục. Chọn mục muốn học trước:</p>" + work.map(function (k) { var q = secQuota(k); return task("新", "", secName(k), [q.c && q.c + " chữ", q.w && q.w + " từ", q.r && q.r + " bộ thủ", q.s && q.s + " câu"].filter(Boolean).join(" · "), '<a class="btn primary" href="#hoc-' + k + '">Bắt đầu</a>'); }).join("") + "</div>";
        return;
      }
      sec = work[0] || secs[0];
    }
    var b = nextBatch(sec);
    if (!b.cw.length && !b.s.length) {
      var p = sec === "chung" ? null : planOf(sec), rv = p && pstate(p, today()).rv;
      v.innerHTML = '<div class="card"><h1>Học mới · ' + esc(secName(sec)) + '</h1><p class="sub">' + (rv ? "Hôm nay là ngày ôn của kỳ này nên không có bài mới." : "Bạn đã học xong phần mới của hôm nay.") + ' Bạn có thể học trước bài của ngày mai.</p><div class="row"><button class="btn primary" id="more">Học thêm 10 chữ</button><a class="btn" href="#on-' + sec + '">Ôn tập</a><a class="btn" href="#choi">Trò chơi</a></div></div>';
      $("#more", v).onclick = function () { var x = nextBatch(sec, { c: 10, w: 8, r: 0, s: 0, lt: 0 }); if (!x.cw.length) { toast("Đã học hết chữ, từ của mục này"); return; } runLearn(v, x.cw, null, sec); };
      return;
    }
    var cl = null;
    function sents(i) {
      if (i >= b.s.length) return learnDone(v, b.cw.length + b.s.length, sec);
      sentPractice(v, b.s[i], { n: i + 1, of: b.s.length, done: function () { sents(i + 1); } });
    }
    if (b.cw.length) cl = runLearn(v, b.cw, function () { if (cl) { cl(); cl = null; } sents(0); }, sec);
    else sents(0);
    return function () { if (cl) cl(); };
  }
  function learnDone(v, total, sec) {
    var p = sec && sec !== "chung" ? planOf(sec) : null, lt = p ? pstate(p, today()).q.lt + ltDue(sec).length : 0;
    v.innerHTML = '<div class="card result"><div class="score-big">+' + total + '</div><h2>Xong bài học mới' + (sec ? " · " + esc(secName(sec, true)) : "") + '</h2><p class="sub">Các mục vừa học đã vào lịch ôn. Chữ và từ cũng đã có trong mục Tập viết.</p><div class="row" style="justify-content:center">' + (lt ? '<a class="btn primary" href="#hoc-' + sec + '-lt">Làm bài loại từ</a>' : "") + '<a class="btn' + (lt ? "" : " primary") + '" href="#viet' + (sec ? "-" + sec : "") + '">Tập viết ngay</a><a class="btn" href="#choi">Chơi trò ôn</a><a class="btn" href="#home">Về trang chính</a></div></div>';
  }
  // loại từ của một mục: từ mới (thẻ → kiểm tra) rồi bài kiểu đề: chữ gạch chân trong câu thuộc loại nào (từ đến hạn ôn + thêm cho đủ 10 câu,
  // ưu tiên từ hay sai). Đúng/sai ghi vào S.lt (ôn ngắt quãng riêng của loại từ).
  function ltRun(v, sec) {
    var p = sec === "chung" ? null : planOf(sec), ltk = p ? p.T.lt : "all", GG = p ? p.T.groups : Object.keys(D.loaitu);
    var news = nextBatch(sec).lt, dues = ltDue(sec), title = "Loại từ · " + secName(sec, true), used = {};
    news.concat(dues).forEach(function (o) { used[o.x] = 1; });
    var pool = shuffle(Object.keys(S.lt).map(function (x) { return LTI[x]; }).filter(function (o) { return o && !used[o.x] && secOf(o.id) === sec && GG.indexOf(o.g) >= 0; }))
      .sort(function (a, b) { return S.lt[b.x][2] - S.lt[a.x][2]; });
    var exam = dues.map(function (o) { return { o: o, pr: false }; });
    pool.slice(0, Math.max(0, 10 - exam.length - news.length)).forEach(function (o) { exam.push({ o: o, pr: true }); });
    exam = shuffle(exam);
    if (!news.length && !exam.length) {
      v.innerHTML = '<div class="card"><h1>' + esc(title) + '</h1><p class="sub">Chưa có loại từ nào để làm bài.' + (p ? " Loại từ của " + esc(p.T.short) + " bắt đầu từ ngày " + (p.ltS + 1) + " của lộ trình (" + dateOf(p.s + p.ltS) + ")." : "") + ' Bạn vẫn có thể xem bảng loại từ và làm các bài ôn ở màn Loại từ.</p><div class="row"><a class="btn primary" href="#loaitu' + (p ? "-" + p.T.lt : "") + '">Mở màn Loại từ</a><a class="btn" href="#home">Về trang chính</a></div></div>';
      return;
    }
    var i = 0, ok0 = {}, quiz = [], qi = 0, score = 0, tot = 0;
    function hd(step) { return '<div class="row noprint" style="margin-bottom:10px"><span class="chip num">' + step + '</span><span class="muted" style="font-size:0.85rem">' + esc(title) + '</span><span class="spacer"></span><a class="btn sm ghost" href="#home">Dừng</a></div>'; }
    function ctx(o) { return HC.ltCtx ? HC.ltCtx(ltk, o.x) : '<span class="hl">' + esc(o.x) + "</span>"; }
    function see() {
      var o = news[i], m = o.it ? meaningShort(o.it) : "";
      v.innerHTML = hd("Từ mới " + (i + 1) + "/" + news.length) + '<div class="stage"><div class="fc ltq"><div class="big ' + lenCls(o.x) + '">' + esc(o.x) + '</div><div style="font-weight:700;font-size:1.2rem;color:var(--seal)">' + esc(o.g) + '</div><div style="font-weight:600">' + esc(o.am) + "</div>" + (m ? '<div class="muted">' + esc(m) + "</div>" : "") + '</div><div class="card" style="width:min(680px,100%)"><p class="sub" style="margin:0 0 4px">Ví dụ trong đề cương / đề thi:</p><div class="sent">' + ctx(o) + '</div></div><div class="row acts"><button class="btn" id="prev"' + (i ? "" : " disabled") + '>Trước</button><button class="btn primary" id="next">' + (i < news.length - 1 ? "Tiếp" : "Kiểm tra") + "</button></div></div>";
      $("#prev", v).onclick = function () { if (i) { i--; see(); } };
      $("#next", v).onclick = function () { if (i < news.length - 1) { i++; see(); } else { quiz = shuffle(news.slice()); qi = 0; askNew(); } };
    }
    function askQ(o, label, cb) {
      v.innerHTML = hd(label) + '<div class="stage"><div class="card" style="width:min(680px,100%)"><div class="sent">' + ctx(o) + '</div><p class="sub" style="text-align:center">Chữ gạch chân thuộc loại từ nào?</p></div><div class="ltopts">' + GG.map(function (g, k) { return '<button class="btn" data-g="' + esc(g) + '">' + String.fromCharCode(65 + k) + ". " + esc(g) + "</button>"; }).join("") + '</div><div class="feedback" id="fb" role="status"></div></div>';
      $$(".ltopts .btn", v).forEach(function (b) {
        b.onclick = function () {
          var ok = b.getAttribute("data-g") === o.g, fb = $("#fb", v);
          $$(".ltopts .btn", v).forEach(function (x) { x.disabled = true; if (x.getAttribute("data-g") === o.g) x.classList.add("good"); });
          if (!ok) b.classList.add("bad");
          beep(ok);
          fb.className = "feedback " + (ok ? "ok" : "no"); fb.textContent = (ok ? "Đúng! " : "Chưa đúng. ") + o.x + (o.am ? " (" + o.am + ")" : "") + " là " + o.g + ".";
          cb(ok);
        };
      });
    }
    function askNew() {
      var o = quiz[qi];
      askQ(o, "Kiểm tra " + (qi + 1) + "/" + quiz.length, function (ok) {
        if (ok0[o.x] == null) ok0[o.x] = ok;
        if (!ok) quiz.push(o);
        HC.later(function () {
          qi++;
          if (qi < quiz.length) return askNew();
          news.forEach(function (x) { ltIntro(x.x, ok0[x.x] !== false); }); HC.after();
          qi = 0; if (exam.length) askEx(); else end();
        }, ok ? 800 : 1800);
      });
    }
    function askEx() {
      var q = exam[qi];
      askQ(q.o, "Bài kiểu đề " + (qi + 1) + "/" + exam.length, function (ok) {
        tot++; if (ok) score++;
        ltGrade(q.o.x, ok, q.pr); HC.after();
        HC.later(function () { qi++; if (qi < exam.length) askEx(); else end(); }, ok ? 900 : 1900);
      });
    }
    function end() {
      v.innerHTML = '<div class="card result"><div class="score-big">' + (tot ? score + "/" + tot : "+" + news.length) + '</div><h2>Xong bài loại từ</h2><p class="sub">' + (news.length ? news.length + " từ mới đã vào lịch ôn. " : "") + (tot ? "Từ nào sai sẽ được hỏi lại ngày mai." : "") + '</p><div class="row" style="justify-content:center"><a class="btn primary" href="#home">Về trang chính</a><button class="btn" id="again">Làm thêm 10 câu</button><a class="btn" href="#loaitu' + (p ? "-" + p.T.lt : "") + '">Màn Loại từ</a></div></div>';
      $("#again", v).onclick = function () { route(); };
    }
    if (news.length) see(); else askEx();
  }
  function runLearn(v, batch, onDone, sec) {
    var chunks = []; for (var i = 0; i < batch.length; i += 5) chunks.push(batch.slice(i, i + 5));
    var ci = 0, ii = 0, phase = "see", quiz = [], qi = 0, firstOk = {}, total = batch.length, doneCount = 0;
    function head() { return '<div class="row noprint" style="margin-bottom:10px"><span class="chip num">' + doneCount + "/" + total + ' mục</span><span class="muted" style="font-size:0.85rem">' + (phase === "see" ? "Bước 1: đọc kỹ chữ, âm, nghĩa" : "Bước 2: kiểm tra nhanh 5 mục vừa học") + '</span><span class="spacer"></span><a class="btn sm ghost" href="#home">Dừng</a></div>'; }
    function see() {
      var it = chunks[ci][ii];
      v.innerHTML = head() + '<div class="stage"><div class="card" style="width:min(680px,100%)">' + detailHTML(it) + '</div><div class="row acts"><button class="btn" id="prev"' + (ii ? "" : " disabled") + '>Trước</button><button class="btn primary" id="next">' + (ii < chunks[ci].length - 1 ? "Tiếp" : "Kiểm tra 5 mục này") + '</button></div><div class="kbd">Phím → hoặc Enter để tiếp</div></div>';
      $("#next", v).onclick = nextSee; $("#prev", v).onclick = function () { if (ii) { ii--; see(); } };
    }
    function nextSee() { if (ii < chunks[ci].length - 1) { ii++; see(); } else startQuiz(); }
    function startQuiz() { phase = "quiz"; quiz = shuffle(chunks[ci]); qi = 0; ask(); }
    function ask() {
      var it = quiz[qi];
      var opts = shuffle([it].concat(distract(it, 3, "am")));
      var qtext = it.type === "s" ? "Câu này đọc và dịch thế nào?" : "Chữ / từ này đọc và nghĩa là gì?";
      v.innerHTML = head() + '<div class="stage"><div class="fc"><span class="kind">' + kindLabel(it) + '</span><div class="big ' + lenCls(it.key) + '">' + esc(it.key) + '</div><div class="muted">' + qtext + '</div></div><div class="choices one">' + opts.map(function (o, k) { return '<button class="choice" data-k="' + k + '"><b>' + esc(it.type === "s" ? o.pa : o.am) + "</b><br><small>" + esc(it.type === "s" ? o.dn : meaningShort(o)) + "</small></button>"; }).join("") + '</div><div class="feedback" id="fb"></div></div>';
      $$(".choice", v).forEach(function (b) {
        b.onclick = function () {
          var o = opts[+b.getAttribute("data-k")], ok = o === it;
          $$(".choice", v).forEach(function (x) { x.disabled = true; if (opts[+x.getAttribute("data-k")] === it) x.classList.add("right"); });
          if (!ok) b.classList.add("wrong");
          beep(ok);
          if (firstOk[it.id] == null) firstOk[it.id] = ok;
          $("#fb", v).className = "feedback " + (ok ? "ok" : "no"); $("#fb", v).textContent = ok ? "Đúng!" : "Chưa đúng — chữ này sẽ được hỏi lại.";
          if (!ok) quiz.push(it);
          HC.later(function () { qi++; if (qi < quiz.length) ask(); else finishChunk(); }, ok ? 650 : 1500);
        };
      });
    }
    function finishChunk() {
      chunks[ci].forEach(function (it) { introduce(it.id, firstOk[it.id] !== false); doneCount++; });
      HC.after();
      ci++; ii = 0; phase = "see";
      if (ci < chunks.length) see(); else done();
    }
    function done() { if (onDone) onDone(); else learnDone(v, total, sec); }
    function key(e) { if (phase === "see" && (e.key === "ArrowRight" || e.key === "Enter") && !e.target.closest("input,textarea,[contenteditable],.more,.pop,.modal")) { e.preventDefault(); nextSee(); } }
    document.addEventListener("keydown", key);
    see();
    return function () { document.removeEventListener("keydown", key); };
  }

  // ---------- REVIEW (ôn thẻ) ----------
  function vReview(v, args) {
    var mode = args[0] === "kho" ? "kho" : "due", sec = args[0] === "chung" || TERM[args[0]] ? args[0] : null;
    var ids = mode === "kho" ? HC.hard().map(function (x) { return x.id; }).slice(0, 40) : (sec ? dueSec("r", sec) : due("r")).slice(0, 120);
    if (!ids.length) {
      v.innerHTML = '<div class="card"><h1>Ôn tập</h1><p class="sub">' + (mode === "kho" ? "Chưa có chữ hay quên." : "Không còn thẻ đến hạn hôm nay. Thẻ sẽ tự quay lại đúng ngày cần ôn.") + '</p><div class="row"><a class="btn primary" href="#choi">Chơi trò ôn</a><a class="btn" href="#hoc">Học mới</a></div></div>';
      return;
    }
    var queue = ids.slice(), i = 0, shown = false, done = 0, again = {};
    function render() {
      var it = ITEM[queue[i]], sw = it.type === "s" && it.write;
      v.innerHTML = '<div class="row" style="margin-bottom:10px"><h1 style="margin:0">' + (mode === "kho" ? "Ôn chữ hay quên" : "Ôn thẻ" + (sec ? " · " + esc(secName(sec, true)) : "")) + '</h1><span class="spacer"></span><span class="chip num">' + done + " / " + ids.length + '</span></div><div class="stage"><div class="fc" id="card"><span class="kind">' + kindLabel(it) + '</span>' + moreBtn(it.id) + (sw ? '<div class="sw4"><div class="am">' + esc(it.pa) + '</div><div class="muted">Câu viết chữ Hán: tự dịch nghĩa và viết chữ Hán (ra giấy) rồi lật thẻ</div></div>' : '<div class="big ' + lenCls(it.key) + '">' + (it.type === "s" ? rubyHTML(it, true) : esc(it.key)) + "</div>") + '<div class="ans' + (shown ? "" : " hide") + '">' + (sw ? '<div class="sent">' + esc(it.han) + "</div>" : '<div class="am">' + esc(it.type === "s" ? it.pa : it.am) + "</div>") + (it.type === "s" ? '<div class="ns">' + esc(it.dn) + "</div>" : meanHTML(it)) + extraLine(it) + (it.type === "c" || it.type === "w" ? occHTML(it, true) : "") + "</div></div>" +
        '<div class="acts">' + (shown ? '<div class="grades"><button class="btn bad" data-g="0">Quên<small>hỏi lại sớm</small></button><button class="btn warn" data-g="1">Nhớ mờ<small>ngày mai</small></button><button class="btn good" data-g="2">Nhớ rõ<small>' + nextGap(it.id) + "</small></button></div>" : '<button class="btn primary" id="show" style="min-width:200px">Xem đáp án</button>') + "</div>" +
        '<div class="kbd">Phím Space: xem đáp án · 1 / 2 / 3: chấm</div></div>';
      if (shown) $$("[data-g]", v).forEach(function (b) { b.onclick = function () { gradeIt(+b.getAttribute("data-g"), b); }; });
      else $("#show", v).onclick = function () { shown = true; render(); };
      $("#card", v).onclick = function () { if (!shown) { shown = true; render(); } };
    }
    function nextGap(id) { var r = S.it[id]; var b = Math.min(INT.length - 1, r[0] + 1); return INT[b] + " ngày nữa"; }
    function gradeIt(g, el) {
      var id = queue[i];
      if (!again[id]) grade(id, "r", g); // chỉ chấm lần đầu trong phiên
      if (g === 0) { again[id] = 1; queue.push(id); }
      else done++;
      if (g === 2) flyXP(2, el);
      HC.after();
      i++; shown = false;
      if (i < queue.length) render(); else finish();
    }
    function finish() {
      v.innerHTML = '<div class="card result"><div class="score-big">' + done + '</div><h2>Đã ôn xong</h2><p class="sub">Thẻ nào nhớ rõ sẽ quay lại sau vài ngày, thẻ quên sẽ quay lại ngày mai.</p><div class="row" style="justify-content:center"><a class="btn primary" href="#viet">Tập viết</a><a class="btn" href="#choi">Trò chơi</a><a class="btn" href="#home">Trang chính</a></div></div>';
    }
    function key(e) {
      if (e.target.closest("input,textarea,[contenteditable],.pop,.more,.modal")) return;
      if (!shown && (e.key === " " || e.key === "Enter")) { e.preventDefault(); shown = true; render(); }
      else if (shown && /^[123]$/.test(e.key)) { var b = $('[data-g="' + (+e.key - 1) + '"]', v); if (b) b.click(); }
    }
    document.addEventListener("keydown", key);
    render();
    return function () { document.removeEventListener("keydown", key); };
  }
  function extraLine(it) {
    var g = it.gt ? '<div class="extra">Rút gọn (giản thể ※): <span class="han gtt">' + esc(it.gt) + "</span></div>" : "";
    if (it.type === "c" && it.rad) { var r = RAD[it.rad]; return '<div class="extra">Bộ <span class="han">' + esc(r.r) + "</span> " + esc(r.am) + (it.bf && it.bf !== r.r ? ' · trong chữ này viết <span class="han">' + esc(it.bf) + "</span>" : "") + (it.net ? " · " + it.net + " nét" : "") + "</div>" + g; }
    if (it.type === "c") return g;
    if (it.type === "w") return '<div class="extra">' + chars(it.w).map(function (ch) { var c = CHAR[ch]; return '<span class="han">' + esc(ch) + "</span> " + esc(c ? firstAm(c.am) : ""); }).join(" · ") + "</div>" + g;
    if (it.type === "r") { var fs = (it.forms || []).filter(function (f) { return f.k === "bo"; }).map(function (f) { return f.f; }); return (it.verse ? '<div class="extra">' + esc(it.verse) + " · " + (it.net || "") + " nét</div>" : "") + (fs.length ? '<div class="extra">Khi nằm trong chữ khác viết: <span class="han">' + esc(fs.join(" ")) + "</span></div>" : ""); }
    return "";
  }
  HC.extraLine = extraLine;

  // ---------- mẫu chữ bị chấm nhầm — lưu ở máy để gửi người làm app chỉnh bộ chấm ----------
  // k: "dung" = viết đúng mà app chấm Sai ("Tôi viết đúng mà"; mẫu cũ không có k) · "sai" = viết sai mà app chấm Đúng · "cau" = báo từ phần viết câu
  var SAMPLE_KEY = "hanco-mau-cham-nham";
  function samples() { try { return JSON.parse(localStorage.getItem(SAMPLE_KEY) || "[]"); } catch (e) { return []; } }
  function saveSample(text, g, size, k) {
    if (!g) return false;
    var a = samples();
    a.push({ t: new Date().toISOString(), k: k || "dung", ch: text, cell: size.cell, cols: size.cols, s: g.s, r: g.res.map(function (r) { return { ch: r.ch, ok: r.ok, d: r.d, rank: r.rank, best: r.best, extra: r.extra, lack: r.lack, ids: r.ids }; }) });
    while (a.length > 150) a.shift();
    // bộ nhớ máy đầy → bỏ dần mẫu cũ nhất cho tới khi lưu được
    while (a.length) { try { localStorage.setItem(SAMPLE_KEY, JSON.stringify(a)); return true; } catch (e) { if (a.length === 1) break; a.shift(); } }
    toast("Không lưu được mẫu (bộ nhớ máy đầy). Vào Tập viết → Mẫu chấm nhầm, tải các mẫu về rồi xóa bớt.");
    return false;
  }
  HC.saveSample = saveSample; // trò viết tay của kho khó (games.js) dùng cho nút "Tôi viết đúng mà"
  function sampleTab(v, tabs) {
    var a = samples();
    var grp = [["dung", "Bạn viết đúng nhưng app chấm Sai"], ["sai", "Bạn viết sai nhưng app chấm Đúng"], ["cau", "Báo từ phần viết câu"]].map(function (g) {
      var xs = a.filter(function (x) { return (x.k || "dung") === g[0]; });
      return xs.length ? '<h3 style="margin:14px 0 6px">' + g[1] + " (" + xs.length + ')</h3><div style="display:flex;flex-wrap:wrap;gap:8px">' + xs.map(function (x) {
        var i = a.indexOf(x), tm = sampTime(x);
        return '<div style="border:1px solid var(--line);border-radius:10px;padding:6px 8px;background:var(--surface-2);display:flex;flex-direction:column;align-items:center;gap:4px;max-width:100%"><canvas data-th="' + i + '" aria-label="Chữ bạn đã viết" style="max-width:100%"></canvas><span class="han" style="font-size:1.05rem;max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(x.ch) + '</span><span class="muted" style="font-size:0.78rem">' + tm + '</span><button class="btn sm ghost" data-del="' + i + '" aria-label="Xóa mẫu ' + esc(x.ch) + " " + tm + '">✕ Xóa</button></div>';
      }).join("") + "</div>" : "";
    }).join("");
    v.innerHTML = tabs + '<div class="card"><h2>Mẫu chữ bị chấm nhầm</h2><p class="sub">Mỗi lần bạn bấm nút báo chấm nhầm ("Tôi viết đúng mà", "Chấm nhầm — thật ra tôi viết sai", "Báo chấm nhầm câu này"), chữ bạn viết được lưu ở máy này. Bấm Tải để lấy tệp rồi gửi cho người làm app để chỉnh cách chấm cho đúng với chữ viết tay của bạn.</p><p class="muted" style="font-size:0.88rem">Mẫu chỉ nằm trong trình duyệt của máy này (không đồng bộ sang máy khác), xóa dữ liệu trình duyệt là mất — nên tải về thường xuyên. Lưu tối đa 150 mẫu mới nhất.</p>' + (a.length ? grp + '<div class="row" style="margin-top:12px"><button class="btn primary" id="dls">Tải ' + a.length + ' mẫu (.json)</button><button class="btn" id="clrs">Xóa các mẫu đã gửi</button></div>' : '<p class="sub">Chưa có mẫu nào.</p>') + "</div>";
    var d = $("#dls", v); if (d) d.onclick = function () { HC.download("mau-cham-nham-" + dateOf(today()).replace(/\//g, "-") + ".json", JSON.stringify(a)); };
    var c = $("#clrs", v); if (c) c.onclick = function () { if (!confirm("Xóa " + a.length + " mẫu đã lưu?")) return; try { localStorage.removeItem(SAMPLE_KEY); } catch (e) { } sampleTab(v, tabs); };
    // hình thu nhỏ chữ người học đã viết (vẽ lại từ nét đã lưu, toạ độ theo ô viết lúc đó)
    var css = getComputedStyle(document.documentElement), ink = css.getPropertyValue("--ink").trim() || "#000", ln = css.getPropertyValue("--line").trim() || "#ccc";
    $$("canvas[data-th]", v).forEach(function (cv) {
      var x = a[+cv.getAttribute("data-th")], cell = x.cell || 230, cols = x.cols || 1, n = Math.max(1, chars(x.ch).filter(isHan).length), rows = Math.ceil(n / cols);
      var W = cols * cell, H = rows * cell, k = Math.min(72 / cell, 240 / W), dpr = window.devicePixelRatio || 1;
      cv.width = Math.round(W * k * dpr); cv.height = Math.round(H * k * dpr); cv.style.width = Math.round(W * k) + "px"; cv.style.height = Math.round(H * k) + "px";
      var g = cv.getContext("2d"); g.scale(k * dpr, k * dpr);
      g.strokeStyle = ln; g.lineWidth = 1 / k; for (var i = 0; i < n; i++) g.strokeRect((i % cols) * cell, Math.floor(i / cols) * cell, cell, cell);
      g.strokeStyle = ink; g.lineWidth = Math.max(3, cell / 30); g.lineCap = "round"; g.lineJoin = "round";
      (x.s || []).forEach(function (st) { if (!st.length) return; g.beginPath(); g.moveTo(st[0][0], st[0][1]); st.forEach(function (q) { g.lineTo(q[0], q[1]); }); if (st.length === 1) g.lineTo(st[0][0] + 0.1, st[0][1]); g.stroke(); });
    });
    // xóa từng mẫu: tìm theo thời điểm lưu + chữ (không theo vị trí) rồi chỉ bỏ đúng mẫu đó
    $$("[data-del]", v).forEach(function (b) {
      b.onclick = function () {
        var x = a[+b.getAttribute("data-del")], tm = sampTime(x), lab = x.ch + (tm ? " (" + tm + ")" : "");
        if (!confirm("Xóa mẫu " + lab + "? Mẫu đã xóa không lấy lại được.")) return;
        var cur = samples(), j = -1;
        for (var i = 0; i < cur.length; i++) if (cur[i].t === x.t && cur[i].ch === x.ch) { j = i; break; }
        if (j >= 0) { cur.splice(j, 1); try { if (cur.length) localStorage.setItem(SAMPLE_KEY, JSON.stringify(cur)); else localStorage.removeItem(SAMPLE_KEY); } catch (e) { } }
        sampleTab(v, tabs);
      };
    });
  }
  function sampTime(x) { var d = new Date(x.t); function two(n) { return (n < 10 ? "0" : "") + n; } return x.t && !isNaN(d) ? two(d.getDate()) + "/" + two(d.getMonth() + 1) + " " + two(d.getHours()) + ":" + two(d.getMinutes()) : ""; }

  // ---------- WRITE (tập viết) ----------
  function vWrite(v, args) {
    var tab = args[0] || "due", sec = tab === "chung" || TERM[tab] ? tab : null;
    if (sec) tab = "due";
    var tabs = '<div class="row" style="margin-bottom:12px"><h1 style="margin:0">Tập viết</h1><span class="spacer"></span><a class="btn sm' + (tab === "due" ? " primary" : "") + '" href="#viet">Viết theo lịch</a><a class="btn sm' + (tab === "dahoc" ? " primary" : "") + '" href="#viet-dahoc">Chữ đã học</a><a class="btn sm' + (tab === "phieu" ? " primary" : "") + '" href="#viet-phieu">Phiếu in</a><a class="btn sm' + (tab === "net" ? " primary" : "") + '" href="#viet-net">Nét &amp; bút thuận</a>' + (samples().length || tab === "mau" ? '<a class="btn sm' + (tab === "mau" ? " primary" : "") + '" href="#viet-mau">Mẫu chấm nhầm</a>' : "") + "</div>";
    if (tab === "net") { v.innerHTML = tabs + strokeLesson(); return; }
    if (tab === "mau") return sampleTab(v, tabs);
    if (tab === "phieu") return sheet(v, tabs);
    if (tab === "dahoc") return learnedTab(v, tabs);
    var ids = (sec ? dueSec("w", sec) : due("w")).slice(0, 30);
    if (!ids.length) { v.innerHTML = tabs + '<div class="card"><p class="sub">Không có chữ cần viết hôm nay. Học thêm chữ mới, hoặc luyện tự do với trò "Viết trên màn hình".</p><div class="row"><a class="btn primary" href="#viet-dahoc">Luyện chữ đã học</a><a class="btn" href="#choi-write">Viết tự do</a><a class="btn" href="#hoc">Học mới</a></div></div>'; return; }
    return writeSession(v, tabs, ids.map(function (id) { return ITEM[id]; }), true);
  }
  // opt (chỉ thẻ "Chữ đã học" dùng): { gap: viết sai thì hỏi lại sau ngần này câu, need: số lần đúng liên tiếp để qua, markWrong: lần sai đầu ghi vào lịch viết }
  function writeSession(v, tabs, items, srs, onEnd, opt) {
    var i = 0, ok = 0, pad = null, again = {}, queue = items.slice(), run = {}, marked = {};
    function render() {
      var it = queue[i], scored = false, verdict = null, firstRes = null;
      // dạng rút gọn (giản thể) không bắt buộc: phồn thể luôn phải viết; đã viết thêm dạng rút gọn thì phải đúng cả hai mới tính Đúng
      var hasGt = !!(it.gt && chars(it.gt).filter(isHan).length === chars(it.key).filter(isHan).length), tOK = null, gOK = null, gpad = null, gFirst = null;
      var gtRow = hasGt ? '<div class="row hide" id="gtrow" style="justify-content:center"><button class="btn" id="gtgo">Viết thêm dạng rút gọn (không bắt buộc)</button></div>' : "";
      var gtHtml = hasGt ? '<div class="gtwrap hide" id="gtbox"><div class="muted" style="text-align:center;font-size:0.88rem">Viết dạng rút gọn (giản thể) của ' + (chars(it.key).length > 1 ? "từ" : "chữ") + ' trên. Không bắt buộc — đã viết thì phải đúng cả hai dạng mới tính Đúng.</div><div class="padwrap" id="padbox2"></div><div class="row acts"><button class="btn" id="undo2">Xóa nét cuối</button><button class="btn" id="clr2">Xóa hết</button><button class="btn primary" id="chk2">Chấm dạng rút gọn</button></div><div class="gfb hide" id="fb2" role="status"></div><div class="row hide" id="apl2" style="justify-content:center"><button class="btn sm ghost" id="appeal2">Tôi viết đúng mà — tính là Đúng</button></div><div class="row hide" id="apn2" style="justify-content:center"><button class="btn sm ghost" id="appealno2">Chấm nhầm — thật ra tôi viết sai</button></div></div>' : "";
      v.innerHTML = tabs + '<div class="stage"><div class="row" style="width:min(560px,100%)"><span class="chip num">' + (i + 1) + " / " + queue.length + '</span><span class="muted" style="font-size:0.85rem">Viết chữ Hán theo âm và nghĩa, rồi bấm Chấm điểm</span></div><div class="work"><div class="winfo"><div class="fc" style="min-height:auto"><div class="ans"><div class="am">' + esc(it.am) + "</div>" + meanHTML(it) + '<div class="extra">' + chars(it.key).length + " chữ" + (it.type === "c" && it.net ? " · " + it.net + " nét" : "") + (it.type === "c" && it.rad ? ' · <button class="btn sm ghost" id="hint">Gợi ý bộ</button>' : "") + '</div></div></div><div class="row" style="justify-content:center" id="giveup"><button class="btn sm ghost" id="idk">Không nhớ — xem chữ mẫu</button></div></div><div class="wpadc"><div class="padwrap" id="padbox"></div><div class="acts"><div class="row"><button class="btn" id="undo">Xóa nét cuối</button><button class="btn" id="clr">Xóa hết</button><button class="btn primary" id="chk">Chấm điểm</button></div><div class="row hide" id="self"><button class="btn bad" id="bad">Tôi viết sai</button><button class="btn good" id="good">Tôi viết đúng</button></div><div class="row hide" id="aft"><button class="btn" id="redo">Viết lại để luyện</button><button class="btn primary" id="nx">Tiếp →</button></div></div></div><div class="wfb"><div class="gfb hide" id="fb" role="status"></div><div class="row hide" id="apl" style="justify-content:center"><button class="btn sm ghost" id="appeal">Tôi viết đúng mà — tính là Đúng</button></div><div class="row hide" id="apn" style="justify-content:center"><button class="btn sm ghost" id="appealno">Chấm nhầm — thật ra tôi viết sai</button></div>' + gtRow + "</div>" + gtHtml + '</div></div>';
      pad = makePad($("#padbox", v), it.key, { onEdit: function () { $("#fb", v).classList.add("hide"); } });
      var fb = $("#fb", v), chk = $("#chk", v);
      function showRow(id) { ["self", "aft"].forEach(function (x) { $("#" + x, v).classList.toggle("hide", x !== id); }); $("#giveup", v).classList.add("hide"); }
      function say(html) { fb.innerHTML = html; fb.classList.remove("hide"); }
      // lần chấm đầu quyết định kết quả; chỉ ghi vào lịch khi bấm Tiếp (để còn sửa được nếu app chấm nhầm)
      function combine() { verdict = tOK === null ? null : tOK && gOK !== false; }
      function record(good) { if (scored) return; scored = true; tOK = good; combine(); beep(good); if (hasGt && !gpad) $("#gtrow", v).classList.remove("hide"); }
      function finish(el) {
        if (verdict === null) return;
        if (srs && !again[it.id]) grade(it.id, "w", verdict ? 2 : 0);
        if (opt) {
          if (!verdict && opt.markWrong && !marked[it.id]) { marked[it.id] = 1; grade(it.id, "w", 0); }
          run[it.id] = verdict ? (run[it.id] || 0) + 1 : 0;
          if (verdict) { ok++; S.best.writeOk = (S.best.writeOk || 0) + 1; flyXP(2, el); if (!again[it.id]) PRAC[it.id] = 1; }
          else again[it.id] = 1;
          if (again[it.id] && run[it.id] < (opt.need || 2)) queue.splice(Math.min(queue.length, i + 1 + (opt.gap || 3)), 0, it);
          HC.after(); return;
        }
        if (verdict) { ok++; S.best.writeOk = (S.best.writeOk || 0) + 1; flyXP(2, el); } else { again[it.id] = 1; queue.push(it); }
        HC.after();
      }
      $("#undo", v).onclick = pad.undo; $("#clr", v).onclick = pad.clear;
      chk.onclick = function () {
        if (pad.empty()) { toast("Hãy viết chữ vào ô trước rồi bấm Chấm điểm"); return; }
        var first = !scored; chk.disabled = true; chk.textContent = "Đang chấm…";
        pad.grade().then(function (res) {
          chk.disabled = false; chk.textContent = "Chấm lại";
          var nod = res.some(function (r) { return r.nodata; }), good = res.every(function (r) { return r.ok || r.nodata; });
          var lines = res.map(function (r) { return '<div class="' + (r.nodata ? "" : r.ok ? "ok" : "no") + '"><span class="han">' + esc(r.ch) + "</span> " + esc(r.msg) + "</div>"; }).join("");
          if (nod && first) { say(lines + '<div class="verdict">Bạn tự so với chữ mẫu rồi chọn bên dưới</div>'); showRow("self"); return; }
          if (first) { record(good); firstRes = pad.graded(); $("#apl", v).classList.toggle("hide", good); $("#apn", v).classList.toggle("hide", !good); }
          var asGt = !good && hasGt && pad.alsoIs(it.gt).some(Boolean) ? '<div class="no">Bạn đã viết dạng rút gọn <span class="han">' + esc(it.gt) + '</span>. Ô này cần chữ phồn thể <span class="han">' + esc(it.key) + "</span> (bài thi viết phồn thể); dạng rút gọn viết ở ô riêng bên dưới.</div>" : "";
          say('<div class="verdict ' + (good ? "ok" : "no") + '">' + (good ? "Đúng ✓" : "Chưa đúng ✗") + (first ? "" : ' <small class="muted">(luyện thêm, không tính điểm)</small>') + "</div>" + asGt + lines + (good ? "" : '<div class="muted">Chữ mẫu hiện mờ phía sau. Chữ này sẽ được hỏi lại cuối lượt.</div>'));
          showRow("aft");
        }, function () {
          chk.disabled = false; chk.textContent = "Chấm điểm"; pad.model(true);
          say('<div class="verdict">Không tải được dữ liệu chấm (có thể đang mất mạng)</div><div class="muted">Tự so với chữ mẫu rồi chọn bên dưới.</div>');
          showRow(scored ? "aft" : "self");
        });
      };
      $("#idk", v).onclick = function () { record(false); pad.model(true); say('<div class="verdict no">Đã tính là chưa nhớ</div><div class="muted">Tô theo chữ mẫu rồi bấm Chấm lại để luyện. Chữ này sẽ được hỏi lại cuối lượt.</div>'); showRow("aft"); };
      $("#redo", v).onclick = function () { pad.clear(); pad.model(false); fb.classList.add("hide"); };
      $("#nx", v).onclick = function () {
        if (gpad && !gpad.empty() && gOK === null) { toast("Bấm “Chấm dạng rút gọn” trước (hoặc Xóa hết nếu không muốn viết dạng rút gọn)"); return; }
        finish(this); next();
      };
      $("#appeal", v).onclick = function () {
        tOK = true; combine(); $("#apl", v).classList.add("hide");
        saveSample(it.key, firstRes, pad.size, "dung");
        say('<div class="verdict ok">Đã tính là Đúng ✓</div><div class="muted">Cảm ơn bạn! Chữ này đã được lưu để chỉnh lại cách chấm (mục Tập viết → Mẫu chấm nhầm).</div>');
      };
      $("#appealno", v).onclick = function () {
        tOK = false; combine(); $("#apn", v).classList.add("hide"); pad.model(true);
        saveSample(it.key, firstRes, pad.size, "sai");
        say('<div class="verdict no">Đã tính là Sai ✗</div><div class="muted">Cảm ơn bạn! Chữ này đã được lưu để chỉnh lại cách chấm (mục Tập viết → Mẫu chấm nhầm). Chữ mẫu hiện mờ phía sau; chữ này sẽ được hỏi lại cuối lượt.</div>');
      };
      var hb = $("#hint", v); if (hb) hb.onclick = function () { var r = RAD[it.rad]; hb.outerHTML = 'Bộ <span class="han">' + esc(r.r) + "</span> " + esc(r.am); };
      $("#bad", v).onclick = function () { record(false); showRow("aft"); }; $("#good", v).onclick = function () { record(true); showRow("aft"); };
      if (hasGt) {
        var fb2 = $("#fb2", v), chk2 = $("#chk2", v);
        var say2 = function (html) { fb2.innerHTML = html; fb2.classList.remove("hide"); };
        var total = function () { return tOK ? (gOK ? "Thẻ này tính <b>Đúng</b> (đúng cả hai dạng)." : "Thẻ này tính <b>Sai</b> vì dạng rút gọn chưa đúng — sẽ hỏi lại cuối lượt.") : "Thẻ đã tính Sai ở phần chữ phồn thể."; };
        $("#gtgo", v).onclick = function () {
          $("#gtrow", v).classList.add("hide"); $("#gtbox", v).classList.remove("hide");
          gpad = makePad($("#padbox2", v), it.gt, { onEdit: function () { fb2.classList.add("hide"); } });
          var gb = $("#gtbox", v); if (gb.scrollIntoView) gb.scrollIntoView({ block: "nearest", behavior: "smooth" });
          $("#undo2", v).onclick = gpad.undo; $("#clr2", v).onclick = gpad.clear;
        };
        chk2.onclick = function () {
          if (gpad.empty()) { toast("Hãy viết dạng rút gọn vào ô trước rồi bấm Chấm"); return; }
          var first = gOK === null; chk2.disabled = true; chk2.textContent = "Đang chấm…";
          gpad.grade().then(function (res) {
            chk2.disabled = false; chk2.textContent = "Chấm lại";
            var nod = res.some(function (r) { return r.nodata; }), good = res.every(function (r) { return r.ok || r.nodata; });
            var lines = res.map(function (r) { return '<div class="' + (r.nodata ? "" : r.ok ? "ok" : "no") + '"><span class="han">' + esc(r.ch) + "</span> " + esc(r.msg) + "</div>"; }).join("");
            if (nod) { say2(lines + '<div class="muted">Chữ này chưa có dữ liệu để chấm: tự so với chữ mẫu mờ. Phần rút gọn không tính vào điểm.</div>'); return; }
            if (first) { gOK = good; combine(); beep(good); gFirst = gpad.graded(); $("#apl2", v).classList.toggle("hide", good); $("#apn2", v).classList.toggle("hide", !good); }
            say2('<div class="verdict ' + (good ? "ok" : "no") + '">Dạng rút gọn: ' + (good ? "Đúng ✓" : "Chưa đúng ✗") + (first ? "" : ' <small class="muted">(luyện thêm, không tính điểm)</small>') + "</div>" + lines + '<div class="muted">' + total() + "</div>");
          }, function () {
            chk2.disabled = false; chk2.textContent = "Chấm dạng rút gọn"; gpad.model(true);
            say2('<div class="verdict">Không tải được dữ liệu chấm (có thể đang mất mạng)</div><div class="muted">Tự so với chữ mẫu mờ. Phần rút gọn không tính vào điểm.</div>');
          });
        };
        $("#appeal2", v).onclick = function () {
          gOK = true; combine(); $("#apl2", v).classList.add("hide");
          saveSample(it.gt, gFirst, gpad.size, "dung");
          say2('<div class="verdict ok">Đã tính dạng rút gọn là Đúng ✓</div><div class="muted">' + total() + " Chữ đã được lưu để chỉnh cách chấm (Tập viết → Mẫu chấm nhầm).</div>");
        };
        $("#appealno2", v).onclick = function () {
          gOK = false; combine(); $("#apn2", v).classList.add("hide"); gpad.model(true);
          saveSample(it.gt, gFirst, gpad.size, "sai");
          say2('<div class="verdict no">Đã tính dạng rút gọn là Sai ✗</div><div class="muted">' + total() + " Chữ đã được lưu để chỉnh cách chấm (Tập viết → Mẫu chấm nhầm).</div>");
        };
      }
    }
    function next() { i++; if (i < queue.length) render(); else end(); }
    function end() {
      if (onEnd) return onEnd(ok, items.length);
      v.innerHTML = tabs + '<div class="card result"><div class="score-big">' + ok + '</div><h2>Xong phần tập viết</h2><p class="sub">Viết tay ra giấy nữa sẽ nhớ lâu hơn: vào mục Phiếu in để tải phiếu kẻ ô.</p><div class="row" style="justify-content:center"><a class="btn primary" href="#viet-phieu">Phiếu in</a><a class="btn" href="#home">Trang chính</a></div></div>';
    }
    render();
  }
  HC.writeSession = writeSession;
  // ---------- luyện chữ / từ đã học: mục yếu đưa vào hết, mục đã thuộc chỉ thỉnh thoảng ----------
  var PRAC = {}; // mục đã viết đúng ngay lần đầu trong lần mở app này → lượt sau nhường chỗ cho mục khác
  function wLevel(id) { // 0 cần luyện · 1 đang nhớ · 2 đã thuộc (theo mức viết, mức nhớ nghĩa, số lần quên)
    var r = S.it[id];
    if (r[2] <= 2 || r[0] <= 2 || r[4] >= 2) return 0;
    return r[2] >= 4 && r[0] >= 3 ? 2 : 1;
  }
  function wScore(id) { var r = S.it[id]; return r[2] * 2 + r[0] - r[4] * 2 + Math.random() * 2; } // nhỏ = yếu
  function learnedTab(v, tabs) {
    var all = learnedOf("c").concat(learnedOf("w")).filter(function (x) { return S.it[x.id][2] >= 0; });
    var g = [[], [], []]; all.forEach(function (x) { g[wLevel(x.id)].push(x); });
    function byWeak(a) { var sc = {}; a.forEach(function (x) { sc[x.id] = wScore(x.id); }); return a.sort(function (x, y) { return sc[x.id] - sc[y.id]; }); }
    function smart() {
      var pick = g[0].concat(g[1].filter(function () { return Math.random() < 0.5; }), g[2].filter(function () { return Math.random() < 0.25; }));
      var fresh = pick.filter(function (x) { return !PRAC[x.id]; });
      if (!fresh.length) { PRAC = {}; fresh = pick; }
      return byWeak(fresh).slice(0, 30);
    }
    function start(items) {
      if (!items.length) { toast("Chưa có chữ nào để luyện"); return; }
      writeSession(v, tabs, items, false, function (ok, n) {
        v.innerHTML = tabs + '<div class="card result"><div class="score-big">' + ok + '</div><h2>Xong lượt luyện ' + n + ' mục</h2><p class="sub">Chữ viết sai đã được hỏi lại đến khi đúng 2 lần liên tiếp, và sẽ có lại trong "Viết theo lịch" ngày mai.</p><div class="row" style="justify-content:center"><button class="btn primary" id="more">Luyện tiếp</button><a class="btn" href="#viet-dahoc">Danh sách chữ đã học</a><a class="btn" href="#home">Trang chính</a></div></div>';
        $("#more", v).onclick = function () { learnedTab(v, tabs); var b = $("#smart", v); if (b) b.click(); };
      }, { gap: 3, need: 2, markWrong: true });
    }
    if (!all.length) { v.innerHTML = tabs + '<div class="card"><p class="sub">Bạn chưa học chữ nào. Vào Học mới để học chữ đầu tiên, rồi quay lại đây luyện viết.</p><div class="row"><a class="btn primary" href="#hoc">Học mới</a></div></div>'; return; }
    var nc = all.filter(function (x) { return x.type === "c"; }).length;
    var T = [["Cần luyện", "viết sai gần đây, mới học hoặc hay quên — luôn được đưa vào lượt luyện"], ["Đang nhớ", "khoảng một nửa được đưa vào mỗi lượt"], ["Đã thuộc", "chỉ thỉnh thoảng đưa lại để giữ trí nhớ"]];
    var h = tabs + '<div class="card"><h2>Luyện chữ đã học</h2><p class="sub">Bạn đã học ' + nc + " chữ và " + (all.length - nc) + ' từ. <b>Luyện thông minh</b> đưa vào mọi mục cần luyện và một phần mục đã nhớ (tối đa 30 mục mỗi lượt, mục yếu hỏi trước). Viết sai thì mục đó quay lại sau 3 câu cho tới khi đúng 2 lần liên tiếp, và có lại trong "Viết theo lịch" ngày mai.</p><div class="row"><button class="btn primary" id="smart">Luyện thông minh</button><button class="btn" id="allp">Luyện tất cả (' + all.length + ')</button></div></div>';
    g.forEach(function (a, k) {
      if (!a.length) return;
      h += '<div class="card"><h2>' + T[k][0] + " · " + a.length + '</h2><p class="sub">' + T[k][1] + '. Bấm một chữ để luyện riêng chữ đó.</p><div class="minis">' + byWeak(a.slice()).map(function (x) { return '<button class="mini" style="font:inherit;color:inherit" data-pr="' + x.id + '"><span class="han">' + esc(x.key) + "</span>" + esc(firstAm(x.am)) + "</button>"; }).join("") + "</div></div>";
    });
    v.innerHTML = h;
    $("#smart", v).onclick = function () { start(smart()); };
    $("#allp", v).onclick = function () { start(byWeak(all.slice())); };
    Array.prototype.forEach.call(v.querySelectorAll("[data-pr]"), function (b) { b.onclick = function () { start([ITEM[b.getAttribute("data-pr")]]); }; });
  }
  function strokeLesson() {
    var N = [["Ngang (hoành)", "横", "viết từ trái sang phải", "一 二 三 十 大 干 天 夫 王"], ["Sổ (thụ)", "豎", "viết từ trên xuống dưới", "中 川 十"], ["Phẩy (phiết)", "撇", "từ trên phải xuống trái dưới", "人 八 入 大 才 千 午 又 水"], ["Mác (nại)", "捺", "từ trên-trái xuống phải-dưới", "人 八 入 又 木"], ["Chấm (điểm)", "點", "từ trên xuống dưới phải hoặc trái", "主 玉 六 之 不 文 太 犬"], ["Hất (thiêu)", "挑", "từ dưới-trái lên trên-phải", "扌 地 汗 計"], ["Móc (câu)", "勾", "sổ câu, hoành câu, tà câu, loan câu, bình câu", "小 字 戈 我 狗 家 心"], ["Gập (chiết)", "折", "ngang gập, ngang gập móc, sổ gập…", "口 囗 己 已 巳 門 月 母 風"]];
    var R = [["Ngang trước sổ sau", "十 干 豐 共 土 士"], ["Phẩy trước mác sau", "人 入 八 父 交 天"], ["Trái trước phải sau", "佛 法 僧 明 行 仁"], ["Trên trước dưới sau", "二 三 六 旦 青 立 言 念"], ["Ngang trước phẩy sau", "左 右 不 大 夫 友"], ["Giữa trước hai bên sau", "小 塵 水 木 尖 永"], ["Ngoài trước trong sau", "周 風 問 同 月 用 閒"], ["Vào trước đóng sau", "田 日 曰 目 因 四"], ["Nét ngang đáy", "全 工 王 土 士 壬"], ["Bộ quai xước", "道 邊 達 進 遠 返 近 建"], ["Các chữ ngoại lệ", "學 覺 刀 力 忄 火"]];
    return '<div class="cols2"><div class="card"><h2>8 nét cơ bản</h2><p class="sub">Theo giáo trình HK1. Chữ <span class="han">永</span> (vĩnh) chứa đủ tám nét nên người xưa thường lấy để luyện tập.</p><table class="t"><tbody>' + N.map(function (n) { return '<tr><td><b>' + n[0] + ' <span class="han">' + n[1] + '</span></b><br><small class="muted">' + n[2] + '</small></td><td class="han" style="font-size:1.4rem">' + n[3] + "</td></tr>"; }).join("") + '</tbody></table></div><div class="card"><h2>11 quy tắc bút thuận</h2><table class="t"><tbody>' + R.map(function (r, i) { return "<tr><td><b>" + (i + 1) + ". " + r[0] + '</b></td><td class="han" style="font-size:1.4rem">' + r[1] + "</td></tr>"; }).join("") + '</tbody></table><p class="sub" style="margin-top:8px">Giáo trình ghi: nét phẩy viết trước trong 九, 及; viết sau trong 力, 刀.</p></div></div>';
  }
  function sheet(v, tabs) {
    var learned = learnedOf("c").concat(learnedOf("w"));
    var P = PLN();
    v.innerHTML = tabs + '<div class="card"><h2>Phiếu tập viết</h2><p class="sub">Mỗi dòng có 3 ô chữ mờ để tô và 7 ô trống kẻ chữ 米. Tải phiếu về, mở rồi bấm Ctrl+P để in.</p><div class="row"><div class="field"><label for="ps">Chọn chữ</label><select id="ps"><option value="today">Chữ / từ học hôm nay</option><option value="hard">Chữ hay quên</option><option value="learned">Tất cả chữ đã học</option><option value="next">20 chữ sắp học</option>' + P.ps.map(function (p) { return '<option value="ky-' + p.k + '">Toàn bộ ' + p.T.Q.c.length + " chữ " + esc(p.T.short) + "</option>"; }).join("") + '<option value="common">Toàn bộ ' + COMMON_C + ' chữ thông dụng</option></select></div><button class="btn primary" id="pdl" style="align-self:end">Tải phiếu (.html)</button></div><div id="pprev" style="margin-top:12px"></div></div>';
    function items() {
      var s = $("#ps", v).value, t = today();
      if (s === "today") return learned.filter(function (x) { return S.it[x.id][5] === t; });
      if (s === "hard") return HC.hard().filter(function (x) { return x.type === "c" || x.type === "w"; });
      if (s === "learned") return learnedOf("c");
      if (s === "next") return QC.filter(function (c) { return !introduced(c.id); }).slice(0, 20);
      if (s.indexOf("ky-") === 0 && TERM[s.slice(3)]) return TERM[s.slice(3)].Q.c;
      return QC.slice(0, COMMON_C);
    }
    function preview() { var it = items(); $("#pprev", v).innerHTML = it.length ? '<p class="sub">' + it.length + ' mục: </p><div class="minis">' + it.slice(0, 60).map(miniHTML).join("") + (it.length > 60 ? " …" : "") + "</div>" : '<p class="sub">Chưa có mục nào trong lựa chọn này.</p>'; }
    $("#ps", v).onchange = preview; preview();
    $("#pdl", v).onclick = function () {
      var it = items(); if (!it.length) { toast("Chưa có chữ nào để in"); return; }
      var single = []; it.forEach(function (x) { chars(x.key).forEach(function (ch) { if (isHan(ch) && single.indexOf(ch) < 0) single.push(ch); }); });
      var rows = single.map(function (ch) { var c = CHAR[ch]; var cells = ""; for (var k = 0; k < 10; k++) cells += '<td><span style="opacity:' + (k === 0 ? 1 : k < 3 ? 0.18 : 0) + '">' + ch + "</span></td>"; return '<tr><th>' + esc(c ? firstAm(c.am) : "") + "<small>" + esc(c ? meaningShort(c) : "") + "</small></th>" + cells + "</tr>"; }).join("");
      var html = '<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Phiếu tập viết Hán cổ</title><style>body{font-family:"Segoe UI",sans-serif;margin:12mm}h1{font-size:16px;margin:0 0 8px}table{border-collapse:collapse}th{width:34mm;text-align:left;font-size:12px;padding:2px 6px;vertical-align:middle}th small{display:block;font-weight:400;color:#555;font-size:10px}td{width:15mm;height:15mm;border:1px solid #b9c2cc;text-align:center;vertical-align:middle;font-family:"MS Song","SimSun","PMingLiU",serif;font-size:11mm;background-image:linear-gradient(45deg,transparent 49.5%,#e3e7ec 49.5%,#e3e7ec 50.5%,transparent 50.5%),linear-gradient(-45deg,transparent 49.5%,#e3e7ec 49.5%,#e3e7ec 50.5%,transparent 50.5%),linear-gradient(transparent 49.5%,#e3e7ec 49.5%,#e3e7ec 50.5%,transparent 50.5%),linear-gradient(90deg,transparent 49.5%,#e3e7ec 49.5%,#e3e7ec 50.5%,transparent 50.5%)}tr{break-inside:avoid}</style></head><body><h1>Phiếu tập viết · ' + dateOf(today()) + " · " + single.length + " chữ</h1><table>" + rows + "</table></body></html>";
      HC.download("phieu-tap-viet-" + dateOf(today()).replace("/", "-") + ".html", html);
    };
  }
  HC.download = function (name, text) {
    var go = function (dl) {
      if (dl) { dl.save({ filename: name, data: text }).then(function () { toast("Đã tải " + name); }).catch(function () { toast("Không tải được tệp"); }); return; }
      try { var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "text/html" })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); toast("Đã tải " + name); } catch (e) { toast("Không tải được tệp"); }
    };
    if (window.claude && typeof window.claude.use === "function") window.claude.use("downloads").then(go, function () { go(null); }); else go(null);
  };

  // ---------- RADICALS ----------
  function vRad(v) {
    var sort = "use";
    function draw() {
      var list = D.rads.slice(); if (sort === "use") list = QR.slice();
      v.innerHTML = '<div class="row" style="margin-bottom:10px"><h1 style="margin:0">214 bộ thủ</h1><span class="spacer"></span><div class="field" style="min-width:200px"><select id="rs" aria-label="Sắp xếp"><option value="use">Hay gặp nhất trong chữ cần học</option><option value="no"' + (sort === "no" ? " selected" : "") + '>Theo số thứ tự bộ</option></select></div></div><p class="sub">Viền xanh: bộ đã học. Bấm vào một bộ để xem nghĩa, vần nhớ và các chữ thuộc bộ đó. Bộ thủ mới được đưa vào mục Học mới mỗi ngày (40 bộ hay gặp nhất học trong tuần 1).</p><div class="radgrid">' + list.map(function (r) { return '<button class="rad' + (introduced(r.id) ? " known" : "") + '" data-open="' + r.id + '"><span class="han">' + esc(r.r) + "</span><small>" + esc(r.am) + " · " + (r.net || "") + "n</small></button>"; }).join("") + '</div><p style="margin-top:12px"><a class="btn" href="#choi-hunt">Chơi Truy tìm bộ thủ</a></p>';
      $("#rs", v).onchange = function () { sort = this.value; draw(); };
    }
    draw();
  }

  // ---------- LOẠI TỪ ----------
  // tab theo kỳ (ltk trong app-data.json = bảng loại từ đề cương kỳ đó) + Tổng hợp; mỗi tab có Ôn tập (5 bài: HC.ltDrill ở games.js)
  // #loaitu → tab kỳ đang ôn thi; #loaitu-<hk1|hk2|gk3|all>; #loaitu-<tab>-<bài>
  var LT_HL = function (s, x) { var at = s.indexOf(x); return esc(s.slice(0, at)) + '<span style="color:var(--seal);border-bottom:2px solid var(--seal)">' + esc(x) + "</span>" + esc(s.slice(at + x.length)); };
  var LT_EX = {
    hk1: '<p><span class="han" style="font-size:1.4rem">' + LT_HL("在家中孝父母。", "中") + '</span> — đề K10: chữ <span class="han">中</span> thuộc loại từ nào? A. Số từ · <b>B. Phương vị từ</b> · C. Phó từ. Có thể nhìn thêm vị trí: <span class="han">中</span> đứng sau <span class="han">家</span>, theo mẫu “danh từ + nơi chốn”.</p>',
    hk2: '<p class="sub">Phạm vi kỳ 2: chỉ chọn Liên từ, Lượng từ, Phó từ, Số từ và Phương vị từ; không chọn Giới từ, Trợ từ hoặc Tính từ.</p>',
    gk3: '<p><span class="han" style="font-size:1.4rem">' + LT_HL("佛者，佛陀之省稱。", "之") + '</span> — đề K10 giữa kỳ 3: chữ <span class="han">之</span> là: a/ Liên từ · b/ Trợ từ · c/ Phó từ · <b>d/ Trợ từ kết cấu</b>.</p><p class="sub">Phạm vi giữa kỳ 3: 7 loại trong đề cương (Trợ từ kết cấu, Trợ động từ, Lượng từ, Phương vị từ, Liên từ, Phó từ, Số từ). Mẹo nhớ (suy từ đề K10, đề cương không ghi): đáp án Giới từ, Trợ từ, Tính từ không thuộc 7 loại này.</p>'
  };
  var LT_SUB = {
    hk1: "Đề cương HK1 hỏi 3 loại: Số từ, Phương vị từ, Phó từ.",
    hk2: "Đề cương cuối kỳ 2 hỏi 5 loại: Lượng từ, Số từ, Liên từ, Phó từ, Phương vị từ.",
    gk3: "Đề cương giữa kỳ 3 có 38 từ ngữ pháp chia 7 loại (thêm Trợ từ kết cấu, Trợ động từ).",
    all: "Mọi loại từ của các kỳ gộp lại. Số nhỏ sau âm = kỳ có từ đó: 1 = Kỳ 1 · 2 = Kỳ 2 · 3 = Giữa kỳ 3."
  };
  function vLT(v, args) {
    var keys = HC.ltTabKeys ? HC.ltTabKeys() : [];
    var foc = HC.focusLt() || ""; if (keys.indexOf(foc) < 0) foc = keys[0];
    var k = keys.indexOf(args[0]) >= 0 ? args[0] : foc;
    if (args[0] && args[1]) return HC.ltDrill(v, k, args[1]);
    var T = HC.ltTab(k), G = T.g, KN = { hk1: "1", hk2: "2", gk3: "3" }, NK = {};
    (D.ltk || []).forEach(function (K) { NK[K.name] = KN[K.k] || K.name; });
    var h = '<h1>Loại từ</h1><div class="row lttabs" role="tablist" aria-label="Chọn kỳ">' + keys.map(function (x) { var t = HC.ltTab(x); return '<a class="btn' + (x === k ? " primary" : "") + '" role="tab" aria-selected="' + (x === k) + '" href="#loaitu-' + x + '">' + esc(t.name) + (x === foc ? ' <small class="ltfoc">đang ôn thi</small>' : "") + "</a>"; }).join("") + "</div>";
    h += '<p class="sub">' + esc(LT_SUB[k] || "") + " Cách làm bài theo đề cương: ① gạch chữ đề bài hỏi; ② nhớ mặt chữ thuộc loại nào; ③ khoanh đáp án. Không cần dịch hết câu.</p>";
    h += '<div class="card ltdrillbox"><h2>Ôn tập loại từ ' + esc(T.name) + ' <span class="muted num" style="font-weight:500;font-size:0.9rem">(' + Object.keys(G).length + " loại · " + Object.keys(G).reduce(function (n, g) { return n + G[g].length; }, 0) + ' mục)</span></h2><div class="ltdrills">' + HC.LT_DRILLS.map(function (d) { var b = S.best["lt-" + k + "-" + d.id]; return '<a class="ltdrill" href="#loaitu-' + k + "-" + d.id + '"><span class="gi han">' + d.icon + "</span><span class=\"t\"><b>" + esc(d.name) + "</b><small>" + esc(d.desc) + '</small><small class="best">' + (b != null ? "Kỷ lục: " + esc(b) : "Chưa làm") + "</small></span></a>"; }).join("") + "</div></div>";
    h += '<div class="cols2" style="margin-top:14px">';
    Object.keys(G).forEach(function (g) {
      h += '<div class="card ltgroup"><h2>' + esc(g) + ' <span class="muted num" style="font-weight:500;font-size:0.9rem">(' + G[g].length + ")</span></h2><div class=\"chars\">" + G[g].map(function (x) {
        var it = chars(x).length > 1 ? WORD[x] : CHAR[x], am = HC.ltAm(T, x, it), ky = T.ky && T.ky[x] ? '<small class="ltky">' + T.ky[x].map(function (n) { return NK[n] || n; }).join("·") + "</small>" : "";
        return '<span class="mini"' + (it ? ' data-open="' + it.id + '"' : "") + '><span class="han">' + esc(x) + "</span>" + esc(am) + ky + "</span>";
      }).join("") + "</div></div>";
    });
    h += "</div>";
    var ex = k === "all" ? LT_EX.hk1 + LT_EX.hk2 + LT_EX.gk3 : LT_EX[k];
    if (ex) h += '<div class="card" style="margin-top:14px"><h2>Ví dụ trong đề</h2>' + ex + "</div>";
    v.innerHTML = h;
  }

  // ---------- CÂU ----------
  function vSent(v, args) {
    if (args[0]) return sentPractice(v, ITEM[args[0]]);
    var sets = {}; QS.forEach(function (s) { (sets[s.set] = sets[s.set] || []).push(s); });
    var h = '<h1>Câu trong đề cương</h1><p class="sub">' + D.sents.length + " câu. Mỗi câu luyện 4 bước: đọc có phiên âm từng chữ → tự đọc phiên âm → tự dịch → viết lại chữ Hán. Câu của kỳ bạn đang học được đưa dần vào Học mới từ nửa chặng lộ trình (câu đã ra đề thi trước); câu của kỳ khác học sau. Bạn có thể luyện trước bất cứ câu nào." + '</p><div class="grid">';
    Object.keys(sets).forEach(function (k) {
      h += '<div class="card"><h2>' + esc(k) + "</h2>" + sets[k].map(function (s) { var r = S.it[s.id]; return '<div class="lirow"><a class="li" href="#cau-' + s.id + '" style="text-decoration:none;color:inherit"><span class="chip num" style="justify-self:center">' + s.no + '</span><span class="t"><b class="han" style="font-size:1.15rem">' + esc(s.han) + "</b><span>" + esc(s.pa) + '</span></span><span>' + (s.k10 ? '<span class="chip k10">Đề K10</span> ' : "") + (r ? '<span class="chip ok">đã học</span>' : "") + "</span></a>" + moreBtn(s.id) + "</div>"; }).join("") + "</div>";
    });
    v.innerHTML = h + "</div>";
  }
  function sentPractice(v, s, opt) {
    opt = opt || {};
    var step = 0, pad;
    var steps = ["Đọc có phiên âm", "Tự đọc phiên âm", "Tự dịch nghĩa", "Viết chữ Hán"];
    function render(show) {
      var h = '<div class="row" style="margin-bottom:10px">' + (opt.done ? '<span class="chip num">Câu mới ' + opt.n + "/" + opt.of + '</span><a class="btn sm ghost" href="#home">Dừng</a>' : '<a class="btn sm ghost" href="#cau">← Danh sách câu</a>') + '<span class="muted" style="font-size:0.85rem">' + esc(s.set) + " · câu " + s.no + '</span><span class="spacer"></span>' + moreBtn(s.id) + '</div><div class="row" style="margin-bottom:12px">' + steps.map(function (t, i) { return '<button class="btn sm' + (i === step ? " primary" : "") + '" data-step="' + i + '">' + (i + 1) + ". " + t + "</button>"; }).join("") + '</div><div class="card"><div class="stage">';
      if (step === 0) h += '<div class="sent">' + rubyHTML(s, false, true) + '</div><div style="font-weight:600">' + esc(s.pa) + "</div><div>" + esc(s.dn) + '</div><p class="sub">Bấm vào từng chữ để xem âm, nghĩa và cách viết riêng của chữ đó.</p>';
      if (step === 1) h += '<div class="sent">' + rubyHTML(s, !show) + '</div><div class="' + (show ? "" : "hide") + '" style="font-weight:600">' + esc(s.pa) + "</div>";
      if (step === 2) h += '<div class="sent">' + esc(s.han) + '</div><div style="font-weight:600">' + esc(s.pa) + '</div><div class="' + (show ? "" : "hide") + '">' + esc(s.dn) + "</div>";
      if (step === 3) h += '<div style="font-weight:700;font-size:1.1rem;text-align:center">' + esc(s.pa) + '</div><div class="muted" style="text-align:center">' + esc(s.dn) + '</div><div class="padwrap" id="padbox"></div><div class="gfb hide" id="fb" role="status"></div><div class="sent ' + (show ? "" : "hide") + '">' + esc(s.han) + "</div>";
      h += '<div class="row acts">' + (step === 0 ? "" : '<button class="btn primary" id="rev">' + (show ? "Ẩn đáp án" : "Xem đáp án") + "</button>") + (step === 3 ? '<button class="btn" id="clr">Xóa hết</button><button class="btn" id="mdl">Hiện chữ mờ</button><button class="btn" id="chk">Chấm chữ viết</button>' : "") + (step < 3 ? '<button class="btn" id="nx">Bước tiếp →</button>' : '<button class="btn good" id="fin">Xong câu này</button>') + "</div></div></div>";
      v.innerHTML = h;
      $$("[data-step]", v).forEach(function (b) { b.onclick = function () { step = +b.getAttribute("data-step"); render(false); }; });
      var r = $("#rev", v); if (r) r.onclick = function () { render(!show); };
      var nx = $("#nx", v); if (nx) nx.onclick = function () { step++; render(false); };
      if (step === 3) {
        var fb = $("#fb", v);
        pad = makePad($("#padbox", v), s.han, { cols: 6, cell: 74, onEdit: function () { fb.classList.add("hide"); } }); $("#clr", v).onclick = function () { pad.clear(); fb.classList.add("hide"); }; $("#mdl", v).onclick = function () { pad.model(); };
        $("#chk", v).onclick = function () {
          if (pad.empty()) { toast("Hãy viết chữ vào các ô trước"); return; }
          pad.grade().then(function (res) {
            var g = res.filter(function (r) { return !r.nodata; }), okN = g.filter(function (r) { return r.ok; }).length;
            fb.innerHTML = '<div class="verdict ' + (okN === g.length ? "ok" : "no") + '">Đúng ' + okN + " / " + g.length + " chữ</div>" + res.filter(function (r) { return !r.ok; }).map(function (r) { return '<div class="' + (r.nodata ? "" : "no") + '"><span class="han">' + esc(r.ch) + "</span> " + esc(r.msg) + "</div>"; }).join("") + '<div class="row" style="justify-content:center;margin-top:8px"><button class="btn sm ghost" id="rep">Báo chấm nhầm câu này</button></div>';
            fb.classList.remove("hide");
            var gr = pad.graded();
            $("#rep", fb).onclick = function () { if (saveSample(s.han, gr, pad.size, "cau")) { this.parentNode.innerHTML = '<span class="muted">Đã lưu câu này để chỉnh cách chấm (Tập viết → Mẫu chấm nhầm). Cảm ơn bạn!</span>'; } };
          }, function () { toast("Không tải được dữ liệu chấm (có thể đang mất mạng)"); });
        };
      }
      var fin = $("#fin", v); if (fin) fin.onclick = function () { if (!introduced(s.id)) introduce(s.id, true); else grade(s.id, "r", 2); HC.addXP(5, fin); HC.after(); toast("Đã lưu: câu " + s.no); if (opt.done) opt.done(); else HC.go("cau"); };
    }
    render(false);
  }

  // ---------- KHO KHÓ (người học tự thêm qua nút ⋯) + playlist ----------
  // #kho = danh sách kho (lọc chữ/từ/câu) · #kho-pl = các playlist · #kho-pl-<plId> = một playlist
  function khoRowHTML(it, extra) {
    // câu: giống danh sách Câu (số câu ở cột đầu, chữ Hán + phiên âm ở giữa)
    var g = it.type === "s" ? '<span class="chip num" style="justify-self:center">' + esc(String(it.no)) + "</span>" : '<span class="g ' + lenCls(it.key) + '">' + esc(it.key) + "</span>";
    var t = it.type === "s" ? '<b class="han" style="font-size:1.15rem">' + esc(it.han) + "</b><span>" + esc(it.pa) + "</span>" : "<b>" + esc(it.am) + "</b><span>" + esc(meaningShort(it)) + "</span>";
    return '<div class="lirow kr"><button type="button" class="li" data-open="' + it.id + '">' + g + '<span class="t">' + t + '</span><span class="chip">' + esc(kindLabel(it)) + "</span></button>" + (extra || "") + moreBtn(it.id) + "</div>";
  }
  function vKho(v, args) {
    var tab = args[0] === "pl" ? "pl" : args[0] === "luyen" ? "luyen" : args[0] === "dahoc" ? "dahoc" : "kho", plId = tab === "pl" ? args[1] || "" : "", f = "all", renaming = false, adding = false;
    var SHOW = 5, MORE = 100, kN = SHOW, dt = "c", dq = "", dN = SHOW; // mỗi danh sách hiện 5 dòng; "Xem thêm" mở thêm tối đa 100 dòng; không lưu vào S
    function moreRow(total, n, key) {
      if (total <= SHOW) return "";
      return '<div class="row kmore">' + (total > n ? '<button type="button" class="btn sm" data-km="' + key + ':more">Xem thêm <span class="num">(còn ' + (total - n) + ")</span></button>" : "") + (n > SHOW ? '<button type="button" class="btn sm ghost" data-km="' + key + ':less">Thu gọn</button>' : "") + "</div>";
    }
    if (plId && !plLive(plId)) plId = ""; // playlist đã xóa (vd ở máy khác) → về danh sách playlist
    function head() {
      var nh = HC.hardList().length, np = HC.plList().length;
      return '<div class="row" style="margin-bottom:6px"><h1 style="margin:0">Kho khó</h1><span class="spacer"></span><a class="btn sm' + (tab === "kho" ? " primary" : "") + '" href="#kho">Kho khó <span class="num">(' + nh + ')</span></a><a class="btn sm' + (tab === "dahoc" ? " primary" : "") + '" href="#kho-dahoc">Từ đã học</a><a class="btn sm' + (tab === "pl" ? " primary" : "") + '" href="#kho-pl">Playlist <span class="num">(' + np + ')</span></a><a class="btn sm' + (tab === "luyen" ? " primary" : "") + '" href="#kho-luyen">Luyện</a></div>';
    }
    function drawKho() {
      var all = HC.hardList(), cnt = { all: all.length, c: 0, w: 0, s: 0, r: 0 };
      all.forEach(function (it) { if (cnt[it.type] != null) cnt[it.type]++; });
      var list = f === "all" ? all : all.filter(function (it) { return it.type === f; });
      var h = head() + '<p class="sub">Chữ, từ, câu, bộ thủ bạn tự đánh dấu là khó bằng nút ⋯ (ở Tra cứu, Câu, thẻ học, thẻ ôn, khung chi tiết). Kho khó KHÔNG đổi lịch ôn của thẻ.</p>';
      h += '<div class="row kf" role="group" aria-label="Lọc">' + [["all", "Tất cả"], ["c", "Chữ"], ["w", "Từ"], ["s", "Câu"], ["r", "Bộ thủ"]].map(function (x) {
        return '<button type="button" class="btn sm' + (f === x[0] ? " primary" : "") + '" data-kf="' + x[0] + '" aria-pressed="' + (f === x[0]) + '">' + x[1] + ' <span class="num">' + cnt[x[0]] + "</span></button>";
      }).join("") + "</div>";
      h += '<div class="card"><div class="list">' + (list.length ? list.slice(0, kN).map(function (it) { return khoRowHTML(it, '<button type="button" class="more kx" data-kx="' + it.id + '" aria-label="Bỏ khỏi kho khó" title="Bỏ khỏi kho khó">✕</button>'); }).join("") + moreRow(list.length, kN, "k")
        : '<p class="sub" style="padding:8px">' + (all.length ? "Không có mục loại này trong kho." : "Kho đang trống. Bấm nút ⋯ cạnh một chữ, từ hay câu rồi chọn “☆ Thêm vào kho khó”.") + "</p>") + "</div></div>";
      var forget = HC.hard().filter(function (it) { return !isHard(it.id); });
      if (forget.length) h += '<div class="card"><h2>Chữ hay quên</h2><p class="sub">App tự gom ' + forget.length + " chữ / từ / câu / bộ thủ bạn quên từ 2 lần trở lên mà chưa có trong kho khó.</p><div class=\"minis\">" + forget.slice(0, 24).map(miniHTML).join("") + (forget.length > 24 ? '<span class="muted">… +' + (forget.length - 24) + "</span>" : "") + '</div><p style="margin-top:8px"><button type="button" class="btn sm" id="kaddf">Thêm cả ' + forget.length + " mục vào kho khó</button></p></div>";
      v.innerHTML = h;
      var b = $("#kaddf", v); if (b) b.onclick = function () { var t = Date.now(); forget.forEach(function (it) { S.hard[it.id] = t; }); save(); toast("Đã thêm " + forget.length + " mục vào kho khó"); drawKho(); };
    }
    // thẻ "Từ đã học": mọi chữ / từ / câu / bộ thủ đã học (có thẻ trong S.it), chia 4 tab con, nút ☆ thêm vào kho khó
    function learned() {
      return Object.keys(S.it).filter(function (id) { return ITEM[id]; })
        .sort(function (a, b) { return (S.it[b][5] || 0) - (S.it[a][5] || 0) || (ITEM[a].rank || 0) - (ITEM[b].rank || 0); }).map(function (id) { return ITEM[id]; });
    }
    function drawDa() {
      var all = learned(), cnt = { c: 0, w: 0, s: 0, r: 0 };
      all.forEach(function (it) { if (cnt[it.type] != null) cnt[it.type]++; });
      var h = head() + '<p class="sub">Mọi chữ, từ, câu, bộ thủ bạn đã học (mới học xếp trước). Bấm ☆ để thêm vào kho khó, bấm ★ để bỏ ra.</p>';
      h += '<div class="row kf" role="group" aria-label="Loại mục">' + [["c", "Chữ"], ["w", "Từ"], ["s", "Câu"], ["r", "Bộ thủ"]].map(function (x) {
        return '<button type="button" class="btn sm' + (dt === x[0] ? " primary" : "") + '" data-dt="' + x[0] + '" aria-pressed="' + (dt === x[0]) + '">' + x[1] + ' <span class="num">' + cnt[x[0]] + "</span></button>";
      }).join("") + "</div>";
      h += '<div class="card"><div class="field"><input type="search" id="dq" value="' + esc(dq) + '" placeholder="Tìm theo chữ Hán, âm (không dấu cũng được) hoặc nghĩa" aria-label="Tìm trong mục đã học"></div><div class="list" id="dl"></div></div>';
      v.innerHTML = h;
      drawDaList(all);
      var t = null, inp = $("#dq", v);
      inp.oninput = function () { clearTimeout(t); t = setTimeout(function () { dq = inp.value; dN = SHOW; drawDaList(); }, 150); };
    }
    function drawDaList(all) {
      var box = $("#dl", v); if (!box) return;
      all = all || learned();
      var q = dq.trim(), qf = fold(q);
      var list = all.filter(function (it) { return it.type === dt && (!q || it.key.indexOf(q) >= 0 || fold(it.am).indexOf(qf) >= 0 || fold(it.ns).indexOf(qf) >= 0 || fold(it.nb).indexOf(qf) >= 0); });
      box.innerHTML = list.length ? list.slice(0, dN).map(function (it) {
        var on = isHard(it.id);
        return khoRowHTML(it, '<button type="button" class="more kstar' + (on ? " on" : "") + '" data-ks="' + it.id + '" aria-pressed="' + on + '" aria-label="' + (on ? "Bỏ khỏi kho khó" : "Thêm vào kho khó") + '" title="' + (on ? "Bỏ khỏi kho khó" : "Thêm vào kho khó") + '">' + (on ? "★" : "☆") + "</button>");
      }).join("") + moreRow(list.length, dN, "d")
        : '<p class="sub" style="padding:8px">' + (q ? "Không tìm thấy mục nào." : "Chưa học mục nào loại này.") + "</p>";
    }
    function drawPls() {
      var L = HC.plList();
      var h = head() + '<p class="sub">Playlist là nhóm mục trong kho khó do bạn tự đặt (vd theo bài, theo tuần). Một mục có thể ở nhiều playlist; bỏ mục khỏi kho khó thì nó cũng rời mọi playlist.</p>';
      h += '<div class="card"><div class="row plnew"><input type="text" id="pln" maxlength="' + PL_MAX + '" placeholder="Tên playlist mới, vd Bài 3" aria-label="Tên playlist mới"><button type="button" class="btn primary" id="plc">Tạo playlist</button></div></div>';
      h += '<div class="card"><div class="list">' + (L.length ? L.map(function (p) {
        return '<a class="li pli" href="#kho-pl-' + p.id + '"><span class="g">≡</span><span class="t"><b>' + esc(p.n) + "</b><span>" + (p.ids.length ? p.ids.slice(0, 8).map(function (id) { return esc(itemTitle(ITEM[id])); }).join(" · ") : "chưa có mục") + '</span></span><span class="chip num">' + p.ids.length + " mục</span></a>";
      }).join("") : '<p class="sub" style="padding:8px">Chưa có playlist nào.</p>') + "</div></div>";
      v.innerHTML = h;
      var inp = $("#pln", v);
      function create() { var k = HC.plCreate(inp.value); if (!k) { toast("Hãy gõ tên playlist"); inp.focus(); return; } toast("Đã tạo playlist"); HC.go("kho-pl-" + k); }
      $("#plc", v).onclick = create;
      inp.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); create(); } });
    }
    function drawPl() {
      var p = plLive(plId); if (!p) { plId = ""; drawPls(); return; }
      var ids = plIds(plId), rest = HC.hardList().filter(function (it) { return !plHas(plId, it.id); });
      var h = head() + '<div class="card"><div class="row"><a class="btn sm ghost" href="#kho-pl">← Các playlist</a><span class="spacer"></span>' + (renaming ? "" : '<button type="button" class="btn sm" id="plr">Đổi tên</button><button type="button" class="btn sm ghost" id="pld">Xóa playlist</button>') + "</div>";
      h += renaming ? '<div class="row plnew" style="margin-top:8px"><input type="text" id="plrn" maxlength="' + PL_MAX + '" value="' + esc(p.n) + '" aria-label="Tên playlist"><button type="button" class="btn sm" id="plrc">Hủy</button><button type="button" class="btn sm primary" id="plrs">Lưu tên</button></div>'
        : '<h2 style="margin:8px 0 0">' + esc(p.n) + ' <span class="chip num">' + ids.length + " mục</span></h2>";
      h += "</div>";
      h += '<div class="card"><div class="list">' + (ids.length ? ids.map(function (id) { return khoRowHTML(ITEM[id], '<button type="button" class="more kx" data-kr="' + id + '" aria-label="Bớt khỏi playlist" title="Bớt khỏi playlist (vẫn ở kho khó)">−</button>'); }).join("")
        : '<p class="sub" style="padding:8px">Playlist trống. Thêm mục từ kho khó bên dưới, hoặc bấm ⋯ ở một chữ / từ / câu rồi chọn “Thêm vào playlist…”.</p>') + "</div></div>";
      h += '<div class="card"><div class="row"><h2 style="margin:0">Thêm mục từ kho khó</h2><span class="spacer"></span>' + (rest.length ? '<button type="button" class="btn sm" id="pla">' + (adding ? "Thu gọn" : "Chọn mục (" + rest.length + ")") + "</button>" : "") + "</div>";
      if (!rest.length) h += '<p class="sub">' + (HC.hardList().length ? "Mọi mục trong kho khó đã ở playlist này." : "Kho khó đang trống.") + "</p>";
      else if (adding) h += '<div class="plpick">' + rest.map(function (it) { return '<label class="plck"><input type="checkbox" data-pa="' + it.id + '"><span><b class="han">' + esc(itemTitle(it)) + "</b> " + esc(it.type === "s" ? it.pa : it.am) + '</span><span class="chip">' + esc(kindLabel(it)) + "</span></label>"; }).join("") + '</div><div class="row"><button type="button" class="btn sm ghost" id="plall">Chọn hết</button><span class="spacer"></span><button type="button" class="btn primary" id="plok">Thêm mục đã chọn</button></div>';
      h += "</div>";
      v.innerHTML = h;
      var q = function (s) { return $(s, v); };
      if (q("#plr")) q("#plr").onclick = function () { renaming = true; drawPl(); var i = q("#plrn"); try { i.focus(); i.select(); } catch (e) { } };
      if (q("#pld")) q("#pld").onclick = function () { if (!confirm("Xóa playlist “" + p.n + "”? Các mục vẫn còn trong kho khó.")) return; HC.plDelete(plId); toast("Đã xóa playlist"); HC.go("kho-pl"); };
      if (renaming) {
        var ri = q("#plrn");
        var saveName = function () { if (!HC.plRename(plId, ri.value)) { toast("Hãy gõ tên playlist"); ri.focus(); return; } renaming = false; toast("Đã đổi tên"); drawPl(); };
        q("#plrs").onclick = saveName; q("#plrc").onclick = function () { renaming = false; drawPl(); };
        ri.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); saveName(); } else if (e.key === "Escape") { e.stopPropagation(); renaming = false; drawPl(); } });
      }
      if (q("#pla")) q("#pla").onclick = function () { adding = !adding; drawPl(); };
      if (q("#plall")) q("#plall").onclick = function () { var cs = $$("[data-pa]", v), all = cs.every(function (c) { return c.checked; }); cs.forEach(function (c) { c.checked = !all; }); };
      if (q("#plok")) q("#plok").onclick = function () {
        var sel = $$("[data-pa]", v).filter(function (c) { return c.checked; }).map(function (c) { return c.getAttribute("data-pa"); });
        if (!sel.length) { toast("Chưa chọn mục nào"); return; }
        HC.plSet(plId, sel, true); adding = false; toast("Đã thêm " + sel.length + " mục"); drawPl();
      };
    }
    // thẻ Luyện: chọn nguồn (cả kho / playlist) + loại mục + số câu → 2 trò của kho khó (vẽ trong games.js: HC.khoSetup)
    function drawLuyen() {
      v.innerHTML = head() + '<div id="ksu"></div>';
      if (HC.khoSetup) HC.khoSetup($("#ksu", v)); else $("#ksu", v).innerHTML = '<p class="sub">Chưa tải xong trò chơi, hãy tải lại trang.</p>';
    }
    function draw() { if (tab === "kho") drawKho(); else if (tab === "dahoc") drawDa(); else if (tab === "luyen") drawLuyen(); else if (plId) drawPl(); else drawPls(); }
    function onClick(e) {
      var k = e.target.closest("[data-kf]"); if (k) { f = k.getAttribute("data-kf"); kN = SHOW; drawKho(); return; }
      var m = e.target.closest("[data-km]");
      if (m) {
        var mk = m.getAttribute("data-km").split(":"), up = mk[1] === "more";
        if (mk[0] === "k") { kN = up ? kN + MORE : SHOW; drawKho(); } else { dN = up ? dN + MORE : SHOW; drawDaList(); }
        if (!up) { var c = $(".kf", v); if (c) c.scrollIntoView({ block: "nearest" }); }
        return;
      }
      var dk = e.target.closest("[data-dt]"); if (dk) { dt = dk.getAttribute("data-dt"); dN = SHOW; drawDa(); return; }
      var st = e.target.closest("[data-ks]");
      if (st) { var sid = st.getAttribute("data-ks"), son = !isHard(sid); if (!son && HC.plList().some(function (p) { return p.ids.indexOf(sid) >= 0; }) && !confirm("Bỏ “" + itemTitle(ITEM[sid]) + "” khỏi kho khó? Mục này cũng rời mọi playlist.")) return; HC.toggleHard(sid, son); refreshHard(sid); toast(son ? "Đã thêm vào kho khó" : "Đã bỏ khỏi kho khó"); return; }
      var x = e.target.closest("[data-kx]");
      if (x) { var id = x.getAttribute("data-kx"), it = ITEM[id]; if (!confirm("Bỏ “" + itemTitle(it) + "” khỏi kho khó? Mục này cũng rời mọi playlist.")) return; HC.toggleHard(id, false); refreshHard(id); toast("Đã bỏ khỏi kho khó"); return; }
      var r = e.target.closest("[data-kr]");
      if (r) { HC.plToggle(plId, r.getAttribute("data-kr"), false); toast("Đã bớt khỏi playlist"); drawPl(); }
    }
    v.addEventListener("click", onClick); // #view dùng chung mọi màn → gỡ khi rời màn
    // ⋯ đổi kho / playlist khi đang ở màn này → vẽ lại (giữ chỗ cuộn); không vẽ lại khi đang gõ tên
    khoRender = function () { if (renaming) return; var y = window.scrollY; draw(); window.scrollTo(0, y); };
    draw();
    return function () { khoRender = null; v.removeEventListener("click", onClick); };
  }

  // ---------- LOOKUP ----------
  function vLookup(v) {
    v.innerHTML = '<h1>Tra cứu</h1><p class="sub">Tìm theo chữ Hán, âm (gõ không dấu cũng được) hoặc nghĩa. Danh sách xếp theo số lần xuất hiện trong ' + (D.srcs || []).length + ' tài liệu (giáo trình, đề cương, đề thi).</p><div class="row" style="margin:10px 0"><input type="search" id="q" placeholder="Ví dụ: 道, dao, con đường…" aria-label="Tìm"><select id="qt" aria-label="Loại"><option value="c">Chữ lẻ (1.222)</option><option value="w">Từ (733)</option><option value="all">Cả hai</option></select></div><div class="card"><div class="list" id="res"></div></div>';
    function run() {
      var q = $("#q", v).value.trim(), qf = fold(q), t = $("#qt", v).value;
      var src = t === "c" ? D.chars : t === "w" ? D.words : D.chars.concat(D.words);
      var res = src.filter(function (x) { if (!q) return true; return x.key.indexOf(q) >= 0 || fold(x.am).indexOf(qf) >= 0 || fold(x.ns).indexOf(qf) >= 0 || fold(x.nb).indexOf(qf) >= 0 || (x.v || "").indexOf(q) >= 0 || (x.gt || "").indexOf(q) >= 0 || (x.dt || "").indexOf(q) >= 0; }); // gõ dạng rút gọn (汉) cũng ra chữ phồn thể (漢)
      if (t === "all") res.sort(function (a, b) { return b.n - a.n; });
      $("#res", v).innerHTML = res.slice(0, 150).map(function (x) { return '<div class="lirow"><button class="li" data-open="' + x.id + '"><span class="g ' + lenCls(x.key) + '">' + esc(x.key) + '</span><span class="t"><b>' + esc(x.am) + (x.gt ? ' <small class="muted">· rút gọn <span class="han">' + esc(x.gt) + "</span></small>" : "") + "</b><span>" + esc(meaningShort(x)) + '</span></span><span class="chip num">' + x.n + " lần</span></button>" + moreBtn(x.id) + "</div>"; }).join("") + (res.length > 150 ? '<p class="sub" style="padding:8px">… còn ' + (res.length - 150) + " kết quả, hãy gõ cụ thể hơn.</p>" : res.length ? "" : '<p class="sub">Không tìm thấy.</p>');
    }
    var t = null; $("#q", v).oninput = function () { clearTimeout(t); t = setTimeout(run, 120); }; $("#qt", v).onchange = run; run();
  }

  // ---------- SETTINGS ----------
  function vSettings(v, args) {
    var sync = remote.status === "synced" ? "Tiến độ đang được lưu vào tài khoản Claude của bạn, nên mở app trên máy tính hay điện thoại (cùng tài khoản) đều thấy cùng tiến độ." : remote.status === "error" ? "Chưa lưu được lên tài khoản lúc này; tiến độ vẫn được giữ trên trình duyệt này và sẽ thử lưu lại." : "Tiến độ đang lưu trên trình duyệt này. Hãy sao lưu thường xuyên bằng mã bên dưới.";
    var last = Object.keys(S.log).map(Number).sort(function (a, b) { return b - a; }).slice(0, 14);
    v.innerHTML = '<h1>Tiến độ &amp; cài đặt</h1><div class="card" id="ky" style="margin-bottom:14px"></div><div class="card hero" id="lich" style="margin-bottom:14px"></div><div class="cols2"><div class="card"><h2>Lưu tiến độ</h2><p class="sub">' + sync + '</p>' + (fb.on ? '<div class="row" style="margin:8px 0">' + (fb.user ? '<button class="btn" id="fbnow">Đồng bộ ngay</button><button class="btn" id="fbbk">Xem bản sao lưu</button><button class="btn ghost" id="fbout">Đăng xuất</button><button class="btn ghost" id="fbwipe">Đăng xuất và xóa tiến độ khỏi máy này</button>' : '<button class="btn primary" id="fbin3">Đăng nhập bằng Google</button>') + '</div>' + (fb.user ? '<p class="sub">Dùng chung máy với người khác: "Đăng xuất" cất tiến độ của bạn riêng trên máy này (lần sau đăng nhập có ngay); người khác đăng nhập sẽ dùng tiến độ của họ, không gộp với của bạn.</p>' : "") + '<div id="bklist"></div>' : "") + '<h3>Sao lưu thủ công bằng mã</h3><p class="sub">Bấm Sao chép để lấy mã tiến độ. Ở máy khác, dán mã vào ô rồi bấm Khôi phục.</p><textarea id="bk" aria-label="Mã sao lưu"></textarea><div class="row" style="margin-top:8px"><button class="btn" id="cp">Sao chép mã</button><button class="btn" id="im">Khôi phục từ mã đã dán</button></div></div>' +
      '<div class="card"><h2>Kế hoạch</h2><p class="sub">Lộ trình từng kỳ chọn ở khung "Chọn kỳ học" phía trên. Hai ô dưới đây = số chữ, từ mới mỗi ngày khi bạn không học kỳ nào (hoặc các kỳ đã thi xong).</p><div class="row"><div class="field"><label for="nc">Chữ mới / ngày khi không học kỳ nào</label><input id="nc" type="number" min="5" max="60" value="' + S.set.newC + '"></div><div class="field"><label for="nw">Từ mới / ngày khi không học kỳ nào</label><input id="nw" type="number" min="5" max="60" value="' + S.set.newW + '"></div></div><label class="row" style="margin-top:10px"><input type="checkbox" id="snd"' + (S.set.sound ? " checked" : "") + '> Âm thanh (trả lời đúng / sai, cộng điểm, lên cấp)</label></div>' +
      '<div class="card"><h2>14 ngày gần nhất</h2><table class="t"><thead><tr><th>Ngày</th><th>Học mới</th><th>Lượt ôn</th><th>XP</th></tr></thead><tbody>' + (last.length ? last.map(function (d) { var l = S.log[d]; return "<tr><td>" + dateOf(d) + '</td><td class="num">' + (l.n || 0) + '</td><td class="num">' + (l.r || 0) + '</td><td class="num">' + (l.x || 0) + "</td></tr>"; }).join("") : '<tr><td colspan="4" class="muted">Chưa có buổi học nào.</td></tr>') + '</tbody></table></div>' +
      '<div class="card"><h2>Kỷ lục trò chơi</h2><table class="t"><tbody>' + HC.games.map(function (g) { return "<tr><td>" + esc(g.name) + '</td><td class="num">' + (S.best[g.id] != null ? S.best[g.id] : "—") + "</td></tr>"; }).join("") + '</tbody></table><h3>Xóa toàn bộ tiến độ</h3><div id="rz"><button class="btn bad" id="reset">Xóa và học lại từ đầu</button></div></div><div class="card" id="sach-set"></div></div>';
    if (fb.user) { // thẻ tài khoản đứng đầu lưới thẻ (quản trị: tab Quản trị riêng)
      var cg0 = $(".cols2", v);
      if (cg0) { cg0.insertAdjacentHTML("afterbegin", '<div class="card" id="tk-set"></div>'); tkCard($("#tk-set", v)); }
    }
    var cg = $(".cols2", v); if (cg) cg.insertAdjacentHTML("beforeend", '<div class="card"><h2>Thanh mục</h2><p class="sub">Đổi vị trí các mục trên thanh menu cho hợp cách học của bạn (lưu riêng trên máy này). Ở màn hẹp, các mục đầu hiện trên thanh, các mục sau nằm trong nút ».</p><button class="btn" type="button" data-msort>⇅ Sắp xếp thanh mục</button></div>');
    var redraw = bindSched($("#lich", v));
    planPick($("#ky", v), function () { route(); });
    if (args && args[0] === "ky") HC.later(function () { var el = $("#ky", v); if (el) el.scrollIntoView(); }, 0);
    if (args && args[0] === "lich") HC.later(function () { var el = $("#lich", v); if (el) el.scrollIntoView(); }, 0);
    sachSettings($("#sach-set", v));
    if (args && args[0] === "sach") HC.later(function () { var el = $("#sach-set", v); if (el) el.scrollIntoView(); }, 0);
    var e1 = $("#fbin3", v); if (e1) e1.onclick = HC.fbSignIn;
    var e2 = $("#fbnow", v); if (e2) e2.onclick = function () { fbNow().then(function () { toast(fb.status === "ok" ? "Đã đồng bộ" : "Chưa đồng bộ được, kiểm tra mạng"); }); };
    var e3 = $("#fbout", v); if (e3) e3.onclick = function () { e3.disabled = true; HC.fbSignOut(false).then(function (r) { if (r) toast("Đã đăng xuất. Tiến độ của bạn được cất riêng trên máy này"); else e3.disabled = false; }); };
    var e5 = $("#fbwipe", v); if (e5) e5.onclick = function () {
      if (!confirm("Đăng xuất và xóa tiến độ của bạn khỏi máy này? Tiến độ vẫn còn trên tài khoản: đăng nhập lại là có.")) return;
      e5.disabled = true; HC.fbSignOut(true).then(function (r) { if (r) toast("Đã đăng xuất và xóa tiến độ của bạn khỏi máy này"); else e5.disabled = false; });
    };
    var e4 = $("#fbbk", v); if (e4) e4.onclick = function () {
      $("#bklist", v).innerHTML = '<p class="sub">Đang tải…</p>';
      HC.fbBackups().then(function (list) {
        if (!list.length) { $("#bklist", v).innerHTML = '<p class="sub">Chưa có bản sao lưu.</p>'; return; }
        $("#bklist", v).innerHTML = '<table class="t"><tbody>' + list.map(function (b, i) { var n = 0; try { n = Object.keys(JSON.parse(b.data).it).length; } catch (e) { } return "<tr><td>" + esc(b.id) + '</td><td class="num">' + n + ' mục đã học</td><td><button class="btn sm" data-rs="' + i + '">Khôi phục</button></td></tr>'; }).join("") + "</tbody></table>";
        $$("[data-rs]", v).forEach(function (btn) { btn.onclick = function () {
          var b = list[+btn.getAttribute("data-rs")];
          btn.parentNode.innerHTML = '<span>Thay tiến độ hiện tại bằng bản ' + esc(b.id) + '?</span> <button class="btn sm bad" data-yes>Khôi phục</button> <button class="btn sm" data-no>Thôi</button>';
          $("[data-yes]", v).onclick = function () { HC.fbRestore(b.data).then(function () { toast("Đã khôi phục bản " + b.id); route(); }); };
          $("[data-no]", v).onclick = function () { route(); };
        }; });
      }).catch(function () { $("#bklist", v).innerHTML = '<p class="sub">Không tải được bản sao lưu.</p>'; });
    };
    $("#cp", v).onclick = function () { var t = JSON.stringify(S); $("#bk", v).value = t; var ta = $("#bk", v); if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(function () { toast("Đã sao chép mã tiến độ"); }, function () { ta.select(); toast("Hãy bấm Ctrl+C để sao chép"); }); else { ta.select(); toast("Hãy bấm Ctrl+C để sao chép"); } };
    $("#im", v).onclick = function () { try { var o = JSON.parse($("#bk", v).value); if (!o || !o.it) throw 0; S = normalize(o); S.upd = Date.now(); save(); toast("Đã khôi phục tiến độ"); route(); } catch (e) { toast("Mã không hợp lệ. Hãy dán đúng toàn bộ mã đã sao chép."); } };
    $("#nc", v).onchange = function () { S.set.newC = Math.max(5, Math.min(60, +this.value || 20)); save(); redraw(); };
    $("#nw", v).onchange = function () { S.set.newW = Math.max(5, Math.min(60, +this.value || 17)); save(); redraw(); };
    $("#snd", v).onchange = function () { S.set.sound = this.checked; save(); };
    $("#reset", v).onclick = function () { $("#rz", v).innerHTML = '<p>Xóa hết chữ đã học, XP, huy hiệu? Không hoàn tác được.</p><div class="row"><button class="btn bad" id="yes">Xóa hết</button><button class="btn" id="no">Giữ lại</button></div>'; $("#yes", v).onclick = function () { S = blank(); save(); toast("Đã xóa tiến độ"); HC.go("home"); }; $("#no", v).onclick = function () { route(); }; };
  }

  // ---------- GAMES hub / EXAM (định nghĩa ở games.js) ----------
  function vGames(v, args) {
    if (args[0]) { var g = HC.games.filter(function (x) { return x.id === args[0]; })[0]; if (g) return g.run(v); }
    v.innerHTML = '<h1>Trò chơi ôn tập</h1><p class="sub">Mọi trò chơi dùng những chữ, từ bạn đã học. Mới bắt đầu thì app lấy thêm các chữ sắp học để bạn chơi được ngay. Mỗi câu đúng được cộng XP.</p><div class="games">' + HC.games.map(function (g) { return '<a class="gcard" href="#choi-' + g.id + '" style="text-decoration:none;color:inherit"><span class="gi">' + g.icon + "</span><b>" + esc(g.name) + "</b><small>" + esc(g.desc) + '</small><span class="best">' + (S.best[g.id] != null ? "Kỷ lục: " + S.best[g.id] : "Chưa chơi") + "</span></a>"; }).join("") + "</div>";
  }
  function vExam(v, args) { return HC.exam ? HC.exam(v, args) : null; }

  HC.state = function () { return S; };
  HC.setBest = function (id, val, higherBetter) { var b = S.best[id]; if (b == null || (higherBetter === false ? val < b : val > b)) { S.best[id] = val; return true; } return false; };

  // ---------- boot ----------
  function start(d) {
    layer = $("#layer");
    prepData(d);
    S = normalize(loadLocal() || blank());
    window.addEventListener("hashchange", function () { var h = (location.hash || "#home").slice(1); if (h !== cur) { cur = h; route(); } });
    route();
    initRemote();
    fbInit();
    if ("serviceWorker" in navigator && location.protocol === "https:" && !(window.claude && typeof window.claude.use === "function")) {
      navigator.serviceWorker.register("sw.js").catch(function () { });
    }
  }
  function boot() {
    if (window.__HANCO_APP__) return start(window.__HANCO_APP__);
    fetch("app-data.json").then(function (r) { return r.json(); }).then(start).catch(function () { $("#view").innerHTML = '<div class="card"><p>Không tải được dữ liệu bài học. Hãy tải lại trang.</p></div>'; });
  }
  function boot0() { try { songWatch(); } catch (e) { } try { aniWatch(); } catch (e) { } boot(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot0); else setTimeout(boot0, 0);
})();
