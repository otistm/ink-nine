# Changelog

## 0.15.1
- The game no longer freezes with the ball stuck when something unexpected goes wrong. It keeps running and puts the ball back into play.
- When that happens, a crash note is sent quietly to the feedback table (kind "Crash") with the hole, what the ball was doing and the phone model.
- Friends' ghost balls with incomplete saved shots are skipped instead of risking a freeze.

## 0.15.0
- The game is now a proper project: the code is split into readable files, so changes can be made directly in GitHub.
- Version number shown in the clubhouse.
- "Send feedback" in the clubhouse and on every hole card. Notes land in Supabase with the version and hole attached.
- Saved progress is protected across updates, with a backup copy kept each time the version changes.
