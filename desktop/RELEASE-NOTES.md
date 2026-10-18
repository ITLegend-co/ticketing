Windows 10/11 x64 installer for Mountain Torq IT Helpdesk.

1. Download and run the Setup.exe, then sign in with your helpdesk account.
2. Closing the window keeps the app in the system tray. Right-click its icon to open, reconnect, enable Start with Windows, or quit.
3. A small separate window appears above other windows for ticket updates. Use Open ticket to open the ticket, or Dismiss to close that update. Closing the popup dismisses all displayed updates. Multiple tickets appear in one scrollable window; repeated updates refresh the same ticket.

New unassigned tickets notify IT Admins. Once assigned, replies and status/priority changes notify only the assigned IT person. Reassignment notifies the new IT person. Your own replies and status changes do not notify you. Existing tickets load quietly when signing in or restarting. Popups require the app to be running, signed in, and connected. Click Open ticket to open its ticket. Reassigned tickets are removed from the previous IT person’s popup. Email routing is unchanged.

The installer is not code-signed; Windows may show an unknown-publisher warning. Use only the installer from this repository and compare the supplied SHA256 checksum if needed.

No Firebase rules or Apps Script update is needed for desktop notifications. Website features update through the existing hosted helpdesk; desktop runtime updates require installing a newer installer.

Upgrading: quit the existing app from the system tray, then run the new installer. Your existing account and tickets are unchanged.

Device Monitoring: included optional background collector with setup/removal actions in the system tray. Requires a device enrollment file from IT Admin, Windows administrator approval and publishing the new Firebase rules first. See the website monitoring setup page. Monitoring runs through a separate Windows scheduled task and sends no emails.

Network addresses: separate Public IP Address and per-adapter Local IP Address / MAC Address. Public IP lookup runs every 15 minutes. Publish the updated Firebase monitoring rules and rerun device monitoring setup after upgrading; installing the app alone does not update the separate background collector.

Public IPv4 and IPv6 now have independent lookups and separate dashboard fields. Unsupported or failed lookups show Unavailable without blocking the other address. Publish updated monitoring rules, install this version, and rerun monitoring setup to update the background collector.

UPS reminders: IT Admin can schedule weekday and Saturday reminders for selected helpdesk users. The app shows a centred animated-cat window at 60% of screen work-area width and height, with Acknowledged and 10-minute snooze. Schedules use Malaysia time. Cached schedules work offline; clicks queue until the same user reconnects. Requires new Firebase reminder rules and one online sign-in/schedule download. The app must be running; closing to tray is supported. This update enables Start with Windows once, configurable in the tray. Preview UPS reminder is available from the tray. No reminder emails, screen capture or automatic power-off. See reminder-setup.html on the website.
