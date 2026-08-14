import { useState, useEffect, useRef } from "react";
import { generateTelemetry, TELEMETRY_SEED } from "../data/mockData";

export function useTelemetry(intervalMs = 2500) {
  const [current,  setCurrent]  = useState(generateTelemetry());
  const [trendData,setTrendData]= useState(TELEMETRY_SEED);
  const timer = useRef(null);

  useEffect(() => {
    timer.current = setInterval(() => {
      /* Real API: fetch("/telemetry").then(r=>r.json()).then(setCurrent) */
      const snap = generateTelemetry();
      setCurrent(snap);
      setTrendData(prev => {
        const next = [...prev.slice(-19), { t:"NOW", delay:snap.delay_ms, status:snap.status }];
        return next;
      });
    }, intervalMs);
    return () => clearInterval(timer.current);
  }, [intervalMs]);

  return { current, trendData };
}
