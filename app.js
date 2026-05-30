const STORAGE_KEY = "pageforge-courses-v2";

const demoCourses = {
  "finance-basics-2025": {
    id: "finance-basics-2025",
    title: "市场基础知识",
    strategy: { coreFirst: true, auxSortMode: "weight", missFeedback: true, retrievalScope: "cascade", chapterMode: "course", selectedChapter: "finance-infra", includeModule: true, tocDepth: "1" },
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
    strategy: { coreFirst: true, auxSortMode: "weight", missFeedback: true, retrievalScope: "cascade", chapterMode: "course", selectedChapter: "monotonicity", includeModule: true, tocDepth: "1" },
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
  chapterMode: $("#chapterMode"),
  chapterSelect: $("#chapterSelect"),
  includeModule: $("#includeModule"),
  tocDepth: $("#tocDepth"),
  qaChapterSelect: $("#qaChapterSelect"),
  runIndex: $("#runIndex"),
  simulateMiss: $("#simulateMiss"),
  bookMetric: $("#bookMetric"),
  readyMetric: $("#readyMetric"),
  coreMetric: $("#coreMetric"),
  scopeMetric: $("#scopeMetric"),
  corpusMetric: $("#corpusMetric"),
  retrievalModeMetric: $("#retrievalModeMetric"),
  gateMetric: $("#gateMetric"),
  readyCount: $("#readyCount"),
  bookList: $("#bookList"),
  indexTimeline: $("#indexTimeline"),
  questionInput: $("#questionInput"),
  askButton: $("#askButton"),
  searchTrace: $("#searchTrace"),
  answerBox: $("#answerBox"),
  pageLabel: $("#pageLabel"),
  highlightBox: $("#highlightBox"),
  chapterTags: $("#chapterTags"),
  contextStrip: $("#contextStrip"),
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
      strategy: defaultStrategy(),
      books: [],
    };
  }
  return courses[currentCourseId];
}

function defaultStrategy() {
  return {
    coreFirst: true,
    auxSortMode: "weight",
    missFeedback: true,
    retrievalScope: "cascade",
    chapterMode: "course",
    selectedChapter: "finance-infra",
    includeModule: true,
    tocDepth: "1",
  };
}

const tocOptions = [
  { value: "finance-infra", level: 1, label: "第 3 章 金融市场基础设施", module: "finance" },
  { value: "settlement", level: 2, label: "3.2 证券登记结算机构", module: "settlement" },
  { value: "bond-market", level: 2, label: "3.4 债券市场", module: "bond" },
  { value: "bond-quote", level: 3, label: "考点：债券报价方式", module: "bond" },
  { value: "monotonicity", level: 2, label: "2.3 函数单调性", module: "math" },
];

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
  if (!qDomains.length) return { pass: true, soft: false, reason: "未识别强领域，允许检索" };
  const bDomains = detectDomains(`${book.name} ${book.id} ${course().title} ${currentCourseId}`);
  if (!bDomains.length) return { pass: true, soft: true, reason: "教材领域未知，进入宽松检索" };
  const pass = bDomains.some((item) => item.domain === qDomains[0].domain);
  return {
    pass: true,
    soft: !pass,
    reason: pass ? `领域匹配：${qDomains[0].domain}` : `领域弱匹配：问题像 ${qDomains[0].domain}，教材像 ${bDomains[0].domain}，进入宽松全文检索候选`,
  };
}

