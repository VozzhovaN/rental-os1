export function safeCrmPath(path?: string) {
  if (!path || !path.startsWith("/crm") || path.startsWith("//") || path.includes("://")) {
    return undefined;
  }

  return path;
}
