import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../services/api';
import { getSocket, SOCKET_EVENT } from '../services/socket';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/Avatar';
import ConversationList from '../components/ConversationList';
import MessageList from '../components/MessageList';
import MessageInput from '../components/MessageInput';
import NewChatPanel from '../components/NewChatPanel';

const ChatPage = () => {
  const { user, logout } = useAuth();

  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [onlineIds, setOnlineIds] = useState(() => new Set());
  const [showNewChat, setShowNewChat] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState(null);

  const socket = getSocket();
  const bottomRef = useRef(null);
  const activeIdRef = useRef(null);

  // Kept in a ref so the socket handlers below can read the current value
  // without re-subscribing on every selection change.
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  const loadConversations = useCallback(async () => {
    try {
      const { conversations: list } = await api.listConversations();
      setConversations(list);
      return list;
    } catch (err) {
      setError(err.message);
      return [];
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Load history whenever the active conversation changes.
  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }

    let cancelled = false;
    setLoadingMessages(true);

    (async () => {
      try {
        const { messages: history } = await api.listMessages(activeId);
        if (cancelled) return;
        setMessages(history);
        await api.markRead(activeId);
        setConversations((previous) =>
          previous.map((c) => (c.id === activeId ? { ...c, unreadCount: 0 } : c))
        );
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoadingMessages(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeId]);

  // Socket subscriptions.
  useEffect(() => {
    socket.on('connect', loadConversations);

    socket.on(SOCKET_EVENT.MESSAGE_RECEIVED, (message) => {
      // The server echoes a sender's own message back to the sender's socket
      // room, and the ack returns it too. Keying on clientMessageId means the
      // optimistic bubble, the ack and the broadcast collapse into one entry.
      setMessages((previous) => {
        const alreadyPresent = previous.some(
          (m) =>
            m.id === message.id ||
            (message.clientMessageId && m.clientMessageId === message.clientMessageId)
        );
        if (alreadyPresent) return previous;
        return [...previous, message];
      });

      // A message for a conversation that is not open bumps the unread badge.
      if (message.conversationId !== activeIdRef.current && message.senderId !== user.id) {
        setConversations((previous) =>
          previous.map((c) =>
            c.id === message.conversationId ? { ...c, unreadCount: c.unreadCount + 1 } : c
          )
        );
      }
    });

    socket.on(SOCKET_EVENT.USER_ONLINE, ({ userId }) => {
      setOnlineIds((previous) => new Set(previous).add(userId));
    });

    socket.on(SOCKET_EVENT.USER_OFFLINE, ({ userId }) => {
      setOnlineIds((previous) => {
        const next = new Set(previous);
        next.delete(userId);
        return next;
      });
    });

    socket.on('connect_error', (err) => setError(`Real-time connection failed: ${err.message}`));

    return () => {
      socket.off('connect', loadConversations);
      socket.off(SOCKET_EVENT.MESSAGE_RECEIVED);
      socket.off(SOCKET_EVENT.USER_ONLINE);
      socket.off(SOCKET_EVENT.USER_OFFLINE);
      socket.off('connect_error');
    };
  }, [socket, loadConversations, user.id]);

  // Tell the server which conversation this socket is now viewing.
  useEffect(() => {
    if (activeId) {
      socket.emit(SOCKET_EVENT.JOIN_CONVERSATION, { conversationId: activeId });
      socket.emit(SOCKET_EVENT.MARK_READ, { conversationId: activeId });
    }
  }, [activeId, socket]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = (body) => {
    if (!activeId) return;

    const clientMessageId = crypto.randomUUID();

    setMessages((previous) => [
      ...previous,
      {
        id: `pending-${clientMessageId}`,
        conversationId: activeId,
        body,
        senderId: user.id,
        clientMessageId,
        createdAt: new Date().toISOString(),
        pending: true,
        sender: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          avatarColor: user.avatarColor,
        },
      },
    ]);

    socket.emit(SOCKET_EVENT.SEND_MESSAGE, { conversationId: activeId, body, clientMessageId }, (ack) => {
      if (!ack?.ok) {
        setMessages((previous) =>
          previous.map((m) =>
            m.clientMessageId === clientMessageId ? { ...m, pending: false, failed: true } : m
          )
        );
        return;
      }

      setMessages((previous) =>
        previous.map((m) => (m.clientMessageId === clientMessageId ? ack.message : m))
      );
    });
  };

  const handleStartDirect = async (userId) => {
    try {
      const { conversation } = await api.startDirect(userId);
      await loadConversations();
      setActiveId(conversation.id);
      setShowNewChat(false);
    } catch (err) {
      setError(err.message);
    }
  };

  const active = useMemo(
    () => conversations.find((c) => c.id === activeId) || null,
    [conversations, activeId]
  );

  const title = active
    ? active.counterpart?.displayName || active.name
    : 'Select a conversation';

  const isCounterpartOnline = active?.counterpart ? onlineIds.has(active.counterpart.id) : false;

  return (
    <div className="chat-container">
      <aside className="sidebar">
        <header className="sidebar-header">
          <div className="me">
            <Avatar user={user} size={38} />
            <div>
              <strong>{user.displayName}</strong>
              <span className="user-handle">@{user.username}</span>
            </div>
          </div>
          <button type="button" className="link-button" onClick={logout}>
            Log out
          </button>
        </header>

        <button type="button" className="new-chat-button" onClick={() => setShowNewChat((v) => !v)}>
          {showNewChat ? 'Close search' : '+ New chat'}
        </button>

        {showNewChat ? (
          <NewChatPanel onStartDirect={handleStartDirect} onClose={() => setShowNewChat(false)} />
        ) : (
          <ConversationList
            conversations={conversations}
            activeId={activeId}
            onlineIds={onlineIds}
            onSelect={setActiveId}
          />
        )}
      </aside>

      <main className="conversation">
        <header className="conversation-header">
          {active?.counterpart && (
            <Avatar
              user={active.counterpart}
              size={36}
              online={isCounterpartOnline}
            />
          )}
          <div>
            <h2>{title}</h2>
            {active?.counterpart && (
              <span className="conversation-status">
                {isCounterpartOnline ? 'Online' : 'Offline'}
              </span>
            )}
          </div>
        </header>

        {error && <div className="form-error">{error}</div>}

        <MessageList
          messages={messages}
          currentUserId={user.id}
          loading={loadingMessages}
        />

        {activeId ? (
          <MessageInput onSend={handleSend} />
        ) : (
          <p className="conversation-placeholder">
            Pick someone from the list, or use “New chat” to start a conversation.
          </p>
        )}

        <div ref={bottomRef} />
      </main>
    </div>
  );
};

export default ChatPage;
