import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import EmojiPicker, { Theme } from 'emoji-picker-react';

const backendUrl = import.meta.env.VITE_BACKEND_URL;

function getToken() {
  return localStorage.getItem('chat_token') || '';
}

function getUsername() {
  return localStorage.getItem('chat_username') || '';
}

function normalizeRoomCode(value) {
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function formatDateLabel(timestamp) {
  const now = new Date();
  const date = new Date(timestamp);

  const formatForZone = (inputDate) =>
    new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    }).format(inputDate);

  const today = formatForZone(now);
  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = formatForZone(yesterdayDate);
  const current = formatForZone(date);

  if (current === today) {
    return 'Today';
  }

  if (current === yesterday) {
    return 'Yesterday';
  }

  return current;
}

function getInitials(name) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

function buildTimelineItems(messages) {
  const items = [];
  let previousMessage = null;

  messages.forEach((message, index) => {
    const label = formatDateLabel(message.created_at);
    const previousLabel = index > 0 ? formatDateLabel(messages[index - 1].created_at) : '';

    if (index === 0 || label !== previousLabel) {
      items.push({
        type: 'separator',
        key: `separator-${label}-${message.id}`,
        label,
      });
    }

    const sameSender = previousMessage && previousMessage.sender_name === message.sender_name;
    const gapMinutes = previousMessage
      ? (new Date(message.created_at).getTime() - new Date(previousMessage.created_at).getTime()) / 60000
      : Number.POSITIVE_INFINITY;

    items.push({
      type: 'message',
      key: `message-${message.id}`,
      message,
      showSenderLabel: !sameSender,
      compactGap: sameSender && gapMinutes <= 5,
      isFirst: index === 0,
    });

    previousMessage = message;
  });

  return items;
}

function insertTextAtCursor(textarea, currentValue, insertedText) {
  const selectionStart = textarea.selectionStart ?? currentValue.length;
  const selectionEnd = textarea.selectionEnd ?? selectionStart;
  const nextValue = `${currentValue.slice(0, selectionStart)}${insertedText}${currentValue.slice(selectionEnd)}`;
  const nextCursor = selectionStart + insertedText.length;

  return { nextValue, nextCursor };
}

function copyToClipboard(value) {
  if (window.navigator?.clipboard?.writeText) {
    return window.navigator.clipboard.writeText(value);
  }

  return Promise.reject(new Error('Clipboard is unavailable'));
}

