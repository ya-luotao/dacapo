#!/bin/sh
# Proofreads every built-in piece against its MIDI oracle (see README.md).
#
#   scripts/pieces/verify-library.sh <dir with the oracle MIDI files>
#
# The oracles are not in the repository; download them from the Mutopia Project:
#   anna-magdalena-04.mid  https://www.mutopiaproject.org/ftp/BachJS/BWVAnh114/anna-magdalena-04/anna-magdalena-04.mid
#   fur_Elise_WoO59.mid    https://www.mutopiaproject.org/ftp/BeethovenLv/WoO59/fur_Elise_WoO59/fur_Elise_WoO59.mid
#   25EF-02.mid            https://www.mutopiaproject.org/ftp/BurgmullerJFF/O100/25EF-02/25EF-02.mid
#   schumann-op68-02-marche-militaire.mid (CC BY-SA 2.5: a check only, never bundled)
#                          https://www.mutopiaproject.org/ftp/SchumannR/O68/schumann-op68-02-marche-militaire/schumann-op68-02-marche-militaire.mid
#   wtk1-prelude1.mid      https://www.mutopiaproject.org/ftp/BachJS/BWV846/wtk1-prelude1/wtk1-prelude1.mid
# Ode to Joy is our own arrangement and has no oracle.
set -eu
oracles=${1:?usage: verify-library.sh <oracle dir>}
lib=src/pieces/library
verify() { node --experimental-strip-types scripts/pieces/verify.ts "$@"; }

verify "$lib/petzold-minuet-in-g.musicxml" "$oracles/anna-magdalena-04.mid"
# The A section, then its closing bar against the last bar of the piece (see the source file).
verify "$lib/beethoven-fur-elise.musicxml" "$oracles/fur_Elise_WoO59.mid" --bars 0-23
verify "$lib/beethoven-fur-elise.musicxml" "$oracles/fur_Elise_WoO59.mid" --bars 24-24 --midi-at 156
verify "$lib/burgmuller-arabesque.musicxml" "$oracles/25EF-02.mid"
# This oracle plays the repeat.
verify "$lib/schumann-soldiers-march.musicxml" "$oracles/schumann-op68-02-marche-militaire.mid" --order play
verify "$lib/bach-prelude-in-c.musicxml" "$oracles/wtk1-prelude1.mid"
