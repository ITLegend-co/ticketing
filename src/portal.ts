export const OPERATOR_DIRECTORY = "askjaslhrui3893478rehfsj38uhef";

export function isStaffRole(role: string) {
  return ["IT Admin", "IT Technician", "Management"].includes(role);
}

export function isOperatorPath(pathname: string) {
  return pathname.split("/").filter(Boolean).slice(-1)[0] === OPERATOR_DIRECTORY;
}

export function portalLink(base: string, origin: string, role: string, email: string) {
  const url = new URL(`${base}${isStaffRole(role) ? `${OPERATOR_DIRECTORY}/` : ""}`, origin);
  url.searchParams.set("email", email);
  return url.href;
}

export function canUpdateTicket(role: string, uid: string, ticket: { reviewedAt?: number; technicianId: string }) {
  return role === "IT Admin" || (!!ticket.reviewedAt && role === "IT Technician" && ticket.technicianId === uid);
}
