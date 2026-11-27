# App Hán cổ tự học — Quy ước cho Claude Code
- Web app tự học Hán cổ năm 1 (Khoa Phật học từ xa, Học viện PGVN TP.HCM, Khóa XI): thẻ nhớ ôn ngắt
  quãng, tập viết, 214 bộ thủ, loại từ, 90 câu đề cương (HK1, kỳ 2, giữa kỳ 3), 11 trò chơi, thi thử 3 đề. JS thuần (ES5, không
  build, không framework), Firebase compat 10.14.1 (Auth Google + Firestore). Ngôn ngữ UI: tiếng Việt.
- Link chính: https://hanco-tuhoc.web.app (Firebase Hosting, dự án `hanco-tuhoc`). Bản phụ:
  GitHub Pages thuhd97bhp/hanco-tuhoc (repo CÔNG KHAI — không commit bí mật, không commit `tools/`).

## Cấu trúc
- `index.html` = HTML + toàn bộ CSS (token màu sáng/tối trên `:root`) + nạp Firebase rồi `app.js`, `games.js`.
- `app.js` = lõi: dữ liệu, trạng thái `S`, SRS, lộ trình ôn thi THEO KỲ (đọc `terms` trong app-data.json), đồng bộ Firebase, router, các màn hình.
- `games.js` = 11 trò chơi (`reg({...})`) + `runQuiz` + thi thử (`HC.exam`: đề HK1, kỳ 2 viết trong mã; đề khai trong
  app-data.json → `exams` chạy chung một bộ, vd đề giữa kỳ 3). Dùng API qua `window.HC`.
- `sw.js` = service worker cho chạy ngoại tuyến (mã app: mạng trước, mất mạng dùng đệm; Firebase
  SDK/phông: đệm trước; KHÔNG bao giờ đệm request Firestore/Auth). Ảnh `han/` ở đệm RIÊNG `hanchu-v1` (không bị xóa khi đổi
  VERSION; lúc kích hoạt so `han-dau.json` = dấu md5 từng ảnh do release.py sinh → chỉ tải lại ảnh đã vẽ lại). Đệm `dem-v1` = số byte
  Hosting đã tải (bộ đếm hạn mức). Đệm không bắt đầu bằng "hanco-" (`hanchu-v1`, `dem-v1`, `sach-v1`) không bị xóa khi phát hành.
- `app-data.json` = dữ liệu sinh từ `tools/` (chars, words, sents, rads, loaitu; `ltq` câu ví dụ loại từ theo kỳ;
  `exams` đề thi thử; `terms` các kỳ thi (tên đầy đủ / gọi tắt, đề thi thử, bảng loại từ, bộ câu); mục có `kt` = thuộc kỳ nào; `plan` cũ chỉ để bản app cũ còn chạy; `srcs` tên tài liệu; mục có `fo: 1` = thuộc kỳ thi đang ưu tiên). KHÔNG sửa tay.
- `app-strokes.json` = đường giữa từng nét (Make Me a Hanzi, giấy phép Arphic: `strokes-LICENSE.txt`) để app TỰ CHẤM
  tập viết (`gradeShape` trong app.js): chấm theo HÌNH chữ, KHÔNG xét số nét / thứ tự nét (người dùng yêu cầu) — so chữ viết với
  ~1.600 chữ mẫu (gồm cả chữ giản thể), đúng khi chữ cần viết là chữ giống nhất (hoặc ngang ngửa, G_TIE), độ lệch ≤ G_ABS, VÀ không có đoạn nét
  thừa (kể cả đường nối giữa các nét) hay đoạn thiếu dài quá G_RUN / G_LRUN; từng nét được xê dịch ≤ G_SHIFT (chữ tay lệch
  theo bộ phận). Ngưỡng hiệu chỉnh bằng chữ viết mô phỏng (`.claude/harness.js`, chạy trong trình duyệt ở trang app).
  Chấm nhầm → người học bấm "Tôi viết đúng mà" (tính Đúng, lưu mẫu ở localStorage `hanco-mau-cham-nham`, tải ở #viet-mau dạng
  JSON: `ch` chữ/từ, `cell`/`cols` ô viết, `s` các nét toạ độ canvas, `r` kết quả chấm). Có tệp mẫu → chấm lại bằng
  `HC.gradeShape(nét thuộc ô, chữ)` để chỉnh ngưỡng; điểm tập viết chỉ ghi vào lịch khi bấm Tiếp.
  Sinh bằng `cd tools && python build_strokes.py` (dữ liệu gốc ở `tools/ref/hanzi-writer-data/`). 28 chữ hiếm chưa có dữ liệu → tự so.
- `net/<mã hex>.json` = thứ tự nét từng chữ (viền nét `s` + đường giữa `m`, cùng nguồn Make Me a Hanzi/Arphic, giống dữ liệu
  hanzii.net) cho HOẠT HÌNH VIẾT CHỮ thay chữ to ở thẻ học / khung chi tiết (`aniHTML`/`aniStart` trong app.js; người dùng
  yêu cầu thay hẳn chữ to MS Song bằng hoạt hình). Chữ không có dữ liệu (28 chữ hiếm) → hiện chữ MS Song như cũ. Sinh bằng
  `cd tools && python build_order.py`. Thêm chữ mới vào dữ liệu → chạy lại lệnh này.
