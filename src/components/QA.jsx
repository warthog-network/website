function QA({ question, children }) {
  return (
    <details className="group p-4 border border-gray-300 rounded-md">
      <summary className="font-semibold cursor-pointer group-open:text-blue-500">
      {question}
      </summary>
      <div className="mt-2 text-gray-700 group-open:bg-gray-100">
      {children}
      </div>
    </details>
  );
}

export default QA
