export function isNetworkError(error: unknown) {
  if (!error) return false;
  const value = error as {
    message?: string;
    name?: string;
    status?: number;
    code?: string;
  };
  return (
    value.status === 0 ||
    value.name === 'AuthRetryableFetchError' ||
    /network|failed to fetch|fetch failed|offline|connection|internet/i.test(
      value.message ?? String(error),
    )
  );
}
