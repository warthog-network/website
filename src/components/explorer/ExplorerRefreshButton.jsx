export default function ExplorerRefreshButton({
  onClick,
  loading = false,
  label = 'Refresh',
}) {
  return (
    <button
      type="button"
      className="bunker-btn bunker-btn--ghost explorer-refresh-btn"
      onClick={onClick}
      disabled={loading}
      aria-label={loading ? 'Refreshing data' : 'Refresh data'}
    >
      <span className="explorer-refresh-btn__icon" aria-hidden="true">⟳</span>
      {loading ? 'Refreshing…' : label}
    </button>
  );
}