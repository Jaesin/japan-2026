// PublicPage.jsx — the public (non-portal) trip page.
// Auto-switches the entire treatment on the browser's light/dark setting:
//   light → PosterLight (Direction A)   dark → PosterDark (Direction B)
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PosterLight from './components/PosterLight';
import PosterDark from './components/PosterDark';
import { useMember } from './auth/useMember.js';

function usePrefersDark() {
  const [dark, setDark] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e) => setDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return dark;
}

export default function PublicPage() {
  const dark = usePrefersDark();
  const navigate = useNavigate();
  const { status } = useMember();
  // The poster is a single ~480px column; center it with letterboxing on
  // larger screens. Page background matches the active mode's edge color.
  return (
    <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', background: dark ? '#11192c' : '#e7ddc4' }}>
      <div style={{ width: '100%', maxWidth: 480 }}>
        {dark ? <PosterDark /> : <PosterLight />}
        {status === 'member' && (
          <button
            onClick={() => navigate('/portal')}
            style={{
              width: '100%',
              padding: '16px 24px',
              background: dark ? '#EE3C2B' : '#C5302B',
              color: '#fff',
              border: 'none',
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: '.04em',
              cursor: 'pointer',
            }}
          >
            Enter Portal
          </button>
        )}
      </div>
    </div>
  );
}
