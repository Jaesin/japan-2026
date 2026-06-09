import './Home.css';
import { useEffect } from 'react';

// In Vite, importing from /public works with absolute paths
// Since base is /japan-2026/, Vite handles the path re-writing
import sunUrl from '/sun.svg';

// Simple inline SVG for Mount Fuji silhouette
function MountFujiSVG() {
  return (
    <svg viewBox="0 0 400 100" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" style={{ width: '100%', height: 'auto', display: 'block' }}>
      <path d="M0 100 L60 30 L100 50 L140 10 L180 35 L220 15 L260 40 L300 5 L340 45 L400 0 L400 100 Z" fill="none" stroke="#1A1714" strokeWidth="2" />
      <path d="M0 100 Q40 60 60 30 Q80 50 100 50 Q120 30 140 10 Q160 25 180 35 Q200 25 220 15 Q240 30 260 40 Q280 20 300 5 Q320 25 340 45 Q370 20 400 0 L400 100 Z" fill="#1A1714" />
      {/* Snow cap */}
      <path d="M140 10 Q155 5 160 10 Q165 8 170 15 Q175 12 180 35 Q160 25 140 10 Z" fill="#FFFFFF" />
      <path d="M300 5 Q310 2 315 8 Q320 3 325 10 Q330 8 340 45 Q320 25 300 5 Z" fill="#FFFFFF" />
    </svg>
  );
}

// Simplified Japan Honshu map SVG with route
function JapanMapSVG() {
  return (
    <svg viewBox="0 0 400 280" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" style={{ width: '100%', height: 'auto', display: 'block', background: '#E8E4D8' }}>
      {/* Japan Honshu simplified coastline */}
      <path d="
        M 50,20 Q 60,15 70,18 L 90,12 Q 100,8 110,12 Q 120,18 125,25 
        Q 130,30 135,28 Q 140,25 145,30 Q 150,38 155,42 
        Q 160,48 165,50 Q 170,55 175,58 Q 180,60 185,65 
        Q 190,70 195,72 Q 200,75 210,80 Q 220,85 225,90 
        Q 230,95 235,100 Q 240,108 242,115 Q 245,120 250,125 
        Q 255,130 260,140 Q 265,150 268,160 Q 270,170 275,180 
        Q 280,190 285,200 Q 290,210 295,220 Q 298,230 300,240 
        Q 302,250 305,255 Q 308,260 310,265 Q 315,270 320,275 
        Q 325,278 330,280 L 340,280 Q 350,278 355,275 
        Q 360,270 365,265 Q 370,258 375,250 Q 380,240 385,230 
        Q 390,220 395,210 Q 400,200 400,195 
        Q 400,180 395,170 Q 390,160 385,155 
        Q 380,150 375,145 Q 370,140 365,138 
        Q 360,135 355,132 Q 350,128 345,125 
        Q 340,120 335,115 Q 330,110 325,105 
        Q 320,98 315,92 Q 310,85 305,80 
        Q 300,75 295,70 Q 290,65 285,60 
        Q 280,55 275,50 Q 270,45 265,42 
        Q 260,38 255,35 Q 250,30 245,28 
        Q 240,25 235,22 Q 230,18 225,15 
        Q 220,12 215,10 Q 210,8 205,6 
        Q 200,4 195,3 Q 190,2 185,2 
        Q 180,2 175,3 Q 170,4 165,6 
        Q 160,8 155,10 Q 150,12 145,15 
        Q 140,18 135,20 Q 130,22 125,25 
        Q 120,18 115,15 Q 110,12 105,10 
        Q 100,8 95,8 Q 90,10 85,12 
        Q 80,15 75,18 Q 70,20 65,22 
        Q 60,25 55,24 Q 50,22 50,20 Z
      " fill="#D5D0C0" stroke="#B8AFA0" strokeWidth="1.5" />
      
      {/* Dashed route line: Tokyo → Hakone → Kyoto → Nara → Osaka */}
      <path d="
        M 260,100 
        Q 255,120 250,140 
        Q 245,155 235,170 
        Q 230,178 225,182 
        Q 220,185 215,190
      " fill="none" stroke="#B63E33" strokeWidth="2" strokeDasharray="6,4" />
      
      {/* Route dots */}
      <circle cx="260" cy="100" r="6" fill="#B63E33" /> {/* Tokyo */}
      <circle cx="250" cy="140" r="6" fill="#B63E33" /> {/* Hakone */}
      <circle cx="235" cy="170" r="6" fill="#B63E33" /> {/* Kyoto */}
      <circle cx="225" cy="182" r="6" fill="#B63E33" /> {/* Nara */}
      <circle cx="215" cy="190" r="6" fill="#B63E33" /> {/* Osaka */}
      
      {/* City labels */}
      <text x="260" y="90" fill="#1A1714" fontSize="8" fontFamily="Archivo, serif" textAnchor="middle" fontWeight="600">Tokyo</text>
      <text x="250" y="155" fill="#1A1714" fontSize="7" fontFamily="Archivo, serif" textAnchor="middle" fontWeight="600">Hakone</text>
      <text x="235" y="180" fill="#1A1714" fontSize="7" fontFamily="Archivo, serif" textAnchor="start" fontWeight="600">Kyoto</text>
      <text x="225" y="192" fill="#1A1714" fontSize="7" fontFamily="Archivo, serif" textAnchor="end" fontWeight="600">Nara</text>
      <text x="215" y="200" fill="#1A1714" fontSize="7" fontFamily="Archivo, serif" textAnchor="end" fontWeight="600">Osaka</text>
      
      {/* Dotted rings around cities */}
      {[
        { cx: 260, cy: 100 },
        { cx: 250, cy: 140 },
        { cx: 235, cy: 170 },
        { cx: 225, cy: 182 },
        { cx: 215, cy: 190 },
      ].map((p, i) => (
        <circle key={i} cx={p.cx} cy={p.cy} r="10" fill="none" stroke="#B63E33" strokeWidth="0.5" strokeDasharray="2,2" opacity="0.6" />
      ))}
    </svg>
  );
}

