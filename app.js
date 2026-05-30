const demoBooks = [
  {
    id: "core",
    name: "数学分析主教材.pdf",
    role: "核心教材",
    weight: 1.0,
    status: "ready",
    pages: 512,
  },
  {
    id: "aux-examples",
    name: "例题精讲.pdf",
    role: "辅助教材",
    weight: 0.72,
    status: "ready",
    pages: 238,
  },
  {
    id: "aux-solutions",
    name: "习题解答.pdf",
    role: "辅助教材",
    weight: 0.55,
    status: "queued",
    pages: 306,
  },
];

const storageKey = "course-grounded-qa-courses";
const libraryStorageKey = "course-grounded-qa-index-library";
const storageConfigKey = "course-grounded-qa-storage-config";
const demoCourses = {
  "math-analysis-01": {
    id: "math-analysis-01",
    title: "数学分析",
    strategy: defaultStrategy(),
    books: structuredClone(demoBooks),
  },
  "finance-basics-2025": {
    id: "finance-basics-2025",
    title: "金融市场基础知识",
    strategy: defaultStrategy(),
    books: [
      {
        id: "finance-core",
        name: "金融市场基础知识2025.pdf",
        role: "核心教材",
        weight: 1.0,
        status: "queued",
        pages: 420,
      },
    ],
  },
};

let courses = loadCourses();
let indexLibrary = loadIndexLibrary();
let storageConfig = loadStorageConfig();
let currentCourseId = Object.keys(courses)[0] || "math-analysis-01";
let books = structuredClone(courses[currentCourseId].books || []);
let strategy = { ...defaultStrategy(), ...(courses[currentCourseId].strategy || {}) };
let forceMiss = false;
let selectedFiles = [];

const bookList = document.querySelector("#bookList");
const timeline = document.querySelector("#indexTimeline");
const readyCount = document.querySelector("#readyCount");
const searchTrace = document.querySelector("#searchTrace");
const answerBox = document.querySelector("#answerBox");
const citationList = document.querySelector("#citationList");
const pageLabel = document.querySelector("#pageLabel");
const highlightBox = document.querySelector("#highlightBox");
const uploadInput = document.querySelector("#bookUpload");
const uploadPreview = document.querySelector("#uploadPreview");
const courseIdInput = document.querySelector("#courseId");
const courseSelect = document.querySelector("#courseSelect");
const courseSummary = document.querySelector("#courseSummary");
const coreFirstInput = document.querySelector("#coreFirst");
const auxSortModeInput = document.querySelector("#auxSortMode");
const missFeedbackInput = document.querySelector("#missFeedback");
const retrievalScopeInput = document.querySelector("#retrievalScope");
const libraryCount = document.querySelector("#libraryCount");
const librarySummary = document.querySelector("#librarySummary");
const dbList = document.querySelector("#dbList");
const dbSearch = document.querySelector("#dbSearch");
const rawStoragePathInput = document.querySelector("#rawStoragePath");
const indexStoragePathInput = document.querySelector("#indexStoragePath");
const sqlitePathInput = document.querySelector("#sqlitePath");
const storageNote = document.querySelector("#storageNote");

function defaultStrategy() {
  return {
    coreFirst: true,
    auxSortMode: "weight",
    missFeedback: true,
    retrievalScope: "cascade",
  };
}

function loadCourses() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (saved && typeof saved === "object") return saved;
  } catch {
    localStorage.removeItem(storageKey);
  }
  return structuredClone(demoCourses);
}

function loadIndexLibrary() {
  try {
    const saved = JSON.parse(localStorage.getItem(libraryStorageKey) || "null");
    if (saved && typeof saved === "object") return saved;
  } catch {
    localStorage.removeItem(libraryStorageKey);
  }
  return {};
}

function saveIndexLibrary() {
  localStorage.setItem(libraryStorageKey, JSON.stringify(indexLibrary));
}

function loadStorageConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageConfigKey) || "null");
    if (saved && typeof saved === "object") return saved;
  } catch {
    localStorage.removeItem(storageConfigKey);
  }
  return {
    rawPath: "D:\\CourseQA\\raw",
    indexPath: "D:\\CourseQA\\indexes",
    sqlitePath: "D:\\CourseQA\\courseqa.sqlite",
    chosenDirectoryName: "",
  };
}

