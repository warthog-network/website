class WSClient {
    constructor(url, callbacks) {
        this.url = url;
        this.timer = null;
        this.callbacks = callbacks;
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectDelay = 5000;
        this.initialReconnectDelay = 200;
        this.reconnectOnClose = true;
    }

    connect() {
        this.ws = new WebSocket(this.url);
        this.ws.addEventListener('open', this.onOpen.bind(this));
        this.ws.addEventListener('close', this.onClose.bind(this));
        this.ws.addEventListener('message', this.onMessage.bind(this));
        this.ws.addEventListener('error', this.onError.bind(this));
    }

    disconnect() {
        this.reconnectOnClose = false;
        if (this.timer) clearTimeout(this.timer);
        if (this.ws) this.ws.close();
    }

    send(json) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(json));
        }
    }

    msg(action, topic, params) {
        const msg = { action, topic };
        if (params) msg.params = params;
        this.send(msg);
    }

    onOpen() {
        this.callbacks.onOpen();
        this.callbacks.onEvent({ event: null, type: "api.connected" });
        this.reconnectAttempts = 0;
    }

    onClose() {
        this.callbacks.onClose();
        this.callbacks.onEvent({ event: null, type: "api.disconnected" });
        if (this.reconnectOnClose) this.reconnect();
    }

    onMessage(event) {
        const data = JSON.parse(event.data);
        this.callbacks.onEvent(data);
    }

    onError(error) {
        // Silent error handling; notify via callback
        this.callbacks.onError(error);
    }

    reconnect() {
        const delay = Math.min(this.initialReconnectDelay * Math.pow(2, this.reconnectAttempts), this.maxReconnectDelay);
        this.timer = setTimeout(() => {
            this.reconnectAttempts++;
            this.connect();
            this.timer = null;
        }, delay);
    }
}

class ConnectionState {
    constructor() {
        this.connections = [];
    }
    setConnections(conns) {
        this.connections = conns;
    }
    addConnection(newConnection) {
        this.connections.push(newConnection)
    }
    removeConnection(id) {
        this.connections = this.connections.filter(item => item.id !== id);
    }
}
// src/assets/api_ws.js
class Block {
  constructor(data) {
    Object.assign(this, data);
    // --- Normalise everything ---
    this.body = this.body || {};
    this.body.rewards = Array.isArray(this.body.rewards) ? this.body.rewards : [];
    this.body.transfers = Array.isArray(this.body.transfers) ? this.body.transfers : [];
    this.header = this.header || {};
  }

  reward_tx() {
    return this.body.rewards[0] || null;
  }

  miner() {
    const tx = this.reward_tx();
    return tx?.toAddress || 'unknown';
  }

  reward() {
    const tx = this.reward_tx();
    return tx?.amount || '0';
  }

  get transactions() {
    const rewardTx = this.reward_tx();
    const txs = [];
    if (rewardTx) txs.push(rewardTx);
    txs.push(...this.body.transfers);
    return txs;
  }

  transactionCount() {
    return this.transactions.length;
  }

  // --- Safe string fields ---
  get headerHash() {
    return typeof this.header.hash === 'string' ? this.header.hash : '—';
  }

  get heightStr() {
    return this.height?.toString() || '—';
  }
}
class ChainState {
    constructor(apiClient) {
        this.apiClient = apiClient; // Reference to APIClient for fetching hashrate
        this.blocks = [];
        this.head = null;
        this.hashrate = null; // New property for hashrate
    }
    blocks() {
        return this.blocks;
    }
    latest() {
        return this.blocks[this.blocks.length - 1]
    }
    async updateHashrate() {
        try {
            const response = await this.apiClient.get('/chain/hashrate/100');
            this.hashrate = response.data.lastNBlocksEstimate || null;
        } catch (err) {
            console.error('Failed to fetch hashrate:', err);
            this.hashrate = null;
        }
    }
    async setState({ latestBlocks, head }) {
        this.head = head;
        this.blocks = latestBlocks.map((data) => new Block(data));
        await this.updateHashrate(); // Fetch hashrate on state set
    }
    async append({ newBlocks, head }) {
        this.head = head;
        this.blocks = this.blocks.concat(newBlocks.map((data) => new Block(data)))
        await this.updateHashrate(); // Fetch hashrate on append
    }
    async fork({ latestBlocks, head }) {
        this.setState({ latestBlocks, head });
        await this.updateHashrate(); // Fetch hashrate on fork
    }
}

class LogState {
    constructor() {
        this.lines = [];
    }
    addLine(line) {
        this.lines.push(line);
        if (this.lines.length > 1100) {
            this.lines = this.lines.slice(100);
        }
    }
    setLines(lines) {
        this.lines = []
        for (let i = 0, len = lines.length; i < len; i++) {
            this.addLine(lines[i]);
        }
    }
}

