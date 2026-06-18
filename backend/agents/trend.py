from typing import List, Dict, Any
from database.models import Session as SessionModel
from utils.logger import get_logger

logger = get_logger(__name__)

class TrendAnalysisAgent:
    @staticmethod
    def analyze_trends(past_sessions: List[SessionModel]) -> Dict[str, Any]:
        """
        Analyzes historical session metrics to generate cross-session improvement trends.
        """
        logger.info(f"Analyzing trends for {len(past_sessions)} sessions.")
        
        if len(past_sessions) < 2:
            return {
                "message": "At least 2 sessions are required to compute trends.",
                "trends": {},
                "summary": "Record more practice sessions to start tracking your progress over time!"
            }

        # Extract metric arrays in chronological order (oldest to newest)
        chronological = sorted(past_sessions, key=lambda s: s.created_at)
        
        eye_contact_history = []
        posture_history = []
        wpm_history = []
        filler_history = []
        
        for sess in chronological:
            if sess.metrics:
                eye_contact_history.append(sess.metrics.eye_contact_percentage)
                posture_history.append(sess.metrics.posture_score)
                wpm_history.append(sess.metrics.average_wpm)
                filler_history.append(sess.metrics.filler_words_count)

        trends = {}
        
        # Helper function to classify simple trend from history array
        def get_trend_label(history: List[float], higher_is_better: bool = True) -> Dict[str, Any]:
            if len(history) < 2:
                return {"direction": "stable", "change": 0.0}
            
            diff = history[-1] - history[0]
            pct_change = (diff / history[0] * 100.0) if history[0] != 0 else 0.0
            
            if abs(diff) < 2.0:
                direction = "stable"
            elif diff > 0:
                direction = "improving" if higher_is_better else "declining"
            else:
                direction = "declining" if higher_is_better else "improving"
                
            return {
                "direction": direction,
                "change": round(diff, 2),
                "percentage_change": round(pct_change, 2),
                "history": history
            }

        if eye_contact_history:
            trends["eye_contact"] = get_trend_label(eye_contact_history, higher_is_better=True)
        if posture_history:
            trends["posture"] = get_trend_label(posture_history, higher_is_better=True)
        if wpm_history:
            # Optimal WPM is centered around 130 WPM. Calculate difference from ideal WPM
            wpm_diff_start = abs(wpm_history[0] - 130.0)
            wpm_diff_end = abs(wpm_history[-1] - 130.0)
            diff = wpm_diff_start - wpm_diff_end  # positive means end is closer to 130 WPM (improving)
            
            direction = "stable"
            if abs(diff) >= 5.0:
                direction = "improving" if diff > 0 else "declining"
                
            trends["pace_wpm"] = {
                "direction": direction,
                "change": round(wpm_history[-1] - wpm_history[0], 2),
                "history": wpm_history
            }
        if filler_history:
            trends["filler_words"] = get_trend_label(filler_history, higher_is_better=False)

        # Generate coaching summary
        improvement_areas = [k for k, v in trends.items() if v["direction"] == "improving"]
        decline_areas = [k for k, v in trends.items() if v["direction"] == "declining"]
        
        if improvement_areas:
            summary = f"Great work! You are showing steady improvement in: {', '.join(improvement_areas)}."
            if decline_areas:
                summary += f" Keep practicing to stabilize: {', '.join(decline_areas)}."
        elif decline_areas:
            summary = f"Focus on stabilizing your {', '.join(decline_areas)} in your upcoming sessions."
        else:
            summary = "Your performance metrics are holding steady. Focus on pacing and transitions to reach the next level!"

        return {
            "message": "Trends analyzed successfully.",
            "trends": trends,
            "summary": summary
        }
