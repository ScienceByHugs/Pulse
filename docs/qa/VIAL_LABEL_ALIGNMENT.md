# Vial label alignment — October 14, 2026

Included in local build 17; submission is held at Anthony's instruction.
Uploaded TestFlight build 15 is unchanged.

The illustrative vial now uses a shared image-coordinate layout for the
thumbnail and enlarged view. Fixed, vertically centered slots keep the name
above the blue quantity band and the quantity inside it. Brand and research
text use the same coordinate system. Long names use a smaller font and up to
two lines. Decorative image text does not grow independently with system
text settings; the surrounding substance name and details remain accessible.

Local browser review checked Retatrutide, MOTS-C, Testosterone Cypionate and
a long fictional custom name at 88px and 258px. Screenshot:
`output/ui/vial-label-alignment-review.jpg` (local, uncommitted).

TypeScript and native iOS archive/export passed. Native iOS/Android font
rendering still needs device verification. Build 17 is held locally; no
TestFlight upload was performed. See BUILD_17_RELEASE.md.
