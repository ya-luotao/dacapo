#!/bin/sh
# Renders the app icons, the social card and the GitHub social preview from the files in this
# folder. Needs rsvg-convert (librsvg) and Google Chrome; run from the repository root.
set -eu
CHROME=${CHROME:-"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"}
DIR=scripts/brand

rsvg-convert -w 192 -h 192 "$DIR/icon.svg" -o public/icons/icon-192.png
rsvg-convert -w 512 -h 512 "$DIR/icon.svg" -o public/icons/icon-512.png
rsvg-convert -w 512 -h 512 "$DIR/icon-maskable.svg" -o public/icons/icon-maskable-512.png
rsvg-convert -w 180 -h 180 "$DIR/icon-maskable.svg" -o public/icons/apple-touch-icon.png

card() {
  "$CHROME" --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --allow-file-access-from-files --virtual-time-budget=2000 \
    --window-size="$1,$2" --screenshot="$3" "file://$PWD/$DIR/card.html"
}
card 1200 630 public/social-card.png
card 1280 640 docs/images/social-preview.png
