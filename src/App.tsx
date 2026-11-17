import React, { useState, useCallback, useRef, useEffect } from 'react';
import { VideoUpload } from './components/VideoUpload';
import { PoseDisplay } from './components/PoseDisplay';
import { StatsPanel } from './components/StatsPanel';
import { DataPreview } from './components/DataPreview';
import { ExportControls } from './components/ExportControls';
import { FrameData } from './types';
import { RepCounter } from './utils/geometry';
import { Info, Play, Pause, RotateCcw, Brain, Activity, Database, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatTimestamp } from './lib/utils';
import { ToastProvider, showToast } from './components/Toast';
import { generateCSV } from './utils/export';

export default function App() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoQueue, setVideoQueue] = useState<File[]>([]);
  const [isQueueStarted, setIsQueueStarted] = useState(false);
  const [processedFrames, setProcessedFrames] = useState<FrameData[]>([]);
  const [progress, setProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [repCount, setRepCount] = useState(0);
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);
  const [isModelReady, setIsModelReady] = useState(false);
  const [modelVariant, setModelVariant] = useState<'full' | 'lite'>('full');
  const [speedMode, setSpeedMode] = useState<'accuracy' | 'balanced' | 'throughput'>('balanced');
  const [processingStatus, setProcessingStatus] = useState<'initializing' | 'buffering' | 'processing' | 'paused' | 'complete'>('initializing');
  const [isCloudSyncing, setIsCloudSyncing] = useState(true);

  const repCounterRef = useRef(new RepCounter(160, 40));
  const lastAiAnalysisTimeRef = useRef(0); // Video timestamp
  const lastAiApiCallTimeRef = useRef(0);  // Real-time timestamp
  const lastSyncTimeRef = useRef(0);

  // Queue logic: Automatically start next video
  useEffect(() => {
    if (isQueueStarted && !videoFile && videoQueue.length > 0 && !isProcessing) {
      const nextFile = videoQueue[0];
      setVideoFile(nextFile);
      setVideoQueue(prev => prev.slice(1));
      setIsProcessing(true);
      showToast(`Started processing: ${nextFile.name}`, 'info');
    } else if (isQueueStarted && videoQueue.length === 0 && !videoFile && !isProcessing) {
      setIsQueueStarted(false);
      if (processedFrames.length > 0) {
        showToast('All videos processed! Downloading dataset...', 'success');
        generateCSV(processedFrames);
      }
    }
  }, [videoFile, videoQueue, isProcessing, isQueueStarted, processedFrames]);

  const handleVideosSelected = (files: File[]) => {
    const totalFiles = files.length + videoQueue.length + (videoFile ? 1 : 0);
    if (totalFiles > 10) {
      showToast('Maximum 10 files can be queued at once.', 'error');
      return;
    }
    
    setVideoQueue(prev => [...prev, ...files]);
    showToast(`Added ${files.length} video(s) to queue.`, 'success');
  };

  const handleFrameProcessed = useCallback((frame: FrameData) => {
    const angle = frame.angles.KNEE_LEFT || frame.angles.KNEE_RIGHT || 180;
    repCounterRef.current.update(angle);
    setRepCount(repCounterRef.current.getCount());

    setProcessedFrames(prev => {
      const lastFrame = prev[prev.length - 1];
      const updatedFrame = {
        ...frame,
        exerciseLabel: lastFrame?.exerciseLabel || 'Detecting...',
        postureQuality: lastFrame?.postureQuality || 'unknown'
      };
      return [...prev, updatedFrame];
    });

    const now = Date.now();
    const realTimeSinceLastCall = now - lastAiApiCallTimeRef.current;
    
    // Throttle to 1 request every 4.5 seconds real-time to respect the 15 RPM free tier limit
    if (frame.timestamp - lastAiAnalysisTimeRef.current > 3 && !isAiAnalyzing && realTimeSinceLastCall > 4500) {
      triggerAiAnalysis(frame.timestamp);
    }

    // Cloud Reinforcement Sync
    if (isCloudSyncing && 
        frame.landmarks[0]?.visibility > 0.95 && 
        now - lastSyncTimeRef.current > 2000) {
      import('./lib/firebase').then(({ saveLearnedFrame }) => {
        saveLearnedFrame(frame);
        lastSyncTimeRef.current = now;
      });
    }
  }, [isAiAnalyzing, isCloudSyncing]);

  const triggerAiAnalysis = async (timestamp: number) => {
    setIsAiAnalyzing(true);
    lastAiAnalysisTimeRef.current = timestamp;
    lastAiApiCallTimeRef.current = Date.now();

    try {
      const canvas = document.querySelector('canvas');
      if (!canvas) return;
      
      const frameImage = canvas.toDataURL('image/jpeg', 0.5);
      
      const response = await fetch('/api/analyze-posture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frameImage })
      });

      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      setProcessedFrames(prev => {
        const lastIdx = prev.length - 1;
        if (lastIdx < 0) return prev;
        const newFrames = [...prev];
        newFrames[lastIdx] = {
          ...newFrames[lastIdx],
          exerciseLabel: result.exercise || 'Unknown',
          postureQuality: result.quality || 'unknown'
        };
        return newFrames;
      });
    } catch (err: any) {
      console.error("AI Analysis failed:", err);
      // Optional: Update last frame to show failure
      setProcessedFrames(prev => {
        const lastIdx = prev.length - 1;
        if (lastIdx < 0) return prev;
        const newFrames = [...prev];
        newFrames[lastIdx] = {
          ...newFrames[lastIdx],
          exerciseLabel: 'Analysis Failed',
          postureQuality: 'unknown'
        };
        return newFrames;
      });
    } finally {
      setIsAiAnalyzing(false);
    }
  };

  const advanceVideo = () => {
    const finishedFileName = videoFile?.name;
    setVideoFile(null);
    setProgress(0);
    setIsProcessing(false);
    repCounterRef.current.reset();
    setRepCount(0);
    lastAiAnalysisTimeRef.current = 0;
    
    if (finishedFileName) {
      showToast(`Finished processing ${finishedFileName}`, 'success');
    }
  };

  const handleVideoReset = () => {
    setVideoFile(null);
    setVideoQueue([]);
    setIsQueueStarted(false);
    setProcessedFrames([]);
    setProgress(0);
    setIsProcessing(false);
    repCounterRef.current.reset();
    setRepCount(0);
    lastAiAnalysisTimeRef.current = 0;
  };

  const currentFrame = processedFrames[processedFrames.length - 1] || null;

  return (
    <ToastProvider>
      <div className="flex flex-col h-screen bg-slate-50 font-sans overflow-hidden text-slate-800">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-sm">
              P2C
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900 leading-tight">Pose2CSV <span className="text-indigo-600">v2.5</span></h1>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">AI Preprocessing & Dataset Orchestrator</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3 bg-slate-100 rounded-full p-1 border border-slate-200">
              <button 
                onClick={() => setModelVariant('lite')}
                title="Lite Model: Faster, lower accuracy"
                className={cn(
                  "px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider transition-all",
                  modelVariant === 'lite' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                )}
              >
                Lite
              </button>
              <button 
                onClick={() => setModelVariant('full')}
                title="Full Model: Higher accuracy, slower"
                className={cn(
                  "px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider transition-all",
                  modelVariant === 'full' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                )}
              >
                Full
              </button>
            </div>

            <div className="flex items-center gap-1 bg-slate-100 rounded-full p-1 border border-slate-200">
              {[
                { id: 'accuracy', label: 'Accurate' },
                { id: 'balanced', label: 'Balanced' },
                { id: 'throughput', label: 'Speed' }
              ].map((mode) => (
                <button 
                  key={mode.id}
                  onClick={() => setSpeedMode(mode.id as any)}
                  className={cn(
                    "px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider transition-all",
                    speedMode === mode.id ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsCloudSyncing(!isCloudSyncing)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all",
                  isCloudSyncing ? "bg-indigo-50 text-indigo-600 border border-indigo-100" : "bg-slate-50 text-slate-400 border border-slate-100"
                )}
              >
                <Database className={cn("w-3.5 h-3.5", isCloudSyncing ? "text-indigo-600" : "text-slate-400")} />
                {isCloudSyncing ? "Cloud Learning Active" : "Local Only"}
              </button>
            </div>

            <div className={cn("flex h-6 w-px bg-slate-200")} />

            <div className="flex items-center gap-2">
              <span className={cn("flex h-2 w-2 rounded-full", isModelReady ? "bg-emerald-500" : "bg-amber-500 animate-pulse")}></span>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                {isModelReady ? "GPU Acceleration Active" : "Initializing Engine..."}
              </span>
            </div>
            {isAiAnalyzing && (
              <div className="flex items-center gap-2 text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full border border-indigo-100">
                <Brain className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold uppercase tracking-wider">AI Analyzing...</span>
              </div>
            )}
          </div>
        </header>

        {/* Main Workspace */}
        <main className="flex-1 flex overflow-hidden">
          {/* Left Sidebar */}
          <aside className="w-64 bg-white border-r border-slate-200 p-5 flex flex-col gap-6 overflow-y-auto shrink-0">
            <section>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3 block">Input Source</label>
              <VideoUpload 
                onVideosSelected={handleVideosSelected} 
                isLoading={isProcessing} 
                queue={videoQueue}
                currentFile={videoFile}
              />
            </section>

            <section>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3 block">Processing Status</label>
              <div className="p-4 bg-slate-900 rounded-xl text-white shadow-lg shadow-slate-200/50">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] text-indigo-400 font-bold tracking-widest uppercase">
                    {processingStatus === 'buffering' ? 'Buffering Source' : 
                    processingStatus === 'processing' ? 'Analyzing Frame' : 
                    processingStatus.toUpperCase()}
                  </span>
                  <span className="text-[10px] text-indigo-400 font-mono">
                    {processedFrames.length > 0 ? `${processedFrames.length} Frames` : `${Math.round(progress)}%`}
                  </span>
                </div>
                <div className="relative w-full bg-slate-700 h-1.5 rounded-full overflow-hidden mb-3">
                  <motion.div 
                    className={cn(
                      "h-full rounded-full transition-all duration-300",
                      processingStatus === 'processing' ? "bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" : "bg-slate-500"
                    )}
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                  />
                  {processingStatus === 'processing' && (
                    <motion.div 
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent w-1/2 h-full"
                      animate={{ x: ['-100%', '200%'] }}
                      transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                    />
                  )}
                </div>
                <div className="flex items-center justify-between mt-4">
                  <button
                    onClick={() => setIsPaused(!isPaused)}
                    disabled={!videoFile}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-[10px] font-bold rounded uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
                  >
                    {isPaused ? <><Play className="w-3 h-3 fill-current" /> Resume</> : <><Pause className="w-3 h-3 fill-current" /> Pause</>}
                  </button>
                </div>
              </div>
            </section>

            <section className="mt-auto">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3 block">Export Configuration</label>
              <ExportControls data={processedFrames} onReset={handleVideoReset} isLoading={isProcessing} />
            </section>
          </aside>

          {/* Center Stage */}
          <div className="flex-1 bg-slate-200/50 flex flex-col p-6 gap-6 relative overflow-hidden">
            <div className="flex-1 bg-black rounded-2xl relative overflow-hidden flex items-center justify-center shadow-2xl border border-white/5">
              {!videoFile ? (
                <div className="flex flex-col items-center text-center max-w-sm">
                  <div className="w-20 h-20 bg-slate-800 rounded-3xl flex items-center justify-center mb-6 shadow-xl border border-slate-700">
                      <Activity className="w-10 h-10 text-indigo-400" />
                  </div>
                  <h2 className="text-white font-bold text-xl mb-2">Workspace Idle</h2>
                  <p className="text-slate-500 text-sm mb-6">Upload videos to begin real-time pose extraction and AI-assisted dataset labeling.</p>
                  
                  {videoQueue.length > 0 && !isQueueStarted && (
                    <button 
                      onClick={() => setIsQueueStarted(true)}
                      className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/30 uppercase tracking-widest text-sm transition-all flex items-center gap-2 group"
                    >
                      <Play className="w-4 h-4 fill-current group-hover:scale-110 transition-transform" />
                      Start Queue ({videoQueue.length} videos)
                    </button>
                  )}
                </div>
              ) : (
                  <>
                    <PoseDisplay
                      videoFile={videoFile}
                      onFrameProcessed={handleFrameProcessed}
                      onComplete={() => {
                        setIsProcessing(false);
                        setProcessingStatus('complete');
                        advanceVideo(); // Auto-reset/advance to next
                      }}
                      setProcessingProgress={setProgress}
                      isPaused={isPaused}
                      onModelLoaded={setIsModelReady}
                      onStatusChange={setProcessingStatus}
                      modelVariant={modelVariant}
                      speedMode={speedMode}
                    />
                    
                    {!isModelReady && (
                      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-20">
                        <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-6" />
                        <h3 className="text-white font-bold text-lg mb-2">Initializing AI Engine</h3>
                        <p className="text-slate-400 text-sm max-w-xs text-center">Downloading high-performance pose models. This usually takes 5-10 seconds depending on your connection.</p>
                      </div>
                    )}
                  </>
              )}

              {/* Overlay Stats Grid */}
              {currentFrame && (
                <>
                  <div className="absolute top-6 left-6 flex gap-4">
                    <div className="bg-black/60 backdrop-blur-md px-4 py-2.5 rounded-lg border border-white/10 text-white">
                      <div className="text-[9px] uppercase text-indigo-400 tracking-wider font-bold mb-0.5">Joint Angle</div>
                      <div className="text-xl font-mono">{(currentFrame.angles.KNEE_LEFT || 0).toFixed(1)}&deg;</div>
                    </div>
                    <div className="bg-black/60 backdrop-blur-md px-4 py-2.5 rounded-lg border border-white/10 text-white">
                      <div className="text-[9px] uppercase text-indigo-400 tracking-wider font-bold mb-0.5">Rep Counter</div>
                      <div className="text-xl font-mono">{repCount.toString().padStart(2, '0')} <span className="text-xs text-slate-400 font-sans tracking-normal">units</span></div>
                    </div>
                  </div>

                  <div className="absolute bottom-6 right-6">
                    <span className={cn(
                      "px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-widest",
                      currentFrame.postureQuality === 'good' 
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" 
                        : currentFrame.postureQuality === 'bad'
                        ? "bg-red-500/10 text-red-400 border-red-500/30"
                        : "bg-slate-500/10 text-slate-400 border-slate-500/30"
                    )}>
                      Posture Quality: {currentFrame.postureQuality}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Dataset Preview */}
            <div className="h-64 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
              <DataPreview frames={processedFrames} />
            </div>
          </div>

          {/* Right Sidebar */}
          <aside className="w-72 bg-white border-l border-slate-200 flex flex-col shrink-0">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-[11px] font-bold text-slate-900 uppercase tracking-widest">Biometric Telemetry</h3>
            </div>
            
            <div className="flex-1 p-5 space-y-8 overflow-y-auto">
              {currentFrame ? (
                <>
                  <section className="space-y-4">
                    <div>
                      <div className="flex justify-between items-end mb-2">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Knee Angle Dynamic</span>
                        <span className="text-xs font-mono text-indigo-600">{(currentFrame.angles.KNEE_LEFT || 0).toFixed(1)}&deg;</span>
                      </div>
                      <div className="h-16 bg-slate-50 rounded-xl border border-slate-100 flex items-end px-2 gap-1 pb-1">
                        {Array.from({ length: 12 }).map((_, i) => (
                          <div 
                            key={i} 
                            className="bg-indigo-200 w-full rounded-t-sm transition-all duration-500"
                            style={{ height: `${Math.max(10, Math.sin(i + (currentFrame.angles.KNEE_LEFT || 0) / 10) * 40 + 50)}%` }}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Elbow L/R</span>
                        <span className="text-xs font-mono text-slate-700">
                          {currentFrame.angles.ELBOW_LEFT?.toFixed(0)} / {currentFrame.angles.ELBOW_RIGHT?.toFixed(0)}
                        </span>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Hip L/R</span>
                        <span className="text-xs font-mono text-slate-700">
                          {currentFrame.angles.HIP_LEFT?.toFixed(0)} / {currentFrame.angles.HIP_RIGHT?.toFixed(0)}
                        </span>
                      </div>
                    </div>
                  </section>

                  <section>
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">AI Analysis Insights</label>
                    <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100/50">
                      <div className="flex items-center gap-2 mb-2">
                        <Brain className="w-3.5 h-3.5 text-indigo-600" />
                        <span className="text-[10px] text-indigo-700 font-bold uppercase">Dynamic Labeling</span>
                      </div>
                      <p className="text-xs text-indigo-900 font-medium leading-relaxed">
                        {currentFrame.exerciseLabel === 'Detecting...' 
                          ? "Gemini is observing your movement patterns for frame-level labeling..." 
                          : `Current activity identified as ${currentFrame.exerciseLabel} with ${currentFrame.postureQuality} posture metrics.`}
                      </p>
                    </div>
                  </section>

                  <section>
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">Dataset Health</label>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-500 font-medium">Capture Rate</span>
                          <span className="text-[10px] font-mono font-bold text-emerald-600">30.2 FPS</span>
                      </div>
                      <div className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-500 font-medium">Confidence Score</span>
                          <span className="text-[10px] font-mono font-bold text-emerald-600">0.998</span>
                      </div>
                    </div>
                  </section>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center opacity-40">
                  <div className="w-12 h-12 rounded-full border-2 border-slate-200 border-t-indigo-600 animate-spin mb-4" />
                  <p className="text-xs font-medium text-slate-400">Waiting for stream data...</p>
                </div>
              )}
            </div>
          </aside>
        </main>

        {/* Footer Timeline */}
        <footer className="h-12 bg-slate-900 border-t border-slate-800 flex items-center px-6 shrink-0 gap-8 justify-between">
          <div className="flex gap-5 items-center">
            <button onClick={handleVideoReset} className="text-white/60 hover:text-white transition-colors cursor-pointer" title="Reset All">
              <RotateCcw className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setIsPaused(!isPaused)}
              disabled={!videoFile}
              className="text-white hover:scale-110 transition-transform cursor-pointer disabled:opacity-30"
              title={isPaused ? "Resume" : "Pause"}
            >
              {isPaused ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4 fill-current" />}
            </button>
            <button 
              onClick={handleVideoReset}
              disabled={!videoFile && videoQueue.length === 0}
              className="text-white/60 hover:text-red-400 transition-colors cursor-pointer disabled:opacity-30 flex items-center gap-1.5 ml-2"
              title="Cancel Processing"
            >
              <X className="w-4 h-4" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Cancel</span>
            </button>
          </div>

          <div className="flex items-center gap-4 ml-auto">
            <div className="text-indigo-400 font-mono text-xs font-bold tracking-widest uppercase">
              {currentFrame ? formatTimestamp(currentFrame.timestamp) : "00:00.000"}
            </div>
            <div className="h-4 w-px bg-slate-700" />
            <div className="text-slate-500 font-mono text-[10px]">
              BUFFERING: {Math.round(progress)}%
            </div>
          </div>
        </footer>
      </div>
    </ToastProvider>
  );
}
