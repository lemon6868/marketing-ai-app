require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
// Khi deploy sau 1 lớp reverse proxy (Render, Railway, Heroku...), bật dòng
// này để req.ip lấy đúng IP khách thay vì IP của proxy — cần cho rate limit
// hoạt động chính xác theo từng người dùng thật.
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';
const ANTHROPIC_VERSION = '2023-06-01';

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Giới hạn số lần gọi AI theo từng IP để tránh phát sinh chi phí ngoài ý
// muốn (vd 1 người bấm liên tục, hoặc bot dò quét). Lưu trong bộ nhớ — đủ
// dùng cho v1 chạy 1 tiến trình; nếu scale nhiều instance sau này, chuyển
// sang Redis hoặc dịch vụ rate-limit riêng.
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 phút
const RATE_LIMIT_MAX = 20; // tối đa 20 lượt gọi AI / 10 phút / IP
const rateLimitHits = new Map(); // ip -> [timestamps]

function isRateLimited(ip) {
  const now = Date.now();
  const hits = (rateLimitHits.get(ip) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  hits.push(now);
  rateLimitHits.set(ip, hits);
  return hits.length > RATE_LIMIT_MAX;
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, hasApiKey: Boolean(ANTHROPIC_API_KEY) });
});

// Lưu đánh giá sao của khách vào file JSON đơn giản trên server (v1 chưa có
// database). Xem README để biết cách nâng cấp lên DB thật khi cần.
const FEEDBACK_FILE = path.join(__dirname, 'data', 'feedback.json');

function appendFeedback(entry) {
  const dir = path.dirname(FEEDBACK_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  let list = [];
  if (fs.existsSync(FEEDBACK_FILE)) {
    try { list = JSON.parse(fs.readFileSync(FEEDBACK_FILE, 'utf8')); } catch (e) { list = []; }
  }
  list.push(entry);
  fs.writeFileSync(FEEDBACK_FILE, JSON.stringify(list, null, 2));
}

app.post('/api/feedback', (req, res) => {
  const { rating, comment } = req.body || {};
  const r = Number(rating);
  if (!Number.isInteger(r) || r < 1 || r > 5) {
    return res.status(400).json({ error: 'rating phải là số nguyên từ 1 đến 5.' });
  }
  try {
    appendFeedback({
      rating: r,
      comment: typeof comment === 'string' ? comment.slice(0, 500) : '',
      at: new Date().toISOString()
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Không lưu được đánh giá: ' + err.message });
  }
});

app.get('/api/feedback/summary', (req, res) => {
  let list = [];
  if (fs.existsSync(FEEDBACK_FILE)) {
    try { list = JSON.parse(fs.readFileSync(FEEDBACK_FILE, 'utf8')); } catch (e) { list = []; }
  }
  const count = list.length;
  const avg = count ? list.reduce((sum, f) => sum + f.rating, 0) / count : 0;
  res.json({ count, average: Math.round(avg * 10) / 10, entries: list });
});

// Thin, secure proxy to the Anthropic Messages API. The frontend sends
// {system, messages, tools, max_tokens} and never sees the API key.
app.post('/api/messages', async (req, res) => {
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({
      error: 'Server chưa cấu hình ANTHROPIC_API_KEY. Xem README.md để thêm key vào file .env rồi khởi động lại server.'
    });
  }

  if (isRateLimited(req.ip)) {
    return res.status(429).json({
      error: 'Bạn đã dùng quá nhiều lần trong 10 phút qua. Vui lòng thử lại sau ít phút.'
    });
  }

  const { system, messages, tools, max_tokens, effort } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Thiếu messages trong yêu cầu.' });
  }

  try {
    // Sonnet 5 chạy "adaptive thinking" mặc định (không thể tắt an toàn — tắt
    // hẳn có thể khiến model viết lời gọi tool ra text thay vì tool_use thật).
    // Để dành đủ token cho cả thinking lẫn câu trả lời, max_tokens phải rộng
    // rãi; effort "low" giữ thinking ngắn gọn cho các tác vụ đơn giản của app này.
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': ANTHROPIC_VERSION
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: max_tokens || 2048,
        system: system || undefined,
        messages,
        tools: tools && tools.length ? tools : undefined,
        output_config: { effort: effort || 'low' }
      })
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        error: (data && data.error && data.error.message) || 'Lỗi từ Anthropic API',
        detail: data
      });
    }

    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'Không gọi được Anthropic API: ' + err.message });
  }
});

app.listen(PORT, () => {
  console.log('Marketing AI server chạy tại http://localhost:' + PORT);
  if (!ANTHROPIC_API_KEY) {
    console.warn('CẢNH BÁO: chưa có ANTHROPIC_API_KEY trong .env — các tính năng AI sẽ báo lỗi cho tới khi bạn thêm key.');
  }
});
