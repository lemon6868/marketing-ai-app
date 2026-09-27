# Marketing AI — v1

Trợ lý AI marketing cho shop, quán ăn, hộ kinh doanh nhỏ tại Việt Nam. Bản v1 là web app / PWA — chạy trong trình duyệt, cài được vào màn hình chính điện thoại như app thật.

## Kiến trúc

- `server.js` — server Node (Express) vừa phục vụ giao diện web (thư mục `public/`), vừa làm proxy an toàn gọi Anthropic API (API key chỉ nằm ở server, không lộ ra trình duyệt).
- `public/` — toàn bộ giao diện: `index.html`, `styles.css`, `app.js`, PWA `manifest.json` + `service-worker.js`, ảnh trong `img/` và `icons/`.

Khi bạn thao tác trên trang (gửi order, chat với AI trợ lý, hỏi hội đồng cố vấn), trình duyệt gọi tới `/api/messages` trên chính server này; server gọi tiếp sang Anthropic bằng API key và trả kết quả về.

## Cài đặt lần đầu

Yêu cầu: đã cài [Node.js](https://nodejs.org/) bản 18 trở lên.

```bash
npm install
```

Tạo file `.env` từ mẫu, rồi điền API key thật vào:

```bash
cp .env.example .env
```

Mở `.env`, dán API key (lấy tại [console.anthropic.com](https://console.anthropic.com/) → API Keys):

```
ANTHROPIC_API_KEY=sk-ant-...key-thật-của-bạn...
```

Muốn Phiếu 02 tự tạo ảnh gợi ý thật (không chỉ concept chữ), lấy thêm 1 API key **miễn phí** tại [aistudio.google.com](https://aistudio.google.com/) (mục "Get API key"), rồi điền vào `.env`:

```
GOOGLE_API_KEY=...key-thật-của-bạn...
```

Không có key này, app vẫn chạy bình thường — Phiếu 02 chỉ hiện thông báo chưa cấu hình thay vì ảnh.

**Lưu ý quan trọng — tạo ảnh KHÔNG nằm trong gói miễn phí của Google**: khác với model chat (được miễn phí hào phóng), các model tạo ảnh ("Nano Banana") có hạn mức miễn phí là 0 — Google yêu cầu tài khoản phải **bật thanh toán (billing/thẻ)** trên Google Cloud thì mới gọi được, dù chi phí thực tế rất rẻ (~0,03-0,07 USD/ảnh tuỳ độ phân giải, xem [trang giá](https://ai.google.dev/gemini-api/docs/pricing)). Cách bật:
1. Vào [aistudio.google.com](https://aistudio.google.com/) → mở project đang dùng.
2. Vào phần **Billing** / **Set up billing** (hoặc qua [Google Cloud Console](https://console.cloud.google.com/) → Billing) → liên kết 1 tài khoản thanh toán (thẻ) vào project đó.
3. Sau khi bật billing, dùng lại đúng `GOOGLE_API_KEY` cũ — không cần đổi key.

Nếu chưa bật billing, Phiếu 02 sẽ báo lỗi kiểu "Quota exceeded... limit: 0" — đây là dấu hiệu cần bật thanh toán, không phải lỗi code.

## Chạy thử

```bash
npm start
```

Mở trình duyệt tại `http://localhost:3000`. Nếu chưa điền API key, trang vẫn mở được nhưng sẽ báo lỗi khi bấm các nút tạo nội dung — banner đỏ đầu trang sẽ nhắc bạn.

## Cài vào điện thoại như app thật (PWA)

1. Triển khai (deploy) app lên 1 địa chỉ HTTPS công khai (xem mục Triển khai bên dưới) — PWA cần HTTPS mới cài được, trừ khi test trên `localhost`.
2. Mở địa chỉ đó bằng trình duyệt trên điện thoại.
3. **Android (Chrome)**: trình duyệt tự gợi ý "Thêm vào màn hình chính" (Add to Home Screen), hoặc vào menu ⋮ → Thêm vào màn hình chính.
4. **iOS (Safari)**: bấm nút Chia sẻ (hình vuông có mũi tên) → Thêm vào Màn hình chính (Add to Home Screen).

## Triển khai (deploy) để dùng thật

App là 1 server Node đơn giản, chạy được trên bất kỳ nền tảng nào hỗ trợ Node — vài lựa chọn phổ biến:

- **Render.com** — miễn phí tier nhỏ, dễ nhất: kết nối repo Git, chọn "Web Service", set biến môi trường `ANTHROPIC_API_KEY`, Render tự `npm install && npm start`.
- **Railway.app** — tương tự Render, deploy bằng vài cú click.
- **Fly.io** hoặc VPS riêng (DigitalOcean, Vultr...) — cần tự cấu hình domain + HTTPS (dùng Let's Encrypt/Caddy), phù hợp khi cần kiểm soát nhiều hơn.

Dù chọn nền tảng nào, luôn set `ANTHROPIC_API_KEY` (và `GOOGLE_API_KEY` nếu dùng tạo ảnh) là biến môi trường trên đó — **không** commit file `.env` lên Git (đã có trong `.gitignore`).

## Đánh giá sao từ khách hàng

Lần đầu mở app, 1 modal tự hiện sau ~1.5 giây xin khách chấm 1-5 sao + góp ý (không bắt buộc). Khách có thể bấm "Để sau" để bỏ qua. Modal chỉ hiện đúng 1 lần trên mỗi trình duyệt (ghi nhớ qua `localStorage`), dù khách đánh giá hay bỏ qua.

Dữ liệu đánh giá được lưu ở server, file `data/feedback.json` (tự tạo khi có đánh giá đầu tiên; đã nằm trong `.gitignore` nên không bị commit). Xem tổng hợp bất cứ lúc nào tại:

```
http://localhost:3000/api/feedback/summary
```

(khi đã deploy thì đổi `localhost:3000` thành domain thật).

Endpoint này giờ có thể khoá bằng token: đặt biến môi trường `FEEDBACK_TOKEN` (chuỗi bí mật tuỳ ý bạn chọn) trong `.env` hoặc trên Render, sau đó chỉ xem được khi thêm đúng token vào URL:

```
https://domain-that-cua-ban/api/feedback/summary?token=chuoi-bi-mat-ban-dat
```

Không đặt `FEEDBACK_TOKEN` thì endpoint vẫn mở tự do như trước (không khuyến khích khi đã deploy công khai lâu dài).

## Các nâng cấp so với bản đầu

- **Phiếu 02 (Concept hình ảnh)**: ngoài concept chữ, app còn gọi Google Gemini (model "Nano Banana", mặc định `gemini-3.1-flash-lite-image`) để tự tạo 4 ảnh gợi ý thật, hiển thị ngay trong phiếu. Cần `GOOGLE_API_KEY` **và bật billing** trên Google Cloud (xem mục Cài đặt lần đầu ở trên) — nếu chưa có, phiếu chỉ báo lỗi nhẹ, các phần khác của app không bị ảnh hưởng.
- **Phiếu 03 (Kịch bản video)**: kịch bản được định dạng thuần văn bản, mỗi cảnh cách nhau 1 dòng trống để copy dán thẳng vào CapCut. Có nút "📋 Sao chép kịch bản" (copy nhanh vào clipboard) và nút "Mở CapCut ↗" (mở trang CapCut ở tab mới) ngay trong phiếu.
- **Phiếu 04 (Caption & hashtag)**: mỗi caption được AI chèn thêm 2-4 icon/emoji bắt mắt, đặt tự nhiên xen trong câu.
- **Streaming**: 5 phiếu nội dung và "Hội đồng cố vấn" giờ hiện chữ chạy dần từng chút một (giống ChatGPT) thay vì chờ AI viết xong hết mới hiện, qua endpoint `/api/messages/stream`. Riêng khung "AI trợ lý" điền form (dùng tool-calling để tự điền order) vẫn chờ xong mới hiện, do stream xen kẽ với tool-use phức tạp hơn nên chưa làm ở bản này.
- **Bảo vệ endpoint đánh giá**: `/api/feedback/summary` giờ khoá được bằng `FEEDBACK_TOKEN` (xem mục Đánh giá sao ở trên); `/api/feedback` (gửi đánh giá) cũng có rate limit riêng chống spam ảo.
- **Dọn bộ nhớ rate limit**: danh sách IP theo dõi rate limit được dọn định kỳ, tránh phình to vô hạn khi server chạy lâu ngày.

## Giới hạn của v1 (biết trước để không bất ngờ)

- **Không có tài khoản người dùng**: form/chat không lưu lại giữa các lần mở app khác nhau. Mỗi phiên là độc lập.
- **Không tự đăng bài / kết nối Facebook-TikTok-YouTube thật**: trạm "Thiết lập kênh" chỉ viết sẵn nội dung để bạn tự copy dán — việc tự động đăng bài cần tích hợp API chính thức của từng nền tảng (giai đoạn sau).
- **Chi phí API**: mỗi lần tạo nội dung tốn usage thật trên tài khoản Anthropic (và Google nếu dùng Phiếu 02) của bạn. Theo dõi chi phí tại console.anthropic.com → Usage và Google Cloud Console → Billing.
- **Đã có rate limit cơ bản**: tối đa 20 lượt gọi AI / 10 phút / mỗi IP (chỉnh trong `server.js`, biến `RATE_LIMIT_MAX`). Lưu trong bộ nhớ nên chỉ đúng khi chạy 1 tiến trình duy nhất — nếu sau này scale nhiều instance, cần chuyển sang Redis hoặc dịch vụ rate-limit riêng.
- **Khung "AI trợ lý" (điền form) chưa streaming**: xem mục nâng cấp ở trên.

## Chuẩn bị lên App Store / Google Play

Đây hiện là **web app / PWA** — cài được vào màn hình chính và dùng gần như app thật, nhưng **không thể nộp thẳng file này lên App Store hay Google Play**: cả hai store đều yêu cầu 1 gói cài đặt native (`.ipa` cho iOS, `.aab`/`.apk` cho Android), không nhận thẳng địa chỉ web.

Đường đi thực tế phổ biến nhất cho PWA:
- **Android**: dùng công cụ [PWABuilder](https://www.pwabuilder.com/) (miễn phí, của Microsoft) — nhập domain đã deploy, nó tự đóng gói PWA thành file `.aab` dạng "Trusted Web Activity" để nộp lên Google Play Console. Cần 1 tài khoản Google Play Console (phí đăng ký 1 lần ~25 USD).
- **iOS**: PWABuilder cũng hỗ trợ đóng gói iOS, nhưng thực tế thường cần thêm bước dùng Xcode để build và ký (cần máy Mac + tài khoản Apple Developer, phí ~99 USD/năm) trước khi nộp lên App Store Connect.
- Nội dung mô tả, tên app, từ khóa đã soạn sẵn ở `app-store-listing.md` — dùng luôn khi điền form trên Play Console / App Store Connect.

Việc đóng gói native (bước PWABuilder + tài khoản dev) là công đoạn riêng, cần bạn có tài khoản Google Play/Apple Developer đứng tên mình — ngoài phạm vi việc sửa code có thể làm giúp trong phiên này.

## Bước tiếp theo gợi ý

- Thêm lưu trữ (database) nếu muốn giữ lịch sử order giữa các lần mở app, hoặc chuyển feedback từ file JSON sang DB thật khi lượng đánh giá lớn.
- Đóng gói PWA thành app native qua PWABuilder rồi nộp Google Play / App Store (xem mục ngay trên).
