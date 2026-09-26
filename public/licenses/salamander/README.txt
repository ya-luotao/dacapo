Salamander Grand Piano (FreePats)
---------------------------------

Version v3+20200602 SFZ+FLAC

This version of the Salamander Gran Piano sound bank has been assembled by
roberto@zenvoid.org for the FreePats project. It contains samples in FLAC
format, a lossless compression format that provides the same quality than the
original WAV samples, using less storage space. Some SFZ synthesizers may not
support this format. Other versions and formats can be downloaded from:
http://freepats.zenvoid.org/Piano/acoustic-grand-piano.html

The original Salamander Grand Piano was created by Alexander Holm. Published
under the terms of the Creative Commons Attribution 3.0 license:
http://creativecommons.org/licenses/by/3.0/

The original README is included below.

---------------------------------


Salamander Grand Piano V2
Yamaha C5


Technical info

Recorded @ 48khz24bit
16 Velocity layers Sampled in minor thirds from the lowest A.
Hammer noise releases chromatically sampled in onle one layer.
String resonance releases in minor thirds in three layers.
Two AKG c414 disposed in an AB position ~12cm above the strings


Some other general info:
This piano has been optimized and only properly tested for linuxsampler.
If you want to optimize the .sfz yourself, values of interest are:
-amp_veltrack (dynamics, %)
-ampeg_release (note release decay, seconds)
-The volume(in dB) on the pedal noise is located on the bottom of the .sfz file under //pedalAction
[!] I suggest you make a backup of the .sfz file before you start fiddling with it :)
In the time of writing, sfz for linuxsampler has not come out of cvs. So, it's still a bit of a pain to get this paino going.

Changelog:

V3+20161209
* Fixed missing '=' in lines 449 to 464 of SalamanderGrandPianoV3Retuned.sfz.

V3
* Removed rowchange after every opcode the .sfz file should be more human readable for people who'd like to customize things.
* Re-export A5v7-15 that had noticeable delay in beginning of file.
* Adjusted the velocity at wich notes are triggered.
* Increased ampeg_release to 1.000
* Decreased amp_veltrack to 75
* Retuned version by Markus Fiedler
* The old V2 .sfz should work so no need to delete it if you like it :)
* fixed a missing note

V2:
* Re-exported all notes with all lowcut filters removed and eased off some eq on some notes around C4
* Replaced all pedal noise samples, there are now two down and two up samples.
* Increased ampeg_veltrack on release harmonics from A0 to C2
* Increased ampeg_release to 0.850
* Introduced a 44.1khz16bit and an ogg vorbis version


Licence:

CC-by
http://creativecommons.org/licenses/by/3.0/


Author: Alexander Holm
Feel free to mail me with any questions, if you're lucky, I might just answer them ;)
axeldenstore (at) gmail (dot) com



