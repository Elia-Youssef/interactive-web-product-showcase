// The app paths the routing and collection specs share: an app path with
// the backend mode's query riding on it, exactly as the app's own
// navigation carries the query.

export function routePath(backendPath: string, path: string): string {
  return path + new URL(backendPath, 'https://app.invalid').search
}
