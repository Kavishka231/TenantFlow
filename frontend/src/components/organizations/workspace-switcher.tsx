import { ArrowRightLeft } from "lucide-react";

import { switchWorkspaceAction } from "@/app/organizations/actions";
import { Button } from "@/components/ui/button";
import type { OrganizationSummary } from "@/lib/organizations/list";

export function WorkspaceSwitcher({
  activeOrganization,
  organizations,
}: {
  activeOrganization: OrganizationSummary;
  organizations: OrganizationSummary[];
}) {
  return (
    <form action={switchWorkspaceAction} className="flex items-center gap-2">
      <label htmlFor="organizationId" className="sr-only">
        Active workspace
      </label>
      <select
        id="organizationId"
        name="organizationId"
        defaultValue={activeOrganization.id}
        className="h-9 max-w-52 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {organizations.map((organization) => (
          <option key={organization.id} value={organization.id}>
            {organization.name}
          </option>
        ))}
      </select>
      <Button type="submit" variant="outline" size="icon" title="Switch workspace">
        <ArrowRightLeft aria-hidden="true" />
        <span className="sr-only">Switch workspace</span>
      </Button>
    </form>
  );
}
