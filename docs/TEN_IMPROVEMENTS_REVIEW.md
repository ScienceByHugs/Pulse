# Pulse: ten improvements ready for review

These changes passed local verification and were approved for release. The database migration has now been applied to live Supabase, and its history baselines were verified. Code publishing and the new TestFlight build follow this backend deployment. Build 8 remains the previously installed release until the new build is available.

## 1. Logging without internet

After your routine has loaded online once, Today keeps an account-specific private copy on the device. Losing internet no longer sends a previously verified account back to Login just because the network request failed. Tapping Log saves the record locally before trying the server.

The record keeps the time you tapped Log, the selected scheduled entry, amount, unit and original container. Automatic retries run on reconnection, app foreground and while the app is open. A visible sync banner distinguishes waiting entries from ones needing review. For example, a 9 PM log uploaded tomorrow still says 9 PM today.

Retries use the same event ID so an interrupted upload cannot create another log or deduct stock twice. Pending entries reserve inventory locally. Problems such as changed stock remain visible instead of disappearing. Old pending entries with no saved time ask you to supply the actual time; Pulse does not invent one or assign queues from an unknown account.

## 2. History that survives edits

Each new record freezes the substance name, protocol name, amount/unit, schedule and protocol state. Renaming a substance or changing its recurring pattern affects new tracking, while its existing entries keep their original context. Owner-only schedule versions let the seven-day record use past settings, including items that are now paused or archived.

There is an honest boundary: the old app did not save every historical name or schedule. Pulse marks those older entries as having unavailable original details and excludes dates without a saved version from schedule-based comparisons. It cannot reconstruct facts that were never recorded.

## 3. Faster Today actions

The daily cards now have a direct Log button showing the entered amount, an optional site, and a separate Skip action. Confirmation is visible and announced to screen readers. Undo is directly available on the relevant entry. There is no extra confirmation step for the low-impact quick action.

An offline Undo is also durable: it stays pending until the server confirms that the entry was undone or canceled. If a upload never happened, cancellation does not create a log just to remove it. If it already happened but the response was lost, stock is restored once.

## 4. Multiple daily times and travel

A substance can have up to eight different daily times. Each is a separate scheduled entry with its own Log, Skip, Undo and reminder. Logging the morning entry does not complete the evening entry. Each uses the substance amount the user entered; there are no automatic dose recommendations.

Schedules can follow your phone's local zone or keep your home zone. New logs retain a record date and zone. Editing an existing record uses its original zone. Clock changes are explicit: a repeated fall-back time happens once, and a time inside the spring-forward missing hour is omitted. Foreground and day/zone changes refresh tracking while the app runs.

## 5. Duplicate a protocol

Duplicate this protocol opens a review sheet for a new name, start/end dates and the copied items. The new routine starts paused. You can inspect and edit it before activating it. Inventory and past logs stay with the original protocol. Interval/cycle anchors reset to the new start date and temporary overrides are cleared.

## 6. Clearer inventory

Container details show which container is selected for the next log, remaining quantity, opened/expiry dates, lot number, and whether it is enabled. You can enter your own use-by date. Dates that have passed exclude a container from automatic selection; Pulse does not calculate product stability.

Supply estimates use the entered schedule, all daily times, matching units, usable containers and individual container quantities. Small leftovers in different containers are not combined into a fictional full entry. Future date limits are respected, and Today accounts for pending records. Estimates are descriptive planning information, not advice about dosing or product safety.

## 7. Reminders that know what happened

Each reminder identifies its exact scheduled entry. Logged, skipped and pending entries are omitted from the reminder plan, and quick actions cancel their corresponding pending alert. Refreshing settings or editing a protocol does not deliberately re-enable alerts for already resolved entries.

Tapping a tracking notification opens Today, highlights the relevant card and scrolls to it. Private preview text remains the default. Notification permission failures do not turn a successfully saved log into a failed log.

## 8. Searchable Timeline

Timeline now has search, substance/protocol/status filters and optional start/end dates. Filters can be cleared together. Calendar/history grouping respects saved record dates, and entries show their recorded protocol and substance names. Edit/Undo remains available. The existing 10,000-entry history display cap is clearly reported rather than silently hiding older records.

## 9. Personal daily check-ins

You can optionally record sleep hours, energy, mood and a note, choose a past day, edit that day's entry or delete it. One check-in per account/date avoids accidental duplicate days. Fields can remain blank.

Insights shows averages for the last seven days and a comparison with the prior week when both periods have enough reported observations. It shows how many values contributed. No score or text claims a substance caused a change. Check-ins currently need a connection to save; the offline queue applies to tracking logs and skips.

## 10. Reports you control

Create a shareable report is available in Timeline and Insights. Choose the date range, logs, check-ins and whether to include recorded notes. Notes start excluded. The PDF is generated on the device with embedded licensed fonts, readable wrapping, repeated headers and page numbers. A local synthetic three-page sample was rendered and inspected.

Reports use saved historical names and local record dates, exclude undone entries, and include only the selected content. Record retrieval is paginated. Large ranges are rejected with a clear request to shorten the range rather than producing an incomplete report. Unsupported font characters are identified with a visible character note. Sharing is user-initiated; native temporary PDF files are removed after the share sheet finishes. Reports verify that the account did not change during generation.

## Verification and release boundary

- TypeScript passed.
- 23 automated tests passed, including a local PostgreSQL migration/RLS integration test, secure storage/account queues, uncertain-upload replay, offline Undo, daily occurrences, DST/travel, inventory, check-in summaries, notification suppression, PDF pagination and absence of unselected notes in actual PDF streams.
- iOS and Android Hermes bundles and a web production export passed; final exports are repeated after the last code changes.
- All three sample PDF pages were rendered and visually inspected, including long notes and Unicode text.
- Read-only live preflight found no cross-owner protocol/item parents and confirmed the new schedule-version table is not installed yet. The approved migration was subsequently deployed and verified.
- Dependency audit reports the existing Expo/Metro build-tool chain findings; expo-sharing adds another package path to the same config-plugin/uuid advisory. No new PDF-generation advisory was reported. No automatic major-version audit fixes were applied.

This is implementation verification, not a completed native acceptance run. The approved migration `20261012053405_tracking_reliability_and_checkins.sql` is deployed. Publish the code, build a new TestFlight binary and test: airplane mode/reconnect/relaunch, morning/evening Log/Skip/Undo, home/local zone choice, duplicate/review/activate, container date editing, notification tap/scroll, check-in edit/delete, PDF share and disposable-account deletion/export. The operating system may defer work while the app is closed; sync and reminder refresh are not claimed to run continuously in the background.
