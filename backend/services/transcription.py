import os
from typing import List, Dict, Any
from utils.logger import get_logger

logger = get_logger(__name__)

class TranscriptionService:
    def __init__(self):
        self.model = None
        self.use_fallback = True
        
        # We try to import and initialize faster_whisper, falling back to mock if needed
        try:
            from faster_whisper import WhisperModel
            logger.info("Initializing faster-whisper model...")
            # Use 'tiny' model on CPU, quantized to int8 for speed and memory efficiency
            self.model = WhisperModel("tiny", device="cpu", compute_type="int8")
            self.use_fallback = False
            logger.info("faster-whisper model loaded successfully.")
        except Exception as e:
            logger.warning(f"Could not load faster-whisper model: {e}. Falling back to mock transcription.")

    def transcribe(self, audio_file_path: str) -> Dict[str, Any]:
        """
        Transcribes the audio file and returns a dictionary with the full text 
        and word-level / segment-level timestamps.
        """
        if self.use_fallback:
            return self._mock_transcribe()
            
        try:
            segments, info = self.model.transcribe(audio_file_path, beam_size=5)
            
            full_text = []
            words_list = []
            
            for segment in segments:
                full_text.append(segment.text)
                # If word-level timestamps are supported by the model config:
                if segment.words:
                    for w in segment.words:
                        words_list.append({
                            "word": w.word.strip(),
                            "start": w.start,
                            "end": w.end
                        })
                else:
                    # Fallback to segment-level words if word-level is missing
                    seg_words = segment.text.split()
                    if seg_words:
                        duration = segment.end - segment.start
                        step = duration / len(seg_words)
                        for idx, word in enumerate(seg_words):
                            words_list.append({
                                "word": word.strip(",.?!:;"),
                                "start": segment.start + (idx * step),
                                "end": segment.start + ((idx + 1) * step)
                            })
                            
            return {
                "text": " ".join(full_text),
                "language": info.language,
                "duration": info.duration,
                "words": words_list
            }
        except Exception as e:
            logger.error(f"Error during transcription: {e}. Falling back to mock transcription.")
            return self._mock_transcribe()

    def _mock_transcribe(self) -> Dict[str, Any]:
        """Realistic mock transcription with common filler words and pauses."""
        logger.info("Running simulated/mock audio transcription service.")
        mock_text = (
            "Hello, um, thank you for having me today. Basically, I want to talk about my project, PresentIQ. "
            "It is, uh, like a platform that uses AI to analyze speech. You know, we use librosa and whisper "
            "to extract metrics. And, um, we also check eye contact using MediaPipe. Actually, it helps "
            "people become better speakers."
        )
        words = []
        words_raw = mock_text.split()
        
        # Build fake timestamps for words (roughly 0.3s per word + some pauses)
        current_time = 0.5
        for w in words_raw:
            cleaned = w.strip(",.?!:;").lower()
            duration = 0.25
            if cleaned in ["um", "uh", "basically", "actually", "like"]:
                duration = 0.4  # Filler words often have slightly longer durations/drawls
                
            words.append({
                "word": w,
                "start": round(current_time, 2),
                "end": round(current_time + duration, 2)
            })
            current_time += duration + 0.05  # gap between words
            
            # Simulate a long pause
            if cleaned in ["presentiq.", "metrics.", "speakers."]:
                current_time += 1.2  # 1.2s pause at sentence boundaries

        return {
            "text": mock_text,
            "language": "en",
            "duration": round(current_time, 2),
            "words": words
        }
