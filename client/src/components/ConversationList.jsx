import Avatar from './Avatar';

const relativeTime = (iso) => {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const ConversationList = ({ conversations, activeId, onlineIds, onSelect }) => {
  if (conversations.length === 0) {
    return <p className="sidebar-empty">No conversations yet. Start one from the search box.</p>;
  }

  return (
    <ul className="conversation-list">
      {conversations.map((conversation) => {
        const counterpart = conversation.counterpart;
        const isOnline = counterpart ? onlineIds.has(counterpart.id) : false;

        const preview = conversation.lastMessage
          ? conversation.lastMessage.senderId === counterpart?.id || conversation.type === 'DIRECT'
            ? `${conversation.lastMessage.body}`
            : `${conversation.lastMessage.sender.displayName}: ${conversation.lastMessage.body}`
          : 'No messages yet';

        return (
          <li key={conversation.id}>
            <button
              type="button"
              className={`conversation-item ${conversation.id === activeId ? 'is-active' : ''}`}
              onClick={() => onSelect(conversation.id)}
            >
              <Avatar
                user={counterpart || { displayName: conversation.name, avatarColor: '#6b7280' }}
                online={counterpart ? isOnline : null}
              />
              <span className="conversation-body">
                <span className="conversation-title">
                  {counterpart?.displayName || conversation.name}
                </span>
                <span className="conversation-preview">{preview}</span>
              </span>
              <span className="conversation-meta">
                <span className="conversation-time">
                  {conversation.lastMessage ? relativeTime(conversation.lastMessage.createdAt) : ''}
                </span>
                {conversation.unreadCount > 0 && (
                  <span className="unread-badge">{conversation.unreadCount}</span>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
};

export default ConversationList;
