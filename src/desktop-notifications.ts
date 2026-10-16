export type DesktopTicket = {
  id: string; subject: string; requesterId: string; technicianId: string; status: string;
  priority: string; updatedBy?: string;
  updates?: Record<string, { text: string; authorId?: string; createdAt: number }>;
};
export function desktopRecipient(ticket: DesktopTicket, uid: string, role: string) {
  if (role !== "IT Admin" && role !== "IT Technician") return false;
  return ticket.technicianId ? ticket.technicianId === uid : role === "IT Admin";
}
export function desktopChanges(previous: DesktopTicket[] | null, current: DesktopTicket[], uid: string, role: string) {
  if (!previous) return [];
  const old = new Map(previous.map(ticket => [ticket.id, ticket]));
  return current.flatMap(ticket => {
    if (!desktopRecipient(ticket, uid, role)) return [];
    const before = old.get(ticket.id);
    let title = "";
    let detail = "";
    if (!before) {
      if (ticket.technicianId === uid) title = "Ticket assigned to you";
      else if (ticket.requesterId !== uid) title = "New support ticket";
    } else if (before.technicianId !== ticket.technicianId && ticket.technicianId === uid) {
      title = "Ticket assigned to you";
    } else {
      const replies = Object.entries(ticket.updates || {}).filter(([id, note]) => !before.updates?.[id] && note.authorId !== uid);
      const fieldsChanged = before.status !== ticket.status || before.priority !== ticket.priority;
      if (replies.length) {
        title = "New ticket reply";
        detail = replies.sort((a, b) => b[1].createdAt - a[1].createdAt)[0][1].text.slice(0, 250);
      }
      else if (fieldsChanged && ticket.updatedBy !== uid) title = "Ticket updated";
    }
    return title ? [{ ticketId: ticket.id, title, body: `${ticket.subject} · ${ticket.status} · ${ticket.priority}${detail ? "\n" + detail : ""}` }] : [];
  });
}
