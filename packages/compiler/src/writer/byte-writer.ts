/**
 * Tiny growable byte buffer used by the IPO writer. Avoids depending on
 * Node Buffer so the compiler can be bundled for the web app.
 */
export class ByteWriter {
  private bytes: number[] = [];

  get length(): number {
    return this.bytes.length;
  }

  u8(v: number): void {
    this.bytes.push(v & 0xff);
  }

  u16LE(v: number): void {
    this.bytes.push(v & 0xff, (v >>> 8) & 0xff);
  }

  s16LE(v: number): void {
    this.u16LE(v & 0xffff);
  }

  u32LE(v: number): void {
    this.bytes.push(
      v & 0xff,
      (v >>> 8) & 0xff,
      (v >>> 16) & 0xff,
      (v >>> 24) & 0xff,
    );
  }

  s32LE(v: number): void {
    this.u32LE(v >>> 0);
  }

  f64LE(v: number): void {
    const buf = new ArrayBuffer(8);
    new DataView(buf).setFloat64(0, v, true);
    const view = new Uint8Array(buf);
    for (let i = 0; i < 8; i++) this.bytes.push(view[i]);
  }

  /** Writes a string as raw bytes (no terminator). Latin-1 / windows-1252. */
  asciiBytes(s: string): void {
    for (let i = 0; i < s.length; i++) {
      this.bytes.push(s.charCodeAt(i) & 0xff);
    }
  }

  /**
   * IPO strings are terminated by 0x0A (LF). Matches the magic header
   * and per-block name encoding in docs/ipo-file-structure.md.
   */
  lfString(s: string): void {
    this.asciiBytes(s);
    this.u8(0x0a);
  }

  toUint8Array(): Uint8Array {
    return Uint8Array.from(this.bytes);
  }
}
