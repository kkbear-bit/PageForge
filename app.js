const STORAGE_KEY = "pageforge-courses-v2";

const demoCourses = {
  "finance-basics-2025": {
    id: "finance-basics-2025",
    title: "市场基础知识",
    strategy: { coreFirst: true, auxSortMode: "weight", missFeedback: true, retrievalScope: "cascade" },
    books: [
      {
        id: "finance-core",
        name: "金融市场基础知识 2025 (中国证券业协会) (OCR).pdf",
        role: "core",
        weight: 1,
        status: "ready",
        pages: 32556,
        indexId: "idx-1",
      },
    ],
  },
  "math-analysis-01": {
    id: "math-analysis-01",
    title: "数学分析",
    strategy: { coreFirst: true, auxSortMode: "weight", missFeedback: true, retrievalScope: "cascade" },
    books: [
      { id: "math-core", name: "数学分析主教材.pdf", role: "core", weight: 1, status: "ready", pages: 512, indexId: "idx-math" },
    ],
  },
};

let courses = loadCourses();
let currentCourseId = Object.keys(courses)[0] || "finance-basics-2025";
let selectedFiles = [];
let forceMiss = false;

const $ = (id) => document.querySelector(id);
const els = {
  courseSelect: $("#courseSelect"),
  courseId: $("#courseId"),
  courseSummary: $("#courseSummary"),
  resetDemo: $("#resetDemo"),
  newCourse: $("#newCourse"),
  saveCourse: $("#saveCourse"),
  bookUpload: $("#bookUpload"),
  uploadRole: $("#uploadRole"),
  uploadWeight: $("#uploadWeight"),
  addUploadedBooks: $("#addUploadedBooks"),
  uploadPreview: $("#uploadPreview"),
  coreFirst: $("#coreFirst"),
  auxSortMode: $("#auxSortMode"),
  missFeedback: $("#missFeedback"),
  retrievalScope: $("#retrievalScope"),
  runIndex: $("#runIndex"),
  simulateMiss: $("#simulateMiss"),
  bookMetric: $("#bookMetric"),
  readyMetric: $("#readyMetric"),
  coreMetric: $("#coreMetric"),
  scopeMetric: $("#scopeMetric"),
  readyCount: $("#readyCount"),
  bookList: $("#bookList"),
  indexTimeline: $("#indexTimeline"),
  questionInput: $("#questionInput"),
  askButton: $("#askButton"),
  searchTrace: $("#searchTrace"),
  answerBox: $("#answerBox"),
  pageLabel: $("#pageLabel"),
  highlightBox: $("#highlightBox"),
  citationList: $("#citationList"),
};

function loadCourses() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || structuredClone(demoCourses);
  } catch {
    return structuredClone(demoCourses);
  }
}

function saveCourses() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(courses));
}

function course() {
  if (!courses[currentCourseId]) {
    courses[currentCourseId] = {
      id: currentCourseId,
      title: currentCourseId,
      strategy: { coreFirst: true, auxSortMode: "weight", missFeedback: true, retrievalScope: "cascade" },
      books: [],
    };
  }
  return courses[currentCourseId];
}

function clampWeight(value) {
  const number = Number(value);
  if (Number.isNaN(number)) return 0;
  return Math.max(0, Math.min(1, number));
}

function roleText(role) {
  return role === "core" ? "核心教材" : "辅助教材";
}

function statusClass(status) {
  return { ready: "ready", processing: "processing", queued: "queued", miss: "miss" }[status] || "queued";
}

const domainLexicon = {
  math: ["函数", "单调", "证明", "区间", "导数", "极限", "积分", "公式", "不等式", "x1", "x2", "f("],
  finance: ["证券", "金融", "登记", "结算", "机构", "自有资金", "人民币", "亿元", "市场", "基金", "交易", "发行", "上市"],
  law: ["应当", "不得", "条件", "规定", "办法", "法律", "监管", "处罚", "许可", "备案"],
};