function saveStorageConfig() {
  storageConfig = {
    rawPath: rawStoragePathInput.value.trim(),
    indexPath: indexStoragePathInput.value.trim(),
    sqlitePath: sqlitePathInput.value.trim(),
    chosenDirectoryName: storageConfig.chosenDirectoryName || "",
  };
  localStorage.setItem(storageConfigKey, JSON.stringify(storageConfig));
  renderStorageConfig();
}

function renderStorageConfig() {
  rawStoragePathInput.value = storageConfig.rawPath || "";
  indexStoragePathInput.value = storageConfig.indexPath || "";
  sqlitePathInput.value = storageConfig.sqlitePath || "";
  const mode = "当前原型会保存路径配置；真实写入本机目录需要后端服务读取该配置。";
  const picked = storageConfig.chosenDirectoryName
    ? `<br>浏览器已选择目录：<strong>${storageConfig.chosenDirectoryName}</strong>`
    : "";
  storageNote.innerHTML = `${mode}${picked}`;
}

function saveCourses() {
  courses[currentCourseId] = {
    id: currentCourseId,
    title: currentCourseId,
    strategy: { ...strategy },
    books: structuredClone(books),
  };
  localStorage.setItem(storageKey, JSON.stringify(courses));
  saveIndexLibrary();
  renderCourseSelect();
}

function renderCourseSelect() {
  courseSelect.innerHTML = Object.values(courses)
    .map((course) => {
      const selected = course.id === currentCourseId ? "selected" : "";
      return `<option value="${course.id}" ${selected}>${course.id}</option>`;
    })
    .join("");
}

function renderLibrarySummary() {
  const entries = Object.values(indexLibrary);
  const ready = entries.filter((item) => item.status === "ready").length;
  const reused = books.filter((book) => book.reused).length;
  libraryCount.textContent = `${entries.length}`;
  librarySummary.innerHTML = `
    <strong>${entries.length}</strong> 份唯一教材索引<br>
    <strong>${ready}</strong> 份 ready，可跨课程复用<br>
    当前课程复用 <strong>${reused}</strong> 本
  `;
}

function renderDatabasePanel() {
  const query = (dbSearch.value || "").toLowerCase().trim();
  const entries = Object.values(indexLibrary).filter((item) => {
    if (!query) return true;
    return `${item.indexId} ${item.name}`.toLowerCase().includes(query);
  });

  if (!entries.length) {
    dbList.innerHTML = `<div class="db-card"><span>暂无数据库记录。上传教材或点击新增记录。</span></div>`;
    return;
  }

  dbList.innerHTML = entries
    .map(
      (item) => `
        <div class="db-card" data-fingerprint="${item.fingerprint}">
          <div class="book-head">
            <div>
              <strong>${item.indexId}</strong>
              <div class="book-meta">
                <span>引用 ${item.refCount || 0} 次 · ${item.fingerprint.slice(0, 28)}...</span>
                <span>存储：${storageConfig.indexPath || "未设置"}</span>
              </div>
            </div>
            <span class="status ${statusClass(item.status)}">${item.status}</span>
          </div>
          <input class="db-name" value="${item.name}" />
          <div class="db-grid">
            <select class="db-status">
              <option value="queued" ${item.status === "queued" ? "selected" : ""}>queued</option>
              <option value="processing" ${item.status === "processing" ? "selected" : ""}>processing</option>
              <option value="ready" ${item.status === "ready" ? "selected" : ""}>ready</option>
            </select>
            <input class="db-pages" type="number" min="1" value="${item.pages || 1}" />
          </div>
          <div class="db-actions">
            <button class="secondary-button attach-db">挂到课程</button>
            <button class="primary-button save-db">保存</button>
            <button class="icon-button delete-db" title="删除索引">×</button>
          </div>
        </div>
      `
    )
    .join("");

  bindDatabaseControls();
}

function syncBookStatusFromLibrary(fingerprint) {
  const item = indexLibrary[fingerprint];
  if (!item) return;
  Object.values(courses).forEach((course) => {
    course.books = (course.books || []).map((book) =>
      book.fingerprint === fingerprint
        ? { ...book, name: item.name, pages: item.pages, status: item.status, indexId: item.indexId, reused: true }
        : book
    );
  });
  books = books.map((book) =>
    book.fingerprint === fingerprint
      ? { ...book, name: item.name, pages: item.pages, status: item.status, indexId: item.indexId, reused: true }
      : book
  );
}

