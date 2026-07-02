import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';

const backendUrl = import.meta.env.VITE_BACKEND_URL;
const CODE_LENGTH = 6;

function getToken() {
  return localStorage.getItem('chat_token') || '';
}

function getUsername() {
  return localStorage.getItem('chat_username') || '';
}

function normalizeRoomCode(value) {
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

function codeToDigits(code) {
  const digits = new Array(CODE_LENGTH).fill('');
  const normalized = normalizeRoomCode(code);
  for (let i = 0; i < Math.min(normalized.length, CODE_LENGTH); i += 1) {
    digits[i] = normalized[i];
  }
  return digits;
}

export default function RoomsSection() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const [token, setToken] = useState(() => getToken());
  const [username, setUsername] = useState(() => getUsername());
  const [roomName, setRoomName] = useState('');
  const [codeDigits, setCodeDigits] = useState(() =>
    codeToDigits(params.code || location.state?.joinCode || '')
  );
  const [error, setError] = useState(() => (typeof location.state?.error === 'string' ? location.state.error : ''));
  const [joinLoading, setJoinLoading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const boxRefs = useRef([]);

  const prefillCode = useMemo(
    () => normalizeRoomCode(params.code || location.state?.joinCode || ''),
    [location.state?.joinCode, params.code]
  );

  useEffect(() => {
    if (prefillCode) {
      setCodeDigits(codeToDigits(prefillCode));
    }
  }, [prefillCode]);

  useEffect(() => {
    if (typeof location.state?.error === 'string') {
      setError(location.state.error);
    }
  }, [location.state?.error]);

  if (!token || !username) {
    return <Navigate to="/login" replace state={prefillCode ? { roomCode: prefillCode } : undefined} />;
  }

  function handleLogout() {
    localStorage.removeItem('chat_token');
    localStorage.removeItem('chat_username');
    setToken('');
    setUsername('');
    navigate('/login', { replace: true });
  }

  async function handleCreateRoom() {
    if (createLoading || joinLoading) {
      return;
    }

    try {
      setError('');
      setCreateLoading(true);

      const response = await fetch(`${backendUrl}/rooms/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: roomName.trim() || null }),
      });

      const data = await response.json();

      if (response.status === 401) {
        handleLogout();
        return;
      }

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create room');
      }

      navigate(`/chat/${data.code}`, { replace: true });
    } catch (submitError) {
      setError(submitError.message || 'Failed to create room');
    } finally {
      setCreateLoading(false);
    }
  }

  async function handleJoinRoom() {
    const code = normalizeRoomCode(codeDigits.join(''));

    if (!code || code.length < CODE_LENGTH || joinLoading || createLoading) {
      setError('Room not found');
      return;
    }

    try {
      setError('');
      setJoinLoading(true);

      const response = await fetch(`${backendUrl}/rooms/${code}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (response.status === 401) {
        handleLogout();
        return;
      }

      if (response.status === 404) {
        setError('Room not found');
        return;
      }

      if (!response.ok) {
        throw new Error(data.message || 'Failed to join room');
      }

      navigate(`/chat/${data.code}`, { replace: true });
    } catch (submitError) {
      setError(submitError.message || 'Failed to join room');
    } finally {
      setJoinLoading(false);
    }
  }

  function clearRoomNotFoundError() {
    if (error === 'Room not found') {
      setError('');
    }
  }

  function handleBoxChange(index, event) {
    const char = event.target.value.replace(/[^a-z0-9]/gi, '').slice(-1).toUpperCase();

    setCodeDigits((prev) => {
      const next = [...prev];
      next[index] = char;
      return next;
    });
    clearRoomNotFoundError();

    if (char && index < CODE_LENGTH - 1) {
      boxRefs.current[index + 1]?.focus();
    }
  }

  function handleBoxKeyDown(index, event) {
    if (event.key === 'Backspace') {
      if (!codeDigits[index] && index > 0) {
        event.preventDefault();
        boxRefs.current[index - 1]?.focus();
        setCodeDigits((prev) => {
          const next = [...prev];
          next[index - 1] = '';
          return next;
        });
      }
      clearRoomNotFoundError();
      return;
    }

    if (event.key === 'ArrowLeft' && index > 0) {
      boxRefs.current[index - 1]?.focus();
      return;
    }

    if (event.key === 'ArrowRight' && index < CODE_LENGTH - 1) {
      boxRefs.current[index + 1]?.focus();
      return;
    }

    if (event.key === 'Enter') {
      handleJoinRoom();
    }
  }

  function handleBoxPaste(event) {
    event.preventDefault();
    const pasted = normalizeRoomCode(event.clipboardData.getData('text')).slice(0, CODE_LENGTH);

    if (!pasted) {
      return;
    }

    setCodeDigits(codeToDigits(pasted));
    clearRoomNotFoundError();
    boxRefs.current[Math.min(pasted.length, CODE_LENGTH - 1)]?.focus();
  }

  return (
    <div className="rooms-shell">
      <div className="rooms-topbar">
        <div className="rooms-brand">
          <span className="rooms-brand-mark">C</span>
          <span className="rooms-brand-name">ChatRoom</span>
        </div>
        <div className="rooms-user-chip">
          <span className="rooms-user-avatar">{username.charAt(0).toUpperCase()}</span>
          <span>{username}</span>
          <button className="text-button rooms-logout" type="button" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </div>

      <main className="rooms-main">
        <div className="rooms-content">
          <div className="rooms-intro">
            <p className="eyebrow">Rooms</p>
            <h1>Chat in real time, anywhere</h1>
            <p className="rooms-intro-copy">
              Spin up a room in a second and share the code. Everyone who joins sees the full
              history and stays in sync live.
            </p>
          </div>

          <div className="rooms-features">
            <span className="rooms-feature">
              <span className="rooms-feature-dot" aria-hidden="true" />
              Instant 6-character codes
            </span>
            <span className="rooms-feature">
              <span className="rooms-feature-dot" aria-hidden="true" />
              Live typing indicators
            </span>
            <span className="rooms-feature">
              <span className="rooms-feature-dot" aria-hidden="true" />
              Full message history
            </span>
          </div>

          <div className="rooms-panels">
            <section className="rooms-panel">
              <div className="rooms-panel-icon" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                </svg>
              </div>
              <div className="panel-title">Create a room</div>
              <p className="rooms-copy">Get a fresh, shareable code instantly.</p>
              <input
                className="text-input"
                value={roomName}
                onChange={(event) => setRoomName(event.target.value)}
                placeholder="Room name (optional)"
                autoComplete="off"
              />
              <button
                className="primary-button rooms-action"
                type="button"
                onClick={handleCreateRoom}
                disabled={createLoading}
              >
                {createLoading ? 'Creating...' : 'Create new room'}
              </button>
            </section>

            <div className="rooms-divider" aria-hidden="true">
              <span>OR</span>
            </div>

            <section className="rooms-panel">
              <div className="rooms-panel-icon" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="panel-title">Join with a code</div>
              <p className="rooms-copy">Enter the code your friend shared with you.</p>
              <div className="rooms-code-group" role="group" aria-label="Room code">
                {codeDigits.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => {
                      boxRefs.current[index] = el;
                    }}
                    className={`rooms-code-box${digit ? ' filled' : ''}`}
                    value={digit}
                    onChange={(event) => handleBoxChange(index, event)}
                    onKeyDown={(event) => handleBoxKeyDown(index, event)}
                    onPaste={handleBoxPaste}
                    maxLength={1}
                    inputMode="text"
                    autoComplete="off"
                    aria-label={`Code character ${index + 1}`}
                  />
                ))}
              </div>
              {error ? <div className="auth-error">{error}</div> : null}
              <button
                className="primary-button rooms-action"
                type="button"
                onClick={handleJoinRoom}
                disabled={joinLoading}
              >
                {joinLoading ? 'Joining...' : 'Join room'}
              </button>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}