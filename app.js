const STORAGE_KEY = "pageforge-courses";
const LIBRARY_KEY = "pageforge-index-library";

const demoBooks = [
  {
    id: "core",
    name: "数学分析主教材.pdf",
    role: "core",
    weight: 1,
    status: "ready",
    pages: 512,
    indexId: "demo-idx-1",
  },
  {
    id: "aux-examples",
    name: "例题精讲.pdf",
    role: "auxiliary",
    weight: 0.72,
    status: "ready",
    pages: 238,
    indexId: "demo-idx-2",
  },
  {
    id: "aux-solutions",
    name: "习题解答.pdf",
    role: "auxiliary",
    weight: 0.55,
    status: "queued",
    pages: 306,
    indexId: "demo-idx-3",
  },
];

const demoCourses = {
  "math-analysis-01": {
    id: "math-analysis-01",
    title: "数学分析",
    books: demoBooks,
    strategy: defaultStrategy(),
  },
  "finance-basics-2025": {
    id: "finance-basics-2025",
    title: "市场基础知识",
    books: [
      {
        id: "finance-core",
        name: "金融市场基础知识 2025 (中国证券业协会) (OCR).pdf",
        role: "core",
        weight: 1,
        status: "queued",
        pages: 420,
        indexId: "idx-1",
      },
    ],
    strategy: defaultStrategy(),
  },
};

let courses = loadJson(STORAGE_KEY, structuredClone(demoCourses));
let indexLibrary = loadJson(LIBRARY_KEY, {});
let currentCourseId = Object.keys(courses)[0] || "math-analysis-01";
let selectedFiles = [];
let forceMiss = false;

const $ = (selector) => document.querySelector(selector);

const els = {
  courseSelect: $("#courseSelect"),
  courseId: $("#courseId"),
  courseSummary: $("#courseSummary"),
  newCourse: $("#newCourse"),
  saveCourse: $("#saveCourse"),
  resetDemo: $("#resetDemo"),
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
  askButton: $("#askButton"),
  searchTrace: $("#searchTrace"),
  answerBox: $("#answerBox"),
  pageLabel: $("#pageLabel"),
  highlightBox: $("#highlightBox"),
  citationList: $("#citationList"),
};

function defaultStrategy() {
  return {
    coreFirst: true,
    auxSortMode: "weight",
    missFeedback: true,
    retrievalScope: "cascade",
  };
}

function loadJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return value && typeof value === "object" ? value : fallback;
  } catch {
    return fallback;
  }
}

function currentCourse() {
  if (!courses[currentCourseId]) {
    courses[currentCourseId] = {
      id: currentCourseId,
      title: currentCourseId,
      books: [],
      strategy: defaultStrategy(),
    };
  }
  courses[currentCourseId].strategy = {
    ...defaultStrategy(),
    ...(courses[currentCourseId].strategy || {}),
  };
  courses[currentCourseId].books = courses[currentCourseId].books || [];
  return courses[currentCourseId];
}

function saveAll() {
  currentCourse().id = currentCourseId;
  currentCourse().books = sortedBooks(currentCourse().books);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(courses));
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(indexLibrary));
}

function roleLabel(role) {
  return role === "core" ? "核心教材" : "辅助教材";
}

function statusClass(status) {
  return { ready: "ready", processing: "processing", queued: "queued", miss: "miss" }[status] || "queued";
}

function clampWeight(value) {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return 0;
  return Math.min(1, Math.max(0, numeric));
}

function sortedBooks(books) {
  const strategy = currentCourse().strategy;
  return [...books].sort((a, b) => {
    if (strategy.coreFirst && a.role !== b.role) return a.role === "core" ? -1 : 1;
    if (strategy.auxSortMode === "ready" && a.status !== b.status) return a.status === "ready" ? -1 : 1;
    if (strategy.auxSortMode === "name") return a.name.localeCompare(b.name, "zh-CN");
    if (b.weight !== a.weight) return b.weight - a.weight;
    return a.name.localeCompare(b.name, "zh-CN");
  });
}

function fingerprint(file) {
  return `${file.name.toLowerCase()}::${file.size || 0}::${file.lastModified || 0}`;
}

