import { prisma } from "@dsk/db";

/**
 * Admin overview. Server-rendered behind the hidden layout guard; counts are
 * read directly (admin surfaces may bypass the public API layer).
 */
export default async function AdminDashboardPage() {
  const [
    users,
    ideas,
    openReports,
    groups,
    pendingOrgs,
    erroredIntegrations,
    failedWebhooks,
  ] = await Promise.all([
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.idea.count({ where: { deletedAt: null } }),
    prisma.report.count({ where: { status: "OPEN" } }),
    prisma.group.count({ where: { deletedAt: null } }),
    prisma.organization.count({ where: { verification: "PENDING", deletedAt: null } }),
    prisma.integrationAccount.count({ where: { status: { in: ["EXPIRED", "ERROR"] } } }),
    prisma.webhookEvent.count({ where: { status: "FAILED" } }),
  ]);

  const cards = [
    { label: "Users", value: users },
    { label: "Ideas", value: ideas },
    { label: "Open reports", value: openReports, alert: openReports > 0 },
    { label: "Groups", value: groups },
    { label: "Orgs pending verification", value: pendingOrgs, alert: pendingOrgs > 0 },
    { label: "Unhealthy integrations", value: erroredIntegrations, alert: erroredIntegrations > 0 },
    { label: "Failed webhooks", value: failedWebhooks, alert: failedWebhooks > 0 },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`rounded-lg border bg-white p-4 dark:bg-zinc-900 ${
            card.alert
              ? "border-red-400 dark:border-red-700"
              : "border-zinc-200 dark:border-zinc-800"
          }`}
        >
          <p className="text-xs text-zinc-500">{card.label}</p>
          <p className="text-2xl font-bold">{card.value}</p>
        </div>
      ))}
    </div>
  );
}
