/**
 * Single shared Socket.IO connection for the entire app.
 * Stored on globalThis so it survives Next.js HMR module re-evaluation.
 */

type ISocket = import('socket.io-client').Socket;

// Attach to globalThis (= window in browser) so HMR doesn't reset it.
// __avianSocketPromise caches the in-flight creation so concurrent callers
// all await the same promise instead of each creating a new socket.
const g = globalThis as typeof globalThis & {
  __avianSocket?: ISocket;
  __avianSocketPromise?: Promise<ISocket>;
};

export function getSocket(): Promise<ISocket> {
  // Never run on the server
  if (typeof window === 'undefined') return Promise.reject(new Error('getSocket called server-side'));

  // Already created — fast path
  if (g.__avianSocket) return Promise.resolve(g.__avianSocket);

  // Creation already in flight — return the same promise to all concurrent callers
  if (g.__avianSocketPromise) return g.__avianSocketPromise;

  g.__avianSocketPromise = import('socket.io-client').then(({ io }) => {
    if (g.__avianSocket) return g.__avianSocket; // another caller won the race

    const url = process.env['NEXT_PUBLIC_WS_URL'] ?? 'http://localhost:4000';
    const socket = io(url, {
      transports: ['polling', 'websocket'],
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
    });

    socket.on('connect', () => console.log('[socket] connected', socket.id));
    socket.on('disconnect', (reason) => console.log('[socket] disconnected', reason));
    socket.on('connect_error', (err) => console.log('[socket] connect_error', err.message));

    g.__avianSocket = socket;
    socket.connect();
    return socket;
  });

  return g.__avianSocketPromise;
}
