function QA({ question, children }) {
  return (
    <details className="p-4 border border-gray-300 rounded-md">
      <summary className="font-semibold cursor-pointer">
      {question}
      </summary>
    <div class="pt-3 tracking-tight leading-5">
      {children}
    </div>
    </details>
  );
}

export default QA
