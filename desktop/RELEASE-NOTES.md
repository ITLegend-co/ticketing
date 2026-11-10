Reliability update

- UPS Snooze now waits the full ten minutes.
- On launch, installed monitoring collector versions are checked. An outdated collector prompts for a credential-preserving upgrade with Windows administrator permission. No new enrollment JSON is needed for a normal upgrade.
- Collector upgrade keeps the device configuration, encrypted credentials and scheduled-task identity, and restores prior scripts if replacement fails.
- Hosted ticket improvements include technician own requests, bounded replies, and recoverable photo uploads. Desktop ticket creation stays online-only.