- `han/<mã hex>.webp` = ảnh từng chữ vẽ bằng MS Song (320x320, chữ 256px ở giữa). Trên máy KHÔNG cài MS Song (máy tính bảng,
  điện thoại) app đổi MỌI chữ Hán trên trang sang ảnh này (`songWatch`/`sgText` trong app.js; chữ to `.big`, chữ mẫu ô tập viết).
  Xem luật "Ảnh chữ" ở Luật nội dung. Vẽ: `python tools/render_han.py --missing` (khởi động sẵn: launch.json `renderhan-thieu`) rồi
  mở http://127.0.0.1:8770/render_han.html trên máy Windows có MS Song; `--list` = chỉ xem chữ còn thiếu + phông sẽ dùng.
  Danh sách chữ cần ảnh = `render_han.wanted()` (dữ liệu, `giai/`, chữ mẫu `app-strokes.json`, chữ trong app.js/games.js/index.html).
  Chữ MS Song không có (dạng bộ ⺈⺌⺗⺮⺳⺶⻗, chữ hiếm vùng mở rộng 𧾷𦥑𫘨𫜪) → phông Tống dự phòng, canh cỡ + độ cao theo MS Song
  bằng chữ mẫu chung (`refs`); chữ nào dùng phông nào ghi ở `tools/work/han_font.txt`. Thử giao diện ảnh trên máy có MS Song: thêm
  `?song=img` vào địa chỉ. LƯU Ý mã `sgText`: chữ không có ảnh phải để NGUYÊN nút chữ (thay bằng nút y hệt → MutationObserver lặp
  vô tận → app đơ cứng trên máy tính bảng — lỗi đã gặp 25/11/2026).
- DẠNG RÚT GỌN + DẠNG BỘ (người dùng yêu cầu 24/11/2026): chữ/từ có `gt` = dạng rút gọn (giản thể) — tài liệu không ghi nên tra
  bằng OpenCC (`pip install opencc`, t2s đổi theo cả cụm từ; sửa tay ở `tools/work/gianthe_sua.txt`), app luôn ghi ※ "tra từ
  điển"; `gtc` chữ khác cùng dạng rút gọn (發/髮 → 发), `gts` dạng rút gọn trùng một chữ phồn thể khác (後 → 后), `dt` dị thể
  (cột biến thể trừ giản thể và dạng bộ). Bộ thủ có `forms` từ `tools/work/forms.txt` (`số bộ|dạng|bo/gt/kh|vị trí|GT giáo
  trình HK1 / TD tra từ điển|ghi chú`, kèm chữ ví dụ); chữ có `bf` = bộ viết theo dạng nào trong chữ đó (suy từ `radStrokes` của
  hanzi-writer-data, chỉ ghi khi số nét + vị trí khớp), net/ của chữ đó có `r` (chỉ số nét thuộc bộ) để TÔ MÀU phần bộ trong
  hoạt hình. Tập viết: chữ phồn thể BẮT BUỘC; dạng rút gọn KHÔNG bắt buộc (nút "Viết thêm dạng rút gọn"), đã viết thì phải
  đúng CẢ HAI mới tính Đúng; viết dạng rút gọn vào ô phồn thể → Sai, app báo rõ. Không thêm trường nào vào `S`.
- `giai/<mã hex>.json` = GIẢI THÍCH TỪNG CHỮ (tự soạn, KHÔNG có trong tài liệu → app luôn ghi ※): Pinyin, nghĩa + từ loại, lục thư,
  cấu tạo, nguồn gốc (Thuyết văn / chữ cổ), MẸO NHỚ (ghi rõ là mẹo). Mỗi chữ + bộ thủ 1 file, tải khi mở chữ (`giaiData`/`giaiHTML`/
  `giaiFill`/`showGiai` trong app.js; khung `.giai` trong chi tiết chữ + bộ thủ, mục "※ Giải thích" ở ⋯). Nguồn soạn: `tools/work/giai/dot*.txt`
  (định dạng: `tools/work/giai/README.txt`); sinh bằng `cd tools && python build_giai.py` (chữ chưa soạn → file chỉ có pinyin tự động,
  từ Make Me a Hanzi `tools/ref/makemeahanzi/` LGPL chỉ tham khảo + pypinyin; đa âm ghi "chưa soát" tới khi khối giải thích ghi `py:`).
  Đợt soạn tiếp theo: `python build_giai.py --next`. KHÔNG đưa vào app-data.json, KHÔNG sửa chars*.txt.
- Sách "Tìm về cội nguồn chữ Hán" (ảnh quét, có bản quyền): PDF ở `tools/ref/` (KHÔNG BAO GIỜ để ở gốc repo — hosting phát hành cả
  thư mục gốc; release.py dừng nếu thấy .pdf/.pack ngoài tools/). Chỉ mục `tools/work/sach/chimuc.txt`; chữ ↔ trang sách
  `tools/work/sach/khop.txt` sinh bằng `cd tools && python sach_khop.py` (S có trong sách / T chỉ có thành phần / - không có).
  HÌNH TRANG SÁCH (người dùng duyệt 25/11/2026): `cd tools && python sach_pack.py` → `sach.json` ở gốc (chữ/bộ id → vị trí hoặc
  [[thành phần, vị trí]], KHÔNG có hình, lên hosting) + `tools/work/sach/sach.pack` (hình PNG base64 630 trang ~46 MB, CHỈ ở máy).
  Quản trị đưa gói lên KHO CHUNG (Bước 6, 27/11/2026): tab Quản trị → Hình sách → Firestore `hanco_sach/p<vị trí>` (+ `hanco_sach/info`
  = độ dài từng trang đã đưa, để đưa tiếp / chỉ đưa trang mới/đổi); mọi thành viên đang hoạt động đọc, chỉ quản trị ghi. Bản riêng cũ
  `hanco_progress/{uid}/sach/` chỉ còn đọc/xóa (app đọc kho chung trước, bản riêng sau). "Tải hết về máy này" CHỈ quản trị. App hiện khung `.sach` trong chi tiết chữ + bộ thủ (`sachFill`,
  khung xem to `sachView`, thẻ Cài đặt `sachSettings` trong app.js); máy giữ hình đã xem ở Cache Storage `sach-v1` (không "hanco-"),
  công tắc localStorage `hanco-sach-noluu`. Không thuộc `S`. Số trang in = vị trí (< 251) hoặc vị trí − 2. Thử ở máy không đụng
  tài khoản: `python .claude/make-sach-test.py` → `/.claude/sach-test.html?signedin` (Firebase giả).
