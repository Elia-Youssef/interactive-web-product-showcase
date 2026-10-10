// The Vite dependency cache of one dev server, keyed by that server's port.
// Two dev servers of one checkout can never share a port (strictPort), so
// the port is a unique owner: each server optimizes and commits its deps in
// its own folder, and one server's rename never lands where another server
// is renaming (the EPERM that broke a whole shard's pages). The path is
// relative to the package root, under Vite's default cache root, and the
// module stays pure (a port in, a relative path out, no Node or Vite APIs)
// so any tool config can import it.

export const devCacheRoot = 'node_modules/.vite'

export function devCacheDir(port: number): string {
  return `${devCacheRoot}/ports/${port}`
}
