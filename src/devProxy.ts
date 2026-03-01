import * as http from 'http';
import * as net from 'net';
import { INJECT_TAG } from './utils/devtools';

export class DevProxy {
  private readonly _server: http.Server;
  public readonly port: number;
  private _targetHost = 'localhost';
  private _targetPort = 3000;

  private constructor(port: number) {
    this.port = port;
    this._server = this._buildServer();
  }

  /** Factory: finds a free port, starts the proxy, returns the instance. */
  static async create(): Promise<DevProxy> {
    const port = await DevProxy._freePort();
    const proxy = new DevProxy(port);
    await new Promise<void>((res, rej) => {
      proxy._server.listen(port, '127.0.0.1', res);
      proxy._server.once('error', rej);
    });
    return proxy;
  }

  /** Switch the proxy target to a different localhost dev server. */
  setTarget(targetUrl: string) {
    try {
      const u = new URL(targetUrl);
      this._targetHost = u.hostname;
      this._targetPort = parseInt(u.port || '80', 10);
    } catch { /* keep previous target */ }
  }

  dispose() { this._server.close(); }

  // ── Internal helpers ────────────────────────────────────────────────────────

  private _buildServer(): http.Server {
    const server = http.createServer((req, res) => {
      // Strip accept-encoding so the server sends us uncompressed text we can modify
      const headers = { ...req.headers, host: `${this._targetHost}:${this._targetPort}` };
      delete headers['accept-encoding'];

      const opts: http.RequestOptions = {
        host: this._targetHost,
        port: this._targetPort,
        path: req.url || '/',
        method: req.method || 'GET',
        headers,
      };

      const proxyReq = http.request(opts, (proxyRes) => {
        const ct = proxyRes.headers['content-type'] || '';
        if (ct.includes('text/html')) {
          // Collect body, inject script, forward modified HTML
          const chunks: Buffer[] = [];
          proxyRes.on('data', (c: Buffer) => chunks.push(c));
          proxyRes.on('end', () => {
            let body = Buffer.concat(chunks).toString('utf8');
            body = body.includes('</head>')
              ? body.replace('</head>', INJECT_TAG + '</head>')
              : INJECT_TAG + body;

            const outHeaders = { ...proxyRes.headers };
            delete outHeaders['content-length'];
            delete outHeaders['content-encoding'];
            outHeaders['content-type'] = 'text/html; charset=utf-8';

            res.writeHead(proxyRes.statusCode ?? 200, outHeaders);
            res.end(body);
          });
        } else {
          res.writeHead(proxyRes.statusCode ?? 200, proxyRes.headers);
          proxyRes.pipe(res);
        }
      });

      proxyReq.on('error', (e) => {
        if (!res.headersSent) { res.writeHead(502); }
        res.end(`Proxy error: ${e.message}`);
      });
      req.pipe(proxyReq);
    });

    // WebSocket proxy — required for HMR (Vite, webpack, etc.)
    server.on('upgrade', (req, socket, _head) => {
      const opts: http.RequestOptions = {
        host: this._targetHost,
        port: this._targetPort,
        path: req.url || '/',
        headers: req.headers,
      };
      const proxyReq = http.request(opts);
      proxyReq.on('upgrade', (_res, proxySocket) => {
        socket.write('HTTP/1.1 101 Switching Protocols\r\n\r\n');
        proxySocket.pipe(socket);
        socket.pipe(proxySocket);
        proxySocket.on('error', () => socket.destroy());
        socket.on('error', () => proxySocket.destroy());
      });
      proxyReq.on('error', () => socket.destroy());
      proxyReq.end();
    });

    return server;
  }

  private static _freePort(): Promise<number> {
    return new Promise((resolve, reject) => {
      const s = net.createServer();
      s.listen(0, '127.0.0.1', () => {
        const port = (s.address() as net.AddressInfo).port;
        s.close(() => resolve(port));
      });
      s.on('error', reject);
    });
  }
}
