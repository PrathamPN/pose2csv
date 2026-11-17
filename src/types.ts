export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

export interface FrameData {
  frameIndex: number;
  timestamp: number;
  landmarks: Landmark[];
  angles: Record<string, number>;
  exerciseLabel: string;
  postureQuality: 'good' | 'bad' | 'unknown';
}

export interface ProcessingState {
  isProcessing: boolean;
  progress: number;
  currentFrame: number;
  totalFrames: number;
}
