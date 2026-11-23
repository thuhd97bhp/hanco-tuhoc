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
    });
    d.sents.forEach(function (s) { s.type = "s"; s.key = s.han; s.am = s.pa; s.ns = s.dn; ITEM[s.id] = s; });
    QC = d.chars.filter(function (c) { return c.common; }).concat(d.chars.filter(function (c) { return !c.common; }));
    COMMON_C = d.chars.filter(function (c) { return c.common; }).length;
    var cw = d.words.filter(function (w) { return w.common; });
    QW = cw.filter(function (w) { return w.k10; }).concat(cw.filter(function (w) { return !w.k10; }), d.words.filter(function (w) { return !w.common; }));
    COMMON_W = cw.length;
    QR = d.rads.slice().sort(function (a, b) { return b.use - a.use || a.no - b.no; });
    QS = d.sents.slice();
    HC.ITEM = ITEM; HC.CHAR = CHAR; HC.WORD = WORD; HC.RAD = RAD; HC.QC = QC; HC.QW = QW;
    // loại từ lookup
    HC.LT = {}; Object.keys(d.loaitu).forEach(function (g) { d.loaitu[g].forEach(function (x) { HC.LT[x] = g; }); });
  }
  function firstAm(am) { return String(am || "").split(/\s*\/\s*/)[0]; }
  HC.firstAm = firstAm;

  // ---------- state + storage ----------
  var LS = "hanco-tuhoc-v1";
  var S, remote = { db: null, ref: null, status: "local", writing: false, pending: false };
  function blank() { return { v: 1, start: today(), set: { newC: 20, newW: 17, sound: true }, it: {}, xp: 0, streak: { d: 0, c: 0 }, best: {}, log: {}, badges: {}, upd: 0 }; }
  function loadLocal() { try { var t = localStorage.getItem(LS); if (t) return JSON.parse(t); } catch (e) { } return null; }
  function saveLocal() { try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) { } }
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
  var fb = { on: false, auth: null, db: null, user: null, ref: null, status: "off", last: 0, busy: false, again: false, timer: null, unsub: null, lastSeen: 0 };
  HC.fb = fb;
  function dayKey(n) { var d = new Date(n * 864e5); return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0") + "-" + String(d.getUTCDate()).padStart(2, "0"); }
  // gộp tiến độ hai máy: không mất chữ nào đã học ở bất kỳ máy nào
  function merge(a, b) {
    var m = JSON.parse(JSON.stringify(a)), newer = (b.upd || 0) > (a.upd || 0) ? b : a;
    Object.keys(b.it || {}).forEach(function (id) {
      var x = m.it[id], y = b.it[id];
      if (!x) { m.it[id] = y.slice(); return; }
      var sx = x[1] + Math.max(x[3], 0), sy = y[1] + Math.max(y[3], 0), lap = Math.max(x[4], y[4]);
      if (sy > sx || (sy === sx && y[0] + y[2] > x[0] + x[2])) m.it[id] = y.slice();
      m.it[id][4] = lap;
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
    return m;
  }
  HC.merge = merge;
  function softRefresh() {
    var c = cur || "home", name = c.split("-")[0];
    if (c.indexOf("-") < 0 && ["home", "caidat", "tra", "bo", "loaitu", "cau", "choi", "thi", "on", "viet"].indexOf(name) >= 0 && !document.querySelector(".fc, canvas.pad, .modal")) route();
    else { renderStats(); renderMenu(name); }
  }
  function applyRemote(data, silent) {
    try {
      var rem = typeof data === "string" ? JSON.parse(data) : data;
      if (!rem || !rem.it) return false;
      var before = JSON.stringify(S.it) + "|" + S.xp + "|" + S.start;
      S = normalize(merge(S, normalize(rem))); saveLocal();
      var changed = before !== JSON.stringify(S.it) + "|" + S.xp + "|" + S.start;
      if (changed) { if (!silent) toast("Đã cập nhật tiến độ từ máy khác"); softRefresh(); }
      return changed;
    } catch (e) { return false; }
  }
  function fbSync() {
    if (!fb.ref) return Promise.resolve();
    if (fb.busy) { fb.again = true; return Promise.resolve(); }
    if (navigator.onLine === false) { fb.status = "offline"; renderStats(); return Promise.resolve(); }
    fb.busy = true; fb.status = "syncing"; renderStats();
    return fb.ref.get().then(function (snap) {
      if (snap.exists && snap.data().data) applyRemote(snap.data().data, true);
      var body = JSON.stringify(S);
      return fb.ref.set({ data: body, upd: S.upd || Date.now(), ver: 1 }).then(function () { fb.lastSeen = S.upd || 0; return backup(body); });
    }).then(function () { fb.status = "ok"; fb.last = Date.now(); })
      .catch(function (e) { fb.status = navigator.onLine === false ? "offline" : "error"; try { console.warn("hanco sync", e && e.code); } catch (x) { } })
      .then(function () { fb.busy = false; renderStats(); if (fb.again) { fb.again = false; fbSync(); } });
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
  HC.fbRestore = function (data) { S = normalize(JSON.parse(data)); S.upd = Date.now(); saveLocal(); return fbSync(); };
  function scheduleFb() { if (!fb.ref) return; clearTimeout(fb.timer); fb.timer = setTimeout(fbSync, 4000); }
  HC.fbSignIn = function () {
    if (!fb.on) return;
    var p = new firebase.auth.GoogleAuthProvider();
    fb.auth.signInWithPopup(p).catch(function (e) {
      if (e && (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-environment" || e.code === "auth/cancelled-popup-request")) fb.auth.signInWithRedirect(p);
      else if (e && e.code !== "auth/popup-closed-by-user") toast("Chưa đăng nhập được (" + (e.code || "lỗi") + ")");
    });
  };
  HC.fbSignOut = function () { if (fb.auth) fb.auth.signOut(); };
  function fbInit() {
    if (!window.firebase || !firebase.initializeApp) return;
    try {
      var app = firebase.apps && firebase.apps.length ? firebase.app() : firebase.initializeApp(FB_CONFIG);
      fb.auth = firebase.auth(); fb.db = firebase.firestore(); fb.on = true;
    } catch (e) { return; }
    fb.status = "signedout";
    fb.auth.getRedirectResult().catch(function () { });
    fb.auth.onAuthStateChanged(function (u) {
      if (fb.unsub) { fb.unsub(); fb.unsub = null; }
      fb.user = u; fb.ref = u ? fb.db.collection("hanco_progress").doc(u.uid) : null;
      if (!u) { fb.status = "signedout"; renderStats(); softRefresh(); return; }
      fbSync().then(function () {
        // nghe thay đổi từ máy khác theo thời gian thực
        fb.unsub = fb.ref.onSnapshot(function (snap) {
          if (!snap.exists || snap.metadata.hasPendingWrites) return;
          var d = snap.data(); if (!d || !d.data || (d.upd || 0) <= fb.lastSeen) return;
          fb.lastSeen = d.upd; applyRemote(d.data, false); fb.last = Date.now(); renderStats();
        }, function () { });
        softRefresh();
      });
    });
    document.addEventListener("visibilitychange", function () {
      if (!fb.ref) return;
      if (document.visibilityState === "hidden") { clearTimeout(fb.timer); fbSync(); }
    });
    window.addEventListener("pagehide", function () { if (fb.ref) { clearTimeout(fb.timer); fbSync(); } });
    window.addEventListener("online", function () { if (fb.ref) { fbSync().then(function () { if (fb.status === "ok") toast("Có mạng trở lại: đã đồng bộ phần học lúc ngoại tuyến"); }); } else renderStats(); });
    window.addEventListener("offline", function () { if (fb.ref) { fb.status = "offline"; } renderStats(); });
  }

  function normalize(s) { var b = blank(); Object.keys(b).forEach(function (k) { if (s[k] == null) s[k] = b[k]; }); Object.keys(b.set).forEach(function (k) { if (s.set[k] == null) s.set[k] = b.set[k]; }); return s; }

  // ---------- SRS ----------
  // it[id] = [rBox, rDue, wBox, wDue, lapses, introDay]; wBox = -1 when the item has no writing card
  var INT = [0, 1, 3, 7, 14, 30, 60, 120];
  function rec(id) { return S.it[id]; }
  function introduced(id) { return !!S.it[id]; }
  function hasWrite(it) { return it.type === "c" || it.type === "w"; }
  function introduce(id, firstTryOk) {
    var it = ITEM[id], t = today();
    if (S.it[id]) return;
    S.it[id] = [firstTryOk ? 1 : 0, firstTryOk ? t + 1 : t, hasWrite(it) ? 0 : -1, t, 0, t];
    addLog("n", 1); addXP(3);
  }
  function grade(id, card, g) { // card 'r' | 'w'; g 0 quên, 1 mờ, 2 rõ
    var r = S.it[id]; if (!r) return;
    var bi = card === "w" ? 2 : 0, t = today();
    if (r[bi] < 0) return;
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
  // pool for games: learned items of a type; if too few, add the next ones in the plan so games work from day 1
  HC.pool = function (type, min) {
    var l = learnedOf(type);
    if (l.length >= min) return { items: l, preview: false };
    var q = type === "c" ? QC : type === "w" ? QW : type === "r" ? QR : QS;
    var extra = q.filter(function (x) { return !introduced(x.id); }).slice(0, min - l.length);
    return { items: l.concat(extra), preview: true };
  };
  HC.hard = function () {
    return Object.keys(S.it).filter(function (id) { return ITEM[id] && S.it[id][4] >= 2; })
      .sort(function (a, b) { return S.it[b][4] - S.it[a][4]; }).map(function (id) { return ITEM[id]; });
  };

  // ---------- XP, streak, log, badges ----------
  function addLog(k, n) { var t = today(); var l = S.log[t] || (S.log[t] = { n: 0, r: 0, x: 0 }); l[k] = (l[k] || 0) + n; }
  function addXP(n) {
    if (!n) return; S.xp += n; addLog("x", n);
    var t = today();
    if (S.streak.d !== t) { S.streak.c = (S.streak.d === t - 1) ? S.streak.c + 1 : 1; S.streak.d = t; }
  }
  HC.addXP = function (n, el) { addXP(n); if (n > 0 && el) flyXP(n, el); };
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
    { id: "exam", g: "試", t: "Thi thử ≥ 80 điểm", ok: function () { return (S.best.examHK1 || 0) >= 80 || (S.best.examHK2 || 0) >= 80; } }
  ];
  function checkBadges() {
    BADGES.forEach(function (b) { if (!S.badges[b.id] && b.ok()) { S.badges[b.id] = today(); toast("Huy hiệu mới: " + b.t); } });
  }
  HC.checkBadges = checkBadges;

  // ---------- plan (5 tuần thông dụng, rồi học tiếp phần còn lại) ----------
  var WEEKS = [
    { t: "Nền tảng + chữ hay gặp nhất", d: "8 nét, 11 quy tắc bút thuận, bộ thủ hay gặp; ~120 chữ tần suất cao nhất (có 45 chữ Phần II); bắt đầu loại từ" },
    { t: "Chữ tiếp theo + loại từ + đề K10", d: "~120 chữ; xong 5 nhóm loại từ; 20 từ và 20 cụm đã ra đề K10" },
    { t: "Từ đôi + câu đề cương HK1", d: "~120 chữ; từ đôi Phần I; câu Phần IV, VI đề cương HK1" },
    { t: "Cụm từ + câu đề cương kỳ 2", d: "~120 chữ; cụm Phần I; câu Phần III, IV đề cương kỳ 2" },
    { t: "Phần thông dụng còn lại + thi thử", d: "~114 chữ còn lại; từ còn lại; ôn tổng; thi thử HK1 và cuối kỳ 2" }
  ];
  function dayIdx() { return today() - S.start; }
  function learnDay(di) { if (di < 0) return 0; var w = Math.floor(di / 7), dow = di % 7; return w * 6 + Math.min(dow, 5) + 1; } // ngày thứ 7 mỗi tuần là ngày ôn
  function isReviewDay(di) { return di % 7 === 6; }
  function target(type, k) {
    var after = Math.max(0, k - 30);
    if (type === "c") return Math.min(D.chars.length, Math.round(COMMON_C * Math.min(k, 30) / 30) + after * S.set.newC);
    if (type === "w") return Math.min(D.words.length, Math.round(COMMON_W * Math.min(k, 30) / 30) + after * S.set.newW);
    if (type === "r") return k <= 6 ? Math.round(40 * k / 6) : Math.min(214, 40 + Math.round(174 * (k - 6) / 24));
    if (type === "s") { var n1 = 26, n2 = 29; if (k <= 12) return 0; if (k <= 18) return Math.round(n1 * (k - 12) / 6); if (k <= 24) return n1 + Math.round(n2 * (k - 18) / 6); return 55; }
    return 0;
  }
  function plan() {
    var di = dayIdx(), k = learnDay(di);
    var cnt = { c: learnedOf("c").length, w: learnedOf("w").length, r: learnedOf("r").length, s: learnedOf("s").length };
    var quota = {};
    ["c", "w", "r", "s"].forEach(function (t) { quota[t] = isReviewDay(di) ? 0 : Math.max(0, target(t, k) - cnt[t]); });
    quota.c = Math.min(quota.c, 40); quota.w = Math.min(quota.w, 34); quota.r = Math.min(quota.r, 16); quota.s = Math.min(quota.s, 10);
    var behind = Math.max(0, target("c", k) - cnt.c - (isReviewDay(di) ? 0 : Math.round(COMMON_C / 30)));
    return { di: di, k: k, week: Math.floor(di / 7), review: isReviewDay(di), cnt: cnt, quota: quota, behind: behind };
  }
  HC.plan = plan;
  function nextBatch(q, extra) {
    var p = plan(); q = q || p.quota; extra = extra || 0;
    var cs = QC.filter(function (c) { return !introduced(c.id); }).slice(0, q.c + extra);
    var known = {}; learnedOf("c").forEach(function (c) { known[c.c] = 1; }); cs.forEach(function (c) { known[c.c] = 1; });
    var wsAll = QW.filter(function (w) { return !introduced(w.id); });
    var ready = wsAll.filter(function (w) { return chars(w.w).every(function (ch) { return known[ch] || !CHAR[ch]; }); });
    var ws = ready.slice(0, q.w + Math.round(extra * 0.8));
    if (ws.length < q.w) ws = ws.concat(wsAll.filter(function (w) { return ws.indexOf(w) < 0; }).slice(0, q.w - ws.length));
    var rs = QR.filter(function (r) { return !introduced(r.id); }).slice(0, q.r);
    var ss = QS.filter(function (s) { return !introduced(s.id); }).slice(0, q.s);
    return rs.concat(cs, ws, ss);
  }

  // ---------- UI basics ----------
  var layer;
  function toast(msg) { var t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); t.textContent = msg; document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2600); }
  HC.toast = toast;
  function flyXP(n, el) {
    try { var r = el.getBoundingClientRect(); var f = document.createElement("div"); f.className = "xpfly"; f.textContent = "+" + n + " XP"; f.style.left = (r.left + r.width / 2 - 20) + "px"; f.style.top = (r.top - 6) + "px"; document.body.appendChild(f); setTimeout(function () { f.remove(); }, 900); } catch (e) { }
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

  // ---------- detail sheet ----------
  function detailHTML(it) {
    var h = '<div class="learn"><div class="top"><div class="big ' + lenCls(it.key) + '" lang="zh-Hant">' + esc(it.key) + '</div><div class="facts">';
    h += '<div class="row"><span class="chip">' + kindLabel(it) + "</span>" + (it.k10 ? '<span class="chip k10">Đề K10</span>' : "") + (it.tag || []).map(function (t) { return '<span class="chip warn">' + esc(t) + "</span>"; }).join("") + (it.n ? '<span class="chip ok num">' + it.n + " lần</span>" : "") + "</div>";
    h += '<div style="font-size:1.4rem;font-weight:700">' + esc(it.am) + "</div>" + meanHTML(it);
    if (it.type === "c") {
      var bits = [];
      if (it.v) bits.push('Dạng khác: <span class="han">' + esc(chars(it.v).join(" ")) + "</span>");
      if (it.net) bits.push(it.net + " nét");
      if (it.rad) { var r = RAD[it.rad]; bits.push('Bộ <a href="#" data-open="' + r.id + '" class="han">' + esc(r.r) + "</a> " + esc(r.am) + (r.ns ? " (" + esc(r.ns) + ")" : "")); }
      else if (it.bo) bits.push("Bộ " + esc(it.bo));
      if (bits.length) h += '<div class="muted" style="font-size:0.88rem">' + bits.join(" · ") + "</div>";
    }
    if (it.type === "r") {
      h += '<div class="muted" style="font-size:0.88rem">Bộ số ' + it.no + " · " + (it.net || "?") + " nét" + (it.vars ? ' · dạng khác: <span class="han">' + esc(chars(it.vars).join(" ")) + "</span>" : "") + "</div>";
      if (it.verse) h += '<div class="muted" style="font-size:0.88rem">Vần nhớ (bảng 214 bộ của HT. Thích Hoàn Quan): <b>' + esc(it.verse) + "</b>" + (it.note ? " — " + esc(it.note) : "") + "</div>";
    }
    if (it.type === "s") h += '<div class="muted" style="font-size:0.85rem">' + esc(it.set) + " · câu " + it.no + (it.write ? " · phần viết chữ Hán" : "") + "</div>";
    h += "</div></div>";
    if (it.type === "c") {
      var ws = (it.inw || []).map(function (id) { return ITEM[id]; }).filter(Boolean);
      if (ws.length) h += '<div><div class="facts"><span class="k">Có trong các từ</span></div><div class="minis">' + ws.map(miniHTML).join("") + "</div></div>";
      var ss = (it.ins || []).map(function (id) { return ITEM[id]; }).filter(Boolean);
      if (ss.length) h += '<div><div class="facts"><span class="k">Có trong câu</span></div>' + ss.map(function (s) { return '<div class="mini" data-open="' + s.id + '" style="margin-bottom:6px"><span class="han">' + esc(s.han) + "</span><br><small class=\"muted\">" + esc(s.pa) + "</small></div>"; }).join("") + "</div>";
    }
    if (it.type === "w") {
      var parts = chars(it.w).map(function (ch) { return CHAR[ch]; }).filter(Boolean);
      h += '<div><div class="facts"><span class="k">Từng chữ</span></div><div class="minis">' + parts.map(miniHTML).join("") + "</div></div>";
      if (it.src) h += '<div class="muted" style="font-size:0.82rem">Nguồn: ' + esc(it.src.join("; ")) + "</div>";
    }
    if (it.type === "r" && it.members.length) {
      h += '<div><div class="facts"><span class="k">Chữ thuộc bộ này (' + it.members.length + ")</span></div><div class=\"minis\">" + it.members.slice(0, 40).map(miniHTML).join("") + "</div></div>";
    }
    if (it.type === "s") h += '<div class="sent">' + rubyHTML(it) + '</div><div style="font-weight:600">' + esc(it.pa) + '</div><div>' + esc(it.dn) + "</div>";
    if (it.type === "c" || it.type === "w") {
      var fx = it.f || {};
      h += '<div class="muted" style="font-size:0.82rem">Xuất hiện: Giáo trình ' + (fx.A || 0) + " · Đề cương HK1 " + (fx.B || 0) + " · Đề cương kỳ 2 " + (fx.C || 0) + "</div>";
    }
    var r2 = S.it[it.id];
    h += '<div class="muted" style="font-size:0.82rem">' + (r2 ? "Đã học từ " + dateOf(r2[5]) + " · mức nhớ " + r2[0] + (r2[2] >= 0 ? " · mức viết " + r2[2] : "") + (r2[4] ? " · quên " + r2[4] + " lần" : "") : "Chưa học") + "</div>";
    return h + "</div>";
  }
  function miniHTML(it) { return '<span class="mini" data-open="' + it.id + '"><span class="han">' + esc(it.key) + "</span>" + esc(firstAm(it.am)) + "</span>"; }
  HC.miniHTML = miniHTML;
  function openDetail(id) { var it = ITEM[id]; if (it) modal(detailHTML(it)); }
  HC.openDetail = openDetail;
  document.addEventListener("click", function (e) { var o = e.target.closest("[data-open]"); if (o) { e.preventDefault(); openDetail(o.getAttribute("data-open")); } });

  // ruby: ghép từng chữ với âm trong phiên âm của đề cương (nếu khớp số âm tiết), không thì lấy âm từ từ điển
  function rubyHTML(s, hide) {
    var hs = chars(s.han), syl = String(s.pa).replace(/\.\.\.|…/g, " ").split(/[\s,;.:]+/).filter(Boolean);
    var hanOnly = hs.filter(isHan);
    var useSyl = syl.length === hanOnly.length, k = 0;
    return '<span class="' + (hide ? "norubies" : "") + '">' + hs.map(function (ch) {
      if (!isHan(ch)) return esc(ch);
      var am = useSyl ? syl[k++] : (CHAR[ch] ? firstAm(CHAR[ch].am) : "");
      return "<ruby>" + esc(ch) + "<rt>" + esc(String(am).toLowerCase()) + "</rt></ruby>";
    }).join("") + "</span>";
  }
  HC.rubyHTML = rubyHTML;

  // ---------- writing pad (米字格) ----------
  function makePad(box, text, opts) {
    opts = opts || {};
    var cs = chars(text).filter(isHan);
    var n = Math.max(1, cs.length), maxCols = opts.cols || 4;
    var cols = Math.min(n, maxCols), rows = Math.ceil(n / cols);
    var avail = Math.max(200, (box.clientWidth || 320) - 4);
    var cell = Math.floor(Math.min(opts.cell || 230, avail / cols));
    var dpr = window.devicePixelRatio || 1;
    var cv = document.createElement("canvas"); cv.className = "pad";
    cv.width = cols * cell * dpr; cv.height = rows * cell * dpr; cv.style.width = cols * cell + "px"; cv.style.height = rows * cell + "px";
    cv.setAttribute("aria-label", "Ô tập viết");
    box.innerHTML = ""; box.appendChild(cv);
    var ctx = cv.getContext("2d"); ctx.scale(dpr, dpr);
    var strokes = [], cur = null, showModel = false;
    var css = getComputedStyle(document.documentElement);
    function col(v) { return css.getPropertyValue(v).trim() || "#000"; }
    function draw() {
      ctx.clearRect(0, 0, cols * cell, rows * cell);
      ctx.lineWidth = 1; ctx.strokeStyle = col("--line");
      for (var i = 0; i < n; i++) {
        var x = (i % cols) * cell, y = Math.floor(i / cols) * cell;
        ctx.setLineDash([]); ctx.strokeRect(x + 0.5, y + 0.5, cell - 1, cell - 1);
        ctx.setLineDash([4, 5]); ctx.beginPath();
        ctx.moveTo(x, y + cell / 2); ctx.lineTo(x + cell, y + cell / 2); ctx.moveTo(x + cell / 2, y); ctx.lineTo(x + cell / 2, y + cell);
        ctx.moveTo(x, y); ctx.lineTo(x + cell, y + cell); ctx.moveTo(x + cell, y); ctx.lineTo(x, y + cell); ctx.stroke();
        if (showModel || opts.trace) {
          ctx.setLineDash([]); ctx.globalAlpha = showModel ? 0.38 : 0.16; ctx.fillStyle = showModel ? col("--seal") : col("--muted");
          ctx.font = Math.round(cell * 0.8) + 'px "MS Song","MSSong","SimSun","PMingLiU","Noto Serif TC",serif';
          ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(cs[i] || "", x + cell / 2, y + cell / 2 + cell * 0.03); ctx.globalAlpha = 1;
        }
      }
      ctx.setLineDash([]); ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = col("--ink"); ctx.lineWidth = Math.max(3, cell / 30);
      strokes.concat(cur ? [cur] : []).forEach(function (s) { ctx.beginPath(); s.forEach(function (p, j) { if (j) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }); if (s.length === 1) ctx.lineTo(s[0][0] + 0.1, s[0][1]); ctx.stroke(); });
    }
    function pos(e) { var r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * (cols * cell / r.width), (e.clientY - r.top) * (rows * cell / r.height)]; }
    cv.addEventListener("pointerdown", function (e) { e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (x) { } cur = [pos(e)]; draw(); });
    cv.addEventListener("pointermove", function (e) { if (!cur) return; cur.push(pos(e)); draw(); });
    function end() { if (cur) { strokes.push(cur); cur = null; draw(); } }
    cv.addEventListener("pointerup", end); cv.addEventListener("pointercancel", end); cv.addEventListener("pointerleave", end);
    if (document.fonts && document.fonts.load) { document.fonts.load(Math.round(cell * 0.8) + 'px "Noto Serif TC"', cs.join("")).then(draw, draw); }
    draw();
    return {
      clear: function () { strokes = []; draw(); },
      undo: function () { strokes.pop(); draw(); },
      model: function (v) { showModel = v == null ? !showModel : v; draw(); return showModel; },
      empty: function () { return !strokes.length; }
    };
  }
  HC.makePad = makePad;

  // ---------- multiple choice helper ----------
  function distract(it, n, field) {
    var pool = (it.type === "c" ? D.chars : it.type === "w" ? D.words : it.type === "r" ? D.rads : D.sents);
    var near = pool.filter(function (x) { return x !== it && x[field] && x[field] !== it[field] && (it.type !== "w" || chars(x.w).length === chars(it.w).length); });
    return pick(near.slice(0, 400), n);
  }
  HC.distract = distract;
  function meaningShort(it) { var m = it.ns || it.nb || ""; return m.length > 70 ? m.slice(0, 68) + "…" : m; }
  HC.meaningShort = meaningShort;

  // ---------- router ----------
  var VIEWS = [
    ["home", "Hôm nay"], ["hoc", "Học mới"], ["on", "Ôn tập"], ["viet", "Tập viết"], ["choi", "Trò chơi"],
    ["bo", "Bộ thủ"], ["loaitu", "Loại từ"], ["cau", "Câu"], ["thi", "Thi thử"], ["tra", "Tra cứu"], ["caidat", "Tiến độ & cài đặt"]
  ];
  var cleanup = null;
  function renderMenu(cur) {
    var dr = due("r").length, dw = due("w").length, q = plan().quota, nq = q.c + q.w + q.r + q.s;
    $("#menu").innerHTML = VIEWS.map(function (v) {
      var b = v[0] === "on" && dr ? dr : v[0] === "viet" && dw ? dw : v[0] === "hoc" && nq ? nq : 0;
      return '<a href="#' + v[0] + '"' + (v[0] === cur ? ' aria-current="page"' : "") + ">" + v[1] + (b ? '<span class="badge">' + (b > 99 ? "99+" : b) + "</span>" : "") + "</a>";
    }).join("");
    var a = $('#menu a[aria-current="page"]'); if (a && a.scrollIntoView) { try { a.scrollIntoView({ block: "nearest", inline: "nearest" }); } catch (e) { } }
  }
  function renderStats() {
    if (!S) return;
    var L = lvl();
    var sync = fb.on ? (fb.user ? "Đã đăng nhập Google (" + esc(fb.user.email || "") + "). Tiến độ tự lưu lên Firebase và tự đồng bộ với mọi máy bạn đăng nhập cùng tài khoản. Mỗi ngày tự sao lưu 1 bản, giữ 14 ngày." : "Chưa đăng nhập. Bấm Đăng nhập bằng Google (chỉ 1 lần trên máy này) để tự đồng bộ giữa các máy.") : remote.status === "synced" ? "Đã lưu vào tài khoản" : remote.status === "error" ? "Chưa đồng bộ được, đang lưu trên máy này" : remote.status === "full" ? "Bộ nhớ tài khoản đầy" : "Lưu trên trình duyệt này";
    var cloud = "";
    if (fb.on) {
      if (!fb.user) cloud = '<button class="pill" id="fbin" style="cursor:pointer;color:var(--seal)" title="Đăng nhập Google một lần để tự đồng bộ giữa các máy">☁ Đăng nhập</button>';
      else cloud = '<span class="pill" title="' + esc(fb.user.email || "") + '" style="color:' + (fb.status === "error" ? "var(--seal)" : fb.status === "offline" ? "var(--warn)" : "var(--good)") + '">☁ ' + (fb.status === "syncing" ? "Đang lưu…" : fb.status === "offline" ? "Ngoại tuyến · đã lưu trên máy" : fb.status === "error" ? "Chưa lưu được" : "Đã đồng bộ") + "</span>";
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
    var h = (cur || "home").split("-");
    var name = h[0]; if (!VIEWS.some(function (v) { return v[0] === name; })) name = "home";
    renderMenu(name); renderStats();
    var view = $("#view"); view.innerHTML = "";
    var fn = { home: vHome, hoc: vLearn, on: vReview, viet: vWrite, choi: vGames, bo: vRad, loaitu: vLT, cau: vSent, thi: vExam, tra: vLookup, caidat: vSettings }[name];
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
    return '<div class="prog"><div class="lab"><b>' + label + '</b><span class="num muted">' + fmt(a) + " đã học · " + fmt(b) + " nhớ · " + fmt(c) + " viết được / " + fmt(total) + '</span></div><div class="bar"><i class="a" style="width:' + w(a) + '"></i><i class="b" style="width:' + w(b) + '"></i>' + (c >= 0 ? '<i class="c" style="width:' + w(c) + '"></i>' : "") + "</div></div>";
  }
  function stat(list) {
    var a = 0, b = 0, c = 0;
    list.forEach(function (x) { var r = S.it[x.id]; if (r) { a++; if (r[0] >= 3) b++; if (r[2] >= 3) c++; } });
    return [a, b, c];
  }
  function vHome(v) {
    var p = plan(), q = p.quota, dr = due("r").length, dw = due("w").length, L = lvl();
    var wk = Math.min(p.week, 5), inPlan = p.di < 35;
    var h = '<div class="grid">';
    if (fb.on && !fb.user) h += '<div class="card" style="border-color:var(--seal)"><div class="row"><div style="flex:1;min-width:220px"><h2 style="margin:0">Đăng nhập Google để tự đồng bộ</h2><p class="sub" style="margin:0">Chỉ cần làm 1 lần trên máy này. Sau đó tiến độ tự lưu và tự đồng bộ với mọi máy khác của bạn.</p></div><button class="btn primary" id="fbin2">Đăng nhập bằng Google</button></div></div>';
    h += '<div class="card hero"><div class="row"><div><h1>' + (inPlan ? "Tuần " + (wk + 1) + "/5 · ngày " + (p.di % 7 + 1) + "/7" : "Sau lộ trình 5 tuần: học tiếp phần còn lại") + '</h1><p class="sub">' + (inPlan ? esc(WEEKS[wk].t) + " — " + esc(WEEKS[wk].d) : "Mỗi ngày " + S.set.newC + " chữ và " + S.set.newW + " từ mới cho tới khi học hết 1.222 chữ và 733 từ.") + "</p></div></div>";
    h += '<div class="weeks">' + WEEKS.map(function (w, i) { return '<div class="' + (i === wk && inPlan ? "now" : i < wk ? "done" : "") + '"><b>Tuần ' + (i + 1) + "</b>" + esc(w.t) + "</div>"; }).join("") + "</div>";
    if (p.behind > 0) h += '<p class="chip warn">Bạn đang chậm khoảng ' + p.behind + " chữ so với kế hoạch. App đã dồn phần còn thiếu vào hôm nay.</p>";
    h += "</div>";
    // tasks
    h += '<div class="card"><h2>Việc hôm nay</h2>';
    var nq = q.c + q.w + q.r + q.s;
    h += task("新", "", "Học mới", p.review ? "Hôm nay là ngày ôn: không có bài mới. Muốn học trước thì bấm Học thêm." : nq ? [q.c && q.c + " chữ", q.w && q.w + " từ", q.r && q.r + " bộ thủ", q.s && q.s + " câu"].filter(Boolean).join(" · ") : "Đã xong phần mới của hôm nay.", nq ? '<a class="btn primary" href="#hoc">Bắt đầu</a>' : '<a class="btn" href="#hoc">Học thêm</a>');
    h += task("溫", "green", "Ôn thẻ đến hạn", dr ? dr + " thẻ cần ôn" : "Không có thẻ đến hạn", dr ? '<a class="btn primary" href="#on">Ôn ngay</a>' : '<a class="btn" href="#choi">Chơi trò ôn</a>');
    h += task("筆", "amber", "Tập viết", dw ? dw + " chữ / từ cần viết lại" : "Không có chữ cần viết hôm nay", '<a class="btn' + (dw ? " primary" : "") + '" href="#viet">Viết</a>');
    if (p.review) h += task("試", "red", "Đấu cuối tuần", "Ngày thứ 7 của tuần: làm bài thi ngắn trên những gì đã học", '<a class="btn primary" href="#choi-weekly">Vào đấu</a>');
    else h += task("戲", "red", "Trò chơi ôn tập", "10 trò chơi dùng đúng những chữ bạn đã học", '<a class="btn" href="#choi">Chơi</a>');
    h += "</div>";
    // progress
    var cc = QC.slice(0, COMMON_C), ww = QW.slice(0, COMMON_W);
    var s1 = stat(cc), s2 = stat(D.chars), s3 = stat(ww), s4 = stat(D.words), s5 = stat(D.rads), s6 = stat(D.sents);
    h += '<div class="cols2"><div class="card"><h2>Tiến độ</h2><div class="legend"><span style="--k:color-mix(in srgb, var(--accent) 35%, transparent)">đã học</span><span style="--k:var(--accent)">nhớ (ôn đúng ≥ 3 lần)</span><span style="--k:var(--good)">viết được</span></div>';
    h += bars("Chữ thông dụng", COMMON_C, s1[0], s1[1], s1[2]) + bars("Từ thông dụng", COMMON_W, s3[0], s3[1], s3[2]) + bars("Toàn bộ chữ", D.chars.length, s2[0], s2[1], s2[2]) + bars("Toàn bộ từ", D.words.length, s4[0], s4[1], s4[2]) + bars("214 bộ thủ", 214, s5[0], s5[1], -1) + bars("55 câu đề cương", 55, s6[0], s6[1], -1);
    h += "</div>";
    h += '<div class="card"><h2>Cấp ' + L.l + ' · ' + fmt(S.xp) + ' XP</h2><div class="bar" aria-label="Kinh nghiệm"><i class="b" style="width:' + Math.round(100 * L.cur / L.need) + '%"></i></div><p class="sub" style="margin-top:6px">Còn ' + (L.need - L.cur) + " XP để lên cấp " + (L.l + 1) + ". Chuỗi ngày học: " + (S.streak.d >= today() - 1 ? S.streak.c : 0) + " ngày.</p>";
    h += '<h3>Huy hiệu</h3><div class="badges">' + BADGES.map(function (b) { return '<div class="bdg' + (S.badges[b.id] ? " on" : "") + '"><div class="m">' + b.g + "</div>" + esc(b.t) + "</div>"; }).join("") + "</div>";
    var hard = HC.hard().slice(0, 12);
    h += '<h3>Chữ khó của tôi</h3>' + (hard.length ? '<div class="minis">' + hard.map(miniHTML).join("") + '</div><p style="margin-top:8px"><a class="btn sm" href="#on-kho">Ôn riêng chữ khó</a></p>' : '<p class="sub">Chưa có. Chữ nào bạn quên từ 2 lần trở lên sẽ tự vào đây.</p>');
    h += "</div></div></div>";
    v.innerHTML = h;
    var b2 = $("#fbin2", v); if (b2) b2.onclick = HC.fbSignIn;
  }
  function task(ic, cls, title, sub, btn) { return '<div class="task"><div class="ic ' + cls + '" aria-hidden="true">' + ic + "</div><div><b>" + esc(title) + "</b><small>" + esc(sub) + "</small></div><div>" + btn + "</div></div>"; }

  // ---------- LEARN (học mới) ----------
  function vLearn(v) {
    var p = plan(), batch = nextBatch();
    if (!batch.length) {
      v.innerHTML = '<div class="card"><h1>Học mới</h1><p class="sub">' + (p.review ? "Hôm nay là ngày ôn của tuần nên không có bài mới." : "Bạn đã học xong phần mới của hôm nay.") + ' Bạn có thể học trước bài của ngày mai.</p><div class="row"><button class="btn primary" id="more">Học thêm 10 chữ</button><a class="btn" href="#on">Ôn tập</a><a class="btn" href="#choi">Trò chơi</a></div></div>';
      $("#more", v).onclick = function () { runLearn(v, nextBatch({ c: 10, w: 8, r: 0, s: 0 })); };
      return;
    }
    runLearn(v, batch);
  }
  function runLearn(v, batch) {
    var chunks = []; for (var i = 0; i < batch.length; i += 5) chunks.push(batch.slice(i, i + 5));
    var ci = 0, ii = 0, phase = "see", quiz = [], qi = 0, firstOk = {}, total = batch.length, doneCount = 0;
    function head() { return '<div class="row noprint" style="margin-bottom:10px"><span class="chip num">' + doneCount + "/" + total + ' mục</span><span class="muted" style="font-size:0.85rem">' + (phase === "see" ? "Bước 1: đọc kỹ chữ, âm, nghĩa" : "Bước 2: kiểm tra nhanh 5 mục vừa học") + '</span><span class="spacer"></span><a class="btn sm ghost" href="#home">Dừng</a></div>'; }
    function see() {
      var it = chunks[ci][ii];
      v.innerHTML = head() + '<div class="stage"><div class="card" style="width:min(680px,100%)">' + detailHTML(it) + '</div><div class="row"><button class="btn" id="prev"' + (ii ? "" : " disabled") + '>Trước</button><button class="btn primary" id="next">' + (ii < chunks[ci].length - 1 ? "Tiếp" : "Kiểm tra 5 mục này") + '</button></div><div class="kbd">Phím → hoặc Enter để tiếp</div></div>';
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
    function done() {
      v.innerHTML = '<div class="card result"><div class="score-big">+' + total + '</div><h2>Xong bài học mới hôm nay</h2><p class="sub">Các chữ vừa học đã vào lịch ôn. Chữ và từ cũng đã có trong mục Tập viết.</p><div class="row" style="justify-content:center"><a class="btn primary" href="#viet">Tập viết ngay</a><a class="btn" href="#choi">Chơi trò ôn</a><a class="btn" href="#home">Về trang chính</a></div></div>';
    }
    function key(e) { if (phase === "see" && (e.key === "ArrowRight" || e.key === "Enter") && !e.target.closest("input,textarea")) { e.preventDefault(); nextSee(); } }
    document.addEventListener("keydown", key);
    see();
    return function () { document.removeEventListener("keydown", key); };
  }

  // ---------- REVIEW (ôn thẻ) ----------
  function vReview(v, args) {
    var mode = args[0] === "kho" ? "kho" : "due";
    var ids = mode === "kho" ? HC.hard().map(function (x) { return x.id; }).slice(0, 40) : due("r").slice(0, 120);
    if (!ids.length) {
      v.innerHTML = '<div class="card"><h1>Ôn tập</h1><p class="sub">' + (mode === "kho" ? "Chưa có chữ khó." : "Không còn thẻ đến hạn hôm nay. Thẻ sẽ tự quay lại đúng ngày cần ôn.") + '</p><div class="row"><a class="btn primary" href="#choi">Chơi trò ôn</a><a class="btn" href="#hoc">Học mới</a></div></div>';
      return;
    }
    var queue = ids.slice(), i = 0, shown = false, done = 0, again = {};
    function render() {
      var it = ITEM[queue[i]];
      v.innerHTML = '<div class="row" style="margin-bottom:10px"><h1 style="margin:0">' + (mode === "kho" ? "Ôn chữ khó" : "Ôn thẻ") + '</h1><span class="spacer"></span><span class="chip num">' + done + " / " + ids.length + '</span></div><div class="stage"><div class="fc" id="card"><span class="kind">' + kindLabel(it) + '</span><div class="big ' + lenCls(it.key) + '">' + (it.type === "s" ? rubyHTML(it, true) : esc(it.key)) + '</div><div class="ans' + (shown ? "" : " hide") + '"><div class="am">' + esc(it.type === "s" ? it.pa : it.am) + "</div>" + (it.type === "s" ? '<div class="ns">' + esc(it.dn) + "</div>" : meanHTML(it)) + extraLine(it) + "</div></div>" +
        (shown ? '<div class="grades"><button class="btn bad" data-g="0">Quên<small>hỏi lại sớm</small></button><button class="btn warn" data-g="1">Nhớ mờ<small>ngày mai</small></button><button class="btn good" data-g="2">Nhớ rõ<small>' + nextGap(it.id) + "</small></button></div>" : '<button class="btn primary" id="show" style="min-width:200px">Xem đáp án</button>') +
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
      if (e.target.closest("input,textarea")) return;
      if (!shown && (e.key === " " || e.key === "Enter")) { e.preventDefault(); shown = true; render(); }
      else if (shown && /^[123]$/.test(e.key)) { var b = $('[data-g="' + (+e.key - 1) + '"]', v); if (b) b.click(); }
    }
    document.addEventListener("keydown", key);
    render();
    return function () { document.removeEventListener("keydown", key); };
  }
  function extraLine(it) {
    if (it.type === "c" && it.rad) { var r = RAD[it.rad]; return '<div class="extra">Bộ <span class="han">' + esc(r.r) + "</span> " + esc(r.am) + (it.net ? " · " + it.net + " nét" : "") + "</div>"; }
    if (it.type === "w") return '<div class="extra">' + chars(it.w).map(function (ch) { var c = CHAR[ch]; return '<span class="han">' + esc(ch) + "</span> " + esc(c ? firstAm(c.am) : ""); }).join(" · ") + "</div>";
    if (it.type === "r" && it.verse) return '<div class="extra">' + esc(it.verse) + " · " + (it.net || "") + " nét</div>";
    return "";
  }
  HC.extraLine = extraLine;

  // ---------- WRITE (tập viết) ----------
  function vWrite(v, args) {
    var tab = args[0] || "due";
    var tabs = '<div class="row" style="margin-bottom:12px"><h1 style="margin:0">Tập viết</h1><span class="spacer"></span><a class="btn sm' + (tab === "due" ? " primary" : "") + '" href="#viet">Viết theo lịch</a><a class="btn sm' + (tab === "phieu" ? " primary" : "") + '" href="#viet-phieu">Phiếu in</a><a class="btn sm' + (tab === "net" ? " primary" : "") + '" href="#viet-net">Nét &amp; bút thuận</a></div>';
    if (tab === "net") { v.innerHTML = tabs + strokeLesson(); return; }
    if (tab === "phieu") return sheet(v, tabs);
    var ids = due("w").slice(0, 30);
    if (!ids.length) { v.innerHTML = tabs + '<div class="card"><p class="sub">Không có chữ cần viết hôm nay. Học thêm chữ mới, hoặc luyện tự do với trò "Viết trên màn hình".</p><div class="row"><a class="btn primary" href="#choi-write">Viết tự do</a><a class="btn" href="#hoc">Học mới</a></div></div>'; return; }
    return writeSession(v, tabs, ids.map(function (id) { return ITEM[id]; }), true);
  }
  function writeSession(v, tabs, items, srs, onEnd) {
    var i = 0, ok = 0, pad = null, again = {}, queue = items.slice();
    function render() {
      var it = queue[i];
      v.innerHTML = tabs + '<div class="stage"><div class="row" style="width:min(560px,100%)"><span class="chip num">' + (i + 1) + " / " + queue.length + '</span><span class="muted" style="font-size:0.85rem">Viết chữ Hán theo âm và nghĩa, rồi bấm Xem chữ mẫu để tự so</span></div><div class="fc" style="min-height:auto"><div class="ans"><div class="am">' + esc(it.am) + "</div>" + meanHTML(it) + '<div class="extra">' + chars(it.key).length + " chữ" + (it.type === "c" && it.net ? " · " + it.net + " nét" : "") + (it.type === "c" && it.rad ? ' · <button class="btn sm ghost" id="hint">Gợi ý bộ</button>' : "") + '</div></div></div><div class="padwrap" id="padbox"></div><div class="row" style="justify-content:center"><button class="btn" id="undo">Xóa nét cuối</button><button class="btn" id="clr">Xóa hết</button><button class="btn primary" id="model">Xem chữ mẫu</button></div><div class="row hide" id="gr" style="justify-content:center"><button class="btn bad" id="bad">Viết sai</button><button class="btn good" id="good">Viết đúng</button></div></div>';
      pad = makePad($("#padbox", v), it.key);
      $("#undo", v).onclick = pad.undo; $("#clr", v).onclick = pad.clear;
      $("#model", v).onclick = function () { var on = pad.model(); this.textContent = on ? "Ẩn chữ mẫu" : "Xem chữ mẫu"; $("#gr", v).classList.remove("hide"); };
      var hb = $("#hint", v); if (hb) hb.onclick = function () { var r = RAD[it.rad]; hb.outerHTML = 'Bộ <span class="han">' + esc(r.r) + "</span> " + esc(r.am); };
      $("#bad", v).onclick = function () { mark(false, this); }; $("#good", v).onclick = function () { mark(true, this); };
    }
    function mark(good, el) {
      var it = queue[i];
      if (srs && !again[it.id]) grade(it.id, "w", good ? 2 : 0);
      if (good) { ok++; S.best.writeOk = (S.best.writeOk || 0) + 1; flyXP(2, el); beep(true); } else { again[it.id] = 1; queue.push(it); beep(false); }
      HC.after(); i++;
      if (i < queue.length) render(); else end();
    }
    function end() {
      if (onEnd) return onEnd(ok, items.length);
      v.innerHTML = tabs + '<div class="card result"><div class="score-big">' + ok + '</div><h2>Xong phần tập viết</h2><p class="sub">Viết tay ra giấy nữa sẽ nhớ lâu hơn: vào mục Phiếu in để tải phiếu kẻ ô.</p><div class="row" style="justify-content:center"><a class="btn primary" href="#viet-phieu">Phiếu in</a><a class="btn" href="#home">Trang chính</a></div></div>';
    }
    render();
  }
  HC.writeSession = writeSession;
  function strokeLesson() {
    var N = [["Ngang (hoành)", "横", "viết từ trái sang phải", "一 二 三 十 大 干 天 夫 王"], ["Sổ (thụ)", "豎", "viết từ trên xuống dưới", "中 川 十"], ["Phẩy (phiết)", "撇", "từ trên phải xuống trái dưới", "人 八 入 大 才 千 午 又 水"], ["Mác (nại)", "捺", "từ trên-trái xuống phải-dưới", "人 八 入 又 木"], ["Chấm (điểm)", "點", "từ trên xuống dưới phải hoặc trái", "主 玉 六 之 不 文 太 犬"], ["Hất (thiêu)", "挑", "từ dưới-trái lên trên-phải", "扌 地 汗 計"], ["Móc (câu)", "勾", "sổ câu, hoành câu, tà câu, loan câu, bình câu", "小 字 戈 我 狗 家 心"], ["Gập (chiết)", "折", "ngang gập, ngang gập móc, sổ gập…", "口 囗 己 已 巳 門 月 母 風"]];
    var R = [["Ngang trước sổ sau", "十 干 豐 共 土 士"], ["Phẩy trước mác sau", "人 入 八 父 交 天"], ["Trái trước phải sau", "佛 法 僧 明 行 仁"], ["Trên trước dưới sau", "二 三 六 旦 青 立 言 念"], ["Ngang trước phẩy sau", "左 右 不 大 夫 友"], ["Giữa trước hai bên sau", "小 塵 水 木 尖 永"], ["Ngoài trước trong sau", "周 風 問 同 月 用 閒"], ["Vào trước đóng sau", "田 日 曰 目 因 四"], ["Nét ngang đáy", "全 工 王 土 士 壬"], ["Bộ quai xước", "道 邊 達 進 遠 返 近 建"], ["Các chữ ngoại lệ", "學 覺 刀 力 忄 火"]];
    return '<div class="cols2"><div class="card"><h2>8 nét cơ bản</h2><p class="sub">Theo giáo trình HK1. Chữ <span class="han">永</span> (vĩnh) chứa đủ tám nét nên người xưa thường lấy để luyện tập.</p><table class="t"><tbody>' + N.map(function (n) { return '<tr><td><b>' + n[0] + ' <span class="han">' + n[1] + '</span></b><br><small class="muted">' + n[2] + '</small></td><td class="han" style="font-size:1.4rem">' + n[3] + "</td></tr>"; }).join("") + '</tbody></table></div><div class="card"><h2>11 quy tắc bút thuận</h2><table class="t"><tbody>' + R.map(function (r, i) { return "<tr><td><b>" + (i + 1) + ". " + r[0] + '</b></td><td class="han" style="font-size:1.4rem">' + r[1] + "</td></tr>"; }).join("") + '</tbody></table><p class="sub" style="margin-top:8px">Giáo trình ghi: nét phẩy viết trước trong 九, 及; viết sau trong 力, 刀.</p></div></div>';
  }
  function sheet(v, tabs) {
    var learned = learnedOf("c").concat(learnedOf("w"));
    var p = plan();
    v.innerHTML = tabs + '<div class="card"><h2>Phiếu tập viết</h2><p class="sub">Mỗi dòng có 3 ô chữ mờ để tô và 7 ô trống kẻ chữ 米. Tải phiếu về, mở rồi bấm Ctrl+P để in.</p><div class="row"><div class="field"><label for="ps">Chọn chữ</label><select id="ps"><option value="today">Chữ / từ học hôm nay</option><option value="hard">Chữ khó của tôi</option><option value="learned">Tất cả chữ đã học</option><option value="next">20 chữ sắp học</option><option value="common">Toàn bộ 594 chữ thông dụng</option></select></div><button class="btn primary" id="pdl" style="align-self:end">Tải phiếu (.html)</button></div><div id="pprev" style="margin-top:12px"></div></div>';
    function items() {
      var s = $("#ps", v).value, t = today();
      if (s === "today") return learned.filter(function (x) { return S.it[x.id][5] === t; });
      if (s === "hard") return HC.hard().filter(function (x) { return x.type === "c" || x.type === "w"; });
      if (s === "learned") return learnedOf("c");
      if (s === "next") return QC.filter(function (c) { return !introduced(c.id); }).slice(0, 20);
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
  function vLT(v) {
    var G = D.loaitu, names = Object.keys(G);
    var h = '<h1>Loại từ</h1><p class="sub">Đề cương HK1 hỏi 3 loại (Số từ, Phương vị từ, Phó từ); đề cương kỳ 2 hỏi 5 loại. Cách làm bài theo đề cương: ① gạch chữ đề bài hỏi; ② nhớ mặt chữ thuộc loại nào; ③ khoanh đáp án. Không cần dịch hết câu.</p><div class="row" style="margin:10px 0 14px"><a class="btn primary" href="#choi-basket">Luyện như đề thi: Năm rổ loại từ</a></div><div class="cols2">';
    names.forEach(function (g) {
      h += '<div class="card ltgroup"><h2>' + esc(g) + ' <span class="muted num" style="font-weight:500;font-size:0.9rem">(' + G[g].length + ")</span></h2><div class=\"chars\">" + G[g].map(function (x) { var it = chars(x).length > 1 ? WORD[x] : CHAR[x]; return it ? miniHTML(it) : '<span class="mini"><span class="han">' + esc(x) + "</span></span>"; }).join("") + "</div></div>";
    });
    h += '</div><div class="card" style="margin-top:14px"><h2>Ví dụ trong đề K10</h2><p><span class="han" style="font-size:1.4rem">在家<span style="color:var(--seal);border-bottom:2px solid var(--seal)">中</span>孝父母。</span> — chữ <span class="han">中</span> thuộc loại từ nào? A. Số từ · <b>B. Phương vị từ</b> · C. Phó từ. Có thể nhìn thêm vị trí: <span class="han">中</span> đứng sau <span class="han">家</span>, theo mẫu “danh từ + nơi chốn”.</p><p class="sub">Phạm vi kỳ 2: chỉ chọn Liên từ, Lượng từ, Phó từ, Số từ và Phương vị từ; không chọn Giới từ, Trợ từ hoặc Tính từ.</p></div>';
    v.innerHTML = h;
  }

  // ---------- CÂU ----------
  function vSent(v, args) {
    if (args[0]) return sentPractice(v, ITEM[args[0]]);
    var sets = {}; D.sents.forEach(function (s) { (sets[s.set] = sets[s.set] || []).push(s); });
    var h = '<h1>Câu trong đề cương</h1><p class="sub">55 câu. Mỗi câu luyện 4 bước: đọc có phiên âm từng chữ → tự đọc phiên âm → tự dịch → viết lại chữ Hán. Câu được đưa dần vào Học mới ở tuần 3 (đề cương HK1) và tuần 4 (đề cương kỳ 2), nhưng bạn có thể luyện trước bất cứ lúc nào.</p><div class="grid">';
    Object.keys(sets).forEach(function (k) {
      h += '<div class="card"><h2>' + esc(k) + "</h2>" + sets[k].map(function (s) { var r = S.it[s.id]; return '<a class="li" href="#cau-' + s.id + '" style="text-decoration:none;color:inherit"><span class="chip num" style="justify-self:center">' + s.no + '</span><span class="t"><b class="han" style="font-size:1.15rem">' + esc(s.han) + "</b><span>" + esc(s.pa) + '</span></span><span>' + (s.k10 ? '<span class="chip k10">Đề K10</span> ' : "") + (r ? '<span class="chip ok">đã học</span>' : "") + "</span></a>"; }).join("") + "</div>";
    });
    v.innerHTML = h + "</div>";
  }
  function sentPractice(v, s) {
    var step = 0, pad;
    var steps = ["Đọc có phiên âm", "Tự đọc phiên âm", "Tự dịch nghĩa", "Viết chữ Hán"];
    function render(show) {
      var h = '<div class="row" style="margin-bottom:10px"><a class="btn sm ghost" href="#cau">← Danh sách câu</a><span class="muted" style="font-size:0.85rem">' + esc(s.set) + " · câu " + s.no + '</span></div><div class="row" style="margin-bottom:12px">' + steps.map(function (t, i) { return '<button class="btn sm' + (i === step ? " primary" : "") + '" data-step="' + i + '">' + (i + 1) + ". " + t + "</button>"; }).join("") + '</div><div class="card"><div class="stage">';
      if (step === 0) h += '<div class="sent">' + rubyHTML(s) + '</div><div style="font-weight:600">' + esc(s.pa) + "</div><div>" + esc(s.dn) + '</div><p class="sub">Bấm vào từng chữ ở mục Tra cứu nếu muốn xem nghĩa riêng.</p>';
      if (step === 1) h += '<div class="sent">' + rubyHTML(s, !show) + '</div><div class="' + (show ? "" : "hide") + '" style="font-weight:600">' + esc(s.pa) + "</div>";
      if (step === 2) h += '<div class="sent">' + esc(s.han) + '</div><div style="font-weight:600">' + esc(s.pa) + '</div><div class="' + (show ? "" : "hide") + '">' + esc(s.dn) + "</div>";
      if (step === 3) h += '<div style="font-weight:700;font-size:1.1rem;text-align:center">' + esc(s.pa) + '</div><div class="muted" style="text-align:center">' + esc(s.dn) + '</div><div class="padwrap" id="padbox"></div><div class="sent ' + (show ? "" : "hide") + '">' + esc(s.han) + "</div>";
      h += '<div class="row" style="justify-content:center">' + (step === 0 ? "" : '<button class="btn primary" id="rev">' + (show ? "Ẩn đáp án" : "Xem đáp án") + "</button>") + (step === 3 ? '<button class="btn" id="clr">Xóa hết</button><button class="btn" id="mdl">Hiện chữ mờ</button>' : "") + (step < 3 ? '<button class="btn" id="nx">Bước tiếp →</button>' : '<button class="btn good" id="fin">Xong câu này</button>') + "</div></div></div>";
      v.innerHTML = h;
      $$("[data-step]", v).forEach(function (b) { b.onclick = function () { step = +b.getAttribute("data-step"); render(false); }; });
      var r = $("#rev", v); if (r) r.onclick = function () { render(!show); };
      var nx = $("#nx", v); if (nx) nx.onclick = function () { step++; render(false); };
      if (step === 3) { pad = makePad($("#padbox", v), s.han, { cols: 6, cell: 74 }); $("#clr", v).onclick = pad.clear; $("#mdl", v).onclick = function () { pad.model(); }; }
      var fin = $("#fin", v); if (fin) fin.onclick = function () { if (!introduced(s.id)) introduce(s.id, true); else grade(s.id, "r", 2); HC.addXP(5, fin); HC.after(); toast("Đã lưu: câu " + s.no); HC.go("cau"); };
    }
    render(false);
  }

  // ---------- LOOKUP ----------
  function vLookup(v) {
    v.innerHTML = '<h1>Tra cứu</h1><p class="sub">Tìm theo chữ Hán, âm (gõ không dấu cũng được) hoặc nghĩa. Danh sách xếp theo số lần xuất hiện trong 3 file.</p><div class="row" style="margin:10px 0"><input type="search" id="q" placeholder="Ví dụ: 道, dao, con đường…" aria-label="Tìm"><select id="qt" aria-label="Loại"><option value="c">Chữ lẻ (1.222)</option><option value="w">Từ (733)</option><option value="all">Cả hai</option></select></div><div class="card"><div class="list" id="res"></div></div>';
    function run() {
      var q = $("#q", v).value.trim(), qf = fold(q), t = $("#qt", v).value;
      var src = t === "c" ? D.chars : t === "w" ? D.words : D.chars.concat(D.words);
      var res = src.filter(function (x) { if (!q) return true; return x.key.indexOf(q) >= 0 || fold(x.am).indexOf(qf) >= 0 || fold(x.ns).indexOf(qf) >= 0 || fold(x.nb).indexOf(qf) >= 0 || (x.v || "").indexOf(q) >= 0; });
      if (t === "all") res.sort(function (a, b) { return b.n - a.n; });
      $("#res", v).innerHTML = res.slice(0, 150).map(function (x) { return '<button class="li" data-open="' + x.id + '"><span class="g ' + lenCls(x.key) + '">' + esc(x.key) + '</span><span class="t"><b>' + esc(x.am) + "</b><span>" + esc(meaningShort(x)) + '</span></span><span class="chip num">' + x.n + " lần</span></button>"; }).join("") + (res.length > 150 ? '<p class="sub" style="padding:8px">… còn ' + (res.length - 150) + " kết quả, hãy gõ cụ thể hơn.</p>" : res.length ? "" : '<p class="sub">Không tìm thấy.</p>');
    }
    var t = null; $("#q", v).oninput = function () { clearTimeout(t); t = setTimeout(run, 120); }; $("#qt", v).onchange = run; run();
  }

  // ---------- SETTINGS ----------
  function vSettings(v) {
    var p = plan();
    var sync = remote.status === "synced" ? "Tiến độ đang được lưu vào tài khoản Claude của bạn, nên mở app trên máy tính hay điện thoại (cùng tài khoản) đều thấy cùng tiến độ." : remote.status === "error" ? "Chưa lưu được lên tài khoản lúc này; tiến độ vẫn được giữ trên trình duyệt này và sẽ thử lưu lại." : "Tiến độ đang lưu trên trình duyệt này. Hãy sao lưu thường xuyên bằng mã bên dưới.";
    var last = Object.keys(S.log).map(Number).sort(function (a, b) { return b - a; }).slice(0, 14);
    v.innerHTML = '<h1>Tiến độ &amp; cài đặt</h1><div class="cols2"><div class="card"><h2>Lưu tiến độ</h2><p class="sub">' + sync + '</p>' + (fb.on ? '<div class="row" style="margin:8px 0">' + (fb.user ? '<button class="btn" id="fbnow">Đồng bộ ngay</button><button class="btn" id="fbbk">Xem bản sao lưu</button><button class="btn ghost" id="fbout">Đăng xuất</button>' : '<button class="btn primary" id="fbin3">Đăng nhập bằng Google</button>') + '</div><div id="bklist"></div>' : "") + '<h3>Sao lưu thủ công bằng mã</h3><p class="sub">Bấm Sao chép để lấy mã tiến độ. Ở máy khác, dán mã vào ô rồi bấm Khôi phục.</p><textarea id="bk" aria-label="Mã sao lưu"></textarea><div class="row" style="margin-top:8px"><button class="btn" id="cp">Sao chép mã</button><button class="btn" id="im">Khôi phục từ mã đã dán</button></div></div>' +
      '<div class="card"><h2>Kế hoạch</h2><p class="sub">Bắt đầu ngày ' + dateOf(S.start) + " · hôm nay là ngày " + (p.di + 1) + " · ngày học thứ " + p.k + ' (tính 6 ngày học + 1 ngày ôn mỗi tuần).</p><div class="row"><div class="field"><label for="nc">Chữ mới / ngày sau 5 tuần</label><input id="nc" type="number" min="5" max="60" value="' + S.set.newC + '"></div><div class="field"><label for="nw">Từ mới / ngày sau 5 tuần</label><input id="nw" type="number" min="5" max="60" value="' + S.set.newW + '"></div></div><label class="row" style="margin-top:10px"><input type="checkbox" id="snd"' + (S.set.sound ? " checked" : "") + '> Âm thanh khi trả lời đúng / sai</label><div class="row" style="margin-top:12px"><button class="btn" id="restart">Tính lại lịch từ hôm nay</button></div><p class="sub" style="margin-top:6px">Tính lại lịch giữ nguyên chữ đã học, chỉ dời ngày bắt đầu của lộ trình 5 tuần về hôm nay.</p></div>' +
      '<div class="card"><h2>14 ngày gần nhất</h2><table class="t"><thead><tr><th>Ngày</th><th>Học mới</th><th>Lượt ôn</th><th>XP</th></tr></thead><tbody>' + (last.length ? last.map(function (d) { var l = S.log[d]; return "<tr><td>" + dateOf(d) + '</td><td class="num">' + (l.n || 0) + '</td><td class="num">' + (l.r || 0) + '</td><td class="num">' + (l.x || 0) + "</td></tr>"; }).join("") : '<tr><td colspan="4" class="muted">Chưa có buổi học nào.</td></tr>') + '</tbody></table></div>' +
      '<div class="card"><h2>Kỷ lục trò chơi</h2><table class="t"><tbody>' + HC.games.map(function (g) { return "<tr><td>" + esc(g.name) + '</td><td class="num">' + (S.best[g.id] != null ? S.best[g.id] : "—") + "</td></tr>"; }).join("") + '</tbody></table><h3>Xóa toàn bộ tiến độ</h3><div id="rz"><button class="btn bad" id="reset">Xóa và học lại từ đầu</button></div></div></div>';
    var e1 = $("#fbin3", v); if (e1) e1.onclick = HC.fbSignIn;
    var e2 = $("#fbnow", v); if (e2) e2.onclick = function () { fbSync().then(function () { toast(fb.status === "ok" ? "Đã đồng bộ" : "Chưa đồng bộ được, kiểm tra mạng"); }); };
    var e3 = $("#fbout", v); if (e3) e3.onclick = function () { HC.fbSignOut(); toast("Đã đăng xuất trên máy này"); };
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
    $("#nc", v).onchange = function () { S.set.newC = Math.max(5, Math.min(60, +this.value || 20)); save(); };
    $("#nw", v).onchange = function () { S.set.newW = Math.max(5, Math.min(60, +this.value || 17)); save(); };
    $("#snd", v).onchange = function () { S.set.sound = this.checked; save(); };
    $("#restart", v).onclick = function () { S.start = today(); save(); toast("Lộ trình bắt đầu lại từ hôm nay"); route(); };
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
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else setTimeout(boot, 0);
})();