function detectDomains(text) {
  const normalized = (text || "").toLowerCase();
  return Object.entries(domainLexicon)
    .map(([domain, words]) => ({
      domain,
      score: words.reduce((sum, word) => sum + (normalized.includes(word.toLowerCase()) ? 1 : 0), 0),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
}

function detectQuestionType(text) {
  if (/多少|几|金额|亿元|比例|百分|不少于|不低于/.test(text)) return "numeric";
  if (/是什么|定义|概念|含义|理解/.test(text)) return "definition";
  if (/如何|怎么|步骤|证明|推导/.test(text)) return "procedure";
  if (/为什么|原因|作用/.test(text)) return "reason";
  return "general";
}

function tokenize(text) {
  const raw = (text || "").toLowerCase().replace(/[^\u4e00-\u9fa5a-z0-9.]+/g, " ").split(/\s+/).filter(Boolean);
  const tokens = new Set(raw);
  raw.forEach((part) => {
    const chunks = part.match(/[\u4e00-\u9fa5]{2,}/g) || [];
    chunks.forEach((chunk) => {
      for (let i = 0; i < chunk.length - 1; i += 1) tokens.add(chunk.slice(i, i + 2));
      for (let i = 0; i < chunk.length - 2; i += 1) tokens.add(chunk.slice(i, i + 3));
    });
  });
  return [...tokens].filter((token) => token.length > 1);
}

function domainGate(question, book) {
  const qDomains = detectDomains(question);
  if (!qDomains.length) return { pass: true, reason: "未识别强领域，允许检索" };
  const bDomains = detectDomains(`${book.name} ${book.id} ${course().title} ${currentCourseId}`);
  if (!bDomains.length) return { pass: true, reason: "教材领域未知，低置信检索" };
  const pass = bDomains.some((item) => item.domain === qDomains[0].domain);
  return {
    pass,
    reason: pass ? `领域匹配：${qDomains[0].domain}` : `领域不匹配：问题像 ${qDomains[0].domain}，教材像 ${bDomains[0].domain}`,
  };
}

function fuzzyRetrieve(question) {
  const readyBooks = course().books.filter((book) => book.status === "ready");
  const candidates = course().strategy.retrievalScope === "core-only" ? readyBooks.filter((book) => book.role === "core") : readyBooks;
  if (!candidates.length) return { hit: false, results: [], reason: "当前课程没有 ready 教材" };

  const qTokens = tokenize(`${question} ${course().title} ${currentCourseId}`);
  const qType = detectQuestionType(question);
  const results = candidates
    .map((book) => {
      const gate = domainGate(question, book);
      const bTokens = tokenize(`${book.name} ${book.id} ${roleText(book.role)} ${course().title}`);
      const overlap = qTokens.filter((token) => bTokens.some((bt) => bt.includes(token) || token.includes(bt)));
      const roleBoost = book.role === "core" ? 0.2 : 0;
      const typeBoost = qType === "numeric" && /证券|金融|资金|亿元|登记|结算/.test(`${book.name}${course().title}`) ? 0.25 : 0;
      const overlapScore = qTokens.length ? overlap.length / qTokens.length : 0;
      const rawScore = 0.05 + roleBoost + book.weight * 0.25 + typeBoost + overlapScore;
      const score = gate.pass ? Math.min(1, rawScore) : Math.min(0.16, rawScore * 0.2);
      return { book, gate, overlap, questionType: qType, score };
    })
    .sort((a, b) => b.score - a.score);

  const best = results[0];
  const threshold = 0.28;
  return {
    hit: Boolean(best && best.gate.pass && best.score >= threshold),
    mismatch: Boolean(best && !best.gate.pass),
    confidence: best ? best.score : 0,
    reason: best ? best.gate.reason : "无候选",
    results: results.slice(0, 3),
  };
}

function sortedBooks() {
  return [...course().books].sort((a, b) => {
    if (course().strategy.coreFirst && a.role !== b.role) return a.role === "core" ? -1 : 1;
    if (course().strategy.auxSortMode === "name") return a.name.localeCompare(b.name, "zh-CN");
    if (course().strategy.auxSortMode === "ready" && a.status !== b.status) return a.status === "ready" ? -1 : 1;
    return b.weight - a.weight;
  });
}

function renderCourses() {
  els.courseSelect.innerHTML = Object.values(courses)
    .map((item) => `<option value="${item.id}" ${item.id === currentCourseId ? "selected" : ""}>${item.title || item.id}</option>`)
    .join("");
  els.courseId.value = currentCourseId;
}

function renderStrategy() {
  const s = course().strategy;
  els.coreFirst.checked = s.coreFirst;
  els.auxSortMode.value = s.auxSortMode;
  els.missFeedback.checked = s.missFeedback;
  els.retrievalScope.value = s.retrievalScope;
}

function renderUploadPreview() {
  els.uploadPreview.innerHTML = selectedFiles.length
    ? selectedFiles.map((file) => `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB`).join("<br>")
    : "尚未选择文件";
}

function renderBooks() {
  const books = sortedBooks();
  course().books = books;
  els.bookList.innerHTML = books
    .map((book) => `
      <div class="book-card">
        <div class="book-head">
          <div>
            <div class="book-name">${book.name}</div>
            <div class="book-meta">
              <span>${roleText(book.role)} · book_id=${book.id}</span>
              <span>课程引用 · ${book.indexId || "未入库"}</span>
            </div>
          </div>
          <span class="status ${statusClass(book.status)}">${book.status}</span>
        </div>
        <div class="book-actions">
          <label><span>角色</span><select class="role-select" data-id="${book.id}">
            <option value="core" ${book.role === "core" ? "selected" : ""}>核心教材</option>
            <option value="auxiliary" ${book.role === "auxiliary" ? "selected" : ""}>辅助教材</option>
          </select></label>
          <label><span>权重</span><input class="weight-input" data-id="${book.id}" type="number" min="0" max="1" step="0.05" value="${book.weight.toFixed(2)}" ${book.role === "core" ? "disabled" : ""}></label>
          <button class="icon-button delete-book" data-id="${book.id}">×</button>
        </div>
      </div>`)
    .join("");
  els.bookList.querySelectorAll(".role-select").forEach((select) => {
    select.addEventListener("change", () => {
      course().books = course().books.map((book) => {
        if (book.id === select.dataset.id) return { ...book, role: select.value, weight: select.value === "core" ? 1 : Math.min(book.weight, 0.75) };
        if (select.value === "core" && book.role === "core") return { ...book, role: "auxiliary", weight: Math.min(book.weight, 0.75) };
        return book;
      });
      saveCourses();
      render();
    });
  });
  els.bookList.querySelectorAll(".weight-input").forEach((input) => {
    input.addEventListener("change", () => {
      const book = course().books.find((item) => item.id === input.dataset.id);
      if (book) book.weight = clampWeight(input.value);
      saveCourses();
      render();
    });
  });
  els.bookList.querySelectorAll(".delete-book").forEach((button) => {
    button.addEventListener("click", () => {
      course().books = course().books.filter((book) => book.id !== button.dataset.id);
      saveCourses();
      render();
    });
  });
}

function renderMetrics() {
  const books = course().books;
  const ready = books.filter((book) => book.status === "ready").length;
  const core = books.find((book) => book.role === "core");
  els.bookMetric.textContent = books.length;
  els.readyMetric.textContent = ready;
  els.coreMetric.textContent = core ? core.name.slice(0, 10) : "未设置";
  els.scopeMetric.textContent = { cascade: "级联", all: "全部", "core-only": "核心" }[course().strategy.retrievalScope];
  els.readyCount.textContent = `${ready} ready`;
  els.courseSummary.innerHTML = `已储备 ${books.length} 本课本，${ready} 本 ready<br>核心教材：${core ? core.name : "未设置"}`;
}

function renderTimeline() {
  els.indexTimeline.innerHTML = sortedBooks()
    .map((book) => `<div class="timeline-row"><div><strong>${book.name}</strong><span>${book.pages} 页 · ${book.status === "ready" ? "可用于在线检索" : "等待后台索引任务"}</span></div><span class="status ${statusClass(book.status)}">${book.status}</span></div>`)
    .join("");
}

function renderTrace(retrieval = fuzzyRetrieve(els.questionInput.value)) {
  const ready = course().books.filter((book) => book.status === "ready").length;
  const rows = [
    ["过滤课程", `course_id=${currentCourseId}，ready 书籍 ${ready} 本`, "ready"],
    ["知识域门控", retrieval.reason || "完成领域判断", retrieval.hit ? "ready" : retrieval.mismatch ? "miss" : "queued"],
    ["模糊召回", retrieval.hit ? `命中候选，置信度 ${(retrieval.confidence * 100).toFixed(0)}%` : "未找到可支持该问题的候选证据", retrieval.hit ? "ready" : "miss"],
  ];
  els.searchTrace.innerHTML = rows.map(([title, body, status]) => `<div class="trace-row"><div><strong>${title}</strong><span>${body}</span></div><span class="status ${statusClass(status)}">${status}</span></div>`).join("");
}

function renderAnswer(retrieval = fuzzyRetrieve(els.questionInput.value)) {
  if (!retrieval.hit) {
    els.answerBox.innerHTML = `<h3>未定位到足够依据</h3><p>${retrieval.reason || "当前课程教材与问题知识域不匹配，或没有 ready 教材。"} 系统不会强行生成答案。请切换课程、添加匹配教材，或放宽检索范围。</p>`;
    els.citationList.innerHTML = "";
    return;
  }
  const top = retrieval.results[0];
  els.answerBox.innerHTML = `<h3>答案</h3><p>已在 <strong>${top.book.name}</strong> 中找到模糊候选。当前置信度 ${(top.score * 100).toFixed(0)}%。后端接入真实 chunk 后，将继续校验实体、属性、关系和数值，再输出精确页码。</p><p>候选依据：${top.overlap.slice(0, 5).join(" / ") || "课程主题与问题匹配"} <span class="cite">[${top.book.name} p.45]</span></p>`;
  els.citationList.innerHTML = retrieval.results
    .map((item, index) => `<button class="citation-item" data-page="${45 + index}" data-text="候选：${item.overlap.slice(0, 4).join(" / ") || item.book.name}"><div><strong>${item.book.name}</strong><span>p.${45 + index} · ${item.book.id}-candidate-${index + 1}</span></div><span>bbox</span></button>`)
    .join("");
  els.citationList.querySelectorAll(".citation-item").forEach((button) => {
    button.addEventListener("click", () => {
      els.pageLabel.textContent = `p.${button.dataset.page}`;
      els.highlightBox.textContent = button.dataset.text;
    });
  });
}

function render() {
  renderCourses();
  renderStrategy();
  renderUploadPreview();
  renderBooks();
  renderMetrics();
  renderTimeline();
  const retrieval = fuzzyRetrieve(els.questionInput.value);
  renderTrace(retrieval);
  renderAnswer(retrieval);
}

function addUploadedBooks() {
  if (!selectedFiles.length) {
    els.uploadPreview.textContent = "请先选择教材文件";
    return;
  }
  const role = els.uploadRole.value;
  if (role === "core") {
    course().books = course().books.map((book) => (book.role === "core" ? { ...book, role: "auxiliary", weight: Math.min(book.weight, 0.75) } : book));
  }
  selectedFiles.forEach((file) => {
    const idBase = file.name.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-").slice(0, 32) || `book-${Date.now()}`;
    course().books.push({
      id: idBase,
      name: file.name,
      role,
      weight: role === "core" ? 1 : clampWeight(els.uploadWeight.value),
      status: "queued",
      pages: Math.max(1, Math.round((file.size || 600000) / 18000)),
      indexId: `idx-${Date.now()}`,
    });
  });
  selectedFiles = [];
  els.bookUpload.value = "";
  saveCourses();
  render();
}

function runIndex() {
  const target = course().books.find((book) => book.status === "queued");
  if (!target) return;
  target.status = "ready";
  saveCourses();
  render();
}

els.courseSelect.addEventListener("change", () => {
  currentCourseId = els.courseSelect.value;
  render();
});
els.saveCourse.addEventListener("click", () => {
  const next = els.courseId.value.trim();
  if (next && next !== currentCourseId) {
    courses[next] = { ...course(), id: next, title: next };
    delete courses[currentCourseId];
    currentCourseId = next;
  }
  saveCourses();
  render();
});
els.newCourse.addEventListener("click", () => {
  currentCourseId = `course-${Date.now()}`;
  courses[currentCourseId] = { id: currentCourseId, title: currentCourseId, strategy: { coreFirst: true, auxSortMode: "weight", missFeedback: true, retrievalScope: "cascade" }, books: [] };
  saveCourses();
  render();
});
els.resetDemo.addEventListener("click", () => {
  courses = structuredClone(demoCourses);
  currentCourseId = Object.keys(courses)[0];
  saveCourses();
  render();
});
els.bookUpload.addEventListener("change", (event) => {
  selectedFiles = Array.from(event.target.files || []);
  renderUploadPreview();
});
els.addUploadedBooks.addEventListener("click", addUploadedBooks);
els.runIndex.addEventListener("click", runIndex);
els.askButton.addEventListener("click", () => {
  const retrieval = fuzzyRetrieve(els.questionInput.value);
  renderTrace(retrieval);
  renderAnswer(retrieval);
});
els.simulateMiss.addEventListener("click", () => {
  forceMiss = !forceMiss;
  if (forceMiss) {
    els.answerBox.innerHTML = "<h3>模拟全书未命中</h3><p>当前为强制未命中场景。</p>";
    els.citationList.innerHTML = "";
  } else {
    render();
  }
});
[els.coreFirst, els.auxSortMode, els.missFeedback, els.retrievalScope].forEach((control) => {
  control.addEventListener("change", () => {
    course().strategy = {
      coreFirst: els.coreFirst.checked,
      auxSortMode: els.auxSortMode.value,
      missFeedback: els.missFeedback.checked,
      retrievalScope: els.retrievalScope.value,
    };
    saveCourses();
    render();
  });
});

render();
