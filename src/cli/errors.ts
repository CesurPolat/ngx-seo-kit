export function formatError(error: unknown): string {
  if (error instanceof Error) {
    const cause = 'cause' in error ? error.cause : undefined;
    if (cause && cause !== error) {
      return `${error.message}\nCaused by: ${formatError(cause)}`;
    }
    return error.message || error.name;
  }
  return String(error);
}
