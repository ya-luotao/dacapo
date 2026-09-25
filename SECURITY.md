# Security policy

dacapo runs entirely in your browser: there is no server, no account and no network request after
the app has loaded. Your practice data stays in the browser's IndexedDB and leaves it only when you
export it. Security issues are still possible, for example in how an imported MusicXML or export
file is read.

## Supported versions

Fixes go into the latest release and the `main` branch, which is what the live demo runs.

## Reporting a vulnerability

Please report it privately through GitHub:
[**Report a vulnerability**](https://github.com/ya-luotao/dacapo/security/advisories/new) (the
Security tab of the repository). Do not open a public issue for it.

Include what you found, how to reproduce it (a file that triggers it helps), and the browser and
version you used. You will get an answer within a week. Once a fix is released, the advisory is
published with credit to you, unless you prefer otherwise.
