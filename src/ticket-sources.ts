// Keep each query's current snapshot separately so removal from one source does
// not remove a ticket that remains visible through another source.
export function subscribeTicketSources<S, T>(sources: S[], listen: (source: S, next: (snapshot: { val(): Record<string, T> | null }) => void, error: (error: Error) => void) => () => void,
  changed: (tickets: Record<string, T>, ready: boolean) => void, error: (error: Error) => void) {
  const values: Record<string, T>[] = sources.map(() => ({})), ready = new Set<number>();
  let stopped = false;
  const stops = sources.map((source, index) => listen(source, snapshot => {
    if (stopped) return;
    values[index] = snapshot.val() || {}; ready.add(index);
    changed(Object.assign({}, ...values), ready.size === sources.length);
  }, e => { if (!stopped) error(e); }));
  return () => { stopped = true; stops.forEach(stop => stop()); };
}
