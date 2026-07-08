import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import Explorer from './explorer.jsx';
import BlockDetails from './blockdetails.jsx';
import TransactionDetails from './TransactionDetails.jsx';
import AddressTransactions from './AddressTransactions.jsx';
import BlockHexView from './hex.jsx';


function DocumentTitle() {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname;
    let title = 'Explorer · Warthog';

    if (path.startsWith('/chain/block/')) {
      title = `Block ${path.split('/').pop()} · Warthog`;
    } else if (path.startsWith('/block/') && path.endsWith('/hex')) {
      const parts = path.split('/');
      title = `Block ${parts[2]} hex · Warthog`;
    } else if (path.startsWith('/transaction/lookup/')) {
      title = `Transaction · Warthog`;
    } else if (path.startsWith('/address/')) {
      title = `Address · Warthog`;
    } else if (path === '/explorer' || path === '/explorer/') {
      title = 'Explorer · Warthog';
    }

    document.title = title;
  }, [location.pathname]);

  return null;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function ExplorerRoutes() {
  return (
    <>
      <DocumentTitle />
      <ScrollToTop />
      <Routes>
        <Route path="/explorer" element={<Explorer />} />
        <Route path="/explorer/" element={<Explorer />} />
        <Route path="/chain/block/:height" element={<BlockDetails />} />
        <Route path="/block/:height/hex" element={<BlockHexView />} />
        <Route path="/transaction/lookup/:txid" element={<TransactionDetails />} />
        <Route path="/address/:address" element={<AddressTransactions />} />
        {/* Unknown explorer-adjacent paths → main explorer */}
        <Route path="*" element={<Navigate to="/explorer" replace />} />
      </Routes>
    </>
  );
}

/**
 * Single-page shell for all explorer views.
 * Every explorer Astro page mounts this so internal links stay client-side.
 */
export default function ExplorerApp() {
  return (
    <BrowserRouter>
      <ExplorerRoutes />
    </BrowserRouter>
  );
}
