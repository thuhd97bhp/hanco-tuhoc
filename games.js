/* Hán cổ tự học — 10 trò chơi ôn tập và thi thử theo cấu trúc đề K10 */
(function () {
  "use strict";
  var HC = window.HC = window.HC || {};
  HC.games = HC.games || [];
  function U() { return HC.u; }
  function esc(s) { return U().esc(s); }

  // ---------- shared game shell ----------
  function head(g, preview) {
    return '<div class="ghead"><a class="btn sm ghost" href="#choi">← Trò chơi</a><h1 style="margin:0;font-size:1.25rem">' + esc(g.name) + '</h1><div class="score"><span class="pill num" id="gs">Điểm 0</span><span class="pill num" id="gt"></span></div></div>' +
      (preview ? '<p class="chip warn" style="margin-bottom:10px">Bạn mới học ít chữ nên trò chơi lấy thêm vài chữ sắp học.</p>' : "");
  }
  function setScore(v, s, extra) { var e = v.querySelector("#gs"); if (e) e.textContent = "Điểm " + s; var t = v.querySelector("#gt"); if (t && extra != null) t.textContent = extra; }
  function finish(v, g, score, opts) {
    opts = opts || {};
    var best = HC.setBest(g.id, score, opts.lowerBetter ? false : true);
    var bonus = opts.bonus != null ? opts.bonus : Math.max(2, Math.round(score / 2));
    HC.addXP(bonus); HC.after();
    v.innerHTML = '<div class="card result pop"><div class="muted">' + esc(g.name) + '</div><div class="score-big">' + esc(opts.label || score) + "</div>" + (best ? '<span class="chip ok">Kỷ lục mới!</span>' : '<span class="muted">Kỷ lục: ' + esc(HC.state().best[g.id]) + "</span>") + "<p>" + esc(opts.msg || "") + '</p><p class="muted">+' + bonus + ' XP thưởng</p><div class="row" style="justify-content:center"><button class="btn primary" id="again">Chơi lại</button><a class="btn" href="#choi">Trò khác</a><a class="btn" href="#home">Trang chính</a></div></div>';
    v.querySelector("#again").onclick = function () { HC.route(); };
  }
  function reg(g) { HC.games.push(g); }
  function correct(el) { HC.beep(true); HC.addXP(1, el); }
  function wrong() { HC.beep(false); }
  function amOf(it) { return HC.firstAm(it.am); }

  // 1. Lật thẻ tìm cặp
  reg({ id: "memo", icon: "對", name: "Lật thẻ tìm cặp", desc: "Lật 2 thẻ: ghép chữ Hán với âm Hán Việt của nó. Càng nhanh càng tốt.",
    run: function (v) {
      var P = HC.pool("c", 6), items = U().pick(P.items, 6), cards = [];
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
            if (a[1].i === z[1].i && a[1].t !== z[1].t) { a[0].classList.add("done"); z[0].classList.add("done"); open = []; done++; correct(z[0]); if (done === items.length) { clearInterval(timer); var sec = Math.round((Date.now() - t0) / 1000); finish(v, g, sec, { lowerBetter: true, label: sec + " giây", msg: moves + " lượt lật · 6 cặp", bonus: 8 }); } }
            else { wrong(); HC.later(function () { a[0].classList.remove("open"); z[0].classList.remove("open"); a[0].textContent = "?"; z[0].textContent = "?"; open = []; }, 800); }
          }
        };
      });
      return function () { clearInterval(timer); };
    } });

  // 2. Mưa chữ
  reg({ id: "rain", icon: "雨", name: "Mưa chữ", desc: "Chữ rơi từ trên xuống, gõ âm Hán Việt (không cần dấu) trước khi chữ chạm đáy.",
    run: function (v) {
      var P = HC.pool("c", 20), pool = P.items, g = this;
      v.innerHTML = head(this, P.preview) + '<div class="stage"><div class="rain" id="rn"><div class="floor"></div></div><input class="answer" id="in" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Gõ âm rồi chữ sẽ biến mất…" aria-label="Gõ âm Hán Việt"><p class="sub" id="info">3 mạng. Chữ chạm đáy là mất 1 mạng.</p></div>';
      var rn = v.querySelector("#rn"), inp = v.querySelector("#in"), drops = [], score = 0, lives = 3, last = 0, spawnGap = 2400, speed = 38, raf, alive = true, H = rn.clientHeight;
      function spawn() {
        var it = pool[Math.floor(Math.random() * pool.length)];
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
        setScore(v, score, "❤ " + lives);
        raf = requestAnimationFrame(step);
      }
      inp.addEventListener("input", function () {
        var val = U().fold(inp.value.trim());
        if (!val) return;
        for (var i = 0; i < drops.length; i++) {
          var d = drops[i];
          var ok = String(d.it.am).split(/\s*\/\s*/).some(function (a) { return U().fold(a) === val; });
          if (ok) { score++; d.el.classList.add("hit"); var el = d.el; HC.later(function () { el.remove(); }, 150); drops.splice(i, 1); inp.value = ""; correct(inp); setScore(v, score); return; }
        }
      });
      function end() { alive = false; cancelAnimationFrame(raf); finish(v, g, score, { msg: "Bắn trúng " + score + " chữ" }); }
      spawn(); raf = requestAnimationFrame(step); HC.later(function () { try { inp.focus(); } catch (e) { } }, 50);
      return function () { alive = false; cancelAnimationFrame(raf); };
    } });

  // 3. Đúng hay sai 60 giây
  reg({ id: "tf", icon: "是", name: "Đúng hay sai 60 giây", desc: "Chữ và âm/nghĩa đi kèm có khớp không? Bấm thật nhanh, đúng liên tiếp được nhân điểm.",
    run: function (v) {
      var P1 = HC.pool("c", 20), P2 = HC.pool("w", 10), pool = P1.items.concat(P2.items), g = this;
      var score = 0, combo = 0, endAt = Date.now() + 60000, cur, truth, tick;
      v.innerHTML = head(this, P1.preview) + '<div class="stage"><div class="timer"><i id="tb" style="width:100%"></i></div><div class="fc" id="fc"></div><div class="row" style="justify-content:center"><button class="btn bad" id="no" style="min-width:130px">✗ Sai <small>(phím ←)</small></button><button class="btn good" id="yes" style="min-width:130px">✓ Đúng <small>(phím →)</small></button></div><div class="feedback" id="fb"></div></div>';
      function next() {
        cur = pool[Math.floor(Math.random() * pool.length)];
        truth = Math.random() < 0.5;
        var shown = truth ? cur : (HC.distract(cur, 1, "am")[0] || cur);
        if (shown === cur) truth = true;
        v.querySelector("#fc").innerHTML = '<span class="kind">' + HC.kindLabel(cur) + '</span><div class="big ' + U().lenCls(cur.key) + '">' + esc(cur.key) + '</div><div class="ans"><div class="am">' + esc(shown.am) + '</div><div class="ns">' + esc(HC.meaningShort(shown)) + "</div></div>";
      }
      function answer(said, el) {
        if (Date.now() > endAt) return;
        var ok = said === truth, fb = v.querySelector("#fb");
        if (ok) { combo++; score += combo >= 5 ? 2 : 1; correct(el); fb.className = "feedback ok"; fb.textContent = combo >= 5 ? "Chuỗi " + combo + " — nhân đôi điểm!" : "Đúng"; }
        else { combo = 0; wrong(); fb.className = "feedback no"; fb.textContent = cur.key + " = " + cur.am + " · " + HC.meaningShort(cur); }
        setScore(v, score); next();
      }
      v.querySelector("#yes").onclick = function () { answer(true, this); };
      v.querySelector("#no").onclick = function () { answer(false, this); };
      function key(e) { if (e.key === "ArrowRight") answer(true, v.querySelector("#yes")); if (e.key === "ArrowLeft") answer(false, v.querySelector("#no")); }
      document.addEventListener("keydown", key);
      tick = setInterval(function () { var left = Math.max(0, endAt - Date.now()); var tb = v.querySelector("#tb"); if (tb) tb.style.width = (left / 600) + "%"; setScore(v, score, Math.ceil(left / 1000) + " giây"); if (!left) { clearInterval(tick); document.removeEventListener("keydown", key); finish(v, g, score); } }, 200);
      next();
      return function () { clearInterval(tick); document.removeEventListener("keydown", key); };
    } });

  // 4. Ghép chữ thành từ
  reg({ id: "build", icon: "詞", name: "Ghép chữ thành từ", desc: "Nhìn âm và nghĩa, bấm các chữ theo đúng thứ tự để ghép thành từ.",
    run: function (v) {
      var P = HC.pool("w", 10), words = U().pick(P.items, 10), g = this, i = 0, score = 0, tries = 0;
      var allC = HC.D.chars.slice(0, 500);
      function round() {
        var w = words[i], need = U().chars(w.w);
        var extra = U().pick(allC.filter(function (c) { return need.indexOf(c.c) < 0; }), Math.max(2, 6 - need.length)).map(function (c) { return c.c; });
        var tiles = U().shuffle(need.concat(extra)), slots = [];
        tries = 0;
        v.innerHTML = head(g, P.preview) + '<div class="stage"><div class="row"><span class="chip num">' + (i + 1) + ' / 10</span></div><div class="fc" style="min-height:auto"><div class="ans"><div class="am">' + esc(w.am) + "</div>" + HC.meanHTML(w) + '</div></div><div class="slots" id="sl" aria-label="Từ đang ghép"></div><div class="tiles" id="tl">' + tiles.map(function (t, k) { return '<button class="tile" data-k="' + k + '">' + esc(t) + "</button>"; }).join("") + '</div><div class="feedback" id="fb"></div><div class="row"><button class="btn" id="skip">Bỏ qua</button></div></div>';
        setScore(v, score);
        function draw() { v.querySelector("#sl").innerHTML = slots.map(function (k, j) { return '<button class="tile" data-s="' + j + '">' + esc(tiles[k]) + "</button>"; }).join(""); U().$$("#sl .tile", v).forEach(function (b) { b.onclick = function () { var k = slots.splice(+b.dataset.s, 1)[0]; v.querySelector('#tl [data-k="' + k + '"]').classList.remove("used"); draw(); }; }); }
        U().$$("#tl .tile", v).forEach(function (b) {
          b.onclick = function () {
            if (b.classList.contains("used")) return;
            slots.push(+b.dataset.k); b.classList.add("used"); draw();
            if (slots.length === need.length) {
              var got = slots.map(function (k) { return tiles[k]; }).join("");
              var fb = v.querySelector("#fb");
              if (got === w.w) { if (!tries) score++; correct(b); fb.className = "feedback ok"; fb.textContent = "Đúng: " + w.w; HC.later(next, 800); }
              else { tries++; wrong(); fb.className = "feedback no"; fb.textContent = "Chưa đúng, thử lại (bấm vào chữ ở trên để gỡ ra)."; }
            }
          };
        });
        v.querySelector("#skip").onclick = function () { var fb = v.querySelector("#fb"); fb.className = "feedback no"; fb.textContent = "Đáp án: " + w.w; HC.later(next, 1400); };
      }
      function next() { i++; if (i < words.length) round(); else finish(v, g, score, { label: score + " / 10", msg: "Ghép đúng ngay lần đầu " + score + " từ" }); }
      round();
    } });

  // 5. Năm rổ loại từ
  function ltQuestion(groups) {
    var LT = HC.LT, keys = Object.keys(LT).filter(function (x) { return groups.indexOf(LT[x]) >= 0; });
    var x = keys[Math.floor(Math.random() * keys.length)];
    var ss = HC.D.sents.filter(function (s) { return s.han.indexOf(x) >= 0; });
    var ctx;
    if (ss.length) { var s = ss[Math.floor(Math.random() * ss.length)]; var at = s.han.indexOf(x); ctx = esc(s.han.slice(0, at)) + '<span class="hl">' + esc(x) + "</span>" + esc(s.han.slice(at + x.length)); }
    else { var ws = HC.D.words.filter(function (w) { return w.w.indexOf(x) >= 0; }); if (ws.length) { var w = ws[Math.floor(Math.random() * Math.min(ws.length, 8))]; var a2 = w.w.indexOf(x); ctx = esc(w.w.slice(0, a2)) + '<span class="hl">' + esc(x) + "</span>" + esc(w.w.slice(a2 + x.length)); } else ctx = '<span class="hl">' + esc(x) + "</span>"; }
    var it = U().chars(x).length > 1 ? HC.WORD[x] : HC.CHAR[x];
    return { x: x, ans: LT[x], ctx: ctx, it: it };
  }
  HC.ltQuestion = ltQuestion;
  var G5 = ["Số từ", "Phương vị từ", "Phó từ", "Lượng từ", "Liên từ"];
  reg({ id: "basket", icon: "類", name: "Năm rổ loại từ", desc: "Chữ được gạch chân thuộc loại từ nào? Thả vào đúng rổ: Số từ, Phương vị từ, Phó từ, Lượng từ, Liên từ.",
    run: function (v) {
      var g = this, i = 0, score = 0, N = 20;
      function round() {
        var q = ltQuestion(G5);
        v.innerHTML = head(g) + '<div class="stage"><div class="row"><span class="chip num">' + (i + 1) + " / " + N + '</span></div><div class="card" style="width:min(640px,100%)"><div class="sent">' + q.ctx + '</div><p class="sub" style="text-align:center">Chữ gạch chân thuộc loại từ nào?</p></div><div class="baskets">' + G5.map(function (n) { return '<button class="btn" data-g="' + esc(n) + '">' + esc(n) + "</button>"; }).join("") + '</div><div class="feedback" id="fb"></div></div>';
        setScore(v, score);
        U().$$(".baskets .btn", v).forEach(function (b) {
          b.onclick = function () {
            var ok = b.dataset.g === q.ans, fb = v.querySelector("#fb");
            U().$$(".baskets .btn", v).forEach(function (x) { x.disabled = true; if (x.dataset.g === q.ans) x.classList.add("good"); });
            if (ok) { score++; correct(b); } else { b.classList.add("bad"); wrong(); }
            fb.className = "feedback " + (ok ? "ok" : "no");
            fb.textContent = (ok ? "Đúng! " : "Chưa đúng. ") + q.x + (q.it ? " (" + HC.firstAm(q.it.am) + ")" : "") + " là " + q.ans + ".";
            HC.later(function () { i++; if (i < N) round(); else finish(v, g, score, { label: score + " / " + N }); }, ok ? 900 : 1900);
          };
        });
      }
      round();
    } });

  // 6. Truy tìm bộ thủ
  reg({ id: "hunt", icon: "部", name: "Truy tìm bộ thủ", desc: "Cho một bộ thủ: chọn hết các chữ thuộc bộ đó trong lưới 12 chữ.",
    run: function (v) {
      var g = this, i = 0, score = 0, N = 8;
      var P = HC.pool("c", 120), pool = P.items.filter(function (c) { return c.rad; });
      if (pool.length < 60) pool = HC.D.chars.filter(function (c) { return c.rad && c.common; });
      function round() {
        var byRad = {}; pool.forEach(function (c) { (byRad[c.rad] = byRad[c.rad] || []).push(c); });
        var rads = Object.keys(byRad).filter(function (r) { return byRad[r].length >= 3; });
        var rno = rads[Math.floor(Math.random() * rads.length)], R = HC.RAD[rno];
        var mem = U().pick(byRad[rno], Math.min(byRad[rno].length, 3 + Math.floor(Math.random() * 3)));
        var others = U().pick(pool.filter(function (c) { return String(c.rad) !== String(rno); }), 12 - mem.length);
        var grid = U().shuffle(mem.concat(others)), sel = {};
        v.innerHTML = head(g, P.preview) + '<div class="stage"><div class="row"><span class="chip num">' + (i + 1) + " / " + N + '</span></div><div class="card" style="text-align:center;width:min(480px,100%)"><span class="han" style="font-size:52px">' + esc(R.r) + '</span><div><b>Bộ ' + esc(R.am) + "</b> · " + esc(R.ns || "") + (R.verse ? '<br><small class="muted">' + esc(R.verse) + "</small>" : "") + '</div></div><div class="hunt">' + grid.map(function (c, k) { return '<button data-k="' + k + '">' + esc(c.c) + "</button>"; }).join("") + '</div><div class="row"><button class="btn primary" id="chk">Kiểm tra</button></div><div class="feedback" id="fb"></div></div>';
        setScore(v, score);
        U().$$(".hunt button", v).forEach(function (b) { b.onclick = function () { var k = b.dataset.k; sel[k] = !sel[k]; b.classList.toggle("sel", !!sel[k]); }; });
        v.querySelector("#chk").onclick = function () {
          var got = 0, bad = 0;
          U().$$(".hunt button", v).forEach(function (b) { var c = grid[+b.dataset.k], isM = String(c.rad) === String(rno); b.classList.remove("sel"); if (sel[b.dataset.k] && isM) { b.classList.add("right"); got++; } else if (sel[b.dataset.k]) { b.classList.add("wrong"); bad++; } else if (isM) b.classList.add("miss"); b.disabled = true; });
          var pts = Math.max(0, got - bad); score += pts;
          var fb = v.querySelector("#fb"); fb.className = "feedback " + (bad || got < mem.length ? "no" : "ok");
          fb.textContent = "Tìm đúng " + got + "/" + mem.length + (bad ? ", chọn nhầm " + bad : "") + ". Viền cam là chữ bị bỏ sót.";
          if (pts) correct(this); else wrong();
          this.textContent = i + 1 < N ? "Bộ tiếp theo →" : "Xem kết quả"; this.onclick = function () { i++; if (i < N) round(); else finish(v, g, score); };
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
      var P = HC.pool("s", 8), list = [];
      P.items.forEach(function (s) { list = list.concat(clauses(s)); });
      if (list.length < 6) HC.D.sents.forEach(function (s) { list = list.concat(clauses(s)); });
      var qs = U().pick(list, 6), g = this, i = 0, score = 0;
      function round() {
        var q = qs[i], need = U().chars(q.h), tiles = U().shuffle(need.map(function (c, k) { return { c: c, k: k }; })), pos = 0, miss = 0;
        v.innerHTML = head(g, P.preview) + '<div class="stage"><div class="row"><span class="chip num">' + (i + 1) + ' / 6</span></div><div class="card" style="width:min(640px,100%);text-align:center"><div style="font-weight:700">' + esc(q.p || q.s.pa) + '</div><div class="muted" style="font-size:0.9rem">' + esc(q.s.dn) + '</div></div><div class="slots" id="sl"></div><div class="tiles" id="tl">' + tiles.map(function (t, j) { return '<button class="tile" data-j="' + j + '">' + esc(t.c) + "</button>"; }).join("") + '</div><div class="feedback" id="fb"></div></div>';
        setScore(v, score);
        U().$$("#tl .tile", v).forEach(function (b) {
          b.onclick = function () {
            if (b.classList.contains("used")) return;
            var t = tiles[+b.dataset.j];
            if (t.c === need[pos]) { b.classList.add("used"); v.querySelector("#sl").insertAdjacentHTML("beforeend", '<span class="tile">' + esc(t.c) + "</span>"); pos++; HC.beep(true); if (pos === need.length) { if (!miss) score++; HC.addXP(2, b); var fb = v.querySelector("#fb"); fb.className = "feedback ok"; fb.textContent = miss ? "Xong (sai " + miss + " lần)" : "Hoàn hảo!"; HC.later(function () { i++; if (i < qs.length) round(); else finish(v, g, score, { label: score + " / 6", msg: "Xếp đúng không sai lần nào: " + score + " vế câu" }); }, 900); } }
            else { miss++; wrong(); b.classList.add("pop"); HC.later(function () { b.classList.remove("pop"); }, 300); }
          };
        });
      }
      if (!qs.length) { v.innerHTML = head(g) + '<p class="sub">Chưa có câu để chơi.</p>'; return; }
      round();
    } });

  // 8. Điền chữ còn thiếu
  reg({ id: "cloze", icon: "空", name: "Điền chữ còn thiếu", desc: "Câu trong đề cương bị khuyết một chữ. Chọn đúng chữ còn thiếu.",
    run: function (v) {
      var P = HC.pool("s", 10), g = this, i = 0, score = 0, N = 10;
      var src = P.items.length >= 4 ? P.items : HC.D.sents;
      function round() {
        var s = src[Math.floor(Math.random() * src.length)], hs = U().chars(s.han);
        var idxs = []; hs.forEach(function (c, k) { if (U().isHan(c) && HC.CHAR[c]) idxs.push(k); });
        var k = idxs[Math.floor(Math.random() * idxs.length)], ans = hs[k], A = HC.CHAR[ans];
        var opts = U().shuffle([ans].concat(HC.distract(A, 3, "am").map(function (x) { return x.c; })));
        var syl = String(s.pa).replace(/\.\.\.|…/g, " ").split(/[\s,;.:]+/).filter(Boolean), hanCount = hs.filter(U().isHan).length, pa = s.pa;
        if (syl.length === hanCount) { var before = hs.slice(0, k).filter(U().isHan).length; syl[before] = "___"; pa = syl.join(" "); }
        v.innerHTML = head(g, P.preview) + '<div class="stage"><div class="row"><span class="chip num">' + (i + 1) + " / " + N + '</span></div><div class="card" style="width:min(680px,100%);text-align:center"><div class="sent">' + hs.map(function (c, j) { return j === k ? '<span class="blank">?</span>' : esc(c); }).join("") + '</div><div style="font-weight:600">' + esc(pa) + '</div><div class="muted">' + esc(s.dn) + '</div></div><div class="choices">' + opts.map(function (o) { return '<button class="choice" data-o="' + esc(o) + '" style="text-align:center"><span class="han">' + esc(o) + "</span></button>"; }).join("") + '</div><div class="feedback" id="fb"></div></div>';
        setScore(v, score);
        U().$$(".choice", v).forEach(function (b) {
          b.onclick = function () {
            var ok = b.dataset.o === ans, fb = v.querySelector("#fb");
            U().$$(".choice", v).forEach(function (x) { x.disabled = true; if (x.dataset.o === ans) x.classList.add("right"); });
            if (ok) { score++; correct(b); } else { b.classList.add("wrong"); wrong(); }
            fb.className = "feedback " + (ok ? "ok" : "no"); fb.textContent = ans + " · " + A.am + " · " + HC.meaningShort(A);
            HC.later(function () { i++; if (i < N) round(); else finish(v, g, score, { label: score + " / " + N }); }, ok ? 900 : 1800);
          };
        });
      }
      round();
    } });

  // 9. Viết trên màn hình
  reg({ id: "write", icon: "筆", name: "Viết trên màn hình", desc: "Viết chữ bằng ngón tay hoặc chuột, bấm Chấm điểm để app tự chấm từng nét. Tính vào lịch tập viết.",
    run: function (v) {
      var g = this, P1 = HC.pool("c", 6), P2 = HC.pool("w", 2);
      var items = U().pick(P1.items, 6).concat(U().pick(P2.items, 2));
      var tabs = head(g, P1.preview);
      HC.writeSession(v, tabs, items, !P1.preview, function (ok, n) { finish(v, g, ok, { label: ok + " / " + n, msg: "Viết đúng " + ok + " trên " + n + " mục" }); });
    } });

  // 10. Đấu cuối tuần (bài thi ngắn chấm tự động)
  reg({ id: "weekly", icon: "試", name: "Đấu cuối tuần", desc: "Bài thi ngắn 20 câu: gõ phiên âm, chọn nghĩa, nhận diện loại từ. Thang 100 điểm.",
    run: function (v) {
      var g = this, Pw = HC.pool("w", 8), Pc = HC.pool("c", 6), qs = [];
      U().pick(Pw.items, 8).forEach(function (w) { qs.push({ kind: "type", it: w, pts: 5, part: "Phiên âm" }); });
      U().pick(Pc.items, 6).forEach(function (c) { qs.push({ kind: "mean", it: c, pts: 5, part: "Nghĩa của chữ" }); });
      for (var k = 0; k < 6; k++) qs.push({ kind: "lt", q: ltQuestion(G5), pts: 5, part: "Loại từ" });
      runQuiz(v, head(g, Pw.preview), qs, function (score, max, parts) { finish(v, g, Math.round(score), { label: Math.round(score) + " / 100", msg: parts, bonus: Math.round(score / 4) }); });
    } });

  // ---------- generic quiz runner (Đấu cuối tuần + Thi thử) ----------
  function runQuiz(v, headHTML, qs, done) {
    var i = 0, score = 0, max = 0, byPart = {};
    qs.forEach(function (q) { max += q.pts; byPart[q.part] = byPart[q.part] || { got: 0, max: 0 }; byPart[q.part].max += q.pts; });
    function award(q, pts) { score += pts; byPart[q.part].got += pts; }
    function nav() { return '<div class="row" style="width:min(640px,100%)"><span class="chip">' + esc(qs[i].part) + '</span><span class="spacer"></span><span class="chip num">Câu ' + (i + 1) + " / " + qs.length + "</span></div>"; }
    function next() { i++; if (i < qs.length) ask(); else { var parts = Object.keys(byPart).map(function (p) { return p + ": " + (Math.round(byPart[p].got * 10) / 10) + "/" + byPart[p].max; }).join(" · "); done(score, max, parts, byPart); } }
    function ask() {
      var q = qs[i], h = headHTML + '<div class="stage">' + nav();
      var nextBtn = '<button class="btn primary hide" id="nx">Câu tiếp →</button>';
      if (q.kind === "type") {
        h += '<div class="fc" style="min-height:200px"><div class="big ' + U().lenCls(q.it.key) + '">' + esc(q.it.key) + '</div><div class="muted">Viết phiên âm Hán Việt (có dấu)</div></div><input class="answer" id="in" type="text" autocomplete="off" spellcheck="false" aria-label="Phiên âm"><div class="row"><button class="btn primary" id="ok">Kiểm tra</button>' + nextBtn + '</div><div class="feedback" id="fb"></div>';
      } else if (q.kind === "mean") {
        var opts = U().shuffle([q.it].concat(HC.distract(q.it, 3, "am")));
        q.opts = opts;
        h += '<div class="fc" style="min-height:200px"><div class="big">' + esc(q.it.key) + '</div><div class="muted">Chọn âm và nghĩa đúng</div></div><div class="choices one">' + opts.map(function (o, k) { return '<button class="choice" data-k="' + k + '"><b>' + esc(o.am) + "</b> — " + esc(HC.meaningShort(o)) + "</button>"; }).join("") + '</div><div class="row">' + nextBtn + '</div><div class="feedback" id="fb"></div>';
      } else if (q.kind === "lt") {
        var groups = q.groups || G5;
        h += '<div class="card" style="width:min(640px,100%)"><div class="sent">' + q.q.ctx + '</div><p class="sub" style="text-align:center">Chữ gạch chân thuộc loại từ nào?</p></div><div class="choices one">' + groups.map(function (n, k) { return '<button class="choice" data-g="' + esc(n) + '">' + String.fromCharCode(65 + k) + ". " + esc(n) + "</button>"; }).join("") + '</div><div class="row">' + nextBtn + '</div><div class="feedback" id="fb"></div>';
      } else if (q.kind === "phrase") {
        h += '<div class="card" style="width:min(640px,100%);text-align:center"><div class="han" style="font-size:2rem">' + esc(q.han) + '</div><p class="muted">Nghĩa của cụm này là gì?</p></div><div class="choices one">' + q.opts.map(function (o, k) { return '<button class="choice" data-k="' + k + '">' + esc(o) + "</button>"; }).join("") + '</div><div class="row">' + nextBtn + '</div><div class="feedback" id="fb"></div>';
      } else if (q.kind === "self") {
        h += '<div class="card" style="width:min(680px,100%);text-align:center"><div class="sent">' + esc(q.s.han) + '</div><p class="muted">Đọc to phiên âm và dịch nghĩa (hoặc viết ra giấy), rồi bấm Xem đáp án và tự chấm.</p><div id="ansbox" class="hide"><div style="font-weight:700">' + esc(q.s.pa) + "</div><div>" + esc(q.s.dn) + '</div></div></div><div class="row"><button class="btn primary" id="rev">Xem đáp án</button></div><div class="row hide" id="sg"><label class="row"><input type="checkbox" id="c1"> Phiên âm đúng (' + q.a + 'đ)</label><label class="row"><input type="checkbox" id="c2"> Dịch đúng (' + q.b + 'đ)</label><button class="btn primary" id="sv">Chấm &amp; tiếp</button></div>';
      } else if (q.kind === "write") {
        h += '<div class="card" style="width:min(680px,100%);text-align:center"><div style="font-weight:700;font-size:1.1rem">' + esc(q.s.pa) + '</div><div class="muted">' + esc(q.s.dn) + '</div><p class="sub">Viết câu bằng chữ Hán (trên giấy hoặc vào ô dưới), rồi bấm Xem đáp án và tự chấm.</p></div><div class="padwrap" id="padbox"></div><div class="row"><button class="btn" id="clr">Xóa</button><button class="btn primary" id="rev">Xem đáp án</button></div><div id="ansbox" class="sent hide">' + esc(q.s.han) + '</div><div class="row hide" id="sg"><button class="btn bad" data-p="0">Sai nhiều (0đ)</button><button class="btn warn" data-p="' + (q.pts / 2) + '">Đúng một phần (' + (q.pts / 2) + 'đ)</button><button class="btn good" data-p="' + q.pts + '">Đúng hết (' + q.pts + "đ)</button></div>";
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
        var pad = HC.makePad(v.querySelector("#padbox"), q.s.han, { cols: 6, cell: 64 });
        v.querySelector("#clr").onclick = pad.clear;
        v.querySelector("#rev").onclick = function () { v.querySelector("#ansbox").classList.remove("hide"); v.querySelector("#sg").classList.remove("hide"); pad.model(true); this.classList.add("hide"); };
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
    if (!which) {
      v.innerHTML = '<h1>Thi thử</h1><p class="sub">Đề ngẫu nhiên lấy từ đúng nội dung đề cương, theo cấu trúc đề K10. Phần tự luận (dịch câu, viết chữ Hán) bạn xem đáp án rồi tự chấm.</p><div class="cols2">' +
        '<div class="card"><h2>Đề HK1 · 6 phần · 100 điểm</h2><table class="t"><tbody><tr><td>I. Phiên âm 20 từ đôi</td><td class="num">20đ</td></tr><tr><td>II. Nhận diện 10 chữ</td><td class="num">20đ</td></tr><tr><td>III. Nhận diện loại từ 20 câu</td><td class="num">20đ</td></tr><tr><td>IV. Phiên âm và dịch 10 câu</td><td class="num">20đ</td></tr><tr><td>V. Cụm thông tin cá nhân</td><td class="num">4đ</td></tr><tr><td>VI. Dịch và viết chữ Hán 4 câu</td><td class="num">16đ</td></tr></tbody></table><p class="muted" style="margin-top:8px">Điểm cao nhất: ' + (S.best.examHK1 != null ? S.best.examHK1 : "—") + '</p><a class="btn primary" href="#thi-hk1">Bắt đầu đề HK1</a></div>' +
        '<div class="card"><h2>Đề cuối kỳ 2 · 4 phần · 100 điểm</h2><table class="t"><tbody><tr><td>I. Phiên âm 20 cụm</td><td class="num">20đ</td></tr><tr><td>II. Loại từ 20 câu (5 loại)</td><td class="num">20đ</td></tr><tr><td>III. Phiên âm và dịch 10 câu</td><td class="num">30đ</td></tr><tr><td>IV. Viết chữ Hán 5 câu</td><td class="num">30đ</td></tr></tbody></table><p class="muted" style="margin-top:8px">Điểm cao nhất: ' + (S.best.examHK2 != null ? S.best.examHK2 : "—") + '</p><a class="btn primary" href="#thi-hk2">Bắt đầu đề kỳ 2</a></div></div>';
      return;
    }
    var qs = [], U2 = U();
    if (which === "hk1") {
      var w1 = D.words.filter(function (w) { return (w.src || []).some(function (s) { return s.indexOf("Đề cương HK1 – Phần I") === 0; }); });
      U2.pick(w1, 20).forEach(function (w) { qs.push({ kind: "type", it: w, pts: 1, part: "I. Phiên âm" }); });
      var c2 = D.chars.filter(function (c) { return c.net; });
      U2.pick(c2, 10).forEach(function (c) { qs.push({ kind: "mean", it: c, pts: 2, part: "II. Nhận diện chữ" }); });
      for (var k = 0; k < 20; k++) { var q3 = HC.ltQuestion(["Số từ", "Phương vị từ", "Phó từ"]); qs.push({ kind: "lt", q: q3, groups: ["Số từ", "Phương vị từ", "Phó từ"], pts: 1, part: "III. Loại từ" }); }
      U2.pick(D.sents.filter(function (s) { return s.set === "ĐC HK1 · Phần IV"; }), 10).forEach(function (s) { qs.push({ kind: "self", s: s, a: 1, b: 1, pts: 2, part: "IV. Phiên âm và dịch" }); });
      var V = [["我姓名是", "Họ tên tôi là…"], ["法名 / 法號", "Pháp danh / pháp hiệu…"], ["年 月 日生", "Sinh năm – tháng – ngày."], ["今年是…歲", "Năm nay… tuổi."], ["第…届…年級第…學期", "Khóa…, năm thứ…, học kỳ…"]];
      V.forEach(function (p, j) { var opts = U2.shuffle(V.map(function (x) { return x[1]; })); qs.push({ kind: "phrase", han: p[0], opts: opts, ans: opts.indexOf(p[1]), pts: 0.8, part: "V. Thông tin cá nhân" }); });
      U2.pick(D.sents.filter(function (s) { return s.set === "ĐC HK1 · Phần VI"; }), 4).forEach(function (s) { qs.push({ kind: "write", s: s, pts: 4, part: "VI. Viết chữ Hán" }); });
    } else {
      var w2 = D.words.filter(function (w) { return (w.src || []).some(function (s) { return s.indexOf("Đề cương HK2 – Phần I") === 0; }); });
      U2.pick(w2, 20).forEach(function (w) { qs.push({ kind: "type", it: w, pts: 1, part: "I. Phiên âm" }); });
      for (var k2 = 0; k2 < 20; k2++) qs.push({ kind: "lt", q: HC.ltQuestion(G5), pts: 1, part: "II. Loại từ" });
      U2.pick(D.sents.filter(function (s) { return s.set === "ĐC HK2 · Phần III"; }), 10).forEach(function (s) { qs.push({ kind: "self", s: s, a: 1.5, b: 1.5, pts: 3, part: "III. Phiên âm và dịch" }); });
      U2.pick(D.sents.filter(function (s) { return s.set === "ĐC HK2 · Phần IV"; }), 5).forEach(function (s) { qs.push({ kind: "write", s: s, pts: 6, part: "IV. Viết chữ Hán" }); });
    }
    var hd = '<div class="ghead"><a class="btn sm ghost" href="#thi">← Thi thử</a><h1 style="margin:0;font-size:1.25rem">' + (which === "hk1" ? "Đề thi thử HK1" : "Đề thi thử cuối kỳ 2") + "</h1></div>";
    runQuiz(v, hd, qs, function (score, max, parts, byPart) {
      var sc = Math.round(score * 10) / 10, key = which === "hk1" ? "examHK1" : "examHK2";
      var best = HC.setBest(key, sc, true); HC.addXP(Math.round(sc / 3)); HC.after();
      v.innerHTML = hd + '<div class="card result pop"><div class="score-big">' + sc + '</div><div class="muted">/ 100 điểm</div>' + (best ? '<span class="chip ok">Điểm cao nhất mới!</span>' : "") + '<div class="tablebox" style="width:min(480px,100%)"><table class="t"><tbody>' + Object.keys(byPart).map(function (p) { return "<tr><td>" + esc(p) + '</td><td class="num">' + (Math.round(byPart[p].got * 10) / 10) + " / " + byPart[p].max + "</td></tr>"; }).join("") + '</tbody></table></div><div class="row" style="justify-content:center"><button class="btn primary" id="again">Làm đề khác</button><a class="btn" href="#thi">Chọn đề</a></div></div>';
      v.querySelector("#again").onclick = function () { HC.route(); };
    });
  };
})();
