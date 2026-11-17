import React, { useState } from 'react';
import { FrameData } from '../types';
import { formatTimestamp, cn } from '../lib/utils';
import { Eye, Terminal, Search, Filter, Layers, Database } from 'lucide-react';

interface DataPreviewProps {
  frames: FrameData[];
}

export function DataPreview({ frames }: DataPreviewProps) {
  const [viewType, setViewType] = useState<'angles' | 'raw'>('angles');
  const [searchQuery, setSearchQuery] = useState('');

  if (frames.length === 0) return null;

  const filteredFrames = frames
    .filter(f => (f.exerciseLabel || '').toLowerCase().includes(searchQuery.toLowerCase()))
    .reverse();

  const recentFrames = filteredFrames.slice(0, 50);

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-col gap-3 shrink-0">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Dataset Intelligence</span>
            <div className="flex items-center gap-2">
              <span className="flex h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
              <span className="text-[10px] font-mono text-slate-400">Index {frames.length}</span>
            </div>
          </div>
          
          <div className="flex bg-slate-200 rounded-lg p-0.5 shadow-inner">
            <button 
              onClick={() => setViewType('angles')}
              className={cn(
                "px-2.5 py-1 rounded-md text-[9px] font-bold uppercase transition-all flex items-center gap-1.5",
                viewType === 'angles' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              <Database className="w-3 h-3" />
              Kinematics
            </button>
            <button 
              onClick={() => setViewType('raw')}
              className={cn(
                "px-2.5 py-1 rounded-md text-[9px] font-bold uppercase transition-all flex items-center gap-1.5",
                viewType === 'raw' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              <Layers className="w-3 h-3" />
              Raw Poses
            </button>
          </div>
        </div>

        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
          <input 
            type="text"
            placeholder="Filter by label (e.g. Squat, Deadlift)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-4 py-1.5 text-[11px] placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans"
          />
        </div>
      </div>
      
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse text-[10px]">
          <thead className="sticky top-0 bg-slate-50/95 backdrop-blur-sm z-10">
            <tr className="text-slate-400 font-bold border-b border-slate-100">
              <th className="px-4 py-2 font-mono uppercase tracking-tighter w-16">Frame</th>
              <th className="px-4 py-2 font-mono uppercase tracking-tighter w-20">Time</th>
              <th className="px-4 py-2 uppercase tracking-tighter">Label</th>
              {viewType === 'angles' ? (
                <>
                  <th className="px-4 py-2 font-mono uppercase tracking-tighter">L_Elbow</th>
                  <th className="px-4 py-2 font-mono uppercase tracking-tighter">L_Knee</th>
                  <th className="px-4 py-2 font-mono uppercase tracking-tighter">Hip_Ang</th>
                </>
              ) : (
                <>
                  <th className="px-4 py-2 font-mono uppercase tracking-tighter">Nose_XY</th>
                  <th className="px-4 py-2 font-mono uppercase tracking-tighter">Shoulder_R</th>
                  <th className="px-4 py-2 font-mono uppercase tracking-tighter">Wrist_L</th>
                </>
              )}
              <th className="px-4 py-2 uppercase tracking-tighter text-right">Confidence</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 font-mono text-slate-600">
            {recentFrames.map((frame, idx) => (
              <tr key={idx} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-2 text-indigo-600 font-bold">
                  {frame.frameIndex.toString().padStart(4, '0')}
                </td>
                <td className="px-4 py-2 text-slate-400">
                  {frame.timestamp.toFixed(3)}s
                </td>
                <td className="px-4 py-2">
                  <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded font-sans font-bold uppercase text-[9px]">
                    {frame.exerciseLabel}
                  </span>
                </td>
                
                {viewType === 'angles' ? (
                  <>
                    <td className="px-4 py-2">{frame.angles.ELBOW_LEFT?.toFixed(1) || '0.0'}&deg;</td>
                    <td className="px-4 py-2">{frame.angles.KNEE_LEFT?.toFixed(1) || '0.0'}&deg;</td>
                    <td className="px-4 py-2">{frame.angles.HIP_LEFT?.toFixed(1) || '0.0'}&deg;</td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-2">
                       {frame.landmarks[0]?.x.toFixed(2)}, {frame.landmarks[0]?.y.toFixed(2)}
                    </td>
                    <td className="px-4 py-2">
                       {frame.landmarks[12]?.x.toFixed(2)}, {frame.landmarks[12]?.y.toFixed(2)}
                    </td>
                    <td className="px-4 py-2">
                       {frame.landmarks[15]?.x.toFixed(2)}, {frame.landmarks[15]?.y.toFixed(2)}
                    </td>
                  </>
                )}
                
                <td className="px-4 py-2 text-right">
                  <span className={cn(
                    "px-1.5 py-0.5 rounded font-sans text-[8px] font-bold uppercase",
                    frame.postureQuality === 'good' ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                  )}>
                    {(frame.landmarks[0]?.visibility * 100).toFixed(0)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
