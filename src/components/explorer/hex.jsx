import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import BunkerShell from '../BunkerShell.jsx';
import { resolveExplorerHostFromStorage } from '../../lib/explorerNodes.js';
import { unwrapApiData } from '../../lib/warthogClient.js';
import { createWarthogApi } from './explorerClient.js';
import ExplorerLink from './ExplorerLink.jsx';

export default function BlockHexView({ height: heightProp } = {}) {
  const params = useParams();
  const height = heightProp ?? params.height;
  const containerRef = useRef(null);
  const breadcrumbsRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadBinary() {
      try {
        setLoading(true);
        setError(null);

        const api = await createWarthogApi(resolveExplorerHostFromStorage());
        const apiData = unwrapApiData(
          await api.getNodePath(`/chain/block/${height}/binary`),
        );

        if (!apiData?.bytes || !Array.isArray(apiData.structure)) {
          throw new Error('Invalid response: missing bytes or structure in data');
        }

        process_tree(apiData);
      } catch (err) {
        console.error('Failed to load block binary:', err);
        setError(err.message || 'Failed to load binary data');
      } finally {
        setLoading(false);
      }
    }

    function process_child(hex, parentNode, child, childIndex) {
      const span = document.createElement('span');
      parentNode.appendChild(span);
      span.begin = child.offsetBegin;
      span.end = child.offsetEnd;
      span.tag = child.tag;
      span.index = childIndex;

      if (child.children.length === 0) {
        span.textContent = hex.substring(2 * child.offsetBegin, 2 * child.offsetEnd);
        span.classList.add('leaf');

        span.addEventListener('mouseover', (e) => {
          const target = e.target;
          const list = [];
          let cur = target;
          while (cur && cur.getAttribute && cur.getAttribute('tag') !== 'block') {
            list.unshift(`${cur.tag}[${cur.begin}:${cur.end}]`);
            cur = cur.parentElement;
          }
          if (breadcrumbsRef.current) {
            breadcrumbsRef.current.textContent = list.join(' 〉 ');
          }
        });

        span.addEventListener('click', () => {
          const textToCopy = span.textContent + ' ' + breadcrumbsRef.current.textContent;
          navigator.clipboard.writeText(textToCopy).then(() => {
            alert('Copied to clipboard!');
          }).catch(err => {
            console.error('Failed to copy: ', err);
          });
        });
      } else {
        process_children(hex, span, child.children);
      }
    }

    function process_children(hex, parentNode, children) {
      let cursor = parentNode.begin;
      let i = 0;
      for (const child of children) {
        const begin = child.offsetBegin;
        if (begin > cursor) {
          process_child(
            hex,
            parentNode,
            { offsetBegin: cursor, offsetEnd: begin, tag: 'unknown', children: [] },
            i++
          );
        }
        process_child(hex, parentNode, child, i++);
        cursor = child.offsetEnd;
      }
      if (cursor < parentNode.end) {
        process_child(
          hex,
          parentNode,
          { offsetBegin: cursor, offsetEnd: parentNode.end, tag: 'unknown', children: [] },
          i++
        );
      }
    }

    function process_tree({ bytes, structure }) {
      const container = containerRef.current;
      if (!container) return;

      container.innerHTML = '';
      const hex = bytes;
      container.begin = 0;
      container.end = hex.length / 2;
      container.setAttribute('tag', 'block');

      process_children(hex, container, structure);
    }

    loadBinary();
  }, [height]);

  return (
    <BunkerShell title={`Block ${height} – Raw Binary View`} wide>
      <div ref={breadcrumbsRef} className="bunker-hex-breadcrumbs" />

      {loading && <p className="bunker-muted">Loading binary data...</p>}
      {error && (
        <div className="bunker-alert bunker-alert--error">
          <strong>Error:</strong> {error}
        </div>
      )}

      <div className="bunker-hex-scroll">
        <code ref={containerRef} className="bunker-hex-code" />
      </div>

      <ExplorerLink to={`/chain/block/${height}`} className="bunker-btn">
        Back to Block Details
      </ExplorerLink>

      <style>{`
        .bunker-hex-code .leaf {
          cursor: pointer;
        }
        .bunker-hex-code .leaf:hover {
          background: rgba(253, 185, 19, 0.25) !important;
          outline: 1px solid var(--color-brand);
        }
      `}</style>
    </BunkerShell>
  );
}