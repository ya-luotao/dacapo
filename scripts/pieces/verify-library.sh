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
#   anna-magdalena-05.mid  https://www.mutopiaproject.org/ftp/BachJS/BWVAnh115/anna-magdalena-05/anna-magdalena-05.mid
#   anna-magdalena-22.mid  https://www.mutopiaproject.org/ftp/BachJS/BWVAnh126/anna-magdalena-22/anna-magdalena-22.mid
#   25EF-01.mid            https://www.mutopiaproject.org/ftp/BurgmullerJFF/O100/25EF-01/25EF-01.mid
#   16OldFrenchSong.mid    https://www.mutopiaproject.org/ftp/TchaikovskyPI/O39/16OldFrenchSong/16OldFrenchSong.mid
#   01MorningPrayer.mid    https://www.mutopiaproject.org/ftp/TchaikovskyPI/O39/01MorningPrayer/01MorningPrayer.mid
#   Chop-28-20.mid         https://www.mutopiaproject.org/ftp/ChopinFF/O28/Chop-28-20/Chop-28-20.mid
#   gymnopedie_1.mid       https://www.mutopiaproject.org/ftp/SatieE/gymnopedie_1/gymnopedie_1.mid
#   schumann-op68-01-melodie.mid (CC BY-SA 2.5: a check only, never bundled)
#                          https://www.mutopiaproject.org/ftp/SchumannR/O68/schumann-op68-01-melodie/schumann-op68-01-melodie.mid
# Ode to Joy is our own arrangement and has no oracle. Nor have the lead sheets (trad-*, lyte-*,
# pierpont-*, foster-*): their melodies were read from scans of songbooks and proofread blind. Nor
# have the first pieces from Türk, Beyer and Czerny (turk-*, beyer-*, czerny-*): each was read
# from a scan of its edition and proofread blind by a second reader, fingering included.
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
verify "$lib/petzold-minuet-in-g-minor.musicxml" "$oracles/anna-magdalena-05.mid"
verify "$lib/bach-musette-in-d.musicxml" "$oracles/anna-magdalena-22.mid"
verify "$lib/burgmuller-candeur.musicxml" "$oracles/25EF-01.mid"
verify "$lib/tchaikovsky-old-french-song.musicxml" "$oracles/16OldFrenchSong.mid"
verify "$lib/tchaikovsky-morning-prayer.musicxml" "$oracles/01MorningPrayer.mid"
verify "$lib/chopin-prelude-in-c-minor.musicxml" "$oracles/Chop-28-20.mid"
# The oracle's staves are the edition's: the left hand's chords printed on the treble staff count
# as right-hand notes there, so its "hands" line shows fewer left-hand matches. Only the total counts.
verify "$lib/satie-gymnopedie-1.musicxml" "$oracles/gymnopedie_1.mid"
# This oracle plays the repeat. The file is our reading of the Schuberth edition of 1867; the
# oracle follows Edition Peters.
verify "$lib/schumann-melodie.musicxml" "$oracles/schumann-op68-01-melodie.mid" --order play
