import WarthogBrandHeader from './WarthogBrandHeader.jsx';

export default function BunkerShell({ title, wide = false, showBrand = true, children }) {
  return (
    <div className="wartbunker-page">
      <div className={`container${wide ? ' container--wide' : ''}`}>
        {showBrand ? (
          <div className="wartbunker-brand-row">
            <WarthogBrandHeader />
          </div>
        ) : null}
        {title ? <h1>{title}</h1> : null}
        {children}
      </div>
    </div>
  );
}