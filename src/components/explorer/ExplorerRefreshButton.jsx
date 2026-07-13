export default function ExplorerRefreshButton({
  onClick,
  loading = false,
  label = 'Refresh',
}) {
  return (
    <button
      type="button"
      className={`bunker-btn explorer-refresh-btn${loading ? ' is-loading' : ''}`}
      onClick={onClick}
      disabled={loading}
      aria-label={loading ? 'Refreshing data' : 'Refresh data'}
      aria-busy={loading}
    >
      <span
        className={`explorer-refresh-btn__icon${loading ? ' explorer-refresh-btn__icon--spin' : ''}`}
        aria-hidden="true"
      >
        ⟳
      </span>
      {loading ? 'Refreshing…' : label}
    </button>
  );
}