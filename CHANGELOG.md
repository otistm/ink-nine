# Changelog

## 0.24.0
- New 3D prototype at /desktop/3d/: play Meadowbrook hole 3, Long Way Round, in 3D. It is a test page only, linked from nowhere, and keeps its own saves.
- Same swing, tempo, curve, wind, physics and scoring as the game. The camera sits behind the ball: turn with the arrow keys (hold Shift for fine turns) or right-drag, scroll to zoom, and press Space for the whole hole from above.
- The ground is the game's own ink drawing of the hole, draped over the real hills. Trees, the flag and the ball are drawn in 3D with ink outlines, and shade becomes pen hatching. The course around the ball is redrawn sharply for every shot, so putting stays crisp.
- Aerial view: press V or the button above the telescope to play from high above, with the hole running up the screen like the 2D game. The camera frames your ball and where the shot is heading, and follows the ball in the air. Drag back away from where you want the ball to go, in any direction. Press V again to go back behind the ball. The page remembers which view you used last.
- Uses one outside library, Three.js, loaded from a CDN on this page only. The phone game and desktop edition don't load it.

## 0.23.0
- New desktop edition at /desktop/, the first step toward a bigger game for computers. It plays the same holes with the phone game's swing, laid out for a wide screen and a mouse.
- Your clubs sit down the right edge. Press 1 to 8 to pick one. Space looks around the hole, W explains the wind, the up and down arrows move the strike point, and P pauses.
- Scroll to zoom and right-drag to pan anywhere on the hole. A map of the whole hole sits in the top-left corner. Click it to look at that spot.
- Hover over the course to see how far a spot is from your ball and from the pin, and what surface it is.
- More ink detail: contour lines show the shape of the ground, trees have leaf clusters and hatched shadows, bunkers have shaded lips, the rough has finer grass, and disc markers sit in the fairway at 100, 150, 200 and 250 yards from the pin.
- The desktop edition keeps its own saved progress, separate from the phone game. For now its rounds stay on your computer and don't appear on the leaderboard.
- The front page shows a link to the desktop edition on computers.
- Desktop menus use the whole screen. The clubhouse puts the title, a sketch of a different hole each day and the pro shop on the left, with the invitationals on the right. The card before each hole shows a drawn plan of the hole beside the twists. Between holes, your score and the leaderboard sit beside the rewards, with the scorecard along the bottom. The pro shop shows clubs in two columns.
- Desktop wording says click instead of tap, and explains the mouse and keys.

## 0.22.0
- Tutorial tips no longer disappear on their own. After the 5-second bar fills, a small X appears in the corner. Tap it to tuck the tip away until you do what it asks, and the next tip appears as before.

## 0.21.1
- The wind speed now sits just under the wind button instead of beside it. The wind and pause buttons moved up slightly to make room.
- The flag on each green now streams the way the wind is blowing, including toward or away from you.

## 0.21.0
- Shake to cancel: changed your mind mid-swing? Scrub your finger back and forth quickly and the swing is called off. "Shot cancelled" appears by the ball, no stroke counts, and you can lift and drag again. The first Meadowbrook hole card mentions it.

## 0.20.0
- Precise aiming: hold your finger still for a moment mid-swing and you get a soft tick and a solid aim line. From then on, small finger movements make small changes (about a third as much), so you can line shots up exactly. Move quickly again to leave precise mode.
- Slow sideways nudges now only change the aim. They no longer bend the shot by accident. A quick bowed pull still curves it.
- The small wobble as your finger lifts off the screen is ignored, so the shot goes where you lined it up.

## 0.19.0
- Each hole starts with the best club from your bag already picked: the longest one that won't fly well past the pin, skipping any that would land in water or out of bounds. You can still tap another club.

## 0.18.0
- The wind arrow moved from the top of the screen to a round button above the ball button, with the speed next to it.
- Tap it for a box that explains the wind for your shot: how strong it is, whether it is into you, behind you or across, and which way to adjust. Tap the course, the X or the button again to close it.

## 0.17.0
- Tutorial tips tuck themselves away after 5 seconds, so they no longer cover the course. A thin bar along the bottom of each tip shows the time left. The next tip appears once you do what the current one asks.

## 0.16.0
- New pause button above the telescope. It opens a card to keep playing, save and go to the clubhouse, or send feedback.
- In the clubhouse, a saved round replaces its invitational's description with where you left off (hole, stroke, score and points). Tap the card to pick up exactly there, or use "Start over" below to begin again.
- The card before each hole also has "Save and go to the clubhouse".
- Leaving the tutorial from the pause card takes you to the clubhouse (the tutorial is not saved).

## 0.15.1
- The game no longer freezes with the ball stuck when something unexpected goes wrong. It keeps running and puts the ball back into play.
- When that happens, a crash note is sent quietly to the feedback table (kind "Crash") with the hole, what the ball was doing and the phone model.
- Friends' ghost balls with incomplete saved shots are skipped instead of risking a freeze.

## 0.15.0
- The game is now a proper project: the code is split into readable files, so changes can be made directly in GitHub.
- Version number shown in the clubhouse.
- "Send feedback" in the clubhouse and on every hole card. Notes land in Supabase with the version and hole attached.
- Saved progress is protected across updates, with a backup copy kept each time the version changes.
