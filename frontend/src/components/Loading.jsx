function Loading() {
  return (
    <div className="d-flex mb-3">
      <div
        className="bg-white p-3 rounded shadow-sm"
        style={{ maxWidth: "150px" }}
      >
        <div className="fw-bold mb-2">
          Aadrik AI
        </div>

        <div className="d-flex gap-2">
          <span className="spinner-grow spinner-grow-sm"></span>
          <span className="spinner-grow spinner-grow-sm"></span>
          <span className="spinner-grow spinner-grow-sm"></span>
        </div>
      </div>
    </div>
  );
}

export default Loading;