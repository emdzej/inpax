/**
 * Fault-store report formatter — mirrors INPA.exe's `INPAapiFsLesen`
 * canonical output. Layout reference: the user-supplied screenshot of
 * a real INPA fault report on MS43, captured 2026-05-13.
 *
 * Per-entry source fields come from `FUN_00408ab8` in INPA.exe (the
 * per-fault formatter, see `docs/research/per-ipo-ini-files.md` and
 * the FsLesen mode-bitmask analysis): `F_ORT_NR`, `F_ORT_TEXT`,
 * `F_HFK`, `F_UW_ANZ` + `F_UW%d_TEXT` / `F_UW%d_WERT` / `F_UW%d_EINH`,
 * `F_ART_ANZ` + `F_ART%d_TEXT`, and `F_HEX_CODE`.
 *
 * Layout (approximate widths from the reference screenshot):
 *
 *   ```
 *               E R R O R   M E M O R Y   R E P O R T
 *               ---------------------------------------------
 *
 *   Date:       MM/dd/yy HH:mm:ss
 *   ECU:        <ecu>
 *   JobStatus:  <JOB_STATUS>
 *   Variant:    <VARIANTE>
 *   ------------------------------------------------------------
 *
 *   RESULT:     N errors in error memory !
 *   ------------------------------------------------------------
 *
 *   <NR>   <F_ORT_TEXT>
 *
 *   Error frequency : <F_HFK>
 *   Logistic counter: <F_LZ-or-similar>     (skipped if absent)
 *
 *       <F_UW%d_TEXT padded>       <F_UW%d_WERT right-aligned>  <F_UW%d_EINH>
 *       …
 *       ---                                                     (when F_UW%d_TEXT empty)
 *
 *       <F_ART%d_TEXT>
 *       ---                                                     (when F_ART%d_TEXT empty)
 *
 *   Errorcode: XX XX XX …
 *   ------------------------------------------------------------
 *   ```
 *
 * Mode bits from `INPAapiFsMode(mode, …)` still gate the optional
 * blocks — mode 255 emits everything (the default scripts use).
 */

export interface EdiabasReader {
  resultSets(): number;
  resultInt(name: string, set: number): number;
  resultText(name: string, set: number, format: string): string;
  resultBinary?(name: string, set: number): Uint8Array;
  hasResult(name: string, set: number): boolean;
}

export interface FsFormatOptions {
  /** Bitmask from `INPAapiFsMode`. `255` = everything. */
  mode: number;
  /** FsLesen2 — environmental conditions are grouped by F_UW_SATZ. */
  variant: "FsLesen" | "FsLesen2";
  /**
   * ECU name passed to `INPAapiFsLesen(ecu, fileName)`. Surfaced on
   * the `ECU:` header line. Optional so the helper still produces a
   * sensible body when callers don't pass it (e.g. unit tests).
   */
  ecu?: string;
}

// Mode bits — match `DAT_0048e998` in INPA.exe (FUN_00408ab8).
const MODE_HEADER = 0x01;       // F_ORT_NR + F_ORT_TEXT (effectively always on)
const MODE_UW = 0x02;           // env conditions block (F_UW_ANZ + F_UW%d_*)
const MODE_ART = 0x04;          // fault types block (F_ART_ANZ + F_ART%d_*)
const MODE_UW_VALUE = 0x08;     // include F_UW%d_WERT
const MODE_UW_UNIT = 0x10;      // include F_UW%d_EINH
const MODE_HFK = 0x20;          // include F_HFK (frequency)

const EOL = "\r\n";

/** Width of the report rule lines, picked to match the reference screenshot. */
const RULE = "-".repeat(64);
/** Column the F_UW values right-align to inside the data block. */
const VALUE_COL = 48;

function pad3(n: number): string {
  return String(n).padStart(3, " ");
}