function bindDatabaseControls() {
  dbList.querySelectorAll(".db-card").forEach((card) => {
    const fingerprint = card.dataset.fingerprint;
    card.querySelector(".save-db").addEventListener("click", () => {
      const item = indexLibrary[fingerprint];
      if (!item) return;
      item.name = card.querySelector(".db-name").value.trim() || item.name;
      item.status = card.querySelector(".db-status").value;
      item.pages = Number(card.querySelector(".db-pages").value || 1);
      syncBookStatusFromLibrary(fingerprint);
      saveCourses();
      render();
      renderDatabasePanel();
      renderTrace(forceMiss);
    });

    card.querySelector(".delete-db").addEventListener("click", () => {
      delete indexLibrary[fingerprint];
      Object.values(courses).forEach((course) => {
        course.books = (course.books || []).filter((book) => book.fingerprint !== fingerprint);
      });
      books = books.filter((book) => book.fingerprint !== fingerprint);
      saveCourses();
      saveIndexLibrary();
      render();
      renderDatabasePanel();
      renderTrace(forceMiss);
      renderAnswer(forceMiss);
    });

    card.querySelector(".attach-db").addEventListener("click", () => {
      const item = indexLibrary[fingerprint];
      if (!item) return;
      const alreadyAttached = books.some((book) => book.fingerprint === fingerprint);
      if (alreadyAttached) return;
      books.push({
        id: item.name
          .replace(/\.[^.]+$/, "")
          .toLowerCase()
          .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 32) || item.indexId,
        name: item.name,
        role: books.some((book) => book.role === "核心教材") ? "辅助教材" : "核心教材",
        weight: books.some((book) => book.role === "核心教材") ? 0.7 : 1.0,
        status: item.status,
        pages: item.pages,
        fingerprint,
        indexId: item.indexId,
        reused: true,
      });
      item.refCount = (item.refCount || 0) + 1;
      saveCourses();
      saveIndexLibrary();
      render();
      renderDatabasePanel();
      renderTrace(forceMiss);
    });
  });
}

function switchCourse(courseId) {
  if (!courses[courseId]) return;
  currentCourseId = courseId;
  courseIdInput.value = courseId;
  books = structuredClone(courses[courseId].books || []);
  strategy = { ...defaultStrategy(), ...(courses[courseId].strategy || {}) };
  selectedFiles = [];
  uploadInput.value = "";
  renderUploadPreview();
  renderCourseSelect();
  renderStrategyControls();
  render();
  renderTrace(forceMiss);
  renderAnswer(forceMiss);
}

function renderStrategyControls() {
  coreFirstInput.checked = strategy.coreFirst;
  auxSortModeInput.value = strategy.auxSortMode;
  missFeedbackInput.checked = strategy.missFeedback;
  retrievalScopeInput.value = strategy.retrievalScope;
}

function readStrategyControls() {
  strategy = {
    coreFirst: coreFirstInput.checked,
    auxSortMode: auxSortModeInput.value,
    missFeedback: missFeedbackInput.checked,
    retrievalScope: retrievalScopeInput.value,
  };
  saveCourses();
  render();
  renderTrace(forceMiss);
}

function statusClass(status) {
  return {
    ready: "ready",
    queued: "queued",
    processing: "processing",
    miss: "miss",
  }[status] || "queued";
}

function sortedBooks(sourceBooks = books) {
  return [...sourceBooks].sort((a, b) => {
    if (strategy.coreFirst && a.role !== b.role) {
      return a.role === "核心教材" ? -1 : 1;
    }

    if (strategy.auxSortMode === "ready" && a.status !== b.status) {
      return a.status === "ready" ? -1 : 1;
    }
    if (strategy.auxSortMode === "name") {
      return a.name.localeCompare(b.name, "zh-CN");
    }
    if (b.weight !== a.weight) {
      return b.weight - a.weight;
    }
    return a.name.localeCompare(b.name, "zh-CN");
  });
}

function sortBooksInPlace() {
  books = sortedBooks(books);
}

