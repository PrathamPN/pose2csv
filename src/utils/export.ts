import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { FrameData } from '../types';

export const prepareData = (data: FrameData[]) => {
  return data.map(f => {
    const flattened: any = {
      frame_index: f.frameIndex,
      timestamp: f.timestamp,
      exercise: f.exerciseLabel,
      quality: f.postureQuality,
    };

    f.landmarks.forEach((l, i) => {
      flattened[`lm_${i}_x`] = l.x;
      flattened[`lm_${i}_y`] = l.y;
      flattened[`lm_${i}_z`] = l.z;
      flattened[`lm_${i}_vis`] = l.visibility;
    });

    Object.entries(f.angles).forEach(([name, angle]) => {
      flattened[`angle_${name.toLowerCase()}`] = angle;
    });

    return flattened;
  });
};

export const downloadFile = (content: string, fileName: string, type: string) => {
  const blob = new Blob([content], { type });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const generateCSV = (data: FrameData[]) => {
  const csvData = prepareData(data);
  const csv = Papa.unparse(csvData);
  downloadFile(csv, 'pose_dataset.csv', 'text/csv;charset=utf-8;');
};
