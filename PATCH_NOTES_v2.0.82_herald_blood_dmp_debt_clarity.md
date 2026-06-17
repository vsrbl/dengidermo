# PATCH v2.0.91 — Herald fairness, Blood Tax clarity, DMP movement, Debt Engine clarity

## Herald path fairness
- Herald floor path no longer snaps instantly to the player's current position every frame.
- The path endpoint now follows the player at a capped speed.
- A dash can create real distance from the line instead of being unfairly caught instantly.
- Herald still builds a broken floor path around walls and still pursues the target.

## Blood Tax HP clarity
- Blood Tax chest/BET prices are now explicitly HP prices in prompts, hovers, and denial messages.
- HP prices are visually highlighted with a red `.hp-cost` style.
- Blood Tax chest denial now carries `hpCost` + `NO HP`, preventing accidental `NO GLD` text.

## DMP enemy behavior
- DMP is no longer a fully static bullet-stopper.
- It slowly drifts toward the player while staying at nest distance.
- Shooter/prism/pulse/orbiter/echo enemies are more strongly attached to DMP as rotary guards.
- Bruiser enemies try to remain near DMP without becoming too smart.

## Debt Engine clarity
- Debt Engine is intentionally permanent for the run.
- Each stack adds +1 fixed Static Rain level to every future eligible combat room.
- It does not grow from strike count and does not create a runaway LVL VII chain by itself.
- Tooltips now explicitly say it is permanent for the run.

## QA
- node syntax checks passed.
- Smoke tests cover Blood Tax HP denial, DMP movement, Herald dash fairness, and persistent Debt Engine behavior.
