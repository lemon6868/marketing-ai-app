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

(khi đã deploy thì đổi `localhost:3000` thành domain thật — endpoint này hiện chưa có xác thực, cân nhắc thêm mật khẩu/token đơn giản trước khi công khai domain thật nếu không muốn ai cũng xem được).

## Các nâng cấp so với bản đầu

- **Phiếu 02 (Concept hình ảnh)**: ngoài concept chữ, app còn gọi Google Gemini (model "Nano Banana", `gemini-2.5-flash-image`) để tự tạo 4 ảnh gợi ý thật, hiển thị ngay trong phiếu. Cần `GOOGLE_API_KEY` (xem mục Cài đặt lần đầu ở trên) — nếu chưa có key, phiếu chỉ báo lỗi nhẹ, các phần khác của app không bị ảnh hưởng.
- **Phiếu 03 (Kịch bản video)**: kịch bản được định dạng thuần văn bản, mỗi cảnh cách nhau 1 dòng trống để copy dán thẳng vào CapCut. Có nút "📋 Sao chép kịch bản" (copy nhanh vào clipboard) và nút "Mở CapCut ↗" (mở trang CapCut ở tab mới) ngay trong phiếu.
- **Phiếu 04 (Caption & hashtag)**: mỗi caption được AI chèn thêm 2-4 icon/emoji bắt mắt, đặt tự nhiên xen trong câu.

## Giới hạn của v1 (biết trước để không bất ngờ)

- **Không streaming**: AI trả lời xong hết mới hiện ra (không gõ chữ dần như bản demo trước). Có thể nâng cấp sau bằng Server-Sent Events.
- **Không có tài khoản người dùng**: form/chat không lưu lại giữa các lần mở app khác nhau. Mỗi phiên là độc lập.
- **Không tự đăng bài / kết nối Facebook-TikTok-YouTube thật**: trạm "Thiết lập kênh" chỉ viết sẵn nội dung để bạn tự copy dán — việc tự động đăng bài cần tích hợp API chính thức của từng nền tảng (giai đoạn sau).
- **Chi phí API**: mỗi lần tạo nội dung tốn usage thật trên tài khoản Anthropic của bạn (khác với bản demo trước dùng usage của người xem). Theo dõi chi phí tại console.anthropic.com → Usage.
- **Đã có rate limit cơ bản**: tối đa 20 lượt gọi AI / 10 phút / mỗi IP (chỉnh trong `server.js`, biến `RATE_LIMIT_MAX`). Lưu trong bộ nhớ nên chỉ đúng khi chạy 1 tiến trình duy nhất — nếu sau này scale nhiều instance, cần chuyển sang Redis hoặc dịch vụ rate-limit riêng.
- **Đánh giá sao chưa có xác thực**: endpoint `/api/feedback/summary` ai có link cũng xem được — cân nhắc thêm bảo vệ trước khi deploy công khai lâu dài.

## Bước tiếp theo gợi ý

- Thêm streaming để trải nghiệm mượt hơn (giống bản demo trước).
- Thêm lưu trữ (database) nếu muốn giữ lịch sử order giữa các lần mở app, hoặc chuyển feedback từ file JSON sang DB thật khi lượng đánh giá lớn.
- Thêm xác thực đơn giản cho `/api/feedback/summary` trước khi deploy công khai.
- Đăng ký domain riêng + submit lên App Store/Google Play (xem file `app-store-listing.md` đã soạn sẵn tên app, mô tả, từ khóa).
