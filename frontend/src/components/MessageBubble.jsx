import ReactMarkdown from "react-markdown";

function MessageBubble({ sender, text, sources = [] }) {
  const isUser = sender === "You";

  return (
    <div
      className={`d-flex mb-3 ${
        isUser ? "justify-content-end" : "justify-content-start"
      }`}
    >
      <div
        className={`p-3 rounded shadow-sm ${
          isUser ? "bg-primary text-white" : "bg-white"
        }`}
        style={{
          maxWidth: "65%",
          whiteSpace: "pre-wrap",
        }}
      >
        <div className="fw-bold mb-2">{sender}</div>

        {isUser ? (
          <div>{text}</div>
        ) : (
          <ReactMarkdown>{text}</ReactMarkdown>
        )}

        {!isUser && sources.length > 0 && (
          <div className="mt-4">
            <small className="text-muted fw-bold">
              📄 Sources
            </small>

            <div className="mt-2 d-flex flex-wrap gap-2">
              {sources.map((source, index) => (
                <span
                  key={index}
                  className="badge bg-secondary"
                >
                  {source}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default MessageBubble;