function fuzzyRetrieve(question) {
  const readyBooks = course().books.filter((book) => book.status === "ready");
  const candidates = course().strategy.retrievalScope === "core-only" ? readyBooks.filter((book) => book.role === "core") : readyBooks;
  if (!candidates.length) return { hit: false, results: [], reason: "当前课程没有 ready 教材" };

  const qTokens = tokenize(`${question} ${course().title} ${currentCourseId}`);
  const qType = detectQuestionType(question);
  const scopeText = scopeDescription();
  const selectedToc = tocOptions.find((item) => item.value === course().strategy.selectedChapter);
  const results = candidates
    .map((book) => {
      const gate = domainGate(question, book);
      const bTokens = tokenize(`${book.name} ${book.id} ${roleText(book.role)} ${course().title} ${scopeText}`);
      const overlap = qTokens.filter((token) => bTokens.some((bt) => bt.includes(token) || token.includes(bt)));
      const roleBoost = book.role === "core" ? 0.2 : 0;
      const typeBoost = qType === "numeric" && /证券|金融|资金|亿元|登记|结算/.test(`${book.name}${course().title}`) ? 0.25 : 0;
      const intentBoost = qType !== "general" ? 0.08 : 0;
      const chapterBoost = course().strategy.chapterMode !== "course" ? 0.18 : 0;
      const moduleBoost = course().strategy.chapterMode === "module" && course().strategy.includeModule && book.role !== "core" ? 0.08 : 0;
      const tocBoost = selectedToc && qTokens.some((token) => tokenize(selectedToc.label).includes(token)) ? 0.12 : 0;
      const overlapScore = qTokens.length ? overlap.length / qTokens.length : 0;
      const rawScore = 0.05 + roleBoost + book.weight * 0.25 + typeBoost + intentBoost + chapterBoost + moduleBoost + tocBoost + overlapScore;
      const score = gate.soft ? Math.min(0.42, 0.22 + rawScore * 0.25) : Math.min(1, rawScore);
      return { book, gate, overlap, questionType: qType, score, scopeText };
    })
    .sort((a, b) => b.score - a.score);

  const best = results[0];
  const threshold = 0.28;
  return {
    hit: Boolean(best && best.score >= threshold),
    softHit: Boolean(best && best.gate.soft && best.score >= threshold),
    mismatch: false,
    confidence: best ? best.score : 0,
    reason: best ? best.gate.reason : "无候选",
    scopeText,
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
  course().strategy = { ...defaultStrategy(), ...(course().strategy || {}) };
  const s = course().strategy;
  els.coreFirst.checked = s.coreFirst;
  els.auxSortMode.value = s.auxSortMode;
  els.missFeedback.checked = s.missFeedback;
  els.retrievalScope.value = s.retrievalScope;
  els.chapterMode.value = s.chapterMode;
  els.chapterSelect.value = s.selectedChapter;
  els.includeModule.checked = s.includeModule;
  els.tocDepth.value = s.tocDepth;
  renderTocSelectors();
}

function chapterLabel(value = course().strategy.selectedChapter) {
  const item = tocOptions.find((entry) => entry.value === value);
  return item ? item.label : "未限定章节";
}

function renderTocSelectors() {
  const depth = Number(course().strategy.tocDepth || 1);
  const visible = tocOptions.filter((item) => item.level <= depth);
  const options = visible.map((item) => `<option value="${item.value}">${item.label}</option>`).join("");
  els.chapterSelect.innerHTML = options;
  els.qaChapterSelect.innerHTML = `<option value="course">全课程</option>${options}`;
  if (!visible.some((item) => item.value === course().strategy.selectedChapter)) {
    course().strategy.selectedChapter = visible[0] ? visible[0].value : "finance-infra";
  }
  els.chapterSelect.value = course().strategy.selectedChapter;
  els.qaChapterSelect.value = course().strategy.chapterMode === "course" ? "course" : course().strategy.selectedChapter;
}

function scopeDescription() {
  const s = course().strategy;
  if (s.chapterMode === "chapter") return `指定章节：${chapterLabel()}`;
  if (s.chapterMode === "module") return `同模块聚合：${chapterLabel()}${s.includeModule ? " + 辅助教材同模块" : ""}`;
  return "全课程检索";
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
  const totalPages = books.reduce((sum, book) => sum + Number(book.pages || 0), 0);
  els.bookMetric.textContent = books.length;
  els.readyMetric.textContent = ready;
  els.coreMetric.textContent = core ? core.name.slice(0, 10) : "未设置";
  els.scopeMetric.textContent = { cascade: "级联", all: "全部", "core-only": "核心" }[course().strategy.retrievalScope];
  els.corpusMetric.textContent = `${totalPages} 页教材待索引`;
  els.retrievalModeMetric.textContent = {
    cascade: "核心优先 + 辅助补充",
    all: "全库 ready 资料召回",
    "core-only": "仅核心教材召回",
  }[course().strategy.retrievalScope];
  els.gateMetric.textContent = course().strategy.missFeedback ? "未命中时拒答" : "仅保留检索轨迹";
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
    ["章节范围", retrieval.scopeText || scopeDescription(), course().strategy.chapterMode === "course" ? "queued" : "ready"],
    ["知识域门控", retrieval.reason || "完成领域判断", retrieval.softHit ? "queued" : retrieval.hit ? "ready" : "miss"],
    ["模糊召回", retrieval.hit ? `${retrieval.softHit ? "宽松候选" : "命中候选"}，置信度 ${(retrieval.confidence * 100).toFixed(0)}%` : "未找到可支持该问题的候选证据", retrieval.hit ? "ready" : "miss"],
  ];
  els.searchTrace.innerHTML = rows.map(([title, body, status]) => `<div class="trace-row"><div><strong>${title}</strong><span>${body}</span></div><span class="status ${statusClass(status)}">${status}</span></div>`).join("");
}