function fileFingerprint(file) {
  const name = (file.name || "").toLowerCase().trim();
  return `${name}::${file.size || 0}::${file.lastModified || 0}`;
}

function renderBooks() {
  sortBooksInPlace();
  bookList.innerHTML = books
    .map(
      (book) => `
        <div class="book-card">
          <div class="book-head">
            <div>
              <div class="book-name">${book.name}</div>
              <div class="book-meta">
                <span>${book.role} · book_id=${book.id}</span>
                <span>${book.indexId ? `${book.reused ? "复用索引" : "课程引用"} · ${book.indexId}` : "本课程内置教材"}</span>
              </div>
            </div>
            <span class="status ${statusClass(book.status)}">${book.status}</span>
          </div>
          <div class="book-actions">
            <label>
              <span>角色</span>
              <select class="role-select" data-id="${book.id}">
                <option value="core" ${book.role === "核心教材" ? "selected" : ""}>核心教材</option>
                <option value="auxiliary" ${book.role === "辅助教材" ? "selected" : ""}>辅助教材</option>
              </select>
            </label>
            <label>
              <span>权重</span>
              <input class="weight-input" data-id="${book.id}" type="number" min="0.1" max="1.5" step="0.05" value="${book.weight.toFixed(2)}" ${book.role === "核心教材" ? "disabled" : ""} />
            </label>
            <button class="icon-button delete-book" data-id="${book.id}" title="删除课本">×</button>
          </div>
        </div>
      `
    )
    .join("");
  bindBookControls();
}

function bindBookControls() {
  bookList.querySelectorAll(".role-select").forEach((select) => {
    select.addEventListener("change", () => {
      const target = books.find((book) => book.id === select.dataset.id);
      if (!target) return;

      if (select.value === "core") {
        books = books.map((book) => {
          if (book.id === target.id) {
            return { ...book, role: "核心教材", weight: 1.0 };
          }
          if (book.role === "核心教材") {
            return { ...book, role: "辅助教材", weight: Math.min(book.weight, 0.75) };
          }
          return book;
        });
      } else {
        target.role = "辅助教材";
        target.weight = Math.min(target.weight, 0.75);
      }

      saveCourses();
      render();
      renderTrace(forceMiss);
      renderAnswer(forceMiss);
    });
  });

  bookList.querySelectorAll(".weight-input").forEach((input) => {
    input.addEventListener("change", () => {
      const book = books.find((item) => item.id === input.dataset.id);
      if (!book || book.role === "核心教材") return;
      book.weight = Number(input.value || 0.1);
      saveCourses();
      render();
      renderTrace(forceMiss);
    });
  });

  bookList.querySelectorAll(".delete-book").forEach((button) => {
    button.addEventListener("click", () => {
      books = books.filter((book) => book.id !== button.dataset.id);
      saveCourses();
      render();
      renderTrace(forceMiss);
      renderAnswer(forceMiss);
    });
  });

}

function fileToBook(file, role, weight) {
  const cleanName = file.name || "uploaded-book.pdf";
  const fingerprint = fileFingerprint(file);
  const libraryHit = indexLibrary[fingerprint];
  if (!libraryHit) {
    indexLibrary[fingerprint] = {
      indexId: `idx-${Object.keys(indexLibrary).length + 1}`,
      fingerprint,
      name: cleanName,
      status: "queued",
      pages: Math.max(1, Math.round((file.size || 600000) / 18000)),
      refCount: 0,
    };
    saveIndexLibrary();
  }
  const libraryRecord = indexLibrary[fingerprint];
  libraryRecord.refCount += 1;
  saveIndexLibrary();

  const baseId = cleanName
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  const exists = new Set(books.map((book) => book.id));
  let id = baseId || `book-${books.length + 1}`;
  let suffix = 2;
  while (exists.has(id)) {
    id = `${baseId}-${suffix}`;
    suffix += 1;
  }

  return {
    id,
    name: cleanName,
    role: role === "core" ? "核心教材" : "辅助教材",
    weight: role === "core" ? 1.0 : Number(weight),
    status: libraryRecord.status,
    pages: libraryRecord.pages,
    fingerprint,
    indexId: libraryRecord.indexId,
    reused: Boolean(libraryHit),
  };
}

