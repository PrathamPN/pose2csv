import { Landmark } from '../types';

export function calculateAngle(v1: Landmark, v2: Landmark, v3: Landmark): number {
  const radians = Math.atan2(v3.y - v2.y, v3.x - v2.x) - Math.atan2(v1.y - v2.y, v1.x - v2.x);
  let angle = Math.abs((radians * 180.0) / Math.PI);
  if (angle > 180.0) {
    angle = 360 - angle;
  }
  return angle;
}

export const JOINTS = {
  ELBOW_LEFT: [11, 13, 15],
  ELBOW_RIGHT: [12, 14, 16],
  SHOULDER_LEFT: [23, 11, 13],
  SHOULDER_RIGHT: [24, 12, 14],
  HIP_LEFT: [11, 23, 25],
  HIP_RIGHT: [12, 24, 26],
  KNEE_LEFT: [23, 25, 27],
  KNEE_RIGHT: [24, 26, 28],
} as const;

export function getJointAngles(landmarks: Landmark[]): Record<string, number> {
  const angles: Record<string, number> = {};
  
  Object.entries(JOINTS).forEach(([name, indices]) => {
    const [p1, p2, p3] = indices;
    if (landmarks[p1] && landmarks[p2] && landmarks[p3]) {
      angles[name] = calculateAngle(landmarks[p1], landmarks[p2], landmarks[p3]);
    }
  });

  return angles;
}

export class RepCounter {
  private count = 0;
  private stage: 'down' | 'up' | null = null;
  private thresholdDown: number;
  private thresholdUp: number;

  constructor(thresholdDown: number = 160, thresholdUp: number = 30) {
    this.thresholdDown = thresholdDown;
    this.thresholdUp = thresholdUp;
  }

  update(angle: number) {
    if (angle > this.thresholdDown) {
      this.stage = 'down';
    }
    if (angle < this.thresholdUp && this.stage === 'down') {
      this.stage = 'up';
      this.count++;
    }
  }

  getCount() {
    return this.count;
  }

  reset() {
    this.count = 0;
    this.stage = null;
  }
}