function dateLine(): string {
  // INPA prints `MM/dd/yy HH:mm:ss` (US-style date). Mirror that
  // exactly so reports look identical across browser / desktop INPA.
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const yy = pad(d.getFullYear() % 100);
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return `${mm}/${dd}/${yy} ${hh}:${mi}:${ss}`;
}

function hasOrt(ediabas: EdiabasReader, set: number): boolean {
  return (
    (ediabas.hasResult("F_ORT_NR", set) || ediabas.hasResult("F_ORT_Nr", set)) &&
    ediabas.hasResult("F_ORT_TEXT", set)
  );
}

function readOrtNr(ediabas: EdiabasReader, set: number): number {
  return ediabas.resultInt(
    ediabas.hasResult("F_ORT_NR", set) ? "F_ORT_NR" : "F_ORT_Nr",
    set
  );
}

function dataLine(text: string, value: string, unit: string): string {
  // Layout: 4-space indent + TEXT padded so VALUE right-aligns at
  // VALUE_COL; two spaces; UNIT. Matches the reference screenshot's
  // visual columns.
  const indent = "    ";
  const textPart = text;
  // Width available for the text column: VALUE_COL - indent.length.
  const textCol = VALUE_COL - indent.length - value.length - 1;
  const textPadded = textPart.padEnd(Math.max(textCol, 0), " ");
  return `${indent}${textPadded} ${value}  ${unit}`.trimEnd();
}

function formatFaultEntry(
  ediabas: EdiabasReader,
  set: number,
  mode: number
): string {
  const out: string[] = [];
  const ortNr = readOrtNr(ediabas, set);
  const ortText = ediabas.resultText("F_ORT_TEXT", set, "");

  out.push(`${pad3(ortNr)}   ${ortText}`);
  out.push("");

  // Frequency + logistic counter. F_HFK is the only INPA-canonical
  // counter we have a stable name for; the screenshot also shows a
  // second "Logistic counter:" line. Real INPA reads that from a
  // resource-table-keyed field name we don't have visibility into
  // (it doesn't appear in the binary as a literal `F_*` string). We
  // try a couple of common candidates and skip silently if none
  // are present.
  if ((mode & MODE_HFK) !== 0 && ediabas.hasResult("F_HFK", set)) {
    out.push(`Error frequency : ${ediabas.resultInt("F_HFK", set)}`);
  }
  for (const name of ["F_LZ", "F_LOGZAEHLER", "F_LOG_ZAE"]) {
    if (ediabas.hasResult(name, set)) {
      out.push(`Logistic counter: ${ediabas.resultInt(name, set)}`);
      break;
    }
  }
  out.push("");

  // F_UW block — environmental conditions captured at fault time.
  // Empty entries (F_UW%d_TEXT == "") render as a `---` separator,
  // matching the reference screenshot where missing entries in the
  // middle of the block keep the surrounding ones spatially anchored.
  if ((mode & MODE_UW) !== 0 && ediabas.hasResult("F_UW_ANZ", set)) {
    const anz = ediabas.resultInt("F_UW_ANZ", set);
    for (let i = 1; i <= anz; i++) {
      const textKey = `F_UW${i}_TEXT`;
      const text = ediabas.hasResult(textKey, set)
        ? ediabas.resultText(textKey, set, "")
        : "";
      if (!text) {
        out.push("    ---");
        continue;
      }
      const wert =
        (mode & MODE_UW_VALUE) !== 0 && ediabas.hasResult(`F_UW${i}_WERT`, set)
          ? ediabas.resultText(`F_UW${i}_WERT`, set, "")
          : "";
      const einh =
        (mode & MODE_UW_UNIT) !== 0 && ediabas.hasResult(`F_UW${i}_EINH`, set)
          ? ediabas.resultText(`F_UW${i}_EINH`, set, "")
          : "";
      out.push(dataLine(text, wert, einh));
    }
    out.push("");
  }

  // F_ART block — fault types / classifiers. Empty slots show `---`
  // the same way as the UW block above.
  if ((mode & MODE_ART) !== 0 && ediabas.hasResult("F_ART_ANZ", set)) {
    const anz = ediabas.resultInt("F_ART_ANZ", set);
    for (let i = 1; i <= anz; i++) {
      const textKey = `F_ART${i}_TEXT`;
      const text = ediabas.hasResult(textKey, set)
        ? ediabas.resultText(textKey, set, "")
        : "";
      if (!text) {
        out.push("    ---");
      } else {
        out.push(`    ${text}`);
      }
    }
    out.push("");
  }

  // Errorcode hex dump — F_HEX_CODE is a Uint8Array we render as
  // space-separated upper-case hex bytes. Matches the screenshot's
  // `Errorcode: D7 B2 01 21 51 17 15 3F A5 B9`.
  if (ediabas.hasResult("F_HEX_CODE", set) && ediabas.resultBinary) {
    const bytes = ediabas.resultBinary("F_HEX_CODE", set);
    if (bytes.length > 0) {
      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0").toUpperCase()).join(" ");
      out.push(`Errorcode: ${hex}`);
    }
  }

  // Mode_HEADER conceptually gates the F_ORT_NR / TEXT line — if a
  // caller explicitly cleared it, suppress the whole entry (matches
  // INPA's bitmask behaviour even though no real script does this).
  if ((mode & MODE_HEADER) === 0) return "";

  return out.join(EOL) + EOL;
}

