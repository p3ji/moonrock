# Moonrock — three-tailed fox chasing the rabbit

Source exports and standalone preview of the character animation now used by the café.

## Preview
http://127.0.0.1:4187/assets/chase/preview.html

The fox follows the rabbit from left to right across a blue separator, with cream/menu and games panels above and below. Pause, replay, and change background controls are included. The live café now plays one chase each time the blue separator returns to the central viewing area. An active chase finishes uninterrupted, including when scrolling away and back. Entering the strip spawns a new chase only when the previous one is no longer playing.

## Files
- `fox-run-source.png`: original generated eight-pose sheet, referenced from the accepted three-tail fox design.
- `frames/`: eight transparent 320 × 320 normalized fox frames.
- `fox-run-sheet.png` / `.webp`: 2560 × 320 horizontal sprite strips.
- `fox-run.webp` / `fox-run.png`: animated fox-only loop, WebP / APNG.
- `fox-chases-rabbit.webp` / `.png`: transparent combined chase loops, 720 × 460, fox at left and rabbit leading on the right.
- `animation.json`: geometry and timing.
- `generation-prompt.txt`: exact prompt used with the built-in image-generation tool.

Eight frames at 80 ms each make a 640 ms cycle. The existing rabbit cycle is offset by two frames so the animals do not move in lockstep. Both share a ground baseline. Source fox poses were extracted by connected silhouette to avoid clipping tail tips at the generated sheet’s cell boundaries, then normalized using one shared scale and bottom-centre anchor.

The preview crosses the page over eight seconds, while the combined exports loop in place and are intended to be translated across a container later. Run sprites are 320px high; the preview makes the fox larger than the rabbit. All three trailing tail tips are visible in each fox source pose. Original static café artwork and rabbit source frames are preserved.

The deployment preparation script copies `assets/chase/fox-run-sheet.webp` alongside the rabbit sprite sheet. Source files, full animated exports and this standalone preview remain local.
