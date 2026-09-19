import { requireAdmin } from "@/lib/firebase/guards";
import { isOwnerRole } from "@/lib/auth/roles";
import { listTeam } from "@/lib/domain/admin/team.service";
import { getAdminTranslator } from "@/lib/i18n/admin";
import { TeamManager, type TeamRow } from "@/components/admin/TeamManager";

export const dynamic = "force-dynamic";

/**
 * Admin — Team. Every staff member (ADMIN or OWNER) can view it; only an
 * OWNER gets the management controls, and every change is re-authorized
 * server-side by `requireOwner()` regardless of what this page renders.
 */
export default async function AdminTeamPage() {
  // The layout already ran requireAdmin(); this call gives the viewer's
  // verified claims (uid + role) for the page itself.
  const viewer = await requireAdmin();
  const { t, locale } = await getAdminTranslator("AdminTeam");
  const members = await listTeam([viewer.uid]);

  // Formatted on the server so server and client render identical text;
  // store time (Palestine), since that is where the team works.
  const formatDate = new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Hebron",
  });

  const rows: TeamRow[] = members.map((member) => ({
    uid: member.uid,
    name: member.name,
    email: member.email,
    role: member.role,
    disabled: member.disabled,
    emailVerified: member.emailVerified,
    lastSignIn: member.lastSignInAt ? formatDate.format(new Date(member.lastSignInAt)) : null,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl">{t("title")}</h1>
        <p className="mt-1 text-sm text-text-primary/70">{t("intro")}</p>
      </div>
      <TeamManager
        rows={rows}
        viewerUid={viewer.uid}
        canManage={isOwnerRole(viewer.role)}
        ownerCount={rows.filter((row) => row.role === "OWNER").length}
      />
    </div>
  );
}
