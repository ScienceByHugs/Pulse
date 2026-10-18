# Pulse repository maintenance

Baseline inspected: `ece6e4137eb979d6c195d2c5f96ed153aba8fa2f`; October 17, 2026 Pacific. Owner authorized stabilization and GitHub cleanup; production changes/submissions remain separate.

## Completed cleanup

Closed #48 as superseded by merged #50; closed #49/#51 as superseded by merged #52; closed #90 as already incorporated because its head equals main. Original descriptions and replacement links remain in GitHub. No old code was merged again.

## Branch retirement

`qa/BRANCH_CLEANUP_2026-10-17.json` records all 88 non-main branch heads from the initial snapshot:

- 5 are ancestors of, or identical to, main.
- 35 have only patch-equivalent commits according to `git cherry`.
- 48 need further review; squash merges and inherited stacks can explain unmatched commits. This classification does not declare work lost or unfinished.

None was deleted by this pass: the connector provides no ref-deletion operation, and the browser is signed out. For an authenticated follow-up, first refresh remote refs and compare the exact recorded head. Exclude any branch used by an open PR, another worktree, or ongoing owner work. Make a durable git backup outside this ephemeral checkout before deleting non-ancestor branches. Preserve review-required branches until each unmatched patch is reconciled with merged/superseding work. Delete with an expected-SHA lease; never bulk force-delete by age or prefix. Retain a branch-name-to-SHA ledger for recovery. The local Mac may still use codex/login-flow-polish even though its contents are on main.

## Safeguards to apply after authenticated settings access

Observed: branch listing `protected:false`; repository rulesets empty; automatic deletion after merge disabled. Detailed branch-protection read returned 403. Browser settings shows signed-out access; repository admin changes are not exposed by the connector.

1. Require a pull request to change `main`, with passing checks `TypeScript, tests and app assets` and `iOS, Android and web bundle compilation`; require the branch to be current before merge.
2. Require resolved review conversations. Require one approving review only after confirming a second authorized reviewer exists: GitHub does not allow an author to approve their own PR, and a solo-owner repository must not be locked without a workable review path.
3. Block force pushes/deletion of main. Review and explicitly document any owner emergency bypass rather than silently removing safeguards.
4. Enable automatic deletion of head branches after merges; this handles future merged work, not old branches or closed unmerged drafts.
5. Verify protection is active and the exact checks are required using both settings and an API read. Record the result in master issue #33.

Do not use new broad credentials, a write-enabled workflow, or an installation permission expansion as a shortcut around missing settings access. No settings change is claimed complete here.
