"""
PresentIQ Fine-Tuning Script — Mistral-7B-Instruct with LoRA
==============================================================
Fine-tunes Mistral-7B-Instruct-v0.3 on the PresentIQ coaching dataset
using 4-bit quantisation (QLoRA) via HuggingFace PEFT + TRL.

REQUIREMENTS:
  - A CUDA-capable GPU (e.g., A100, V100, RTX 3090+, T4 with enough VRAM)
  - Packages: transformers, peft, trl, bitsandbytes, accelerate, datasets
  - HuggingFace account with access to mistralai/Mistral-7B-Instruct-v0.3
    (gated model — run `huggingface-cli login` first)

HOW TO RUN:
  On Colab / RunPod / vast.ai:
    python -m backend.training.fine_tune

ESTIMATED GPU TIME:
  ~2-3 hours on A100 40GB for 200 training pairs, 3 epochs
  ~5-6 hours on T4 16GB (may need gradient_accumulation_steps=8)
"""

from __future__ import annotations

# ── GPU guard (must be the very first runtime check) ─────────────────────────
import torch

if not torch.cuda.is_available():
    raise RuntimeError(
        "GPU required. This script must be run on a CUDA-capable GPU instance.\n"
        "Recommended platforms: Google Colab (A100), RunPod, vast.ai.\n"
        "Run `nvidia-smi` to verify GPU availability before launching."
    )

# ── Standard library ──────────────────────────────────────────────────────────
import json
import pathlib
import sys
import time
from datetime import datetime
from typing import Any

# ── Third-party (training dependencies) ──────────────────────────────────────
from datasets import Dataset, DatasetDict, load_dataset
from peft import LoraConfig, TaskType, get_peft_model
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    BitsAndBytesConfig,
    TrainingArguments,
)
from trl import SFTTrainer

# ─────────────────────────────────────────────────────────────────────────────
# Paths
# ─────────────────────────────────────────────────────────────────────────────
_THIS_DIR       = pathlib.Path(__file__).parent.resolve()
DATA_FILE       = _THIS_DIR / "data" / "training_pairs.jsonl"
CHECKPOINT_DIR  = _THIS_DIR / "checkpoints"
FINAL_MODEL_DIR = CHECKPOINT_DIR / "final"

# ─────────────────────────────────────────────────────────────────────────────
# Hyper-parameters
# ─────────────────────────────────────────────────────────────────────────────
BASE_MODEL          = "mistralai/Mistral-7B-Instruct-v0.3"
TRAIN_SPLIT         = 0.9       # 90% train, 10% validation
NUM_TRAIN_EPOCHS    = 3
BATCH_SIZE          = 4
GRAD_ACCUM_STEPS    = 4         # effective batch = 4 * 4 = 16
LEARNING_RATE       = 2e-4
MAX_SEQ_LENGTH      = 2048      # token budget per sample
LORA_R              = 16
LORA_ALPHA          = 32
LORA_DROPOUT        = 0.05
LORA_TARGET_MODULES = ["q_proj", "v_proj"]
EVAL_STEPS          = 50
SAVE_STEPS          = 50
LOGGING_STEPS       = 10


# ─────────────────────────────────────────────────────────────────────────────
# Step 1 — Load & split dataset
# ─────────────────────────────────────────────────────────────────────────────

def load_and_split_dataset() -> DatasetDict:
    """
    Load training_pairs.jsonl and split into train / validation sets.

    Each JSONL line has:
        { "messages": [...], "_meta": {...} }

    Returns a DatasetDict with keys 'train' and 'validation'.
    """
    if not DATA_FILE.exists():
        raise FileNotFoundError(
            f"Training data not found at {DATA_FILE}.\n"
            "Run `python -m backend.training.dataset_builder` first."
        )

    records: list[dict] = []
    with DATA_FILE.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                records.append(json.loads(line))

    if len(records) < 10:
        raise ValueError(
            f"Only {len(records)} training pairs found. "
            "Collect at least 50 rated sessions before fine-tuning "
            "(200+ recommended for meaningful improvement)."
        )

    print(f"[FineTune] Loaded {len(records)} training pairs from {DATA_FILE}")

    # Build HuggingFace Dataset
    hf_dataset = Dataset.from_list(records)

    # Shuffle then split
    split = hf_dataset.train_test_split(
        test_size=1 - TRAIN_SPLIT,
        seed=42,
        shuffle=True,
    )
    dataset_dict = DatasetDict({
        "train":      split["train"],
        "validation": split["test"],
    })

    print(
        f"[FineTune] Split → train: {len(dataset_dict['train'])} "
        f"| validation: {len(dataset_dict['validation'])}"
    )
    return dataset_dict


# ─────────────────────────────────────────────────────────────────────────────
# Step 2 — Load base model in 4-bit (QLoRA)
# ─────────────────────────────────────────────────────────────────────────────

