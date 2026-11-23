# App Hán cổ tự học — Quy ước cho Claude Code
- Web app tự học Hán cổ năm 1 (Khoa Phật học từ xa, Học viện PGVN TP.HCM, Khóa XI): thẻ nhớ ôn ngắt
  quãng, tập viết, 214 bộ thủ, loại từ, 90 câu đề cương (HK1, kỳ 2, giữa kỳ 3), 11 trò chơi, thi thử 3 đề. JS thuần (ES5, không
  build, không framework), Firebase compat 10.14.1 (Auth Google + Firestore). Ngôn ngữ UI: tiếng Việt.
- Link chính: https://hanco-tuhoc.web.app (Firebase Hosting, dự án `hanco-tuhoc`). Bản phụ:
  GitHub Pages thuhd97bhp/hanco-tuhoc (repo CÔNG KHAI — không commit bí mật, không commit `tools/`).

## Cấu trúc
- `index.html` = HTML + toàn bộ CSS (token màu sáng/tối trên `:root`) + nạp Firebase rồi `app.js`, `games.js`.
- `app.js` = lõi: dữ liệu, trạng thái `S`, SRS, lộ trình ôn thi (đọc `plan` trong app-data.json), đồng bộ Firebase, router, các màn hình.
- `games.js` = 11 trò chơi (`reg({...})`) + `runQuiz` + thi thử (`HC.exam`: đề HK1, kỳ 2 viết trong mã; đề khai trong
  app-data.json → `exams` chạy chung một bộ, vd đề giữa kỳ 3). Dùng API qua `window.HC`.
- `sw.js` = service worker cho chạy ngoại tuyến (mã app: mạng trước, mất mạng dùng đệm; Firebase
  SDK/phông: đệm trước; KHÔNG bao giờ đệm request Firestore/Auth).
- `app-data.json` = dữ liệu sinh từ `tools/` (chars, words, sents, rads, loaitu; `ltq` câu ví dụ loại từ theo kỳ;
  `exams` đề thi thử; `plan` lộ trình; `srcs` tên tài liệu; mục có `fo: 1` = thuộc kỳ thi đang ưu tiên). KHÔNG sửa tay.
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
- `han/<mã hex>.webp` = ảnh từng chữ vẽ bằng MS Song (320x320, chữ 256px ở giữa), dùng cho chữ mẫu ở ô tập viết và chữ to `.big`
  trên máy KHÔNG cài MS Song (điện thoại). Sinh bằng `python tools/render_han.py` rồi mở http://127.0.0.1:8770/render_han.html
  trên máy Windows có MS Song. Thêm chữ mới vào dữ liệu → PHẢI chạy lại cả 2 lệnh trên (release.py sẽ dừng nếu thiếu ảnh).
  Thử giao diện ảnh trên máy có MS Song: thêm `?song=img` vào địa chỉ. Chỉ vẽ chữ chưa có ảnh: `render_han.py --missing`
  (chữ MS Song không có, vd ⺗ ⺮ ⻗: xóa ảnh vẽ ra — app vẽ từ dữ liệu nét).
- DẠNG RÚT GỌN + DẠNG BỘ (người dùng yêu cầu 24/11/2026): chữ/từ có `gt` = dạng rút gọn (giản thể) — tài liệu không ghi nên tra
  bằng OpenCC (`pip install opencc`, t2s đổi theo cả cụm từ; sửa tay ở `tools/work/gianthe_sua.txt`), app luôn ghi ※ "tra từ
  điển"; `gtc` chữ khác cùng dạng rút gọn (發/髮 → 发), `gts` dạng rút gọn trùng một chữ phồn thể khác (後 → 后), `dt` dị thể
  (cột biến thể trừ giản thể và dạng bộ). Bộ thủ có `forms` từ `tools/work/forms.txt` (`số bộ|dạng|bo/gt/kh|vị trí|GT giáo
  trình HK1 / TD tra từ điển|ghi chú`, kèm chữ ví dụ); chữ có `bf` = bộ viết theo dạng nào trong chữ đó (suy từ `radStrokes` của
  hanzi-writer-data, chỉ ghi khi số nét + vị trí khớp), net/ của chữ đó có `r` (chỉ số nét thuộc bộ) để TÔ MÀU phần bộ trong
  hoạt hình. Tập viết: chữ phồn thể BẮT BUỘC; dạng rút gọn KHÔNG bắt buộc (nút "Viết thêm dạng rút gọn"), đã viết thì phải
  đúng CẢ HAI mới tính Đúng; viết dạng rút gọn vào ô phồn thể → Sai, app báo rõ. Không thêm trường nào vào `S`.
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
    lộ trình (`PLAN`). `check_update.py` = so id cũ / đối chiếu tài liệu (phải ĐẠT trước khi phát hành).
  - `python tools/release.py` = đổi VERSION trong sw.js + kiểm tra cú pháp + deploy hosting.

