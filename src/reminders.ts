export const reminderDays = ["mon","tue","wed","thu","fri","sat","sun"] as const;
export type ReminderSchedule = { enabled: boolean; message: string; days: Record<typeof reminderDays[number], string>; updatedAt: number; updatedBy: string };
export type ReminderAck = { date: string; scheduledFor: string; acknowledgedAt: number; receivedAt?: number; hostname: string };
export const defaultReminderDays = () => ({mon:"17:00",tue:"17:00",wed:"17:00",thu:"17:00",fri:"17:00",sat:"13:00",sun:""});
