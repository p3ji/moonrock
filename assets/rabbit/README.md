# Moonrock rabbit — standalone animation assets

A right-facing cream/silver rabbit with lavender shadows, engraved fur strokes and warm brown eyes, matching the fox illustration’s palette and medium.

## Preview
Open `preview.html` using the local static server: http://127.0.0.1:4187/assets/rabbit/preview.html. Pause, replay, and switch cream/night backgrounds. This is a separate placement study between the menu and games; the same animation is now integrated into the café between the menu and games.

## Deliverables
- `rabbit-run-source.png`: untouched generated 4 × 2 pose sheet.
- `frames/`: eight normalized transparent 320 × 320 PNG frames.
- `rabbit-run-sheet.png` and `.webp`: 2560 × 320 horizontal sprite strips.
- `rabbit-run.webp`: transparent animated WebP, eight frames, 80 ms per frame, 640 ms loop.
- `rabbit-run.png`: transparent animated PNG (APNG), same timing.
- `animation.json`: frame geometry and timing.
- `generation-prompt.txt`: exact prompt, generated using the built-in image-generation tool with the original fox artwork as a style reference.

## Intended placement
A low, uncluttered crossing strip below the menu and above the games. Rabbit travels left to right, entering off-screen, making several galloping strides, then exiting toward the game section. Preview crosses in six seconds, including a brief off-screen pause before repeat. The live site now uses the fox-and-rabbit chase, replaying once on each distinct viewing pass. The standalone preview preserves the rabbit-only study. No food text or ordering controls should be covered.

The CSS sprite uses `background-size: 800% 100%` with eight stepped frames. The sheet’s final background-position is 114.285714% to advance exactly one frame per step. Frame alignment uses one shared scale with a bottom-centre anchor. Individual frames are preserved for alternate timing or a future scroll-driven version.

The source character was generated as one full cycle to reduce identity drift. The sprite pipeline normalized and cropped the sheet; animated exports and the layout preview were assembled locally. There is no generated video or external runtime requirement.
