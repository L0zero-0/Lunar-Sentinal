/**
 * useAnalysis.js
 * - Sends image to backend at http://127.0.0.1:8001
 * - Tracks a new "annotatedImg" state (base64 from backend)
 * - Progress bar slows near 85% to wait for real response
 * - null fields stay null → UI shows "pending" badges
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { HISTORY_SEED } from "../data/mockData";

export const PHASES = {
  IDLE:     "idle",
  LOADING:  "loading",   // uploading + waiting for backend
  COMPLETE: "complete",
  ERROR:    "error",
};

const STEPS = [
  "UPLOADING IMAGE TO SERVER",
  "INITIALIZING YOLO MODEL",
  "RUNNING CRATER DETECTION",
  "ANNOTATING DETECTIONS",
  "COMPUTING LSI SCORE",
  "EXTRACTING COORDINATES",
  "STORING TELEMETRY",
];

export function useAnalysis() {
  const [phase,        setPhase]       = useState(PHASES.IDLE);
  const [progress,     setProgress]    = useState(0);
  const [stepText,     setStepText]    = useState("");
  const [result,       setResult]      = useState(null);
  const [annotatedImg, setAnnotatedImg]= useState(null); // ← NEW: base64 annotated image
  const [history,      setHistory]     = useState(HISTORY_SEED);
  const [error,        setError]       = useState(null);
  const [file,         setFile]        = useState(null);
  const [preview,      setPreview]     = useState(null);

  const tickerRef = useRef(null);

  useEffect(() => () => clearInterval(tickerRef.current), []);

  const selectFile = useCallback((f) => {
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setResult(null);
    setAnnotatedImg(null);   // clear previous annotated image
    setPhase(PHASES.IDLE);
    setError(null);
  }, []);

  const analyze = useCallback(async () => {
    if (!file) return;

    setPhase(PHASES.LOADING);
    setProgress(0);
    setError(null);
    setAnnotatedImg(null);

    let p = 0, si = 0;

    // Progress bar: moves fast until 80%, then slows to wait for real response
    tickerRef.current = setInterval(() => {
      const inc = p < 78 ? Math.random() * 13 + 5 : Math.random() * 1.2 + 0.3;
      p  = Math.min(p + inc, 90);
      si = Math.min(Math.floor((p / 90) * (STEPS.length - 1)), STEPS.length - 1);
      setProgress(p);
      setStepText(STEPS[si]);
    }, 400);

    try {
      const fd = new FormData();
      fd.append("file", file);

      // ── POST to backend on port 8001 ──────────────────────────────────────
      const res = await fetch("http://127.0.0.1:8001/detect-image", {
        method: "POST",
        body: fd,
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`Server ${res.status}: ${errBody}`);
      }

      const api = await res.json();
      console.log("✅ Backend response:", api);

      // ── Store annotated image for display in scan section ─────────────────
      if (api.annotated_b64) {
        setAnnotatedImg(`data:image/jpeg;base64,${api.annotated_b64}`);
      }

      // ── Build result object — null fields stay null ───────────────────────
      const data = {
        id:            Date.now(),
        filename:      file.name,
        timestamp:     api.timestamp     ?? new Date().toISOString(),
        crater_count:  api.crater_count  ?? api.craters ?? 0,
        lsi:           api.lsi           ?? 0,
        zone:          api.zone          ?? "UNSAFE",
        annotated_b64: api.annotated_b64 ?? null,
        slope:         api.slope         ?? null,
        roughness:     api.roughness     ?? null,
        elevation:     api.elevation     ?? null,
        latitude:      api.latitude      ?? null,
        longitude:     api.longitude     ?? null,
        modules_ready: api.modules_ready ?? {
          crater_detection: true,
          slope:            false,
          roughness:        false,
          elevation:        false,
          gps:              false,
        },
      };

      clearInterval(tickerRef.current);
      setProgress(100);
      setStepText("ANNOTATION COMPLETE");
      setPhase(PHASES.COMPLETE);
      setResult(data);
      setHistory(prev => [data, ...prev]);

    } catch (e) {
      clearInterval(tickerRef.current);
      console.error("❌ Analysis error:", e);
      setError(e.message || "Analysis failed. Is backend running on http://127.0.0.1:8001?");
      setPhase(PHASES.ERROR);
    }
  }, [file]);

  const reset = useCallback(() => {
    clearInterval(tickerRef.current);
    setPhase(PHASES.IDLE);
    setResult(null);
    setAnnotatedImg(null);
    setFile(null);
    setPreview(null);
    setProgress(0);
    setError(null);
  }, []);

  // ── Expose annotatedImg so Dashboard can show it ──────────────────────────
  return {
    phase, progress, stepText,
    result, annotatedImg,
    history, error,
    file, preview,
    selectFile, analyze, reset,
  };
}
