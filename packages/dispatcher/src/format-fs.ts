/**
 * Fault-store report formatter — mirrors INPA.exe's per-fault-entry
 * formatter (`FUN_00408ab8`, the body of `INPAapiFsLesen`).
 *
 * Real INPA writes a plain-text report to the filename the script
 * passes into `INPAapiFsLesen(ecu, fileName)`; `viewopen` then opens
 * that file in a viewer. The formatter itself is hard-coded inside
 * INPA.exe, not the SGBD — every BMW INPA install produces the same
 * canonical text shape for the same FS_LESEN result sets.
 *
 * Layout per fault entry (one EDIABAS result set):
 *
 *   {F_ORT_NR:>5}  {F_ORT_TEXT}                 ← header, always
 *   <HFK label> : {F_HFK}                       ← if mode & 0x20
 *   {F_UW1_NR:>5}  {F_UW1_TEXT}                 ← if mode & 0x02, loop
 *    {F_UW1_WERT} {F_UW1_EINH}                  ← if mode & 0x18 (val/unit)
 *   …
 *   {F_ART1_NR:>5}  {F_ART1_TEXT}               ← if mode & 0x04, loop
 *   …
 *
 * Bits set by `INPAapiFsMode(mode, …)` — scripts pass `255` to enable
 * everything. The bit table lives in the formatter (above the
 * implementation) and matches INPA.exe's `DAT_0048e998` semantics.
 *
 * FsLesen2 variant: same per-entry shape but the F_UW_* loop is
 * grouped by `F_UW_SATZ` (records-per-entry). The group header is a
 * resource-table label we don't have access to; we substitute a
 * neutral "Satz {n}" prefix.
 *
 * `getResultText` / `getResultInt` parameters mirror the IEdiabasProvider
 * surface — we only need read access. The caller is responsible for
 * having run the fault-store job before calling this.
 */

export interface EdiabasReader {
  resultSets(): number;
  resultInt(name: string, set: number): number;
  resultText(name: string, set: number, format: string): string;
  hasResult(name: string, set: number): boolean;
}

export interface FsFormatOptions {
  /** Bitmask from `INPAapiFsMode`. `255` = everything. */
  mode: number;
  /** FsLesen2 — environmental conditions are grouped by F_UW_SATZ. */
  variant: "FsLesen" | "FsLesen2";
}

// Mode bits — match `DAT_0048e998` in INPA.exe (FUN_00408ab8).
const MODE_HEADER = 0x01;       // F_ORT_NR + F_ORT_TEXT (effectively always on)
const MODE_UW = 0x02;           // env conditions block (F_UW_ANZ + F_UW%d_*)
const MODE_ART = 0x04;          // fault types block (F_ART_ANZ + F_ART%d_*)
const MODE_UW_VALUE = 0x08;     // include F_UW%d_WERT
const MODE_UW_UNIT = 0x10;      // include F_UW%d_EINH
const MODE_HFK = 0x20;          // include F_HFK (frequency)

const EOL = "\r\n";

function pad5(n: number): string {
  return String(n).padStart(5, " ");
}

