# Mobile ticket submission fixes

- Online requests send immediately and open the submitted ticket, without an Outbox step.
- Offline requests remain queued and upload in the background when connected.
- Fixed normal staff background submissions being denied by conditional-write read permissions.
- Retry now restarts waiting Android uploads without duplicating an already running worker.
- Access-denied errors are shown separately from connection failures.
- Existing saved tickets and photos are preserved. Install this update over the existing app; do not uninstall or clear app data.
