import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const backendUrl = import.meta.env.VITE_BACKEND_URL;

function getAuthEndpoint(mode) {
  return mode === 'register' ? '/auth/register' : '/auth/login';
}

export default function LoginSection() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState(() => localStorage.getItem('chat_username') || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const title = useMemo(() => (mode === 'register' ? 'Create your account' : 'Welcome back'), [mode]);
  const subtitle = useMemo(
    () =>
      mode === 'register'
        ? 'Pick a username — it\u2019s what everyone in the room will see you as.'
        : 'Sign in to jump back into your rooms.',
    [mode]
  );
  const sharedRoomCode = typeof location.state?.roomCode === 'string' ? location.state.roomCode.trim().toUpperCase() : '';

  function switchMode(nextMode) {
    if (isSubmitting || nextMode === mode) {
      return;
    }
    setError('');
    setMode(nextMode);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (isSubmitting) {
      return;
    }

    const trimmedUsername = username.trim();

    if (!trimmedUsername || !password) {
      setError('Username and password are required.');
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await fetch(`${backendUrl}${getAuthEndpoint(mode)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: trimmedUsername, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Authentication failed');
      }

      localStorage.setItem('chat_token', data.token);
      localStorage.setItem('chat_username', data.username);
      navigate(sharedRoomCode ? `/rooms/${sharedRoomCode}` : '/rooms', { replace: true });
    } catch (submitError) {
      setError(submitError.message || 'Authentication failed');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="login-shell">
      <aside className="login-aside">
        <div className="login-brand">
          <span className="login-brand-mark">C</span>
          <span className="login-brand-name">ChatRoom</span>
        </div>

        <div className="login-aside-copy">
          <p className="eyebrow">Real-time chat</p>
          <h1>Conversations that keep up with you</h1>
          <p className="login-aside-subtitle">
            Create a room, share a code, and talk in real time with anyone — no downloads,
            no setup.
          </p>
        </div>

        <ul className="login-feature-list">
          <li className="login-feature">
            <span className="login-feature-dot" aria-hidden="true" />
            Instant 6-character room codes
          </li>
          <li className="login-feature">
            <span className="login-feature-dot" aria-hidden="true" />
            Live typing indicators
          </li>
          <li className="login-feature">
            <span className="login-feature-dot" aria-hidden="true" />
            Full message history, saved per room
          </li>
        </ul>
      </aside>

      <div className="login-panel">
        <div className="card login-card">
          <div className="login-tabs" role="tablist">
            <button
              className={`login-tab${mode === 'login' ? ' active' : ''}`}
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              disabled={isSubmitting}
              onClick={() => switchMode('login')}
            >
              Log in
            </button>
            <button
              className={`login-tab${mode === 'register' ? ' active' : ''}`}
              type="button"
              role="tab"
              aria-selected={mode === 'register'}
              disabled={isSubmitting}
              onClick={() => switchMode('register')}
            >
              Sign up
            </button>
          </div>

          <h2>{title}</h2>
          <p className="auth-subtitle">{subtitle}</p>

          <form className="auth-form" onSubmit={handleSubmit}>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Username"
              className="text-input"
              autoComplete="username"
              disabled={isSubmitting}
            />
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              className="text-input"
              type="password"
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              disabled={isSubmitting}
            />

            {error ? <div className="auth-error">{error}</div> : null}

            <button className="primary-button" type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? mode === 'register'
                  ? 'Creating account...'
                  : 'Logging in...'
                : mode === 'register'
                  ? 'Create account'
                  : 'Log in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}