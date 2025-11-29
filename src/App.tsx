import React, { useState, useRef, useEffect } from 'react';
import { 
  PlayIcon, PauseIcon, LoopIcon, UploadIcon, 
  RecordIcon, StopIcon, SparklesIcon, VolumeIcon, ZoomIcon, ResetIcon,
  ShareIcon, BookOpenIcon, CheckIcon
} from './components/Icons';
// FORCE_DEPLOY_TIMESTAMP: V_CLEAN_REBOOT_01
import type { LoopRegion, RecordingSession } from './types';
import { getPracticeAdvice } from './services/geminiService';

const App: React.FC = () => {
  // --- State: Media Source ---
  const [mediaSrc, setMediaSrc] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'video' | 'audio'>('video');
  const [fileName, setFileName] = useState<string>('');
  
  // --- State: Playback Control ---
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [volume, setVolume] = useState(1);
  
  // --- State: Zoom & Pan ---
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number, y: number }>({ x: 0, y: 0 });

  // --- State: Looping ---
  const [loopRegion, setLoopRegion] = useState<LoopRegion | null>(null);
  const [isLooping, setIsLooping] = useState(false);
  
  // --- State: Recording ---
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSession, setRecordingSession] = useState<RecordingSession | null>(null);
  const [recorderMediaType, setRecorderMediaType] = useState<'video' | 'audio'>('audio');
  
  // --- State: Comparison Mode ---
  const [comparisonMode, setComparisonMode] = useState(false);
  const [comparisonState, setComparisonState] = useState<'idle' | 'playingRef' | 'waiting' | 'playingRec'>('idle');

  // --- State: AI ---
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // --- State: Settings & Help ---
  const [showSettings, setShowSettings] = useState(false);
  const [showCopyFeedback, setShowCopyFeedback] = useState(false);

  // --- Refs ---
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement>(null);
  const recordingRef = useRef<HTMLVideoElement | HTMLAudioElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const videoPreviewRef = useRef<HTMLVideoElement>(null); // For camera preview

  // --- Effects ---
  useEffect(() => {
    if (mediaRef.current) {
      mediaRef.current.volume = volume;
    }
  }, [volume]);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (mediaSrc) URL.revokeObjectURL(mediaSrc);
      if (recordingSession) URL.revokeObjectURL(recordingSession.url);
    };
  }, []);

  // --- Handlers: File Upload ---
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setMediaSrc(url);
      setMediaType(file.type.startsWith('audio') ? 'audio' : 'video');
      setFileName(file.name);
      setLoopRegion(null);
      setIsLooping(false);
      setRecordingSession(null);
      setComparisonMode(false);
      setZoom(1);
      setPan({ x: 0, y: 0 });
    }
  };

  // --- Handlers: Playback ---
  const togglePlay = () => {
    if (!mediaRef.current) return;
    if (isPlaying) {
      mediaRef.current.pause();
    } else {
      mediaRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (!mediaRef.current) return;
    const curr = mediaRef.current.currentTime;
    setCurrentTime(curr);

    // Loop Logic
    if (isLooping && loopRegion && !comparisonMode) {
      if (curr >= loopRegion.end) {
        mediaRef.current.currentTime = loopRegion.start;
        mediaRef.current.play(); // Ensure it keeps playing
      }
    }

    // Comparison Logic: End of Reference Segment
    if (comparisonMode && comparisonState === 'playingRef' && loopRegion) {
      if (curr >= loopRegion.end) {
        mediaRef.current.pause();
        setIsPlaying(false); // Update UI
        setComparisonState('playingRec');
        
        // Start User Recording Playback
        if (recordingRef.current) {
          recordingRef.current.currentTime = 0;
          recordingRef.current.play();
        }
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (mediaRef.current) {
      setDuration(mediaRef.current.duration);
      mediaRef.current.volume = volume;
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    if (mediaRef.current) {
      mediaRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  // --- Handlers: Zoom & Pan ---
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      setIsDragging(true);
      // Store initial offset
      dragStartRef.current = { 
        x: e.clientX - pan.x, 
        y: e.clientY - pan.y 
      };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      e.preventDefault();
      setPan({
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleZoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newZoom = Number(e.target.value);
    setZoom(newZoom);
    if (newZoom === 1) {
      setPan({ x: 0, y: 0 });
    }
  };

  const resetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };


  // --- Handlers: Looping ---
  const setLoopStart = () => {
    if (!mediaRef.current) return;
    const current = mediaRef.current.currentTime;
    setLoopRegion(prev => ({
      start: current,
      end: prev ? Math.max(prev.end, current + 1) : duration || current + 5
    }));
    setIsLooping(true);
  };

  const setLoopEnd = () => {
    if (!mediaRef.current) return;
    const current = mediaRef.current.currentTime;
    setLoopRegion(prev => ({
      start: prev ? Math.min(prev.start, current - 1) : 0,
      end: current
    }));
    setIsLooping(true);
    // Automatically jump to start to test loop
    if (loopRegion) {
        mediaRef.current.currentTime = loopRegion.start; 
    }
  };

  const clearLoop = () => {
    setLoopRegion(null);
    setIsLooping(false);
  };

  // --- Handlers: Speed & Volume ---
  const changePlaybackRate = (rate: number) => {
    setPlaybackRate(rate);
    if (mediaRef.current) {
      mediaRef.current.playbackRate = rate;
    }
  };

  // --- Handlers: Recording ---
  const startRecording = async () => {
    setComparisonMode(false); // Disable comparison while recording
    try {
      const constraints = recorderMediaType === 'video' 
        ? { video: true, audio: true } 
        : { audio: true };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (recorderMediaType === 'video' && videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.muted = true; // Avoid feedback loop
        videoPreviewRef.current.play();
      }

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorderMediaType === 'video' ? 'video/webm' : 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setRecordingSession({ blob, url, timestamp: Date.now() });
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
        if (videoPreviewRef.current) {
            videoPreviewRef.current.srcObject = null;
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing media devices:", err);
      alert("Microphone/Camera access denied or unavailable.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // --- Handlers: Comparison ---
  const startComparison = () => {
    if (!mediaRef.current || !recordingRef.current || !loopRegion) {
      alert("Please select a loop region and record a take first.");
      return;
    }

    setComparisonMode(true);
    setComparisonState('playingRef');
    
    // Setup Reference
    mediaRef.current.currentTime = loopRegion.start;
    mediaRef.current.play();
    setIsPlaying(true);
  };

  const stopComparison = () => {
    setComparisonMode(false);
    setComparisonState('idle');
    if (mediaRef.current) mediaRef.current.pause();
    if (recordingRef.current) recordingRef.current.pause();
    setIsPlaying(false);
  };

  // --- Handlers: AI ---
  const handleAskAI = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    setAiResponse(null);
    const context = `Playing ${fileName}. ${loopRegion ? `Working on a specific section from ${loopRegion.start.toFixed(1)}s to ${loopRegion.end.toFixed(1)}s.` : ''}`;
    const response = await getPracticeAdvice(aiPrompt, context);
    setAiResponse(response);
    setAiLoading(false);
    setAiPrompt('');
  };

  // --- Handlers: Settings & Sharing ---
  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShowCopyFeedback(true);
      setTimeout(() => setShowCopyFeedback(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  // Format time helper
  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-virtuoso-900 text-gray-100 flex flex-col font-sans">
      {/* Header */}
      <header className="h-16 border-b border-virtuoso-700 bg-virtuoso-800/50 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-virtuoso-accent to-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
            <span className="text-white font-bold text-lg">V</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white hidden sm:block">Virtuoso App</h1>
        </div>
        <div className="flex items-center gap-3">
           {/* File Input */}
           <label className="flex items-center gap-2 cursor-pointer bg-virtuoso-700 hover:bg-virtuoso-600 px-4 py-2 rounded-full transition-all text-sm font-medium shadow-md border border-white/5">
            <UploadIcon className="w-4 h-4" />
            <span className="max-w-[100px] truncate md:max-w-xs">{fileName || "Load File"}</span>
            <input type="file" onChange={handleFileUpload} accept="audio/*,video/*" className="hidden" />
          </label>
          
          <div className="h-6 w-px bg-virtuoso-700 mx-1"></div>

          {/* Share Button */}
          <button 
            onClick={handleShare}
            className="p-2 text-gray-400 hover:text-virtuoso-accent transition-colors relative"
            title="Share this tool"
          >
            {showCopyFeedback ? <CheckIcon className="w-6 h-6 text-green-400" /> : <ShareIcon className="w-6 h-6" />}
            {showCopyFeedback && (
              <div className="absolute top-full right-0 mt-2 bg-green-500 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap">
                Link Copied!
              </div>
            )}
          </button>

          {/* Guide Button */}
          <button 
            onClick={() => setShowSettings(true)}
            className="p-2 text-gray-400 hover:text-white transition-colors"
            title="User Guide"
          >
            <BookOpenIcon className="w-6 h-6" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-7xl mx-auto w-full">
        
        {/* Left Column: Reference Player (8/12 cols) */}
        <section className="lg:col-span-8 flex flex-col gap-4">
          
          {/* Main Player Display */}
          <div 
            className="relative aspect-video bg-black rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10 group select-none"
            onMouseDown={mediaType === 'video' ? handleMouseDown : undefined}
            onMouseMove={mediaType === 'video' ? handleMouseMove : undefined}
            onMouseUp={mediaType === 'video' ? handleMouseUp : undefined}
            onMouseLeave={mediaType === 'video' ? handleMouseUp : undefined}
          >
            {!mediaSrc ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-virtuoso-700 p-6 text-center">
                <UploadIcon className="w-16 h-16 mb-4 opacity-50" />
                <p className="text-lg font-medium text-gray-400">Drag & Drop or Click "Load File"</p>
                <p className="text-sm text-gray-500 mt-2">Supports MP4, MP3, MOV, WAV</p>
              </div>
            ) : (
              mediaType === 'video' ? (
                <div className="w-full h-full overflow-hidden">
                  <video 
                    ref={mediaRef as React.RefObject<HTMLVideoElement>}
                    src={mediaSrc}
                    className="w-full h-full object-contain transition-transform duration-75"
                    style={{
                      transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                      cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'
                    }}
                    onClick={zoom === 1 ? togglePlay : undefined} // Only toggle play on click if not zoomed
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={handleLoadedMetadata}
                  />
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-virtuoso-800">
                   <div className="text-6xl animate-pulse text-virtuoso-accent">♫</div>
                   <audio 
                     ref={mediaRef as React.RefObject<HTMLAudioElement>}
                     src={mediaSrc}
                     onTimeUpdate={handleTimeUpdate}
                     onLoadedMetadata={handleLoadedMetadata}
                   />
                </div>
              )
            )}

            {/* Loop Overlay Indicators */}
            {loopRegion && (
               <div className="absolute top-4 left-4 flex gap-2 pointer-events-none">
                 <div className="bg-virtuoso-gold/90 text-black px-2 py-1 rounded text-xs font-bold uppercase flex items-center gap-1 shadow-lg">
                   <LoopIcon className="w-3 h-3" />
                   {formatTime(loopRegion.start)} - {formatTime(loopRegion.end)}
                 </div>
               </div>
            )}
            
            {/* Zoom Indicator (when zoomed) */}
            {zoom > 1 && (
               <div className="absolute top-4 right-4 bg-black/60 backdrop-blur text-white px-2 py-1 rounded text-xs font-bold pointer-events-none">
                 {zoom.toFixed(1)}x
               </div>
            )}
          </div>

          {/* Timeline & Controls */}
          <div className="bg-virtuoso-800 p-4 rounded-xl border border-virtuoso-700 shadow-lg">
            {/* Scrubber */}
            <div className="relative h-10 flex items-center mb-2">
              <input 
                type="range" 
                min={0} 
                max={duration} 
                step={0.01}
                value={currentTime} 
                onChange={handleSeek}
                className="w-full h-2 bg-virtuoso-700 rounded-lg appearance-none cursor-pointer accent-virtuoso-accent hover:accent-blue-400 transition-all z-10"
              />
              {/* Loop Visual Markers on Timeline */}
              {loopRegion && (
                <>
                  <div 
                    className="absolute h-2 bg-virtuoso-gold/30 pointer-events-none top-4 z-0 rounded-l"
                    style={{ 
                      left: `${(loopRegion.start / duration) * 100}%`,
                      width: `${((loopRegion.end - loopRegion.start) / duration) * 100}%`
                    }}
                  />
                  {/* Start Marker */}
                  <div 
                    className="absolute w-1 h-4 bg-virtuoso-gold top-3 z-0 pointer-events-none"
                    style={{ left: `${(loopRegion.start / duration) * 100}%` }}
                  />
                   {/* End Marker */}
                   <div 
                    className="absolute w-1 h-4 bg-virtuoso-gold top-3 z-0 pointer-events-none"
                    style={{ left: `${(loopRegion.end / duration) * 100}%` }}
                  />
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4">
              
              {/* Left Group: Playback & Volume */}
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <button 
                    onClick={togglePlay} 
                    disabled={!mediaSrc}
                    className="w-10 h-10 bg-virtuoso-accent hover:bg-blue-400 text-virtuoso-900 rounded-full flex items-center justify-center transition-transform hover:scale-105 disabled:opacity-50 disabled:scale-100 shadow-lg shadow-blue-500/20"
                  >
                    {isPlaying ? <PauseIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5" />}
                  </button>
                  <div className="text-xs font-mono text-gray-400 w-20">
                    {formatTime(currentTime)} <span className="text-gray-600">/</span> {formatTime(duration)}
                  </div>
                </div>

                {/* Volume Control */}
                <div className="flex items-center gap-2 group">
                  <VolumeIcon className="w-4 h-4 text-gray-400 group-hover:text-virtuoso-accent transition-colors" />
                  <input 
                    type="range" 
                    min={0} 
                    max={1} 
                    step={0.01}
                    value={volume}
                    onChange={(e) => setVolume(Number(e.target.value))}
                    className="w-20 h-1 bg-virtuoso-700 rounded-lg appearance-none cursor-pointer accent-gray-400 hover:accent-virtuoso-accent transition-all"
                  />
                </div>
              </div>

              {/* Middle Group: Loop Controls */}
              <div className="flex items-center bg-virtuoso-900/50 rounded-lg p-1 border border-virtuoso-700">
                <button 
                  onClick={setLoopStart} 
                  disabled={!mediaSrc}
                  className="px-3 py-1.5 text-xs font-bold hover:bg-virtuoso-700 rounded text-gray-300 hover:text-white transition-colors"
                >
                  SET A
                </button>
                <button 
                  onClick={setLoopEnd} 
                  disabled={!mediaSrc}
                  className="px-3 py-1.5 text-xs font-bold hover:bg-virtuoso-700 rounded text-gray-300 hover:text-white transition-colors border-l border-virtuoso-700"
                >
                  SET B
                </button>
                <button 
                  onClick={() => setIsLooping(!isLooping)}
                  disabled={!loopRegion}
                  className={`px-3 py-1.5 rounded transition-colors ${isLooping ? 'text-virtuoso-gold bg-virtuoso-700/50' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  <LoopIcon className="w-4 h-4" />
                </button>
                {loopRegion && (
                  <button onClick={clearLoop} className="px-2 text-gray-500 hover:text-red-400 text-xs">✕</button>
                )}
              </div>

              {/* Right Group: Speed & Zoom */}
              <div className="flex items-center gap-4">
                
                {/* Speed */}
                <div className="flex items-center gap-2 bg-virtuoso-900/50 rounded-lg px-2 py-1 border border-virtuoso-700">
                  <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Speed</span>
                  <select 
                    value={playbackRate} 
                    onChange={(e) => changePlaybackRate(Number(e.target.value))}
                    className="bg-transparent text-xs font-medium text-virtuoso-accent focus:outline-none cursor-pointer"
                  >
                    <option value="0.25">0.25x</option>
                    <option value="0.5">0.50x</option>
                    <option value="0.75">0.75x</option>
                    <option value="1">1.00x</option>
                    <option value="1.25">1.25x</option>
                    <option value="1.5">1.50x</option>
                  </select>
                </div>

                {/* Zoom (Video Only) */}
                {mediaType === 'video' && (
                  <div className="flex items-center gap-2 bg-virtuoso-900/50 rounded-lg px-2 py-1 border border-virtuoso-700">
                     <ZoomIcon className="w-3 h-3 text-gray-500" />
                     <input 
                      type="range"
                      min={1}
                      max={5}
                      step={0.1}
                      value={zoom}
                      onChange={handleZoomChange}
                      className="w-16 h-1 bg-virtuoso-700 rounded-lg appearance-none cursor-pointer accent-gray-400 hover:accent-virtuoso-accent"
                     />
                     {zoom > 1 && (
                        <button onClick={resetZoom} className="text-gray-500 hover:text-white" title="Reset Zoom">
                           <ResetIcon className="w-3 h-3" />
                        </button>
                     )}
                  </div>
                )}
              </div>

            </div>
          </div>
        </section>

        {/* Right Column: Recording & Tools (4/12 cols) */}
        <section className="lg:col-span-4 flex flex-col gap-6">
          
          {/* Recorder Card */}
          <div className="bg-virtuoso-800 rounded-xl border border-virtuoso-700 overflow-hidden shadow-lg flex flex-col">
            <div className="bg-virtuoso-700/50 px-4 py-3 border-b border-virtuoso-700 flex justify-between items-center">
              <h2 className="font-semibold text-gray-200 flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-500'}`}></div>
                My Takes
              </h2>
              <div className="flex gap-2 text-xs bg-virtuoso-900 rounded p-1">
                 <button 
                   onClick={() => setRecorderMediaType('audio')}
                   className={`px-2 py-0.5 rounded ${recorderMediaType === 'audio' ? 'bg-virtuoso-700 text-white' : 'text-gray-500'}`}
                 >Audio</button>
                 <button 
                   onClick={() => setRecorderMediaType('video')}
                   className={`px-2 py-0.5 rounded ${recorderMediaType === 'video' ? 'bg-virtuoso-700 text-white' : 'text-gray-500'}`}
                 >Video</button>
              </div>
            </div>

            <div className="p-4 flex flex-col gap-4">
               {/* Preview Area (for Video Recording) */}
               {recorderMediaType === 'video' && (isRecording || !recordingSession) && (
                 <div className="aspect-video bg-black rounded-lg overflow-hidden relative border border-virtuoso-700">
                    <video ref={videoPreviewRef} className="w-full h-full object-cover" autoPlay playsInline muted />
                    {!isRecording && !videoPreviewRef.current?.srcObject && (
                       <div className="absolute inset-0 flex items-center justify-center text-gray-600 text-xs">Preview</div>
                    )}
                 </div>
               )}

              {/* Record Button */}
              {!isRecording ? (
                <button 
                  onClick={startRecording}
                  className="w-full py-4 rounded-xl border-2 border-dashed border-virtuoso-600 hover:border-red-500 hover:bg-red-500/10 text-gray-400 hover:text-red-500 transition-all flex flex-col items-center justify-center gap-2 group"
                >
                  <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center group-hover:bg-red-500 transition-colors">
                    <RecordIcon className="w-6 h-6 text-red-500 group-hover:text-white" />
                  </div>
                  <span className="font-medium">Start New Recording</span>
                </button>
              ) : (
                <button 
                  onClick={stopRecording}
                  className="w-full py-4 rounded-xl bg-red-500 hover:bg-red-600 text-white transition-colors flex flex-col items-center justify-center gap-2 shadow-lg shadow-red-500/20"
                >
                   <StopIcon className="w-8 h-8 animate-pulse" />
                   <span className="font-bold">Stop Recording</span>
                </button>
              )}

              {/* Last Recording Playback */}
              {recordingSession && !isRecording && (
                <div className="bg-virtuoso-900 rounded-lg p-3 border border-virtuoso-700 animate-fade-in">
                  <div className="text-xs text-gray-400 mb-2 flex justify-between">
                    <span>Last Take</span>
                    <span>{new Date(recordingSession.timestamp).toLocaleTimeString()}</span>
                  </div>
                  {recorderMediaType === 'video' ? (
                     <video 
                        ref={recordingRef as React.RefObject<HTMLVideoElement>} 
                        src={recordingSession.url} 
                        controls 
                        className="w-full rounded bg-black aspect-video mb-2"
                     />
                  ) : (
                    <audio 
                      ref={recordingRef as React.RefObject<HTMLAudioElement>} 
                      src={recordingSession.url} 
                      controls 
                      className="w-full h-10 mb-2" 
                    />
                  )}
                  
                  {/* Comparison Controls */}
                  {loopRegion && (
                    <button 
                      onClick={comparisonMode ? stopComparison : startComparison}
                      className={`w-full py-2 rounded font-medium text-sm transition-colors flex items-center justify-center gap-2 ${
                        comparisonMode 
                          ? 'bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30' 
                          : 'bg-virtuoso-gold/10 text-virtuoso-gold border border-virtuoso-gold/30 hover:bg-virtuoso-gold/20'
                      }`}
                    >
                       {comparisonMode ? (
                         <>Stop Comparison</>
                       ) : (
                         <>Compare with Loop (A-B)</>
                       )}
                    </button>
                  )}
                  {comparisonMode && (
                    <div className="mt-2 text-center text-xs font-mono text-virtuoso-accent animate-pulse">
                      {comparisonState === 'playingRef' ? "Playing Reference..." : "Playing Your Take..."}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* AI Coach Card */}
          <div className="bg-virtuoso-800 rounded-xl border border-virtuoso-700 overflow-hidden shadow-lg flex-1 flex flex-col min-h-[250px]">
            <div className="bg-gradient-to-r from-purple-900 to-virtuoso-800 px-4 py-3 border-b border-virtuoso-700 flex justify-between items-center">
              <h2 className="font-semibold text-gray-100 flex items-center gap-2">
                <SparklesIcon className="w-4 h-4 text-purple-400" />
                AI Practice Coach
              </h2>
            </div>
            
            <div className="p-4 flex-1 flex flex-col gap-3">
              <div className="flex-1 bg-virtuoso-900/50 rounded-lg p-3 text-sm text-gray-300 border border-virtuoso-700 overflow-y-auto max-h-40 scrollbar-thin scrollbar-thumb-virtuoso-700">
                {aiLoading ? (
                  <div className="flex items-center gap-2 text-purple-400">
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce delay-100"></div>
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce delay-200"></div>
                    Thinking...
                  </div>
                ) : aiResponse ? (
                   <p className="leading-relaxed">{aiResponse}</p>
                ) : (
                  <p className="text-gray-500 italic">"How can I improve my staccato?"<br/>"Tips for playing fast scales?"</p>
                )}
              </div>

              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAskAI()}
                  placeholder="Ask for advice..."
                  className="flex-1 bg-virtuoso-900 border border-virtuoso-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-purple-500 transition-colors"
                />
                <button 
                  onClick={handleAskAI}
                  disabled={aiLoading || !aiPrompt}
                  className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white p-2 rounded transition-colors"
                >
                  <SparklesIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

        </section>
      </main>

      {/* Settings & Guide Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-virtuoso-800 border border-virtuoso-700 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]">
            
            <div className="flex border-b border-virtuoso-700 p-4 items-center gap-2">
                 <BookOpenIcon className="w-5 h-5 text-gray-200" /> 
                 <h2 className="font-bold text-lg text-white">User Guide</h2>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              
                <div className="space-y-6 text-gray-300">
                  <section>
                    <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                      <UploadIcon className="w-5 h-5 text-virtuoso-accent" /> 
                      1. Load Your File
                    </h3>
                    <p className="text-sm">Click "Load File" at the top to upload your practice video or backing track. We support most formats (mp4, mp3, mov).</p>
                  </section>
                  
                  <section>
                    <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                      <LoopIcon className="w-5 h-5 text-virtuoso-gold" /> 
                      2. Master Difficult Sections
                    </h3>
                    <p className="text-sm mb-2">Use the loop controls to isolate parts:</p>
                    <ul className="list-disc list-inside text-sm space-y-1 ml-2 text-gray-400">
                      <li>Hit <b>SET A</b> to mark the start.</li>
                      <li>Hit <b>SET B</b> to mark the end.</li>
                      <li>Adjust playback speed (0.5x, 0.75x) to practice slowly.</li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                      <RecordIcon className="w-5 h-5 text-red-500" /> 
                      3. Record & Compare
                    </h3>
                    <p className="text-sm">Record yourself playing along. Then use the <b>"Compare with Loop"</b> button to hear the reference track followed immediately by your recording to spot mistakes.</p>
                  </section>
                </div>
            </div>

            <div className="p-4 border-t border-virtuoso-700 bg-virtuoso-800 flex justify-end gap-3">
              <button 
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 rounded bg-virtuoso-700 hover:bg-virtuoso-600 text-white transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;