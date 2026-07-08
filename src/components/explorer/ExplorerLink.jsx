import { Link } from 'react-router-dom';

/**
 * In-app explorer navigation — no full page reload.
 * Falls back to a normal <a> when rendered outside a Router (shouldn't happen).
 */
export default function ExplorerLink({ to, children, className, style, ...rest }) {
  return (
    <Link to={to} className={className} style={style} {...rest}>
      {children}
    </Link>
  );
}
