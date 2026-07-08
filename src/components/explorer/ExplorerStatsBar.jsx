import { useEffect, useState, useMemo, useRef } from 'react';
import { createWarthogApi } from './explorerClient.js';
import { resolveExplorerHostFromStorage } from '../../lib/explorerNodes.js';
import { fetchExplorerLiveStats } from '../../lib/explorerStats.js';
import {
  readExplorerStatsCache,
  writeExplorerStatsCache,
} from '../../lib/explorerSessionCache.js';

/**
 * Smooth path with Chart.js-like tension.
 * Control points are clamped in Y so bends stay gentle and stroke doesn't pile up.
 */
function tensionPath(coords, tension = 0.3) {
  if (coords.length === 0) return '';
  if (coords.length === 1) return `M${coords[0].x},${coords[0].y}`;
  if (coords.length === 2) {
    return `M${coords[0].x},${coords[0].y} L${coords[1].x},${coords[1].y}`;
  }

  const ys = coords.map((c) => c.y);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const clampY = (y) => Math.min(yMax, Math.max(yMin, y));

  let d = `M${coords[0].x.toFixed(2)},${coords[0].y.toFixed(2)}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[i - 1] || coords[i];
    const p1 = coords[i];
    const p2 = coords[i + 1];
    const p3 = coords[i + 2] || p2;
    // Scale horizontal handles by segment length so sharp peaks don't balloon
    const seg = Math.max(1, p2.x - p1.x);
    const t = tension;
    const cp1x = p1.x + seg * t;
    const cp1y = clampY(p1.y + (p2.y - p0.y) * t);
    const cp2x = p2.x - seg * t;
    const cp2y = clampY(p2.y - (p3.y - p1.y) * t);
    d += ` C${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
  }
  return d;
}

function TpsSparkline({ points, width = 148, height = 52 }) {
  const linePath = useMemo(() => {
    if (!points?.length) return '';

    // Match Chart.js: y baseline at 0 so bumps stay readable
    const max = Math.max(...points, 0.05);
    const padY = 6;
    const usableH = height - padY * 2;
    const stepX = points.length > 1 ? width / (points.length - 1) : width;

    const coords = points.map((v, i) => ({
      x: i * stepX,
      y: padY + usableH - (v / max) * usableH,
    }));

    return tensionPath(coords, 0.3);
  }, [points, width, height]);

  if (!linePath) {
    return (
      <svg className="explorer-stats__spark" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
        <line
          x1="0"
          y1={height - 6}
          x2={width}
          y2={height - 6}
          stroke="currentColor"
          strokeOpacity="0.2"
          strokeWidth="1.5"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    );
  }

  return (
    <svg
      className="explorer-stats__spark"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d={linePath}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        /* Keeps stroke width even when the SVG is stretched non-uniformly */
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function StatCell({ label, value, loading }) {
  return (
    <div className="explorer-stats__cell">
      <div className="explorer-stats__label">{label}</div>
      <div className={`explorer-stats__value${loading ? ' is-loading' : ''}`}>
        {loading ? '…' : value}
      </div>
    </div>
  );
}

/**
 * Wartscan-style live network / market strip for the explorer shell.
 */
export default function ExplorerStatsBar({ host, refreshToken = 0 }) {
  const nodeHost = host || (typeof window !== 'undefined' ? resolveExplorerHostFromStorage() : '');
  const cached = nodeHost ? readExplorerStatsCache(nodeHost) : null;
  const [stats, setStats] = useState(cached);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState(null);
  const apiRef = useRef(null);
  const hostRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let interval;

    const load = async () => {
      try {
        const activeHost = host || resolveExplorerHostFromStorage();
        if (!activeHost) return;

        // Hydrate from session cache on SPA return
        const fromCache = readExplorerStatsCache(activeHost);
        if (fromCache && !cancelled) {
          setStats(fromCache);
          setLoading(false);
        }

        if (!apiRef.current || hostRef.current !== activeHost) {
          apiRef.current = await createWarthogApi(activeHost);
          hostRef.current = activeHost;
        }

        const next = await fetchExplorerLiveStats(apiRef.current);
        if (cancelled) return;
        setStats(next);
        writeExplorerStatsCache(activeHost, next);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        console.error('Explorer stats failed', err);
        setError(err?.message || 'Stats unavailable');
        apiRef.current = null;
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    if (!stats) setLoading(true);
    load();
    interval = setInterval(load, 15_000);

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host, refreshToken]);

  const showLoading = loading && !stats;

  return (
    <div className="explorer-stats bunker-panel" aria-live="polite">
      <div className="explorer-stats__grid">
        <StatCell label="Hashrate" value={stats?.hashrateLabel} loading={showLoading} />
        <StatCell label="Height" value={stats?.heightLabel} loading={showLoading} />
        <StatCell label="Price" value={stats?.priceLabel} loading={showLoading} />
        <StatCell label="Block Reward" value={stats?.rewardLabel} loading={showLoading} />
        <StatCell label="Supply" value={stats?.supplyLabel} loading={showLoading} />
        <StatCell label="Marketcap" value={stats?.marketCapLabel} loading={showLoading} />
        <div className="explorer-stats__cell explorer-stats__cell--spark">
          <div className="explorer-stats__spark-head">
            <span className="explorer-stats__label">tps</span>
          </div>
          <TpsSparkline points={stats?.tpsPoints || []} />
        </div>
      </div>
      {error && !stats && (
        <p className="explorer-stats__error bunker-muted">{error}</p>
      )}
    </div>
  );
}
