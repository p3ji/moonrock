# Moonrock — a small place to land

A home café for familiar faces. Calm, tactile, a little curious. Space appears in the arrival and a single rock; the food stays plainly named.

## Palette

| Role | Colour |
| --- | --- |
| Paper / menu background | `#F3EFE5` |
| Ink / primary text | `#242A27` |
| Night / arrival background | `#171B1B` |
| Muted text | `#676B61` |
| Silver / lunar emblem | `#BDB6A6` |
| Rules / dividers | `#D2D0C2` |

Use ink and muted text on paper. Use paper and pale silver text on night. Silver is decorative on paper, not a small-text colour.

## Typography

**Cormorant Garamond** for the wordmark, large headings, and the brief welcome. **Noto Sans SC** for English and Simplified Chinese menu text. Both are bundled under the SIL Open Font License; licenses accompany the fonts. The website uses small WOFF2 subsets. The PDF embeds font subsets. English names lead; Chinese sits beneath on screen and alongside in print.

## Marks and imagery

`assets/wordmark.svg` is an outlined wordmark. Preserve its proportions and keep clear space around it. The dot is part of the wordmark. `assets/emblem.svg` is a secondary lunar mark, not a replacement for the name. Use the original moon rock as the single main image. Avoid extra planets, fantasy animals, busy star textures, gradients behind menu text, and decorative script lettering.

## Voice

Short and hospitable: “You made it. Make yourself at home.” “Another helping? Just ask.” No made-up ingredients, dietary guarantees, prices, or grand claims. This is a home café, with no business address or operating hours.

## Motion

Silent six-second arrival. Stars expand from the centre, the rock approaches and settles, the title appears, and the scene dissolves to the website. Always keep Skip visible. Reduced-motion mode is static. No looping ambient motion or scroll hijacking.

## Artwork provenance

Generated with the built-in image-generation tool, with transparent background. Original: `assets/moonrock-source.png`; optimized copy: `assets/moonrock.webp`. Only resized and WebP-encoded after generation; transparency retained.

Final generation prompt:

> Use case: stylized-concept. Asset: isolated moon rock for a quiet home cafe named Moonrock, used in website and print. A single beautifully irregular lunar basalt specimen, floating, centered, three-quarter view. Tactile finely pitted charcoal and warm silver stone, subtle craters, softly lit from upper left with warm cream highlights and deep realistic shadows. Sculptural editorial still-life, understated museum specimen photography. Entire silhouette visible with generous transparent padding. Actual transparent background. No ground, no cast shadow outside the rock, no stars, no text, no glow, no border. Square composition.

## Three-tail fox and rabbit update
The website uses `assets/fox-three-tails-v2.webp` with three distinct hanging tail tips and a matching masked eyes-open frame. Original artwork remains available. Exact image-generation prompts and source paths are in `assets/fox-three-tails-v2-notes.json`. A separate eight-frame rabbit cycle runs once between menu and games; sprite exports and source are in `assets/rabbit/`.

## Approved natural curl and eye stages
The live hero now uses `assets/fox-natural/`: a compact three-tail curl that preserves the original style, with asleep, half-open and open eye stages. The blue separator uses the fox and rabbit sprite sheets together as a one-time chase. Exact artwork prompts and originals are retained in the asset folders.
