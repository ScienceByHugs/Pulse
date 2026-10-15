# Native device release gate

Status: PENDING — these are not claimed as completed device tests. The Mac currently lists a shutdown simulator and no paired physical iPhone. PR 90 has browser/logic checks. At Anthony’s instruction, Pulse 2.0.0 (15) was built locally from ed557c9 and uploaded directly to Apple on 2026-10-13; installation and the device checks below remain pending. Future builds/submissions still require Anthony’s instruction.

Use a clearly fictional tester account. Record device/OS, build number, result and screenshot for each case. Do not use real health records in bug reports.

| Case | Required result | Result |
| --- | --- | --- |
| Signup / password autofill | Account popup remains usable above keyboard; confirm field works; eligibility required | Pending |
| First routine | Guided empty state, new protocol then substance, no route selected for user | Pending |
| As-needed entry | Not on due list; actual amount creates one manual history event and changes matching stock once | Pending |
| Offline logging / relaunch | Original timestamp and request identity survive; reconnect produces one record | Pending |
| Interrupted protocol/substance/container creation | Repeat original details; one saved parent/container; existing stock never resets | Pending |
| Pending Undo | Undo resolves once after reconnection; no duplicate or accidental amount used | Pending |
| Forms / keyboard | Fixed Close reachable; numeric keyboard dismissed; Android back respects saving state | Pending |
| Large text / screen reader | Labels and buttons readable at largest text; VoiceOver/TalkBack traversal makes sense | Pending |
| Help & feedback | Send one ticket, confirm My feedback/status and contact consent off by default; test interrupted send/relaunch without duplicates | Pending |
| Reduced motion | OS setting removes form/date/time transitions and notification-jump scrolling | Pending |
| Notifications / calendar | Read status without permission prompt; test alert visible; denied permissions explained; calendar copies remain user-controlled | Pending |

Use TestFlight build 15 for the new typography, feedback and PMB-address changes once Apple processing completes. Builds 13/14 do not contain all of these additions. See BUILD_15_RELEASE.md for verification scope.
