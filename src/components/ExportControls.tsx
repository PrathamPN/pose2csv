import React from 'react';
import { Download, FileJson, FileSpreadsheet, FileText, Zap, Layout, Terminal, RotateCcw } from 'lucide-react';
import { FrameData } from '../types';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { showToast } from './Toast';
import { cn } from '../lib/utils';
import { prepareData, downloadFile, generateCSV } from '../utils/export';

interface ExportControlsProps {
  data: FrameData[];
  onReset: () => void;
  isLoading: boolean;
}

export function ExportControls({ data, onReset, isLoading }: ExportControlsProps) {
  const exportCSV = () => {
    try {
      generateCSV(data);
      showToast('CSV file generated and download started.', 'success');
    } catch (e) {
      showToast('Failed to generate CSV file.', 'error');
    }
  };

  const exportJSON = () => {
    try {
      downloadFile(JSON.stringify(data, null, 2), 'pose_dataset.json', 'application/json');
      showToast('JSON file generated and download started.', 'success');
    } catch (e) {
      showToast('Failed to generate JSON file.', 'error');
    }
  };

  const exportExcel = () => {
    try {
      const flattenedData = prepareData(data);
      const ws = XLSX.utils.json_to_sheet(flattenedData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "PoseData");
      XLSX.writeFile(wb, "pose_dataset.xlsx");
      showToast('Excel file generated and download started.', 'success');
    } catch (e) {
      showToast('Failed to generate Excel file.', 'error');
    }
  };

  // Preset: Google ML Kit (CSV for Classification)
  // Format: label,x0,y0,z0,x1,y1,z1...
  const exportMLKit = () => {
    try {
      const mlKitData = data.map(f => {
        const row: any = { label: f.exerciseLabel };
        f.landmarks.forEach((l, i) => {
          row[`x${i}`] = l.x.toFixed(4);
          row[`y${i}`] = l.y.toFixed(4);
          row[`z${i}`] = l.z.toFixed(4);
        });
        return row;
      });
      const csv = Papa.unparse(mlKitData);
      downloadFile(csv, 'mlkit_classification_dataset.csv', 'text/csv;charset=utf-8;');
      showToast('ML Kit CSV generated successfully.', 'success');
    } catch (e) {
      showToast('Failed to generate ML Kit format.', 'error');
    }
  };

  // Preset: OpenPose Compatible (JSON)
  const exportOpenPose = () => {
    try {
      const openPoseData = {
        version: 1.3,
        people: data.map(f => ({
          pose_keypoints_2d: f.landmarks.flatMap(l => [l.x, l.y, l.visibility]),
          face_keypoints_2d: [],
          hand_left_keypoints_2d: [],
          hand_right_keypoints_2d: [],
          pose_keypoints_3d: f.landmarks.flatMap(l => [l.x, l.y, l.z]),
          face_keypoints_3d: [],
          hand_left_keypoints_3d: [],
          hand_right_keypoints_3d: []
        }))
      };
      downloadFile(JSON.stringify(openPoseData, null, 2), 'openpose_dataset.json', 'application/json');
      showToast('OpenPose JSON generated successfully.', 'success');
    } catch (e) {
      showToast('Failed to generate OpenPose format.', 'error');
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Standard Formats</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={exportCSV}
            disabled={data.length === 0 || isLoading}
            className="px-2 py-2 border border-slate-200 rounded-lg text-[9px] font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 disabled:opacity-30 uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
          >
            <FileText className="w-3 h-3" />
            Raw CSV
          </button>
          <button
            onClick={exportExcel}
            disabled={data.length === 0 || isLoading}
            className="px-2 py-2 border border-slate-200 rounded-lg text-[9px] font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 disabled:opacity-30 uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
          >
            <FileSpreadsheet className="w-3 h-3" />
            XLSX
          </button>
          <button
            onClick={exportJSON}
            disabled={data.length === 0 || isLoading}
            className="px-2 py-2 border border-slate-200 rounded-lg text-[9px] font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 disabled:opacity-30 uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
          >
            <FileJson className="w-3 h-3" />
            JSON
          </button>
          <button
            onClick={onReset}
            disabled={isLoading}
            className="px-2 py-2 border border-slate-200 rounded-lg text-[9px] font-bold text-slate-400 bg-white hover:bg-slate-50 disabled:opacity-30 uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
        </div>
      </div>

      <div>
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">One-Click Presets</label>
        <div className="flex flex-col gap-2">
          <button
            onClick={exportMLKit}
            disabled={data.length === 0 || isLoading}
            className="w-full px-3 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-30 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-between group shadow-md shadow-indigo-100"
          >
            <div className="flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-indigo-200 group-hover:scale-110 transition-transform" />
              Google ML Kit Format
            </div>
            <Download className="w-3 h-3 opacity-50" />
          </button>

          <button
            onClick={exportOpenPose}
            disabled={data.length === 0 || isLoading}
            className="w-full px-3 py-2.5 bg-slate-800 hover:bg-slate-900 disabled:opacity-30 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-between group"
          >
            <div className="flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-slate-400 group-hover:scale-110 transition-transform" />
              OpenPose Compatible
            </div>
            <Download className="w-3 h-3 opacity-50" />
          </button>
        </div>
      </div>
    </div>
  );
}

