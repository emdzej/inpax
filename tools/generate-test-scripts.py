#!/usr/bin/env python3
"""
Generate minimal INPA test scripts to discover System Function IDs.
Each function gets its own .ips file with minimal valid call.
"""

# Known function IDs from phase4-findings
KNOWN_IDS = {
    'setmenutitle': 0x00,
    'setscreen': 0x04,
    'exit': 0x0C,
    'text': 0x48,
    'INPAapiInit': 0x60,
    'INPAapiEnd': 0x61,
    'INPAapiJob': 0x62,
}

# Function signatures for generating minimal valid calls
# Format: (return_params, call_params)
FUNCTION_CALLS = {
    # System functions
    'setmenu': ([], ['m_dummy']),
    'settitle': ([], ['"Test"']),
    'setitem': ([], ['1', '"Item"', 'true']),
    'setitemrepeat': ([], ['1', 'true']),
    'setstate': ([], ['s_dummy']),
    'setstatemachine': ([], ['sm_dummy']),
    'callstatemachine': ([], ['sm_dummy']),
    'returnstatemachine': ([], []),
    'settimer': ([], ['1', '100']),
    'testtimer': (['flag'], ['1', 'flag']),
    'setjobstatus': ([], ['1']),
    'exitwindows': ([], []),
    'scriptselect': ([], ['"test.ini"']),
    'scriptchange': ([], ['"test.ips"']),
    'select': ([], ['false']),
    'deselect': ([], []),
    'control': ([], []),
    'start': ([], []),
    'stop': ([], []),
    'getapistring': (['s'], ['false', 'false', 's']),
    'togglelist': (['s'], ['false', 'false', 's']),
    'printscreen': ([], []),
    'printfile': (['ec'], ['ec', '"file.txt"', '""', '""', 'false']),
    'setcolor': ([], ['1', '0']),
    'delay': ([], ['100']),
    'getdate': (['d'], ['d']),
    'gettime': (['t'], ['t']),
    
    # Conversion functions
    'realtostring': (['s'], ['1.0', '"%.2f"', 's']),
    'stringtoreal': (['r'], ['"1.5"', 'r']),
    'inttostring': (['s'], ['42', 's']),
    'stringtoint': (['i'], ['"42"', 'i']),
    'hexconvert': (['h', 'm', 'l', 's'], ['"FF"', 'h', 'm', 'l', 's']),
    'inttoreal': (['r'], ['42', 'r']),
    'realtoint': (['i'], ['42.5', 'i']),
    'bytetoint': (['i'], ['b', 'i']),
    'inttolong': (['l'], ['42', 'l']),
    'longtoreal': (['r'], ['42', 'r']),
    
    # String functions
    'strcat': (['d'], ['d', '"a"', '"b"']),
    'strlen': (['l'], ['l', '"test"']),
    'midstr': (['r'], ['r', '"test"', '1', '2']),
    
    # Input functions
    'getinputstate': (['st'], ['st']),
    'inputtext': (['t'], ['t', '"Title"', '"Text"']),
    'inputnum': (['v'], ['v', '"Title"', '"Text"', '0.0', '100.0']),
    'inputint': (['v'], ['v', '"Title"', '"Text"', '0', '100']),
    'inputhex': (['h'], ['h', '"Title"', '"Text"', '"00"', '"FF"']),
    'inputdigital': (['v'], ['v', '"Title"', '"Text"', '"No"', '"Yes"']),
    'input2text': (['s1', 's2'], ['s1', 's2', '"Title"', '"Text"', '"Field1"', '"Field2"']),
    'input2hexnum': (['h', 'n'], ['h', 'n', '"Title"', '"Text"', '"Hex"', '"Num"', '"00"', '"FF"', '0', '100']),
    'input2int': (['v1', 'v2'], ['v1', 'v2', '"Title"', '"Text"', '"Val1"', '"Val2"', '0', '100', '0', '100']),
    'input2hex': (['h1', 'h2'], ['h1', 'h2', '"Title"', '"Text"', '"Hex1"', '"Hex2"', '"00"', '"FF"', '"00"', '"FF"']),
    
    # Output functions
    'textout': ([], ['"Test"', '0', '0']),
    'ftextout': ([], ['"Test"', '0', '0', '1', '0']),
    'digitalout': ([], ['true', '0', '0', '"On"', '"Off"']),
    'analogout': ([], ['50.0', '0', '0', '0.0', '100.0', '0.0', '100.0', '"%.1f"']),
    'multianalogout': ([], ['50.0', '0', '0', '0.0', '100.0', '0.0', '100.0', '"%.1f"', '0']),
    'hexdump': ([], ['"test"', '10', '0', '0']),
    'ftextclear': ([], ['"Test"', '0', '0', '1', '0']),
    'clearrect': ([], ['0', '0', '10', '10']),
    'blankscreen': ([], []),
    'messagebox': ([], ['"Title"', '"Text"']),
    'infobox': ([], ['"Title"', '"Text"']),
    
    # File functions
    'fileopen': ([], ['"test.txt"', '"r"']),
    'fileclose': ([], []),
    'filewrite': ([], ['"test"']),
    'fileread': (['s', 'eof'], ['s', 'eof']),
    
    # Userbox functions
    'userboxopen': ([], ['1', '0', '0', '10', '20', '"Title"', '"Text"']),
    'userboxclose': ([], ['1']),
    'userboxftextout': ([], ['1', '"Test"', '0', '0', '1', '0']),
    'userboxclear': ([], ['1']),
    'userboxsetcolor': ([], ['1', '1', '0']),
    
    # Interface functions
    'winhelp': ([], ['"help.hlp"']),
    'winhelpkey': ([], ['"help.hlp"', '"keyword"']),
    'callwin': ([], ['"cmd.exe"']),
    
    # File viewer
    'viewopen': ([], ['"file.txt"', '"Title"']),
    'viewclose': ([], []),
    
    # Simulation functions
    'simnum': (['v'], ['v', '"Title"', '"Text"', '0.0', '100.0']),
    'simdigital': (['v'], ['v', '"Title"', '"Text"', '"No"', '"Yes"']),
    
    # EDIABAS functions (remaining)
    'INPAapiResultText': (['t'], ['t', '"RESULT"', '0', '""']),
    'INPAapiResultDigital': (['v'], ['v', '"RESULT"', '0']),
    'INPAapiResultInt': (['v'], ['v', '"RESULT"', '0']),
    'INPAapiResultSets': (['n'], ['n']),
    'INPAapiResultAnalog': (['v'], ['v', '"RESULT"', '0']),
    'INPAapiResultBinary': ([], ['"RESULT"', '0']),
    'INPAapiCheckJobStatus': ([], ['"JOBSTATUS"']),
    'INPAapiFsLesen': ([], ['"ECU"', '"file.txt"']),
    'INPAapiFsLesen2': ([], ['"ECU"', '"file.txt"']),
    'INPAapiFsMode': ([], ['0', '"r"', '""', '""', '"JOB"']),
    
    # INP1 functions
    'INP1apiInit': (['rc'], ['rc']),
    'INP1apiEnd': ([], []),
    'INP1apiJob': ([], ['"ECU"', '"JOB"', '""', '""']),
    'INP1apiState': (['st'], ['st']),
    'INP1apiResultText': (['rc', 't'], ['rc', 't', '"RESULT"', '0', '""']),
    'INP1apiResultInt': (['rc', 'v'], ['rc', 'v', '"RESULT"', '0']),
    'INP1apiResultSets': (['rc', 'n'], ['rc', 'n']),
    'INP1apiResultReal': (['rc', 'v'], ['rc', 'v', '"RESULT"', '0']),
    'INP1apiResultBinary': (['rc'], ['rc', '"RESULT"', '0']),
    'INP1apiErrorCode': (['ec'], ['ec']),
    'INP1apiErrorText': (['et'], ['et']),
    
    # Binary data
    'GetBinaryDataString': (['ds', 'len'], ['ds', 'len']),
    
    # Stringarray
    'StrArrayCreate': (['rc', 'h'], ['rc', 'h']),
    'StrArrayDestroy': ([], ['1']),
    'StrArrayWrite': ([], ['1', '0', '"test"']),
    'StrArrayRead': (['s'], ['1', '0', 's']),
    'StrArrayGetElementCount': (['n'], ['1', 'n']),
    'StrArrayDelete': ([], ['1']),
    
    # Structure/Memory
    'CreateStructure': (['h'], ['h', '100']),
    'SetStructureMode': ([], ['0']),
    'StructureByte': (['b'], ['1', '0', 'b']),
    'StructureInt': (['i'], ['1', '0', 'i']),
    'StructureLong': (['l'], ['1', '0', 'l']),
    'StructureString': (['s'], ['1', '0', '10', 's']),
}

