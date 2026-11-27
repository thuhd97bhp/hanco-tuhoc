/* Hán cổ tự học — 10 trò chơi ôn tập và thi thử theo cấu trúc đề K10 */
(function () {
  "use strict";
  var HC = window.HC = window.HC || {};
  HC.games = HC.games || [];
  function U() { return HC.u; }
  function esc(s) { return U().esc(s); }

  // ---------- shared game shell ----------
  function head(g, preview) {
    return '<div class="ghead"><a class="btn sm ghost" href="' + (g.back || "#choi") + '">' + esc(g.backLabel || "← Trò chơi") + '</a><h1 style="margin:0;font-size:1.25rem">' + esc(g.name) + '</h1><div class="score"><span class="pill num" id="gs">Điểm 0</span><span class="pill num" id="gt"></span></div></div>' +
      (preview ? '<p class="chip warn" style="margin-bottom:10px">Bạn mới học ít chữ nên trò chơi lấy thêm vài chữ sắp học.</p>' : "");
  }
  // trò chơi chỉ dùng mục đã học: chưa đủ thì khóa, mời học thêm
  function lock(v, g, msg) {
    v.innerHTML = head(g) + '<div class="card"><p>' + esc(msg) + '</p><p class="sub">Trò chơi chỉ dùng chữ, từ, câu bạn đã học.</p><div class="row"><a class="btn primary" href="#hoc">Học mới</a><a class="btn" href="#choi">Trò khác</a></div></div>';
  }
  // tóm tắt ghi nhận của lượt chơi: mục nhớ / mục sai (sai = chưa thuộc, sẽ ôn lại sớm)
  function recHTML(rec) {
    if (!rec || (!rec.good_.length && !rec.bad_.length)) return "";
    var badIds = {}; rec.bad_.forEach(function (it) { badIds[it.id] = 1; });
    var good = rec.good_.filter(function (it) { return !badIds[it.id]; }).length;
    return '<p class="sub">Nhớ: ' + good + " mục" + (rec.bad_.length ? " · Sai: " + rec.bad_.length + (rec.kho ? " mục — lần sau được hỏi trước (không đổi lịch ôn):" : " mục — đã đánh dấu chưa thuộc, sẽ ôn lại sớm (muộn nhất ngày mai):") : "") + "</p>" +
      (rec.bad_.length ? '<div class="minis" style="justify-content:center">' + rec.bad_.map(function (it) { var k = U().chars(it.key); return '<span class="mini"><span class="han">' + esc(k.length > 10 ? k.slice(0, 10).join("") + "…" : it.key) + "</span>" + (it.type === "s" ? "" : " " + esc(HC.firstAm(it.am))) + "</span>"; }).join("") + "</div>" : "");
  }
  function setScore(v, s, extra) { var e = v.querySelector("#gs"); if (e) e.textContent = "Điểm " + s; var t = v.querySelector("#gt"); if (t && extra != null) t.textContent = extra; }
  function finish(v, g, score, opts) {
    opts = opts || {};
    var best = HC.setBest(g.id, score, opts.lowerBetter ? false : true);
    var bonus = opts.bonus != null ? opts.bonus : Math.max(2, Math.round(score / 2));
    if (opts.rec && opts.rec.good_.length && !opts.rec.bad_.length && HC.perfect) HC.perfect(); // kỷ lục "bài không sai câu nào" (Bước 7)
    HC.addXP(bonus); HC.after();
    v.innerHTML = '<div class="card result pop"><div class="muted">' + esc(g.name) + '</div><div class="score-big">' + esc(opts.label || score) + "</div>" + (best ? '<span class="chip ok">Kỷ lục mới!</span>' : '<span class="muted">Kỷ lục: ' + esc(HC.state().best[g.id]) + "</span>") + "<p>" + esc(opts.msg || "") + "</p>" + recHTML(opts.rec) + '<p class="muted">+' + bonus + ' XP thưởng</p><div class="row" style="justify-content:center"><button class="btn primary" id="again">Chơi lại</button><a class="btn" href="' + (g.back || "#choi") + '">' + (g.back ? "Bài ôn khác" : "Trò khác") + '</a><a class="btn" href="#home">Trang chính</a></div></div>';
    v.querySelector("#again").onclick = function () { HC.route(); };
  }
  function reg(g) { HC.games.push(g); }
  function correct(el) { HC.beep(true); HC.addXP(1, el); }
  function wrong() { HC.beep(false); }
  function amOf(it) { return HC.firstAm(it.am); }

  // 1. Lật thẻ tìm cặp
  reg({ id: "memo", icon: "對", name: "Lật thẻ tìm cặp", desc: "Lật 2 thẻ: ghép chữ Hán với âm Hán Việt của nó. Càng nhanh càng tốt.",
    run: function (v) {
      var P = HC.pool("c", 3); if (P.need) return lock(v, this, "Cần học thêm " + P.need + " chữ để chơi trò này.");
      var rec = HC.gameRec(), items = HC.pickWeak(P.items, 6), cards = [];
      items.forEach(function (it, i) { cards.push({ i: i, t: "h", s: it.key }); cards.push({ i: i, t: "a", s: amOf(it) }); });
      cards = U().shuffle(cards);
      var open = [], done = 0, moves = 0, t0 = Date.now(), timer;
      v.innerHTML = head(this, P.preview) + '<div class="stage"><div class="memo" id="m">' + cards.map(function (c, k) { return '<button data-k="' + k + '" aria-label="Thẻ úp">?</button>'; }).join("") + '</div><p class="sub">Bấm hai thẻ: một chữ Hán và âm đúng của nó.</p></div>';
      var g = this;
      timer = setInterval(function () { setScore(v, done, Math.round((Date.now() - t0) / 1000) + " giây"); }, 500);
      U().$$("#m button", v).forEach(function (b) {
        b.onclick = function () {
          var c = cards[+b.dataset.k];
          if (b.classList.contains("open") || b.classList.contains("done") || open.length === 2) return;
          b.classList.add("open"); b.innerHTML = c.t === "h" ? '<span class="han">' + esc(c.s) + "</span>" : esc(c.s);
          open.push([b, c]);
          if (open.length === 2) {
            moves++;
            var a = open[0], z = open[1];
            if (a[1].i === z[1].i && a[1].t !== z[1].t) { a[0].classList.add("done"); z[0].classList.add("done"); open = []; done++; correct(z[0]); rec.ok(items[a[1].i]); if (done === items.length) { clearInterval(timer); var sec = Math.round((Date.now() - t0) / 1000); finish(v, g, sec, { lowerBetter: true, label: sec + " giây", msg: moves + " lượt lật · " + items.length + " cặp", bonus: 8, rec: rec }); } }
            else { wrong(); HC.later(function () { a[0].classList.remove("open"); z[0].classList.remove("open"); a[0].textContent = "?"; z[0].textContent = "?"; open = []; }, 800); }
          }
        };
      });
      return function () { clearInterval(timer); };
    } });

  // 2. Mưa chữ
  reg({ id: "rain", icon: "雨", name: "Mưa chữ", desc: "Chữ rơi từ trên xuống, gõ âm Hán Việt (không cần dấu) trước khi chữ chạm đáy. Gõ sai rồi bấm Enter mới tính là sai.",
    run: function (v) {
      var P = HC.pool("c", 5); if (P.need) return lock(v, this, "Cần học thêm " + P.need + " chữ để chơi trò này.");
      var pool = P.items, g = this, rec = HC.gameRec();
      v.innerHTML = head(this, P.preview) + '<div class="stage"><div class="rain" id="rn"><div class="floor"></div></div><input class="answer" id="in" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Gõ âm rồi chữ sẽ biến mất…" aria-label="Gõ âm Hán Việt"><p class="sub" id="info">3 mạng. Chữ chạm đáy mất 1 mạng (không tính là sai). Gõ xong bấm Enter mà không khớp chữ nào → tính sai cho chữ có viền (chữ thấp nhất).</p></div>';
      var rn = v.querySelector("#rn"), inp = v.querySelector("#in"), drops = [], score = 0, lives = 3, last = 0, spawnGap = 2400, speed = 38, raf, alive = true, H = rn.clientHeight;
      function spawn() {
        var it = HC.pickOne(pool);
        var el = document.createElement("div"); el.className = "drop"; el.textContent = it.key;
        el.style.left = Math.round(Math.random() * Math.max(10, rn.clientWidth - 70)) + "px";
        rn.appendChild(el); drops.push({ it: it, el: el, y: -40 });
      }
      function step(ts) {
        if (!alive) return;
        if (!last) last = ts;
        var dt = Math.min(0.05, (ts - last) / 1000); last = ts;
        step.acc = (step.acc || 0) + dt * 1000;
        if (step.acc > spawnGap) { step.acc = 0; spawn(); spawnGap = Math.max(900, spawnGap - 40); speed = Math.min(110, speed + 1.2); }
        for (var i = drops.length - 1; i >= 0; i--) {
          var d = drops[i]; d.y += speed * dt; d.el.style.transform = "translateY(" + d.y + "px)";
          if (d.y > H - 44) { drops.splice(i, 1); d.el.remove(); lives--; wrong(); v.querySelector("#info").textContent = "Lỡ mất: " + d.it.key + " đọc là " + amOf(d.it) + " · còn " + lives + " mạng"; if (lives <= 0) return end(); }
        }
        var low = lowest(); drops.forEach(function (d) { d.el.style.outline = d === low ? "2px solid var(--accent)" : ""; });
        setScore(v, score, "❤ " + lives);
        raf = requestAnimationFrame(step);
      }
      inp.addEventListener("input", function () {
        var val = U().fold(inp.value.trim());
        if (!val) return;
        for (var i = 0; i < drops.length; i++) {
          var d = drops[i];
          var ok = String(d.it.am).split(/\s*\/\s*/).some(function (a) { return U().fold(a) === val; });
          if (ok) { score++; d.el.classList.add("hit"); var el = d.el; HC.later(function () { el.remove(); }, 150); drops.splice(i, 1); inp.value = ""; correct(inp); rec.ok(d.it); setScore(v, score); return; }
        }
      });
      function lowest() { var m = null; drops.forEach(function (d) { if (!m || d.y > m.y) m = d; }); return m; }
      // Enter khi đang gõ mà không khớp chữ nào (khớp thì chữ đã biến mất) → sai cho chữ đang nhắm (thấp nhất)
      inp.addEventListener("keydown", function (e) {
        if (e.key !== "Enter") return;
        e.preventDefault();
        var low = lowest();
        if (!U().fold(inp.value.trim()) || !low) return;
        rec.bad(low.it); wrong(); inp.value = "";
        v.querySelector("#info").textContent = "Chưa đúng: " + low.it.key + " đọc là " + amOf(low.it) + " (tính là sai, sẽ ôn lại) · còn " + lives + " mạng";
      });
      function end() { alive = false; cancelAnimationFrame(raf); finish(v, g, score, { msg: "Bắn trúng " + score + " chữ", rec: rec }); }
      spawn(); raf = requestAnimationFrame(step); HC.later(function () { try { inp.focus(); } catch (e) { } }, 50);
      return function () { alive = false; cancelAnimationFrame(raf); };
    } });

  // 3. Đúng hay sai 60 giây
  reg({ id: "tf", icon: "是", name: "Đúng hay sai 60 giây", desc: "Chữ và âm/nghĩa đi kèm có khớp không? Bấm thật nhanh, đúng liên tiếp được nhân điểm.",
    run: function (v) {
      var P1 = HC.pool("c", 0), P2 = HC.pool("w", 0), pool = P1.items.concat(P2.items), g = this, rec = HC.gameRec();
      if (pool.length < 5) return lock(v, this, "Cần học ít nhất 5 chữ / từ để chơi trò này (bạn mới học " + pool.length + ").");
      var score = 0, combo = 0, endAt = Date.now() + 60000, cur, truth, tick;
      v.innerHTML = head(this, P1.preview) + '<div class="stage"><div class="timer"><i id="tb" style="width:100%"></i></div><div class="fc" id="fc"></div><div class="row acts"><button class="btn bad" id="no" style="min-width:130px">✗ Sai <small>(phím ←)</small></button><button class="btn good" id="yes" style="min-width:130px">✓ Đúng <small>(phím →)</small></button></div><div class="feedback" id="fb"></div></div>';
      function next() {
        cur = HC.pickOne(pool);
        truth = Math.random() < 0.5;
        var shown = truth ? cur : (HC.distract(cur, 1, "am")[0] || cur);
        if (shown === cur) truth = true;
        v.querySelector("#fc").innerHTML = '<span class="kind">' + HC.kindLabel(cur) + '</span><div class="big ' + U().lenCls(cur.key) + '">' + esc(cur.key) + '</div><div class="ans"><div class="am">' + esc(shown.am) + '</div><div class="ns">' + esc(HC.meaningShort(shown)) + "</div></div>";
      }
      function answer(said, el) {
        if (Date.now() > endAt) return;
        var ok = said === truth, fb = v.querySelector("#fb");
        if (ok) { combo++; score += combo >= 5 ? 2 : 1; correct(el); rec.ok(cur); fb.className = "feedback ok"; fb.textContent = combo >= 5 ? "Chuỗi " + combo + " — nhân đôi điểm!" : "Đúng"; }
        else { combo = 0; wrong(); rec.bad(cur); fb.className = "feedback no"; fb.textContent = cur.key + " = " + cur.am + " · " + HC.meaningShort(cur); }
        setScore(v, score); next();
      }
      v.querySelector("#yes").onclick = function () { answer(true, this); };
      v.querySelector("#no").onclick = function () { answer(false, this); };
      function key(e) { if (e.key === "ArrowRight") answer(true, v.querySelector("#yes")); if (e.key === "ArrowLeft") answer(false, v.querySelector("#no")); }
      document.addEventListener("keydown", key);
      tick = setInterval(function () { var left = Math.max(0, endAt - Date.now()); var tb = v.querySelector("#tb"); if (tb) tb.style.width = (left / 600) + "%"; setScore(v, score, Math.ceil(left / 1000) + " giây"); if (!left) { clearInterval(tick); document.removeEventListener("keydown", key); finish(v, g, score, { rec: rec }); } }, 200);
      next();
      return function () { clearInterval(tick); document.removeEventListener("keydown", key); };
    } });

  // 4. Ghép chữ thành từ
  reg({ id: "build", icon: "詞", name: "Ghép chữ thành từ", desc: "Nhìn âm và nghĩa, bấm các chữ theo đúng thứ tự để ghép thành từ.",
    run: function (v) {
      var P = HC.pool("w", 3); if (P.need) return lock(v, this, "Cần học thêm " + P.need + " từ để chơi trò này.");
      var words = HC.pickWeak(P.items, 10), N = words.length, g = this, i = 0, score = 0, tries = 0, rec = HC.gameRec();
      var lc = HC.learnedOf("c"), allC = lc.length >= 8 ? lc : HC.D.chars.slice(0, 500);
      function round() {
        var w = words[i], need = U().chars(w.w);
        var extra = U().pick(allC.filter(function (c) { return need.indexOf(c.c) < 0; }), Math.max(2, 6 - need.length)).map(function (c) { return c.c; });
        var tiles = U().shuffle(need.concat(extra)), slots = [];
        tries = 0;
        v.innerHTML = head(g, P.preview) + '<div class="stage"><div class="row"><span class="chip num">' + (i + 1) + " / " + N + '</span></div><div class="fc" style="min-height:auto"><div class="ans"><div class="am">' + esc(w.am) + "</div>" + HC.meanHTML(w) + '</div></div><div class="slots" id="sl" aria-label="Từ đang ghép"></div><div class="tiles" id="tl">' + tiles.map(function (t, k) { return '<button class="tile" data-k="' + k + '">' + esc(t) + "</button>"; }).join("") + '</div><div class="feedback" id="fb"></div><div class="row acts"><button class="btn" id="skip">Bỏ qua</button></div></div>';
        setScore(v, score);
        function draw() { v.querySelector("#sl").innerHTML = slots.map(function (k, j) { return '<button class="tile" data-s="' + j + '">' + esc(tiles[k]) + "</button>"; }).join(""); U().$$("#sl .tile", v).forEach(function (b) { b.onclick = function () { var k = slots.splice(+b.dataset.s, 1)[0]; v.querySelector('#tl [data-k="' + k + '"]').classList.remove("used"); draw(); }; }); }
        U().$$("#tl .tile", v).forEach(function (b) {
          b.onclick = function () {
            if (b.classList.contains("used")) return;
            slots.push(+b.dataset.k); b.classList.add("used"); draw();
            if (slots.length === need.length) {
              var got = slots.map(function (k) { return tiles[k]; }).join("");
              var fb = v.querySelector("#fb");
              if (got === w.w) { if (!tries) { score++; rec.ok(w); } correct(b); fb.className = "feedback ok"; fb.textContent = "Đúng: " + w.w; HC.later(next, 800); }
              else { tries++; wrong(); rec.bad(w); fb.className = "feedback no"; fb.textContent = "Chưa đúng, thử lại (bấm vào chữ ở trên để gỡ ra)."; }
            }
          };
        });
        v.querySelector("#skip").onclick = function () { var fb = v.querySelector("#fb"); fb.className = "feedback no"; fb.textContent = "Đáp án: " + w.w; rec.bad(w); HC.later(next, 1400); };
      }
      function next() { i++; if (i < words.length) round(); else finish(v, g, score, { label: score + " / " + N, msg: "Ghép đúng ngay lần đầu " + score + " từ", rec: rec }); }
      round();
    } });

  // 5. Năm rổ loại từ
  // set: "hk12" (từ loại HK1, kỳ 2 — như bản cũ) | "gk3" (38 từ ngữ pháp giữa kỳ 3) | bỏ trống = mọi kỳ.
  // Câu ví dụ lấy sẵn trong app-data.json → ltq[set][từ] (đã bỏ câu mà chữ đó mang nghĩa / loại khác)
  // learned = true: chỉ hỏi từ ngữ pháp đã học, ưu tiên từ chưa thuộc (trò chơi); thi thử để trống = mọi từ
  function ltItem(x) { return U().chars(x).length > 1 ? HC.WORD[x] : HC.CHAR[x]; }
  function ltKeys(groups, set, learned) {
    var LT = HC.LT, Q = HC.D.ltq || {}, pool = set ? (Q[set] || {}) : null;
    return Object.keys(LT).filter(function (x) { var it; return groups.indexOf(LT[x]) >= 0 && (!pool || pool[x]) && (!learned || ((it = ltItem(x)) && HC.introduced(it.id))); });
  }
  function ltQuestion(groups, set, learned) {
    var LT = HC.LT, Q = HC.D.ltq || {}, pool = set ? (Q[set] || {}) : null;
    var keys = ltKeys(groups, set, learned);
    if (!keys.length) return null;
    var x = learned ? HC.pickOne(keys.map(ltItem)).key : keys[Math.floor(Math.random() * keys.length)];
    var ss = pool ? pool[x] : [].concat((Q.hk12 || {})[x] || [], (Q.gk3 || {})[x] || []);
    var ctx = '<span class="hl">' + esc(x) + "</span>";
    if (ss.length) { var s = ss[Math.floor(Math.random() * ss.length)]; var at = s.indexOf(x); ctx = esc(s.slice(0, at)) + '<span class="hl">' + esc(x) + "</span>" + esc(s.slice(at + x.length)); }
    return { x: x, ans: LT[x], ctx: ctx, it: ltItem(x) };
  }
  HC.ltQuestion = ltQuestion;
  var G5 = ["Số từ", "Phương vị từ", "Phó từ", "Lượng từ", "Liên từ"];
  var G7 = ["Trợ từ kết cấu", "Trợ động từ", "Lượng từ", "Phương vị từ", "Liên từ", "Phó từ", "Số từ"];
  reg({ id: "basket", icon: "類", name: "Năm rổ loại từ", desc: "Chữ được gạch chân thuộc loại từ nào? Thả vào đúng rổ: Số từ, Phương vị từ, Phó từ, Lượng từ, Liên từ.",
    run: function (v) { basketRun(this, v, G5); } });
  reg({ id: "basket7", icon: "類", name: "Bảy rổ loại từ (giữa kỳ 3)", desc: "38 từ ngữ pháp của đề cương giữa kỳ 3, trong câu đề cương và câu đề thi K10: chọn đúng 1 trong 7 loại.",
    run: function (v) { basketRun(this, v, G7, "gk3"); } });
  function basketRun(g, v, GG, set) {
      var i = 0, score = 0, N = 20, rec = HC.gameRec(), nk = ltKeys(GG, set, true).length;
      if (nk < 3) return lock(v, g, "Cần học ít nhất 3 từ ngữ pháp (loại từ) của trò này — bạn mới học " + nk + ". Các từ này được học dần trong Học mới.");
      function round() {
        var q = ltQuestion(GG, set, true);
        v.innerHTML = head(g) + '<div class="stage"><div class="row"><span class="chip num">' + (i + 1) + " / " + N + '</span></div><div class="card" style="width:min(640px,100%)"><div class="sent">' + q.ctx + '</div><p class="sub" style="text-align:center">Chữ gạch chân thuộc loại từ nào?</p></div><div class="baskets">' + GG.map(function (n) { return '<button class="btn" data-g="' + esc(n) + '">' + esc(n) + "</button>"; }).join("") + '</div><div class="feedback" id="fb"></div></div>';
        setScore(v, score);
        U().$$(".baskets .btn", v).forEach(function (b) {
          b.onclick = function () {
            var ok = b.dataset.g === q.ans, fb = v.querySelector("#fb");
            U().$$(".baskets .btn", v).forEach(function (x) { x.disabled = true; if (x.dataset.g === q.ans) x.classList.add("good"); });
            if (ok) { score++; correct(b); rec.ok(q.it); } else { b.classList.add("bad"); wrong(); rec.bad(q.it); }
            fb.className = "feedback " + (ok ? "ok" : "no");
            fb.textContent = (ok ? "Đúng! " : "Chưa đúng. ") + q.x + (q.it ? " (" + HC.firstAm(q.it.am) + ")" : "") + " là " + q.ans + ".";
            HC.later(function () { i++; if (i < N) round(); else finish(v, g, score, { label: score + " / " + N, rec: rec }); }, ok ? 900 : 1900);
          };
        });
      }
      round();
  }

  // ---------- Ôn tập loại từ theo kỳ (màn Loại từ → #loaitu-<tab>-<bài>; người dùng yêu cầu 26/11/2026) ----------
  // tab: hk1 | hk2 | gk3 = ltk trong app-data.json (đúng bảng loại từ đề cương kỳ đó) | all = Tổng hợp mọi kỳ (D.loaitu).
  // Bài ôn hỏi MỌI từ của kỳ (kể cả chưa học — bảng từ nằm ngay trên trang); ghi nhận như trò chơi (HC.gameRec: chỉ mục đã học,
  // sai → ôn lại sớm). Kỷ lục: S.best["lt-<tab>-<bài>"].
  function ltTab(k) {
    var D = HC.D, L = D.ltk || [], i;
    if (k === "all") {
      var am = {}, ky = {};
      L.forEach(function (K) {
        Object.keys(K.g).forEach(function (g) { K.g[g].forEach(function (t) { (ky[t] = ky[t] || []).push(K.name); }); });
        Object.keys(K.am || {}).forEach(function (t) { if (!am[t]) am[t] = K.am[t]; });
      });
      return { k: "all", name: "Tổng hợp", src: "gộp " + L.map(function (K) { return K.name; }).join(", "), g: D.loaitu, am: am, ky: ky, set: null };
    }
    for (i = 0; i < L.length; i++) if (L[i].k === k) return L[i];
    return null;
  }
  HC.ltTab = ltTab;
  HC.ltCtx = function (k, x) { return ltCtx(ltTab(k) || ltTab("all"), x); }; // câu ví dụ có chữ gạch chân (bài loại từ trong Học mới)
  HC.ltTabKeys = function () { return (HC.D.ltk || []).map(function (K) { return K.k; }).concat(["all"]); };
  function ltAm(T, x, it) { return (T.am || {})[x] || (it ? HC.firstAm(it.am) : ""); }
  HC.ltAm = ltAm;
  // danh sách mục của tab: { id, x, g, it, am } (id để ưu tiên mục chưa thuộc)
  function ltList(T) {
    var out = [];
    Object.keys(T.g).forEach(function (g) { T.g[g].forEach(function (x) { var it = ltItem(x); out.push({ id: it ? it.id : "lt:" + x, x: x, g: g, it: it, am: ltAm(T, x, it) }); }); });
    return out;
  }
  // câu ví dụ có chữ gạch chân (câu đề cương / đề thi của kỳ đó; Tổng hợp: mọi kỳ)
  function ltCtx(T, x) {
    var Q = HC.D.ltq || {}, ss = T.set ? (Q[T.set] || {})[x] || [] : [].concat((Q.hk12 || {})[x] || [], (Q.gk3 || {})[x] || []);
    if (!ss.length) return '<span class="hl">' + esc(x) + "</span>";
    var s = ss[Math.floor(Math.random() * ss.length)], at = s.indexOf(x);
    return esc(s.slice(0, at)) + '<span class="hl">' + esc(x) + "</span>" + esc(s.slice(at + x.length));
  }
  // n mục, ưu tiên mục chưa thuộc; danh sách ngắn hơn n thì lặp lại (không 2 mục giống nhau liền nhau)
  function ltDeck(list, n) {
    var out = [];
    while (out.length < n) { var d = HC.pickWeak(list, Math.min(n - out.length, list.length)); if (out.length && d.length > 1 && d[0] === out[out.length - 1]) d.push(d.shift()); out = out.concat(d); }
    return out;
  }
  function ltOpts(GG) { return '<div class="ltopts">' + GG.map(function (n, k) { return '<button class="btn" data-g="' + esc(n) + '">' + String.fromCharCode(65 + k) + ". " + esc(n) + "</button>"; }).join("") + "</div>"; }
  function ltRec(rec, q, ok) { if (q.it) rec[ok ? "ok" : "bad"](q.it); }
  function ltSay(q) { return q.x + (q.am ? " (" + q.am + ")" : "") + " là " + q.g + "."; }
  var LT_DRILLS = [
    { id: "de", icon: "試", name: "Làm như đề thi", desc: "20 câu: chữ gạch chân trong câu thuộc loại từ nào? Chọn trong các loại của kỳ này." },
    { id: "nhanh", icon: "速", name: "Nhanh tay 60 giây", desc: "Hiện từng chữ: bấm đúng loại càng nhiều càng tốt trong 60 giây." },
    { id: "gom", icon: "籃", name: "Gom rổ", desc: "Cho một loại từ: chọn hết các chữ thuộc loại đó trong lưới 12 chữ." },
    { id: "am", icon: "音", name: "Âm Hán Việt", desc: "Nhìn chữ, chọn âm Hán Việt đúng (âm theo đề cương) trong 4 âm." },
    { id: "the", icon: "讀", name: "Lật thẻ", desc: "Nhìn chữ, tự nhớ loại từ + âm rồi lật thẻ, tự chấm Nhớ / Quên." }
  ];
  HC.LT_DRILLS = LT_DRILLS;
  HC.ltDrill = function (v, tab, id) {
    var T = ltTab(tab), D0 = null;
    LT_DRILLS.forEach(function (d) { if (d.id === id) D0 = d; });
    if (!T || !D0) { HC.go("loaitu" + (T ? "-" + tab : "")); return; }
    var g = { id: "lt-" + T.k + "-" + D0.id, name: D0.name + " · Loại từ " + T.name, back: "#loaitu-" + T.k, backLabel: "← Loại từ " + T.name };
    var GG = Object.keys(T.g), list = ltList(T), rec = HC.gameRec();
    ({ de: ltDe, nhanh: ltNhanh, gom: ltGom, am: ltAmQ, the: ltThe })[D0.id](v, g, T, GG, list, rec);
  };
  // 1. Làm như đề thi: 20 câu, chữ gạch chân trong câu
  function ltDe(v, g, T, GG, list, rec) {
    var N = 20, deck = ltDeck(list, N), i = 0, score = 0;
    function round() {
      var q = deck[i];
      v.innerHTML = head(g) + '<div class="stage"><div class="row"><span class="chip num">Câu ' + (i + 1) + " / " + N + '</span></div><div class="card" style="width:min(680px,100%)"><div class="sent">' + ltCtx(T, q.x) + '</div><p class="sub" style="text-align:center">Chữ gạch chân thuộc loại từ nào?</p></div>' + ltOpts(GG) + '<div class="feedback" id="fb" role="status"></div></div>';
      setScore(v, score);
      U().$$(".ltopts .btn", v).forEach(function (b) {
        b.onclick = function () {
          var ok = b.dataset.g === q.g, fb = v.querySelector("#fb");
          U().$$(".ltopts .btn", v).forEach(function (x) { x.disabled = true; if (x.dataset.g === q.g) x.classList.add("good"); });
          if (ok) { score++; correct(b); } else { b.classList.add("bad"); wrong(); }
          ltRec(rec, q, ok); setScore(v, score);
          fb.className = "feedback " + (ok ? "ok" : "no"); fb.textContent = (ok ? "Đúng! " : "Chưa đúng. ") + ltSay(q);
          HC.later(function () { i++; if (i < N) round(); else finish(v, g, score, { label: score + " / " + N, msg: "Như phần loại từ của đề thi: " + score + " / " + N + " câu đúng", rec: rec }); }, ok ? 900 : 2000);
        };
      });
    }
    round();
  }
  // 2. Nhanh tay 60 giây: chữ đứng riêng (không câu)
  function ltNhanh(v, g, T, GG, list, rec) {
    var left = 60, score = 0, tries = 0, deck = [], q = null, busy = false, over = false;
    function nextQ() { if (!deck.length) deck = ltDeck(list, Math.min(list.length, 20)); var n = deck.shift(); if (q && n === q && deck.length) { deck.push(n); n = deck.shift(); } return n; }
    function tick() { if (over) return; left--; var t = v.querySelector("#gt"); if (t) t.textContent = left + " giây"; if (left <= 0) end(); else HC.later(tick, 1000); }
    function end() { over = true; finish(v, g, score, { label: score + " đúng", msg: "Trong 60 giây: " + score + " đúng / " + tries + " lần bấm", rec: rec }); }
    function round() {
      q = nextQ(); busy = false;
      v.querySelector("#qbox").innerHTML = '<div class="big ' + U().lenCls(q.x) + '">' + esc(q.x) + "</div>";
      var fb = v.querySelector("#fb"); fb.className = "feedback"; fb.textContent = "";
      U().$$(".ltopts .btn", v).forEach(function (x) { x.disabled = false; x.classList.remove("good", "bad"); });
    }
    v.innerHTML = head(g) + '<div class="stage"><div class="fc ltq" id="qbox"></div><p class="sub" style="text-align:center;margin:0">Chữ này thuộc loại từ nào?</p>' + ltOpts(GG) + '<div class="feedback" id="fb" role="status"></div></div>';
    setScore(v, 0, left + " giây");
    U().$$(".ltopts .btn", v).forEach(function (b) {
      b.onclick = function () {
        if (busy || over) return; busy = true; tries++;
        var ok = b.dataset.g === q.g, fb = v.querySelector("#fb");
        U().$$(".ltopts .btn", v).forEach(function (x) { x.disabled = true; if (x.dataset.g === q.g) x.classList.add("good"); });
        if (ok) { score++; correct(b); } else { b.classList.add("bad"); wrong(); }
        ltRec(rec, q, ok); setScore(v, score);
        fb.className = "feedback " + (ok ? "ok" : "no"); fb.textContent = (ok ? "Đúng! " : "Chưa đúng. ") + ltSay(q);
        HC.later(function () { if (!over) round(); }, ok ? 350 : 1300);
      };
    });
    round(); HC.later(tick, 1000);
  }
  // 3. Gom rổ: chọn hết chữ thuộc một loại trong lưới ≤ 12 chữ
  function ltGom(v, g, T, GG, list, rec) {
    var N = 8, i = 0, score = 0;
    function round() {
      var gi = GG[Math.floor(Math.random() * GG.length)], mem = list.filter(function (q) { return q.g === gi; }), oth = list.filter(function (q) { return q.g !== gi; });
      var size = Math.min(12, list.length), nm = Math.min(mem.length, 2 + Math.floor(Math.random() * 4), size - 1);
      var pickM = HC.pickWeak(mem, nm), tiles = U().shuffle(pickM.concat(HC.pickWeak(oth, size - pickM.length))), sel = {}, done = false;
      v.innerHTML = head(g) + '<div class="stage"><div class="row"><span class="chip num">Lượt ' + (i + 1) + " / " + N + '</span></div><div class="card ltask" style="width:min(680px,100%);text-align:center"><b>Chọn HẾT các chữ thuộc <span style="color:var(--seal)">' + esc(gi) + '</span></b><p class="sub" style="margin:4px 0 0">Bấm để chọn / bỏ chọn, rồi bấm Kiểm tra.</p></div><div class="ltgrid">' + tiles.map(function (q, k) { return '<button class="lttile" data-k="' + k + '"><span class="han">' + esc(q.x) + '</span><small class="hide"></small></button>'; }).join("") + '</div><div class="row acts"><button class="btn primary" id="ok">Kiểm tra</button><button class="btn primary hide" id="nx">Lượt tiếp →</button></div><div class="feedback" id="fb" role="status"></div></div>';
      setScore(v, score);
      U().$$(".lttile", v).forEach(function (b) { b.onclick = function () { if (done) return; var k = b.dataset.k; sel[k] = !sel[k]; b.classList.toggle("on", !!sel[k]); }; });
      v.querySelector("#ok").onclick = function () {
        done = true; var bad = 0;
        U().$$(".lttile", v).forEach(function (b) {
          var q = tiles[+b.dataset.k], isM = q.g === gi, on = !!sel[b.dataset.k], sm = b.querySelector("small");
          b.disabled = true; sm.textContent = q.am + " · " + q.g; sm.classList.remove("hide");
          if (isM && on) { b.classList.add("good"); ltRec(rec, q, true); }
          else if (isM || on) { b.classList.add(isM ? "miss" : "bad"); bad++; ltRec(rec, q, false); }
        });
        var fb = v.querySelector("#fb"), ok = !bad;
        if (ok) { score++; correct(this); } else wrong();
        setScore(v, score);
        fb.className = "feedback " + (ok ? "ok" : "no"); fb.textContent = ok ? "Đúng hết!" : "Còn " + bad + " chữ chưa đúng: viền đỏ = chọn nhầm, viền vàng = còn sót.";
        this.classList.add("hide"); var nx = v.querySelector("#nx"); nx.classList.remove("hide"); try { nx.focus(); } catch (e) { }
      };
      v.querySelector("#nx").onclick = function () { i++; if (i < N) round(); else finish(v, g, score, { label: score + " / " + N, msg: "Gom đúng hết " + score + " / " + N + " lượt", rec: rec }); };
    }
    round();
  }
  // 4. Âm Hán Việt: chữ → chọn 1 trong 4 âm (âm đề cương ghi)
  function ltAmQ(v, g, T, GG, list, rec) {
    var N = 15, deck = ltDeck(list, N), i = 0, score = 0, ams = [];
    list.forEach(function (q) { if (q.am && ams.indexOf(q.am) < 0) ams.push(q.am); });
    function round() {
      var q = deck[i], opts = U().shuffle([q.am].concat(U().pick(ams.filter(function (a) { return a !== q.am; }), 3)));
      v.innerHTML = head(g) + '<div class="stage"><div class="row"><span class="chip num">Câu ' + (i + 1) + " / " + N + '</span></div><div class="fc ltq"><div class="big ' + U().lenCls(q.x) + '">' + esc(q.x) + '</div><div class="muted">' + esc(q.g) + ' — âm Hán Việt là gì?</div></div><div class="choices">' + opts.map(function (o) { return '<button class="choice" data-a="' + esc(o) + '">' + esc(o) + "</button>"; }).join("") + '</div><div class="feedback" id="fb" role="status"></div></div>';
      setScore(v, score);
      U().$$(".choice", v).forEach(function (b) {
        b.onclick = function () {
          var ok = b.dataset.a === q.am, fb = v.querySelector("#fb");
          U().$$(".choice", v).forEach(function (x) { x.disabled = true; if (x.dataset.a === q.am) x.classList.add("right"); });
          if (ok) { score++; correct(b); } else { b.classList.add("wrong"); wrong(); }
          ltRec(rec, q, ok); setScore(v, score);
          fb.className = "feedback " + (ok ? "ok" : "no"); fb.textContent = (ok ? "Đúng! " : "Chưa đúng. ") + ltSay(q);
          HC.later(function () { i++; if (i < N) round(); else finish(v, g, score, { label: score + " / " + N, rec: rec }); }, ok ? 900 : 1900);
        };
      });
    }
    round();
  }
  // 5. Lật thẻ: tự nhớ loại + âm, lật, tự chấm; thẻ Quên được hỏi lại 1 lần cuối lượt
  function ltThe(v, g, T, GG, list, rec) {
    var N = Math.min(20, list.length), deck = ltDeck(list, N), i = 0, nho = 0, again = {};
    function round(show) {
      var q = deck[i], mean = q.it ? HC.meaningShort(q.it) : "";
      v.innerHTML = head(g) + '<div class="stage"><div class="row"><span class="chip num">Thẻ ' + (i + 1) + " / " + deck.length + '</span></div><div class="fc ltq"><div class="big ' + U().lenCls(q.x) + '">' + esc(q.x) + '</div><div class="ans' + (show ? "" : " hide") + '"><div style="font-weight:700;font-size:1.2rem;color:var(--seal)">' + esc(q.g) + '</div><div style="font-weight:600">' + esc(q.am) + "</div>" + (mean ? '<div class="muted">' + esc(mean) + "</div>" : "") + (T.ky && T.ky[q.x] ? '<div class="muted" style="font-size:0.85rem">Có ở: ' + esc(T.ky[q.x].join(", ")) + "</div>" : "") + '</div></div><div class="row acts">' + (show ? '<button class="btn bad" id="quen">Quên</button><button class="btn good" id="nho">Nhớ</button>' : '<button class="btn primary" id="lat">Lật thẻ</button>') + "</div></div>";
      setScore(v, nho, "Nhớ " + nho + " / " + N);
      if (!show) { v.querySelector("#lat").onclick = function () { round(true); }; return; }
      function go(ok, b) {
        if (ok) { if (!again[q.x]) nho++; correct(b); } else { wrong(); if (!again[q.x]) { again[q.x] = 1; deck.push(q); } }
        ltRec(rec, q, ok); i++;
        if (i < deck.length) round(false); else finish(v, g, Math.min(nho, N), { label: "Nhớ " + Math.min(nho, N) + " / " + N, msg: nho >= N ? "Nhớ hết các thẻ!" : "Thẻ quên được hỏi lại một lần cuối lượt", rec: rec });
      }
      v.querySelector("#quen").onclick = function () { go(false, this); };
      v.querySelector("#nho").onclick = function () { go(true, this); };
    }
    round(false);
  }

  // 6. Truy tìm bộ thủ
  reg({ id: "hunt", icon: "部", name: "Truy tìm bộ thủ", desc: "Cho một bộ thủ: chọn hết các chữ thuộc bộ đó trong lưới 12 chữ.",
    run: function (v) {
      var g = this, i = 0, score = 0, N = 8;
      var P = HC.pool("c", 0), pool = P.items.filter(function (c) { return c.rad; }), rec = HC.gameRec();
      var cnt = {}; pool.forEach(function (c) { cnt[c.rad] = (cnt[c.rad] || 0) + 1; });
      if (pool.length < 12 || !Object.keys(cnt).some(function (r) { return cnt[r] >= 3; })) return lock(v, g, "Trò này cần ít nhất 12 chữ đã học, trong đó có một bộ thủ có từ 3 chữ trở lên (bạn mới học " + pool.length + " chữ).");
      function round() {
        var byRad = {}; pool.forEach(function (c) { (byRad[c.rad] = byRad[c.rad] || []).push(c); });
        var rads = Object.keys(byRad).filter(function (r) { return byRad[r].length >= 3; });
        var rno = rads[Math.floor(Math.random() * rads.length)], R = HC.RAD[rno];
        var mem = HC.pickWeak(byRad[rno], Math.min(byRad[rno].length, 3 + Math.floor(Math.random() * 3)));
        var others = HC.pickWeak(pool.filter(function (c) { return String(c.rad) !== String(rno); }), 12 - mem.length);
        var grid = U().shuffle(mem.concat(others)), sel = {};
        v.innerHTML = head(g, P.preview) + '<div class="stage"><div class="row"><span class="chip num">' + (i + 1) + " / " + N + '</span></div><div class="card huntq" style="text-align:center;width:min(480px,100%)"><span class="han hr">' + esc(R.r) + '</span><div><b>Bộ ' + esc(R.am) + "</b> · " + esc(R.ns || "") + (R.verse ? '<br><small class="muted">' + esc(R.verse) + "</small>" : "") + '</div></div><div class="hunt">' + grid.map(function (c, k) { return '<button data-k="' + k + '">' + esc(c.c) + "</button>"; }).join("") + '</div><div class="feedback" id="fb"></div><div class="row acts"><button class="btn primary" id="chk">Kiểm tra</button></div></div>';
        setScore(v, score);
        U().$$(".hunt button", v).forEach(function (b) { b.onclick = function () { var k = b.dataset.k; sel[k] = !sel[k]; b.classList.toggle("sel", !!sel[k]); }; });
        v.querySelector("#chk").onclick = function () {
          var got = 0, bad = 0;
          U().$$(".hunt button", v).forEach(function (b) { var c = grid[+b.dataset.k], isM = String(c.rad) === String(rno); b.classList.remove("sel"); if (sel[b.dataset.k] && isM) { b.classList.add("right"); got++; rec.ok(c); } else if (sel[b.dataset.k]) { b.classList.add("wrong"); bad++; rec.bad(c); } else if (isM) { b.classList.add("miss"); rec.bad(c); } b.disabled = true; });
          var pts = Math.max(0, got - bad); score += pts;
          var fb = v.querySelector("#fb"); fb.className = "feedback " + (bad || got < mem.length ? "no" : "ok");
          fb.textContent = "Tìm đúng " + got + "/" + mem.length + (bad ? ", chọn nhầm " + bad : "") + ". Viền cam là chữ bị bỏ sót.";
          if (pts) correct(this); else wrong();
          this.textContent = i + 1 < N ? "Bộ tiếp theo →" : "Xem kết quả"; this.onclick = function () { i++; if (i < N) round(); else finish(v, g, score, { rec: rec }); };
        };
      }
      round();
    } });

  // 7. Xếp câu
  function clauses(s) {
    var hs = U().chars(s.han), syl = String(s.pa).replace(/\.\.\.|…/g, " ").split(/[\s,;.:]+/).filter(Boolean);
    var hanIdx = hs.filter(U().isHan).length, aligned = syl.length === hanIdx, k = 0, out = [], cur = { h: "", p: [] };
    hs.forEach(function (ch) {
      if (U().isHan(ch)) { cur.h += ch; if (aligned) cur.p.push(syl[k]); k++; }
      else if (/[，。、；：！？…]/.test(ch)) { if (cur.h) out.push(cur); cur = { h: "", p: [] }; }
    });
    if (cur.h) out.push(cur);
    return out.filter(function (c) { return U().chars(c.h).length >= 3 && U().chars(c.h).length <= 12; }).map(function (c) { return { h: c.h, p: c.p.join(" "), s: s }; });
  }
  reg({ id: "order", icon: "句", name: "Xếp câu", desc: "Các chữ trong một vế câu của đề cương bị xáo trộn. Bấm theo đúng thứ tự.",
    run: function (v) {
      var P = HC.pool("s", 0), g = this, i = 0, score = 0, rec = HC.gameRec(), qs = [];
      // mỗi câu đã học (ưu tiên câu chưa thuộc) lấy 1 vế; ít câu thì lấy thêm vế khác của chính các câu đó
      var per = HC.pickWeak(P.items, P.items.length).map(function (s) { return U().shuffle(clauses(s)); });
      for (var r = 0; qs.length < 6 && r < 6; r++) per.forEach(function (a) { if (qs.length < 6 && a[r]) qs.push(a[r]); });
      if (!qs.length) return lock(v, g, "Cần học ít nhất 1 câu đề cương để chơi trò này. Câu được học dần trong Học mới hoặc ở mục Câu.");
      function round() {
        var q = qs[i], need = U().chars(q.h), tiles = U().shuffle(need.map(function (c, k) { return { c: c, k: k }; })), pos = 0, miss = 0;
        v.innerHTML = head(g, P.preview) + '<div class="stage"><div class="row"><span class="chip num">' + (i + 1) + " / " + qs.length + '</span></div><div class="card" style="width:min(640px,100%);text-align:center"><div style="font-weight:700">' + esc(q.p || q.s.pa) + '</div><div class="muted" style="font-size:0.9rem">' + esc(q.s.dn) + '</div></div><div class="slots" id="sl"></div><div class="tiles" id="tl">' + tiles.map(function (t, j) { return '<button class="tile" data-j="' + j + '">' + esc(t.c) + "</button>"; }).join("") + '</div><div class="feedback" id="fb"></div></div>';
        setScore(v, score);
        U().$$("#tl .tile", v).forEach(function (b) {
          b.onclick = function () {
            if (b.classList.contains("used")) return;
            var t = tiles[+b.dataset.j];
            if (t.c === need[pos]) { b.classList.add("used"); v.querySelector("#sl").insertAdjacentHTML("beforeend", '<span class="tile">' + esc(t.c) + "</span>"); pos++; HC.beep(true); if (pos === need.length) { if (!miss) { score++; rec.ok(q.s); } HC.addXP(2, b); var fb = v.querySelector("#fb"); fb.className = "feedback ok"; fb.textContent = miss ? "Xong (sai " + miss + " lần)" : "Hoàn hảo!"; HC.later(function () { i++; if (i < qs.length) round(); else finish(v, g, score, { label: score + " / " + qs.length, msg: "Xếp đúng không sai lần nào: " + score + " vế câu", rec: rec }); }, 900); } }
            else { miss++; wrong(); rec.bad(q.s); b.classList.add("pop"); HC.later(function () { b.classList.remove("pop"); }, 300); }
          };
        });
      }
      round();
    } });

  // 8. Điền chữ còn thiếu
  reg({ id: "cloze", icon: "空", name: "Điền chữ còn thiếu", desc: "Câu trong đề cương bị khuyết một chữ. Chọn đúng chữ còn thiếu.",
    run: function (v) {
      var P = HC.pool("s", 0), g = this, i = 0, score = 0, N = 10, rec = HC.gameRec();
      var src = P.items.filter(function (s) { return U().chars(s.han).some(function (c) { return U().isHan(c) && HC.CHAR[c]; }); });
      if (!src.length) return lock(v, g, "Cần học ít nhất 1 câu đề cương để chơi trò này. Câu được học dần trong Học mới hoặc ở mục Câu.");
      function round() {
        var s = HC.pickOne(src), hs = U().chars(s.han);
        var idxs = []; hs.forEach(function (c, k) { if (U().isHan(c) && HC.CHAR[c]) idxs.push(k); });
        var lidx = idxs.filter(function (k) { return HC.introduced(HC.CHAR[hs[k]].id); }); if (lidx.length) idxs = lidx; // ưu tiên khuyết chữ đã học
        var k = idxs[Math.floor(Math.random() * idxs.length)], ans = hs[k], A = HC.CHAR[ans];
        var opts = U().shuffle([ans].concat(HC.distract(A, 3, "am").map(function (x) { return x.c; })));
        var syl = String(s.pa).replace(/\.\.\.|…/g, " ").split(/[\s,;.:]+/).filter(Boolean), hanCount = hs.filter(U().isHan).length, pa = s.pa;
        if (syl.length === hanCount) { var before = hs.slice(0, k).filter(U().isHan).length; syl[before] = "___"; pa = syl.join(" "); }
        v.innerHTML = head(g, P.preview) + '<div class="stage"><div class="row"><span class="chip num">' + (i + 1) + " / " + N + '</span></div><div class="card clozeq" style="width:min(680px,100%);text-align:center"><div class="sent">' + hs.map(function (c, j) { return j === k ? '<span class="blank">?</span>' : esc(c); }).join("") + '</div><div style="font-weight:600">' + esc(pa) + '</div><div class="muted">' + esc(s.dn) + '</div></div><div class="choices c4">' + opts.map(function (o) { return '<button class="choice" data-o="' + esc(o) + '" style="text-align:center"><span class="han">' + esc(o) + "</span></button>"; }).join("") + '</div><div class="feedback" id="fb"></div></div>';
        setScore(v, score);
        U().$$(".choice", v).forEach(function (b) {
          b.onclick = function () {
            var ok = b.dataset.o === ans, fb = v.querySelector("#fb");
            U().$$(".choice", v).forEach(function (x) { x.disabled = true; if (x.dataset.o === ans) x.classList.add("right"); });
            var mk = HC.introduced(A.id) ? A : s;
            if (ok) { score++; correct(b); rec.ok(mk); } else { b.classList.add("wrong"); wrong(); rec.bad(mk); }
            fb.className = "feedback " + (ok ? "ok" : "no"); fb.textContent = ans + " · " + A.am + " · " + HC.meaningShort(A);
            HC.later(function () { i++; if (i < N) round(); else finish(v, g, score, { label: score + " / " + N, rec: rec }); }, ok ? 900 : 1800);
          };
        });
      }
      round();
    } });

  // 9. Viết trên màn hình
  reg({ id: "write", icon: "筆", name: "Viết trên màn hình", desc: "Nhìn âm và nghĩa rồi viết chữ Hán: viết ra giấy rồi tự chấm (mặc định), hoặc viết trên màn hình để app tự chấm — chọn ở Cài đặt → Cách tập viết. Tính vào lịch tập viết.",
    run: function (v) {
      var g = this, P1 = HC.pool("c", 0), P2 = HC.pool("w", 0);
      if (!P1.items.length && !P2.items.length) return lock(v, g, "Cần học ít nhất 1 chữ để chơi trò này.");
      var items = HC.pickWeak(P1.items, 6).concat(HC.pickWeak(P2.items, 2));
      var tabs = head(g);
      HC.writeSession(v, tabs, items, true, function (ok, n) { finish(v, g, ok, { label: ok + " / " + n, msg: "Viết đúng " + ok + " trên " + n + " mục" }); });
    } });

  // 10. Đấu cuối tuần (bài thi ngắn chấm tự động)
  reg({ id: "weekly", icon: "試", name: "Đấu cuối tuần", desc: "Bài thi ngắn 20 câu: gõ phiên âm, chọn nghĩa, nhận diện loại từ. Thang 100 điểm.",
    run: function (v) {
      var g = this, Pw = HC.pool("w", 0), Pc = HC.pool("c", 0), qs = [], rec = HC.gameRec();
      HC.pickWeak(Pw.items, 8).forEach(function (w) { qs.push({ kind: "type", it: w, pts: 5, part: "Phiên âm", rec: rec }); });
      HC.pickWeak(Pc.items, 6).forEach(function (c) { qs.push({ kind: "mean", it: c, pts: 5, part: "Nghĩa của chữ", rec: rec }); });
      var inPlan = HC.focusLt && HC.focusLt() === "gk3"; // kỳ thi gần nhất đang học là giữa kỳ 3: loại từ theo 7 loại của đề cương giữa kỳ 3
      var GG = inPlan ? G7 : G5, st = inPlan ? "gk3" : undefined;
      if (ltKeys(GG, st, true).length) for (var k = 0; k < 6; k++) qs.push({ kind: "lt", q: ltQuestion(GG, st, true), groups: GG, pts: 5, part: "Loại từ", rec: rec });
      if (qs.length < 5) return lock(v, g, "Cần học thêm chữ, từ: bài đấu cần ít nhất 5 câu hỏi lấy từ phần bạn đã học.");
      var pt = 100 / qs.length; qs.forEach(function (q) { q.pts = pt; }); // ít mục đã học thì ít câu hơn, vẫn thang 100
      runQuiz(v, head(g), qs, function (score, max, parts) { finish(v, g, Math.round(score), { label: Math.round(score) + " / 100", msg: parts, bonus: Math.round(score / 4), rec: rec }); });
    } });

  // ========== KHO KHÓ: 2 trò luyện mục người học tự đánh dấu khó (kế hoạch kho khó, Bước 3) ==========
  // Nguồn: cả kho khó HOẶC 1–nhiều playlist; loại chữ / từ / câu / bộ thủ; số câu. Kết quả CHỈ ghi vào S.gm (HC.gmRec) — KHÔNG đổi lịch ôn S.it.
  // Lựa chọn nhớ ở localStorage "hanco-kho-luyen" (tiện ích từng máy, không đồng bộ, không thuộc S).
  var KS_KEY = "hanco-kho-luyen", KS_TYPES = [["c", "Chữ"], ["w", "Từ"], ["s", "Câu"], ["r", "Bộ thủ"]], ksAuto = false, ksOnly = null;
  var KG = { khoam: "Hán → âm Hán Việt", khohan: "Âm + nghĩa → chữ Hán" };
  function ksGet() {
    var o = {}; try { o = JSON.parse(localStorage.getItem(KS_KEY) || "{}") || {}; } catch (e) { o = {}; }
    var types = Array.isArray(o.types) ? o.types.filter(function (t) { return /^[cwsr]$/.test(t); }) : [];
    return { src: o.src === "pl" ? "pl" : "all", pls: Array.isArray(o.pls) ? o.pls.filter(function (k) { return typeof k === "string"; }) : [], types: types.length ? types : ["c", "w", "s", "r"], n: [10, 20, 30].indexOf(o.n) >= 0 ? o.n : 10, mode: o.mode === "write" ? "write" : "mc" };
  }
  function ksPut(o) { try { localStorage.setItem(KS_KEY, JSON.stringify(o)); } catch (e) { } }
  // mục theo lựa chọn: cả kho, hoặc hợp các playlist đã chọn (playlist đã xóa tự bỏ qua); lọc theo loại
  function ksItems(o) {
    var list = [];
    if (o.src === "pl") { var seen = {}; HC.plList().forEach(function (p) { if (o.pls.indexOf(p.id) < 0) return; p.ids.forEach(function (id) { if (!seen[id]) { seen[id] = 1; list.push(HC.ITEM[id]); } }); }); }
    else list = HC.hardList();
    return list.filter(function (it) { return it && o.types.indexOf(it.type) >= 0; });
  }
  // ưu tiên mục sai nhiều (S.gm); mục chưa chơi lần nào cũng được ưu tiên; không lặp mục trong một lượt
  function ksW(it) { var g = (HC.state().gm || {})[it.id]; return g ? Math.max(0.5, 1 + g[1] * 2 - g[0] * 0.5) : 3; }
  function ksPick(items, n) {
    var pool = items.slice(), out = [];
    while (out.length < n && pool.length) {
      var tot = 0, x = 0, k; pool.forEach(function (it) { tot += ksW(it); });
      var r = Math.random() * tot;
      for (k = 0; k < pool.length; k++) { x += ksW(pool[k]); if (r < x) break; }
      out.push(pool.splice(Math.min(k, pool.length - 1), 1)[0]);
    }
    return U().shuffle(out);
  }
  // khung chọn nguồn luyện — dùng ở màn Kho khó (thẻ Luyện, gid trống → 2 nút vào 2 trò) và đầu mỗi trò (gid = id trò)
  HC.khoSetup = function (box, gid) {
    var o = ksGet();
    function draw() {
      var L = HC.plList(), live = {}; L.forEach(function (p) { live[p.id] = 1; });
      o.pls = o.pls.filter(function (k) { return live[k]; });
      if (o.src === "pl" && !L.length) o.src = "all";
      var items = ksItems(o), nq = Math.min(o.n, items.length), nh = HC.hardList().length;
      var h = '<div class="card ksu"><h2>Luyện kho khó</h2><p class="sub">Kết quả chỉ ghi đúng / sai để lần sau hỏi trước mục sai nhiều — <b>không đổi lịch ôn</b> của thẻ.</p>';
      h += '<div class="ksg"><b>Nguồn</b><div class="ksopts"><label class="plck"><input type="radio" name="kss" value="all"' + (o.src === "all" ? " checked" : "") + '><span>Cả kho khó <span class="num muted">(' + nh + ' mục)</span></span></label><label class="plck"><input type="radio" name="kss" value="pl"' + (o.src === "pl" ? " checked" : "") + (L.length ? "" : " disabled") + "><span>Chọn playlist" + (L.length ? "" : ' <small class="muted">(chưa có playlist)</small>') + "</span></label></div>";
      if (o.src === "pl") h += '<div class="ksopts kspl">' + L.map(function (p) { return '<label class="plck"><input type="checkbox" data-kp="' + esc(p.id) + '"' + (o.pls.indexOf(p.id) >= 0 ? " checked" : "") + "><span>" + esc(p.n) + ' <span class="num muted">(' + p.ids.length + ")</span></span></label>"; }).join("") + "</div>";
      h += "</div>";
      h += '<div class="ksg"><b>Loại mục</b><div class="ksopts">' + KS_TYPES.map(function (t) { return '<label class="plck"><input type="checkbox" data-kt="' + t[0] + '"' + (o.types.indexOf(t[0]) >= 0 ? " checked" : "") + "><span>" + t[1] + "</span></label>"; }).join("") + "</div></div>";
      h += '<div class="ksg"><b>Số câu hỏi</b><div class="ksopts">' + [10, 20, 30].map(function (n) { return '<label class="plck"><input type="radio" name="ksn" value="' + n + '"' + (o.n === n ? " checked" : "") + '><span class="num">' + n + "</span></label>"; }).join("") + "</div></div>";
      if (gid !== "khoam") h += '<div class="ksg"><b>Chữ / từ / bộ thủ trả lời bằng</b>' + (gid ? "" : ' <small class="muted">(trò ' + esc(KG.khohan) + ")</small>") + '<div class="ksopts"><label class="plck"><input type="radio" name="ksm" value="mc"' + (o.mode === "mc" ? " checked" : "") + '><span>Trắc nghiệm 4 lựa chọn</span></label><label class="plck"><input type="radio" name="ksm" value="write"' + (o.mode === "write" ? " checked" : "") + '><span>' + (HC.vietMode() === "tt" ? "Viết tay trên màn hình (app tự chấm)" : "Viết chữ (ra giấy rồi tự chấm)") + '</span></label></div><small class="muted">Câu: luôn là xếp các chữ theo đúng thứ tự.</small></div>';
      var msg = !nh ? "Kho khó đang trống. Bấm nút ⋯ cạnh một chữ, từ, câu hay bộ thủ (Tra cứu, Câu, Bộ thủ, thẻ học, thẻ ôn) rồi chọn “☆ Thêm vào kho khó”."
        : o.src === "pl" && !o.pls.length ? "Hãy đánh dấu ít nhất 1 playlist."
        : !o.types.length ? "Hãy chọn ít nhất 1 loại mục."
        : !items.length ? "Nguồn đã chọn không có mục thuộc loại này."
        : "Đang chọn " + items.length + " mục → " + nq + " câu hỏi" + (items.length < o.n ? " (mỗi mục hỏi 1 lần)" : "") + ".";
      h += '<p><span class="chip' + (items.length ? "" : " warn") + '" id="ksmsg">' + esc(msg) + "</span></p>" + (nh ? "" : '<p><a class="btn" href="#tra">Mở Tra cứu</a> <a class="btn" href="#cau">Mở danh sách Câu</a></p>') + "</div>";
      h += '<div class="row acts">' + (gid ? [gid] : ["khoam", "khohan"]).map(function (k) { return '<button type="button" class="btn primary" data-ks="' + k + '"' + (items.length ? "" : " disabled") + ">" + (gid ? "Bắt đầu" : "▶ " + esc(KG[k])) + "</button>"; }).join("") + "</div>";
      box.innerHTML = h;
    }
    box.onchange = function (e) {
      var t = e.target, k;
      if (t.name === "kss") { o.src = t.value; if (o.src === "pl" && !o.pls.length) o.pls = HC.plList().map(function (p) { return p.id; }); }
      else if (t.name === "ksn") o.n = +t.value;
      else if (t.name === "ksm") o.mode = t.value;
      else if (t.hasAttribute("data-kp")) { k = t.getAttribute("data-kp"); o.pls = o.pls.filter(function (x) { return x !== k; }); if (t.checked) o.pls.push(k); }
      else if (t.hasAttribute("data-kt")) { k = t.getAttribute("data-kt"); o.types = o.types.filter(function (x) { return x !== k; }); if (t.checked) o.types.push(k); }
      else return;
      ksPut(o); draw();
    };
    box.onclick = function (e) {
      var b = e.target.closest("[data-ks]"); if (!b || b.disabled) return;
      ksPut(o); ksAuto = true; ksOnly = null;
      if (gid) HC.route(); else HC.go("choi-" + b.getAttribute("data-ks"));
    };
    draw();
  };
  // vào trò: vừa bấm Bắt đầu / Chơi lại / Luyện lại mục sai → chơi ngay; còn lại → hiện khung chọn nguồn
  function ksStart(v, g, play) {
    if (ksAuto) {
      ksAuto = false;
      var o = ksGet(), items = ksOnly || ksItems(o); ksOnly = null;
      if (items.length) return play(o, ksPick(items, Math.min(o.n, items.length)));
    }
    v.innerHTML = head(g) + '<div id="ksu"></div>';
    HC.khoSetup(v.querySelector("#ksu"), g.id);
  }
  function ksFinish(v, g, score, N, rec, msg) {
    finish(v, g, score, { label: score + " / " + N, msg: msg, rec: rec });
    var ag = v.querySelector("#again"); if (!ag) return;
    ag.onclick = function () { ksAuto = true; HC.route(); };
    var bad = rec.bad_.slice(), box = ag.parentNode;
    if (bad.length) { var b = document.createElement("button"); b.className = "btn"; b.textContent = "Luyện lại " + bad.length + " mục sai"; b.onclick = function () { ksAuto = true; ksOnly = bad; HC.route(); }; box.insertBefore(b, ag.nextSibling); }
    box.insertAdjacentHTML("beforeend", '<a class="btn" href="#kho-luyen">Đổi nguồn luyện</a>');
  }
  function ksTop(it, i, N) { return '<div class="row" style="width:min(680px,100%)"><span class="chip num">' + (i + 1) + " / " + N + '</span><span class="chip">' + esc(HC.kindLabel(it)) + "</span></div>"; }
  function ksAns(it) { return '<div class="ans"><div class="am">' + esc(it.am) + "</div>" + HC.meanHTML(it) + "</div>"; }

  // 12. Kho khó: Hán → âm Hán Việt (PHẢI đúng dấu; chữ nhiều âm: âm nào có trong dữ liệu cũng được; câu so với phiên âm đề cương)
  reg({ id: "khoam", icon: "難", name: "Kho khó: Hán → âm", desc: "Mục trong kho khó (cả kho hoặc playlist bạn chọn): nhìn chữ / từ / câu / bộ thủ, gõ âm Hán Việt — phải đúng dấu. Không đổi lịch ôn.",
    run: function (v) { var g = this; ksStart(v, g, function (o, items) { khoAm(v, g, items); }); } });
  function khoAm(v, g, items) {
    var i = 0, score = 0, N = items.length, rec = HC.gmRec();
    function round() {
      var it = items[i], isS = it.type === "s", used = false;
      v.innerHTML = head(g) + '<div class="stage">' + ksTop(it, i, N) + '<div class="fc" style="min-height:auto">' + (isS ? '<div class="sent">' + esc(it.han) + "</div>" : '<div class="big ' + U().lenCls(it.key) + '">' + esc(it.key) + "</div>") + '<div class="muted">Gõ âm Hán Việt' + (isS ? " của cả câu" : "") + " — phải đúng dấu</div></div>" +
        '<input class="answer" id="in" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="' + (isS ? "Phiên âm cả câu, có dấu…" : "Âm Hán Việt, có dấu…") + '" aria-label="Âm Hán Việt">' +
        '<div class="ksfb hide" id="fb" role="status"></div><div class="row acts"><button class="btn" id="idk">Không nhớ</button><button class="btn primary" id="ok">Kiểm tra</button><button class="btn primary hide" id="nx">' + (i + 1 < N ? "Câu tiếp →" : "Xem kết quả") + "</button></div></div>";
      setScore(v, score);
      var inp = v.querySelector("#in"), fb = v.querySelector("#fb"), okb = v.querySelector("#ok"), idk = v.querySelector("#idk"), nx = v.querySelector("#nx");
      function reveal(r) { // r: 2 đúng dấu · 1 đúng âm sai dấu · 0 sai · -1 không nhớ
        used = true; inp.disabled = true; okb.classList.add("hide"); idk.classList.add("hide"); nx.classList.remove("hide");
        var good = r === 2;
        if (good) { score++; correct(okb); rec.ok(it); } else { wrong(); rec.bad(it); }
        fb.className = "ksfb " + (good ? "ok" : "no");
        fb.innerHTML = '<div class="verdict">' + (good ? "Đúng ✓" : r === 1 ? "Đúng âm nhưng sai / thiếu dấu ✗ (trò này phải đúng dấu)" : r === -1 ? "Đã tính là chưa nhớ ✗" : "Chưa đúng ✗") + "</div>" + ksAns(it);
        setScore(v, score);
        try { nx.focus(); } catch (e) { }
      }
      function check() { if (used) return; if (!inp.value.trim()) { HC.toast("Hãy gõ âm Hán Việt (có dấu) rồi bấm Kiểm tra"); try { inp.focus(); } catch (e) { } return; } reveal(HC.checkAm(inp.value, it.am)); }
      okb.onclick = check; idk.onclick = function () { if (!used) reveal(-1); }; nx.onclick = next;
      inp.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); check(); } });
      HC.later(function () { try { inp.focus(); } catch (e) { } }, 30);
    }
    function next() { i++; if (i < N) round(); else ksFinish(v, g, score, N, rec, "Gõ đúng âm (đúng dấu) " + score + " trên " + N + " mục"); }
    round();
  }

  // 13. Kho khó: âm + nghĩa → chữ Hán. Chữ / từ: trắc nghiệm 4 lựa chọn hoặc viết tay (chấm tự động như tập viết); câu: xếp chữ.
  reg({ id: "khohan", icon: "認", name: "Kho khó: âm + nghĩa → chữ Hán", desc: "Mục trong kho khó: nhìn âm và nghĩa, chọn đúng chữ Hán (trắc nghiệm) hoặc viết tay; câu thì xếp các chữ theo thứ tự. Không đổi lịch ôn.",
    run: function (v) { var g = this; ksStart(v, g, function (o, items) { khoHan(v, g, items, o.mode); }); } });
  // nhiễu hợp lý: chữ → 1 cùng bộ, 1 gần âm, 1 gần hình (cùng bộ, số nét chênh ≤ 2); từ → cùng số chữ, chung chữ / gần âm;
  // bộ thủ → bộ khác số nét gần / gần âm. Thiếu → HC.distract
  function khoDistract(it) {
    var u = U(), out = [], used = {};
    used[it.key] = 1;
    u.chars((it.v || "") + (it.gt || "") + (it.dt || "")).forEach(function (c) { used[c] = 1; }); // không lấy dị thể / dạng rút gọn của chính nó
    function fa(x) { return u.fold(HC.firstAm(x.am)); }
    var A = fa(it), A2 = A.slice(0, 2);
    function take(arr) {
      arr = arr.filter(function (x) { return x.key && !used[x.key] && !(x.am === it.am && (x.ns || "") === (it.ns || "")); });
      var c = arr.filter(function (x) { return x.common; }); if (c.length) arr = c;
      if (!arr.length) return false;
      var x = arr[Math.floor(Math.random() * arr.length)]; used[x.key] = 1; out.push(x); return true;
    }
    if (it.type === "c") {
      var C = HC.D.chars, net = it.net || 0;
      if (it.rad) take(C.filter(function (x) { return x.rad === it.rad; }));
      take(C.filter(function (x) { return fa(x) === A; })) || take(C.filter(function (x) { return fa(x).slice(0, 2) === A2; }));
      if (it.rad) take(C.filter(function (x) { return x.rad === it.rad && Math.abs((x.net || 0) - net) <= 2; }));
    } else if (it.type === "r") { // bộ thủ: 1 số nét gần (±1), 1 gần âm, 1 cùng số nét
      var R = HC.D.rads, rn = it.net || 0;
      take(R.filter(function (x) { return Math.abs((x.net || 0) - rn) <= 1; }));
      take(R.filter(function (x) { return fa(x) === A; })) || take(R.filter(function (x) { return fa(x).slice(0, 2) === A2; }));
      take(R.filter(function (x) { return (x.net || 0) === rn; }));
    } else {
      var ks = u.chars(it.key), n = ks.length, W = HC.D.words.filter(function (x) { return u.chars(x.w).length === n; });
      take(W.filter(function (x) { return u.chars(x.w).some(function (c) { return ks.indexOf(c) >= 0; }); }));
      take(W.filter(function (x) { return fa(x).split(" ")[0] === A.split(" ")[0]; }));
      take(W.filter(function (x) { return u.chars(x.w).some(function (c) { return ks.indexOf(c) >= 0; }); }));
    }
    if (out.length < 3) HC.distract(it, 8, "am").forEach(function (x) { if (out.length < 3 && !used[x.key]) { used[x.key] = 1; out.push(x); } });
    return out.slice(0, 3);
  }
  // câu ≤ 16 chữ: xếp cả câu; dài hơn: chia theo vế (mỗi phần ≤ 16 chữ) và xếp lần lượt
  function sChunks(s) {
    var u = U(), parts = [], cur = [];
    u.chars(s.han).forEach(function (ch) { if (u.isHan(ch)) cur.push(ch); else if (cur.length) { parts.push(cur); cur = []; } });
    if (cur.length) parts.push(cur);
    var all = [].concat.apply([], parts); if (all.length <= 16) return [all];
    var out = [], buf = [];
    parts.forEach(function (p) {
      while (p.length > 16) { if (buf.length) { out.push(buf); buf = []; } out.push(p.slice(0, 12)); p = p.slice(12); }
      if (buf.length && buf.length + p.length > 16) { out.push(buf); buf = []; }
      buf = buf.concat(p);
    });
    if (buf.length) out.push(buf);
    return out;
  }
  function khoHan(v, g, items, mode) {
    var i = 0, score = 0, N = items.length, rec = HC.gmRec(), wPad = HC.vietMode() === "tt"; // chế độ viết của máy này; Mở / Đóng bảng viết đổi cho cả lượt
    function nxLabel() { return i + 1 < N ? "Câu tiếp →" : "Xem kết quả"; }
    function result(good, el) { var it = items[i]; if (good) { score++; correct(el); rec.ok(it); } else { wrong(); rec.bad(it); } setScore(v, score); }
    function round() { var it = items[i]; if (it.type === "s") qOrder(it); else if (mode === "write") qWrite(it); else qChoice(it); }
    function next() { i++; if (i < N) round(); else ksFinish(v, g, score, N, rec, "Đúng " + score + " trên " + N + " mục"); }
    // trắc nghiệm 4 lựa chọn
    function qChoice(it) {
      var opts = U().shuffle([it].concat(khoDistract(it)));
      v.innerHTML = head(g) + '<div class="stage">' + ksTop(it, i, N) + '<div class="fc" style="min-height:auto">' + ksAns(it) + '<div class="muted">Chọn đúng ' + (it.type === "c" ? "chữ Hán" : it.type === "r" ? "bộ thủ" : "từ Hán") + '</div></div><div class="choices kschoice">' +
        opts.map(function (o, k) { var n = U().chars(o.key).length; return '<button class="choice" data-k="' + k + '"><span class="han"' + (n > 3 ? ' style="font-size:' + (n > 5 ? 1.15 : 1.45) + 'rem"' : "") + ">" + esc(o.key) + "</span></button>"; }).join("") +
        '</div><div class="ksfb hide" id="fb" role="status"></div><div class="row acts"><button class="btn primary hide" id="nx">' + nxLabel() + "</button></div></div>";
      setScore(v, score);
      var fb = v.querySelector("#fb"), nx = v.querySelector("#nx");
      nx.onclick = next;
      U().$$(".kschoice .choice", v).forEach(function (b) {
        b.onclick = function () {
          var o = opts[+b.dataset.k], ok = o === it;
          U().$$(".kschoice .choice", v).forEach(function (x) { x.disabled = true; if (opts[+x.dataset.k] === it) x.classList.add("right"); });
          if (!ok) b.classList.add("wrong");
          result(ok, b);
          fb.className = "ksfb " + (ok ? "ok" : "no");
          fb.innerHTML = '<div class="verdict">' + (ok ? "Đúng ✓" : "Chưa đúng ✗") + '</div><div><span class="han ksh">' + esc(it.key) + "</span></div>" + (ok ? "" : '<div class="muted">Bạn chọn <span class="han">' + esc(o.key) + "</span> = " + esc(o.am) + " · " + esc(HC.meaningShort(o)) + "</div>");
          nx.classList.remove("hide"); try { nx.focus(); } catch (e) { }
        };
      });
    }
    // viết tay: chấm bằng gradeShape (HC.makePad), chỉ bắt buộc chữ phồn thể; 28 chữ hiếm chưa có dữ liệu → tự so với chữ mẫu
    function qWrite(it) {
      var scored = false, firstG = null;
      var info = HC.vietPrompt(it).replace(" chữ</div></div></div>", " chữ · viết chữ phồn thể</div></div></div>");
      var kh = "Hãy viết thật rồi tự chấm cho đúng: app ghi lại chữ nào bạn còn hay sai để bạn luyện lại trong kho khó.";
      v.innerHTML = head(g) + '<div class="stage">' + ksTop(it, i, N) + '<div class="work"><div class="winfo">' + info +
        (wPad ? '<div class="row" style="justify-content:center" id="giveup"><button class="btn sm ghost" id="selfg">Tự chấm (xem đáp án)</button>' + (HC.vietMode() === "gt" ? '<button class="btn sm ghost" id="cpad">Đóng bảng viết</button>' : "") + "</div>" : "") + "</div>" +
        (wPad ? '<div class="wpadc"><div class="padwrap" id="padbox"></div><div class="acts"><div class="row" id="w1"><button class="btn" id="undo">Xóa nét cuối</button><button class="btn" id="clr">Xóa hết</button><button class="btn" id="idk">Không nhớ</button><button class="btn primary" id="chk">Chấm điểm</button></div>'
          : '<div class="wpadc"><div class="vans" id="vans"><span class="muted">Viết ra giấy rồi bấm Xem đáp án — đáp án sẽ hiện ở đây</span></div><div class="acts"><div class="row" id="w1"><button class="btn" id="opad">✎ Mở bảng viết</button><button class="btn primary" id="rev">Xem đáp án</button></div>') +
        '<div class="row hide" id="self"><button class="btn bad" id="sbad">Tôi viết sai</button><button class="btn good" id="sgood">Tôi viết đúng</button></div><div class="row hide" id="aft"><button class="btn primary" id="nx">' + nxLabel() + "</button></div></div></div>" +
        '<div class="wfb"><div class="gfb hide" id="fb" role="status"></div><div class="row hide" id="apl" style="justify-content:center"><button class="btn sm ghost" id="appeal">Tôi viết đúng mà — tính là Đúng</button></div>' + (wPad ? "" : HC.vietGuide(false, kh)) + "</div></div></div>";
      setScore(v, score);
      var q = function (s) { return v.querySelector(s); }, fb = q("#fb");
      function say(h) { fb.innerHTML = h; fb.classList.remove("hide"); }
      function show(id) { ["w1", "self", "aft"].forEach(function (x) { q("#" + x).classList.toggle("hide", x !== id); }); var gu = q("#giveup"); if (gu) gu.classList.add("hide"); }
      q("#nx").onclick = next;
      q("#sgood").onclick = function () { scored = true; result(true, this); say('<div class="verdict ok">Đã ghi: viết đúng ✓</div>'); show("aft"); };
      q("#sbad").onclick = function () { scored = true; result(false, this); say('<div class="verdict no">Đã ghi: viết sai ✗</div><div class="muted">Không sao, luyện thêm chữ này nhé: <span class="han">' + esc(it.key) + "</span></div>"); show("aft"); };
      if (!wPad) { // viết gián tiếp: viết ra giấy → Xem đáp án → tự chấm
        q("#opad").onclick = function () { wPad = true; qWrite(it); };
        q("#rev").onclick = function () { q("#vans").innerHTML = HC.vietAnswer(it, false); say('<div class="muted">So chữ bạn đã viết với đáp án ở trên (đúng chữ phồn thể, đúng từng nét), rồi tự chấm bên dưới.</div>'); show("self"); };
        return;
      }
      var pad = HC.makePad(q("#padbox"), it.key, { onEdit: function () { if (!scored) fb.classList.add("hide"); } });
      q("#selfg").onclick = function () { if (scored) return; pad.model(true); say('<div class="verdict">Đáp án: <span class="han">' + esc(it.key) + '</span></div><div class="muted">Chữ mẫu hiện mờ trong ô viết. So với chữ bạn viết rồi tự chấm bên dưới.</div>'); show("self"); };
      var cp = q("#cpad"); if (cp) cp.onclick = function () { wPad = false; qWrite(it); };
      q("#undo").onclick = pad.undo; q("#clr").onclick = pad.clear;
      q("#idk").onclick = function () { scored = true; result(false, this); pad.model(true); say('<div class="verdict no">Đã tính là chưa nhớ ✗</div><div class="muted">Chữ mẫu hiện mờ trong ô viết: <span class="han">' + esc(it.key) + "</span></div>"); show("aft"); };
      var chk = q("#chk");
      chk.onclick = function () {
        if (pad.empty()) { HC.toast("Hãy viết chữ vào ô trước rồi bấm Chấm điểm"); return; }
        chk.disabled = true; chk.textContent = "Đang chấm…";
        pad.grade().then(function (res) {
          chk.disabled = false; chk.textContent = "Chấm điểm";
          var nod = res.some(function (r) { return r.nodata; }), good = res.every(function (r) { return r.ok || r.nodata; });
          var lines = res.map(function (r) { return '<div class="' + (r.nodata ? "" : r.ok ? "ok" : "no") + '"><span class="han">' + esc(r.ch) + "</span> " + esc(r.msg) + "</div>"; }).join("");
          if (nod) { pad.model(true); say(lines + '<div class="verdict">Bạn tự so với chữ mẫu rồi chọn bên dưới</div>'); show("self"); return; }
          scored = true; firstG = pad.graded(); result(good, chk);
          var asGt = !good && it.gt && pad.alsoIs(it.gt).some(Boolean) ? '<div class="no">Bạn đã viết dạng rút gọn <span class="han">' + esc(it.gt) + '</span>. Ở đây cần chữ phồn thể <span class="han">' + esc(it.key) + "</span>.</div>" : "";
          say('<div class="verdict ' + (good ? "ok" : "no") + '">' + (good ? "Đúng ✓" : "Chưa đúng ✗") + "</div>" + asGt + lines + (good ? "" : '<div class="muted">Chữ mẫu hiện mờ phía sau.</div>'));
          q("#apl").classList.toggle("hide", good);
          show("aft");
        }, function () {
          chk.disabled = false; chk.textContent = "Chấm điểm"; pad.model(true);
          say('<div class="verdict">Không tải được dữ liệu chấm (có thể đang mất mạng)</div><div class="muted">Tự so với chữ mẫu rồi chọn bên dưới.</div>');
          show("self");
        });
      };
      q("#appeal").onclick = function () {
        rec.fix(it); score++; HC.addXP(1, this); setScore(v, score);
        if (firstG) HC.saveSample(it.key, firstG, pad.size, "dung");
        q("#apl").classList.add("hide");
        say('<div class="verdict ok">Đã tính là Đúng ✓</div><div class="muted">Cảm ơn bạn! Chữ này đã được lưu để chỉnh lại cách chấm (Tập viết → Mẫu chấm nhầm).</div>');
      };
    }
    // câu: xếp các chữ theo đúng thứ tự (câu dài: từng vế); đúng khi không bấm sai lần nào
    function qOrder(it) {
      var chunks = sChunks(it), ci = 0, miss = 0, over = false;
      function draw() {
        var need = chunks[ci], tiles = U().shuffle(need.map(function (c, k) { return { c: c, k: k }; })), pos = 0;
        v.innerHTML = head(g) + '<div class="stage">' + ksTop(it, i, N) + '<div class="card" style="width:min(680px,100%);text-align:center"><div style="font-weight:700">' + esc(it.pa) + '</div><div class="muted">' + esc(it.dn) + '</div><p class="sub" style="margin:6px 0 0">Bấm các chữ theo đúng thứ tự' + (chunks.length > 1 ? " · phần " + (ci + 1) + " / " + chunks.length : "") + "</p></div>" +
          (ci ? '<div class="sent ksdone">' + esc(chunks.slice(0, ci).map(function (x) { return x.join(""); }).join(" ")) + "</div>" : "") +
          '<div class="slots" id="sl"></div><div class="tiles" id="tl">' + tiles.map(function (t, j) { return '<button class="tile" data-j="' + j + '">' + esc(t.c) + "</button>"; }).join("") + '</div><div class="ksfb hide" id="fb" role="status"></div><div class="row acts"><button class="btn" id="idk">Không nhớ — xem câu</button><button class="btn primary hide" id="nx">' + nxLabel() + "</button></div></div>";
        setScore(v, score);
        v.querySelector("#nx").onclick = next;
        v.querySelector("#idk").onclick = function () { if (!over) { miss++; end(); } };
        U().$$("#tl .tile", v).forEach(function (b) {
          b.onclick = function () {
            if (over || b.classList.contains("used")) return;
            var t = tiles[+b.dataset.j];
            if (t.c === need[pos]) {
              b.classList.add("used"); v.querySelector("#sl").insertAdjacentHTML("beforeend", '<span class="tile">' + esc(t.c) + "</span>"); pos++; HC.beep(true);
              if (pos === need.length) { ci++; if (ci < chunks.length) HC.later(draw, 450); else end(); }
            } else { miss++; wrong(); b.classList.add("pop"); HC.later(function () { b.classList.remove("pop"); }, 300); }
          };
        });
      }
      function end() {
        over = true;
        var good = !miss, fb = v.querySelector("#fb");
        result(good, v.querySelector("#sl"));
        U().$$("#tl .tile", v).forEach(function (b) { b.disabled = true; });
        v.querySelector("#idk").classList.add("hide");
        fb.className = "ksfb " + (good ? "ok" : "no");
        fb.innerHTML = '<div class="verdict">' + (good ? "Hoàn hảo ✓" : "Chưa đúng ✗ (bấm sai hoặc xem đáp án)") + '</div><div class="sent">' + esc(it.han) + "</div>";
        var nx = v.querySelector("#nx"); nx.classList.remove("hide"); try { nx.focus(); } catch (e) { }
      }
      draw();
    }
    round();
  }

  // ---------- generic quiz runner (Đấu cuối tuần + Thi thử) ----------
  function runQuiz(v, headHTML, qs, done) {
    var i = 0, score = 0, max = 0, byPart = {};
    qs.forEach(function (q) { max += q.pts; byPart[q.part] = byPart[q.part] || { got: 0, max: 0 }; byPart[q.part].max += q.pts; });
    function award(q, pts) { score += pts; byPart[q.part].got += pts; }
    function nav() { return '<div class="row" style="width:min(640px,100%)"><span class="chip">' + esc(qs[i].part) + '</span><span class="spacer"></span><span class="chip num">Câu ' + (i + 1) + " / " + qs.length + "</span></div>"; }
    function next() { i++; if (i < qs.length) ask(); else { var parts = Object.keys(byPart).map(function (p) { return p + ": " + (Math.round(byPart[p].got * 10) / 10) + "/" + (Math.round(byPart[p].max * 10) / 10); }).join(" · "); done(score, max, parts, byPart); } }
    function ask() {
      var q = qs[i], h = headHTML + '<div class="stage">' + nav();
      var nextBtn = '<button class="btn primary hide" id="nx">Câu tiếp →</button>';
      if (q.kind === "type") {
        h += '<div class="fc" style="min-height:200px"><div class="big ' + U().lenCls(q.it.key) + '">' + esc(q.it.key) + '</div><div class="muted">Viết phiên âm Hán Việt (có dấu)</div></div><input class="answer" id="in" type="text" autocomplete="off" spellcheck="false" aria-label="Phiên âm"><div class="row acts"><button class="btn primary" id="ok">Kiểm tra</button>' + nextBtn + '</div><div class="feedback" id="fb"></div>';
      } else if (q.kind === "mean") {
        var opts = U().shuffle([q.it].concat(HC.distract(q.it, 3, "am", !q.rec)));
        q.opts = opts;
        h += '<div class="fc" style="min-height:200px"><div class="big">' + esc(q.it.key) + '</div><div class="muted">Chọn âm và nghĩa đúng</div></div><div class="choices one">' + opts.map(function (o, k) { return '<button class="choice" data-k="' + k + '"><b>' + esc(o.am) + "</b> — " + esc(HC.meaningShort(o)) + "</button>"; }).join("") + '</div><div class="row acts">' + nextBtn + '</div><div class="feedback" id="fb"></div>';
      } else if (q.kind === "lt") {
        var groups = q.groups || G5;
        h += '<div class="card" style="width:min(640px,100%)"><div class="sent">' + q.q.ctx + '</div><p class="sub" style="text-align:center">Chữ gạch chân thuộc loại từ nào?</p></div><div class="choices one">' + groups.map(function (n, k) { return '<button class="choice" data-g="' + esc(n) + '">' + String.fromCharCode(65 + k) + ". " + esc(n) + "</button>"; }).join("") + '</div><div class="row acts">' + nextBtn + '</div><div class="feedback" id="fb"></div>';
      } else if (q.kind === "phrase") {
        h += '<div class="card" style="width:min(640px,100%);text-align:center"><div class="han" style="font-size:2rem">' + esc(q.han) + '</div><p class="muted">Nghĩa của cụm này là gì?</p></div><div class="choices one">' + q.opts.map(function (o, k) { return '<button class="choice" data-k="' + k + '">' + esc(o) + "</button>"; }).join("") + '</div><div class="row acts">' + nextBtn + '</div><div class="feedback" id="fb"></div>';
      } else if (q.kind === "self") {
        h += '<div class="card" style="width:min(680px,100%);text-align:center"><div class="sent">' + esc(q.s.han) + '</div><p class="muted">Đọc to phiên âm và dịch nghĩa (hoặc viết ra giấy), rồi bấm Xem đáp án và tự chấm.</p><div id="ansbox" class="hide"><div style="font-weight:700">' + esc(q.s.pa) + "</div><div>" + esc(q.s.dn) + '</div></div></div><div class="row acts"><button class="btn primary" id="rev">Xem đáp án</button></div><div class="row hide" id="sg"><label class="row"><input type="checkbox" id="c1"> Phiên âm đúng (' + q.a + 'đ)</label><label class="row"><input type="checkbox" id="c2"> Dịch đúng (' + q.b + 'đ)</label><button class="btn primary" id="sv">Chấm &amp; tiếp</button></div>';
      } else if (q.kind === "write") {
        h += '<div class="card" style="width:min(680px,100%);text-align:center"><div style="font-weight:700;font-size:1.1rem">' + esc(q.s.pa) + '</div><div class="muted">' + esc(q.s.dn) + '</div><p class="sub">' + (HC.vietMode() === "tt" ? "Viết câu bằng chữ Hán vào ô dưới (hoặc ra giấy), rồi bấm Xem đáp án và tự chấm." : "Viết câu bằng chữ Hán ra giấy (hoặc bất cứ đâu), rồi bấm Xem đáp án và tự chấm cho đúng — giống như khi thi thật. Muốn viết trên màn hình thì bấm “Mở bảng viết”.") + '</p></div><div class="padwrap' + (HC.vietMode() === "tt" ? "" : " hide") + '" id="padbox"></div><div class="row acts">' + (HC.vietMode() === "tt" ? "" : '<button class="btn" id="opad">✎ Mở bảng viết</button>') + '<button class="btn' + (HC.vietMode() === "tt" ? "" : " hide") + '" id="clr">Xóa</button><button class="btn primary" id="rev">Xem đáp án</button></div><div id="ansbox" class="sent hide">' + esc(q.s.han) + '</div><div class="row hide" id="sg"><button class="btn bad" data-p="0">Sai nhiều (0đ)</button><button class="btn warn" data-p="' + (q.pts / 2) + '">Đúng một phần (' + (q.pts / 2) + 'đ)</button><button class="btn good" data-p="' + q.pts + '">Đúng hết (' + q.pts + "đ)</button></div>";
      }
      v.innerHTML = h + "</div>";
      var fb = v.querySelector("#fb"), nx = v.querySelector("#nx");
      if (nx) nx.onclick = next;
      function showNext() { if (nx) { nx.classList.remove("hide"); try { nx.focus(); } catch (e) { } } }
      if (q.kind === "type") {
        var inp = v.querySelector("#in"), okb = v.querySelector("#ok"), used = false;
        function check() {
          if (used) return; used = true;
          var r = HC.checkAm(inp.value, q.it.am), pts = r === 2 ? q.pts : r === 1 ? q.pts / 2 : 0; award(q, pts);
          fb.className = "feedback " + (r ? "ok" : "no");
          fb.textContent = r === 2 ? "Đúng! +" + pts : r === 1 ? "Đúng âm nhưng sai/thiếu dấu (+" + pts + "). Đáp án: " + q.it.am : "Chưa đúng. Đáp án: " + q.it.am;
          HC.beep(r > 0); if (r === 2) HC.addXP(1, okb);
          if (q.rec) { if (r === 2) q.rec.ok(q.it); else if (r === 0) q.rec.bad(q.it); }
          inp.disabled = true; okb.classList.add("hide"); showNext();
        }
        okb.onclick = check; inp.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); if (!used) check(); else next(); } });
        HC.later(function () { try { inp.focus(); } catch (e) { } }, 30);
      }
      if (q.kind === "mean" || q.kind === "phrase") {
        U().$$(".choice", v).forEach(function (b) {
          b.onclick = function () {
            var k = +b.dataset.k, ok = q.kind === "mean" ? q.opts[k] === q.it : k === q.ans;
            U().$$(".choice", v).forEach(function (x) { x.disabled = true; var kk = +x.dataset.k; if (q.kind === "mean" ? q.opts[kk] === q.it : kk === q.ans) x.classList.add("right"); });
            if (ok) { award(q, q.pts); HC.beep(true); HC.addXP(1, b); } else { b.classList.add("wrong"); HC.beep(false); }
            if (q.rec && q.kind === "mean") q.rec[ok ? "ok" : "bad"](q.it);
            showNext();
          };
        });
      }
      if (q.kind === "lt") {
        U().$$(".choice", v).forEach(function (b) {
          b.onclick = function () {
            var ok = b.dataset.g === q.q.ans;
            U().$$(".choice", v).forEach(function (x) { x.disabled = true; if (x.dataset.g === q.q.ans) x.classList.add("right"); });
            if (ok) { award(q, q.pts); HC.beep(true); HC.addXP(1, b); } else { b.classList.add("wrong"); HC.beep(false); }
            if (q.rec && q.q.it) q.rec[ok ? "ok" : "bad"](q.q.it);
            fb.className = "feedback " + (ok ? "ok" : "no"); fb.textContent = q.q.x + " là " + q.q.ans;
            showNext();
          };
        });
      }
      if (q.kind === "self") {
        v.querySelector("#rev").onclick = function () { v.querySelector("#ansbox").classList.remove("hide"); v.querySelector("#sg").classList.remove("hide"); this.classList.add("hide"); };
        v.querySelector("#sv").onclick = function () { var p = (v.querySelector("#c1").checked ? q.a : 0) + (v.querySelector("#c2").checked ? q.b : 0); award(q, p); if (p) HC.addXP(2, this); next(); };
      }
      if (q.kind === "write") {
        var pad = null, pb = v.querySelector("#padbox");
        var mkPad = function () { pb.classList.remove("hide"); v.querySelector("#clr").classList.remove("hide"); pad = HC.makePad(pb, q.s.han, { cols: 6, cell: 64 }); v.querySelector("#clr").onclick = pad.clear; };
        if (HC.vietMode() === "tt") mkPad();
        var op = v.querySelector("#opad"); if (op) op.onclick = function () { this.remove(); mkPad(); };
        v.querySelector("#rev").onclick = function () { v.querySelector("#ansbox").classList.remove("hide"); v.querySelector("#sg").classList.remove("hide"); if (pad) pad.model(true); var o = v.querySelector("#opad"); if (o) o.remove(); this.classList.add("hide"); };
        U().$$("#sg [data-p]", v).forEach(function (b) { b.onclick = function () { var p = +b.dataset.p; award(q, p); if (p) HC.addXP(3, b); next(); }; });
      }
    }
    ask();
  }
  HC.runQuiz = runQuiz;

  // ---------- THI THỬ ----------
  HC.exam = function (v, args) {
    var D = HC.D, S = HC.state();
    var which = args[0];
    // đề khai trong app-data.json → exams (vd giữa kỳ 3): cấu trúc theo đề K10 của kỳ đó
    var EX = D.exams || [], ex = EX.filter(function (e) { return e.key === which; })[0];
    if (!which) {
      v.innerHTML = '<h1>Thi thử</h1><p class="sub">Đề ngẫu nhiên lấy từ đúng nội dung đề cương, theo cấu trúc đề K10. Phần tự luận (dịch câu, viết chữ Hán) bạn xem đáp án rồi tự chấm.</p><div class="cols2">' +
        EX.map(function (e) {
          var tot = e.parts.reduce(function (s, p) { return s + p.n * p.pts; }, 0);
          return '<div class="card"><h2>' + esc(e.name) + " · " + e.parts.length + " phần · " + tot + ' điểm</h2><table class="t"><tbody>' + e.parts.map(function (p) { return "<tr><td>" + esc(p.part) + '</td><td class="num">' + p.n * p.pts + "đ</td></tr>"; }).join("") + '</tbody></table><p class="muted" style="margin-top:8px">Điểm cao nhất: ' + (S.best[e.best] != null ? S.best[e.best] : "—") + '</p><a class="btn primary" href="#thi-' + e.key + '">Bắt đầu ' + esc(e.name.charAt(0).toLowerCase() + e.name.slice(1)) + "</a></div>";
        }).join("") +
        '<div class="card"><h2>Đề Kỳ 1 (Hán 1) · 6 phần · 100 điểm</h2><table class="t"><tbody><tr><td>I. Phiên âm 20 từ đôi</td><td class="num">20đ</td></tr><tr><td>II. Nhận diện 10 chữ</td><td class="num">20đ</td></tr><tr><td>III. Nhận diện loại từ 20 câu</td><td class="num">20đ</td></tr><tr><td>IV. Phiên âm và dịch 10 câu</td><td class="num">20đ</td></tr><tr><td>V. Cụm thông tin cá nhân</td><td class="num">4đ</td></tr><tr><td>VI. Dịch và viết chữ Hán 4 câu</td><td class="num">16đ</td></tr></tbody></table><p class="muted" style="margin-top:8px">Điểm cao nhất: ' + (S.best.examHK1 != null ? S.best.examHK1 : "—") + '</p><a class="btn primary" href="#thi-hk1">Bắt đầu đề Kỳ 1 (Hán 1)</a></div>' +
        '<div class="card"><h2>Đề Kỳ 2 (Hán 2) · 4 phần · 100 điểm</h2><table class="t"><tbody><tr><td>I. Phiên âm 20 cụm</td><td class="num">20đ</td></tr><tr><td>II. Loại từ 20 câu (5 loại)</td><td class="num">20đ</td></tr><tr><td>III. Phiên âm và dịch 10 câu</td><td class="num">30đ</td></tr><tr><td>IV. Viết chữ Hán 5 câu</td><td class="num">30đ</td></tr></tbody></table><p class="muted" style="margin-top:8px">Điểm cao nhất: ' + (S.best.examHK2 != null ? S.best.examHK2 : "—") + '</p><a class="btn primary" href="#thi-hk2">Bắt đầu đề Kỳ 2 (Hán 2)</a></div></div>';
      return;
    }
    var qs = [], U2 = U();
    if (ex) {
      ex.parts.forEach(function (p) {
        var bySet = function (s) { return s.set === p.sset; };
        if (p.kind === "type") U2.pick(D.words.filter(function (w) { return (w.src || []).some(function (s) { return s.indexOf(p.src) === 0; }); }), p.n).forEach(function (w) { qs.push({ kind: "type", it: w, pts: p.pts, part: p.part }); });
        else if (p.kind === "lt") {
          var tm = (D.ltq || {})[p.set] || {}, gs = Object.keys(D.loaitu).filter(function (g) { return Object.keys(tm).some(function (t) { return HC.LT[t] === g; }); });
          for (var j = 0; j < p.n; j++) qs.push({ kind: "lt", q: HC.ltQuestion(gs, p.set), groups: gs, pts: p.pts, part: p.part });
        } else if (p.kind === "self") U2.pick(D.sents.filter(bySet), p.n).forEach(function (s) { qs.push({ kind: "self", s: s, a: p.a, b: p.b, pts: p.pts, part: p.part }); });
        else if (p.kind === "write") U2.pick(D.sents.filter(bySet), p.n).forEach(function (s) { qs.push({ kind: "write", s: s, pts: p.pts, part: p.part }); });
      });
    } else if (which === "hk1") {
      var w1 = D.words.filter(function (w) { return (w.src || []).some(function (s) { return s.indexOf("Đề cương HK1 – Phần I") === 0; }); });
      U2.pick(w1, 20).forEach(function (w) { qs.push({ kind: "type", it: w, pts: 1, part: "I. Phiên âm" }); });
      var c2 = D.chars.filter(function (c) { return c.net; });
      U2.pick(c2, 10).forEach(function (c) { qs.push({ kind: "mean", it: c, pts: 2, part: "II. Nhận diện chữ" }); });
      for (var k = 0; k < 20; k++) { var q3 = HC.ltQuestion(["Số từ", "Phương vị từ", "Phó từ"], "hk12"); qs.push({ kind: "lt", q: q3, groups: ["Số từ", "Phương vị từ", "Phó từ"], pts: 1, part: "III. Loại từ" }); }
      U2.pick(D.sents.filter(function (s) { return s.set === "ĐC HK1 · Phần IV"; }), 10).forEach(function (s) { qs.push({ kind: "self", s: s, a: 1, b: 1, pts: 2, part: "IV. Phiên âm và dịch" }); });
      var V = [["我姓名是", "Họ tên tôi là…"], ["法名 / 法號", "Pháp danh / pháp hiệu…"], ["年 月 日生", "Sinh năm – tháng – ngày."], ["今年是…歲", "Năm nay… tuổi."], ["第…届…年級第…學期", "Khóa…, năm thứ…, học kỳ…"]];
      V.forEach(function (p, j) { var opts = U2.shuffle(V.map(function (x) { return x[1]; })); qs.push({ kind: "phrase", han: p[0], opts: opts, ans: opts.indexOf(p[1]), pts: 0.8, part: "V. Thông tin cá nhân" }); });
      U2.pick(D.sents.filter(function (s) { return s.set === "ĐC HK1 · Phần VI"; }), 4).forEach(function (s) { qs.push({ kind: "write", s: s, pts: 4, part: "VI. Viết chữ Hán" }); });
    } else {
      var w2 = D.words.filter(function (w) { return (w.src || []).some(function (s) { return s.indexOf("Đề cương HK2 – Phần I") === 0; }); });
      U2.pick(w2, 20).forEach(function (w) { qs.push({ kind: "type", it: w, pts: 1, part: "I. Phiên âm" }); });
      for (var k2 = 0; k2 < 20; k2++) qs.push({ kind: "lt", q: HC.ltQuestion(G5, "hk12"), pts: 1, part: "II. Loại từ" });
      U2.pick(D.sents.filter(function (s) { return s.set === "ĐC HK2 · Phần III"; }), 10).forEach(function (s) { qs.push({ kind: "self", s: s, a: 1.5, b: 1.5, pts: 3, part: "III. Phiên âm và dịch" }); });
      U2.pick(D.sents.filter(function (s) { return s.set === "ĐC HK2 · Phần IV"; }), 5).forEach(function (s) { qs.push({ kind: "write", s: s, pts: 6, part: "IV. Viết chữ Hán" }); });
    }
    var hd = '<div class="ghead"><a class="btn sm ghost" href="#thi">← Thi thử</a><h1 style="margin:0;font-size:1.25rem">' + (ex ? "Đề thi thử " + esc(ex.name.replace(/^Đề\s*/, "")) : which === "hk1" ? "Đề thi thử Kỳ 1 (Hán 1)" : "Đề thi thử Kỳ 2 (Hán 2)") + "</h1></div>";
    runQuiz(v, hd, qs, function (score, max, parts, byPart) {
      var sc = Math.round(score * 10) / 10, key = ex ? ex.best : which === "hk1" ? "examHK1" : "examHK2";
      var best = HC.setBest(key, sc, true); if (sc >= 100 && HC.perfect) HC.perfect(); HC.addXP(Math.round(sc / 3)); HC.after();
      v.innerHTML = hd + '<div class="card result pop"><div class="score-big">' + sc + '</div><div class="muted">/ 100 điểm</div>' + (best ? '<span class="chip ok">Điểm cao nhất mới!</span>' : "") + '<div class="tablebox" style="width:min(480px,100%)"><table class="t"><tbody>' + Object.keys(byPart).map(function (p) { return "<tr><td>" + esc(p) + '</td><td class="num">' + (Math.round(byPart[p].got * 10) / 10) + " / " + byPart[p].max + "</td></tr>"; }).join("") + '</tbody></table></div><div class="row" style="justify-content:center"><button class="btn primary" id="again">Làm đề khác</button><a class="btn" href="#thi">Chọn đề</a></div></div>';
      v.querySelector("#again").onclick = function () { HC.route(); };
    });
  };
})();
