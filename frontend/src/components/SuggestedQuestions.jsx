function SuggestedQuestions({ onSelect }) {
  const questions = [
    "What products do you supply?",
    "What are your payment terms?",
    "How do I request a quotation?",
    "Do you deliver outside Chennai?",
  ];

  return (
    <div className="mb-4">
      <h5 className="mb-3">Suggested Questions</h5>

      <div className="d-flex flex-wrap gap-2">
        {questions.map((q, index) => (
          <button
            key={index}
            className="btn btn-outline-primary"
            onClick={() => onSelect(q)}
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

export default SuggestedQuestions;