def load_base_model() -> tuple[Any, Any]:
    """
    Load Mistral-7B-Instruct-v0.3 with 4-bit NF4 quantisation.

    Returns:
        (model, tokenizer)
    """
    print(f"[FineTune] Loading base model: {BASE_MODEL}")
    print(f"[FineTune] GPU: {torch.cuda.get_device_name(0)}")
    print(f"[FineTune] VRAM available: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB")

    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.float16,
        bnb_4bit_use_double_quant=True,   # saves ~0.4 bits/param extra
    )

    model = AutoModelForCausalLM.from_pretrained(
        BASE_MODEL,
        quantization_config=bnb_config,
        device_map="auto",
        trust_remote_code=False,
    )
    model.config.use_cache = False          # required for gradient checkpointing
    model.config.pretraining_tp = 1

    tokenizer = AutoTokenizer.from_pretrained(
        BASE_MODEL,
        trust_remote_code=False,
    )
    tokenizer.pad_token     = tokenizer.eos_token
    tokenizer.padding_side  = "right"       # prevents warnings with fp16

    print("[FineTune] Base model loaded successfully.")
    return model, tokenizer


# ─────────────────────────────────────────────────────────────────────────────
# Step 3 — Apply LoRA
# ─────────────────────────────────────────────────────────────────────────────

def apply_lora(model: Any) -> Any:
    """
    Wrap the base model with LoRA adapters using PEFT.

    Config:
        r=16, alpha=32, target_modules=[q_proj, v_proj],
        dropout=0.05, bias=none, task=CAUSAL_LM
    """
    lora_config = LoraConfig(
        r=LORA_R,
        lora_alpha=LORA_ALPHA,
        target_modules=LORA_TARGET_MODULES,
        lora_dropout=LORA_DROPOUT,
        bias="none",
        task_type=TaskType.CAUSAL_LM,
    )

    model = get_peft_model(model, lora_config)
    model.print_trainable_parameters()
    return model


# ─────────────────────────────────────────────────────────────────────────────
# Step 4 — Format messages for SFT
# ─────────────────────────────────────────────────────────────────────────────

def _format_messages(example: dict) -> dict:
    """
    Convert a messages array into a single text string using
    Mistral's chat template format for SFTTrainer.

    SFTTrainer expects a 'text' field when dataset_text_field='text'.
    """
    messages: list[dict] = example.get("messages", [])
    parts: list[str] = []

    for msg in messages:
        role    = msg.get("role", "")
        content = msg.get("content", "")

        if role == "system":
            parts.append(f"<s>[INST] <<SYS>>\n{content}\n<</SYS>>\n\n")
        elif role == "user":
            parts.append(f"{content} [/INST] ")
        elif role == "assistant":
            parts.append(f"{content} </s>")

    return {"text": "".join(parts)}


# ─────────────────────────────────────────────────────────────────────────────
# Step 5 — Train with SFTTrainer
# ─────────────────────────────────────────────────────────────────────────────

def train(
    model: Any,
    tokenizer: Any,
    dataset_dict: DatasetDict,
) -> SFTTrainer:
    """
    Configure and run SFTTrainer with the specified hyperparameters.

    Returns the trainer object for post-training inspection.
    """
    CHECKPOINT_DIR.mkdir(parents=True, exist_ok=True)

    training_args = TrainingArguments(
        output_dir=str(CHECKPOINT_DIR),
        num_train_epochs=NUM_TRAIN_EPOCHS,
        per_device_train_batch_size=BATCH_SIZE,
        gradient_accumulation_steps=GRAD_ACCUM_STEPS,
        learning_rate=LEARNING_RATE,
        fp16=True,
        bf16=False,
        optim="paged_adamw_32bit",
        evaluation_strategy="steps",
        eval_steps=EVAL_STEPS,
        save_strategy="steps",
        save_steps=SAVE_STEPS,
        logging_steps=LOGGING_STEPS,
        logging_dir=str(CHECKPOINT_DIR / "logs"),
        load_best_model_at_end=True,
        metric_for_best_model="eval_loss",
        greater_is_better=False,
        report_to="none",           # set to "wandb" if you want W&B tracking
        warmup_ratio=0.05,
        lr_scheduler_type="cosine",
        group_by_length=True,       # pack similar-length sequences → efficiency
        dataloader_pin_memory=False,
    )

    # Pre-process dataset into text format
    train_ds = dataset_dict["train"].map(_format_messages, remove_columns=dataset_dict["train"].column_names)
    val_ds   = dataset_dict["validation"].map(_format_messages, remove_columns=dataset_dict["validation"].column_names)

    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        args=training_args,
        train_dataset=train_ds,
        eval_dataset=val_ds,
        dataset_text_field="text",
        max_seq_length=MAX_SEQ_LENGTH,
        packing=False,              # set True for very short sequences
    )

    print(f"\n[FineTune] Starting training — {datetime.utcnow().isoformat()} UTC")
    print(f"[FineTune] Epochs            : {NUM_TRAIN_EPOCHS}")
    print(f"[FineTune] Train samples     : {len(train_ds)}")
    print(f"[FineTune] Val samples       : {len(val_ds)}")
    print(f"[FineTune] Effective batch   : {BATCH_SIZE * GRAD_ACCUM_STEPS}")
    print(f"[FineTune] Learning rate     : {LEARNING_RATE}")
    print(f"[FineTune] Output dir        : {CHECKPOINT_DIR}\n")

    trainer.train()
    return trainer