/**
 * Format every fault entry plus an INPA-style header block.
 * `JOB_STATUS` / `VARIANTE` are read out of the result sets (set 0
 * for system results, or scanned across sets as a fallback).
 */
export function formatFsLesenReport(
  ediabas: EdiabasReader,
  options: FsFormatOptions
): string {
  const total = ediabas.resultSets();

  // Count fault entries (sets that have F_ORT_NR). The first
  // result set in an FS_LESEN response is typically metadata
  // (JOB_STATUS + ECU info) — there may be 0 fault entries in a
  // clean ECU even though `total > 0`.
  let faultCount = 0;
  for (let set = 1; set <= total; set++) {
    if (hasOrt(ediabas, set)) faultCount++;
  }

  const jobStatus = readSystemString(ediabas, "JOB_STATUS", total) || "OKAY";
  const variant = readSystemString(ediabas, "VARIANTE", total) || options.ecu || "";

  // Header block — title + per-job metadata + result summary.
  const header: string[] = [
    "",
    "            E R R O R   M E M O R Y   R E P O R T",
    "            ---------------------------------------------",
    "",
    `Date:       ${dateLine()}`,
    `ECU:        ${options.ecu ?? variant ?? ""}`,
    `JobStatus:  ${jobStatus}`,
    `Variant:    ${variant}`,
    RULE,
    "",
    `RESULT:     ${faultCount} ${faultCount === 1 ? "error" : "errors"} in error memory !`,
    RULE,
    "",
  ];

  const parts: string[] = [header.join(EOL)];
  let emittedAny = false;
  for (let set = 1; set <= total; set++) {
    if (!hasOrt(ediabas, set)) continue;
    parts.push(formatFaultEntry(ediabas, set, options.mode));
    parts.push(RULE);
    parts.push("");
    emittedAny = true;
  }
  if (!emittedAny) {
    parts.push("(no faults stored)");
    parts.push(EOL);
  }

  return parts.join(EOL);
}

/**
 * Look up a "system result" by name — system results live in set 0
 * of the EDIABAS response, but providers vary on whether they
 * expose them there. Falls through to scanning higher sets if
 * absent.
 */
function readSystemString(ediabas: EdiabasReader, name: string, total: number): string {
  if (ediabas.hasResult(name, 0)) return ediabas.resultText(name, 0, "");
  for (let set = 1; set <= total; set++) {
    if (ediabas.hasResult(name, set)) return ediabas.resultText(name, set, "");
  }
  return "";
}
