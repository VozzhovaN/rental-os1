const MOCK_FORBIDDEN_IN_PRODUCTION =
  "MockAvitoAdapter нельзя использовать в production. Уберите AVITO_ADAPTER=mock.";

export function isProductionEnv() {
  return process.env.NODE_ENV === "production";
}

export function isMockAvito() {
  if (isProductionEnv()) {
    return false;
  }

  return process.env.AVITO_ADAPTER === "mock" || process.env.NODE_ENV === "test";
}

export function assertMockAvitoAllowed() {
  if (isProductionEnv()) {
    throw new Error(MOCK_FORBIDDEN_IN_PRODUCTION);
  }
}