export default function Home() {
  useEffect(() => {
    // Preload Google Fonts
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Anton&family=Archivo:ital,wght@0,400;0,500;0,600;1,400&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }, []);

  return (
    <div className="home-page">
      {/* ===== HEADER SECTION ===== */}
      <header className="header-section">
        <div className="header-top">
          <span className="est-summer">Est. Summer</span>
          <div className="sun-icon-wrapper">
            <img src={sunUrl} alt="Sun" className="sun-icon" />
          </div>
        </div>
        
        <div className="japanese-text">日本の旅</div>
        
        <h1 className="hero-title">JAPAN</h1>
        
        <div className="hero-subtitle-wrapper">
          <span className="subtitle-line"></span>
          <span className="subtitle-text">THE MULENEX FAMILY · 2026</span>
          <span className="subtitle-line"></span>
        </div>
        
        <p className="hero-body">
          This summer, one family crosses the Land of the Rising Sun — from the neon canyons of Tokyo to the temple-lit hills of Kyoto.
        </p>
        
        <div className="fuji-silhouette">
          <MountFujiSVG />
        </div>
      </header>
      
      <div className="header-divider" />
      
      {/* ===== COUNTDOWN BANNER ===== */}
      <section className="countdown-banner">
        <div className="countdown-left">
          <span className="now-boarding">NOW BOARDING</span>
          <div className="countdown-number-row">
            <span className="countdown-number">25</span>
            <span className="countdown-text">
              days until<br />departure
            </span>
          </div>
        </div>
        <div className="countdown-red-dot" />
      </section>
      
      {/* ===== ITINERARY SECTION ===== */}
      <section className="itinerary-section">
        <div className="section-header">
          <h2 className="section-heading">The Itinerary</h2>
        </div>
        
        <div className="itinerary-table">
          <div className="itinerary-row">
            <span className="itinerary-label">Featuring</span>
            <span className="itinerary-value">Tokyo · Hakone · Kyoto · Nara · Osaka</span>
          </div>
          <div className="itinerary-row">
            <span className="itinerary-label">Runtime</span>
            <span className="itinerary-value">10 days across Honshū</span>
          </div>
          <div className="itinerary-row">
            <span className="itinerary-label">Premieres</span>
            <span className="itinerary-value">July 4, 2026</span>
          </div>
          <div className="itinerary-row">
            <span className="itinerary-label">Status</span>
            <span className="itinerary-value">Route still being charted</span>
          </div>
        </div>
      </section>
      
      {/* ===== ROUTE SECTION ===== */}
      <section className="route-section">
        <div className="section-header">
          <h2 className="section-heading">The Route</h2>
        </div>
        
        <div className="map-container">
          <JapanMapSVG />
          <div className="map-badge">Last seen · Hakone</div>
        </div>
        
        <p className="map-credit">Map © OpenStreetMap · CARTO</p>
      </section>
      
      {/* ===== DISPATCHES SECTION ===== */}
      <section className="dispatches-section">
        <div className="section-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#B63E33', flexShrink: 0 }} />
            <h2 className="section-heading" style={{ fontFamily: "'Anton', sans-serif", fontSize: '16px', color: '#1A1714', letterSpacing: '1px', textTransform: 'none' }}>Dispatches</h2>
          </div>
          <span className="live-badge">Live July 4</span>
        </div>
        
        <div className="dispatches-list">
          <article className="dispatch-card">
            <div className="dispatch-card-header">
              <span className="dispatch-dot" />
              <h3 className="dispatch-title">Fushimi Inari</h3>
            </div>
            <p className="dispatch-body">
              Ten thousand vermilion gates — and not one we could walk past.
            </p>
            <span className="dispatch-timestamp">2 days ago</span>
          </article>
          
          <article className="dispatch-card">
            <div className="dispatch-card-header">
              <span className="dispatch-dot" />
              <h3 className="dispatch-title">Tsukiji Outer Market</h3>
            </div>
            <p className="dispatch-body">
              Sushi for breakfast at 7am. No regrets, only soy sauce.
            </p>
            <span className="dispatch-timestamp">4 days ago</span>
          </article>
        </div>
      </section>
    </div>
  );
}
