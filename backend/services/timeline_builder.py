from typing import List, Dict, Any
from schemas.timeline import TimelineBase
from utils.logger import get_logger

logger = get_logger(__name__)

class TimelineBuilderService:
    @staticmethod
    def build_timeline(
        words: List[Dict[str, Any]], 
        pauses: List[Dict[str, Any]], 
        pitch_label: str
    ) -> List[TimelineBase]:
        """
        Creates timeline observation items for the presentation history.
        Observations include speaking pace variations, long pauses, and filler word clusters.
        """
        timeline = []

        # 1. Add observed pauses to timeline
        for pause in pauses:
            duration = pause["duration"]
            label = "Pause" if duration < 2.0 else "Long Pause"
            timeline.append(TimelineBase(
                start_seconds=float(pause["start"]),
                end_seconds=float(pause["end"]),
                observation=f"{label} detected ({duration}s)",
                category="pause"
            ))

        # 2. Add pace changes (calculate WPM in 15-second windows)
        if words:
            window_size = 15.0  # seconds
            max_time = max(w["end"] for w in words)
            
            for start in range(0, int(max_time), int(window_size)):
                end = start + window_size
                # Find words in this window
                window_words = [w for w in words if start <= w["start"] < end]
                if not window_words:
                    continue
                
                # Calculate local WPM
                local_wpm = len(window_words) / (window_size / 60.0)
                if local_wpm > 160.0:
                    timeline.append(TimelineBase(
                        start_seconds=float(start),
                        end_seconds=float(min(end, max_time)),
                        observation=f"Speaking quickly ({round(local_wpm)} WPM)",
                        category="pace"
                    ))
                elif local_wpm < 90.0 and len(window_words) > 3:
                    timeline.append(TimelineBase(
                        start_seconds=float(start),
                        end_seconds=float(min(end, max_time)),
                        observation=f"Slow pace ({round(local_wpm)} WPM)",
                        category="pace"
                    ))

        # 3. Add a pitch observation
        if timeline:
            max_time = max(item.end_seconds for item in timeline)
        else:
            max_time = 30.0
            
        timeline.append(TimelineBase(
            start_seconds=0.0,
            end_seconds=float(max_time),
            observation=f"Overall tone classification: {pitch_label}",
            category="pitch"
        ))

        # Sort timeline by start time
        timeline.sort(key=lambda x: x.start_seconds)
        return timeline
