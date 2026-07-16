// LIFO registry for Android hardware back-button handlers. Components deeper
// in the tree (modals, detail views) can register a handler that runs before
// the app-level tab/modal navigation in MainApp.
type BackHandler = () => boolean;

const handlers: BackHandler[] = [];

/** Registers a handler; returns an unregister function. Handlers run
 *  last-registered-first; return true to consume the back press. */
export function registerBackHandler(handler: BackHandler): () => void {
  handlers.push(handler);
  return () => {
    const idx = handlers.indexOf(handler);
    if (idx !== -1) handlers.splice(idx, 1);
  };
}

/** Runs registered handlers LIFO; returns true if one consumed the press. */
export function runBackHandlers(): boolean {
  for (let i = handlers.length - 1; i >= 0; i--) {
    if (handlers[i]()) return true;
  }
  return false;
}
