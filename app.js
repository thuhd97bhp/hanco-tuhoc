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
    BADGES.forEach(function (b) { if (b.id === "c1222") b.t = "Học hết " + fmt(d.chars.length) + " chữ"; });
    HC.ITEM = ITEM; HC.CHAR = CHAR; HC.WORD = WORD; HC.RAD = RAD; HC.QC = QC; HC.QW = QW;
    // loại từ lookup
    HC.LT = {}; Object.keys(d.loaitu).forEach(function (g) { d.loaitu[g].forEach(function (x) { HC.LT[x] = g; }); });
  }
  function firstAm(am) { return String(am || "").split(/\s*\/\s*/)[0]; }
  HC.firstAm = firstAm;

  // ---------- state + storage ----------
  var LS = "hanco-tuhoc-v1";
  var S, remote = { db: null, ref: null, status: "local", writing: false, pending: false };
  function blank() { return { v: 1, start: today(), set: { newC: 20, newW: 17, sound: true }, it: {}, xp: 0, streak: { d: 0, c: 0 }, best: {}, log: {}, badges: {}, upd: 0, itT: {}, gm: {}, hard: {}, pl: {}, note: {}, plans: {}, lt: {} }; }
  // plans[kỳ] = {s ngày bắt đầu, e ngày thi, t ms sửa, x ms bỏ (0 = đang học)} · lt[từ ngữ pháp] = [hộp, hạn ôn, số lần sai, ngày học, ms chấm]
  // hard[id] = t (ms thêm vào kho khó; âm = −ms lúc bỏ) · pl[plId] = {n tên, nt ms đặt tên, x ms xóa (0 = còn), ids {id: t như hard}}
  // note[id] = ["văn bản", ms] (văn bản rỗng = đã xóa). Gộp đồng bộ theo từng mục (mergeT) để máy nào thêm/xóa cũng không mất.
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
      function sig() { return JSON.stringify(S.it) + "|" + S.xp + "|" + S.start + "|" + JSON.stringify(S.hard) + "|" + JSON.stringify(S.pl) + "|" + JSON.stringify(S.note) + "|" + JSON.stringify(S.plans) + "|" + JSON.stringify(S.lt); }
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
    return gt(s.xp, r.xp) || (gt(s.upd, r.upd) && (s.start !== r.start || JSON.stringify(s.set) !== JSON.stringify(r.set)));
  }
  // nhận bản của tài khoản từ máy chủ (get hoặc onSnapshot): gộp vào S; máy còn phần tài khoản chưa có → dirty (sẽ ghi)
  function fbGot(d, own) {
    var first = !fb.remOk; fb.remOk = true;
    fb.rem = d && d.data ? d.data : null;
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
    if (fb.remOk && !fb.dirty) { fb.status = "ok"; renderStats(); return Promise.resolve(); } // không có gì mới: không ghi
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
        fb.busy = false; renderStats();
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
  function fbInit() {
    if (!window.firebase || !firebase.initializeApp) return tkNoFb();
    try {
      var app = firebase.apps && firebase.apps.length ? firebase.app() : firebase.initializeApp(FB_CONFIG);
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
    fbOwn(u, tk.dn, function (dirty) { tk.going = false; tk.dn = null; if (fb.user === u && !fb.ref && tk.st === "ok") fb.attach(u, dirty); });
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
      tkSet("ok"); tkGo(); return;
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
      fb.db.collection("hanco_users").doc(u.uid).update({ ten: t, upd: Date.now() }).then(function () { b.disabled = false; toast("Đã đổi tên hiển thị"); }, function (e) { b.disabled = false; toast(tkErr(e)); });
    };
    var r = $("#tkpwr", el); if (r) r.onclick = function () {
      r.disabled = true;
      fb.auth.sendPasswordResetEmail(u.email, tkActs()).then(function () { toast("Đã gửi link đổi mật khẩu tới " + u.email); }, function (e) { r.disabled = false; toast(tkErr(e)); });
    };
  }

  // thẻ "Quản trị (tạm)" trong Cài đặt — chỉ quản trị viên. Bước 4 chuyển sang tab Quản trị.
  // Danh sách họ tên: mỗi dòng 1 họ tên (dán từ Excel được: bỏ cột STT / số thứ tự đầu dòng). Xem trước đúng từng tên sẽ lưu rồi mới ghi.
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
  function qtCard(el) {
    if (!el || !isAdmin()) return;
    var db = fb.db, cref = db.collection("hanco_cfg").doc("dk");
    el.innerHTML = '<h2>Quản trị (tạm)</h2><p class="sub">Chỉ tài khoản quản trị thấy thẻ này. Bước sau sẽ chuyển sang tab Quản trị.</p>' +
      '<h3>Đăng ký tài khoản</h3><div id="qtdk"><p class="sub">Đang tải…</p></div>' +
      '<h3>Danh sách họ tên thật</h3><p class="sub">Chỉ người có họ tên trong danh sách này mới đăng ký được (mỗi họ tên 1 tài khoản). Dán mỗi dòng 1 họ tên đầy đủ, có dấu (dán thẳng từ Excel được: app tự bỏ cột số thứ tự). Không ai ngoài quản trị đọc được danh sách.</p>' +
      '<textarea id="qtten" aria-label="Danh sách họ tên" placeholder="Nguyễn Văn An&#10;Trần Thị Bình"></textarea><div class="row" style="margin-top:8px"><button class="btn" type="button" id="qtxem">Xem trước</button><button class="btn" type="button" id="qtds">Xem danh sách đã lưu</button></div><div id="qtkq"></div>';
    function dk() {
      cref.get().then(function (c) {
        var d = c.exists ? c.data() : { tran: 120, dem: 0, mo: true };
        $("#qtdk", el).innerHTML = '<p>Đã đăng ký: <b>' + fmt(d.dem || 0) + '</b> / ' + fmt(d.tran || 0) + ' người (không tính quản trị viên).</p>' +
          '<div class="row" style="align-items:end"><div class="field" style="flex:0 1 160px"><label for="qttran">Trần số người</label><input id="qttran" type="number" min="0" max="1000" value="' + (+d.tran || 0) + '"></div>' +
          '<button class="btn" type="button" id="qtluu">Lưu</button></div><label style="display:flex;gap:8px;align-items:center;min-height:40px;margin-top:6px"><input type="checkbox" id="qtmo"' + (d.mo ? " checked" : "") + '> Cho người mới đăng ký</label>' +
          '<p class="sub">Bỏ chọn "Cho người mới đăng ký" = tạm không nhận thêm người mới dù còn chỗ (người đã có tài khoản vẫn học bình thường). Hết chỗ thì người mới thấy "App đã đủ người".</p>';
        $("#qtluu", el).onclick = function () {
          var t = Math.max(0, Math.min(1000, parseInt($("#qttran", el).value, 10) || 0)), mo = $("#qtmo", el).checked;
          (c.exists ? cref.update({ tran: t, mo: mo }) : cref.set({ tran: t, dem: 0, mo: mo })).then(function () { toast("Đã lưu"); dk(); }, function (e) { toast(tkErr(e)); });
        };
      }, function (e) { $("#qtdk", el).innerHTML = '<p class="sub">' + esc(tkErr(e)) + "</p>"; });
    }
    dk();
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
          }, Promise.resolve()).then(function () { toast("Đã thêm " + neu.length + " họ tên"); $("#qtten", el).value = ""; kq.innerHTML = '<p>Đã thêm <b>' + neu.length + "</b> họ tên vào danh sách.</p>"; }, function (e) { ghi.disabled = false; toast(tkErr(e)); });
        };
      }, function (e) { kq.innerHTML = '<p class="tkmsg">' + esc(tkErr(e)) + "</p>"; });
    };
    $("#qtds", el).onclick = function () {
      kq.innerHTML = '<p class="sub">Đang tải…</p>';
      saved().then(function (m) {
        var ks = Object.keys(m).sort(function (a, b) { return m[a].ten.localeCompare(m[b].ten, "vi"); }), n = ks.filter(function (k) { return m[k].uid; }).length;
        kq.innerHTML = '<p>' + ks.length + ' họ tên trong danh sách: <b>' + n + '</b> đã có tài khoản, <b>' + (ks.length - n) + '</b> chưa.</p>' +
          (ks.length ? '<table class="t"><tbody>' + ks.map(function (k) { return "<tr><td>" + esc(m[k].ten) + "</td><td>" + (m[k].uid ? "đã có tài khoản" : '<span class="muted">chưa</span>') + "</td><td>" + (m[k].uid ? "" : '<button class="btn sm ghost" type="button" data-qtx="' + esc(k) + '" aria-label="Xóa họ tên này">✕</button>') + "</td></tr>"; }).join("") + "</tbody></table>" : "");
        $$("[data-qtx]", kq).forEach(function (bx) { bx.onclick = function () {
          var k = bx.getAttribute("data-qtx");
          if (!confirm("Xóa \"" + m[k].ten + "\" khỏi danh sách? Người này sẽ không đăng ký được.")) return;
          db.collection("hanco_ten").doc(k).delete().then(function () { toast("Đã xóa"); $("#qtds", el).click(); }, function (e) { toast(tkErr(e)); });
        }; });
      }, function (e) { kq.innerHTML = '<p class="tkmsg">' + esc(tkErr(e)) + "</p>"; });
    };
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
  function normalize0(s) { var b = blank(); Object.keys(b).forEach(function (k) { if (s[k] == null) s[k] = b[k]; }); Object.keys(b.set).forEach(function (k) { if (s.set[k] == null) s.set[k] = b.set[k]; }); ["hard", "pl", "note"].forEach(function (k) { if (typeof s[k] !== "object" || Array.isArray(s[k])) s[k] = {}; }); return s; }

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
  function noteOf(id) { var n = S.note[id]; return n && n[0] ? String(n[0]) : ""; }
  HC.noteOf = noteOf;
  // văn bản ghi chú: chữ thường (ghi chú cũ) hoặc HTML đã lọc bằng noteClean (ô soạn có định dạng). Rỗng = đã xóa.
  HC.setNote = function (id, text) {
    var h = noteClean(text).replace(/(<br>|<div><br><\/div>|\s)+$/, "");
    if (!noteTxt(h).replace(/[\s ]+/g, "")) h = "";
    if (h.length > NOTE_HTML_MAX) return false;
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
  var BADGES = [
    { id: "c100", g: "百", t: "100 chữ", ok: function () { return learnedOf("c").length >= 100; } },
    { id: "c300", g: "三", t: "300 chữ", ok: function () { return learnedOf("c").length >= 300; } },
    { id: "c594", g: "通", t: "Xong chữ thông dụng", ok: function () { return QC.slice(0, COMMON_C).every(function (c) { return introduced(c.id); }); } },
    { id: "w492", g: "詞", t: "Xong từ thông dụng", ok: function () { return QW.slice(0, COMMON_W).every(function (w) { return introduced(w.id); }); } },
    { id: "c1222", g: "全", t: "Học hết 1.222 chữ", ok: function () { return learnedOf("c").length >= D.chars.length; } },
    { id: "r214", g: "部", t: "Đủ 214 bộ", ok: function () { return learnedOf("r").length >= 214; } },
    { id: "s7", g: "七", t: "Chuỗi 7 ngày", ok: function () { return S.streak.c >= 7; } },
    { id: "s30", g: "恆", t: "Chuỗi 30 ngày", ok: function () { return S.streak.c >= 30; } },
    { id: "w50", g: "筆", t: "Viết đúng 50 lần", ok: function () { return (S.best.writeOk || 0) >= 50; } },
    { id: "exam", g: "試", t: "Thi thử ≥ 80 điểm", ok: function () { return Object.keys(S.best).some(function (k) { return k.indexOf("exam") === 0 && S.best[k] >= 80; }); } }
  ];
  function checkBadges() {
    BADGES.forEach(function (b) { if (!S.badges[b.id] && b.ok()) { S.badges[b.id] = today(); toast("Huy hiệu mới: " + b.t); } });
  }
  HC.checkBadges = checkBadges;

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
  function planPick(box, onSave) {
    var t0 = today(), dr = {};
    TERMS.forEach(function (T) { var p = S.plans[T.k], on = !!(p && !p.x && t0 <= p.e); dr[T.k] = { on: on, s: on ? p.s : t0, e: on ? p.e : t0 + 34, old: on }; });
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
      var h = '<div class="row"><h2 style="margin:0">Chọn kỳ học</h2></div><p class="sub">Chọn kỳ muốn học và ngày thi của từng kỳ (học nhiều kỳ cùng lúc được). App tự xếp lịch: chữ + từ học từ ngày đầu (chữ, từ lặp lại nhiều học trước), loại từ từ 1/5 chặng, câu từ nửa chặng, những ngày cuối chỉ ôn + thi thử. Chữ đã học giữ nguyên.</p><div class="kypick">';
      TERMS.forEach(function (T) {
        var x = dr[T.k];
        h += '<div class="kyp' + (x.on ? " on" : "") + '"><label class="row kyon"><input type="checkbox" data-on="' + T.k + '"' + (x.on ? " checked" : "") + '><b>' + esc(T.name) + '</b><small class="muted">' + T.n.c + " chữ · " + T.n.w + " từ · " + T.n.lt + " loại từ · " + T.n.s + " câu</small></label>";
        if (x.on) h += '<div class="row kyset"><div class="field"><label for="ke-' + T.k + '">Ngày thi</label><input type="date" id="ke-' + T.k + '" data-e="' + T.k + '" value="' + ymd(x.e) + '" min="' + ymd(t0 + 1) + '"></div><div class="row kywk">' + [4, 6, 8, 10].map(function (n) { return '<button type="button" class="btn sm" data-wk="' + T.k + "|" + n + '">' + n + " tuần</button>"; }).join("") + "</div>" + (x.old ? '<button type="button" class="btn sm ghost" data-rs="' + T.k + '">Bắt đầu lại từ hôm nay</button>' : "") + '</div><p class="sub kypv">' + preview(T.k) + "</p>";
        h += "</div>";
      });
      h += '</div><div class="row"><button type="button" class="btn primary" id="kysave">Lưu lộ trình</button><span class="muted" id="kymsg" style="font-size:0.85rem"></span></div>';
      box.innerHTML = h;
      $$("[data-on]", box).forEach(function (c) { c.onchange = function () { var x = dr[c.getAttribute("data-on")]; x.on = c.checked; if (x.on && !x.old) { x.s = t0; } draw(); }; });
      $$("[data-e]", box).forEach(function (c) { c.onchange = function () { var n = fromYmd(c.value), x = dr[c.getAttribute("data-e")]; if (n == null || n <= t0) { toast("Hãy chọn ngày thi sau hôm nay"); draw(); return; } x.e = n; draw(); }; });
      $$("[data-wk]", box).forEach(function (b) { b.onclick = function () { var a = b.getAttribute("data-wk").split("|"), x = dr[a[0]]; x.e = Math.max(t0, x.s) + 7 * (+a[1]) - 1; if (x.e <= t0) x.e = t0 + 1; draw(); }; });
      $$("[data-rs]", box).forEach(function (b) { b.onclick = function () { var x = dr[b.getAttribute("data-rs")]; x.s = t0; if (x.e <= t0) x.e = t0 + 34; draw(); $("#kymsg", box).textContent = "Bấm Lưu lộ trình để áp dụng."; }; });
      $("#kysave", box).onclick = function () {
        var now = Date.now(), n = 0;
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
  function moreBtn(id) { return '<button type="button" class="more' + (isHard(id) ? " on" : "") + '" data-more="' + id + '" aria-label="Thêm: kho khó, playlist, ghi chú" title="Kho khó, playlist, ghi chú">⋯</button>'; }
  HC.moreBtn = moreBtn;
  var pop = null;
  function closePop() { if (pop) { pop.remove(); pop = null; } var mm = document.getElementById("mmore"); if (mm) mm.setAttribute("aria-expanded", "false"); }
  function inDetailOf(el, id) { var d = el.closest("[data-detail]"); return !!d && d.getAttribute("data-detail") === id; }
  function openMore(btn) {
    var id = btn.getAttribute("data-more"), it = ITEM[id];
    if (!it) return;
    if (pop && pop.getAttribute("data-for") === id) { closePop(); return; }
    closePop();
    var hard = isHard(id), nt = noteOf(id);
    var h = '<div class="ph"><span class="han">' + esc(it.type === "s" ? it.han.slice(0, 14) + (it.han.length > 14 ? "…" : "") : it.key) + "</span> " + esc(kindLabel(it)) + "</div>" +
      '<button type="button" data-pm="hard">' + (hard ? "★ Bỏ khỏi kho khó" : "☆ Thêm vào kho khó") + "</button>" +
      '<button type="button" data-pm="pl">≡ Thêm vào playlist…</button>' +
      '<button type="button" data-pm="note">✎ ' + (nt ? "Sửa ghi chú" : "Ghi chú") + "</button>" +
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
      else if (a === "note") editNote(id);
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
  function noteHTML(id) { return '<div class="note" data-note="' + id + '">' + noteInner(id, "view") + "</div>"; }
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
  function noteInner(id, mode) {
    var t = noteOf(id);
    if (mode === "edit") return '<div class="facts"><span class="k">Ghi chú của bạn</span></div>' + NOTE_TB + '<div class="ntpop hide"></div><div class="ned nt" contenteditable="true" role="textbox" aria-multiline="true" aria-label="Ghi chú" data-ph="Ví dụ: cách nhớ riêng, chỗ hay nhầm…">' + noteClean(t) + '</div><div class="row nfoot"><span class="muted nc">Tự động lưu</span><span class="spacer"></span><button type="button" class="btn sm ghost" data-nact="del">Xóa</button><button type="button" class="btn sm primary" data-nact="done">Xong</button></div>';
    if (mode === "del") return '<div class="facts"><span class="k">Ghi chú của bạn</span></div><div class="nt">' + noteClean(t) + '</div><div class="row"><span>Xóa ghi chú này?</span><span class="spacer"></span><button type="button" class="btn sm" data-nact="cancel">Thôi</button><button type="button" class="btn sm bad" data-nact="delyes">Xóa</button></div>';
    if (!t) return '<button type="button" class="btn sm ghost" data-nact="edit">✎ Thêm ghi chú</button>';
    return '<div class="facts"><span class="k">Ghi chú của bạn</span></div><div class="nt">' + noteClean(t) + '</div><div class="row"><span class="spacer"></span><button type="button" class="btn sm" data-nact="edit">Sửa</button><button type="button" class="btn sm ghost" data-nact="del">Xóa</button></div>';
  }
  // ---- tự lưu: box đang chờ lưu giữ lại cả khi khung đã đóng (đã tách khỏi trang) nên vẫn lưu được
  var noteCur = null, noteTm = 0;
  function noteStat(box, s, bad) { var n = box.querySelector(".nc"); if (n) { n.textContent = s; n.classList.toggle("bad", !!bad); } }
  function noteSched(box) { noteCur = box; clearTimeout(noteTm); noteTm = setTimeout(noteFlush, 700); noteStat(box, "Đang lưu…"); }
  function noteFlush() {
    clearTimeout(noteTm); var box = noteCur; noteCur = null; if (!box) return true;
    var ed = box.querySelector(".ned"); if (!ed) return true;
    var id = box.getAttribute("data-note"), n = noteTxt(noteClean(ed.innerHTML)).length;
    if (n > NOTE_MAX) { noteStat(box, "Dài " + n + " / " + NOTE_MAX + " ký tự — bớt lại mới lưu được", true); return false; }
    if (!HC.setNote(id, ed.innerHTML)) { noteStat(box, "Quá nhiều định dạng — chưa lưu được", true); return false; }
    noteStat(box, "Đã lưu" + (n > NOTE_MAX - 300 ? " · " + n + " / " + NOTE_MAX : ""));
    refreshNotes(id, box);
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
    var id = box.getAttribute("data-note");
    box.innerHTML = noteInner(id, mode);
    if (mode === "edit") {
      var ed = box.querySelector(".ned");
      ed.addEventListener("input", function () { noteMark(ed); noteSched(box); });
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
  function refreshNotes(id, except) { $$('[data-note="' + id + '"]').forEach(function (b) { if (b !== except && !b.querySelector(".ned")) noteMode(b, "view"); }); }
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
    a = b.getAttribute("data-nact");
    if (a === "edit") noteMode(box, "edit");
    else if (a === "done") { if (noteCur === box && !noteFlush()) return; noteMode(box, "view"); }
    else if (a === "del") { if (noteCur === box) noteFlush(); noteMode(box, noteOf(id) ? "del" : "view"); }
    else if (a === "cancel") noteMode(box, "view");
    else if (a === "delyes") { HC.setNote(id, ""); noteMode(box, "view"); refreshNotes(id, box); toast("Đã xóa ghi chú"); }
  });
  // mở ô ghi chú: có khung chi tiết đang hiện thì sửa ngay ở đó; không thì mở khung nhỏ chỉ có chữ + ghi chú (không lộ đáp án thẻ ôn)
  function editNote(id) {
    var box = $('[data-note="' + id + '"]');
    if (!box) {
      var it = ITEM[id];
      modal('<h2 style="margin:0 40px 8px 0">Ghi chú · <span class="han">' + esc(it.type === "s" ? it.han : it.key) + "</span></h2>" + noteHTML(id));
      box = $('[data-note="' + id + '"]');
    }
    noteMode(box, "edit");
    try { box.scrollIntoView({ block: "nearest" }); } catch (e) { }
  }
  HC.editNote = editNote; HC.noteHTML = noteHTML;

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
  // từ tools/work/sach/khop.txt. Hình (PNG base64) CHỈ ở Firestore riêng của người dùng: hanco_progress/{uid}/sach/p<vị trí> = {b, vt, upd};
  // hanco_progress/{uid}/sach/info = {sz: {vị trí: độ dài base64}, upd}. Đưa lên ở Cài đặt (file tools/work/sach/sach.pack).
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
  function sachRef() { return fb.ref ? fb.ref.collection("sach") : null; }
  function sachFetch(vt) { // đọc 1 trang từ Firestore → Blob (đã lưu vào bộ đệm nếu được phép)
    var col = sachRef();
    if (!col) return Promise.reject(sachErr(fb.on ? "signedout" : "nofb"));
    if (navigator.onLine === false) return Promise.reject(sachErr("offline"));
    return col.doc("p" + vt).get().then(function (d) {
      var x = d.exists ? d.data() : null;
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
      if (c === "signedout") t = 'Đăng nhập Google để xem hình trang sách. <button type="button" class="btn sm" data-sin>Đăng nhập</button>';
      else if (c === "nofb") t = "Cần đăng nhập Google để xem hình trang sách.";
      else if (c === "missing") t = 'Tài khoản này chưa có hình trang sách (có gói hình thì đưa lên ở <a href="#caidat-sach">Cài đặt → Hình trang sách</a>).';
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
  function sachInfo() { var col = sachRef(); return col ? col.doc("info").get().then(function (d) { return (d.exists && d.data()) || {}; }) : Promise.reject(sachErr("signedout")); }
  function sachSettings(el) {
    if (!el) return;
    var busy = false, cachesOk = !!window.caches;
    function errText(e) { var c = e && (e.code || e.message); return c === "permission-denied" ? "máy chủ chưa cho phép lưu hình sách (cần cập nhật quy tắc Firestore)" : c === "offline" || c === "unavailable" ? "không có mạng" : "lỗi " + (c || "không rõ"); }
    function draw() {
      var noluu = sachNoLuu();
      el.innerHTML = '<h2>Hình trang sách</h2><p class="sub">Hình trang sách «' + esc(SACH_BOOK) + '» (ảnh quét, có bản quyền) chỉ lưu trên tài khoản Google của bạn, không có trên trang web công khai. Hình hiện trong khung chi tiết chữ và bộ thủ: chữ có trong sách → trang của chữ; chữ không có → trang từng thành phần cấu tạo.</p>' +
        '<div class="srow"><span class="k">Trên tài khoản</span> <span id="sst-acc">' + (fb.user ? "đang kiểm tra…" : fb.on ? "chưa đăng nhập" : "không dùng được trên trang này") + "</span></div>" +
        '<div class="srow"><span class="k">Trên máy này</span> <span id="sst-dev">' + (cachesOk ? "đang tính…" : "trình duyệt này không lưu hình được") + "</span></div>" +
        '<div class="row" style="margin-top:8px">' +
        (fb.user ? '<button class="btn" id="sup">Đưa hình sách lên tài khoản</button><input type="file" id="supf" accept=".pack,application/json" hidden>' + (cachesOk ? '<button class="btn" id="sall"' + (noluu ? " disabled" : "") + ">Tải hết về máy này</button>" : "") : fb.on ? '<button class="btn primary" id="sin">Đăng nhập bằng Google</button>' : "") +
        (cachesOk ? '<button class="btn ghost" id="sdel">Xóa hình sách đã lưu</button>' : "") + "</div>" +
        '<div id="sconf"></div><div id="sprog" class="sprog" hidden><div class="bar"><i></i></div><span class="muted"></span></div>' +
        (cachesOk ? '<label class="row" style="margin-top:10px"><input type="checkbox" id="snl"' + (noluu ? " checked" : "") + "> Không lưu hình sách trên máy này (mỗi lần xem tải lại từ tài khoản, cần mạng)</label>" : "") +
        '<p class="sub" style="margin-top:8px">Đưa hình lên chỉ cần làm 1 lần, từ máy tính có file <code>tools/work/sach/sach.pack</code>. "Tải hết về máy này" lấy khoảng 35 MB để xem khi không có mạng.</p>';
      var b;
      if ((b = $("#sin", el))) b.onclick = HC.fbSignIn;
      if ((b = $("#sup", el))) b.onclick = function () { if (!busy) $("#supf", el).click(); };
      if ((b = $("#supf", el))) b.onchange = function () { var f = this.files && this.files[0]; this.value = ""; if (f) upload(f); };
      if ((b = $("#sall", el))) b.onclick = function () { if (!busy) fetchAll(); };
      if ((b = $("#sdel", el))) b.onclick = function () {
        if (busy) return;
        $("#sconf", el).innerHTML = '<div class="row" style="margin-top:8px"><span>Xóa hết hình sách đã lưu trên máy này? (Hình trên tài khoản vẫn còn.)</span><button class="btn sm bad" id="sdy">Xóa</button><button class="btn sm" id="sdn">Thôi</button></div>';
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
      if (fb.user) Promise.all([sachMap(), sachInfo()]).then(function (r) {
        var tot = sachPages(r[0]).length, n = Object.keys(r[1].sz || {}).length;
        if (a && a.isConnected) a.textContent = n ? n + "/" + tot + " trang" + (r[1].upd ? " (đưa lên " + new Date(r[1].upd).toLocaleDateString("vi-VN") + ")" : "") : "chưa có hình (cần đưa lên)";
      }, function (e) { if (a && a.isConnected) a.textContent = "chưa kiểm tra được: " + errText(e); });
    }
    function prog(k, n, txt) {
      var p = $("#sprog", el); if (!p) return;
      p.hidden = false; p.querySelector("i").style.width = (n ? Math.round(k * 100 / n) : 0) + "%"; p.querySelector("span").textContent = txt;
    }
    function pool(list, work, done) { // chạy 4 việc song song; dừng ở lỗi đầu tiên
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
    function upload(file) {
      busy = true; prog(0, 1, "Đang đọc file…");
      var fr = new FileReader();
      fr.onerror = function () { busy = false; prog(0, 1, "Không đọc được file."); };
      fr.onload = function () {
        var pk; try { pk = JSON.parse(fr.result); } catch (e) { pk = null; }
        if (!pk || pk.v !== 1 || !pk.pages || typeof pk.pages !== "object") { busy = false; prog(0, 1, "File không đúng: hãy chọn tools/work/sach/sach.pack."); return; }
        fr = null;
        var col = sachRef(); if (!col) { busy = false; prog(0, 1, "Cần đăng nhập."); return; }
        sachInfo().then(function (info) {
          var sz = info.sz || {}, todo = Object.keys(pk.pages).filter(function (vt) { return /^\d+$/.test(vt) && typeof pk.pages[vt] === "string" && sz[vt] !== pk.pages[vt].length; });
          var n = todo.length, skip = Object.keys(pk.pages).length - n, lastSave = 0;
          if (!n) { prog(1, 1, "Tài khoản đã có đủ " + Object.keys(sz).length + " trang, không cần đưa lên."); return; }
          prog(0, n, "Đang đưa lên 0/" + n + " trang" + (skip ? " (bỏ qua " + skip + " trang đã có)" : "") + "…");
          var saveInfo = function () { return col.doc("info").set({ sz: sz, upd: Date.now() }); };
          return pool(todo, function (vt) {
            var b = pk.pages[vt];
            return col.doc("p" + vt).set({ b: b, vt: +vt, upd: Date.now() }).then(function () {
              sz[vt] = b.length;
              if (Object.keys(sz).length - lastSave >= 25) { lastSave = Object.keys(sz).length; return saveInfo(); }
            });
          }, function (k) { prog(k, n, "Đang đưa lên " + k + "/" + n + " trang…"); }).then(function () {
            return saveInfo().then(function () { prog(n, n, "Xong: đã đưa lên " + n + " trang. Tài khoản có " + Object.keys(sz).length + " trang."); toast("Đã đưa hình sách lên tài khoản"); });
          }, function (e) {
            return saveInfo().then(null, function () { }).then(function () { prog(0, 1, "Dừng giữa chừng (" + errText(e) + "). Bấm lại và chọn file để đưa tiếp phần còn lại."); });
          });
        }).then(null, function (e) { prog(0, 1, "Chưa đưa lên được: " + errText(e) + "."); }).then(function () { busy = false; pk = null; stat(); });
      };
      fr.readAsText(file);
    }
    function fetchAll() {
      busy = true; prog(0, 1, "Đang kiểm tra…");
      sachMap().then(function (m) {
        var ps = sachPages(m);
        return Promise.all(ps.map(function (vt) { return sachCacheGet(vt).then(function (b) { return b ? null : vt; }); })).then(function (a) {
          var todo = a.filter(function (x) { return x != null; }), n = todo.length;
          if (!n) { prog(1, 1, "Máy này đã có đủ " + ps.length + " trang."); return; }
          prog(0, n, "Đang tải 0/" + n + " trang…");
          return pool(todo, sachFetch, function (k) { prog(k, n, "Đang tải " + k + "/" + n + " trang…"); }).then(function () { prog(n, n, "Xong: máy này đã có đủ " + ps.length + " trang."); }, function (e) {
            prog(0, 1, (e && e.code === "missing" ? "Tài khoản chưa có đủ hình (cần đưa lên trước)." : "Dừng giữa chừng (" + errText(e) + "). Bấm lại để tải tiếp."));
          });
        });
      }).then(null, function (e) { prog(0, 1, "Chưa tải được: " + errText(e) + "."); }).then(function () { busy = false; stat(); });
    }
    el._redraw = function () { if (!busy && el.isConnected) draw(); };
    draw();
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
  var SG_SKIP = "script,style,textarea,input,select,option,svg,canvas,[contenteditable],.big,.sg,.songimg"; // ô soạn ghi chú: giữ chữ thật (ảnh sẽ bị lọc mất khi lưu)
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
    var cs = chars(t); if (!cs.some(sgChar)) return;
    var f = document.createDocumentFragment(), buf = "", made = 0;
    var flush = function () { if (buf) { var x = document.createTextNode(buf); x._sg = buf; f.appendChild(x); buf = ""; } }; // _sg: chữ do mình tạo, không xử lý lại
    cs.forEach(function (ch) {
      if (!sgChar(ch)) { buf += ch; return; }
      var k = hanKey(ch), h = HIMG[k];
      if (h && h.bad) { buf += ch; return; } // chữ không có ảnh (vd 查 設 ⺗): giữ nguyên chữ
      flush(); made++;
      var s = document.createElement("span"); s.className = h && h.ok ? "sg on" : "sg"; s.setAttribute("data-k", k);
      s.style.setProperty("--sg", "url(han/" + k + ".webp)"); s.textContent = ch; f.appendChild(s);
      if (!(h && h.ok) && !(h && h.sgw)) { hanImg(ch, sgLoaded); HIMG[k].sgw = 1; } // mỗi chữ chỉ hẹn 1 lần
    });
    // Không có chữ nào đổi sang ảnh → KHÔNG thay nút chữ. (Lỗi đơ app: thay bằng nút chữ y hệt → MutationObserver thấy nút mới
    // → lại thay → lặp vô tận, trình duyệt treo cứng trên máy không có MS Song, gặp chữ không có ảnh như ký hiệu thanh mục 查 設.)
    if (!made) { tn._sg = t; return; }
    flush();
    p.replaceChild(f, tn);
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
    ["bo", "Bộ thủ"], ["loaitu", "Loại từ"], ["cau", "Câu"], ["thi", "Thi thử"], ["tra", "Tra cứu"], ["caidat", "Tiến độ & cài đặt"]
  ];
  // ký hiệu chữ Hán (chỉ để trang trí, không phải nội dung thi) + nhãn ngắn cho thanh mục dọc hẹp
  var MENU_IC = {
    home: ["今", "Hôm nay"], hoc: ["新", "Học mới"], on: ["溫", "Ôn tập"], kho: ["難", "Kho khó"], viet: ["書", "Tập viết"], choi: ["戲", "Trò chơi"],
    bo: ["部", "Bộ thủ"], loaitu: ["類", "Loại từ"], cau: ["句", "Câu"], thi: ["試", "Thi thử"], tra: ["查", "Tra cứu"], caidat: ["設", "Cài đặt"]
  };
  var cleanup = null;
  // THỨ TỰ các mục trên thanh menu: người học tự xếp (người dùng yêu cầu 25/11/2026), nhớ RIÊNG từng máy ở localStorage
  // "hanco-menu-thu-tu" (mảng tên màn), KHÔNG thuộc S. Luôn đủ mọi mục của VIEWS: mục lạ / trùng bị bỏ, mục mới thêm vào cuối.
  var MENU_KEY = "hanco-menu-thu-tu", menuCur = null, menuBadge = {};
  function menuOrder() {
    var ids = VIEWS.map(function (v) { return v[0]; }), saved = null, out = [];
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
    pop.style.maxHeight = "calc(100vh - 16px)"; pop.style.overflowY = "auto";
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
    $("#stats").innerHTML = cloud + '<span class="pill streak" title="Chuỗi ngày học liên tục">🔥 ' + (S.streak.d >= today() - 1 ? S.streak.c : 0) + '</span><span class="pill lv" title="' + esc(sync) + '">Cấp ' + L.l + '</span><span class="pill xp num">' + fmt(S.xp) + " XP</span>";
    var fi = $("#fbin"); if (fi) fi.onclick = HC.fbSignIn;
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
    var name = h[0]; if (!VIEWS.some(function (v) { return v[0] === name; })) name = "home";
    renderMenu(name); renderStats();
    var view = $("#view"); view.innerHTML = "";
    var fn = { home: vHome, hoc: vLearn, on: vReview, kho: vKho, viet: vWrite, choi: vGames, bo: vRad, loaitu: vLT, cau: vSent, thi: vExam, tra: vLookup, caidat: vSettings }[name];
    cleanup = fn(view, h.slice(1)) || null;
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
    h += '<h3>Huy hiệu</h3><div class="badges">' + BADGES.map(function (b) { return '<div class="bdg' + (S.badges[b.id] ? " on" : "") + '"><div class="m">' + b.g + "</div>" + esc(b.t) + "</div>"; }).join("") + "</div>";
    var hard = HC.hard().slice(0, 12);
    var nk = HC.hardList().length;
    h += '<h3>Chữ hay quên</h3>' + (hard.length ? '<div class="minis">' + hard.map(miniHTML).join("") + '</div><p style="margin-top:8px"><a class="btn sm" href="#on-kho">Ôn riêng chữ hay quên</a></p>' : '<p class="sub">Chưa có. Chữ nào bạn quên từ 2 lần trở lên sẽ tự vào đây.</p>');
    h += '<h3>Kho khó</h3><p class="sub">' + (nk ? nk + " mục bạn tự đánh dấu là khó." : "Bấm nút ⋯ cạnh chữ, từ, câu để thêm vào kho khó.") + '</p><p style="margin-top:8px"><a class="btn sm" href="#kho">Mở kho khó</a></p>';
    h += "</div></div></div>";
    v.innerHTML = h;
    var b2 = $("#fbin2", v); if (b2) b2.onclick = HC.fbSignIn;
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
    if (fb.user) { // tài khoản (+ thẻ quản trị tạm) đứng đầu lưới thẻ
      var cg0 = $(".cols2", v);
      if (cg0) { cg0.insertAdjacentHTML("afterbegin", '<div class="card" id="tk-set"></div>' + (isAdmin() ? '<div class="card" id="qt-set"></div>' : "")); tkCard($("#tk-set", v)); qtCard($("#qt-set", v)); }
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
