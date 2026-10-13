# Typography and spacing follow-up

This pass follows locally submitted Pulse 2.0.0 build 14. These changes are not in build 14.

Shared text roles in src/theme.ts now define explicit size, line height, weight and letter spacing for page/section/card headings, body copy, details, labels, buttons and inputs. Applied across all five tabs, sign-in/signup, password recovery, calendar, About, legal pages, privacy lock, navigation and editing/report/inventory sheets. Brand wordmarks and compact chart/artwork text retain their special sizing. System font scaling remains enabled.

Timeline separates period navigation from full-width titles, spaces the search/results/filter group, and uses readable range labels. Range buttons wrap into two balanced rows below 360 px or when native font scale exceeds 1.15. Today shows the next scheduled time separately from the substance heading. Narrow substance amount/unit inputs can shrink within the sheet; their visible amount placeholder is shortened while the full accessibility label is retained. Protocol creation actions have a separate gap below duplication. Picker rows can grow with text instead of clipping to a fixed scroll height.

## Verification

73 existing tests, TypeScript and app-asset checks passed. Browser inspection used the existing fictional reviewer account at 390×844 and 320×740: Today, Protocol, Timeline, Insights, Account, Calendar, About and legal policy text; signup, profile, substance creation, filters and report sheets. Month/year/week headings and year navigation were checked. No account, tracking, profile or calendar records were changed, and no PDF was generated/shared.

Preview screenshot: output/ui/timeline-spacing-review.png (local, untracked).

Physical iOS/Android checks at large accessibility font sizes, keyboard appearance and native sheet presentation remain pending the next authorized local build. No new native build or TestFlight upload was started for this styling pass.
