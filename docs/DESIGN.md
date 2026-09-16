# Sumi: Sohken interface specification

Sohken helps a solo operator inspect content and review exact agent actions. The visual direction is Japanese-inspired restraint: quiet surfaces, deliberate spacing and a small seal-like brand mark. It is a working security console with real local state.

## References and interpretation

- [Linear](https://linear.app): reference for focused product hierarchy and navigation.
- [Raycast](https://www.raycast.com): reference for a compact desktop companion experience.
- [Warp](https://www.warp.dev): reference for developer-facing clarity and terminal context.

Official sites were consulted during research. Linear's product hierarchy and navigation were also visually inspected in the in-app browser after an initial navigation timeout. Brand assets and layouts were not copied.

## Palette

| Role | Color | Usage |
| --- | --- | --- |
| Sumi | #171918 | Main canvas |
| Washi | #F0ECE2 | Primary text |
| Indigo | #A7B9D5 | Location and focus |
| Vermilion | #DE8A72 | Risk accents |
| Sage | #B3C8AC | Local connection status |

Status always has a text label. Color alone never establishes safety. Primary actions use an ivory fill; secondary controls have restrained borders. No gradients, particle effects or decorative security scores.

Georgia provides the editorial display contrast. Yu Gothic UI provides the Windows body typography, with Yu Gothic and sans-serif fallbacks. Bahnschrift provides tabular metrics. These fonts are resolved locally rather than copied or redistributed. Other operating systems can render fallback fonts differently.

## Motion and interaction

View changes reveal over 340ms with a 7px vertical movement and cubic-bezier(.22,1,.36,1). Controls transition over 180ms. A press moves a button by 1px. Reduced-motion settings disable all animations and transitions. Security requests do not wait for animation completion.

Pending actions sort before completed history. Exact tool arguments remain visible. Activity summaries expand to show JSON evidence. Navigation changes reset scroll position. The compact layout preserves named, keyboard-accessible navigation controls.

## Design assessment

Frontend design assessment: distinctiveness 4/5, fit 5/5, implementation feasibility 5/5, accessibility feasibility 4/5. This is a design judgment, not a user-study result. Follow-up: test with users and measure contrast across every state before making an accessibility conformance claim.

[Figma specification board](https://www.figma.com/design/oDscr164NN77uMMUEvID5a?node-id=2-2) records the palette, typography intent and motion rules. It is a specification board, not a full interactive Figma clone. The working code is the canonical interface.
