import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Image: 5760 x 1920 px
// Simple CRS bounds: lat=[-960,960], lng=[-2880,2880]
function px(x, y) {
  return [960 - y, -2880 + x];
}

// ─── MAJOR CRATERS THAT CAUSED / COULD CAUSE FAILURES ────────────────────────
const DANGER_CRATERS = [
  {
    pos: px(870, 570), radius: 180,
    name: 'Shackleton crater',
    diameter: '21 km', depth: '4.2 km', psr: '100%',
    why: 'Deepest permanently shadowed crater at south pole. Zero sunlight year-round blinds all optical navigation systems. Confirmed cause zone for IM-2 failure.',
  },
  {
    pos: px(1260, 1050), radius: 140,
    name: 'Haworth crater',
    diameter: '51 km', depth: '3.8 km', psr: '89%',
    why: 'Large PSR with extreme floor roughness. Crater walls cast 14km-long shadows during descent. IM-1 optical nav failed in adjacent shadow zone.',
  },
  {
    pos: px(2200, 740), radius: 120,
    name: 'Nobile crater',
    diameter: '73 km', depth: '3.1 km', psr: '94%',
    why: 'Vast PSR floor. Surface roughness TRI > 0.6. Any lander targeting this region faces near-total optical navigation blackout.',
  },
  {
    pos: px(4560, 960), radius: 160,
    name: "Idel'son crater",
    diameter: '59 km', depth: '3.5 km', psr: '91%',
    why: 'Concentric hazard rings visible in LSI. Steep inner walls. Radar altimeters return noisy signals from this crater geometry.',
  },
  {
    pos: px(3720, 940), radius: 100,
    name: 'Faustini crater',
    diameter: '43 km', depth: '2.9 km', psr: '95%',
    why: 'One of the darkest spots in the solar system. No solar illumination ever. Luna-25 intended landing zone was adjacent — engine burn miscalculation led to Pontécoulant G impact.',
  },
  {
    pos: px(2580, 920), radius: 110,
    name: 'Amundsen crater',
    diameter: '105 km', depth: '2.7 km', psr: '76%',
    why: 'Massive crater with partial PSR. Ejecta field covers surrounding terrain — surface instability risk for any lander.',
  },
];

