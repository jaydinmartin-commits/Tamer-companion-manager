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

## Release 0.1.11
- Stable GitHub release manifest for Foundry package updates.

## Release packaging
- Automated release packaging is enabled for tagged module versions. [release-package]



<!-- Release package trigger: 0.1.24 -->

<!-- release-package: 0.1.24 final -->


<!-- release-package: v0.1.27 -->


[release-package]

<!-- release-package: v0.1.28-final -->


<!-- v0.1.28 package trigger -->


Release packaging trigger for v0.1.29. [release-package]


Packaging trigger for v0.1.30.


Packaging trigger for v0.1.31.


<!-- v0.1.32 package trigger -->


<!-- v0.1.42 prerequisite parser refresh -->


## Release 0.1.49
- Add Companion opens a searchable browser backed by GM-configured Actor compendiums.
- GM-only Configure Companion Sources menu controls which Actor compendiums are available.
- Selected compendium creatures are imported into the World and bonded through the existing companion-linking flow.
- Existing Actor drag-and-drop companion linking remains available.


### v0.1.55
Progression hardening release: corrected ASI-level Hit Die tracking, improved prerequisite resolution, preserved selected improvements through filtering changes, and hardened advancement completion handling.

<!-- v0.1.56 release-package trigger -->

<!-- v0.1.57 release-package trigger -->

<!-- v0.1.58 release-package trigger -->

<!-- v0.1.59 release-package trigger -->

<!-- v0.1.60 release-package trigger -->

<!-- v0.1.61 release-package trigger -->


## v0.1.64
- Prevent improvement selection from opening during level-down rollback.
- Resolve companion Hit Dice before opening the improvement selection screen on level-up.


## v0.1.65
- Prevent duplicate advancement hooks from reopening Choose Improvement after a level-down rollback.


## v0.1.66
- Make automatic improvement selection depend on an authoritative pre-update level transition.
- Prevent internal improvement Advancement Managers from re-entering the global companion advancement synchronizer.


<!-- Release packaging uses .github/workflows/package-release.yml. -->

<!-- Sheet integration release marker -->
