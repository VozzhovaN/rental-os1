import { prisma } from "../lib/prisma";
import { hashPassword, normalizeEmail } from "../lib/auth/password";

async function main() {
  const email = normalizeEmail("demo@rental-os.local");
  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    await prisma.user.create({
      data: {
        email,
        passwordHash: await hashPassword("demo-password-123"),
        name: "Demo",
        isActive: true,
      },
    });
  }
  console.log("demo user ready");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
