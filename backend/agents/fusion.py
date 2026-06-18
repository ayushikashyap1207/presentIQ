from schemas.metrics import MetricsBase
from utils.logger import get_logger

logger = get_logger(__name__)

class MetricFusionAgent:
    @staticmethod
    def fuse_metrics(
        video_metrics: dict, 
        audio_metrics: dict, 
        speech_metrics: dict
    ) -> MetricsBase:
        """
        Combines client-side visual metrics with server-side acoustic/linguistic metrics
        to form the unified Metrics schema.
        """
        logger.info("Fusing visual, audio, and speech metrics.")
        
        # Extract visual metrics (from frontend client) with defaults
        eye_contact = float(video_metrics.get("eyeContact", video_metrics.get("eye_contact_percentage", 80.0)))
        posture = float(video_metrics.get("postureScore", video_metrics.get("posture_score", 85.0)))
        head_stability = float(video_metrics.get("headStability", video_metrics.get("head_stability_score", 90.0)))
        fidget = float(video_metrics.get("fidgetScore", video_metrics.get("fidget_score", 10.0)))

        # Extract acoustic metrics (from librosa)
        pitch_variance = float(audio_metrics.get("pitch_variance", 50.0))
        pitch_label = str(audio_metrics.get("pitch_label", "Medium"))
        volume_consistency = float(audio_metrics.get("volume_consistency", 80.0))

        # Extract speech metrics (from whisper timestamps)
        average_wpm = float(speech_metrics.get("average_wpm", 130.0))
        filler_words = int(speech_metrics.get("filler_words_count", 0))
        pauses = int(speech_metrics.get("pauses_count", 0))

        return MetricsBase(
            eye_contact_percentage=eye_contact,
            posture_score=posture,
            head_stability_score=head_stability,
            fidget_score=fidget,
            pitch_variance=pitch_variance,
            pitch_label=pitch_label,
            volume_consistency=volume_consistency,
            average_wpm=average_wpm,
            filler_words_count=filler_words,
            pauses_count=pauses
        )
