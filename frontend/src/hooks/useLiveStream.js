/**
 * useLiveStream.js
 * Manages the live MJPEG stream from /video-feed
 * and polls /stats every second for crater count + FPS.
 */
import { useState, useEffect, useRef, useCallback } from "react";

const BACKEND = "http://127.0.0.1:8001";

export function useLiveStream() {
  const [isStreaming,  setIsStreaming]  = useState(false);
  const [streamError,  setStreamError]  = useState(null);
  const [stats,        setStats]        = useState(null);  // { crater_count, fps, detections }
  const [cameraSource, setCameraSource] = useState(0);
  const [switching,    setSwitching]    = useState(false);
  const [adbLoading,   setAdbLoading]   = useState(false);
  const [adbStatus,    setAdbStatus]    = useState(null);

  const [streamKey,    setStreamKey]    = useState(Date.now());

  const statsTimerRef = useRef(null);
  const imgRef        = useRef(null);   // ref to <img> element

  // ── Poll /stats every second while streaming ──────────────────────────────
  const startStatsPolling = useCallback(() => {
    clearInterval(statsTimerRef.current);
    statsTimerRef.current = setInterval(async () => {
      try {
        const res  = await fetch(`${BACKEND}/stats`);
        const data = await res.json();
        setStats(data);
      } catch (_) {
        // backend temporarily unreachable — don't crash
      }
    }, 1000);
  }, []);

  const stopStatsPolling = useCallback(() => {
    clearInterval(statsTimerRef.current);
  }, []);

  // ── Start stream ──────────────────────────────────────────────────────────
  const startStream = useCallback(() => {
    setStreamError(null);
    setStreamKey(Date.now()); // Update cache-buster key on every restart
    setIsStreaming(true);
    startStatsPolling();
  }, [startStatsPolling]);

  // ── Stop stream ───────────────────────────────────────────────────────────
  const stopStream = useCallback(() => {
    setIsStreaming(false);
    stopStatsPolling();
    setStats(null);
    // Force the <img> to stop loading by clearing its src
    if (imgRef.current) imgRef.current.src = "";
  }, [stopStatsPolling]);

  // ── Switch camera ─────────────────────────────────────────────────────────
  const switchCamera = useCallback(async (source) => {
    setSwitching(true);
    setStreamError(null);
    try {
      const res = await fetch(`${BACKEND}/switch-camera`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ source }),
      });
      if (!res.ok) throw new Error(`Server ${res.status}`);
      setCameraSource(source);
      // Brief pause then refresh stream URL to force reconnect
      if (imgRef.current && isStreaming) {
        const url = imgRef.current.src;
        imgRef.current.src = "";
        setTimeout(() => {
          if (imgRef.current) imgRef.current.src = url;
        }, 600);
      }
    } catch (e) {
      setStreamError(`Switch failed: ${e.message}`);
    } finally {
      setSwitching(false);
    }
  }, [isStreaming]);

  // ── Setup ADB Port Forwarding ─────────────────────────────────────────────
  const setupAdb = useCallback(async (port = 4747) => {
    setAdbLoading(true);
    setAdbStatus(null);
    setStreamError(null);
    try {
      const res = await fetch(`${BACKEND}/setup-adb`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ port }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail?.message || data.detail || "ADB setup failed");
      }
      setAdbStatus({ success: true, message: data.message });
      // Auto switch to newly forwarded URL
      await switchCamera(`http://127.0.0.1:${port}/video`);
    } catch (e) {
      setAdbStatus({ success: false, message: e.message });
      setStreamError(`ADB Setup Failed: ${e.message}`);
    } finally {
      setAdbLoading(false);
    }
  }, [switchCamera]);

  // ── Sync camera source from backend on mount ──────────────────────────────
  useEffect(() => {
    async function syncCameraSource() {
      try {
        const res = await fetch(`${BACKEND}/cameras`);
        if (res.ok) {
          const data = await res.json();
          if (data.current !== undefined && data.current !== null) {
            setCameraSource(data.current);
          }
        }
      } catch (_) {
        // backend offline
      }
    }
    syncCameraSource();
  }, []);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => () => stopStatsPolling(), [stopStatsPolling]);

  const streamUrl = `${BACKEND}/video-feed?t=${streamKey}`;

  return {
    isStreaming,
    streamError,
    streamUrl,
    stats,
    cameraSource,
    switching,
    imgRef,
    startStream,
    stopStream,
    switchCamera,
    setStreamError,
    BACKEND,
    adbLoading,
    adbStatus,
    setupAdb,
  };
}
