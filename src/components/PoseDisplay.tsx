import React, { useEffect, useRef, useState } from 'react';
import { Landmark, FrameData } from '../types';
import { getJointAngles } from '../utils/geometry';
import { 
  PoseLandmarker, 
  FilesetResolver, 
  DrawingUtils 
} from '@mediapipe/tasks-vision';

interface PoseDisplayProps {
  videoFile: File | null;
  onFrameProcessed: (data: FrameData) => void;
  onComplete: () => void;
  setProcessingProgress: (progress: number) => void;
  isPaused: boolean;
  onModelLoaded?: (loaded: boolean) => void;
  onStatusChange?: (status: 'initializing' | 'buffering' | 'processing' | 'paused' | 'complete') => void;
  modelVariant?: 'full' | 'lite';
  speedMode?: 'accuracy' | 'balanced' | 'throughput';
}

export function PoseDisplay({ 
  videoFile, 
  onFrameProcessed, 
  onComplete,
  setProcessingProgress,
  isPaused,
  onModelLoaded,
  onStatusChange,
  modelVariant = 'full',
  speedMode = 'balanced'
}: PoseDisplayProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [modelLoading, setModelLoading] = useState(true);

  const getThresholds = (mode: string) => {
    switch (mode) {
      case 'accuracy': return { minDetection: 0.7, minPresence: 0.7 };
      case 'throughput': return { minDetection: 0.3, minPresence: 0.3 };
      default: return { minDetection: 0.5, minPresence: 0.5 };
    }
  };

  useEffect(() => {
    if (modelLoading) onStatusChange?.('initializing');
  }, [modelLoading]);

  useEffect(() => {
    if (isPaused) onStatusChange?.('paused');
  }, [isPaused]);

  useEffect(() => {
    const initLandmarker = async () => {
      setModelLoading(true);
      onModelLoaded?.(false);
      
      try {
        if (poseLandmarkerRef.current) {
          await poseLandmarkerRef.current.close();
          poseLandmarkerRef.current = null;
        }

        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        
        const modelPath = modelVariant === 'lite' 
          ? `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`
          : `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task`;

        const { minDetection, minPresence } = getThresholds(speedMode);

        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: modelPath,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numPoses: 1,
          minPoseDetectionConfidence: minDetection,
          minPosePresenceConfidence: minPresence,
          minTrackingConfidence: minPresence
        });
        poseLandmarkerRef.current = landmarker;
        setModelLoading(false);
        onModelLoaded?.(true);
      } catch (err) {
        console.error("Failed to initialize PoseLandmarker:", err);
      }
    };
    initLandmarker();

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      poseLandmarkerRef.current?.close();
    };
  }, [modelVariant, speedMode]);

  useEffect(() => {
    if (videoFile && videoRef.current) {
      videoRef.current.src = URL.createObjectURL(videoFile);
    }
  }, [videoFile]);

  const processNextFrame = async () => {
    if (!videoRef.current || !poseLandmarkerRef.current || isPaused || modelLoading) return;

    const video = videoRef.current;
    if (video.currentTime >= video.duration - 0.05) {
      onStatusChange?.('complete');
      onComplete();
      return;
    }

    // Capture at current timestamp
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    onStatusChange?.('processing');
    
    try {
      // Draw frame to canvas first
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const startTimeMs = video.currentTime * 1000;
      const result = poseLandmarkerRef.current.detectForVideo(video, startTimeMs);

      if (result.landmarks && result.landmarks.length > 0) {
        const drawingUtils = new DrawingUtils(ctx);
        for (const landmark of result.landmarks) {
          drawingUtils.drawConnectors(landmark, PoseLandmarker.POSE_CONNECTIONS, { color: '#6366f1', lineWidth: 2 });
          drawingUtils.drawLandmarks(landmark, { 
            color: '#10b981', 
            lineWidth: 1,
            radius: (data) => DrawingUtils.lerp(data.from!.z, -0.15, 0.1, 4, 1) 
          });
        }

        const ourLandmarks: Landmark[] = result.landmarks[0].map(l => ({
          x: l.x,
          y: l.y,
          z: l.z,
          visibility: l.visibility || 0
        }));

        const angles = getJointAngles(ourLandmarks);
        
        onFrameProcessed({
          frameIndex: Math.floor(video.currentTime * 30),
          timestamp: video.currentTime,
          landmarks: ourLandmarks,
          angles: angles,
          exerciseLabel: 'Analyzing...',
          postureQuality: 'unknown'
        });
      }

      setProcessingProgress((video.currentTime / video.duration) * 100);

      // Advance video by ~1/30th of a second
      video.currentTime += 0.033;
    } catch (err) {
      console.error("Frame processing error:", err);
      // Try to recover by skipping
      video.currentTime += 0.033;
    }
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleSeeked = () => {
      if (!isPaused) {
        processNextFrame();
      }
    };

    video.addEventListener('seeked', handleSeeked);
    return () => video.removeEventListener('seeked', handleSeeked);
  }, [isPaused, modelLoading]);

  useEffect(() => {
    if (videoFile && !isPaused && !modelLoading) {
      processNextFrame();
    }
  }, [videoFile, isPaused, modelLoading]);

  return (
    <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/5">
      <video
        ref={videoRef}
        className="hidden"
        playsInline
        muted
        preload="auto"
      />
      <canvas
        ref={canvasRef}
        width={1280}
        height={720}
        className="w-full h-full object-contain"
      />
    </div>
  );
}