- `tools/` (chỉ ở máy, đã gitignore): pipeline dữ liệu từ các tài liệu nguồn.
  - `sources.json` = DANH MỤC tài liệu (mã A, B, C…, file PDF trong `src/`, file text trong `txt/`, loại giao-trinh /
    de-cuong / de-thi, kỳ HK1 / HK2 / GK3…). Hiện 5: A giáo trình HK1, B đề cương HK1 (in K11), C đề cương cuối kỳ 2,
    D đề cương giữa kỳ 3, E đề thi K10 giữa kỳ 3. `build.py` đếm số lần xuất hiện trên MỌI tài liệu trong danh mục.
  - `txt/` bản text trích từ PDF (`python extract.py src/<pdf> txt/<txt>`); `work/chars1-6.txt` từ điển chữ
    `chữ|biến thể|âm|nghĩa đề cương|nghĩa bổ sung`; `work/words1-4.txt` từ điển từ `từ|âm|nghĩa đề cương|nghĩa bổ sung`;
    `work/words_raw.json` danh sách từ đề cương HK1, kỳ 2 (parse_words.py); `work/gk3_raw.json` nội dung giữa kỳ 3 tách
    bằng `parse_gk3.py` (399 từ, 38 từ ngữ pháp, 35 câu, đề K10; có danh sách lỗi in đã sửa);
    `work/sents.txt` TẤT CẢ câu `bộ|số|chữ Hán|phiên âm|dịch|cờ` (k = đã ra đề K10, w = có phần viết);
    `work/ids.json` id cố định (xem luật id).
  - Sửa nghĩa/âm → sửa file trong `tools/work/` rồi chạy `cd tools && python build.py && python build_app.py && python check_update.py`.
  - `build_app.py` còn khai: loại từ theo kỳ + câu ví dụ (`ltq`, bỏ câu mà chữ mang nghĩa khác: EXCL), đề thi thử (`EXAMS`),
    các kỳ thi (`TERMS`: tên, đề, bảng loại từ, bộ câu — kỳ mới PHẢI thêm). `check_update.py` = so id cũ / đối chiếu tài liệu (phải ĐẠT trước khi phát hành).
  - `python tools/release.py` = kiểm tra (cú pháp, ảnh `han/`, `giai/` đủ mọi chữ + đã soạn giải thích, không có .pdf/.pack ngoài tools/, `sach.json` khớp khop.txt và không chứa hình) + đổi VERSION
    trong sw.js + deploy hosting. `--check` = chỉ kiểm tra (không đổi sw.js, không deploy).

## Luật dữ liệu người học — BẮT BUỘC
- Tiến độ = `S` (`{v,start,set,it,xp,streak,best,log,badges,upd}` + về sau `itT,gm,hard,pl,note,plans,lt,cup,rec,meo`), `it[id] = [rBox,rDue,wBox,wDue,lapses,introDay]`
  (ngày = số ngày kể từ epoch theo giờ máy; wBox = -1 nếu không có thẻ viết). Lưu 3 nơi:
  localStorage `hanco-tuhoc-v1`, Firestore `hanco_progress/{uid}` (`data` = chuỗi JSON của S, `upd`, `ver`),
  sao lưu ngày `hanco_progress/{uid}/backups/{YYYY-MM-DD}` (giữ 14 bản).
- Đồng bộ luôn GỘP bằng `merge()` (không mất mục nào đã học ở máy nào), không bao giờ ghi đè mù.
- Mỗi lần cập nhật app: CẤM xóa/đặt lại/đổi nghĩa trường cũ của `S` hay đổi khóa localStorage/đường dẫn
  Firestore. Chỉ THÊM trường mới (có giá trị mặc định trong `blank()`/`normalize()`); nếu buộc phải đổi
  cấu trúc thì viết chuyển đổi trong `normalize()` và giữ đọc được dữ liệu cũ.
- `id` của chữ/từ/câu (`c…`, `w…`, `s…`) là id CỐ ĐỊNH lưu ở `tools/work/ids.json` (chữ → id, từ → id, "bộ#số" của câu → id),
  KHÔNG phải vị trí trong mảng (mảng xếp theo tần suất, đổi tự do). Mục mới nhận số tiếp theo; `build_app.py` tự dừng nếu
  mục cũ mất hoặc đổi id. CẤM sửa/xóa mục cũ trong ids.json, đổi tên bộ câu hay đổi chữ chính của mục cũ (muốn gộp chữ
  thì thêm vào cột biến thể). Nếu buộc phải đổi id thì PHẢI viết ánh xạ id cũ → mới trong `normalize()` trước khi phát hành.
- Quy tắc Firestore ở `firestore.rules` (từ Bước 3: thành viên trạng thái "ok" đọc/ghi `hanco_progress/{uid}` của mình + `backups/`;
  quản trị đọc + xóa mọi người, không ghi đè; các bộ `hanco_users/ten/cfg/qt/sach/bxh/meo/bao` xem mục "Nhiều người dùng").
  Thử luật bằng BỘ GIẢ LẬP (không đụng dự án thật) + `node .claude/test-rules.js` — PHẢI ĐẠT hết trước khi deploy luật.
  Deploy hosting không động tới Firestore; chỉ deploy rules khi được yêu cầu (`firebase deploy --only firestore:rules`).
  Mã mới cần luật mới → deploy luật rồi hosting ngay sau (luật lên trước vẫn an toàn vì quản trị luôn được phép).

## Nhiều người dùng (Bước 1–8 kế hoạch `.claude/ke-hoach/nhieu-nguoi-dung.md`, phát hành Bước 9) — gói Firebase MIỄN PHÍ (Spark)
Không có Cloud Functions → mọi kiểm soát nằm ở luật Firestore + trình duyệt. Mọi tính năng mới phải tiết kiệm hạn mức (đọc/ghi/tải).
- ĐỒNG BỘ (Bước 1): gom thay đổi, ghi tối đa ~1 lần/`FB_GAP` = 60 s khi đang học; ghi NGAY khi ẩn màn hình / pagehide / có mạng lại /
  "Đồng bộ ngay"; không có gì mới thì không ghi. Không `get()` trước mỗi lần ghi: gộp với bản mới nhất nhận qua `onSnapshot` (`fbGot`/
  `applyRemote`/`fbAhead`), trường `w` = mã lần ghi. localStorage `hanco-fb-ok` = "uid|S.upd" lúc khớp tài khoản.
