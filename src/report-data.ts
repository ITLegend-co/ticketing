export type ReportTicket = {
  id: string; subject: string; description: string; requester: string; department: string;
  category: string; location: string; impact: string; priority: string; status: string;
  technician: string; createdAt: number; updatedAt: number;
  updates?: Record<string, { text: string; author: string; createdAt: number }>;
};
export function reportTickets(tickets: ReportTicket[], start: string, end: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end) throw new Error("Choose a valid start and end date.");
  const dateKey = (time: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "2-digit", day: "2-digit" }).format(time);
  return tickets.filter(t => dateKey(t.createdAt) >= start && dateKey(t.createdAt) <= end).sort((a,b) => a.createdAt - b.createdAt);
}
export const reportDate = (time: number) => new Date(time).toLocaleString("en-GB", { timeZone: "Asia/Kuala_Lumpur" });
