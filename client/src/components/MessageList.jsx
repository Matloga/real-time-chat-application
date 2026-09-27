const formatTime = (iso) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const formatDayDivider = (iso) => {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a, b) => a.toDateString() === b.toDateString();
  if (sameDay(date, today)) return 'Today';
  if (sameDay(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
};

const MessageList = ({ messages, currentUserId, loading }) => {
  if (loading) {
    return (
      <div className="message-list is-loading">
        <p>Loading messages…</p>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="message-list is-empty">
        <p>No messages yet. Say hello.</p>
      </div>
    );
  }

  let lastDay = null;

  return (
    <div className="message-list">
      {messages.map((message) => {
        const day = new Date(message.createdAt).toDateString();
        const showDivider = day !== lastDay;
        lastDay = day;

        const mine = message.senderId === currentUserId;

        return (
          <div key={message.id}>
            {showDivider && <div className="day-divider">{formatDayDivider(message.createdAt)}</div>}
            <div className={`message-row ${mine ? 'is-mine' : 'is-theirs'}`}>
              {!mine && (
                <span
                  className="message-avatar"
                  style={{ background: message.sender.avatarColor }}
                  aria-hidden="true"
                >
                  {message.sender.displayName?.[0]?.toUpperCase() || '?'}
                </span>
              )}
              <div className="message-bubble-wrap">
                {!mine && <span className="message-author">{message.sender.displayName}</span>}
                <div className={`message-bubble ${mine ? 'is-mine' : ''}`}>{message.body}</div>
                <time className="message-time" dateTime={message.createdAt}>
                  {formatTime(message.createdAt)}
                </time>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default MessageList;