- TIẾN ĐỘ THEO TÀI KHOẢN trên 1 máy (Bước 2): `hanco-chu` = uid chủ của `hanco-tuhoc-v1` ("" = khách), `hanco-cat-<uid>` = bản đã cất của
  từng tài khoản, sessionStorage `hanco-dn`; `fbOwn` chạy TRƯỚC `fbAttach`: người khác đăng nhập → KHÔNG gộp (cất bản người trước); khách
  có tiến độ → hỏi gộp; máy bản cũ đang đăng nhập → tự nhận. "Đăng xuất và xóa tiến độ khỏi máy này".
- TÀI KHOẢN (Bước 3): Google hoặc email + mật khẩu (xác nhận email); họ tên đầy đủ phải khớp danh sách (`nameKey`, dấu phải đúng; mỗi tên
  1 tài khoản); trần số người; chưa đăng ký xong / bị khóa → cổng `html.gate` (chỉ màn tài khoản), khóa tức thì (nghe hồ sơ). `ADMIN_UID`
  ghi cứng ở app.js + firestore.rules. Firestore: `hanco_users/{uid}` (ten, hoten, hk, email, st ok|khoa|xoa, tao, upd, tk), `hanco_ten/{khóa}`,
  `hanco_cfg/dk` {tran, dem, mo} (ai cũng đọc), `hanco_qt/**` chỉ quản trị. localStorage `hanco-tk`, `hanco-dk`. `?emu` (chỉ localhost) =
  nối bộ giả lập (cách chạy ở file kế hoạch, mục "Cách làm việc").
- QUẢN TRỊ (Bước 4): tab `qt` (chỉ quản trị thấy): tổng quan, người học (mã số 000/001… chỉ quản trị biết, `hanco_qt/ma`), chi tiết, khóa/mở/
  xóa (chặn hoặc cho đăng ký lại, lịch sử `hanco_qt/daxoa`), cần nhắc, họ tên, cài đặt (`hanco_cfg/chung`: thông báo, ngày thi chung, tự xóa),
  nhật ký `hanco_qt/nk-YYYY-MM`. Người học gửi bản tóm tắt `hanco_users/{uid}.tk` ≤ 1 lần/giờ (`sumOf`/`tkSend`, KHÔNG có ghi chú riêng).
  Người mới bắt buộc chọn lộ trình (`planGate`). localStorage `hanco-tk-gui`, `hanco-chung`, `hanco-tb-an`, `hanco-thi-an`, `hanco-qt-nhac`.
- HẠN MỨC (Bước 5): mỗi máy tự đếm đọc/ghi/xóa Firestore + byte (`demPatch`, localStorage `hanco-dem`, sw.js đệm `dem-v1`), gửi kèm `tk.q`/`tk.nb`;
  Quản trị → Hạn mức cộng mọi máy (ước tính), ngày theo giờ Thái Bình Dương. `dung-luong.json` do release.py ghi (cần commit).
- BẢNG XẾP HẠNG (Bước 7): tab `xh`; TOÀN BỘ bảng = 1 tài liệu `hanco_bxh/tong` (mỗi người chỉ sửa `u.<uid mình>`, luật giới hạn mức tăng XP),
  cúp tuần `hanco_bxh/c<thứ Hai>` chốt sau 12:00 thứ Hai; ghi dòng mình ≤ 1 lần/15 phút + khi rời app (`bxhSend`). Huy hiệu nhiều cấp `BFAM`
  (giữ id huy hiệu cũ). `S.cup`, `S.rec`. localStorage `hanco-bxh-gui`, `hanco-bxh-cup`, `hanco-qt-xpla`. Chỉ hiện TÊN HIỂN THỊ.
- CÁCH NHỚ CHUNG (Bước 8): ô "Cách nhớ" (`S.meo`, mọi người thấy, đăng ở `hanco_meo/{id}_{uid}` — KHÔNG đăng chữ đang gõ dở: `meoPub`/
  `meoEditing`) + ô "Ghi chú khác" (= `S.note` cũ, chỉ mình thấy, quản trị cũng không thấy). Chấm 1–5 sao (không chấm của mình), báo không phù hợp
  `hanco_bao` (chỉ quản trị đọc), Quản trị → Cách nhớ. Cách nhớ người khác LUÔN qua `noteClean`. localStorage `hanco-meo-bao`.
- ẢNH ĐẠI DIỆN (người dùng yêu cầu 27/11/2026): `hanco_anh/{uid}` = {d data URL webp/jpeg ≤ 200.000 ký tự (cắt vuông giữa, 384px), v phiên bản ms, upd}.
  Thành viên "ok" đọc; chủ ảnh tạo / ĐỔI (ghi đè → ảnh cũ mất); KHÔNG có gỡ ảnh — chỉ quản trị xóa (khi xóa người, `qtDelete`). Dòng bảng xếp hạng
  có `a` = phiên bản ảnh → máy khác chỉ đọc lại ảnh khi `a` đổi (`avVer`/`avGet`); ảnh đã tải ở Cache Storage `anh-v1`. Nút ảnh cuối thanh mục →
  menu tài khoản (`avMenu`: xem / đổi / tài khoản / đăng xuất); khung xem ảnh = lớp riêng `avModal` (không đóng khung bên dưới). Ảnh hiện ở Xếp hạng,
  hồ sơ, cúp tuần, Hồ sơ của tôi, Cách nhớ (`avHTML` + `avFill`). localStorage `hanco-anh` {uid: phiên bản ảnh của mình}. Không thuộc `S`.
