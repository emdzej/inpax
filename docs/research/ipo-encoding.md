# IPO string encoding — current state and limitations

## The fact

INPA `.ipo` files **carry no encoding marker**. String constants are
emitted as raw bytes by BMW's IPO compiler, and INPA.exe always reads
those bytes back as **cp1252** (Windows Western European Latin-1).
This is hard-coded into the runtime. Every IPO in the wild is therefore
implicitly cp1252.

`inpax` and `ipo-editor` both accept an `--input-encoding` / `--codepage`
flag to override the decoding side — useful for forensic analysis of
hand-edited files — but this is a tooling convenience, not a property
of the format.

## Why this matters for patches

The patch system lets the user declare a `target_encoding` per patch
file. We honour it for byte-level correctness:

- Polish characters (`ł`, `ó`, `ż`, `ś`) only exist in cp1250.
- Cyrillic only exists in cp1251.
- The patch validator already rejects strings that can't be encoded
  into the patch's declared `target_encoding`, so the file we write is
  bytewise valid against whatever encoding the user asked for.

But the resulting patched `.ipo` is **only compatible with stock INPA
if `target_encoding == cp1252`**. If someone writes `ł` (byte `0xB3` in
cp1250) into a patched IPO and then opens that file in real INPA, INPA
reads `0xB3` as cp1252 — which is `³` (superscript 3). The user sees
gibberish, not Polish.

The same byte. Two different glyphs. No encoding marker to disambiguate.

## What we do today

Both `patch init` and `patch apply` **warn loudly** when the effective
target encoding is anything other than cp1252:

```
warning: output encoding is 'cp1250', not cp1252 — stock INPA.exe will
misrender these strings (it always reads .ipo as cp1252). See
docs/research/ipo-encoding.md.
```

The operation isn't blocked — there are valid offline-analysis use
cases for non-cp1252 patches, and our own tooling (`ipo-editor`,
`inpax run`) can read non-cp1252 IPOs by passing the right encoding
flag — but the warning makes the hazard explicit at every entry point.

## What we'd need to properly support non-cp1252

Real per-IPO encoding flexibility would need work on multiple layers:

1. **Format extension** — embed an encoding marker in the IPO so
   readers can pick the right decoder. Without BMW's blessing this is
   a fork: stock INPA will still read everything as cp1252 and ignore
   any marker we add. Workable for our own runtime only.

2. **Parser** — already accepts an encoding param via `walkIpo()`. No
   change needed beyond defaulting to cp1252 (current behaviour).

3. **Editor / TUI** — already handles the encoding param. No changes.

4. **Runtime** — `inpax-web` and the CLI runtime pass cp1252 through
   to the dispatcher / VM. They'd need to plumb a per-IPO encoding
   through to string operations (in particular `INPAapiResultText`'s
   string handling).

5. **Compiler** — `inpax-compiler` would need to know which encoding
   to emit strings in when building from IPS source. Currently this
   ships strings as cp1252.

Until those land, the safest practice is: **keep `target_encoding`
at cp1252, even for translations**. Languages with characters outside
the cp1252 range (Polish, Czech, Cyrillic, Greek, Turkish, …) can't be
faithfully translated within stock INPA's constraints — only via a
forked runtime that respects an encoding marker we'd add.

## Recommendation

For now:

- **English / German / French / Spanish / Italian / Portuguese** —
  fully expressible in cp1252. Translate freely.
- **Polish, Czech, Slovak, Croatian, etc.** — cp1250. Tooling will
  warn; patched files won't render correctly in stock INPA but
  *will* work in our `inpax` runtime if loaded with
  `--input-encoding cp1250`.
- **Russian, Bulgarian, Serbian (Cyrillic)** — cp1251. Same caveat.
- **Greek** — cp1253. Same caveat.

When `inpax` runtime support for embedded encoding markers lands, this
note will move to "historical limitations".
