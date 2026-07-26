# Report fonts

`DejaVuSans.ttf` and `DejaVuSans-Bold.ttf`, embedded into every generated PDF.

## Why a font is committed here at all

The 14 fonts a PDF reader is required to have — Helvetica, Times, Courier —
are limited to WinAnsi encoding, which does **not** contain `ş`, `ğ`, `İ` or
`ı`. A report about a Turkish delivery team rendered in Helvetica loses those
characters or substitutes them, and the failure is silent.

Embedding solves it properly: the glyphs travel inside the file, so the report
renders identically on a machine that has never heard of DejaVu — a reviewer's
laptop, an auditor's tablet, a print shop. pdf-lib subsets the font to the
glyphs actually used, so a typical report adds tens of kilobytes rather than
the full 760 KB.

DejaVu over the narrower alternatives because it also carries `₺`, Greek and
Cyrillic. Liberation Sans is 400 KB lighter and covers Turkish, but not the
lira sign.

## Licence

Bitstream Vera Fonts Copyright (c) 2003 Bitstream, Inc. DejaVu changes are in
the public domain. Redistribution is permitted; the full text is in
`LICENSE.txt` and must travel with these files.
