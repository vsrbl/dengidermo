# v2.1.174 — Living Casino parallel targets / Controller command fix

- Casino heat now gains one point after any successful payout; bad results still reset it.
- BSC loot restored to its previous curve with 25% softer scaling and no new low cap.
- Living Casino guns no longer draw idle targeting lines.
- Both guns operate simultaneously and ignore weapon-wheel switching.
- Target acquisition turns instantly; base channels fire a staggered parallel volley.
- Manual target marks use a separate purple frame and can stack on one target.
- Automatic target frames exist only while a gun is actively holding that target.
- Main-menu control tutorial removed.
- Debug and cleanup-summary scrollbars restyled for the terminal UI.
- Controlled processes now expire individual commands correctly, reacquire targets at useful range, clear self-orders after capture, and render green whenever they carry an active command.
