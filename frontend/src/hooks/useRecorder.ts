import { useState, useRef, useCallback } from 'react';

interface UseRecorderProps {
  onAudioChunk: (chunk: Blob) => void;
}

export const useRecorder = ({ onAudioChunk }: UseRecorderProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const startRecording = useCallback(async () => {
    try {
      // Request underlying device permissions for both visual and audio inputs
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, frameRate: 30 },
        audio: true,
      });

      setStream(mediaStream);
      setIsRecording(true);

      // Initialize the audio recorder slice layer
      // We explicitly capture audio as a standard webm/ogg container
      const mediaRecorder = new MediaRecorder(mediaStream, {
        mimeType: 'audio/webm',
      });

      mediaRecorderRef.current = mediaRecorder;

      // This event handler triggers every time the timeslice millisecond boundary is crossed
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          onAudioChunk(event.data);
        }
      };

      // Slice the incoming audio stream into discrete 2000ms packages
      mediaRecorder.start(2000);
    } catch (error) {
      console.error('System failed to capture local device media streams:', error);
      alert('Camera/Microphone permission denied or unavailable.');
    }
  }, [onAudioChunk]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    if (stream) {
      // Gracefully turn off camera and microphone hardware lights
      stream.getTracks().forEach((track) => track.stop());
    }

    setIsRecording(false);
    setStream(null);
  }, [stream]);

  return {
    isRecording,
    stream,
    startRecording,
    stopRecording,
  };
};