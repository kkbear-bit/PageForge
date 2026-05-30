# PageForge

PageForge is a prototype workspace for course-grounded question answering. It focuses on one narrow but important problem: when a student asks a course question, the system should retrieve the right textbook evidence before it generates an answer.

It is not a generic PDF chat interface. PageForge is designed around courses, core textbooks, auxiliary books, retrieval status, page-level evidence, and citation traceability.

## The Problem

Most document QA demos stop at “upload PDFs and ask questions”. That is not enough for course learning.

In real textbook QA, the hard part is often not generation. The hard part is retrieval:

- A student question rarely uses the same wording as the textbook.
  The query may ask “why is this function increasing”, while the textbook evidence is under “monotonicity”, “definition”, “sufficient condition”, or an example proof.

- Chunk retrieval can miss the exact teaching unit.
  Definitions, formulas, diagrams, examples, and proof steps are often split across adjacent pages or chunks. Retrieving one isolated paragraph may lose the reasoning context.

- Multiple books create noisy retrieval.
  A course may contain a main textbook, lecture notes, example books, and solution manuals. If all documents are mixed together, an auxiliary solution can outrank the official textbook.

- The system may retrieve a related paragraph but cite it as proof.
  A semantically similar chunk is not always sufficient evidence. Course QA needs to know whether the retrieved text actually supports the answer.

- Page citations can become detached from the generated answer.
  Many RAG demos show citations, but the answer sentence is not tightly connected to the cited page, chunk, or bounding box.

- Retrieval failure is often invisible.
  When no good chunk is found, many systems still generate a fluent answer. In education, “not enough evidence in the indexed course material” is a valid and necessary result.

PageForge explores a more auditable workflow for these retrieval problems.

## What PageForge Tries To Do

PageForge organizes course QA around an evidence-first retrieval pipeline:

1. Scope every query to a `course_id`.
2. Separate the core textbook from auxiliary materials.
3. Track indexing state before a book can participate in online QA.
4. Retrieve from the core textbook first, then supplement with weighted auxiliary books.
5. Preserve page, chunk, and bbox metadata for citation inspection.
6. Show retrieval traces and refuse to produce a confident answer when evidence is insufficient.

## Current Prototype

This repository currently contains a zero-dependency frontend prototype.

Implemented in the demo:

- Course workspace for switching, creating, and saving course configurations.
- Textbook queue with core/auxiliary roles, weights, and indexing states.
- Retrieval strategy controls for core-first, weighted auxiliary retrieval, and scope selection.
- Simulated indexing lifecycle: `queued`, `processing`, `ready`.
- Evidence trace panel that explains how the answer was retrieved.
- Citation panel with page and simulated bbox highlighting.
- “Insufficient evidence” simulation to show non-answer behavior.

## Product Direction

The long-term goal is a course-aware RAG system where answer quality is judged not only by fluency, but by whether the system retrieved the right textbook evidence.

Planned backend capabilities:

- PDF, EPUB, MOBI parsing with page preservation.
- OCR and formula-aware layout extraction.
- Chunking that respects textbook structure such as definitions, examples, proofs, and exercises.
- Hybrid retrieval using BM25, vector search, reranking, and course-specific weighting.
- Citation verification that checks whether each answer claim is supported by retrieved evidence.
- Index task queue with per-book readiness and failure states.

## File Structure

```text
.
├── index.html
├── styles.css
├── app.js
├── README.md
└── .gitignore
```

## Run Locally

PageForge is a static frontend. Open `index.html` directly, or run a local static server:

```bash
python -m http.server 8000
```

Then visit:

```text
http://localhost:8000
```

## License

No license has been selected yet.