## Luật dữ liệu người học — BẮT BUỘC
- Tiến độ = `S` (`{v,start,set,it,xp,streak,best,log,badges,upd}`), `it[id] = [rBox,rDue,wBox,wDue,lapses,introDay]`
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
- Quy tắc Firestore ở `firestore.rules` (mỗi người chỉ đọc/ghi `hanco_progress/{uid}` của mình).
  Deploy hosting không động tới Firestore; chỉ deploy rules khi được yêu cầu.

## Luật nội dung
- Âm, nghĩa, câu, phiên âm, dịch phải lấy từ các tài liệu trong `tools/sources.json` (giáo trình, đề cương, đề thi người
  dùng gửi). Nghĩa tài liệu không ghi → để ở cột "bổ sung" (hiện ※ xám); âm tài liệu không ghi → tra từ điển và ghi rõ
  "Âm tra từ điển, tài liệu không ghi" ở cột bổ sung. Lỗi in trong tài liệu (vd 煩腦 → 煩惱, 肓 đọc "manh" = 盲) sửa hoặc
  ghi chú, và BÁO người dùng. Mẹo nhớ không có trong đề cương phải ghi rõ là mẹo nhớ. Không tự bịa nội dung thi.
- Chữ Hán luôn hiện bằng font **MS Song** (`--f-han`), dự phòng SimSun/PMingLiU/Noto Serif TC. Dùng chữ phồn thể
  như đề cương. Không nhúng/phát hành file font MS Song (Founder, fsType = Restricted License) — chỉ phát hành ẢNH chữ đã vẽ (`han/`).
- "Thông dụng" = xuất hiện ≥ 3 lần trong tất cả tài liệu hoặc có trong một đề cương / đề thi (hiện 759 chữ, 850 từ).
  Từ 1 chữ không lặp lại ở danh sách từ.
- Lộ trình (người dùng yêu cầu 23/11/2026): mọi chữ, từ, câu, loại từ của KỲ THI SẮP TỚI (mục `fo`, hiện giữa kỳ 3:
  424 chữ, 443 từ, 35 câu, 38 từ ngữ pháp) học TRƯỚC trong `PLAN.weeks` tuần (hiện 5: tuần 1–4 học mới ~18 chữ + ~18 từ
  mỗi ngày, câu từ tuần 2, tuần 5 chỉ ôn + thi thử). Phần không thuộc kỳ đó học SAU lộ trình (thông dụng còn lại trước,
  rồi phần còn lại) theo số chữ/từ mỗi ngày trong Cài đặt. Mỗi tuần 6 ngày học + 1 ngày ôn.

## Cách làm việc
- Chỉ sửa file được yêu cầu, không refactor lan man; giữ ES5 + `HC.u` helpers, chuỗi giao diện tiếng Việt.
- Hẹn giờ trong trò chơi dùng `HC.later` (tự hủy khi rời màn hình). Điều hướng dùng `HC.go(tên)`.
- Kiểm tra: `node --check app.js games.js sw.js`; chạy thử bằng `python -m http.server` rồi mở trình duyệt.
- Phát hành: `python tools/release.py` → commit (kèm dòng Co-Authored-By) → `git push` (GitHub Pages tự cập nhật).
  Báo người dùng link https://hanco-tuhoc.web.app sau khi deploy.
- KHÔNG quét toàn repo trừ khi được yêu cầu; `app-data.json` rất lớn — đừng đọc cả file, dùng script để tra.

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
6. Xếp lại lịch học và ôn: kỳ thi của tài liệu mới thành kỳ ưu tiên (`fo`, `PLAN` trong build_app.py): toàn bộ chữ, từ,
   câu, loại từ của kỳ đó học trước; phần khác học sau. Số tuần: theo thời gian tới kỳ thi người dùng nói; không nói thì
   chọn sao cho mỗi ngày ≤ ~20 chữ + ~20 từ và chừa tuần cuối để ôn + thi thử (lần này: 5 tuần). Tiến độ đã học giữ nguyên;
   thẻ đã học vẫn ôn theo lịch SRS cũ. Các con số trên giao diện lấy từ dữ liệu, không ghi cứng.
7. Sinh lại: `build.py`, `build_app.py` (id cũ phải giữ — xem luật id), `check_update.py` (phải ĐẠT), `build_strokes.py`,
   `build_order.py`, ảnh `han/` cho chữ mới (render_han; giữ nguyên ảnh cũ: `git checkout -- han` sau khi vẽ).
8. Kiểm tra: node --check; chạy app ở máy (Học mới, Câu, Loại từ, Tra cứu chữ mới, Thi thử đề mới, bản điện thoại);
   mô phỏng lộ trình theo ngày; thử tiến độ cũ + `merge()` (không mất mục nào).
9. Báo cáo người dùng: số chữ / từ / câu / từ ngữ pháp mới, lỗi in đã xử lý, lộ trình mới (số tuần, mỗi ngày bao nhiêu),
   kết quả kiểm tra → hỏi deploy. Được đồng ý → `release.py` → commit → push → mở link thật kiểm tra.

## Quy trình trước khi sửa — BẮT BUỘC
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