- HAI VAI CỦA QUẢN TRỊ (người dùng yêu cầu 27/11/2026): vai quản trị (tên `tq`, mã = ADMIN_UID) + vai người học (tên `th`, mã riêng ngẫu nhiên `hv`
  28 ký tự giống uid → không ai nối được với quản trị), mỗi vai 1 ảnh (`hanco_anh/{mã}`). Chọn theo chỗ: `bx` bảng xếp hạng + cúp tuần (qt | hv | an =
  ẩn, xóa dòng), `me` cách nhớ chung (qt | hv). MỌI SỐ LIỆU LÀ MỘT (người dùng chốt): XP, cấp, chuỗi, huy hiệu, cúp đều từ `S` của quản trị — đổi vai
  chỉ đổi tên + ảnh + mã dòng. Cấu hình `hanco_qt/vai` {tq, th, hv, bx, me} (luật đọc `hv` qua `vaiHv()` để cho quản trị ghi ảnh / cách nhớ dưới mã đó)
  + localStorage `hanco-qt-vai`; máy chưa đọc được cấu hình (`VAI.ld`) KHÔNG ghi dòng bảng xếp hạng / cách nhớ. Mã: `myKey(chỗ)`/`myName(chỗ)`/`isMine(uid)`
  thay cho `fb.user.uid` ở mọi chỗ "của mình" (bảng xếp hạng, cúp, cách nhớ, ảnh); đổi vai `vaiSetBx`/`vaiSetMe` (chuyển cách nhớ kèm số sao, lỗi → trả
  cài đặt về cũ), dọn dòng thừa `vaiTidy` sau mỗi lần tải bảng. Khung "Hai vai của tôi" + đổi mật khẩu (`vaiCard`/`qtPwCard`) ở Cài đặt → Tài khoản,
  chỉ quản trị. Không thuộc `S`.
- Thêm bộ sưu tập Firestore mới → viết luật + thêm trường hợp vào `.claude/test-rules.js`; thêm trường vào `S` → blank/normalize/merge/`fbAhead`
  + `.claude/test-merge.js`.

## Luật nội dung
- Âm, nghĩa, câu, phiên âm, dịch phải lấy từ các tài liệu trong `tools/sources.json` (giáo trình, đề cương, đề thi người
  dùng gửi). Nghĩa tài liệu không ghi → để ở cột "bổ sung" (hiện ※ xám); âm tài liệu không ghi → tra từ điển và ghi rõ
  "Âm tra từ điển, tài liệu không ghi" ở cột bổ sung. Lỗi in trong tài liệu (vd 煩腦 → 煩惱, 肓 đọc "manh" = 盲) sửa hoặc
  ghi chú, và BÁO người dùng. Mẹo nhớ không có trong đề cương phải ghi rõ là mẹo nhớ. Không tự bịa nội dung thi.
- Chữ Hán luôn hiện bằng font **MS Song** (`--f-han`), dự phòng SimSun/PMingLiU/Noto Serif TC. Dùng chữ phồn thể
  như đề cương. Không nhúng/phát hành file font MS Song (Founder, fsType = Restricted License) — chỉ phát hành ẢNH chữ đã vẽ (`han/`).
- ẢNH CHỮ — BẮT BUỘC, TỰ LÀM KHÔNG CẦN HỎI (người dùng yêu cầu 25/11/2026): MỌI chữ Hán app có thể hiện — chữ/từ/câu mới,
  chữ trong giải thích `giai/`, chữ mẫu chấm nét, chữ thêm vào mã giao diện (vd ký hiệu thanh mục `MENU_IC`) — PHẢI có ảnh `han/`
  vẽ bằng MS Song. Hễ thêm/đổi chữ ở đâu thì tự chạy `render_han.py --missing` + vẽ ngay trong cùng lượt làm việc, KHÔNG trả lời
  4 mục, không hỏi. Chữ MS Song không có → `render_han.py` tự vẽ bằng phông kiểu Tống gần nhất có chữ đó (FZSong Superfont cùng
  hãng Founder → SimSun-ExtB → Adobe Song Std, chọn theo bảng mã phông, đã canh theo MS Song), ghi vào `tools/work/han_font.txt`
  và BÁO người dùng chữ nào không phải MS Song. Không phông nào có → báo người dùng. Sau khi vẽ: xem lại ảnh mới bằng mắt (cạnh ảnh
  MS Song cũ: không lệch, không cắt nét, không ô trống). `release.py` DỪNG nếu còn chữ thiếu ảnh.
- "Thông dụng" = xuất hiện ≥ 3 lần trong tất cả tài liệu hoặc có trong một đề cương / đề thi (hiện 759 chữ, 850 từ).
  Từ 1 chữ không lặp lại ở danh sách từ.
- Lộ trình THEO KỲ (người dùng yêu cầu 26/11/2026; kế hoạch + nhật ký: `.claude/ke-hoach/lo-trinh-nhieu-ky.md`): người học tự
  chọn kỳ (Kỳ 1 (Hán 1) · Kỳ 2 (Hán 2) · Giữa kỳ 3 (Hán 3); tổng cộng sẽ có 6 kỳ) + ngày thi từng kỳ, học nhiều kỳ cùng lúc được;
  app tự xếp lịch (`S.plans`, khung "Chọn kỳ học" `planPick`, bộ xếp lịch `buildPlans`/`pstate` trong app.js). Mỗi kỳ: chữ + từ
  từ ngày đầu, loại từ từ 1/5 chặng, câu từ 1/2 chặng, ~15% cuối (2–7 ngày) chỉ ôn + thi thử, cứ 7 ngày 1 ngày ôn. Nội dung kỳ =
  chữ/từ có trong đề cương / đề thi của kỳ (không tính giáo trình). DÙ THẾ NÀO mục lặp lại nhiều học trước (chữ, từ, loại từ theo
  số lần xuất hiện; câu: câu đã ra đề thi trước, rồi câu nhiều chữ phổ biến). Mục trùng nhiều kỳ học 1 lần ở kỳ thi sớm hơn.
  "Việc hôm nay" chia theo từng kỳ + mục Chung. Phần không thuộc kỳ nào học khi không còn kỳ nào đang học (số chữ/từ trong Cài đặt).
  Loại từ có lịch ôn riêng `S.lt`. Tên kỳ: tên đầy đủ ở chỗ rộng, tên gọi tắt ở chỗ hẹp.

