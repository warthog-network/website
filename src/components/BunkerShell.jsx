import WarthogBrandHeader from './WarthogBrandHeader.jsx';

export default function BunkerShell({
  title,
  wide = false,
  showBrand = true,
  actions = null,
  children,
}) {
  return (
    <div className="wartbunker-page">
      <div className={`container${wide ? ' container--wide' : ''}`}>
        {showBrand ? (
          <div className="wartbunker-brand-row">
            <WarthogBrandHeader />
          </div>
        ) : null}
        {title || actions ? (
          <div className="bunker-page-header">
            {title ? <h1>{title}</h1> : <span />}
            {actions ? <div className="bunker-page-actions">{actions}</div> : null}
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}