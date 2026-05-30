# Course Grounded QA

一个课程级教材溯源问答 App 原型。它把“大模型无法全文阅读几百页课本”的问题，转化为“离线建立可复用索引，在线只检索课程相关证据”的问题。

## 当前原型

- 课程库：创建、保存、切换课程。
- 课本管理：上传课本，选择核心教材/辅助教材，调整权重，删除课程引用。
- 全局索引库：按文件指纹查重，跨课程复用索引，支持 CRUD 管理。
- 检索策略：核心书优先、辅助书排序、未命中反馈、检索范围均可配置。
- 索引队列：模拟 `queued -> processing -> ready` 的离线索引流程。
- 问答检索：模拟核心教材优先、辅助教材按策略补充的级联检索。
- 引用定位：展示 `book_id / index_id / page / chunk_id / bbox` 风格的引用信息。

## 文件结构

```text
.
├── index.html
├── styles.css
├── app.js
└── README.md
```

## 本地运行

```bash
python -m http.server 4173
```

访问：

```text
http://localhost:4173/index.html
```

## 高星项目模块学习

下面是从成熟 RAG/文档问答项目中抽象出的可复用模块，以及本项目建议吸收的方向。

### 1. AnythingLLM：工作区与文档流水线

参考项目：`Mintplex-Labs/anything-llm`

可学习点：

- workspace 概念：对应本项目的 `course_id`。
- 文档流水线：前端、server、collector、vector DB 管理分离。
- 多用户、权限、文档源引用、向量库可替换。

本项目吸收：

- 保留“课程库 = workspace”的产品形态。
- 后续拆分为 `frontend`、`api server`、`index worker`、`vector store`。
- 上传不等于立即问答，上传后进入后台索引队列。

### 2. RAGFlow：深度文档理解与可视化 chunk

参考项目：`infiniflow/ragflow`

可学习点：

- 深度文档理解。
- 模板化 chunking。
- grounded citations。
- chunk 可视化和人工干预。
- multiple recall + fused reranking。

本项目吸收：

- 教材解析不要只按固定长度切块，应按章节、定义、定理、例题、习题、公式切块。
- 数据库界面应支持查看和修正 chunk。
- 引用必须能追踪到 page、chunk、bbox。
- 检索结果需要重排，不只看向量相似度。

### 3. Haystack：显式可控 pipeline

参考项目：`deepset-ai/haystack`

可学习点：

- 模块化 pipeline。
- 检索、路由、记忆、生成都显式可控。
- 可部署成 API。
- 适合生产级 RAG 和 agent workflow。

本项目吸收：

- 把系统拆成清晰 pipeline：
  - `ingest_pipeline`
  - `dedupe_pipeline`
  - `index_pipeline`
  - `retrieve_pipeline`
  - `answer_pipeline`
  - `citation_verify_pipeline`
- 每一步都记录状态、耗时、输入输出和错误原因。

### 4. LightRAG：快速检索、图结构与多策略 chunk

参考项目：`HKUDS/LightRAG`

可学习点：

- 快速 RAG。
- 多种 chunk 策略。
- 检索上下文返回与评估。
- tracing/evaluation 集成。
- 角色化 LLM 配置。

本项目吸收：

- 支持多种教材切块策略：固定、递归、段落、语义块。
- 返回 retrieved contexts，便于评估检索质量。
- 将解析、关键词抽取、查询、视觉解析分成不同模型角色。
- 引入检索指标：context precision、命中页准确率、引用支持率。

### 5. Dify / Open WebUI：知识库管理台

参考项目：`langgenius/dify`、`open-webui/open-webui`

可学习点：

- 文档上传、知识库管理、文档删除。
- 面向非技术用户的管理界面。
- 与聊天界面结合。

本项目吸收：

- 全局数据库 CRUD 是必要模块。
- 课程只引用索引，不直接拥有重复数据。
- 删除课程引用和删除全局索引必须分开。
- 需要操作审计：谁改了书名、状态、权重、课程绑定。

### 6. kotaemon：文档问答与引用体验

参考项目：`Cinnamon/kotaemon`

可学习点：

- 文档聊天。
- 复杂文件 QA。
- 引用和 PDF 预览体验。

本项目吸收：

- 答案旁边展示引用卡片。
- 点击引用跳转到 PDF 页。
- 高亮对应 chunk/bbox。
- 支持多文档引用对比。

## 推荐后端架构

```text
frontend
  ├── 课程库管理
  ├── 全局索引库 CRUD
  ├── 检索策略配置
  └── 问答与引用定位

api server
  ├── courses API
  ├── books API
  ├── index library API
  ├── search API
  └── answer API

index worker
  ├── file fingerprint
  ├── OCR / parser
  ├── semantic chunking
  ├── embedding
  └── status update

storage
  ├── SQLite / Postgres 元数据
  ├── object storage 原文件
  ├── vector DB
  └── BM25 / FTS index
```

## 效率优化优先级

### P0：必须先做

- 文件指纹查重：`sha256(file)` 优先，前端原型的 `name + size + lastModified` 只能演示。
- 全局索引复用：课程保存 `index_id` 引用，避免重复解析和重复 embedding。
- 离线索引队列：解析/OCR/embedding 不进入在线问答链路。
- ready 状态过滤：在线检索只查可用索引。

### P1：提高检索质量

- 混合检索：向量检索 + BM25/FTS。
- 级联检索：核心教材先查，证据不足再查辅助教材。
- 重排：结合 `retrieval_score * book_weight * role_boost * evidence_quality`。
- 邻近扩展：命中 chunk 后自动取同页、上一页、下一页、同章节片段。

### P2：提高可维护性

- pipeline 日志：每个任务记录耗时、状态、错误。
- chunk 可视化：支持人工修正错误切块。
- 引用校验：答案每个关键结论必须能映射到证据。
- 评估集：用课程题库测试页码命中率和答案支持率。

### P3：生产增强

- 多用户权限。
- 操作审计。
- 后台任务重试。
- 大文件断点续传。
- 向量库增量更新。
- 索引版本管理。

## 关键数据模型

```text
Course
  id
  title
  strategy

CourseBook
  course_id
  book_id
  index_id
  role
  weight

IndexLibrary
  index_id
  file_hash
  source_name
  status
  parser
  chunk_strategy
  ref_count

Chunk
  chunk_id
  index_id
  page
  bbox
  section
  text
  embedding_id
```

## 产品原则

- 没有教材证据，不给确定答案。
- 有证据，必须给页码。
- 辅助教材参与时，必须说明来源不是核心教材。
- 同一本书只索引一次。
- 课程是知识组织方式，不是数据复制单位。
