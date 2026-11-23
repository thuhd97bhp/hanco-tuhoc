# App Hán cổ tự học — Quy ước cho Claude Code
- Web app tự học Hán cổ năm 1 (Khoa Phật học từ xa, Học viện PGVN TP.HCM, Khóa XI): thẻ nhớ ôn ngắt
  quãng, tập viết, 214 bộ thủ, loại từ, 55 câu đề cương, 10 trò chơi, thi thử. JS thuần (ES5, không
  build, không framework), Firebase compat 10.14.1 (Auth Google + Firestore). Ngôn ngữ UI: tiếng Việt.
- Link chính: https://hanco-tuhoc.web.app (Firebase Hosting, dự án `hanco-tuhoc`). Bản phụ:
  GitHub Pages thuhd97bhp/hanco-tuhoc (repo CÔNG KHAI — không commit bí mật, không commit `tools/`).

## Cấu trúc
- `index.html` = HTML + toàn bộ CSS (token màu sáng/tối trên `:root`) + nạp Firebase rồi `app.js`, `games.js`.
- `app.js` = lõi: dữ liệu, trạng thái `S`, SRS, lịch 5 tuần, đồng bộ Firebase, router, các màn hình.
- `games.js` = 10 trò chơi (`reg({...})`) + `runQuiz` + thi thử (`HC.exam`). Dùng API qua `window.HC`.
- `sw.js` = service worker cho chạy ngoại tuyến (mã app: mạng trước, mất mạng dùng đệm; Firebase
  SDK/phông: đệm trước; KHÔNG bao giờ đệm request Firestore/Auth).
- `app-data.json` = dữ liệu sinh từ `tools/` (chars, words, sents, rads, loaitu). KHÔNG sửa tay.
- `tools/` (chỉ ở máy, đã gitignore): pipeline dữ liệu từ 3 PDF đề cương.
  - `txt/` bản text trích từ PDF; `work/chars1-5.txt` từ điển chữ `chữ|biến thể|âm|nghĩa đề cương|nghĩa bổ sung`;
    `work/words1-3.txt` từ điển từ `từ|âm|nghĩa đề cương|nghĩa bổ sung`; `work/words_raw.json` danh sách từ trích từ đề cương.
  - Sửa nghĩa/âm → sửa file trong `tools/work/` rồi chạy `cd tools && python build.py && python build_app.py`.
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
- `id` của chữ/từ (`c0…`, `w0…`) là vị trí trong `app-data.json`; thứ tự xếp theo tần suất. Nếu sinh lại dữ liệu
  làm đổi thứ tự/ id thì PHẢI viết ánh xạ id cũ → mới trong `normalize()` trước khi phát hành.
- Quy tắc Firestore ở `firestore.rules` (mỗi người chỉ đọc/ghi `hanco_progress/{uid}` của mình).
  Deploy hosting không động tới Firestore; chỉ deploy rules khi được yêu cầu.

## Luật nội dung
- Âm, nghĩa, câu, phiên âm, dịch phải lấy từ 3 file đề cương (Han-1-ky1.pdf giáo trình HK1, Han1-ky1.pdf
  đề cương in K11, Han-2-ky2.pdf đề cương cuối kỳ 2). Nghĩa đề cương không ghi → để ở cột "bổ sung" (hiện ※ xám).
  Mẹo nhớ không có trong đề cương phải ghi rõ là mẹo nhớ. Không tự bịa nội dung thi.
- Chữ Hán luôn hiện bằng font **MS Song** (`--f-han`), dự phòng SimSun/PMingLiU/Noto Serif TC. Dùng chữ phồn thể
  như đề cương. Không nhúng file font MS Song (giấy phép hạn chế).
- "Thông dụng" = xuất hiện ≥ 3 lần trong 3 file hoặc có trong 2 đề cương (594 chữ, 492 từ), học trong 5 tuần;
  sau đó học tiếp phần còn lại. Từ 1 chữ không lặp lại ở danh sách từ.

## Cách làm việc
- Chỉ sửa file được yêu cầu, không refactor lan man; giữ ES5 + `HC.u` helpers, chuỗi giao diện tiếng Việt.
- Hẹn giờ trong trò chơi dùng `HC.later` (tự hủy khi rời màn hình). Điều hướng dùng `HC.go(tên)`.
- Kiểm tra: `node --check app.js games.js sw.js`; chạy thử bằng `python -m http.server` rồi mở trình duyệt.
- Phát hành: `python tools/release.py` → commit (kèm dòng Co-Authored-By) → `git push` (GitHub Pages tự cập nhật).
  Báo người dùng link https://hanco-tuhoc.web.app sau khi deploy.
- KHÔNG quét toàn repo trừ khi được yêu cầu; `app-data.json` rất lớn — đừng đọc cả file, dùng script để tra.
