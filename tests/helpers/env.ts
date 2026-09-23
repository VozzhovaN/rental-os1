process.env.AVITO_ADAPTER = "mock";
process.env.INTEGRATION_ENCRYPTION_KEY =
  process.env.INTEGRATION_ENCRYPTION_KEY || "test-encryption-key-min-32-chars!!";
process.env.DATABASE_URL = process.env.DATABASE_URL || "file:./prisma/test.db";
process.env.AVITO_CLIENT_ID = process.env.AVITO_CLIENT_ID || "";
process.env.AVITO_CLIENT_SECRET = process.env.AVITO_CLIENT_SECRET || "";
process.env.SESSION_SECRET = process.env.SESSION_SECRET || "test-session-secret-min-32-chars!!";
process.env.APP_ORIGIN = process.env.APP_ORIGIN || "http://localhost";
