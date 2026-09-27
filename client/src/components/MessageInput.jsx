import { useState } from 'react';

const MessageInput = ({ onSend, disabled }) => {
  const [value, setValue] = useState('');

  const submit = (event) => {
    event.preventDefault();
    const body = value.trim();
    if (!body) return;
    onSend(body);
    setValue('');
  };

  // Enter sends, Shift+Enter inserts a newline.
  const onKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      submit(event);
    }
  };

  return (
    <form className="message-input" onSubmit={submit}>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Write a message…  (Enter to send, Shift+Enter for a new line)"
        rows={1}
        maxLength={4000}
        disabled={disabled}
        aria-label="Message"
      />
      <button type="submit" disabled={disabled || value.trim().length === 0}>
        Send
      </button>
    </form>
  );
};

export default MessageInput;