function renderUploadPreview() {
  if (!selectedFiles.length) {
    uploadPreview.textContent = "尚未选择文件";
    return;
  }
  uploadPreview.innerHTML = selectedFiles
    .map((file) => `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB`)
    .join("<br>");
}

function renderTimeline() {
  const orderedBooks = sortedBooks();
  const ready = orderedBooks.filter((book) => book.status === "ready").length;
  readyCount.textContent = `${ready} ready`;
  timeline.innerHTML = orderedBooks
    .map((book) => {
      const action =
        book.status === "ready"
          ? `${book.reused ? "复用全局索引" : "已写入 JSONL / SQLite / 向量库"}`
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

function renderCitations(citations) {
  citationList.innerHTML = citations
    .map(
      (item) => `
        <button class="citation-item" data-page="${item.page}" data-text="${item.text}">
          <div>
            <strong>${item.book}</strong>
            <span>${item.role} · p.${item.page} · ${item.chunk}</span>
          </div>
          <span>bbox</span>
        </button>
      `
    )
    .join("");

  citationList.querySelectorAll(".citation-item").forEach((button) => {
    button.addEventListener("click", () => {
      pageLabel.textContent = `p.${button.dataset.page}`;
      highlightBox.textContent = button.dataset.text;
    });
  });
}

function renderTrace(miss = false) {
  const readyBooks = books.filter((book) => book.status === "ready");
  const scopeText = {
    cascade: "级联检索：核心书优先，必要时查辅助书",
    all: "全部 ready 书籍并行检索",
    "core-only": "仅检索核心教材",
  }[strategy.retrievalScope];
  const rows = [
    {
      title: "过滤课程",
      body: `course_id=${document.querySelector("#courseId").value}，ready 书籍 ${readyBooks.length} 本，${scopeText}`,
      status: "ready",
    },
  ];

  const coreReady = readyBooks.some((book) => book.role === "核心教材");
  if (strategy.retrievalScope !== "all" && !coreReady) {
    rows.push({
      title: "核心教材状态",
      body: "当前没有 ready 核心教材，在线问答会等待索引完成或仅返回缺失反馈",
      status: "queued",
    });
  } else if (strategy.retrievalScope !== "all") {
    rows.push({
      title: "核心教材检索",
      body: miss ? "未找到可支撑答案的定义、例题或公式" : "命中 p.45 定义与 p.46 例题",
      status: miss ? "miss" : "ready",
    });
  }

  if (strategy.retrievalScope === "all") {
    rows.push({
      title: "多书并行检索",
      body: `按${strategy.auxSortMode === "weight" ? "权重" : strategy.auxSortMode === "ready" ? "ready 状态" : "名称"}排序合并证据`,
      status: miss ? "miss" : "ready",
    });
  } else if (strategy.retrievalScope === "core-only") {
    rows.push({
      title: "辅助教材检索",
      body: "当前策略为仅核心教材，跳过辅助书",
      status: "queued",
    });
  } else if (miss) {
    rows.push({
      title: "辅助教材级联检索",
      body: "按权重检索辅助教材，仍未定位到足够依据",
      status: "miss",
    });
  } else {
    rows.push({
      title: "辅助教材级联检索",
      body: "核心证据已足够，仅补充检索高权重辅助书的相邻例题",
      status: "ready",
    });
  }

  searchTrace.innerHTML = rows
    .map(
      (row) => `
        <div class="trace-row">
          <div>
            <strong>${row.title}</strong>
            <span>${row.body}</span>
          </div>
          <span class="status ${statusClass(row.status)}">${row.status}</span>
        </div>
      `
    )
    .join("");
}

function renderAnswer(miss = false) {
  if (miss) {
    if (!strategy.missFeedback) {
      answerBox.innerHTML = `
        <h3>未生成答案</h3>
        <p>当前策略关闭了未命中反馈，因此不展示无依据详情。</p>
      `;
      renderCitations([]);
      return;
    }
    answerBox.innerHTML = `
      <h3>未定位到足够依据</h3>
      <p>当前课程已索引书籍中未找到能支撑该问题的课本内容，因此不生成带页码的确定性答案。</p>
      <p><strong>已检索：</strong>${books
        .filter((book) => book.status === "ready")
        .sort((a, b) => b.weight - a.weight)
        .map((book) => book.name)
        .join("、") || "无 ready 书籍"}。</p>
    `;
    renderCitations([]);
    return;
  }

  answerBox.innerHTML = `
    <h3>答案</h3>
    <p>函数单调性要先固定在某个区间上讨论：若任取 x₁ &lt; x₂ 都有 f(x₁) ≤ f(x₂)，则函数在该区间单调递增 <span class="cite">[数学分析主教材.pdf p.45]</span>。</p>
    <p>证明时通常从“任取两个点并比较函数值”开始，再把目标转化为 f(x₂)-f(x₁) 的符号判断 <span class="cite">[数学分析主教材.pdf p.46]</span>。</p>
    <p>辅助例题给出的做法是先写出差式，再因式分解或利用已知不等式确定符号，适合作为课本定义后的操作化步骤 <span class="cite">[例题精讲.pdf p.18]</span>。</p>
  `;

  renderCitations([
    {
      book: "数学分析主教材.pdf",
      role: "核心教材",
      page: 45,
      chunk: "core-p0045-c003",
      text: "定义：函数在区间上的单调性",
    },
    {
      book: "数学分析主教材.pdf",
      role: "核心教材",
      page: 46,
      chunk: "core-p0046-c001",
      text: "证明步骤：任取 x₁ < x₂，比较 f(x₂)-f(x₁)",
    },
    {
      book: "例题精讲.pdf",
      role: "辅助教材",
      page: 18,
      chunk: "aux-examples-p0018-c002",
      text: "例题：通过差式符号判断单调性",
    },
  ]);
}

function runIndexDemo() {
  const queued = books.find((book) => book.status === "queued");
  if (!queued) return;
  queued.status = "processing";
  if (queued.fingerprint && indexLibrary[queued.fingerprint]) {
    indexLibrary[queued.fingerprint].status = "processing";
    saveIndexLibrary();
  }
  saveCourses();
  render();
  setTimeout(() => {
    queued.status = "ready";
    if (queued.fingerprint && indexLibrary[queued.fingerprint]) {
      indexLibrary[queued.fingerprint].status = "ready";
      saveIndexLibrary();
      Object.values(courses).forEach((course) => {
        course.books = (course.books || []).map((book) =>
          book.fingerprint === queued.fingerprint ? { ...book, status: "ready", reused: true } : book
        );
      });
      books = books.map((book) =>
        book.fingerprint === queued.fingerprint ? { ...book, status: "ready", reused: true } : book
      );
    }
    saveCourses();
    render();
    renderTrace(forceMiss);
  }, 900);
}

function addUploadedBooks() {
  if (!selectedFiles.length) {
    uploadPreview.textContent = "请先选择课本文件";
    return;
  }
  const role = document.querySelector("#uploadRole").value;
  const weight = document.querySelector("#uploadWeight").value;
  const newBooks = selectedFiles.map((file) => fileToBook(file, role, weight));
  if (role === "core") {
    books = books.map((book) =>
      book.role === "核心教材" ? { ...book, role: "辅助教材", weight: Math.min(book.weight, 0.75) } : book
    );
  }
  books.push(...newBooks);
  sortBooksInPlace();
  saveCourses();
  selectedFiles = [];
  uploadInput.value = "";
  renderUploadPreview();
  render();
  renderTrace(forceMiss);
}

function render() {
  renderBooks();
  renderTimeline();
  renderLibrarySummary();
  renderDatabasePanel();
  const ready = books.filter((book) => book.status === "ready").length;
  const core = books.find((book) => book.role === "核心教材");
  courseSummary.innerHTML = `已储备 ${books.length} 本课本，${ready} 本 ready<br>核心教材：${core ? core.name : "未设置"}`;
}

document.querySelector("#runIndex").addEventListener("click", runIndexDemo);
document.querySelector("#askButton").addEventListener("click", () => {
  renderTrace(forceMiss);
  renderAnswer(forceMiss);
});
document.querySelector("#simulateMiss").addEventListener("click", () => {
  forceMiss = !forceMiss;
  document.querySelector("#simulateMiss").textContent = forceMiss ? "取消未命中模拟" : "模拟全书未命中";
  renderTrace(forceMiss);
  renderAnswer(forceMiss);
});
courseSelect.addEventListener("change", (event) => {
  saveCourses();
  switchCourse(event.target.value);
});
courseIdInput.addEventListener("change", () => {
  const nextId = courseIdInput.value.trim();
  if (!nextId || nextId === currentCourseId) return;
  delete courses[currentCourseId];
  currentCourseId = nextId;
  saveCourses();
  renderCourseSelect();
});
document.querySelector("#saveCourse").addEventListener("click", () => {
  const nextId = courseIdInput.value.trim();
  if (!nextId) {
    courseIdInput.value = currentCourseId;
    return;
  }
  if (nextId !== currentCourseId) {
    delete courses[currentCourseId];
    currentCourseId = nextId;
  }
  saveCourses();
});
document.querySelector("#newCourse").addEventListener("click", () => {
  saveCourses();
  const base = "new-course";
  let id = base;
  let index = 2;
  while (courses[id]) {
    id = `${base}-${index}`;
    index += 1;
  }
  courses[id] = { id, title: id, books: [] };
  courses[id].strategy = defaultStrategy();
  localStorage.setItem(storageKey, JSON.stringify(courses));
  switchCourse(id);
});
coreFirstInput.addEventListener("change", readStrategyControls);
auxSortModeInput.addEventListener("change", readStrategyControls);
missFeedbackInput.addEventListener("change", readStrategyControls);
retrievalScopeInput.addEventListener("change", readStrategyControls);
dbSearch.addEventListener("input", renderDatabasePanel);
document.querySelector("#addDbRecord").addEventListener("click", () => {
  const index = Object.keys(indexLibrary).length + 1;
  const fingerprint = `manual::${Date.now()}::${index}`;
  indexLibrary[fingerprint] = {
    indexId: `idx-${index}`,
    fingerprint,
    name: `未命名教材-${index}.pdf`,
    status: "queued",
    pages: 1,
    refCount: 0,
  };
  saveIndexLibrary();
  render();
});
document.querySelector("#saveStoragePaths").addEventListener("click", saveStorageConfig);
document.querySelector("#pickStorageDir").addEventListener("click", async () => {
  if (!window.showDirectoryPicker) {
    storageNote.textContent = "当前浏览器不支持目录选择，请手动填写路径；后端接入后会使用这些路径落盘。";
    return;
  }
  try {
    const handle = await window.showDirectoryPicker();
    storageConfig.chosenDirectoryName = handle.name;
    storageConfig.rawPath = `${handle.name}\\raw`;
    storageConfig.indexPath = `${handle.name}\\indexes`;
    storageConfig.sqlitePath = `${handle.name}\\courseqa.sqlite`;
    localStorage.setItem(storageConfigKey, JSON.stringify(storageConfig));
    renderStorageConfig();
    renderDatabasePanel();
  } catch {
    storageNote.textContent = "已取消选择文件夹。";
  }
});
uploadInput.addEventListener("change", (event) => {
  selectedFiles = Array.from(event.target.files || []);
  renderUploadPreview();
});
document.querySelector("#addUploadedBooks").addEventListener("click", addUploadedBooks);
document.querySelector("#resetDemo").addEventListener("click", () => {
  courses = structuredClone(demoCourses);
  indexLibrary = {};
  currentCourseId = "math-analysis-01";
  books = structuredClone(courses[currentCourseId].books);
  strategy = { ...defaultStrategy(), ...(courses[currentCourseId].strategy || {}) };
  localStorage.setItem(storageKey, JSON.stringify(courses));
  localStorage.setItem(libraryStorageKey, JSON.stringify(indexLibrary));
  courseIdInput.value = currentCourseId;
  forceMiss = false;
  selectedFiles = [];
  uploadInput.value = "";
  document.querySelector("#simulateMiss").textContent = "模拟全书未命中";
  renderUploadPreview();
  searchTrace.innerHTML = "";
  answerBox.innerHTML = "";
  renderCitations([]);
  renderCourseSelect();
  renderStrategyControls();
  render();
});

renderCourseSelect();
renderStrategyControls();
renderStorageConfig();
courseIdInput.value = currentCourseId;
render();
renderUploadPreview();
renderTrace(false);
renderAnswer(false);