## Hiện điểm cộng — BẮT BUỘC, TỰ LÀM KHÔNG CẦN HỎI (người dùng yêu cầu 26/11/2026)
- MỌI lần cộng XP (màn / trò chơi / tính năng mới, hay đổi chỗ cộng điểm) đều phải HIỆN cho người học "+N XP" + âm thanh
  (lên cấp → khung "Lên cấp N!" + nhạc). Tự đảm bảo trong cùng lượt làm việc, không cần người dùng nhắc.
- Cách làm: cộng điểm CHỈ qua `addXP(n)` (trong app.js) / `HC.addXP(n, nút vừa bấm)` — hiệu ứng nằm sẵn trong `addXP` → `xpShow`
  (chữ bay từ nút; không có nút → huy hiệu cạnh ô XP; cộng liên tiếp trong 0,6 giây gộp 1 lần), âm `coin`/`tones`, lên cấp `lvUp`.
  CẤM cộng thẳng `S.xp += …` (sẽ không hiện gì). Có nút vừa bấm thì truyền nút vào. Âm thanh theo công tắc `S.set.sound`.
- Thêm/sửa chỗ cộng điểm → dò `S.xp` và `addXP` trong app.js, games.js, rồi chạy thử thật thấy "+N XP" hiện ra.

## Giao diện 3 loại máy — BẮT BUỘC (người dùng yêu cầu 25/11/2026)
Người dùng học chủ yếu trên máy tính bảng Samsung Galaxy Tab S9 FE để NẰM NGANG (khung ~1280×600–700), ngoài ra máy tính và
điện thoại. Mọi màn hình, kể cả màn/tính năng thêm sau này, phải dùng được trên cả 3 loại máy, không phải kéo xuống mới bấm được nút.
- Thanh mục (người dùng yêu cầu 25/11/2026): màn NẰM NGANG ≥ 640px → thanh DỌC bên trái (`.topbar` cố định, `body` lùi
  `--side`): ngang ≥ 1000px rộng 224px (ký hiệu chữ Hán `MENU_IC` + tên mục, nút «/» thu gọn → `html.menu-gon`, nhớ ở localStorage
  `hanco-menu-gon`, không thuộc `S`); ngang 640–999px luôn thanh hẹp 76px (ký hiệu + nhãn ngắn). Màn dọc / hẹp → thanh mục ở
  TRÊN, 1 hàng; mục không vừa dồn vào nút » cuối hàng (`fitMenu`, đo lại khi đổi cỡ / phông tải xong). Người học tự SẮP XẾP vị trí
  các mục (khung "Sắp xếp thanh mục" `openMenuSort`, mở từ », nút "⇅ Sắp xếp mục" cuối thanh dọc, màn Cài đặt), lưu RIÊNG từng máy
  ở localStorage `hanco-menu-thu-tu`, không thuộc `S`; `menuOrder()` luôn trả đủ mục của `VIEWS` (mục mới tự vào cuối). Thêm mục
  mới vào `VIEWS` thì thêm cả ký hiệu + nhãn ngắn vào `MENU_IC`. Khung `position: fixed` mới phải tính `--side` (đừng che thanh dọc).
- Nút chính của mỗi bước (Xem đáp án, Quên/Nhớ, Chấm điểm, Tiếp, Trước/Sau, Kiểm tra…) bọc trong `.acts` (thường là
  `<div class="row acts">`): thanh nút dính đáy màn hình. Không đặt 2 `.acts` liền nhau trong cùng một khung (sẽ chồng lên nhau)
  — gộp thành 1 `.acts` chứa nhiều `.row`.
- Màn có ô viết dùng `.work` với 4 phần theo thứ tự `.winfo` (đề) · `.wpadc` (ô viết + `.acts`) · `.wfb` (kết quả chấm) ·
  `.gtwrap`; màn rộng / nằm ngang tự thành 2 cột. `makePad` tự tính cỡ ô theo cả chiều ngang lẫn chiều cao màn hình.
- Hàng nút / khung kết quả đang ẩn dùng `.row.hide` / `.gfb.hide` (không giữ chỗ). Chỉ đáp án trong thẻ `.fc` mới giữ chỗ.
- Không ghi cứng chiều cao/chiều rộng theo px cho khung lớn; dùng `min(…, 100%)`, grid `auto-fit`, và các @media có sẵn cuối
  phần CSS trong index.html (màn rộng/nằm ngang ≥ 900px hoặc ≥ 640px nằm ngang; thanh trên 1 hàng; màn thấp ≤ 820px; rất thấp ≤ 500px).
- Kiểm tra TRƯỚC KHI PHÁT HÀNH bằng `.claude/layout-check.js` (dán vào console / javascript_tool ở trang app chạy bằng
  http.server; `layoutSeed()` nếu chưa có thẻ đã học, rồi `await layoutCheck()`), ở đủ các khung: điện thoại dọc 375×660 và
  375×812, điện thoại ngang 740×360, máy tính bảng ngang 1280×650 và 1280×590, máy tính bảng dọc 800×1180, máy tính 1366×650
  và 1920×960. Phải không còn dòng "LOI". Màn mới → thêm tên màn vào danh sách trong script nếu script chưa tự đi tới.
- Chạy kiểm tra trên Ở CẢ CHẾ ĐỘ ẢNH CHỮ (người dùng yêu cầu 25/11/2026): mở trang với `?song=img` (giống máy tính bảng / điện
  thoại không có MS Song) và chạy lại `layoutCheck()` ở đủ 8 khung. Chế độ này chạy thêm mã đổi chữ sang ảnh nên lỗi chỉ xảy ra
  trên máy tính bảng (vd app đơ cứng) chỉ thấy được ở đây. Đạt khi: không dòng "LOI", lệnh chạy xong không bị treo (trang treo →
  lệnh javascript_tool hết giờ), và khung trình duyệt phải đang HIỆN (khung ẩn làm sai số đo thời gian).

