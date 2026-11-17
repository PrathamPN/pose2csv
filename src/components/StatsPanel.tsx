import React from 'react';
import { Activity, Target, Zap, ChevronRight } from 'lucide-react';
import { FrameData } from '../types';
import { cn } from '../lib/utils';

interface StatsPanelProps {
  currentFrame: FrameData | null;
  repCount: number;
}

export function StatsPanel({ currentFrame, repCount }: StatsPanelProps) {
  if (!currentFrame) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
      <StatCard
        icon={<Activity className="w-5 h-5 text-blue-500" />}
        label="Reps"
        value={repCount}
        unit="count"
      />
      <StatCard
        icon={<Target className="w-5 h-5 text-emerald-500" />}
        label="Posture"
        value={currentFrame.postureQuality.toUpperCase()}
        className={currentFrame.postureQuality === 'bad' ? 'text-red-500' : 'text-emerald-500'}
      />
      <StatCard
        icon={<Zap className="w-5 h-5 text-amber-500" />}
        label="Exercise"
        value={currentFrame.exerciseLabel}
        className="text-slate-800"
      />
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Angles</span>
        <div className="mt-2 space-y-1">
          {Object.entries(currentFrame.angles).slice(0, 3).map(([key, val]) => (
            <div key={key} className="flex justify-between text-xs">
              <span className="text-slate-500">{key.replace('_', ' ')}:</span>
              <span className="font-mono font-medium text-slate-900">{val.toFixed(1)}°</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, unit, className }: any) {
  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-4">
      <div className="p-2 bg-slate-50 rounded-lg">{icon}</div>
      <div className="flex flex-col">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</span>
        <div className="flex items-baseline space-x-1">
          <span className={cn("text-2xl font-bold tracking-tight", className || "text-slate-900")}>
            {value}
          </span>
          {unit && <span className="text-xs text-slate-400 font-medium">{unit}</span>}
        </div>
      </div>
    </div>
  );
}
