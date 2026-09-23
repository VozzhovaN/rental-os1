export function isAvitoConfigured() {
  return Boolean(process.env.AVITO_CLIENT_ID?.trim() && process.env.AVITO_CLIENT_SECRET?.trim());
}
