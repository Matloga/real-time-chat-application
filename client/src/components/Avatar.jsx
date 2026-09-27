const initials = (name = '') =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || '')
    .join('')
    .toUpperCase() || '?';

const Avatar = ({ user, size = 40, online = null }) => (
  <div className="avatar-wrap" style={{ width: size, height: size }}>
    <div
      className="avatar"
      style={{ background: user?.avatarColor || '#4f6bed', fontSize: size * 0.38 }}
      aria-hidden="true"
    >
      {initials(user?.displayName || user?.username)}
    </div>
    {online !== null && (
      <span
        className={`presence-dot ${online ? 'is-online' : 'is-offline'}`}
        title={online ? 'Online' : 'Offline'}
      />
    )}
  </div>
);

export default Avatar;
