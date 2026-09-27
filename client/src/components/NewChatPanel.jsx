import { useEffect, useState } from 'react';
import { api } from '../services/api';
import Avatar from './Avatar';

/**
 * Search-as-you-type user picker for starting a new direct chat.
 * Selecting a user calls onStartDirect, which creates the conversation if the
 * pair does not already have one.
 */
const NewChatPanel = ({ onStartDirect, onClose }) => {
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    // Debounce so we are not firing a request on every keystroke.
    const timer = setTimeout(async () => {
      try {
        const { users: found } = await api.listUsers(search);
        if (!cancelled) setUsers(found);
      } catch (err) {
        if (!cancelled) setUsers([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search]);

  return (
    <div className="new-chat">
      <div className="new-chat-header">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or username…"
          autoFocus
          aria-label="Search users"
        />
        <button type="button" className="link-button" onClick={onClose}>
          Close
        </button>
      </div>

      {loading && <p className="sidebar-empty">Searching…</p>}

      {!loading && users.length === 0 && (
        <p className="sidebar-empty">
          {search ? `No users match “${search}”.` : 'No other users have registered yet.'}
        </p>
      )}

      <ul className="user-list">
        {users.map((candidate) => (
          <li key={candidate.id}>
            <button type="button" onClick={() => onStartDirect(candidate.id)}>
              <Avatar user={candidate} size={36} />
              <span>
                <span className="user-name">{candidate.displayName}</span>
                <span className="user-handle">@{candidate.username}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default NewChatPanel;
