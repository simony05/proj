# PDF RAG

A workspace-based PDF retrieval-augmented generation (RAG) application. Each workspace is an isolated vector knowledge base — upload PDFs, then ask questions.

The backend now runs as two cooperating services over shared filesystem storage and a Redis queue:

- `api`: serves HTTP endpoints, stores uploaded PDFs, and pushes document jobs into Redis
- `worker`: blocks on a Redis queue and performs extraction, chunking, embedding, and FAISS indexing

## Stack

| Layer | Technology |
|---|---|
| Backend | Python · FastAPI · FAISS · OpenAI API |
| Frontend | Next.js 15 (App Router) · Tailwind CSS |

---

## Project structure

```
.
├── app/                        # Backend code shared by API + worker
│   ├── main.py
│   ├── worker.py
│   ├── models.py
│   ├── workspace.py
│   ├── embeddings.py
│   ├── rag.py
│   └── routers/
│       ├── workspaces.py
│       └── documents.py
├── frontend/                   # Next.js frontend
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── workspace/[workspace_id]/page.tsx
│   ├── components/
│   │   ├── Sidebar.tsx
│   │   └── WorkspaceView.tsx
│   └── lib/api.ts
├── data/                       # Auto-created at runtime
│   └── workspace_{uuid}/
│       ├── metadata.json
│       ├── documents.json
│       ├── chunks.json
│       ├── index.faiss
│       └── docs/
└── requirements.txt
```

---

## Setup

### Prerequisites

- Python 3.11+
- Node.js 18+
- An OpenAI API key

### 1. Backend

```bash
# Install Python dependencies
pip install -r requirements.txt

# Add your OpenAI key
echo "OPENAI_API_KEY=sk-..." > .env

# Start Redis
docker run --rm -p 6379:6379 redis:7-alpine

# Start the API server
uvicorn app.main:app --reload
# Runs at http://localhost:8000

# In a second terminal, start the worker
python -m app.worker
```

### 2. Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start the dev server
npm run dev
# Runs at http://localhost:3000
```

---

## Usage

1. **Open** `http://localhost:3000` in your browser.
2. **Create a workspace** — click **+ New Workspace** in the sidebar, type a name, press Enter or click **Add**.
3. **Upload a PDF** — inside the workspace, click **Choose File**, select a `.pdf`, and wait for the "uploaded" confirmation. The API stores the file locally, creates a document record, and pushes a job to Redis.
4. **Worker processing** — the worker consumes the Redis job, loads the PDF from the saved file path, extracts text, chunks it, computes embeddings, and updates the FAISS index. When successful, the document status becomes `ready`; otherwise it becomes `failed`.
5. **Ask a question** — type your question in the input at the bottom and click **Send**. The backend retrieves the top-3 relevant chunks and returns an answer via `gpt-4o-mini`.
6. **Switch workspaces** — click any workspace in the sidebar. Each workspace has its own document set and FAISS index.
7. **Delete a workspace** — hover over a workspace name in the sidebar and click **✕**. This permanently deletes the workspace folder and all its documents.

---

## Docker

The backend services can be run together with Docker Compose. The API and worker share the same `data/` directory, and Redis acts as the job broker between them.

```bash
echo "OPENAI_API_KEY=sk-..." > .env
docker compose up --build
```

This starts:

- `redis` on `localhost:6379`
- `api` on `http://localhost:8000`
- `worker` as a long-running Redis consumer

Optional environment variables:

- `LOG_LEVEL` — defaults to `INFO`
- `REDIS_QUEUE_NAME` — defaults to `document_jobs`

---

## API reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/workspaces` | List all workspaces |
| `POST` | `/workspaces` | Create workspace `{"name": "..."}` |
| `DELETE` | `/workspaces/{id}` | Delete workspace and its data |
| `POST` | `/workspaces/{id}/upload` | Upload a PDF, save it locally, and enqueue a Redis job (`multipart/form-data`) |
| `POST` | `/workspaces/{id}/query` | Query `{"query": "..."}` → `{"answer": "...", "sources": [...]}` |

Interactive docs: `http://localhost:8000/docs`