## Cách làm việc
- Chỉ sửa file được yêu cầu, không refactor lan man; giữ ES5 + `HC.u` helpers, chuỗi giao diện tiếng Việt.
- Hẹn giờ trong trò chơi dùng `HC.later` (tự hủy khi rời màn hình). Điều hướng dùng `HC.go(tên)`.
- Kiểm tra: `node --check app.js games.js sw.js`; chạy thử bằng `python -m http.server` rồi mở trình duyệt.
  Bài thử ở máy (`.claude/`): `node .claude/test-merge.js app.js`, `test-sync.js app.js`, `test-owner.js app.js`, `test-sw-dem.js`; với giả lập:
  `test-rules.js`, dữ liệu thử `qt-seed.js`, bố cục `layout-check.js` (+ màn quản trị khi đăng nhập quản trị), `tk-layout.js`, `meo-layout.js`.
- Phát hành: `python tools/release.py` → commit (kèm dòng Co-Authored-By) → `git push` (GitHub Pages tự cập nhật).
  Báo người dùng link https://hanco-tuhoc.web.app sau khi deploy.
- KHÔNG quét toàn repo trừ khi được yêu cầu; `app-data.json` rất lớn — đừng đọc cả file, dùng script để tra.

## Kế hoạch nhiều bước đang làm — ĐỌC TRƯỚC khi sửa phần liên quan
- **Kho chữ/từ/câu khó + playlist + 2 trò chơi riêng · Giải thích từng chữ (Pinyin, nghĩa + từ loại, cấu tạo, mẹo nhớ) ·
  Ghi chú cho chữ/từ/câu** (người dùng duyệt 25/11/2026): `.claude/ke-hoach/kho-kho-giai-thich-ghi-chu.md` (chỉ ở máy).
  File đó ghi những gì đã thống nhất (vd gõ âm PHẢI đúng dấu; trò kho khó KHÔNG đổi lịch SRS; từ/câu không có giải thích
  riêng mà bấm vào từng chữ), thiết kế 3 trường mới của `S` (`hard`, `pl`, `note`), các bước và nhật ký bước nào đã xong.
  Mỗi chat làm đúng MỘT bước, cập nhật nhật ký trong file đó; không làm trái điều đã thống nhất nếu người dùng chưa đổi.
- Ghi chú (người dùng yêu cầu 26/11/2026): TỰ ĐỘNG LƯU + định dạng (đậm/nghiêng/gạch chân, màu, tô nền, cỡ chữ, link) với thanh công cụ GỌN 1 hàng.
  `S.note[id][0]` = chữ thường (cũ) hoặc HTML đã lọc bằng `noteClean` (chỉ b/i/u/br/div, span lớp tc/hl/fs, a http/https) — LUÔN hiện qua `noteClean`,
  không bao giờ gán innerHTML thô. Ô soạn là `[contenteditable]` (đã thêm vào SG_SKIP và các phím tắt bỏ qua).

## Luật "Mục mới phải đủ" (người dùng yêu cầu 25/11/2026)
- Mỗi lần thêm tài liệu, chữ/từ/câu MỚI phải tự động có ĐỦ MỌI THỨ mục cũ cùng loại đang có, ở mọi phương diện: âm, nghĩa,
  id, `net/` (+ `r`), `app-strokes.json`, ảnh `han/`, `gt`/`gtc`/`gts`/`dt`/`bf`, giải thích từng chữ (`giai/`, khi đã có),
  lộ trình, tra cứu, trò chơi, thi thử, kho khó / ghi chú — kể cả các tính năng thêm sau này.
- Tính năng nào thêm dữ liệu theo từng mục thì PHẢI thêm bước sinh dữ liệu đó vào quy trình "Khi người dùng gửi thêm tài
  liệu" dưới đây VÀ thêm kiểm tra "mục nào còn thiếu" vào `check_update.py` hoặc `release.py`.

## Khi người dùng gửi thêm tài liệu (đề cương, đề thi, giáo trình) — TỰ ĐỘNG LÀM
Người dùng yêu cầu (23/11/2026): gửi tài liệu mới = đồng ý cho cả quy trình dưới đây, KHÔNG cần trả lời 4 mục rồi chờ
như mục sau; vẫn sao lưu, kiểm tra đầy đủ. Chỉ dừng hỏi khi: (1) sắp deploy + đẩy GitHub (hỏi 1 lần, kèm báo cáo số liệu);
(2) cần sửa ngoài quy trình này (vd đổi cấu trúc `S`, đổi luật); (3) tài liệu mâu thuẫn mà không tự quyết được.
1. Sao lưu file sẽ sửa vào `tools/backup/<ngày-giờ>/`; chép bản `app-data.json` hiện tại vào `tools/work/app-data.before.json`.
2. Lưu PDF vào `tools/src/`, khai 1 mục trong `tools/sources.json` (mã chữ cái tiếp theo, loại, kỳ, tên ngắn), trích text
   (`python extract.py ...`). Mở ảnh trang PDF để soát chỗ bố cục lộn xộn (bảng, ô loại từ) thay vì đoán từ text.
3. Đọc và soát KỸ toàn bộ tài liệu: tách từ vựng, từ ngữ pháp / loại từ, câu (chữ Hán + phiên âm + dịch), cấu trúc đề
   (viết parser kiểu `parse_gk3.py`, có kiểm tra đủ số mục). Dóng hàng chữ ↔ âm để lấy âm từng chữ mới. Liệt kê:
   chữ mới, từ mới, câu mới, từ ngữ pháp mới, chữ cũ có thêm âm, lỗi in (sửa trong parser + ghi chú).
