# Mountain Torq IT Helpdesk — email notifications

Sender: **itverif@mountaintorq.com**, through the verified Gmail “Send mail as” address using IPServerOne. No Brevo account, SMTP password in code, service-account key or Firebase Blaze upgrade is required for this implementation.

## What is prepared

- New requests: requester and active IT Admins.
- Review, assignment, priority, status and replies: requester, assigned IT person and active IT Admins.
- Resolved tickets: requester, assigned IT person and active IT Admins.
- Deleted tickets: the same recipients, with a deletion notice and no broken ticket link.
- Recipient addresses come from **Firebase Authentication**, not an address supplied by the browser.
- Each recipient gets a separate email, so staff do not see other recipients' addresses.
- Ticket links open the matching request after login. Requesters can add replies on their own tickets; priority, assignment and status still belong to IT.

## 1. Use the correct Google account

Open the existing photo-upload Apps Script project with the Google account whose Gmail has the verified **itverif@mountaintorq.com** sender. The project must execute as that account. That account also needs permission to read the Firebase project's database and Authentication accounts, usually because it already owns/manages **ticketing-a8461**.

The notification worker uses the owner's Google OAuth authorization. It does not sign into Firebase with a user's password. If this Google account does not manage the Firebase project, ask the project owner to grant the required Database read and Firebase Authentication read access, or use an account that already has it. Do not make database rules public.

## 2. Update Apps Script files

1. Replace the existing **Code.gs** with `google-apps-script/Code.gs` from this repository. This retains photo upload/download and adds the notification wake-up endpoint.
2. Click **+** beside Files → **Script**. Name the file **Notifications** and paste the entire `google-apps-script/Notifications.gs` into it.
3. Open **Project Settings** (gear). Enable **Show appsscript.json manifest file in editor**.
4. Return to Editor, open **appsscript.json**, and replace it with this repository's `google-apps-script/appsscript.json`.
5. Save all files.

The manifest adds Gmail, trigger and Firebase read authorization scopes. The web endpoint never accepts a sender or recipient email address, never exposes the owner token, and cannot call the editor-only setup function.

## 3. Start the notification worker

1. From the editor's function dropdown, choose **setupNotifications**.
2. Click **Run**.
3. Review and allow the new permissions using the project-owning Google account. If Google shows an unverified-app warning, only proceed if this is your own script populated from these repository files.
4. Confirm the execution log says **Notifications configured**.
5. Open **Triggers** (clock icon). Confirm **pollTicketNotifications** runs every **5 minutes**. Do not add another copy manually.

Setup records existing tickets as its starting point, so it does not send a flood of emails for historical tickets. Running setup again preserves history and the queue. A private Drive file named **Mountain-Torq-helpdesk-mail-state.json** holds the comparison state and pending emails; do not delete it or share it. You do not need Brevo script properties.

If setup fails:

- **Add and verify sender:** the Apps Script execution account differs from the account where Gmail “Send mail as” was verified, or verification is incomplete.
- **Firebase owner access failed:** confirm the execution account has Database and Authentication read permissions on **ticketing-a8461**. Confirm all manifest scopes were saved and approved. If Google asks to enable the Identity Toolkit API for the Apps Script Google Cloud project, enable that API; report the exact error text if it persists. Some organizations require a standard Google Cloud project for custom OAuth scopes.
- **App blocked:** report the error; do not change organization-wide security policy.

## 4. Update the existing web deployment

Choose **Deploy → Manage deployments → Edit (pencil) → Version: New version → Deploy**.

Keep **Execute as: Me** and **Who has access: Anyone**. Keep the existing deployment so the `/exec` URL stays the same. Requests still require Firebase sign-in and ticket access; the editor-only setup and timer functions are not exposed.

## 5. Publish the requester-reply rules

In Firebase **ticketing-a8461 → Realtime Database → Rules**, replace the complete rules with the current repository's **database.rules.json**, then click **Publish**.

This allows an active requester to append a reply only to their own existing ticket. They cannot edit/delete replies or change priority, status or assignment. New replies store an authenticated author ID. Refresh the website after publishing so all users use the updated form.

## 6. Test end to end

1. Refresh https://itlegend-co.github.io/ticketing/ and submit a new test request using a normal staff account.
2. Confirm the requester and active IT Admins receive the new-request notification from **itverif@mountaintorq.com**.
3. In the staff portal, review and assign the request to an IT person. Confirm assignment notifications arrive.
4. Use the **Open ticket** URL in the requester's email, sign in if needed, and send a reply on that ticket.
5. Confirm IT receives the reply notification and can see the reply on the website.
6. Mark the ticket **Resolved**. Confirm the requester, IT Admins and assigned IT person each receive it. If a person fills two roles, the same email address receives one copy.
7. If mail does not arrive, check Spam and Apps Script **Executions**. Run **pollTicketNotifications** manually to see an error, or wait for the next scheduled check.

The website wakes the worker after saves. A 5-minute scheduled check covers closed browsers and retries. Saves within 15 seconds may be grouped and sent by the scheduled check; rapid status changes between checks are summarized by the latest observed state. The script polls database data, so those reads count toward Firebase download usage.

Google's daily recipient quota still applies. Up to 20 recipients are processed per run; unsent recipients stay queued when quota is exhausted or a send fails. Sent recipients are recorded individually to reduce duplicates. A process crash after SMTP accepts an email but before its progress is saved can still cause a duplicate on retry. Setup and live delivery have not been run by Codex; the account owner must complete the above authorization and tests.

## Pause/resume

Run **stopNotifications** to pause both scheduled and website-triggered mail. Run **resumeNotifications** to restart without discarding history or pending mail.