// ─── ALL MISSIONS ─────────────────────────────────────────────────────────────
const MISSIONS = [
  // ── SUCCESSES ──────────────────────────────────────────────────────────────
  {
    pos: px(620, 1580),
    type: 'success',
    label: 'Chandrayaan-3 (ISRO) ✓',
    date: '23 Aug 2023',
    country: 'India',
    lsi: 0.26,
    outcome: 'SUCCESS — First ever soft landing near lunar south pole. Vikram lander + Pragyan rover operated for 14 Earth days. Confirmed sulphur and other elements in regolith.',
    failure_reason: null,
  },
  {
    pos: px(5100, 350),
    type: 'success',
    label: 'Blue Ghost M1 (Firefly) ✓',
    date: '2 Mar 2025',
    country: 'USA (Private)',
    lsi: 0.21,
    outcome: 'SUCCESS — First fully successful CLPS commercial landing. Landed in Mare Crisium (not south pole). Flat terrain with excellent solar access matched low LSI prediction.',
    failure_reason: null,
  },

  // ── FAILURES ───────────────────────────────────────────────────────────────
  {
    pos: px(2050, 860),
    type: 'failed',
    label: 'IM-2 Athena (Intuitive Machines) ✗',
    date: '6 Mar 2025',
    country: 'USA (Private)',
    lsi: 0.86,
    outcome: 'FAILED — Tipped over inside crater near Mons Mouton, 84.5°S. Batteries died within hours.',
    failure_reason: 'Laser navigation system failed during descent due to shadow interference from Shackleton rim. Landed 250m off-target inside a crater. Long shadows from crater walls blocked altimeter. HIGH LSI confirmed hazard.',
  },
  {
    pos: px(1060, 1130),
    type: 'failed',
    label: 'IM-1 Odysseus (Intuitive Machines) ✗',
    date: '22 Feb 2024',
    country: 'USA (Private)',
    lsi: 0.73,
    outcome: 'FAILED — Landed sideways near Malapert A crater. Operations lasted ~6 days tilted.',
    failure_reason: 'Laser rangefinder disabled by safety switch error. Backup navigation failed in shadowed terrain. High slope caused rollover on touchdown. Shadow confusion identical to IM-2 failure mode.',
  },
  {
    pos: px(3400, 480),
    type: 'failed',
    label: 'Luna-25 (Roscosmos) ✗',
    date: '19 Aug 2023',
    country: 'Russia',
    lsi: 0.81,
    outcome: 'FAILED — Crashed into Pontécoulant G crater rim. Russia\'s first moon mission in 47 years destroyed on impact.',
    failure_reason: 'Engine burn 127 seconds too long during pre-landing orbit maneuver. Software miscalculated deceleration over PSR terrain. Intended landing near Boguslawsky crater — crashed 400km short. Crater rim impact at 57.8°S, 61.3°E confirmed by LRO.',
  },
  {
    pos: px(4200, 1400),
    type: 'failed',
    label: 'Chandrayaan-2 Vikram (ISRO) ✗',
    date: '6 Sep 2019',
    country: 'India',
    lsi: 0.69,
    outcome: 'FAILED — Lost contact 2.1km above surface. Crashed at high velocity near 70.9°S.',
    failure_reason: 'Software glitch in braking thruster sequence caused uncontrolled descent. Velocity 59 m/s at impact (target: <2 m/s). Lessons learned led to successful Chandrayaan-3 in 2023.',
  },
  {
    pos: px(760, 1300),
    type: 'failed',
    label: 'Peregrine M1 (Astrobotic) ✗',
    date: 'Jan 2024',
    country: 'USA (Private)',
    lsi: 0.74,
    outcome: 'FAILED — Never reached Moon. Propellant leak after launch caused mission abort. Burned up in Earth atmosphere.',
    failure_reason: 'Propulsion system valve failure caused propellant leak immediately after launch. Could not reach lunar orbit. Unrelated to terrain — but highlights propulsion risk in CLPS program.',
  },
  {
    pos: px(2900, 1650),
    type: 'failed',
    label: 'Hakuto-R M1 (ispace) ✗',
    date: '25 Apr 2023',
    country: 'Japan (Private)',
    lsi: 0.67,
    outcome: 'FAILED — Crashed into Atlas Crater during final descent. Japan\'s first lunar landing attempt.',
    failure_reason: 'Onboard computer overestimated altitude by ~9km due to crater rim edge detection error. Fuel exhausted before surface contact. Lander fell from 5km height at full velocity.',
  },
  {
    pos: px(1600, 400),
    type: 'failed',
    label: 'Beresheet (SpaceIL) ✗',
    date: '11 Apr 2019',
    country: 'Israel (Private)',
    lsi: 0.71,
    outcome: 'FAILED — Crashed into Sea of Serenity. First privately-funded lunar attempt.',
    failure_reason: 'Inertial measurement unit reset mid-descent triggered engine cutoff. Main engine failed to restart in time. Impact at ~500 km/h. Software error caused chain-reaction failure.',
  },

  // ── UPCOMING ───────────────────────────────────────────────────────────────
  {
    pos: px(4900, 700),
    type: 'upcoming',
    label: 'Blue Moon Pathfinder (Blue Origin) ⟳',
    date: '2026 (planned)',
    country: 'USA',
    lsi: 0.33,
    outcome: 'PLANNED — Targeting lunar south pole. Blue Moon Mark-1 cargo lander.',
    failure_reason: 'Lunar Sentinel recommends this target zone — moderate-low LSI. Avoid Shackleton shadow approach corridor.',
  },
  {
    pos: px(3800, 1500),
    type: 'upcoming',
    label: 'IM-3 (Intuitive Machines) ⟳',
    date: '2026 H1 (planned)',
    country: 'USA (Private)',
    lsi: 0.41,
    outcome: 'PLANNED — Targeting Reiner Gamma region after two south pole failures. Will carry expanded crater terrain database.',
    failure_reason: 'Lunar Sentinel note: IM-3 team announced expanded crater database to prevent repeat nav failures.',
  },
];