function safeId(name) {
  return (
    name
      .replace(/\.[^.]+$/, "")
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 34) || `book-${Date.now()}`
  );
}

function uniqueBookId(base, books) {
  const used = new Set(books.map((book) => book.id));
  let id = base;
  let count = 2;
  while (used.has(id)) {
    id = `${base}-${count}`;
    count += 1;
  }
  return id;
}

function bookFromFile(file, role, weight) {
  const fp = fingerprint(file);
  if (!indexLibrary[fp]) {
    indexLibrary[fp] = {
      fingerprint: fp,
      indexId: `idx-${Object.keys(indexLibrary).length + 1}`,
      name: file.name,
      status: "queued",
      pages: Math.max(1, Math.round((file.size || 600000) / 18000)),
      refCount: 0,
    };
  }

  indexLibrary[fp].refCount = (indexLibrary[fp].refCount || 0) + 1;
  const record = indexLibrary[fp];
  const books = currentCourse().books;
  return {
    id: uniqueBookId(safeId(file.name), books),
    name: record.name,
    role,
    weight: role === "core" ? 1 : clampWeight(weight || 0.7),
    status: record.status,
    pages: record.pages,
    fingerprint: fp,
    indexId: record.indexId,
    reused: record.refCount > 1,
  };
}

function renderCourseControls() {
  els.courseSelect.innerHTML = Object.values(courses)
    .map((course) => `<option value="${course.id}" ${course.id === currentCourseId ? "selected" : ""}>${course.title || course.id}</option>`)
    .join("");
  els.courseId.value = currentCourseId;
}

function renderStrategyControls() {
  const strategy = currentCourse().strategy;
  els.coreFirst.checked = strategy.coreFirst;
  els.auxSortMode.value = strategy.auxSortMode;
  els.missFeedback.checked = strategy.missFeedback;
  els.retrievalScope.value = strategy.retrievalScope;
}

function renderUploadPreview() {
  if (!selectedFiles.length) {
    els.uploadPreview.textContent = "尚未选择文件";
    return;
  }
  els.uploadPreview.innerHTML = selectedFiles.map((file) => `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB`).join("<br>");
}

function renderBooks() {
  const course = currentCourse();
  course.books = sortedBooks(course.books);
  els.bookList.innerHTML = course.books
    .map(
      (book) => `
        <div class="book-card">
          <div class="book-head">
            <div>
              <div class="book-name">${book.name}</div>
              <div class="book-meta">
                <span>${roleLabel(book.role)} · book_id=${book.id}</span>
                <span>${book.indexId ? `课程引用 · ${book.indexId}` : "未入库"}</span>
              </div>
            </div>
            <span class="status ${statusClass(book.status)}">${book.status}</span>
          </div>
          <div class="book-actions">
            <label>
              <span>角色</span>
              <select class="role-select" data-id="${book.id}">
                <option value="core" ${book.role === "core" ? "selected" : ""}>核心教材</option>
                <option value="auxiliary" ${book.role === "auxiliary" ? "selected" : ""}>辅助教材</option>
              </select>
            </label>
            <label>
              <span>权重</span>
              <input class="weight-input" data-id="${book.id}" type="number" min="0" max="1" step="0.05" value="${book.weight.toFixed(2)}" ${book.role === "core" ? "disabled" : ""} />
            </label>
            <button class="icon-button delete-book" data-id="${book.id}" title="删除课本">×</button>
          </div>
        </div>
      `
    )
    .join("");

  els.bookList.querySelectorAll(".role-select").forEach((select) => {
    select.addEventListener("change", () => {
      const course = currentCourse();
      const target = course.books.find((book) => book.id === select.dataset.id);
      if (!target) return;
      if (select.value === "core") {
        course.books = course.books.map((book) =>
          book.id === target.id
            ? { ...book, role: "core", weight: 1 }
            : book.role === "core"
              ? { ...book, role: "auxiliary", weight: Math.min(book.weight, 0.75) }
              : book
        );
      } else {
        target.role = "auxiliary";
        target.weight = clampWeight(Math.min(target.weight, 0.75));
      }
      saveAll();
      render();
    });
  });

  els.bookList.querySelectorAll(".weight-input").forEach((input) => {
    input.addEventListener("change", () => {
      const book = currentCourse().books.find((item) => item.id === input.dataset.id);
      if (!book || book.role === "core") return;
      book.weight = clampWeight(input.value);
      input.value = book.weight.toFixed(2);
      saveAll();
      render();
    });
  });

  els.bookList.querySelectorAll(".delete-book").forEach((button) => {
    button.addEventListener("click", () => {
      currentCourse().books = currentCourse().books.filter((book) => book.id !== button.dataset.id);
      saveAll();
      render();
    });
  });
}

