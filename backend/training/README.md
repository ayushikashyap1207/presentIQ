# PresentIQ Training Pipeline

This document explains how to use the training pipeline to fine-tune a
self-hosted Mistral-7B coaching model that can replace the GPT-4o-mini call
in `backend/agents/coaching.py`.

---

## Overview

```
Real sessions  →  dataset_builder.py  →  training_pairs.jsonl
                                               │
                                         fine_tune.py  (GPU instance)
                                               │
                                       checkpoints/final/  (merged model)
                                               │
                                    vLLM / Ollama  (local inference)
                                               │
                                    coaching.py  (swap endpoint)
```

---

## Step 1 — Collect 200+ Rated Sessions

Before running the pipeline, you need enough high-quality training examples.

- Deploy the app and collect real user sessions
- Ensure users can **rate** their feedback (a `rating` column on the
  `Feedback` table is needed — add it via a database migration)
- Target: **200+ sessions with rating ≥ 4** for meaningful fine-tuning
- More data → better generalisation. 500+ pairs is ideal.

> **Note on the rating column:** The current `Feedback` model does not
> have a `rating` field. The dataset builder currently uses
> `status == "feedback_ready"` as a proxy. Once you add the column:
>
> ```python
> # In database/models.py, add to class Feedback:
> rating = Column(Integer, nullable=True)  # 1-5 star rating from user
> ```
>
> Then update `_query_sessions()` in `dataset_builder.py` to filter by
> `Feedback.rating >= 4`.

---

## Step 2 — Export Training Pairs

Run from the project root (where `backend/` lives):

```bash
python -m backend.training.dataset_builder
```

This will:
1. Query all `feedback_ready` sessions with metrics and feedback
2. Re-run the RAG retriever for each session (same pipeline as inference)
3. Write one JSONL line per session to `backend/training/data/training_pairs.jsonl`
4. Print a stats report: total pairs, weak metric distribution, source usage

**Verify the output:**

```bash
# Count lines
wc -l backend/training/data/training_pairs.jsonl

# Inspect a sample pair
head -n 1 backend/training/data/training_pairs.jsonl | python -m json.tool
```

---

## Step 3 — Upload to a GPU Instance

The fine-tuning script requires a CUDA GPU. Recommended platforms:

| Platform       | Recommended GPU | Est. Cost for 3 epochs / 200 pairs |
|----------------|-----------------|-------------------------------------|
| Google Colab   | A100 40GB       | ~$3–5 (Colab Pro+)                  |
| RunPod         | A100 / RTX 4090 | ~$2–4                               |
| vast.ai        | RTX 3090 / A100 | ~$1–3                               |

**Upload files needed:**

```bash
# Minimum required files
backend/training/fine_tune.py
backend/training/data/training_pairs.jsonl
backend/requirements.txt          # for training dependencies
```

**On the GPU instance, install dependencies:**

```bash
pip install \
  datasets==2.20.0 \
  peft==0.11.1 \
  trl==0.9.4 \
  transformers==4.42.4 \
  bitsandbytes==0.43.1 \
  accelerate==0.30.1

# Authenticate with HuggingFace (Mistral is gated)
huggingface-cli login
```

---

## Step 4 — Run the Fine-Tuning Script

```bash
python fine_tune.py
```

The script will:
1. Guard against non-GPU environments
2. Load and split training data (90/10 train/val)
3. Load `mistralai/Mistral-7B-Instruct-v0.3` in 4-bit NF4 quantisation
4. Apply LoRA adapters (`r=16, alpha=32, target=q_proj+v_proj`)
5. Train with SFTTrainer for 3 epochs (eval every 50 steps)
6. Merge LoRA weights into the base model
7. Save the final model to `checkpoints/final/`
8. Print a training loss curve summary and GPU hours used

**Expected training time:**

| GPU      | Pairs | Epochs | Approx Time |
|----------|-------|--------|-------------|
| A100 40G | 200   | 3      | 2–3 hrs     |
| RTX 4090 | 200   | 3      | 3–4 hrs     |
| T4 16G   | 200   | 3      | 5–8 hrs     |

---

## Step 5 — Serve the Checkpoint

**Option A — vLLM (high throughput, production-ready):**

```bash
pip install vllm

vllm serve ./checkpoints/final \
  --port 8001 \
  --dtype float16 \
  --max-model-len 4096
```

**Option B — Ollama (easiest local setup):**

Create a `Modelfile`:

```
FROM ./checkpoints/final
SYSTEM "You are an expert presentation coach..."
```

```bash
ollama create presentiq -f Modelfile
ollama serve
```

Test the endpoint:

```bash
curl http://localhost:8001/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "presentiq", "messages": [{"role": "user", "content": "Test"}]}'
```

---

## Step 6 — Swap the OpenAI Client in coaching.py

Once the local model is running, update `backend/agents/coaching.py`:

```python
# Before (GPT-4o-mini via OpenAI API)
from openai import OpenAI
self.client = OpenAI(api_key=self.api_key)

# After (self-hosted Mistral via vLLM / Ollama — same OpenAI SDK!)
from openai import OpenAI
self.client = OpenAI(
    base_url="http://localhost:8001/v1",
    api_key="not-needed",           # vLLM doesn't need a real key
)
```

Also update the model name in `_generate_gpt_feedback`:

```python
# Before
model="gpt-4o-mini",

# After
model="presentiq",   # or the checkpoint path / Ollama model name
```

No other changes to the coaching pipeline are needed — the RAG integration
and prompt format remain identical.

---

## File Structure

```
backend/training/
├── __init__.py
├── dataset_builder.py       # Export pipeline
├── fine_tune.py             # QLoRA training script
├── README.md                # This file
├── data/                    # .gitignored
│   └── training_pairs.jsonl
└── checkpoints/             # .gitignored
    ├── checkpoint-50/
    ├── checkpoint-100/
    └── final/               # Merged model for deployment
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `CUDA out of memory` | Reduce `per_device_train_batch_size` to 2, increase `gradient_accumulation_steps` to 8 |
| `RuntimeError: GPU required` | You're not on a GPU instance — use Colab/RunPod |
| `Only N pairs found` | Run more sessions and rate them; need 50+ minimum |
| HuggingFace 401 error | Run `huggingface-cli login` and accept Mistral's terms |
| vLLM import error | `pip install vllm` — separate from training deps |
