import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Video, FileVideo } from 'lucide-react';
import { cn } from '../lib/utils';

interface VideoUploadProps {
  onVideosSelected: (files: File[]) => void;
  isLoading: boolean;
  queue: File[];
  currentFile: File | null;
}

export function VideoUpload({ onVideosSelected, isLoading, queue, currentFile }: VideoUploadProps) {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      onVideosSelected(acceptedFiles);
    }
  }, [onVideosSelected]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/*': ['.mp4', '.mov', '.avi', '.webm']
    },
    maxFiles: 10,
    multiple: true,
    disabled: isLoading && queue.length >= 10
  } as any);

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={cn(
          "relative group flex flex-col items-center justify-center w-full min-h-[140px] border-2 border-dashed rounded-xl transition-all duration-300 cursor-pointer overflow-hidden",
          isDragActive ? "border-indigo-500 bg-indigo-50/50" : "border-slate-200 bg-slate-50 hover:border-indigo-400 hover:bg-slate-100",
          (isLoading && queue.length >= 10) && "opacity-50 cursor-not-allowed pointer-events-none"
        )}
      >
        <input {...getInputProps()} />
        
        <div className="flex flex-col items-center p-6 text-center">
          <div className="w-10 h-10 rounded-full bg-white shadow-sm border border-slate-100 flex items-center justify-center text-indigo-600 mb-3 group-hover:scale-110 transition-transform">
            {isDragActive ? <FileVideo className="w-5 h-5" /> : <Upload className="w-5 h-5" />}
          </div>
          
          <p className="text-xs font-bold text-slate-600 uppercase tracking-tight">
            {isDragActive ? "Drop Videos" : "Queue Source Videos"}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">MP4, MOV, WebM (Max 10 files)</p>
        </div>
      </div>

      {(queue.length > 0 || currentFile) && (
        <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-2 bg-slate-100 border-b border-slate-200 flex justify-between items-center">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Processing Queue</span>
            <span className="text-[10px] font-mono text-indigo-600 font-bold">{queue.length + (currentFile ? 1 : 0)} Total</span>
          </div>
          <div className="p-2 space-y-1">
            {currentFile && (
              <div className="flex items-center gap-3 p-2 bg-white rounded-lg border border-indigo-100 shadow-sm ring-1 ring-indigo-500/10">
                <div className="w-6 h-6 rounded-md bg-indigo-50 flex items-center justify-center">
                  <Video className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-slate-700 truncate uppercase tracking-tight">Processing: {currentFile.name}</p>
                  <div className="w-full h-1 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
                    <div className="h-full bg-indigo-500 animate-[shimmer_2s_infinite] w-[40%]" />
                  </div>
                </div>
              </div>
            )}
            {queue.map((file, idx) => (
              <div key={idx} className="flex items-center gap-3 p-2 bg-slate-100/50 rounded-lg border border-transparent">
                <div className="w-6 h-6 rounded-md bg-white flex items-center justify-center border border-slate-200">
                  <Video className="w-3.5 h-3.5 text-slate-400" />
                </div>
                <p className="text-[10px] font-medium text-slate-500 truncate uppercase tracking-tight">Pending: {file.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