def generate_variable_declarations(return_params):
    """Generate variable declarations for out parameters."""
    decls = []
    for param in return_params:
        # Infer type from common patterns
        if param in ['rc', 'flag', 'eof', 'v'] and len(param) <= 2:
            if param == 'v':
                decls.append(f'    real {param};')
            else:
                decls.append(f'    bool {param};')
        elif param in ['i', 'n', 'st', 'ec', 'h', 'm', 'l', 'len']:
            decls.append(f'    int {param};')
        elif param in ['r']:
            decls.append(f'    real {param};')
        elif param in ['l']:
            decls.append(f'    long {param};')
        elif param in ['b']:
            decls.append(f'    byte {param};')
        else:
            decls.append(f'    string {param};')
    return decls

def generate_test_script(func_name, return_params, call_params):
    """Generate a minimal .ips test script for a function."""
    
    # Variable declarations
    var_decls = generate_variable_declarations(return_params)
    
    # Build function call
    call = f'    {func_name}({", ".join(call_params)});'
    
    # Generate script
    lines = [
        '#include "inpa.h"',
        '',
        'inpainit()',
        '{',
    ]
    
    if var_decls:
        lines.extend(var_decls)
        lines.append('')
    
    lines.append(call)
    lines.append('}')
    
    return '\n'.join(lines)

def main():
    import os
    import sys
    
    output_dir = sys.argv[1] if len(sys.argv) > 1 else '/tmp/inpax-sysfunction-map'
    
    # Generate test scripts
    generated = []
    skipped = []
    
    for func_name, (return_params, call_params) in sorted(FUNCTION_CALLS.items()):
        if func_name in KNOWN_IDS:
            skipped.append(func_name)
            continue
        
        script_content = generate_test_script(func_name, return_params, call_params)
        script_path = os.path.join(output_dir, f'test_{func_name}.ips')
        
        with open(script_path, 'w') as f:
            f.write(script_content)
        
        generated.append(func_name)
    
    print(f"Generated {len(generated)} test scripts")
    print(f"Skipped {len(skipped)} known functions: {', '.join(skipped)}")
    print(f"\nOutput directory: {output_dir}")

if __name__ == '__main__':
    main()
