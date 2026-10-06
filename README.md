# Tamer Companion Manager

Clean-room rebuild for Foundry VTT v14 / D&D 5e 6.x.

## Architecture rules

- ApplicationV2 only.
- No ApplicationV1 APIs.
- No monkey-patching of dnd5e classes.
- No replacement or registration of the dnd5e character sheet.
- No global DOM queries such as document.querySelector() for sheet integration.
- No global event listeners that intercept or stop other modules' events.
- All module DOM is scoped to the module application's root element.
- All CSS is scoped under .tamer-companion-manager.
- All custom data attributes use the data-tcm-* namespace.
- Manager rendering is explicit and localized; no render-loop hooks.
- Sheet integration, when introduced, will be isolated in its own adapter and will only augment an existing sheet.
- Existing dnd5e sheet markup will be treated as an external API and validated before use.
- No assumptions about a particular third-party sheet module.
- No changes to companion actors merely to display manager UI.
- No repeated full-sheet rerenders for manager state changes.

## Compatibility target

Foundry VTT v14.368 stable.
D&D 5e v6.0.5.

## Development stages

1. Standalone ApplicationV2 manager.
2. Data/record layer.
3. Improvement selection and validation.
4. Companion character-sheet augmentation.
5. Performance and coexistence testing.
6. Packaging and release validation.

The repository is intentionally being rebuilt rather than incrementally repairing the previous implementation.
