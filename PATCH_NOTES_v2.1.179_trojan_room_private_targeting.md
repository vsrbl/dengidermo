# v2.1.179 — TROJAN ROOM / PRIVATE TARGETING

## Private active preparation
- Q/R preparation previews are rendered only for the local player.
- Remote players never see another player's unconfirmed radius or Void Cut planning line.
- Confirmed ability effects remain authoritative world events visible to everyone.

## TROJAN CHEST room modifier
- Added the TROJAN CHEST / ТРОЯНСКИЙ СУНДУК room modifier.
- Exactly one WPN, BSC, ABL, RAR or CRS chest is infected in each Trojan room.
- The infected chest is not visually revealed before interaction.
- Opening it consumes the normal interaction/payment, but the chest explodes instead of granting its normal reward.
- The blast knocks the interacting player away and releases a small swarm of room-appropriate enemies.
- The portal is locked while the Trojan swarm is alive and reopens after cleanup.
- If generation produces no eligible chest, the room receives one BSC so the modifier always functions.

## Casino slot threat portal rule
- A pending or assembled casino slot-mob locks an already opened portal.
- The portal cannot reopen while the slot-mob assembly is pending.
- After the slot threat is removed, the portal resumes normally.

## Presentation and localization
- Added RU/EN room labels, hints, danger tags and reward tags for Trojan rooms.
- Added a dedicated square Trojan explosion effect.

## Verification
- Forced Trojan generation tested across 40 deterministic seeds: exactly one infected chest every time.
- Tested chest explosion, player knockback, swarm spawn, portal relock and portal reopen after cleanup.
- Verified private preparation rendering and all JavaScript syntax.
