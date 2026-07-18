# PresentIQ — RAG-Powered Presentation Coach

---

## 1. What the Final Product Does

PresentIQ records a user's presentation, extracts 8 speech and visual metrics, retrieves relevant coaching knowledge from a curated vector database, and generates grounded, evidence-based feedback using an LLM. Users can ask follow-up questions—such as "How do I stop saying um?" or "What is a good WPM for interviews?"—and receive answers drawn from the same knowledge base. As sessions accumulate and users rate the feedback they receive, the system builds a training dataset to eventually fine-tune a self-hosted coaching model. The result is a coaching tool that starts smart and gets smarter the more it is used.

---

## 2. The RAG Pipeline (Step by Step)

1. **Upload / Record** — User uploads or records audio (and optionally video) of their presentation session.
2. **Transcription** — `faster-whisper` transcribes the audio; `speech_metrics.py` extracts words-per-minute (WPM), filler-word count, and pause timings from the word-level transcript.
3. **Signal Processing** — `librosa` (pyin algorithm) extracts pitch variance and volume consistency from the raw audio waveform.
4. **Vision Metrics** — `MediaPipe` analyses the video stream to produce posture score, eye-contact percentage, and head-stability score.
5. **Pull Agent** — The `MetricFusionAgent` fuses the 8 metrics and identifies which ones fall below their target threshold, forming a list of "weak areas".
6. **RAG Retrieval** — `pull_relevant_chunks()` queries ChromaDB using the weak-area labels as query texts with Maximum Marginal Relevance (MMR) to retrieve diverse, relevant knowledge chunks from the curated knowledge base.
7. **LLM Generation** — The retrieved chunks are injected as grounded context into a GPT-4o-mini prompt alongside the session metrics and transcript.
8. **Structured Feedback** — The model returns JSON: `strengths`, `improvements`, `priority_action`, and `sources` (the knowledge files consulted).
9. **Frontend Display** — The feedback card shows strengths, areas to improve, suggestions, a collapsible **Knowledge Sources** panel listing which research documents were used, and an **Ask the Coach** input for free-form follow-up questions.

---

## 3. The Training Loop (How It Gets Smarter Over Time)

1. **User Ratings** — After each session, users rate the coaching feedback on a 1–5 star scale.
2. **Dataset Builder** — `dataset_builder.py` exports sessions rated ≥ 4 stars as supervised training pairs, skipping low-quality feedback automatically.
3. **Training Pairs** — Each pair contains the full metrics dict, the retrieved RAG context that was used, and the highly-rated coaching feedback as the target output.
4. **LoRA Fine-Tuning** — `fine_tune.py` uses HuggingFace `peft` (LoRA) and `trl` (SFTTrainer) to fine-tune Mistral-7B on these pairs. A GPU is required; training runs offline and is never blocking to live users.
5. **Local Deployment** — The fine-tuned model is served via **Ollama** or **vllm** on a low-cost GPU instance (≈ $10/month).
6. **Endpoint Swap** — `coaching.py`'s OpenAI client is pointed at the local endpoint; the rest of the application is unchanged.
7. **Flywheel Effect** — More users → more high-rated sessions → richer training data → better fine-tuned model → better feedback → more users.

---

## 4. Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React, TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query |
| **Backend** | FastAPI, SQLAlchemy, PostgreSQL (asyncpg) |
| **Speech** | faster-whisper (transcription), librosa / pyin (pitch), pydub (audio I/O) |
| **Vision** | MediaPipe (posture, eye contact, head stability) |
| **RAG** | ChromaDB (vector store), sentence-transformers `all-MiniLM-L6-v2` (embeddings), MMR retrieval |
| **LLM (now)** | GPT-4o-mini via OpenAI API |
| **LLM (future)** | Fine-tuned Mistral-7B served via Ollama or vllm |
| **Training** | HuggingFace `transformers`, `peft` (LoRA), `trl` (SFTTrainer) |
| **Infra** | Docker, docker-compose, PostgreSQL |

---

## 5. What the User Experiences

### Before RAG

> *"Try to use fewer filler words."*

Generic. No numbers. No technique. No reason to trust it.

### After RAG

> *"You used 14 filler words in 3 minutes (4.7/min — above the acceptable threshold of 5/min). Try the **Pause Substitution Method**: replace each 'um' with a 1-second deliberate silence. Research shows this reduces filler-word frequency by 60% within 14 days of daily practice."*

Specific numbers, a named technique, and a research-backed outcome — that is what RAG adds to PresentIQ.

---

*The RAG layer is the bridge between raw signal measurements and genuinely useful coaching. Without it, the LLM guesses. With it, every piece of feedback is grounded in curated, domain-specific knowledge.*