function renderAnswer(retrieval = fuzzyRetrieve(els.questionInput.value)) {
  if (!retrieval.hit) {
    els.answerBox.innerHTML = `<h3>未定位到足够依据</h3><p>${retrieval.reason || "当前课程教材与问题知识域不匹配，或没有 ready 教材。"} 系统不会强行生成答案。请切换课程、添加匹配教材，或放宽检索范围。</p>`;
    els.citationList.innerHTML = "";
    updateCitationContext("未命中|等待证据", "上一段：暂无候选。", "当前段：没有通过校验的教材片段。", "下一段：请运行索引或调整检索策略。");
    return;
  }
  const top = retrieval.results[0];
  els.answerBox.innerHTML = `<h3>${retrieval.softHit ? "宽松候选" : "答案"}</h3><p>已在 <strong>${top.book.name}</strong> 中找到${retrieval.softHit ? "需要全文校验的宽松候选" : "模糊候选"}。当前置信度 ${(top.score * 100).toFixed(0)}%。</p><p><strong>检索范围：</strong>${retrieval.scopeText || scopeDescription()}</p><p>${retrieval.softHit ? "由于问题表达和教材主题词不完全一致，系统不会在前端原型中断言最终答案；后端应继续执行 BM25 / 向量 / 数值单位检索，并校验 chunk 原文。" : "后端接入真实 chunk 后，将继续校验实体、属性、关系和数值，再输出精确章节锚点与辅助页码。"}</p><p>候选依据：${top.overlap.slice(0, 5).join(" / ") || "课程 ready 教材宽松候选"} <span class="cite">[${top.book.name} · ${retrieval.scopeText || "全课程"}]</span></p>`;
  els.citationList.innerHTML = retrieval.results
    .map((item, index) => {
      const tags = sectionTags(item.book, item.questionType).join("|");
      const context = paragraphContext(item.book, item.questionType);
      return `<button class="citation-item" data-page="${45 + index}" data-text="候选：${item.overlap.slice(0, 4).join(" / ") || item.book.name}" data-tags="${tags}" data-before="${context.before}" data-current="${context.current}" data-after="${context.after}"><div><strong>${item.book.name}</strong><span>${tags.replaceAll("|", " / ")} · ${item.book.id}-candidate-${index + 1}</span></div><span>章节</span></button>`;
    })
    .join("");
  els.citationList.querySelectorAll(".citation-item").forEach((button) => {
    button.addEventListener("click", () => {
      els.pageLabel.textContent = `p.${button.dataset.page}`;
      els.highlightBox.textContent = button.dataset.text;
      updateCitationContext(button.dataset.tags, button.dataset.before, button.dataset.current, button.dataset.after);
    });
  });
  const first = els.citationList.querySelector(".citation-item");
  if (first) updateCitationContext(first.dataset.tags, first.dataset.before, first.dataset.current, first.dataset.after);
}