4. Bổ sung từ điển: chữ mới → `work/chars<n>.txt` mới, từ mới → `work/words<n>.txt` mới, câu → `work/sents.txt`
   (bộ mới, cờ k/w), loại từ / câu ví dụ / đề thi thử theo cấu trúc đề mới → `build_app.py`. Theo đúng Luật nội dung.
5. Đếm lại toàn bộ số lần xuất hiện trên MỌI tài liệu (`build.py`), xếp lại theo tần suất, tính lại "thông dụng".
6. Kỳ mới: thêm 1 mục vào `TERMS` trong build_app.py (mã kỳ như sources.json, tên đầy đủ + tên gọi tắt theo kiểu "Kỳ n (Hán n)" —
   HỎI người dùng tên trước, khóa đề thi thử, bảng loại từ `LTK`, đầu tên bộ câu); `build_app.py` + `check_update.py` tự dừng nếu thiếu.
   Người học tự chọn kỳ + ngày thi trong app, app tự xếp lịch (không ghi cứng số tuần). Tiến độ đã học giữ nguyên;
   thẻ đã học vẫn ôn theo lịch SRS cũ. Các con số trên giao diện lấy từ dữ liệu, không ghi cứng.
7. Sinh lại: `build.py`, `build_app.py` (id cũ phải giữ — xem luật id), `check_update.py` (phải ĐẠT), `build_strokes.py`,
   `build_order.py`, `python sach_khop.py` (dò chữ mới trong sách; chỗ "cần soát" mở trang sách xem) rồi `python sach_pack.py` (sach.json + gói
   hình; có trang MỚI thì nhắc người dùng đưa lại gói ở Cài đặt → Hình trang sách — chỉ trang mới/đổi được ghi), `python build_giai.py` (mọi chữ mới có
   file giai/ với pinyin), rồi SOẠN giải thích cho MỌI chữ mới theo `tools/work/giai/README.txt` + yêu cầu trong
   `.claude/ke-hoach/kho-kho-giai-thich-ghi-chu.md` (tệp dot mới) và chạy lại `build_giai.py`. `check_update.py` cảnh báo chữ
   chưa có giải thích / chưa dò sách; `release.py --check` DỪNG nếu thiếu file giai/ HOẶC còn chữ chưa soạn giải thích (đủ 1.324 từ 26/11/2026).
   CUỐI CÙNG (sau khi soạn xong giải thích, vì lời giải thích cũng có chữ Hán): vẽ ảnh `han/` cho MỌI chữ còn thiếu —
   `python tools/render_han.py --missing` + mở trang vẽ (theo luật "Ảnh chữ"; chỉ vẽ chữ thiếu, ảnh cũ giữ nguyên).
8. Kiểm tra: node --check; chạy app ở máy (Học mới, Câu, Loại từ, Tra cứu chữ mới, Thi thử đề mới, bản điện thoại);
   mô phỏng lộ trình theo ngày; thử tiến độ cũ + `merge()` (không mất mục nào); đối chiếu luật "Mục mới phải đủ"
   (chữ/từ/câu mới có đủ mọi thứ mục cũ có — liệt kê mục còn thiếu, không bỏ qua im lặng).
9. Báo cáo người dùng: số chữ / từ / câu / từ ngữ pháp mới, lỗi in đã xử lý, lộ trình mới (số tuần, mỗi ngày bao nhiêu),
   kết quả kiểm tra → hỏi deploy. Được đồng ý → `release.py` → commit → push → mở link thật kiểm tra.

## Quy trình trước khi sửa — BẮT BUỘC
- Ngoại lệ (người dùng yêu cầu 25/11/2026): vẽ ảnh `han/` cho chữ còn thiếu (luật "Ảnh chữ" ở Luật nội dung) → tự làm, không hỏi.
- Khi người dùng yêu cầu sửa/thêm/xóa bất cứ gì (mã, dữ liệu, giao diện, luật, deploy), KHÔNG sửa ngay.
  Trả lời trước bằng 4 mục rồi DỪNG, chờ người dùng đồng ý:
  1. Ý hiểu: nhắc lại yêu cầu bằng lời của mình (nêu rõ chỗ còn mơ hồ và cách mình định hiểu).
  2. Sẽ sửa: những file/phần nào, làm gì; những gì KHÔNG đụng tới.
  3. Rủi ro và cách khắc phục: với MỖI rủi ro (tiến độ người học S/localStorage/Firestore,
     nội dung đề cương, link đang dùng, máy khác/điện thoại) ghi rõ:
     (a) rủi ro gì; (b) cách khắc phục cụ thể sẽ LÀM; (c) cách chứng minh đã khắc phục.
     Khắc phục là một phần của việc sửa: phải làm thật, không chỉ nêu. Không khắc phục được
     → nói rõ và để người dùng quyết.
     Biện pháp luôn làm:
     - Trước khi sửa: chép bản hiện tại của các file sẽ sửa vào tools/backup/<ngày-giờ>/
       để quay lại được.
     - Đụng tới S/blank/normalize/merge/đồng bộ: thử với bản sao dữ liệu tiến độ cũ,
       chứng minh đọc được và không mất mục nào.
     - Trước deploy: node --check + chạy thử bằng http.server.
     - Sau deploy: mở https://hanco-tuhoc.web.app kiểm tra thật.
  4. Cách kiểm tra: sẽ thử gì sau khi sửa, cái gì không tự thử được.
- Chỉ bắt đầu sửa khi người dùng xác nhận (vd "đồng ý", "làm đi"). Câu hỏi thuần, đọc/tra cứu thì không cần.
- Đang làm mà phát hiện cần sửa thêm ngoài phạm vi đã duyệt → dừng, hỏi lại.
- Việc không hoàn tác được (deploy, đẩy GitHub, đổi luật Firestore, xóa dữ liệu) phải được nêu rõ
  trong bước 2 và chỉ làm sau khi được duyệt.
- Làm xong: báo đã sửa gì; theo từng rủi ro → đã khắc phục bằng gì → kết quả kiểm tra thật;
  còn gì chưa kiểm tra được.