function formatEntry(
  ediabas: EdiabasReader,
  set: number,
  mode: number,
  variant: FsFormatOptions["variant"]
): string {
  const out: string[] = [];

  // Header line — F_ORT_NR + F_ORT_TEXT. Missing → skip the whole
  // entry (matches the binary's `if iVar1 == 1 && …` guard).
  if (!ediabas.hasResult("F_ORT_NR", set) && !ediabas.hasResult("F_ORT_Nr", set)) return "";
  if (!ediabas.hasResult("F_ORT_TEXT", set)) return "";

  const ortNr = ediabas.resultInt(
    ediabas.hasResult("F_ORT_NR", set) ? "F_ORT_NR" : "F_ORT_Nr",
    set
  );
  const ortText = ediabas.resultText("F_ORT_TEXT", set, "");
  // FsLesen2 uses two leading spaces, FsLesen uses one (per the
  // distinct format-string addresses in the binary). Keep that
  // detail — it's what differentiates the visual output.
  out.push(`${variant === "FsLesen2" ? " " : ""} ${pad5(ortNr)}  ${ortText}`);

  // Optional HFK (frequency) line.
  if ((mode & MODE_HFK) !== 0 && ediabas.hasResult("F_HFK", set)) {
    const hfk = ediabas.resultInt("F_HFK", set);
    // Real INPA pulls the label from a resource table at runtime; we
    // hard-code the German abbreviation since that's what every
    // observed report uses.
    out.push(` Häufigkeit : ${hfk}`);
  }

  // Environmental conditions (F_UW_*). FsLesen iterates F_UW_ANZ
  // entries; FsLesen2 divides F_UW_ANZ by F_UW_SATZ to get groups
  // and emits a "Satz N" header per group.
  if ((mode & MODE_UW) !== 0 && ediabas.hasResult("F_UW_ANZ", set)) {
    const anz = ediabas.resultInt("F_UW_ANZ", set);
    const groupSize =
      variant === "FsLesen2" && ediabas.hasResult("F_UW_SATZ", set)
        ? ediabas.resultInt("F_UW_SATZ", set)
        : 0;

    if (groupSize >= 2 && anz % groupSize === 0) {
      const groups = anz / groupSize;
      for (let g = 1; g <= groups; g++) {
        out.push(`  Satz ${g}`);
        emitUwBlock(ediabas, set, mode, out, (g - 1) * groupSize + 1, g * groupSize);
        if (g < groups) out.push("  --");
      }
    } else {
      emitUwBlock(ediabas, set, mode, out, 1, anz);
    }
  }

  // Fault types (F_ART_*).
  if ((mode & MODE_ART) !== 0 && ediabas.hasResult("F_ART_ANZ", set)) {
    const anz = ediabas.resultInt("F_ART_ANZ", set);
    for (let i = 1; i <= anz; i++) {
      const nrKey = `F_ART${i}_NR`;
      const textKey = `F_ART${i}_TEXT`;
      if (!ediabas.hasResult(nrKey, set) || !ediabas.hasResult(textKey, set)) continue;
      const nr = ediabas.resultInt(nrKey, set);
      const text = ediabas.resultText(textKey, set, "");
      out.push(` ${pad5(nr)}  ${text}`);
    }
  }

  // Header bit isn't checked above because real INPA effectively
  // always emits the F_ORT_NR header; the mode bit is conceptual.
  // Suppress only if the caller explicitly cleared MODE_HEADER.
  if ((mode & MODE_HEADER) === 0) {
    return "";
  }

  return out.join(EOL) + EOL;
}

function emitUwBlock(
  ediabas: EdiabasReader,
  set: number,
  mode: number,
  out: string[],
  from: number,
  to: number
): void {
  for (let i = from; i <= to; i++) {
    const nrKey = `F_UW${i}_NR`;
    const textKey = `F_UW${i}_TEXT`;
    if (!ediabas.hasResult(nrKey, set) || !ediabas.hasResult(textKey, set)) continue;
    const nr = ediabas.resultInt(nrKey, set);
    const text = ediabas.resultText(textKey, set, "");
    out.push(` ${pad5(nr)}  ${text}`);

    // Append " <wert> <einh>" tail when either bit is set — matches
    // the binary which emits an empty placeholder for the disabled
    // field so the two-column layout stays stable.
    if ((mode & (MODE_UW_VALUE | MODE_UW_UNIT)) !== 0) {
      const wert =
        (mode & MODE_UW_VALUE) !== 0 && ediabas.hasResult(`F_UW${i}_WERT`, set)
          ? ediabas.resultText(`F_UW${i}_WERT`, set, "")
          : "";
      const einh =
        (mode & MODE_UW_UNIT) !== 0 && ediabas.hasResult(`F_UW${i}_EINH`, set)
          ? ediabas.resultText(`F_UW${i}_EINH`, set, "")
          : "";
      if (wert || einh) out.push(` ${wert} ${einh}`);
    }
  }
}

/**
 * Format every result set produced by the most recent FS_LESEN job
 * as one INPA-style report. The caller is responsible for having
 * run the job; this just walks `ediabas.resultSets()`.
 */
export function formatFsLesenReport(
  ediabas: EdiabasReader,
  options: FsFormatOptions
): string {
  const total = ediabas.resultSets();
  if (total === 0) return "";
  const parts: string[] = [];
  for (let set = 1; set <= total; set++) {
    const entry = formatEntry(ediabas, set, options.mode, options.variant);
    if (entry) parts.push(entry);
  }
  return parts.join("");
}
