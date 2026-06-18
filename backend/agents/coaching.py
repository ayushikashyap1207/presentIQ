import os
import json
from typing import Dict, Any
from schemas.metrics import MetricsBase
from schemas.feedback import FeedbackBase
from utils.logger import get_logger

logger = get_logger(__name__)

COACHING_SYSTEM_PROMPT = """
You are a senior communication coach and public speaking advisor.
Your job is to analyze structured speech and physical metrics and generate professional, actionable, and objective feedback.

CRITICAL ETHICAL GUARDRAILS:
1. NEVER attempt to infer the speaker's emotional state, confidence level, personality traits, trustworthiness, or mental health.
2. Only analyze and reference observable, measurable physical metrics (eye contact, posture, head stability, fidgeting, WPM, filler word count, pitch variance, volume consistency).
3. Do not make pseudoscientific statements. All suggestions must be grounded in direct behavioral exercises.

You must output a raw JSON object with the following fields:
{
  "strengths": ["list of 2-3 specific positive observations"],
  "areas_to_improve": ["list of 2-3 specific behavioral areas for improvement"],
  "exercises": ["list of 2 specific physical/vocal exercises to practice"],
  "suggestions": ["list of 2-3 concrete tips for their next rehearsal"],
  "summary": "A concise, encouraging, and objective 2-3 sentence summary of the session."
}
"""

class CoachingAgent:
    def __init__(self):
        self.api_key = os.getenv("OPENAI_API_KEY")
        self.client = None
        if self.api_key:
            try:
                from openai import OpenAI
                self.client = OpenAI(api_key=self.api_key)
                logger.info("OpenAI SDK client initialized.")
            except Exception as e:
                logger.warning(f"Failed to initialize OpenAI client: {e}")

    def generate_feedback(self, metrics: MetricsBase, transcript: str) -> FeedbackBase:
        """
        Generates feedback using OpenAI GPT model if API key is present.
        Otherwise falls back to rule-based template generation.
        """
        if self.client:
            try:
                return self._generate_gpt_feedback(metrics, transcript)
            except Exception as e:
                logger.error(f"GPT feedback generation failed: {e}. Falling back to template feedback.")
                return self._generate_template_feedback(metrics)
        else:
            logger.info("No OpenAI API key found. Generating template-based feedback.")
            return self._generate_template_feedback(metrics)

    def _generate_gpt_feedback(self, metrics: MetricsBase, transcript: str) -> FeedbackBase:
        metrics_dict = metrics.dict()
        user_message = f"""
        Analyze the following session metrics and transcript.
        
        Metrics:
        {json.dumps(metrics_dict, indent=2)}
        
        Transcript snippet:
        "{transcript[:1500]}"
        """
        
        response = self.client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": COACHING_SYSTEM_PROMPT},
                {"role": "user", "content": user_message}
            ],
            response_format={"type": "json_object"},
            temperature=0.7
        )
        
        result_text = response.choices[0].message.content
        data = json.loads(result_text)
        
        return FeedbackBase(
            strengths=data.get("strengths", []),
            areas_to_improve=data.get("areas_to_improve", []),
            exercises=data.get("exercises", []),
            suggestions=data.get("suggestions", []),
            summary=data.get("summary", "")
        )

    def _generate_template_feedback(self, metrics: MetricsBase) -> FeedbackBase:
        """Offline template-based fallback feedback matching the exact rules."""
        strengths = []
        improvements = []
        exercises = []
        suggestions = []

        # Eye contact evaluation
        if metrics.eye_contact_percentage >= 75:
            strengths.append(f"Maintained steady eye contact with the camera ({round(metrics.eye_contact_percentage)}% of the time).")
        else:
            improvements.append("Eye contact with the camera was intermittent. Try looking directly at the lens rather than the screen.")
            exercises.append("The Lens Focus exercise: Place a small colored sticker next to your camera lens and focus on it during key statements.")

        # Posture evaluation
        if metrics.posture_score >= 80:
            strengths.append("Excellent upright physical posture was maintained throughout the session.")
        else:
            improvements.append("Slouching or side-leaning detected. Maintaining a centered upright frame improves presence.")
            exercises.append("Upright breathing posture: Sit straight with shoulders back and take three deep diaphragmatic breaths before speaking.")

        # Speaking pace evaluation
        if metrics.average_wpm > 150:
            improvements.append(f"Speaking pace is fast ({round(metrics.average_wpm)} WPM). The conversational standard is 110-140 WPM.")
            exercises.append("The Pacing Metronome: Practice speaking a short paragraph at a deliberate 120 WPM speed.")
            suggestions.append("Consciously insert a full 2-second pause after completing each major thought.")
        elif metrics.average_wpm < 90:
            improvements.append(f"Speaking pace is slow ({round(metrics.average_wpm)} WPM). Aim for a slightly faster flow.")
            suggestions.append("Try slightly increasing speech speed when presenting general introductory facts.")
        else:
            strengths.append(f"Maintained an optimal conversational speaking pace ({round(metrics.average_wpm)} WPM).")

        # Filler words evaluation
        if metrics.filler_words_count > 5:
            improvements.append(f"High count of filler words ({metrics.filler_words_count} instances of um, uh, like).")
            exercises.append("The Silent Replacement: Practice saying a sentence, and when you feel a filler word coming, close your mouth and pause silently.")
            suggestions.append("Rehearse key transitions so you can state them smoothly without thinking pauses.")
        else:
            strengths.append(f"Excellent vocabulary control with minimal filler words ({metrics.filler_words_count} total).")

        # Default fallback items if lists are empty
        if not strengths:
            strengths = ["Visual stability was consistent", "Steady vocal consistency"]
        if not improvements:
            improvements = ["Refine transition timing", "Add structured 1s pauses at key sections"]
        if not exercises:
            exercises = ["Vocal scale hums: Hum up and down the pitch scale to increase conversational range."]
        if not suggestions:
            suggestions = ["Incorporate short pauses between lists", "Align camera at eye level"]

        summary = (
            f"This session demonstrated a speaking pace of {round(metrics.average_wpm)} WPM with "
            f"{metrics.filler_words_count} filler words. Physical posture was scored at {round(metrics.posture_score)}%, "
            f"and camera eye contact was at {round(metrics.eye_contact_percentage)}%."
        )

        return FeedbackBase(
            strengths=strengths[:3],
            areas_to_improve=improvements[:3],
            exercises=exercises[:2],
            suggestions=suggestions[:3],
            summary=summary
        )
