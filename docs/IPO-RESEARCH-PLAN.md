# IPO Bytecode Reverse Engineering Plan

## Objective
Reverse engineer the compiled .IPO binary format to enable the creation of a custom interpreter (EdiabasX). The goal is to understand the file structure, opcode encoding, and memory model sufficiently to execute INPA scripts in a web/Node.js environment.

## Context
- **Source**: .IPS files (C-like syntax).
- **Target**: .IPO files (Binary bytecode).
- **Compiler**: `INPACOMP.EXE` (available on Windows Node).
- **Documentation**: `docs/INPA-MANUAL.md`.

## Methodology
We will use **differential analysis**:
1. Create a "Base" script (minimal valid file).
2. Create "Variant" scripts that add exactly one feature (e.g., one integer variable, one if-statement).
3. Compile both.
4. Binary diff the outputs to locate the specific changes.

## Phase 1: Foundation & Data Structures
Focus on file headers and static data storage.

### 1.1 File Header & Sections
- Identify magic bytes (if any).
- Identify section offsets (code, data, strings, exports).
- **Test:** Compare files with different sizes of code/data to see which offsets move.

### 1.2 Global Variables Table
- How are variables declared?
- **Types to test:** `byte`, `int`, `long`, `real`, `bool`, `string`.
- **Test:** `01_var_int.ips` vs `01_var_string.ips`.
- **Goal:** Map the "Symbol Table" (Name, Type, Address/Offset).

### 1.3 Literals & Constants
- Where are static strings stored?
- Where are numeric constants stored?

## Phase 2: Core Opcodes (Logic & Math)
Focus on the instruction set architecture (ISA).

### 2.1 Assignments & Moves
- Loading immediate values.
- Copying between variables.
- **Test:** `a = 5;` vs `a = 10;`.

### 2.2 Arithmetic & Logic
- Operators: `+`, `-`, `*`, `/`.
- Bitwise: `&`, `|`, `^`.
- **Test:** `c = a + b;`.

### 2.3 Control Flow
- **Branching:** `if`, `else`. Look for JUMP/JUMP_IF_FALSE opcodes.
- **Loops:** `while`. Look for backwards JUMP.
- **Comparison:** `==`, `!=`, `<`, `>`.

## Phase 3: Functions & Scoping
Focus on the call stack and modularity.

### 3.1 User Functions
- How are functions defined?
- **Call instruction:** How to jump to a function.
- **Return instruction:** How to return.

### 3.2 Parameters
- Input (`in`) vs Output (`out`) parameters.
- Are they pushed to stack or registered?

## Phase 4: UI & INPA Specifics
Focus on the domain-specific language features.

### 4.1 Screens & Menus
- Structure of `SCREEN` and `MENU` blocks.
- Are they separate data sections or just code blocks with special handlers?

### 4.2 Built-in Functions
- `text()`, `textout()`, `analogout()`.
- Are these system calls or special opcodes?

### 4.3 EDIABAS API
- `INPAapiJob`, `INPAapiResult...`.
- How are external API calls linked?

## Phase 5: State Machines & Imports
Focus on advanced runtime features.

### 5.1 State Machines
- Implementation of `STATE MACHINE`, `setstate()`.

### 5.2 External Imports
- DLL imports (`import pascal lib`).

## Execution Plan

### Step 1: Tooling Setup
- Create `research/` folder.
- Create a `compile.ts` helper script to run `INPACOMP.EXE` via the Windows Node.
- Create a `hexdiff.ts` helper to visualize differences.

### Step 2: Sample Generation
Generate the following test suite:
- `00_base.ips`
- `10_vars_int.ips`
- `10_vars_str.ips`
- `20_op_add.ips`
- `20_op_sub.ips`
- `30_flow_if.ips`
- `30_flow_while.ips`
- `40_func_void.ips`
- `50_screen_simple.ips`

### Step 3: Analysis & Documentation
- Update `docs/IPO-FORMAT.md` progressively.
- Document known opcodes in a table (Hex -> Mnemonic).

### Step 4: Prototype Parser
- Build `src/ipo/parser.ts`.
- Implement a `dump` command to print the structure of an IPO file.