function sectionTags(book, questionType) {
  const title = course().title || currentCourseId;
  if (/金融|证券|市场/.test(`${book.name}${title}`)) {
    if (course().strategy.chapterMode !== "course") {
      return [chapterLabel(), course().strategy.chapterMode === "module" ? "同模块聚合" : "指定章节", questionType === "numeric" ? "考点：设立条件/金额要求" : "考点：机构与业务规则"];
    }
    return ["第 3 章 金融市场基础设施", "3.2 证券登记结算机构", questionType === "numeric" ? "考点：设立条件/金额要求" : "考点：机构与业务规则"];
  }
  if (/数学|函数|分析/.test(`${book.name}${title}`)) {
    if (course().strategy.chapterMode !== "course") {
      return [chapterLabel(), course().strategy.chapterMode === "module" ? "同模块聚合" : "指定章节", questionType === "procedure" ? "考点：证明方法" : "考点：定义与性质"];
    }
    return ["第 2 章 函数", "2.3 函数单调性", questionType === "procedure" ? "考点：证明方法" : "考点：定义与性质"];
  }
  return [title, roleText(book.role), "考点：候选知识点"];
}

function paragraphContext(book, questionType) {
  if (/金融|证券|市场/.test(`${book.name}${course().title}`)) {
    return {
      before: "上一段：教材介绍相关市场主体、业务职责或设立背景。",
      current: questionType === "numeric" ? "当前段：定位设立条件、自有资金、人民币金额等数值要求。" : "当前段：定位概念定义、职责范围或监管要求。",
      after: "下一段：通常衔接业务规则、监管要求或其他条件。",
    };
  }
  if (/数学|函数|分析/.test(`${book.name}${course().title}`)) {
    return {
      before: "上一段：引入函数在区间上的比较关系。",
      current: "当前段：给出定义、公式或证明关键步骤。",
      after: "下一段：衔接例题、推导或应用条件。",
    };
  }
  return {
    before: "上一段：候选知识点的前置背景。",
    current: "当前段：可能支持用户问题的核心片段。",
    after: "下一段：后续解释、条件或例题。",
  };
}

function updateCitationContext(tags, before, current, after) {
  els.chapterTags.innerHTML = (tags || "")
    .split("|")
    .filter(Boolean)
    .map((tag) => `<span class="chapter-tag">${tag}</span>`)
    .join("");
  els.contextStrip.innerHTML = `
    <div class="context-line">${before || "上一段：待后端返回上下文。"}</div>
    <div class="context-line current">${current || "当前段：待后端返回命中段落。"}</div>
    <div class="context-line">${after || "下一段：待后端返回上下文。"}</div>
  `;
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
  courses[currentCourseId] = { id: currentCourseId, title: currentCourseId, strategy: defaultStrategy(), books: [] };
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
[els.coreFirst, els.auxSortMode, els.missFeedback, els.retrievalScope, els.chapterMode, els.chapterSelect, els.includeModule, els.tocDepth].forEach((control) => {
  control.addEventListener("change", () => {
    course().strategy = {
      coreFirst: els.coreFirst.checked,
      auxSortMode: els.auxSortMode.value,
      missFeedback: els.missFeedback.checked,
      retrievalScope: els.retrievalScope.value,
      chapterMode: els.chapterMode.value,
      selectedChapter: els.chapterSelect.value,
      includeModule: els.includeModule.checked,
      tocDepth: els.tocDepth.value,
    };
    saveCourses();
    render();
  });
});
els.qaChapterSelect.addEventListener("change", () => {
  if (els.qaChapterSelect.value === "course") {
    course().strategy.chapterMode = "course";
  } else {
    course().strategy.chapterMode = "chapter";
    course().strategy.selectedChapter = els.qaChapterSelect.value;
  }
  saveCourses();
  render();
});

render();