class State {
    constructor(apiClient) {
        this.connection = new ConnectionState();
        this.chain = new ChainState(apiClient); // Pass apiClient to ChainState
        this.log = new LogState();
        this.subscribed = false;
    }
    onEvent(msg) {
        var event = msg.event;
        switch (msg.type) {
            case 'connection.state':
                this.connection.setConnections(event.connections);
                return 'connection';
            case 'connection.add':
                this.connection.addConnection(event.connection);
                return 'connection';
            case 'connection.remove':
                this.connection.removeConnection(event.id);
                return 'connection';
            case 'chain.state':
                this.chain.setState(event)
                return 'chain';
            case 'chain.append':
                this.chain.append(event);
                return 'chain';
            case 'chain.fork':
                this.chain.fork(event)
                return 'chain';
            case 'log.state':
                this.log.setLines(event)
                return 'log'
            case 'log.line':
                this.log.addLine(event)
                return 'log'
            case 'api.connected':
                this.subscribed = true;
                return 'subscribed';
            case 'api.disconnected':
                this.subscribed = false;
                return 'subscribed';
            default:
                console.warn('Unknown event type', msg.type, msg);
                return '';
        }
    }
}

class APIClient {
    constructor(host = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000', useChainDelta = false, proxyUrl = null) {
        const url = new URL(host);
        this.host = host; // Full host URL, e.g., 'https://node.wartscan.io'
        this.hostport = url.host; // Domain:port for WS
        const wsProtocol = host.startsWith('https') ? 'wss' : 'ws';
        
        // Use /ws/chain_delta if flag set (for prod/remote), else /stream
        const wsPath = useChainDelta ? '/ws/chain_delta' : '/stream';
        let wsHost = this.hostport;
if (host.includes('localhost') && host.includes('3000')) {
    wsHost = 'localhost:10001';
}
this.wsUrl = `${wsProtocol}://${wsHost}${wsPath}`;
        
        // Set proxy for non-localhost hosts to bypass CORS in dev
        this.proxyUrl = host.includes('localhost') ? null : '/api/proxy';
        
        this.state = new State(this); // Pass this (APIClient) to State for ChainState
        this.setters = null;
        
        this.wsClient = new WSClient(this.wsUrl, {
            onOpen: () => {
                if (!useChainDelta) {
                    // Only subscribe if using /stream (chain_delta auto-streams)
                    this.subscribe('connection');
                    this.subscribe('chain');
                    this.subscribe('log');
                }
                this.state.subscribed = true;
                this.notifyChange('subscribed');
            },
            onClose: () => {
                this.state.subscribed = false;
                this.notifyChange('subscribed');
            },
            onEvent: (msg) => {
                const key = this.state.onEvent(msg);
                this.notifyChange(key);
            },
            onError: (err) => {
                console.error('WS error:', err); // Minimal logging
            }
        });
      // WS disabled for all to avoid connection issues.
    }

    notifyChange(key) {
        if (this.setters != null) {
            switch (key) {
                case 'connection':
                    this.setters.setConnections([...this.state.connection.connections]);
                    break;
                case 'chain':
                    this.setters.setChain({...this.state.chain});
                    break;
                case 'log':
                    this.setters.setLog({...this.state.log});
                    break;
                case 'subscribed':
                    this.setters.setSubscribed(this.state.subscribed);
                    break;
            }
        }
    };

    connectionState() {
        return this.state.connection;
    }
    chainState() {
        return this.state.chain;
    }
    logState() {
        return this.state.log;
    }
    subscribedState() {
        return this.state.subscribed;
    }
    subscribe(topic, params) {
        this.wsClient.msg("subscribe", topic, params);
    }
    unsubscribe(topic, params) {
        this.wsClient.msg("unsubscribe", topic, params);
    }
    async get(path) {
        let url;
        if (this.proxyUrl) {
            // Use proxy for CORS bypass in dev
            const query = `?nodePath=${encodeURIComponent(path)}&nodeBase=${encodeURIComponent(this.host)}`;
            url = this.proxyUrl + query;
        } else {
            // Direct fetch for prod or local
            url = this.host.replace(/\/$/, '') + '/' + path.replace(/^\//, '');
        }
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    }

    async post(path, params) {
        let url;
        const body = JSON.stringify(params);
        const headers = { 'Content-Type': 'application/json' };
        if (this.proxyUrl) {
            // Use proxy for CORS bypass in dev
            const query = `?nodePath=${encodeURIComponent(path)}&nodeBase=${encodeURIComponent(this.host)}`;
            url = this.proxyUrl + query;
        } else {
            // Direct fetch for prod or local
            url = this.host.replace(/\/$/, '') + '/' + path.replace(/^\//, '');
        }
        const response = await fetch(url, {
            method: "POST",
            body,
            headers
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    }

    disconnect(id) {
        return this.get(`/peers/disconnect/${id}`);
    }

    closeConnection() {
        this.wsClient.disconnect();
    }

    getBlock(height) {
        return this.get(`/chain/block/${height}`).then(response => {
            if (response.code !== 0 || !response.data || !response.data.header) {
                throw new Error('Block not found');
            }
            return new Block({ ...response.data, height: Number(height) });
        });
    }

    getTx(txid) {
        return this.get(`/chain/transaction/${txid}`);
    }
}

export { Block };
export default APIClient;
