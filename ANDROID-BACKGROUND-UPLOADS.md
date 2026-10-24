# Android background ticket uploads

New Android builds transfer the existing account-scoped web outbox to an encrypted native queue. WorkManager schedules unique per-ticket jobs with a connected-network constraint and exponential retries. The queue survives closing the app and reboot. Android battery restrictions can delay jobs; force-stop requires reopening. Completion notifications are optional and requested after the first queued upload; denying them does not stop delivery.

Wait for “Waiting for internet / Android background scheduler” in Outbox before closing the app. “Saved on this device” alone means the browser-to-native transfer has not yet been confirmed. Open the upgraded app once with the original account to transfer pre-existing web outbox entries. Sign-out clears the native session and pauses delivery. Signing in as a different user never gives that user access to the prior user's queue. An upload already accepted by the server cannot be recalled by sign-out.

The native queue uses AtomicFile and AES-GCM with a non-exportable Android Keystore key, stored under noBackupFilesDir. Firebase refresh tokens are never stored in WorkManager input data or logs. They are sent only to Google's token endpoint; ID tokens go only to the existing Firebase database and Apps Script attachment service. Server profile checks and Firebase rules remain authoritative. Revoked sessions or suspended accounts retain queued content for later retry after access is restored.

Ticket IDs and upload IDs are preserved. Ticket creates use null_etag conditional writes; previously delivered tickets are checked via the existing owner-filtered query. Photo uploads require the resumableUploads capability in the updated Code.gs. If that update has not been deployed, the ticket sends and photos remain queued. Completed photos are checkpointed and duplicate photo retries use the server's existing locked upload-ID lookup.

No Firebase rule changes or new Apps Script changes are required beyond the previously supplied resumable-photo Code.gs. iOS/browser background behavior is unchanged.

Tests cover duplicate ticket acknowledgement with IT edits, owner/timestamp conflicts, empty Firebase collections and unsafe queue IDs. Existing web outbox and photo-idempotency tests also run in CI. Physical Android testing must cover airplane mode → queued request with photo → close app → reconnect, notification denial, reboot, sign-out/account switching, and attachment-service outage before broad rollout.