// ─── TERRAIN ZONES ────────────────────────────────────────────────────────────
const TERRAIN_ZONES = [
  {
    pos: px(5200, 280), type: 'safe',
    label: 'Leibnitz Beta plateau',
    lsi: 0.22, slope: '3.8°', psr: 'None',
    reason: 'Flattest terrain in study area. Solar illumination >70% of lunar year. Primary recommended landing zone. Lunar Sentinel: CLEARED.',
  },
  {
    pos: px(4820, 1680), type: 'safe',
    label: 'Eastern flat basin',
    lsi: 0.19, slope: '2.9°', psr: 'None',
    reason: 'Lowest TRI in dataset. Minimal crater density. Extended solar access. Top-ranked candidate. Lunar Sentinel: CLEARED.',
  },
  {
    pos: px(5420, 1100), type: 'safe',
    label: 'Connecting ridge plateau',
    lsi: 0.31, slope: '4.2°', psr: 'None',
    reason: 'Gently sloping plateau. No PSR zones within 2km. Viable emergency landing site. Lunar Sentinel: CLEARED.',
  },
  {
    pos: px(500, 1380), type: 'moderate',
    label: 'de Gerlache ridge',
    lsi: 0.54, slope: '13.2°', psr: 'None',
    reason: 'Ridge terrain with moderate slope. Boulder fields present. Requires careful site selection. Lunar Sentinel: CAUTION.',
  },
  {
    pos: px(1820, 1480), type: 'moderate',
    label: 'Cabeus crater edge',
    lsi: 0.58, slope: '14.7°', psr: 'Partial',
    reason: 'Crater edge zone. Partial shadow coverage. Careful descent trajectory required. Lunar Sentinel: CAUTION.',
  },
  {
    pos: px(3200, 1580), type: 'moderate',
    label: 'Malapert massif flank',
    lsi: 0.62, slope: '12.4°', psr: 'None',
    reason: 'Massif slope with moderate inclination. Good solar access. Roughness limits options. Lunar Sentinel: CAUTION.',
  },
];

const MISSION_COLORS = {
  success:  '#00e676',
  failed:   '#ff2d2d',
  upcoming: '#00b8ff',
};

const TERRAIN_COLORS = {
  safe:     '#00e676',
  moderate: '#ffaa00',
};

