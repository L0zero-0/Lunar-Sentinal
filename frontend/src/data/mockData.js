export const generateAnalysisResult = (filename = "lunar_surface.jpg") => {
  const craters   = Math.floor(Math.random() * 9);
  const slope     = +(Math.random() * 65 + 5).toFixed(2);
  const roughness = +(Math.random() * 72 + 8).toFixed(2);
  const elevation = +(Math.random() * 4200 - 800).toFixed(1);
  const lat       = +(Math.random() * 180 - 90).toFixed(6);
  const lon       = +(Math.random() * 360 - 180).toFixed(6);
  const lsi       = Math.max(0, Math.min(100, 100 - (0.5*craters + 0.2*slope + 0.3*roughness)));
  return { id:Date.now(), filename, timestamp:new Date().toISOString(),
    crater_count:craters, slope, roughness, elevation, latitude:lat, longitude:lon,
    lsi:+lsi.toFixed(2), zone:lsi>70?"SAFE":lsi>40?"RISKY":"UNSAFE", annotated_b64:null };
};
export const generateTelemetry = () => {
  const d = +(Math.random()*340+20).toFixed(1);
  return { delay_ms:d, status:d<80?"STABLE":d<200?"DELAYED":"CRITICAL",
    packet_loss:+(Math.random()*4).toFixed(2), signal:+(Math.random()*40+60).toFixed(1),
    uptime:"04:27:31", timestamp:new Date().toISOString() };
};
export const HISTORY_SEED = [
  {id:1,filename:"mare_01.jpg",      crater_count:2,slope:18.4,roughness:22.1,elevation:-142, latitude:14.3612, longitude:-23.9871,lsi:82.3,zone:"SAFE",  timestamp:"2025-03-01T08:10:00Z"},
  {id:2,filename:"crater_field.png", crater_count:6,slope:44.2,roughness:51.3,elevation:612,  latitude:-7.2210, longitude:102.3340,lsi:48.7,zone:"RISKY", timestamp:"2025-03-01T09:22:00Z"},
  {id:3,filename:"south_pole.jpg",   crater_count:9,slope:61.5,roughness:73.8,elevation:1820, latitude:-84.110, longitude:45.6620, lsi:21.4,zone:"UNSAFE",timestamp:"2025-03-01T10:55:00Z"},
  {id:4,filename:"apollo_site.png",  crater_count:1,slope:12.0,roughness:18.5,elevation:-88,  latitude:0.6741,  longitude:23.4730, lsi:88.9,zone:"SAFE",  timestamp:"2025-03-01T11:34:00Z"},
  {id:5,filename:"highlands.jpg",    crater_count:4,slope:35.7,roughness:42.6,elevation:920,  latitude:22.558,  longitude:-67.889, lsi:61.2,zone:"RISKY", timestamp:"2025-03-01T12:08:00Z"},
  {id:6,filename:"mare_imbrium.tif", crater_count:0,slope:8.1, roughness:11.2,elevation:-310, latitude:32.800,  longitude:-15.593, lsi:93.4,zone:"SAFE",  timestamp:"2025-03-01T13:00:00Z"},
];
export const TELEMETRY_SEED = Array.from({length:20},(_,i)=>{
  const d=+(Math.random()*320+15).toFixed(1);
  return {t:`T-${20-i}m`,delay:d,status:d<80?"STABLE":d<200?"DELAYED":"CRITICAL"};
});
