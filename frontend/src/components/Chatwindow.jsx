import { useEffect, useRef } from "react";
import MessageBubble from "./MessageBubble";
import Loading from "./Loading";

function Chatwindow({ chat, loading }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    if (chat.length === 0 && !loading) return;

    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [chat, loading]);

  return (
    <div
      className="bg-light rounded shadow-sm p-4"
      style={{
        height: "calc(100vh - 170px)",
        overflowY: "auto",
      }}
    >
      {chat.length === 0 && (
        <div className="text-center text-muted mt-5">
          <h4>👋 Welcome to Aadrik AI</h4>

          <p>
            Ask me anything about products, policies,
            quotations, or company information.
          </p>
        </div>
      )}

      {chat.map((message, index) => (
        <MessageBubble
          key={index}
          sender={message.sender}
          text={message.text}
          sources={message.sources}
        />
      ))}

      {loading && <Loading />}

      <div ref={bottomRef}></div>
    </div>
  );
}

export default Chatwindow;