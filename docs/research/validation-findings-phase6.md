# Validation Findings - Phase 6: System Imports

## 1. Import32 Confirmation
Analysis of `startus.ipo` (via base64 dump) confirms the usage of imported functions.
The binary contains strings like:
```
kernel32::GetPrivateProfileStringA:c.sssSis%I
INPA_LIB32.DLL::SaveAsDialogBox:c.sSi%I
api32.DLL::__apiGetConfig:c.lsS%I
```

### Format Decoding
The strings follow a pattern: `DLL::Function:convention.signature`
- `c` = Cdecl convention?
- `l` = long (32-bit)
- `s` = string
- `S` = string (possibly pointer or mutable?)
- `i` = int
- `%I` = Returns Int?

Example: `api32.DLL::__apiGetConfig:c.lsS%I`
Matches: `ApiGetConfig(in:long Handle, in:string Name, out:string Buffer, returns:int ReturnedValue);`
- `l` -> `long Handle`
- `s` -> `string Name`
- `S` -> `string Buffer` (Out param?)
- `%I` -> `returns: int`

## 2. Compilation Verification
- `test_import32.ips` compiled successfully using `import32`.
- The compiler accepted the syntax.
- The resulting `.ipo` (once located) should contain these import strings.

## 3. IPO Location Mystery
- `INPACOMP` on Windows seems to output to `C:\EC-APPS\INPA\SGDAT` or current dir, but file system synchronization or specific path logic made it hard to find.
- Using `INPACOMP <src> <obj>` explicitly works.

## 4. Next Actions
- Update `inpax` VM to parse these import strings.
- Implement `api32.dll` emulation mapping.
- Support `kernel32` mapping for file ops if needed.

## 5. Opcode Validation
- `startus.ipo` analysis shows standard opcodes.
- `0x02` (PUSH_HANDLE?) not explicitly seen in simple dump but `chrinit` etc are present.
- `ShowBatteryIgnition` function is present.

## Conclusion
The `import32` syntax and `api32.DLL` usage are confirmed. The VM needs to support dynamic loading or emulation of these specific signatures.
