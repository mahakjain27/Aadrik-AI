import { useState } from "react";

function ChatInput({ onSend, loading }) {
  const [message, setMessage] = useState("");

  function send() {
    if (!message.trim()) return;

    onSend(message);
    setMessage("");
  }

  return (
    <div className="input-group mt-3">
      <input
        className="form-control"
        placeholder="Ask Aadrik AI..."
        value={message}
        disabled={loading}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") send();
        }}
      />

      <button
        className="btn btn-primary"
        onClick={send}
        disabled={loading}
      >
        Send
      </button>
    </div>
  );
}

export default ChatInput;