from typing import List, Dict, Any
from utils.logger import get_logger

logger = get_logger(__name__)

# List of common English filler words to track
FILLER_WORDS = {"um", "uh", "like", "actually", "basically", "literally", "you know", "mean"}

class SpeechMetricsService:
    @staticmethod
    def analyze_speech(words: List[Dict[str, Any]], total_duration: float) -> Dict[str, Any]:
        """
        Analyzes transcription word timestamps to calculate speech speed (WPM),
        filler words, and pauses.
        """
        if not words or total_duration <= 0:
            return {
                "average_wpm": 0.0,
                "filler_words_count": 0,
                "pauses_count": 0,
                "pauses_list": []
            }

        total_words = len(words)
        
        # Calculate WPM
        duration_minutes = total_duration / 60.0
        wpm = total_words / duration_minutes if duration_minutes > 0 else 0.0

        # Calculate filler words
        filler_count = 0
        for i, w_info in enumerate(words):
            word_str = w_info["word"].strip(",.?!:;").lower()
            
            # Check single word fillers
            if word_str in FILLER_WORDS:
                filler_count += 1
            # Check two-word fillers ("you know")
            elif i < len(words) - 1:
                next_word_str = words[i+1]["word"].strip(",.?!:;").lower()
                phrase = f"{word_str} {next_word_str}"
                if phrase in FILLER_WORDS:
                    filler_count += 1

        # Detect pauses (silence between consecutive words > 1.0s)
        pauses_list = []
        for i in range(len(words) - 1):
            end_current = words[i]["end"]
            start_next = words[i+1]["start"]
            gap = start_next - end_current
            if gap > 1.0:  # Gaps > 1s are classified as pauses
                pauses_list.append({
                    "start": end_current,
                    "end": start_next,
                    "duration": round(gap, 2)
                })

        return {
            "average_wpm": round(wpm, 2),
            "filler_words_count": filler_count,
            "pauses_count": len(pauses_list),
            "pauses_list": pauses_list
        }
