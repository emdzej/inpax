# Phase 5 Findings: State Machines & DLL Imports

## 1. State Machine Syntax (Confirmed)
The INPA compiler is strict about syntax. The working syntax for State Machines (as verified in `sm_final.ips`) is:

```c
STATEMACHINE sm_name()
{
    INIT
    {
        setstate(state_name);
    }

    state_name
    {
        // logic
        if (condition)
        {
            setstate(next_state);
        }
    }

    next_state
    {
        // logic
    }
}
```

### Key Discoveries:
- Keyword is `STATEMACHINE` (one word), not `STATE MACHINE`.
- States do **not** use the `STATE` keyword before the state name. Just the identifier.
- Transitions use `setstate(state_identifier)`.
- The State Machine is registered in `MENU` or `inpainit` using `setstatemachine(sm_name)`.

## 2. DLL Import Issues (Unresolved)
Attempts to import `MessageBoxA` from `user32.dll` failed consistently with `error I329: Inconvertable Datatypes`.

### Tried Variations:
- `import pascal lib "user32.dll" ...` -> Error I329
- `import32 "C" lib "user32.dll" ...` -> Error I329
- `import32 "stdcall" ...` -> Error I335 (Invalid calling convention)
- Explicit variable types (long, string, int) -> Error I329

### Hypothesis:
The `string` type in INPA scripts (PABS) is not directly compatible with C-style `char*` or `LPCSTR` expected by Windows API functions when using the standard `import` mechanism, OR the compiler enforces strict type matching that we haven't cracked for system DLLs. However, `api32.dll` functions in `E46_NEW.ips` use `string` parameters successfully, suggesting `api32.dll` might have specific wrappers or the compiler treats `api32.dll` specially (or the functions are designed to accept INPA string structures).

## 3. Compilation & Tools
- Compiler: `INPACOMP.exe`
- Flag `-B` is crucial for batch mode (no GUI).
- `.log` files provide detailed error codes (e.g., I202, I329).

## 4. Next Steps
- Use the confirmed `STATEMACHINE` syntax for complex test procedures.
- Investigate `api32.dll` exports or valid types for generic DLL imports if native system calls are required. For now, rely on standard library functions.
