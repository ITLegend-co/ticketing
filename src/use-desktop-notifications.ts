import { useEffect, useRef } from "react";
import { desktopChanges, desktopRecipient, type DesktopTicket } from "./desktop-notifications";
declare global {
  interface Window {
    mtDesktop?: {
      syncAccess: (uid: string, ticketIds: string[]) => void;
      notify: (notice: { ticketId: string; title: string; body: string }) => void;
      onTicket: (callback: (id: string) => void) => () => void;
    };
  }
}
export function useDesktopNotifications(uid: string, role: string, active: boolean, ready: boolean, tickets: DesktopTicket[]) {
  const previous = useRef<DesktopTicket[] | null>(null);
  const identity = useRef("");
  useEffect(() => {
    const desktop = window.mtDesktop;
    if (!desktop) return;
    const nextIdentity = active ? `${uid}:${role}` : "";
    if (identity.current !== nextIdentity) { previous.current = null; identity.current = nextIdentity; }
    if (!active) { desktop.syncAccess("", []); previous.current = null; return; }
    if (!ready) return;
    desktop.syncAccess(uid, tickets.filter(ticket => desktopRecipient(ticket, uid, role)).map(ticket => ticket.id));
    for (const notice of desktopChanges(previous.current, tickets, uid, role)) desktop.notify(notice);
    previous.current = tickets;
  }, [uid, role, active, ready, tickets]);
}