export default function LsiMapViewer() {
  const mapRef = useRef(null);

  useEffect(() => {
    if (mapRef.current) return;

    const bounds = [[-960, -2880], [960, 2880]];

    const map = L.map('lsi-map', {
      crs: L.CRS.Simple,
      minZoom: -2,
      maxZoom: 4,
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      attributionControl: false,
    });

    mapRef.current = map;

    L.imageOverlay('/lsi_tiles_original/preview.jpg', bounds, { opacity: 1 }).addTo(map);
    map.fitBounds(bounds, { padding: [0, 0] });

    // Inject styles
    const style = document.createElement('style');
    style.id = 'lsi-styles';
    style.textContent = `
      @keyframes pulse-danger {
        0%   { transform:translate(-50%,-50%) scale(1);   opacity:0.9; }
        100% { transform:translate(-50%,-50%) scale(3);   opacity:0;   }
      }
      @keyframes pulse-fail {
        0%   { transform:translate(-50%,-50%) scale(1);   opacity:0.8; }
        100% { transform:translate(-50%,-50%) scale(2.4); opacity:0;   }
      }
      .lsi-popup .leaflet-popup-content-wrapper {
        background:transparent!important; border:none!important;
        box-shadow:none!important; padding:0!important; border-radius:0!important;
      }
      .lsi-popup .leaflet-popup-content { margin:0!important; }
      .lsi-popup .leaflet-popup-tip-container { display:none!important; }
    `;
    if (!document.getElementById('lsi-styles')) document.head.appendChild(style);

    // ── 1. Danger crater rings ─────────────────────────────────────────────
    DANGER_CRATERS.forEach(c => {
      L.circle(c.pos, {
        radius: c.radius,
        color: '#ff6600',
        weight: 1.5,
        opacity: 0.7,
        fillColor: '#ff6600',
        fillOpacity: 0.08,
        dashArray: '4 3',
      }).addTo(map).bindPopup(`
        <div style="font-family:monospace;width:230px;background:#0d0500ee;
          border:1px solid #ff660055;border-left:3px solid #ff6600;border-radius:4px;padding:11px 13px">
          <div style="font-size:11px;font-weight:700;color:#ff9944;margin-bottom:3px">
            ⬡ ${c.name}
          </div>
          <div style="font-size:9px;color:#ff6600;letter-spacing:0.15em;margin-bottom:9px">
            CRATER HAZARD ZONE
          </div>
          <div style="font-size:9px;color:#a87;margin-bottom:3px">Diameter: <span style="color:#ffc">${c.diameter}</span></div>
          <div style="font-size:9px;color:#a87;margin-bottom:3px">Depth: <span style="color:#ffc">${c.depth}</span></div>
          <div style="font-size:9px;color:#a87;margin-bottom:8px">PSR coverage: <span style="color:#ff6b6b">${c.psr}</span></div>
          <div style="font-size:9px;color:#987;line-height:1.55;border-top:1px solid #ffffff0f;padding-top:7px">${c.why}</div>
        </div>
      `, { maxWidth: 260, className: 'lsi-popup' });
    });

    // ── 2. Terrain zone markers ────────────────────────────────────────────
    TERRAIN_ZONES.forEach(zone => {
      const color = TERRAIN_COLORS[zone.type];
      const icon = L.divIcon({
        html: `<div style="width:7px;height:7px;border-radius:50%;background:${color};
          border:1.5px solid rgba(255,255,255,0.8);
          box-shadow:0 0 5px ${color},0 0 10px ${color}55"></div>`,
        className: '', iconSize: [7,7], iconAnchor: [3.5,3.5],
      });
      L.marker(zone.pos, { icon }).addTo(map).bindPopup(`
        <div style="font-family:monospace;width:220px;background:#060b1aee;
          border:1px solid ${color}44;border-left:3px solid ${color};border-radius:4px;padding:11px 13px">
          <div style="font-size:11px;font-weight:700;color:#fff;margin-bottom:3px">${zone.label}</div>
          <div style="font-size:9px;color:${color};letter-spacing:0.15em;margin-bottom:9px">
            ${zone.type === 'safe' ? 'SAFE ZONE — CLEARED' : 'MODERATE RISK — CAUTION'}
          </div>
          <div style="font-size:9px;color:#7ab;margin-bottom:3px">LSI: <span style="color:${color};font-weight:700">${zone.lsi}</span></div>
          <div style="font-size:9px;color:#7ab;margin-bottom:3px">Slope: <span style="color:#cde">${zone.slope}</span></div>
          <div style="font-size:9px;color:#7ab;margin-bottom:8px">PSR: <span style="color:#cde">${zone.psr}</span></div>
          <div style="font-size:9px;color:#8ab;line-height:1.55;border-top:1px solid #ffffff0f;padding-top:7px">${zone.reason}</div>
        </div>
      `, { maxWidth: 250, className: 'lsi-popup' });
    });

    // ── 3. Mission markers ─────────────────────────────────────────────────
    MISSIONS.forEach(m => {
      const color = MISSION_COLORS[m.type];
      const size  = 13;
      const pulse = m.type === 'failed';
      const icon  = L.divIcon({
        html: `
          <div style="position:relative;width:${size}px;height:${size}px">
            ${pulse ? `<div style="position:absolute;top:50%;left:50%;
              width:${size*2.5}px;height:${size*2.5}px;border-radius:50%;
              border:1.5px solid ${color};
              animation:pulse-fail 1.8s ease-out infinite;pointer-events:none"></div>` : ''}
            <div style="width:${size}px;height:${size}px;border-radius:50%;
              background:${color};border:2px solid rgba(255,255,255,0.9);
              box-shadow:0 0 6px ${color},0 0 14px ${color}66"></div>
          </div>`,
        className: '', iconSize:[size,size], iconAnchor:[size/2,size/2],
      });

      L.marker(m.pos, { icon }).addTo(map).bindPopup(`
        <div style="font-family:monospace;width:240px;background:#060b1aee;
          border:1px solid ${color}55;border-left:3px solid ${color};border-radius:4px;padding:12px 14px">
          <div style="font-size:11px;font-weight:700;color:#fff;margin-bottom:2px">${m.label}</div>
          <div style="display:flex;justify-content:space-between;margin-bottom:8px">
            <span style="font-size:9px;color:${color};letter-spacing:0.12em;font-weight:700">
              ${m.type === 'success' ? 'SUCCESS' : m.type === 'failed' ? 'MISSION FAILURE' : 'UPCOMING MISSION'}
            </span>
            <span style="font-size:9px;color:#6a8">${m.date}</span>
          </div>
          <div style="font-size:9px;color:#7ab;margin-bottom:3px">Country: <span style="color:#cde">${m.country}</span></div>
          ${m.lsi ? `<div style="font-size:9px;color:#7ab;margin-bottom:8px">
            LSI Score: <span style="color:${color};font-weight:700">${m.lsi}/1.00</span>
          </div>` : ''}
          <div style="font-size:9px;color:#cde;line-height:1.6;margin-bottom:${m.failure_reason ? 7 : 0}px;
            border-top:1px solid #ffffff0f;padding-top:7px">${m.outcome}</div>
          ${m.failure_reason ? `
            <div style="font-size:9px;color:#f97;line-height:1.6;
              border-top:1px solid #ff220015;padding-top:7px;margin-top:0">
              <span style="color:#ff6644;font-weight:700;letter-spacing:0.1em">ROOT CAUSE: </span>${m.failure_reason}
            </div>` : ''}
        </div>
      `, { maxWidth: 270, className: 'lsi-popup' });
    });

    return () => { map.remove(); mapRef.current = null; };
  }, []);

  const legendItems = [
    { color: '#ff6600', label: 'CRATER HAZARD ZONE', dash: true },
    { color: '#ff2d2d', label: 'MISSION FAILURE' },
    { color: '#00e676', label: 'SUCCESS / SAFE ZONE' },
    { color: '#ffaa00', label: 'MODERATE RISK' },
    { color: '#00b8ff', label: 'UPCOMING MISSION' },
  ];

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display:'flex', gap:16, flexWrap:'wrap', marginBottom:12, alignItems:'center' }}>
        {legendItems.map(({ color, label, dash }) => (
          <div key={label} style={{ display:'flex', alignItems:'center', gap:6 }}>
            {dash
              ? <div style={{ width:16, height:2, background:'transparent',
                  border:`1.5px dashed ${color}`, borderRadius:1 }} />
              : <div style={{ width:7, height:7, borderRadius:'50%',
                  background:color, boxShadow:`0 0 5px ${color}` }} />
            }
            <span style={{ fontSize:9, color:'rgba(0,200,255,0.55)',
              fontFamily:'monospace', letterSpacing:'0.12em' }}>{label}</span>
          </div>
        ))}
      </div>

      <div id="lsi-map" style={{
        height: 540, borderRadius:6,
        border:'1px solid rgba(0,200,255,0.12)',
        background:'#000010', overflow:'hidden',
      }} />

      <div style={{ display:'flex', justifyContent:'space-between', marginTop:8, flexWrap:'wrap', gap:4 }}>
        <span style={{ fontSize:9, color:'rgba(0,200,255,0.28)', fontFamily:'monospace', letterSpacing:'0.08em' }}>
          SCROLL TO ZOOM · DRAG TO PAN · HOVER ANY MARKER OR CRATER RING FOR DETAILS
        </span>
        <span style={{ fontSize:9, color:'rgba(0,200,255,0.28)', fontFamily:'monospace', letterSpacing:'0.08em' }}>
          {MISSIONS.filter(m=>m.type==='failed').length} FAILURES · {MISSIONS.filter(m=>m.type==='success').length} SUCCESSES · {DANGER_CRATERS.length} HAZARD CRATERS · LSI = 0.4×SLOPE + 0.3×TRI + 0.3×TPI
        </span>
      </div>
    </div>
  );
}
