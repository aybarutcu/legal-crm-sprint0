export function getNextDocumentVersion(latestVersion: number | null | undefined) {
  return (latestVersion ?? 0) + 1;
}