function renderTimeline() {
  const books = currentCourse().books;
  const ready = books.filter((book) => book.status === "ready").length;
  els.readyCount.textContent = `${ready} ready`;
  els.indexTimeline.innerHTML = books
    .map((book) => {
      const action =
        book.status === "ready"
          ? "可用于在线检索"
          : book.status === "processing"
            ? "正在解析版面与生成 embedding"
            : "等待后台索引任务";
      return `
        <div class="timeline-row">
          <div>
            <strong>${book.name}</strong>
            <span>${book.pages} 页 · ${action}</span>
          </div>
          <span class="status ${statusClass(book.status)}">${book.status}</span>
        </div>
      `;
    })
    .join("");
}

function renderMetrics() {
  const course = currentCourse();
  const books = course.books;
  const ready = books.filter((book) => book.status === "ready").length;
  const core = books.find((book) => book.role === "core");
  els.bookMetric.textContent = books.length;
  els.readyMetric.textContent = ready;
  els.coreMetric.textContent = core ? core.name.slice(0, 8) : "未设置";
  els.scopeMetric.textContent = { cascade: "级联", all: "全部", "core-only": "核心" }[course.strategy.retrievalScope];
  els.courseSummary.innerHTML = `已储备 ${books.length} 本课本，${ready} 本 ready<br>核心教材：${core ? core.name : "未设置"}`;
}

function renderTrace(miss = forceMiss) {
  const course = currentCourse();
  const readyBooks = course.books.filter((book) => book.status === "ready");
  const coreReady = readyBooks.some((book) => book.role === "core");
  const rows = [
    ["过滤课程", `course_id=${currentCourseId}，ready 书籍 ${readyBooks.length} 本`, "ready"],
  ];
  if (course.strategy.retrievalScope !== "all") {
    rows.push(["核心教材检索", coreReady ? (miss ? "核心教材未命中" : "命中定义与例题") : "核心教材未 ready 或未设置", coreReady && !miss ? "ready" : "queued"]);
  }
  if (course.strategy.retrievalScope === "cascade") {
    rows.push(["辅助教材检索", miss ? "按策略检索辅助书，仍无足够依据" : "必要时补充高权重辅助教材", miss ? "miss" : "ready"]);
  }
  if (course.strategy.retrievalScope === "all") {
    rows.push(["多书检索", "全部 ready 书籍并行召回并重排", miss ? "miss" : "ready"]);
  }
  els.searchTrace.innerHTML = rows
    .map(
      ([title, body, status]) => `
        <div class="trace-row">
          <div><strong>${title}</strong><span>${body}</span></div>
          <span class="status ${statusClass(status)}">${status}</span>
        </div>
      `
    )
    .join("");
}

function renderAnswer(miss = forceMiss) {
  if (miss) {
    els.answerBox.innerHTML = `<h3>未定位到足够依据</h3><p>当前课程已索引书籍中未找到能支撑该问题的课本内容，因此不生成确定性答案。</p>`;
    els.citationList.innerHTML = "";
    return;
  }
  els.answerBox.innerHTML = `
    <h3>答案</h3>
    <p>函数单调性需要在指定区间上讨论，核心判断是任取 x₁ &lt; x₂ 后比较 f(x₁) 与 f(x₂) 的大小 <span class="cite">[核心教材 p.45]</span>。</p>
    <p>证明时通常转化为判断 f(x₂)-f(x₁) 的符号，再结合定义完成结论 <span class="cite">[核心教材 p.46]</span>。</p>
  `;
  renderCitations([
    ["核心教材", 45, "core-p0045-c003", "定义：函数在区间上的单调性"],
    ["核心教材", 46, "core-p0046-c001", "证明步骤：任取 x₁ < x₂，比较差值符号"],
  ]);
}

