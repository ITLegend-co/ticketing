# Offline ticket outbox

Open the helpdesk and sign in while online. If the connection drops, submit a new request normally. The ticket and selected images are saved in IndexedDB on that device before the form is cleared. The Outbox shows delivery progress and any errors. Only the same signed-in account can resume that queue.

Sending resumes on connection, every 30 seconds while the app is active, when returning to the app, or with Retry now. If the phone closes or suspends the app, reopen it online. This version does not promise background delivery or a fresh offline launch/sign-in. Do not clear browser/app data or uninstall with pending requests. Browser storage is subject to device storage limits and eviction; a failed local save keeps the form open.

Each queued request keeps its original ID. Firebase conditional creation prevents a retry from overwriting a ticket IT has changed. After a ticket is acknowledged, only its unfinished photos retry. Replies and status updates still require internet access.

## Required attachment service update

Replace `Code.gs` in the existing Apps Script project with `google-apps-script/Code.gs` from this repository. Keep the existing `Notifications.gs` and manifest. Choose Deploy > Manage deployments > Edit (pencil) > New version > Deploy on the current web-app deployment, keeping its URL. Do not create another deployment URL.

The updated `list` response advertises resumable upload support. Photo uploads use a stable ID and a locked lookup before creation. Until this update is deployed, queued tickets still send, but their photos remain safely in the Outbox with an update-needed message. After deployment, press Retry now or leave the app open.

No Firebase Database rule changes are required.

## Verification

Automated tests cover access denial, a lost create acknowledgement, account isolation, resuming partial photo delivery, conditional create conflicts, and duplicate photo retries at the five-photo limit. Real-device offline/resume and photo picker testing is still required before broad rollout.
