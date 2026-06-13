import { PrismaClient, GlobalRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/**
 * Minimal bootstrap seed.
 * - One SUPER_ADMIN account (credentials from env, falls back to dev defaults).
 * - Baseline feature flags.
 * No demo content: the app is API-driven and content comes from real usage.
 */
async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@dsk.local";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "change-me-now";

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      emailVerified: new Date(),
      passwordHash,
      name: "DSK Super Admin",
      role: GlobalRole.SUPER_ADMIN,
      profile: {
        create: {
          displayName: "DSK Admin",
          locale: "EN",
        },
      },
    },
  });

  const flags: Array<{ key: string; enabled: boolean; description: string }> = [
    { key: "integrations.meta", enabled: false, description: "Enable Meta (FB/IG/WhatsApp) integrations" },
    { key: "integrations.tiktok", enabled: false, description: "Enable TikTok integration" },
    { key: "chat.realtime", enabled: true, description: "Enable realtime group chat" },
    { key: "locale.wolof", enabled: false, description: "Expose Wolof locale in UI (future)" },
  ];

  for (const flag of flags) {
    await prisma.featureFlag.upsert({
      where: { key: flag.key },
      update: { description: flag.description },
      create: flag,
    });
  }

  console.log(`Seed complete. Admin: ${adminEmail}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