# ─────────────────────────────────────────────────────────────────────────────
# Step 6 — Save merged model (base + LoRA)
# ─────────────────────────────────────────────────────────────────────────────

def save_merged_model(trainer: SFTTrainer, tokenizer: Any) -> None:
    """
    Merge LoRA weights into the base model and save the full model
    to backend/training/checkpoints/final/ for deployment with vLLM or Ollama.
    """
    FINAL_MODEL_DIR.mkdir(parents=True, exist_ok=True)

    print(f"\n[FineTune] Merging LoRA adapters into base model...")
    merged_model = trainer.model.merge_and_unload()

    merged_model.save_pretrained(str(FINAL_MODEL_DIR))
    tokenizer.save_pretrained(str(FINAL_MODEL_DIR))

    print(f"[FineTune] Merged model saved to: {FINAL_MODEL_DIR}")


# ─────────────────────────────────────────────────────────────────────────────
# Step 7 — Print training summary
# ─────────────────────────────────────────────────────────────────────────────

def print_training_summary(trainer: SFTTrainer, start_time: float) -> None:
    """
    Print a concise post-training report with loss curve summary,
    eval loss, and estimated GPU hours.
    """
    elapsed_seconds = time.time() - start_time
    elapsed_hours   = elapsed_seconds / 3600

    log_history = trainer.state.log_history

    # Extract train loss entries
    train_losses  = [(e["step"], e["loss"])      for e in log_history if "loss"      in e]
    eval_losses   = [(e["step"], e["eval_loss"]) for e in log_history if "eval_loss" in e]

    sep = "─" * 60
    print(f"\n{sep}")
    print("  PresentIQ Fine-Tune — Training Summary")
    print(sep)
    print(f"  Base model          : {BASE_MODEL}")
    print(f"  Final model saved   : {FINAL_MODEL_DIR}")
    print(f"  Total training time : {elapsed_hours:.2f} GPU-hours  ({elapsed_seconds:.0f}s)")

    if train_losses:
        first_loss = train_losses[0][1]
        last_loss  = train_losses[-1][1]
        print(f"\n  Training loss curve:")
        print(f"    Step {train_losses[0][0]:>5}  →  loss {first_loss:.4f}  (start)")
        # Print 3 intermediate points
        stride = max(1, len(train_losses) // 4)
        for step, loss in train_losses[stride::stride][:3]:
            print(f"    Step {step:>5}  →  loss {loss:.4f}")
        print(f"    Step {train_losses[-1][0]:>5}  →  loss {last_loss:.4f}  (final)")
        improvement = (first_loss - last_loss) / first_loss * 100 if first_loss else 0
        print(f"    Improvement: {improvement:.1f}%")

    if eval_losses:
        best_eval = min(eval_losses, key=lambda x: x[1])
        last_eval = eval_losses[-1]
        print(f"\n  Validation (eval) loss:")
        print(f"    Best  → step {best_eval[0]:>5}, eval_loss {best_eval[1]:.4f}")
        print(f"    Final → step {last_eval[0]:>5}, eval_loss {last_eval[1]:.4f}")

    print(f"\n  LoRA config:")
    print(f"    r={LORA_R}, alpha={LORA_ALPHA}, "
          f"dropout={LORA_DROPOUT}, targets={LORA_TARGET_MODULES}")

    print(f"\n  Next steps:")
    print(f"    1. Download {FINAL_MODEL_DIR} from the GPU instance")
    print(f"    2. Serve with:  vllm serve {FINAL_MODEL_DIR} --port 8001")
    print(f"       or:          ollama create presentiq -f Modelfile")
    print(f"    3. Swap OpenAI client in coaching.py to point to localhost:8001")
    print(sep + "\n")


# ─────────────────────────────────────────────────────────────────────────────
# CLI entry point
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    start_time = time.time()

    print("=" * 60)
    print("  PresentIQ — Mistral-7B LoRA Fine-Tuning")
    print("=" * 60)
    print(f"  Started : {datetime.utcnow().isoformat()} UTC")
    print(f"  GPU     : {torch.cuda.get_device_name(0)}")
    print(f"  CUDA    : {torch.version.cuda}")
    print()

    # Step 1 — Load data
    dataset_dict = load_and_split_dataset()

    # Step 2 — Load base model
    model, tokenizer = load_base_model()

    # Step 3 — Apply LoRA
    model = apply_lora(model)

    # Step 4 + 5 — Train
    trainer = train(model, tokenizer, dataset_dict)

    # Step 6 — Save merged model
    save_merged_model(trainer, tokenizer)

    # Step 7 — Summary
    print_training_summary(trainer, start_time)