function renderCitations(items) {
  els.citationList.innerHTML = items
    .map(
      ([book, page, chunk, text]) => `
        <button class="citation-item" data-page="${page}" data-text="${text}">
          <div><strong>${book}</strong><span>p.${page} · ${chunk}</span></div>
          <span>bbox</span>
        </button>
      `
    )
    .join("");
  els.citationList.querySelectorAll(".citation-item").forEach((button) => {
    button.addEventListener("click", () => {
      els.pageLabel.textContent = `p.${button.dataset.page}`;
      els.highlightBox.textContent = button.dataset.text;
    });
  });
}

function render() {
  renderCourseControls();
  renderStrategyControls();
  renderUploadPreview();
  renderBooks();
  renderTimeline();
  renderMetrics();
  renderTrace();
  renderAnswer();
}

function addUploadedBooks() {
  const course = currentCourse();
  if (!selectedFiles.length) {
    els.uploadPreview.textContent = "请先选择教材文件，再加入索引队列";
    return;
  }
  const role = els.uploadRole.value;
  const weight = clampWeight(els.uploadWeight.value || 0.7);
  const newBooks = selectedFiles.map((file) => bookFromFile(file, role, weight));

  if (role === "core") {
    course.books = course.books.map((book) => (book.role === "core" ? { ...book, role: "auxiliary", weight: clampWeight(Math.min(book.weight, 0.75)) } : book));
  }

  course.books.push(...newBooks);
  selectedFiles = [];
  els.bookUpload.value = "";
  saveAll();
  render();
}

function runIndex() {
  const course = currentCourse();
  const target = course.books.find((book) => book.status === "queued");
  if (!target) return;
  target.status = "processing";
  if (target.fingerprint && indexLibrary[target.fingerprint]) indexLibrary[target.fingerprint].status = "processing";
  saveAll();
  render();
  setTimeout(() => {
    target.status = "ready";
    if (target.fingerprint && indexLibrary[target.fingerprint]) indexLibrary[target.fingerprint].status = "ready";
    saveAll();
    render();
  }, 700);
}

els.courseSelect.addEventListener("change", () => {
  currentCourseId = els.courseSelect.value;
  render();
});

els.saveCourse.addEventListener("click", () => {
  const nextId = els.courseId.value.trim();
  if (!nextId) return;
  if (nextId !== currentCourseId) {
    courses[nextId] = { ...currentCourse(), id: nextId, title: nextId };
    delete courses[currentCourseId];
    currentCourseId = nextId;
  }
  saveAll();
  render();
});

els.newCourse.addEventListener("click", () => {
  saveAll();
  let id = "new-course";
  let n = 2;
  while (courses[id]) {
    id = `new-course-${n}`;
    n += 1;
  }
  courses[id] = { id, title: id, books: [], strategy: defaultStrategy() };
  currentCourseId = id;
  saveAll();
  render();
});

els.resetDemo.addEventListener("click", () => {
  courses = structuredClone(demoCourses);
  indexLibrary = {};
  currentCourseId = "math-analysis-01";
  selectedFiles = [];
  forceMiss = false;
  saveAll();
  render();
});

els.bookUpload.addEventListener("change", (event) => {
  selectedFiles = Array.from(event.target.files || []);
  renderUploadPreview();
});

els.addUploadedBooks.addEventListener("click", addUploadedBooks);
els.runIndex.addEventListener("click", runIndex);
els.askButton.addEventListener("click", () => {
  renderTrace();
  renderAnswer();
});
els.simulateMiss.addEventListener("click", () => {
  forceMiss = !forceMiss;
  els.simulateMiss.textContent = forceMiss ? "取消未命中模拟" : "模拟全书未命中";
  render();
});

[els.coreFirst, els.auxSortMode, els.missFeedback, els.retrievalScope].forEach((control) => {
  control.addEventListener("change", () => {
    currentCourse().strategy = {
      coreFirst: els.coreFirst.checked,
      auxSortMode: els.auxSortMode.value,
      missFeedback: els.missFeedback.checked,
      retrievalScope: els.retrievalScope.value,
    };
    saveAll();
    render();
  });
});

render();
