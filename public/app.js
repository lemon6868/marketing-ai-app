(function () {
  "use strict";

  // ---------- Gọi API backend (proxy an toàn tới Anthropic) ----------

  async function callClaude(payload) {
    var res = await fetch("/api/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    var data = null;
    try { data = await res.json(); } catch (e) { data = null; }
    if (!res.ok) {
      var msg = (data && data.error) || ("Lỗi server (" + res.status + ")");
      throw new Error(msg);
    }
    return data;
  }

  function extractText(content) {
    return (content || [])
      .filter(function (b) { return b.type === "text"; })
      .map(function (b) { return b.text; })
      .join("\n")
      .trim();
  }

  async function generateOnce(prompt, maxTokens) {
    var data = await callClaude({
      messages: [{ role: "user", content: prompt }],
      max_tokens: maxTokens || 2048
    });
    var text = extractText(data.content);
    if (!text) throw new Error("AI không trả về nội dung, thử lại nhé.");
    return text;
  }

  async function runWithTools(opts) {
    var maxRounds = opts.maxRounds || 4;
    var messages = [{ role: "user", content: opts.leadingInstruction }].concat(opts.turns);
    var finalText = "";
    for (var round = 0; round < maxRounds; round++) {
      var data = await callClaude({ messages: messages, tools: opts.tools, max_tokens: 2048 });
      var content = data.content || [];
      var text = extractText(content);
      if (text) finalText = text;
      var toolUses = content.filter(function (b) { return b.type === "tool_use"; });
      if (data.stop_reason !== "tool_use" || toolUses.length === 0) {
        return finalText;
      }
      messages.push({ role: "assistant", content: content });
      var resultsContent = toolUses.map(function (tu) {
        var executor = opts.toolExecutors[tu.name];
        var resultStr;
        try {
          resultStr = executor ? String(executor(tu.input) || "") : ("Không tìm thấy công cụ " + tu.name);
        } catch (e) {
          resultStr = "Lỗi khi thực thi: " + e.message;
        }
        return { type: "tool_result", tool_use_id: tu.id, content: resultStr };
      });
      messages.push({ role: "user", content: resultsContent });
    }
    return finalText || "AI chưa trả lời xong, thử lại giúp mình nhé.";
  }

  // ---------- Kiểm tra API key đã cấu hình chưa ----------

  var apiReady = false;
  (async function () {
    try {
      var res = await fetch("/api/health");
      var data = await res.json();
      apiReady = Boolean(data && data.hasApiKey);
    } catch (e) {
      apiReady = false;
    }
    var banner = document.getElementById("setupBanner");
    if (banner) banner.hidden = apiReady;
  })();

  // ---------- Câu hook & ảnh nền đổi mỗi ngày ----------

  var DAILY_HOOKS = [
    "Đừng đăng bài cho có — đăng bài để bán được. Chọn phong cách, gửi 1 order: AI giao việc cho cả dàn trợ lý chuyên môn, trả về nguyên bộ nội dung tuần đúng chất giọng bạn muốn.",
    "5 phút gửi order, cả tuần khỏi lo content. AI điều phối dàn trợ lý chuyên môn, bạn chỉ việc chọn phong cách và duyệt kết quả.",
    "Ý tưởng có AI, chất riêng có bạn. Một order là đủ để có ý tưởng, ảnh, video, caption cho cả tuần.",
    "Không cần đội marketing, chỉ cần 1 order. AI giao việc cho từng trợ lý chuyên môn, bạn nhận về nguyên bộ nội dung tuần.",
    "Content đúng, khách mới quay lại. Chọn phong cách bạn muốn, AI lo phần còn lại — từ ý tưởng tới bio kênh.",
    "Sinh ra cho quán nhỏ, tiệm nhỏ, ước mơ lớn. Gửi 1 order, nhận về cả bộ nội dung tuần đúng chất giọng của bạn.",
    "Một order — cả dàn AI vào việc. Ý tưởng, ảnh, video, caption: xong trước khi bạn kịp pha xong ấm trà."
  ];
  var DAILY_HEROES = [
    { src: "/img/hero.png", alt: "Minh hoạ chủ quán cà phê đội nón lá dùng điện thoại, xung quanh có tia sáng AI và mũi tên tăng trưởng doanh thu" },
    { src: "/img/hero2.png", alt: "Minh hoạ chủ shop thời trang sắp xếp quần áo và xem điện thoại, xung quanh có tia sáng AI và mũi tên tăng trưởng doanh thu" },
    { src: "/img/hero3.png", alt: "Minh hoạ chủ quán ăn cầm khay đồ ăn và điện thoại, xung quanh có tia sáng AI và mũi tên tăng trưởng doanh thu" },
    { src: "/img/hero4.png", alt: "Minh hoạ chủ shop online đóng gói hàng và xem điện thoại, xung quanh có tia sáng AI và mũi tên tăng trưởng doanh thu" }
  ];
  (function () {
    var now = new Date();
    var startOfYear = new Date(now.getFullYear(), 0, 0);
    var dayOfYear = Math.floor((now - startOfYear) / 86400000);

    var taglineEl = document.getElementById("taglineText");
    if (taglineEl) taglineEl.textContent = DAILY_HOOKS[dayOfYear % DAILY_HOOKS.length];

    var heroEl = document.getElementById("heroImg");
    if (heroEl) {
      var pick = DAILY_HEROES[dayOfYear % DAILY_HEROES.length];
      heroEl.src = pick.src;
      heroEl.alt = pick.alt;
    }
  })();

  // ---------- Hướng dẫn nhanh: ẩn/hiện + demo tự chạy ----------

  var guideSteps = document.getElementById("guideSteps");
  var guideToggle = document.getElementById("guideToggle");
  var GUIDE_KEY = "marketingai_guide_collapsed";
  try {
    if (localStorage.getItem(GUIDE_KEY) === "1") guideSteps.hidden = true;
  } catch (e) {}
  function syncGuideToggleLabel() {
    guideToggle.textContent = guideSteps.hidden ? "Xem lại hướng dẫn" : "Ẩn hướng dẫn";
  }
  syncGuideToggleLabel();
  guideToggle.addEventListener("click", function () {
    guideSteps.hidden = !guideSteps.hidden;
    try { localStorage.setItem(GUIDE_KEY, guideSteps.hidden ? "1" : "0"); } catch (e) {}
    syncGuideToggleLabel();
  });

  var guideDemoBtn = document.getElementById("guideDemo");
  var guideStepEls = Array.prototype.slice.call(guideSteps.children);
  var guideDemoRunning = false;
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  guideDemoBtn.addEventListener("click", async function () {
    if (guideDemoRunning) return;
    guideDemoRunning = true;
    guideDemoBtn.disabled = true;
    if (guideSteps.hidden) {
      guideSteps.hidden = false;
      try { localStorage.setItem(GUIDE_KEY, "0"); } catch (e) {}
      syncGuideToggleLabel();
    }
    guideSteps.scrollIntoView({ behavior: "smooth", block: "nearest" });
    for (var i = 0; i < guideStepEls.length; i++) {
      guideStepEls.forEach(function (el) { el.classList.remove("active"); });
      guideStepEls[i].classList.add("active");
      await sleep(1200);
    }
    guideStepEls.forEach(function (el) { el.classList.remove("active"); });
    guideDemoRunning = false;
    guideDemoBtn.disabled = false;
  });

  // ---------- Phong cách nội dung ----------

  var STYLES = [
    { key: "humor", label: "Hài hước", tone: "vui nhộn, dí dỏm, gần gũi", tag: true,
      hint: "Phụ đề hài hước + gắn tag cảm xúc cho giọng đọc AI (ví dụ giọng Adam): [giggles], [playful], [chuckles]...",
      icon: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 14c1.2 1.5 2.6 2 4 2s2.8-.5 4-2" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/><circle cx="9" cy="10" r="1" fill="currentColor"/><circle cx="15" cy="10" r="1" fill="currentColor"/></svg>' },
    { key: "absurd", label: "Hài nhảm", tone: "phi lý, lầy lội, bất ngờ quá đà", tag: true,
      hint: "Plot phi logic, plot-twist bất ngờ, tag cảm xúc cường điệu: [gasp], [deadpan], [laughs hysterically]",
      icon: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="9" cy="10" r="1.6" fill="currentColor"/><circle cx="15" cy="9.5" r=".8" fill="currentColor"/><path d="M8 15l2-1.5 2 1.5 2-1.5 2 1.5" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>' },
    { key: "serious", label: "Nghiêm túc", tone: "điềm tĩnh, đáng tin, có chiều sâu", tag: false,
      hint: "Giọng điềm tĩnh, dẫn chứng cụ thể, hạn chế tag cảm xúc (tối đa 1 tag: [confident] hoặc [calm])",
      icon: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 15h8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="9" cy="10" r="1" fill="currentColor"/><circle cx="15" cy="10" r="1" fill="currentColor"/></svg>' },
    { key: "professional", label: "Chuyên nghiệp", tone: "chuẩn mực, lịch sự, tập trung lợi ích", tag: false,
      hint: "Ngôn ngữ chuẩn mực, không gắn tag cảm xúc, tập trung thông tin và lợi ích sản phẩm",
      icon: '<svg viewBox="0 0 24 24"><rect x="4" y="8" width="16" height="11" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M4 13h16" stroke="currentColor" stroke-width="1.6"/></svg>' },
    { key: "unconventional", label: "Phá cách", tone: "phá vỡ kỳ vọng, tương phản mạnh", tag: true,
      hint: "Cắt cảnh bất ngờ, chuyển cảm xúc đột ngột trong cùng 1 câu: [frustrated] → [laughs softly]",
      icon: '<svg viewBox="0 0 24 24"><path d="M13 3 5 14h6l-2 7 9-12h-6l1-6z" fill="currentColor"/></svg>' },
    { key: "trend", label: "Xu hướng", tone: "bắt trend, hook nhanh, ngôn ngữ Gen Z", tag: true,
      hint: "Hook 3 giây đầu theo định dạng đang viral, tag tạo tò mò: [whispering], [excited]",
      icon: '<svg viewBox="0 0 24 24"><path d="M4 17 10 11 14 15 20 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 7h5v5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>' }
  ];

  var selectedStyleKey = STYLES[0].key;
  var stylePillsEl = document.getElementById("stylePills");
  var styleHintEl = document.getElementById("styleHint");

  function getStyle() {
    var found = null;
    STYLES.forEach(function (s) { if (s.key === selectedStyleKey) found = s; });
    return found || STYLES[0];
  }

  function selectStyle(key) {
    var target = null;
    STYLES.forEach(function (s) { if (s.key === key) target = s; });
    if (!target) return false;
    selectedStyleKey = target.key;
    Array.prototype.forEach.call(stylePillsEl.children, function (b, i) {
      b.setAttribute("aria-pressed", STYLES[i].key === target.key ? "true" : "false");
    });
    styleHintEl.textContent = "Gợi ý áp dụng: " + target.hint;
    return true;
  }

  STYLES.forEach(function (st, idx) {
    var pill = document.createElement("button");
    pill.type = "button";
    pill.className = "style-pill";
    pill.innerHTML = st.icon + "<span>" + st.label + "</span>";
    pill.setAttribute("aria-pressed", idx === 0 ? "true" : "false");
    pill.addEventListener("click", function () { selectStyle(st.key); });
    stylePillsEl.appendChild(pill);
  });
  styleHintEl.textContent = "Gợi ý áp dụng: " + STYLES[0].hint;

  // ---------- Form order: điền tự động từ chat ----------

  var BIZ_TYPES = ["Quán cà phê / ăn uống", "Shop thời trang / phụ kiện", "Dịch vụ làm đẹp / spa", "Bán hàng online / đa ngành", "Đồ điện tử / công nghệ"];
  var WEEK_GOALS = ["Ra bộ content tuần đều đặn", "Giới thiệu sản phẩm / món mới", "Chạy chương trình khuyến mãi", "Tăng tương tác, kéo khách quay lại"];

  function matchEnum(value, list) {
    if (!value) return null;
    var v = String(value).trim().toLowerCase();
    for (var i = 0; i < list.length; i++) { if (list[i].toLowerCase() === v) return list[i]; }
    for (var j = 0; j < list.length; j++) {
      if (list[j].toLowerCase().indexOf(v) !== -1 || v.indexOf(list[j].toLowerCase()) !== -1) return list[j];
    }
    return null;
  }

  function applyOrder(input) {
    input = input || {};
    var applied = [];
    if (input.bizName) {
      document.getElementById("bizName").value = String(input.bizName).slice(0, 60);
      applied.push("tên cửa hàng: " + document.getElementById("bizName").value);
    }
    var bt = matchEnum(input.bizType, BIZ_TYPES);
    if (bt) {
      document.getElementById("bizType").value = bt;
      applied.push("loại hình: " + bt);
    }
    var wg = matchEnum(input.weekGoal, WEEK_GOALS);
    if (wg) {
      document.getElementById("weekGoal").value = wg;
      applied.push("mục tiêu tuần: " + wg);
    }
    if (input.note) {
      document.getElementById("note").value = String(input.note).slice(0, 140);
      applied.push("ghi chú: " + document.getElementById("note").value);
    }
    if (input.styleKey && selectStyle(String(input.styleKey))) {
      applied.push("phong cách: " + getStyle().label);
    }
    if (applied.length === 0) return "Không có trường nào đủ rõ để điền — hãy hỏi khách thêm chi tiết.";
    return "Đã điền vào form: " + applied.join("; ") + ".";
  }

  var applyOrderTool = {
    name: "apply_order",
    description: "Điền các trường của form order (tên cửa hàng, loại hình kinh doanh, mục tiêu tuần, ghi chú, phong cách nội dung) dựa trên yêu cầu của khách. Trả về tóm tắt đã điền được gì.",
    input_schema: {
      type: "object",
      properties: {
        bizName: { type: "string", description: "Tên cửa hàng / thương hiệu" },
        bizType: { type: "string", enum: BIZ_TYPES, description: "Loại hình kinh doanh, chọn đúng 1 trong danh sách" },
        weekGoal: { type: "string", enum: WEEK_GOALS, description: "Mục tiêu tuần này, chọn đúng 1 trong danh sách" },
        note: { type: "string", description: "Ghi chú thêm, ví dụ sản phẩm/chương trình cụ thể" },
        styleKey: { type: "string", enum: ["humor", "absurd", "serious", "professional", "unconventional", "trend"], description: "Phong cách nội dung phù hợp nhất với yêu cầu khách" }
      },
      required: []
    }
  };

  // ---------- 2 khung chat (AI trợ lý điền order + Hội đồng cố vấn) ----------

  function errorCopyGeneric(err) {
    return (err && err.message) ? err.message : "Có lỗi khi trả lời, thử lại nhé.";
  }

  function createChatWidget(opts) {
    var turns = [];
    var busy = false;
    var chips = [];

    opts.suggestions.forEach(function (text) {
      var chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip";
      chip.textContent = text;
      chip.addEventListener("click", function () {
        if (chip.disabled) return;
        opts.inputEl.value = text;
        if (opts.formEl.requestSubmit) opts.formEl.requestSubmit(); else send();
      });
      opts.chipsEl.appendChild(chip);
      chips.push(chip);
    });

    function addMsg(role, text) {
      var div = document.createElement("div");
      div.className = "msg " + (role === "user" ? "user" : "bot");
      div.textContent = text;
      opts.logEl.appendChild(div);
      opts.logEl.scrollTop = opts.logEl.scrollHeight;
      return div;
    }

    async function send() {
      if (busy) return;
      var text = opts.inputEl.value.trim();
      if (!text) return;

      busy = true;
      opts.sendEl.disabled = true;
      opts.inputEl.disabled = true;
      chips.forEach(function (c) { c.disabled = true; });
      opts.inputEl.value = "";
      addMsg("user", text);
      turns.push({ role: "user", content: text });
      var thinking = addMsg("bot", "Đang xem xét...");
      thinking.classList.add("thinking");

      try {
        var replyText;
        if (opts.tools) {
          replyText = await runWithTools({
            leadingInstruction: opts.leadingInstruction,
            turns: turns,
            tools: opts.tools,
            toolExecutors: opts.toolExecutors
          });
        } else {
          var data = await callClaude({
            messages: [{ role: "user", content: opts.leadingInstruction }].concat(turns),
            max_tokens: 2048
          });
          replyText = extractText(data.content) || "AI chưa trả lời được, thử lại nhé.";
        }
        thinking.classList.remove("thinking");
        thinking.textContent = replyText;
        turns.push({ role: "assistant", content: replyText });
      } catch (err) {
        thinking.remove();
        addMsg("bot", "⚠ " + errorCopyGeneric(err));
        turns.pop();
      } finally {
        busy = false;
        opts.sendEl.disabled = false;
        opts.inputEl.disabled = false;
        chips.forEach(function (c) { c.disabled = false; });
        opts.inputEl.focus();
      }
    }

    opts.formEl.addEventListener("submit", function (ev) {
      ev.preventDefault();
      send();
    });
  }

  createChatWidget({
    logEl: document.getElementById("chatLog"),
    formEl: document.getElementById("chatForm"),
    inputEl: document.getElementById("chatInput"),
    sendEl: document.getElementById("chatSend"),
    chipsEl: document.getElementById("assistantChips"),
    suggestions: [
      "Tôi có quán trà sữa, muốn ra mắt vị mới tuần này",
      "Tuần này ế quá, cần content kéo khách quay lại",
      "Tôi muốn chạy khuyến mãi cuối tuần",
      "Chưa biết chọn phong cách nào cho phù hợp",
      "Shop tôi mới mở, cần giới thiệu bản thân"
    ],
    tools: [applyOrderTool],
    toolExecutors: { apply_order: applyOrder },
    leadingInstruction:
      "Bạn là trợ lý tiếp nhận yêu cầu cho app \"Marketing AI\" — nơi chủ quán/shop nhỏ tại Việt Nam mô tả nhu cầu bằng lời tự nhiên, và bạn giúp họ điền nhanh 1 form order.\n" +
      "Form gồm: tên cửa hàng (bizName), loại hình kinh doanh (bizType — đúng 1 trong: " + BIZ_TYPES.join(" | ") + "), mục tiêu tuần này (weekGoal — đúng 1 trong: " + WEEK_GOALS.join(" | ") + "), ghi chú thêm (note), phong cách nội dung (styleKey — đúng 1 trong: humor=Hài hước, absurd=Hài nhảm, serious=Nghiêm túc, professional=Chuyên nghiệp, unconventional=Phá cách, trend=Xu hướng).\n" +
      "Ngay khi đoán được ít nhất tên cửa hàng hoặc loại hình từ lời khách, hãy gọi tool apply_order để điền form — được phép đoán hợp lý các trường còn thiếu, không cần hỏi lại quá kỹ. Nếu khách chỉ chào hỏi hoặc chưa đủ thông tin để đoán, hỏi lại đúng 1 câu ngắn.\n" +
      "Sau khi gọi tool, trả lời khách 1-2 câu thân thiện ngắn gọn: xác nhận đã điền gì và gợi ý xem lại form/bấm Gửi order bên dưới. Không dùng markdown."
  });

  createChatWidget({
    logEl: document.getElementById("boardLog"),
    formEl: document.getElementById("boardForm"),
    inputEl: document.getElementById("boardInput"),
    sendEl: document.getElementById("boardSend"),
    chipsEl: document.getElementById("boardChips"),
    suggestions: [
      "Tôi định giảm giá 50% toàn bộ menu tuần này để hút khách",
      "Tôi muốn mở thêm chi nhánh thứ 2 ngay tháng sau",
      "Tôi định bỏ hẳn Facebook, chuyển toàn bộ sang TikTok",
      "Tôi muốn thuê KOL 20 triệu để quảng bá sản phẩm mới",
      "Tôi định tự làm hết marketing, không thuê ai cả"
    ],
    leadingInstruction:
      "Bạn đóng vai hội đồng cố vấn kinh doanh dày dạn kinh nghiệm cho hộ kinh doanh nhỏ tại Việt Nam. Khi chủ quán/shop trình bày một ý tưởng hay kế hoạch, KHÔNG khen cho có và không chỉ đồng ý.\n" +
      "Hãy:\n1) Phản biện thẳng thắn nhưng xây dựng — chỉ ra 1-2 rủi ro thực tế hoặc giả định yếu trong ý tưởng đó.\n2) Đề xuất 1 phương án cụ thể, khả thi hơn (điều chỉnh ý tưởng ban đầu hoặc phương án thay thế), kèm 1-2 bước hành động có thể làm ngay.\n3) Kết thúc đúng 1 dòng: \"Nhận định: Nên làm / Nên cân nhắc lại / Không nên làm lúc này\" kèm lý do trong 1 câu.\n" +
      "Giọng điệu thẳng thắn, thực tế, tôn trọng người nghe, không vòng vo, không tâng bốc, không dùng markdown. Tối đa 170 từ."
  });

  // ---------- 5 trạm nội dung (order form) ----------

  var STATIONS = [
    {
      key: "idea", no: "01", label: "Ý TƯỞNG & CHIẾN LƯỢC", tool: "Ý tưởng & chiến lược tuần",
      example: "Chủ đề tuần: \"Vị mới miền biển – Cà phê muối dừa\".\nVì sao: món mới cần vài lượt nhắc để khách nhớ và ghé thử, nên tuần này dồn mọi kênh vào 1 sản phẩm thay vì dàn trải.\nLịch gợi ý:\n- Thứ 3: đăng ảnh món mới kèm ưu đãi 2 ly đầu\n- Thứ 5: video pha chế 15 giây, khoe lớp muối dừa\n- Chủ nhật: story khách quay lại đánh giá, kèm mã giảm 10%",
      prompt: function (ctx, style) {
        return "Bạn là chuyên gia chiến lược nội dung cho hộ kinh doanh nhỏ tại Việt Nam.\n" + ctx +
          "\nHãy viết:\n1) Một câu chủ đề trọng tâm cho tuần này.\n2) 1-2 câu giải thích vì sao chủ đề này phù hợp.\n3) Lịch gợi ý đăng bài cho 3 ngày trong tuần (định dạng: Thứ mấy: nội dung gì).\n" +
          "Giữ giọng điệu theo phong cách " + style.label + " (" + style.tone + ") xuyên suốt.\n" +
          "Viết bằng tiếng Việt tự nhiên, thực tế, không sáo rỗng. Không dùng markdown (không *, không #), chỉ dùng dấu \"-\" khi liệt kê. Tối đa 120 từ.";
      }
    },
    {
      key: "image", no: "02", label: "CONCEPT HÌNH ẢNH", tool: "→ Gemini / Canva",
      example: "Concept 1: ly cà phê cạnh cửa sổ nắng sớm, lớp muối dừa lấp lánh, tông ấm vàng nâu.\nPrompt: coconut salt coffee glass on wooden table, morning sunlight, warm tones, close-up\n\nConcept 2: góc từ trên xuống, ly cà phê giữa bàn gỗ cùng vài lát dừa tươi, tông trắng-nâu tối giản.\nPrompt: flat lay coconut coffee with fresh coconut slices, minimal wooden table, top view\n\nConcept 3: nhân viên rắc muối dừa lên ly, cận cảnh tay, ánh sáng chiều ấm.\nPrompt: barista sprinkling coconut salt on iced coffee, close-up hands, warm afternoon light",
      prompt: function (ctx, style) {
        return "Bạn là giám đốc sáng tạo hình ảnh cho mạng xã hội.\n" + ctx +
          "\nĐề xuất 3 concept ảnh có thể tự chụp hoặc tạo bằng công cụ AI tạo ảnh (Gemini/Canva), mỗi concept gồm:\n- Mô tả cảnh bằng tiếng Việt (1-2 câu)\n- Một câu prompt tạo ảnh AI bằng tiếng Anh, ngắn gọn cụ thể\n" +
          "Bối cảnh, ánh sáng và tông màu phải toát lên phong cách " + style.label + " (" + style.tone + ").\n" +
          "Không dùng markdown. Tối đa 130 từ.";
      }
    },
    {
      key: "video", no: "03", label: "KỊCH BẢN VIDEO", tool: "→ CapCut / Seedance",
      example: "Cảnh 1 (0-4s): cận cảnh đá lắc trong bình shaker\n[playful] Chờ đã... có gì thơm thơm nè!\nCảnh 2 (4-10s): đổ cà phê ra ly, rắc muối dừa\n[giggles] Đây rồi — Cà Phê Muối Dừa!\nCảnh 3 (10-15s): khách nhấp thử, biểu cảm bất ngờ\n[gasp] Ơ... sao lại ngon vậy trời?!\nChữ overlay: \"Chỉ 29K – tuần này thôi\"\nNhạc: nền chill, nhịp vừa, âm lượng thấp\n(Voice-over trên sẵn sàng dán vào giọng AI cảm xúc, ví dụ giọng Adam)",
      prompt: function (ctx, style) {
        var base = "Bạn là biên kịch video ngắn mạng xã hội, kịch bản dùng để dựng bằng CapCut hoặc công cụ AI tạo video.\n" + ctx +
          "\nViết kịch bản video 15-20 giây quay bằng điện thoại: liệt kê từng cảnh theo mốc thời gian, mỗi cảnh gồm hành động, lời thoại/voice-over và chữ overlay đề xuất. Kết thúc bằng 1 dòng gợi ý nhạc nền.\n";
        var styleLine = "Phong cách: " + style.label + " (" + style.tone + ").\n";
        var tagRule = style.tag
          ? "Đặt tag cảm xúc trong ngoặc vuông ngay trước mỗi câu voice-over (ví dụ: [giggles] Bạn đã thử món này chưa?), sẵn sàng dán vào công cụ đọc giọng AI cảm xúc (ví dụ giọng Adam trên ElevenLabs). Chỉ dùng tag trong danh sách: [gasp], [whispering], [giggles], [sad], [confident], [playful], [frustrated], [sarcastic], [dry tone], [sighs], [laughs softly], [clears throat], [excited], [deadpan], [chuckles], [laughs hysterically].\n"
          : "Lời thoại rõ ràng, hạn chế tag cảm xúc — chỉ dùng tối đa 1 tag đơn giản như [confident] hoặc [calm] nếu thật cần thiết.\n";
        return base + styleLine + tagRule + "Không dùng markdown. Tối đa 150 từ.";
      }
    },
    {
      key: "caption", no: "04", label: "CAPTION & HASHTAG", tool: "→ Grok — bắt trend",
      example: "Bản 1 (chuyên nghiệp): Cà Phê Muối Dừa chính thức có mặt tại quán. Vị mặn nhẹ hoà cùng vị béo dừa, cân bằng hoàn hảo với đắng cà phê.\n#CaPheMuoiDua #QuanCaPhe #MonMoi #CaPheNgon #AnUongMoiNgay\n\nBản 2 (gần gũi): Ai bảo cà phê chỉ có ngọt với đắng? Quán vừa ra món muối dừa, uống vào là ghiền luôn á.\n#ThuLaGhien #CaPheMuoiDua #QuanQuenThuoc #MonMoiRaMat #CaPheSangSom\n\nBản 3 (kêu gọi mạnh): Chỉ tuần này: 2 ly Cà Phê Muối Dừa đầu tiên giảm 20%. Đến trễ là hết suất ưu đãi đó nha!\n#UuDaiTuanNay #CaPheMuoiDua #GheLaMe #SaleTuan #QuanCaPhe",
      prompt: function (ctx, style) {
        return "Bạn là copywriter mạng xã hội.\n" + ctx +
          "\nViết 3 phiên bản caption cho bài đăng tuần này, cùng theo phong cách " + style.label + " (" + style.tone + ") nhưng khác mức độ cường độ (nhẹ / vừa / mạnh), mỗi caption kèm 5 hashtag tiếng Việt liên quan ngay bên dưới.\n" +
          "Không dùng markdown. Tối đa 150 từ.";
      }
    },
    {
      key: "channel", no: "05", label: "THIẾT LẬP KÊNH", tool: "→ Facebook / TikTok / YouTube",
      example: "Bio Facebook Page (dưới 100 ký tự): Quán Cà Phê Lá Chuối – cà phê pha máy, món mới mỗi tuần, ngồi là ghiền.\nGiới thiệu Page: Không gian nhỏ, cà phê thật, luôn có món mới để bạn quay lại. Ghé quán, không ghé app đặt hộ.\nBio TikTok (dưới 80 ký tự): Cà phê ngon, chuyện vui mỗi ngày ☕ Quán Cà Phê Lá Chuối\nMô tả kênh YouTube: Kênh của Quán Cà Phê Lá Chuối – chia sẻ công thức pha chế, hậu trường quán và món mới mỗi tuần.\nChecklist thiết lập:\n- Ảnh đại diện: vuông, tối thiểu 400x400px\n- Ảnh bìa Facebook: 820x312px, có món chủ lực + giờ mở cửa\n- Ảnh bìa YouTube: 2560x1440px (vùng an toàn giữa 1546x423px)\n- Ghim 1 bài/video giới thiệu quán lên đầu trang\n- Đồng bộ logo, màu chủ đạo, giọng văn trên cả 3 kênh",
      prompt: function (ctx, style) {
        return "Bạn là chuyên gia xây dựng thương hiệu mạng xã hội, giúp chủ shop/quán nhỏ mới bắt đầu thiết lập kênh chuyên nghiệp.\n" + ctx +
          "\nHãy viết:\n1) Bio Facebook Page (dưới 100 ký tự)\n2) Đoạn giới thiệu ngắn cho phần \"Giới thiệu\" của Page (2-3 câu)\n3) Bio TikTok (dưới 80 ký tự, có thể dùng 1-2 emoji)\n4) Mô tả kênh YouTube cho phần \"Giới thiệu\" (2-3 câu)\n5) Checklist thiết lập: kích thước ảnh đại diện, ảnh bìa Facebook, ảnh bìa YouTube (nêu đúng kích thước chuẩn) và 2 việc nên làm ngay.\n" +
          "Phần bio/mô tả giữ giọng điệu theo phong cách " + style.label + " (" + style.tone + "); checklist viết rõ ràng, thực tế, không cần theo phong cách.\n" +
          "Không dùng markdown. Tối đa 180 từ.";
      }
    }
  ];

  var ticketsEl = document.getElementById("tickets");
  var hubStatusText = document.getElementById("hubStatusText");
  var submitBtn = document.getElementById("submitBtn");
  var form = document.getElementById("orderForm");
  var els = {}; // key -> {body, retry}

  STATIONS.forEach(function (st) {
    var ticket = document.createElement("div");
    ticket.className = "ticket";
    ticket.innerHTML =
      '<div class="ticket-head"><span>PHIẾU ' + st.no + " · " + st.label + '</span><span class="to">' + st.tool + '</span></div>' +
      '<div class="perforation"></div>' +
      '<div class="ticket-body placeholder" id="body-' + st.key + '">' + st.example + '</div>' +
      '<div class="ticket-foot"><button type="button" class="retry" id="retry-' + st.key + '" hidden>Tạo lại trạm này</button></div>';
    ticketsEl.appendChild(ticket);

    els[st.key] = {
      body: document.getElementById("body-" + st.key),
      retry: document.getElementById("retry-" + st.key)
    };
    els[st.key].retry.addEventListener("click", function () { runStation(st); });
  });

  function currentContext() {
    var name = document.getElementById("bizName").value.trim() || "cửa hàng của bạn";
    var type = document.getElementById("bizType").value;
    var goal = document.getElementById("weekGoal").value;
    var note = document.getElementById("note").value.trim();
    return "Doanh nghiệp: " + name + " (" + type + "). Mục tiêu tuần này: " + goal + ". Ghi chú thêm: " + (note || "không có") + ".";
  }

  var runToken = 0;

  async function runStation(st) {
    var e = els[st.key];
    var myToken = runToken;
    e.retry.hidden = true;
    e.body.textContent = "Đang soạn...";
    e.body.classList.remove("placeholder");

    try {
      var text = await generateOnce(st.prompt(currentContext(), getStyle()), 2048);
      if (myToken !== runToken) return;
      e.body.textContent = text;
      e.retry.hidden = false;
    } catch (err) {
      if (myToken !== runToken) return;
      e.body.textContent = "⚠ " + errorCopyGeneric(err);
      e.retry.hidden = false;
    }
  }

  form.addEventListener("submit", async function (ev) {
    ev.preventDefault();
    runToken++;
    submitBtn.disabled = true;
    hubStatusText.textContent = "Đã giao việc cho " + STATIONS.length + " trạm, đang xử lý song song...";

    var jobs = STATIONS.map(function (st) { return runStation(st); });
    await Promise.allSettled(jobs);

    submitBtn.disabled = false;
    hubStatusText.textContent = "Xong! Gói nội dung tuần này đã sẵn sàng ở dưới ✓";
  });

  // ---------- Đăng ký service worker cho PWA ----------
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("/service-worker.js").catch(function () {});
    });
  }

  // ---------- Xin đánh giá sao (chỉ hiện lần dùng đầu tiên) ----------
  (function () {
    var REVIEW_KEY = "marketingai_review_prompted";
    var overlay = document.getElementById("reviewOverlay");
    if (!overlay) return;
    var starsWrap = document.getElementById("reviewStars");
    var stars = Array.prototype.slice.call(starsWrap.children);
    var commentEl = document.getElementById("reviewComment");
    var actionsEl = document.getElementById("reviewActions");
    var submitBtn = document.getElementById("reviewSubmit");
    var skipBtn = document.getElementById("reviewSkip");
    var closeBtn = document.getElementById("reviewClose");
    var thanksEl = document.getElementById("reviewThanks");
    var currentRating = 0;

    function paintStars(value) {
      stars.forEach(function (s, i) {
        s.classList.toggle("active", i < value);
      });
    }

    stars.forEach(function (s) {
      s.addEventListener("click", function () {
        currentRating = Number(s.getAttribute("data-value"));
        paintStars(currentRating);
        submitBtn.disabled = false;
      });
    });

    function markPrompted() {
      try { localStorage.setItem(REVIEW_KEY, "1"); } catch (e) {}
    }

    function closeOverlay() {
      overlay.hidden = true;
      markPrompted();
    }

    skipBtn.addEventListener("click", closeOverlay);
    closeBtn.addEventListener("click", closeOverlay);

    submitBtn.addEventListener("click", async function () {
      if (!currentRating) return;
      submitBtn.disabled = true;
      skipBtn.disabled = true;
      try {
        await fetch("/api/feedback", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ rating: currentRating, comment: commentEl.value.trim() })
        });
      } catch (e) {}
      starsWrap.hidden = true;
      commentEl.hidden = true;
      actionsEl.hidden = true;
      thanksEl.hidden = false;
      markPrompted();
      setTimeout(function () { overlay.hidden = true; }, 1800);
    });

    try {
      if (!localStorage.getItem(REVIEW_KEY)) {
        setTimeout(function () { overlay.hidden = false; }, 1500);
      }
    } catch (e) {}
  })();
})();