function ChatSection() {
  const navigate = useNavigate();
  const params = useParams();
  const roomCodeFromRoute = normalizeRoomCode(params.code);
  const [username, setUsername] = useState(() => getUsername());
  const [token, setToken] = useState(() => getToken());
  const [room, setRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [content, setContent] = useState('');
  const [socketStatus, setSocketStatus] = useState('connecting');
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [isLoadingRoom, setIsLoadingRoom] = useState(true);
  const [error, setError] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const messagesListRef = useRef(null);
  const textareaRef = useRef(null);
  const emojiMenuRef = useRef(null);
  const emojiButtonRef = useRef(null);
  const socketRef = useRef(null);
  const typingEmitTimeoutRef = useRef(null);
  const typingStopTimeoutRef = useRef(null);
  const typingActiveRef = useRef(false);
  const readReceiptSentRef = useRef(new Set());
  const shouldStickToBottomRef = useRef(true);
  const copiedCodeTimeoutRef = useRef(null);
  const copiedLinkTimeoutRef = useRef(null);

  const timelineItems = useMemo(() => buildTimelineItems(messages), [messages]);
  const roomShareLink = room?.code ? `${window.location.origin}/chat/${room.code}` : '';
  const visibleUsers = [...new Set([username, ...onlineUsers])];
  const typingText =
    typingUsers.length === 0
      ? ''
      : typingUsers.length === 1
        ? `${typingUsers[0]} is typing...`
        : `${typingUsers.slice(0, 2).join(' and ')}${typingUsers.length > 2 ? ` and ${typingUsers.length - 2} others` : ''} are typing...`;

  function clearTypingTimers() {
    if (typingEmitTimeoutRef.current) {
      window.clearTimeout(typingEmitTimeoutRef.current);
      typingEmitTimeoutRef.current = null;
    }

    if (typingStopTimeoutRef.current) {
      window.clearTimeout(typingStopTimeoutRef.current);
      typingStopTimeoutRef.current = null;
    }
  }

  function stopTyping() {
    const socket = socketRef.current;
    const roomId = room?.room_id;

    clearTypingTimers();

    if (socket && roomId && typingActiveRef.current) {
      socket.emit('stop_typing', { roomId, username });
    }

    typingActiveRef.current = false;
  }

  function handleLogout() {
    stopTyping();

    const socket = socketRef.current;
    if (socket) {
      socket.disconnect();
    }

    localStorage.removeItem('chat_token');
    localStorage.removeItem('chat_username');
    setToken('');
    setUsername('');
    navigate('/login', { replace: true });
  }

  function handleLeaveRoom() {
    stopTyping();
    navigate('/rooms', { replace: true });
  }

  function handleScroll() {
    const element = messagesListRef.current;

    if (!element) {
      return;
    }

    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    shouldStickToBottomRef.current = distanceFromBottom < 96;
  }

  function scrollToBottom() {
    const element = messagesListRef.current;

    if (!element) {
      return;
    }

    element.scrollTo({
      top: element.scrollHeight,
      behavior: 'smooth',
    });
  }

  function queueCopyFeedback(kind) {
    const timeoutRef = kind === 'code' ? copiedCodeTimeoutRef : copiedLinkTimeoutRef;
    const setState = kind === 'code' ? setCopiedCode : setCopiedLink;

    setState(true);

    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(() => {
      setState(false);
      timeoutRef.current = null;
    }, 1500);
  }

  function handleCopyCode() {
    if (!room?.code) {
      return;
    }

    copyToClipboard(room.code)
      .then(() => queueCopyFeedback('code'))
      .catch(() => setError('Failed to copy room code'));
  }

  function handleCopyLink() {
    if (!roomShareLink) {
      return;
    }

    copyToClipboard(roomShareLink)
      .then(() => queueCopyFeedback('link'))
      .catch(() => setError('Failed to copy room link'));
  }

  function handleEmojiInsert(emoji) {
  const textarea = textareaRef.current;

  if (!textarea) {
    return;
  }

  const { nextValue, nextCursor } = insertTextAtCursor(textarea, content, emoji);
  setContent(nextValue);
  textarea.focus();

  window.requestAnimationFrame(() => {
    textarea.setSelectionRange(nextCursor, nextCursor);
  });

  beginTyping(nextValue);
}

  function beginTyping(nextValue) {
    const socket = socketRef.current;
    const roomId = room?.room_id;
    const hasText = nextValue.trim().length > 0;

    clearTypingTimers();

    if (!socket || !roomId) {
      return;
    }

    if (!hasText) {
      stopTyping();
      return;
    }

    if (!typingActiveRef.current) {
      typingEmitTimeoutRef.current = window.setTimeout(() => {
        socket.emit('typing', { roomId, username });
        typingActiveRef.current = true;
      }, 300);
    }

    typingStopTimeoutRef.current = window.setTimeout(() => {
      stopTyping();
    }, 2000);
  }

  function handleSend() {
    const socket = socketRef.current;
    const roomId = room?.room_id;
    const text = content.trim();

    if (!text || !socket || !roomId || !username) {
      return;
    }

    const clientMessageId = window.crypto?.randomUUID?.() ?? `message-${Date.now()}-${Math.random()}`;
    const pendingMessage = {
      id: clientMessageId,
      client_message_id: clientMessageId,
      sender_name: username,
      content: text,
      created_at: new Date().toISOString(),
      status: 'sending',
      animate: true,
    };

    setMessages((current) => [...current, pendingMessage]);
    setContent('');
    setEmojiOpen(false);
    stopTyping();

    socket.emit('send_message', {
      roomId,
      content: text,
      client_message_id: clientMessageId,
    });
  }

  function handleSubmit(event) {
    event.preventDefault();
    handleSend();
  }

  function handleComposerKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  }

  useEffect(() => {
    if (!token || !username) {
      return;
    }

    if (!roomCodeFromRoute) {
      navigate('/rooms', { replace: true });
      return;
    }

    let cancelled = false;

    async function loadRoom() {
      try {
        setIsLoadingRoom(true);
        setError('');
        setRoom(null);
        setMessages([]);
        setOnlineUsers([]);
        setTypingUsers([]);
        shouldStickToBottomRef.current = true;

        const roomResponse = await fetch(`${backendUrl}/rooms/${roomCodeFromRoute}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const roomData = await roomResponse.json();

        if (roomResponse.status === 401) {
          handleLogout();
          return;
        }

        if (roomResponse.status === 404) {
          navigate('/rooms', {
            replace: true,
            state: { joinCode: roomCodeFromRoute, error: 'Room not found' },
          });
          return;
        }

        if (!roomResponse.ok) {
          throw new Error(roomData.message || 'Failed to load room');
        }

        if (cancelled) {
          return;
        }

        setRoom(roomData);

        const messagesResponse = await fetch(`${backendUrl}/rooms/${roomData.room_id}/messages`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const messageData = await messagesResponse.json();

        if (messagesResponse.status === 401) {
          handleLogout();
          return;
        }

        if (!messagesResponse.ok) {
          throw new Error(messageData.message || 'Failed to load messages');
        }

        if (cancelled) {
          return;
        }

        setMessages(Array.isArray(messageData) ? messageData.map((message) => ({ ...message, animate: false })) : []);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError.message || 'Failed to load room');
        }
      } finally {
        if (!cancelled) {
          setIsLoadingRoom(false);
        }
      }
    }

    loadRoom();

    return () => {
      cancelled = true;
    };
  }, [navigate, roomCodeFromRoute, token, username]);

  useEffect(() => {
    if (!token || !username || !room?.room_id) {
      return;
    }

    const socket = io(backendUrl, {
      withCredentials: true,
      auth: { token },
    });

    socketRef.current = socket;

    socket.on('connect', () => setSocketStatus('live'));
    socket.on('disconnect', (reason) => {
      setSocketStatus(reason === 'io client disconnect' ? 'offline' : 'reconnecting');
    });
    socket.on('connect_error', (socketError) => {
      if (String(socketError?.message || '').toLowerCase().includes('unauthorized')) {
        handleLogout();
        return;
      }

      setSocketStatus('reconnecting');
    });
    socket.io.on('reconnect_attempt', () => setSocketStatus('reconnecting'));
    socket.io.on('reconnect_error', () => setSocketStatus('reconnecting'));
    socket.io.on('reconnect', () => setSocketStatus('live'));

    socket.on('online_users', (users) => {
      setOnlineUsers(Array.isArray(users) ? users : []);
    });

    socket.on('typing_users_update', (users) => {
      setTypingUsers(Array.isArray(users) ? users : []);
    });

    socket.on('typing', ({ username: typingUsername }) => {
      if (!typingUsername) {
        return;
      }

      setTypingUsers((current) =>
        current.includes(typingUsername) ? current : [...current, typingUsername].sort((first, second) => first.localeCompare(second))
      );
    });

    socket.on('stop_typing', ({ username: typingUsername }) => {
      if (!typingUsername) {
        return;
      }

      setTypingUsers((current) => current.filter((name) => name !== typingUsername));
    });

    socket.on('receive_message', (message) => {
      if (message.room_id !== room.room_id) {
        return;
      }

      setMessages((current) => {
        const existingIndex = current.findIndex(
          (item) => item.client_message_id && item.client_message_id === message.client_message_id
        );

        if (existingIndex !== -1) {
          const nextMessages = [...current];
          nextMessages[existingIndex] = {
            ...nextMessages[existingIndex],
            ...message,
            status: 'delivered',
            animate: true,
          };

          return nextMessages;
        }

        return [...current, { ...message, status: 'delivered', animate: true }];
      });
    });

    socket.on('message_read_update', ({ message_id, reader_name }) => {
      if (reader_name === username) {
        return;
      }

      setMessages((current) =>
        current.map((message) =>
          message.id === message_id && message.sender_name === username ? { ...message, status: 'read' } : message
        )
      );
    });

    socket.on('room_not_found', () => {
      navigate('/rooms', {
        replace: true,
        state: { joinCode: roomCodeFromRoute, error: 'Room not found' },
      });
    });

    socket.emit('join_room', { roomId: room.room_id, username });

    return () => {
      stopTyping();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [navigate, room?.room_id, roomCodeFromRoute, token, username]);

  useEffect(() => {
    const unreadMessages = messages.filter(
      (message) => message.sender_name !== username && !readReceiptSentRef.current.has(message.id)
    );

    const socket = socketRef.current;

    unreadMessages.forEach((message) => {
      readReceiptSentRef.current.add(message.id);
      socket?.emit('message_read', {
        roomId: room?.room_id,
        message_id: message.id,
      });
    });
  }, [messages, room?.room_id, username]);

  useEffect(() => {
    if (!shouldStickToBottomRef.current) {
      return;
    }

    window.requestAnimationFrame(() => {
      scrollToBottom();
    });
  }, [messages, room?.room_id]);

  useEffect(() => {
    function handleDocumentMouseDown(event) {
      const target = event.target;

      if (!emojiOpen) {
        return;
      }

      if (emojiMenuRef.current?.contains(target) || emojiButtonRef.current?.contains(target)) {
        return;
      }

      setEmojiOpen(false);
    }

    document.addEventListener('mousedown', handleDocumentMouseDown);

    return () => {
      document.removeEventListener('mousedown', handleDocumentMouseDown);
    };
  }, [emojiOpen]);

  useEffect(() => {
    return () => {
      clearTypingTimers();
      stopTyping();

      if (copiedCodeTimeoutRef.current) {
        window.clearTimeout(copiedCodeTimeoutRef.current);
      }

      if (copiedLinkTimeoutRef.current) {
        window.clearTimeout(copiedLinkTimeoutRef.current);
      }
    };
  }, []);

  if (!token || !username) {
    return <Navigate to="/login" replace state={roomCodeFromRoute ? { roomCode: roomCodeFromRoute } : undefined} />;
  }

  if (isLoadingRoom && !room) {
    return (
      <div className="page shell chat-shell">
        <div className="card chat-card chat-loading-card">
          <p className="eyebrow">Conversation</p>
          <h1>Loading room...</h1>
        </div>
      </div>
    );
  }

  function renderMessageItem(item) {
    if (item.type === 'separator') {
      return (
        <div key={item.key} className="date-separator">
          <span>{item.label}</span>
        </div>
      );
    }

    const message = item.message;
    const isMine = message.sender_name === username;
    const showSenderName = item.showSenderLabel && !isMine;

    return (
      <article
        key={item.key}
        className={`message-row ${isMine ? 'mine' : 'theirs'} ${item.compactGap ? 'compact' : 'group'} ${item.isFirst ? 'first' : ''}`}
      >
        <div className={`message-stack ${isMine ? 'mine' : 'theirs'}`}>
          {showSenderName ? <div className="message-sender">{message.sender_name}</div> : null}

          <div className={`message-bubble ${isMine ? 'mine' : 'theirs'} ${message.animate ? 'animate' : ''}`}>
            <div className="message-body">
              <div className="message-text">{message.content}</div>
              <div className="message-meta-line">
                <span className="message-time">{formatTime(message.created_at)}</span>
              </div>
            </div>
          </div>
        </div>
      </article>
    );
  }

  return (
    <div className="page shell chat-shell">
      <div className="chat-layout">
        <div className={`sidebar-backdrop ${showSidebar ? 'active' : ''}`} onClick={() => setShowSidebar(false)} />
        <aside className={`sidebar card ${showSidebar ? 'open' : ''}`}>
          <div className="mobile-sidebar-header">
            <span className="panel-title">Menu</span>
            <button className="mobile-close-button" type="button" onClick={() => setShowSidebar(false)} aria-label="Close sidebar">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div className="sidebar-section">
            <p className="eyebrow">Logged in as</p>
            <h2>{username}</h2>
            <p className={`status ${socketStatus === 'live' ? 'status-on' : 'status-off'}`}>
              {socketStatus === 'live'
                ? 'Live connection'
                : socketStatus === 'reconnecting'
                  ? 'Reconnecting...'
                  : 'Connecting...'}
            </p>
          </div>

          <div className="sidebar-section users-panel">
            <div className="panel-title">Connected users</div>
            <div className="user-list">
              {visibleUsers.map((user) => (
                <div key={user} className={`user-chip ${user === username ? 'self' : ''}`}>
                  <span className="user-avatar-small">{getInitials(user)}</span>
                  <span>{user === username ? 'You' : user}</span>
                </div>
              ))}
            </div>
          </div>

          <button className="secondary-button" type="button" onClick={handleLogout}>
            Log out
          </button>
        </aside>

        <main className="chat-card card">
          <header className="chat-header">
            <div className="chat-header-main">
              <div className="chat-title-header-row">
                <button
                  className="mobile-menu-button"
                  type="button"
                  onClick={() => setShowSidebar(true)}
                  aria-label="Open sidebar"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
                  </svg>
                </button>
                <div className="chat-title-text-block">
                  <p className="eyebrow">Conversation</p>
                  <h1>{room?.name || 'Simple chat room'}</h1>
                </div>
              </div>
              <div className="room-meta-row">
                <span className="room-code-label">Room code</span>
                <span className="room-code-value">{room?.code}</span>
                <button className="icon-button copy-button" type="button" onClick={handleCopyCode} aria-label="Copy room code">
                  {copiedCode ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5ce0bf" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                  )}
                </button>
                <button className="icon-button copy-link-button" type="button" onClick={handleCopyLink} disabled={!roomShareLink} aria-label="Copy share link">
                  {copiedLink ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5ce0bf" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="header-meta chat-actions">
              <button className="secondary-button leave-room-button" type="button" onClick={handleLeaveRoom}>
                Leave room
              </button>
            </div>
          </header>

          <section className="messages-list" ref={messagesListRef} onScroll={handleScroll}>
            {timelineItems.length > 0 ? (
              timelineItems.map((item) => renderMessageItem(item))
            ) : (
              <div className="empty-room-state">No messages yet — say hi 👋</div>
            )}
          </section>

          <div className="typing-indicator-bar">
            {typingText ? <span className="typing-indicator-text">{typingText}</span> : null}
          </div>

          <form className="composer" onSubmit={handleSubmit}>
            <div className="composer-shell">
              <button
                ref={emojiButtonRef}
                className="emoji-button"
                type="button"
                onClick={() => {
                  setEmojiOpen((current) => {
                    if (!current) {
                      textareaRef.current?.blur();
                    }
                    return !current;
                  });
                }}
                aria-label="Open emoji picker"
              >
                😊
              </button>

              <textarea
                ref={textareaRef}
                className="text-input composer-input"
                rows={1}
                value={content}
                onChange={(event) => {
                  setContent(event.target.value);
                  beginTyping(event.target.value);
                }}
                onKeyDown={handleComposerKeyDown}
                onBlur={() => stopTyping()}
                onFocus={() => setEmojiOpen(false)}
                placeholder="Type a message..."
                autoComplete="off"
              />

              <button className="send-button" type="submit" disabled={!content.trim()} aria-label="Send message">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 20.5V3.5l18 8.5-18 8.5zm2.75-4.08L16.18 12 5.75 7.58v2.86L11.4 12l-5.65 1.56v2.86z" />
                </svg>
              </button>

              {emojiOpen ? (
                <div className="emoji-popover" ref={emojiMenuRef}>
                  <EmojiPicker
                    theme={Theme.DARK}
                    onEmojiClick={(emojiData) => handleEmojiInsert(emojiData.emoji)}
                    width="100%"
                    height={380}
                    searchDisabled={false}
                    skinTonesDisabled
                    previewConfig={{ showPreview: false }}
                    lazyLoadEmojis
                  />
                </div>
              ) : null}
            </div>
          </form>

          {error ? <div className="room-error-banner">{error}</div> : null}
        </main>
      </div>
    </div>
  );
}

export default ChatSection;