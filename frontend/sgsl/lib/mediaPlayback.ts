export function isExpectedPlayInterruption(error: unknown): boolean {
  if (!error) return false;

  if (error instanceof DOMException && error.name === 'AbortError') {
    return true;
  }

  if (typeof error !== 'object') return false;

  const maybeError = error as { name?: unknown; message?: unknown };
  const name = typeof maybeError.name === 'string' ? maybeError.name : '';
  const message =
    typeof maybeError.message === 'string' ? maybeError.message : '';

  if (name === 'AbortError') return true;

  return (
    /play\(\) request was interrupted/i.test(message) ||
    /interrupted by a new load request/i.test(message)
  );
}
