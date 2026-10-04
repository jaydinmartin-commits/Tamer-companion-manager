# Tamer Companion Manager

Foundry VTT v14 / dnd5e v6 companion-management interface.

## V0.1.0

- Detects Actors with a Tamer class Item.
- Calculates Pocket Family capacity from Tamer level.
- Stores bonded companion relationships on the Tamer Actor.
- Links existing Actors as companions.
- Shows companion HP, AC, creature type, vessel label, and status.
- Opens the companion Actor sheet.
- Summons one companion at a time into an adjacent unoccupied space.
- Dismisses the summoned companion.
- Adds a Companions control to Tamer Actor sheets.
- Exposes `game.tamerCompanionManager.open(actor)`.

## Tamer progression

Pocket Family capacity:
- Level 1: 1
- Level 3: 2
- Level 11: 3
- Level 15: 4
- Level 19: 5

Vessel validation, Monster Trainer improvements, Soul Bond, bespoke progression, and Training Paradigms are reserved for later versions.

## Installation

Foundry > Add-on Modules > Install Module > Manifest URL:

`https://raw.githubusercontent.com/jaydinmartin-commits/Tamer-companion-manager/main/module.json`
