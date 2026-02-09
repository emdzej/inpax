/**
 * INPA System Function IDs
 * Auto-generated from inpa.h via compilation test
 * 
 * Generated: 2026-02-09
 * Coverage: 58/108 functions (53.7%)
 */

export enum INPASystemFunctionId {
  SETMENUTITLE = 0x00,
  SETTITLE = 0x03,
  RETURNSTATEMACHINE = 0x08,
  SETTIMER = 0x09,
  EXIT = 0x0C,
  EXITWINDOWS = 0x0D,
  SCRIPTSELECT = 0x0E,
  SCRIPTCHANGE = 0x0F,
  DESELECT = 0x11,
  CONTROL = 0x12,
  START = 0x13,
  STOP = 0x14,
  PRINTSCREEN = 0x17,
  DELAY = 0x1B,
  GETDATE = 0x1C,
  GETTIME = 0x1D,
  PEMTRENN_LINIE = 0x2F,
  PEMEND_LINIE = 0x30,
  PEMLOESCHETA_BZEILEN_PUFFER = 0x31,
  PEMUEBERTRAGETA_BZEILEN_PUFFER = 0x32,
  PEMPROTOKOLL_AUSGABE = 0x33,
  PEMPRINTER_FF = 0x37,
  PEMFREE_MEM = 0x38,
  GETINPUTSTATE = 0x3E,
  TEXT = 0x48,
  TEXTOUT = 0x49,
  BLANKSCREEN = 0x51,
  MESSAGEBOX = 0x52,
  INFOBOX = 0x53,
  USERBOXCLOSE = 0x55,
  USERBOXCLEAR = 0x57,
  WINHELP = 0x59,
  WINHELPKEY = 0x5A,
  CALLWIN = 0x5B,
  VIEWOPEN = 0x5C,
  VIEWCLOSE = 0x5D,
  INPAAPI_INIT = 0x60,
  INPAAPI_END = 0x61,
  INPAAPI_RESULT_SETS = 0x65,
  INPAAPI_RESULT_BINARY = 0x68,
  INPAAPI_CHECK_JOB_STATUS = 0x69,
  INPAAPI_FS_LESEN2 = 0x6A,
  INPAAPI_FS_LESEN = 0x6B,
  INP1API_INIT = 0x6D,
  INP1API_END = 0x6E,
  INP1API_STATE = 0x70,
  INP1API_ERROR_CODE = 0x76,
  INP1API_ERROR_TEXT = 0x77,
  GET_BINARY_DATA_STRING = 0x78,
  FILEOPEN = 0x79,
  FILECLOSE = 0x7A,
  FILEWRITE = 0x7B,
  FILEREAD = 0x7C,
  STR_ARRAY_CREATE = 0x8C,
  STR_ARRAY_DESTROY = 0x8D,
  STR_ARRAY_WRITE = 0x8E,
  STR_ARRAY_DELETE = 0x91,
  SET_STRUCTURE_MODE = 0x9B,
}

export const INPA_SYSTEM_FUNCTIONS: Record<number, string> = {
  0x00: 'setmenutitle',
  0x03: 'settitle',
  0x08: 'returnstatemachine',
  0x09: 'settimer',
  0x0C: 'exit',
  0x0D: 'exitwindows',
  0x0E: 'scriptselect',
  0x0F: 'scriptchange',
  0x11: 'deselect',
  0x12: 'control',
  0x13: 'start',
  0x14: 'stop',
  0x17: 'printscreen',
  0x1B: 'delay',
  0x1C: 'getdate',
  0x1D: 'gettime',
  0x2F: 'PEMTrennLinie',
  0x30: 'PEMEndLinie',
  0x31: 'PEMLoescheTabZeilenPuffer',
  0x32: 'PEMUebertrageTabZeilenPuffer',
  0x33: 'PEMProtokollAusgabe',
  0x37: 'PEMPrinter_ff',
  0x38: 'PEMFree_mem',
  0x3E: 'getinputstate',
  0x48: 'text',
  0x49: 'textout',
  0x51: 'blankscreen',
  0x52: 'messagebox',
  0x53: 'infobox',
  0x55: 'userboxclose',
  0x57: 'userboxclear',
  0x59: 'winhelp',
  0x5A: 'winhelpkey',
  0x5B: 'callwin',
  0x5C: 'viewopen',
  0x5D: 'viewclose',
  0x60: 'INPAapiInit',
  0x61: 'INPAapiEnd',
  0x65: 'INPAapiResultSets',
  0x68: 'INPAapiResultBinary',
  0x69: 'INPAapiCheckJobStatus',
  0x6A: 'INPAapiFsLesen2',
  0x6B: 'INPAapiFsLesen',
  0x6D: 'INP1apiInit',
  0x6E: 'INP1apiEnd',
  0x70: 'INP1apiState',
  0x76: 'INP1apiErrorCode',
  0x77: 'INP1apiErrorText',
  0x78: 'GetBinaryDataString',
  0x79: 'fileopen',
  0x7A: 'fileclose',
  0x7B: 'filewrite',
  0x7C: 'fileread',
  0x8C: 'StrArrayCreate',
  0x8D: 'StrArrayDestroy',
  0x8E: 'StrArrayWrite',
  0x91: 'StrArrayDelete',
  0x9B: 'SetStructureMode',
};

/**
 * Function signatures for type-safe decompilation
 */
export interface INPAFunctionSignature {
  name: string;
  params: Array<{
    direction: 'in' | 'out' | 'inout';
    type: string;
    name: string;
  }>;
}

export const INPA_FUNCTION_SIGNATURES: Record<number, INPAFunctionSignature> = {
  0x00: {
    name: 'setmenutitle',
    params: [{ direction: 'in', type: 'string', name: 'title' }]
  },
  0x03: {
    name: 'settitle',
    params: [{ direction: 'in', type: 'string', name: 'title' }]
  },
  0x08: {
    name: 'returnstatemachine',
    params: []
  },
  0x09: {
    name: 'settimer',
    params: [
      { direction: 'in', type: 'int', name: 'timernum' },
      { direction: 'in', type: 'int', name: 'timeval' }
    ]
  },
  0x0C: {
    name: 'exit',
    params: []
  },
  0x0D: {
    name: 'exitwindows',
    params: []
  },
  0x0E: {
    name: 'scriptselect',
    params: [{ direction: 'in', type: 'string', name: 'ScriptSelectIniFile' }]
  },
  0x0F: {
    name: 'scriptchange',
    params: [{ direction: 'in', type: 'string', name: 'NewScriptFile' }]
  },
  0x11: {
    name: 'deselect',
    params: []
  },
  0x12: {
    name: 'control',
    params: []
  },
  0x13: {
    name: 'start',
    params: []
  },
  0x14: {
    name: 'stop',
    params: []
  },
  0x17: {
    name: 'printscreen',
    params: []
  },
  0x1B: {
    name: 'delay',
    params: [{ direction: 'in', type: 'int', name: 'Time' }]
  },
  0x1C: {
    name: 'getdate',
    params: [{ direction: 'out', type: 'string', name: 'date' }]
  },
  0x1D: {
    name: 'gettime',
    params: [{ direction: 'out', type: 'string', name: 'time' }]
  },
  0x2F: {
    name: 'PEMTrennLinie',
    params: [{ direction: 'out', type: 'bool', name: 'Result' }]
  },
  0x30: {
    name: 'PEMEndLinie',
    params: [{ direction: 'out', type: 'bool', name: 'Result' }]
  },
  0x31: {
    name: 'PEMLoescheTabZeilenPuffer',
    params: [{ direction: 'out', type: 'bool', name: 'Result' }]
  },
  0x32: {
    name: 'PEMUebertrageTabZeilenPuffer',
    params: [{ direction: 'out', type: 'bool', name: 'Result' }]
  },
  0x33: {
    name: 'PEMProtokollAusgabe',
    params: [{ direction: 'out', type: 'bool', name: 'Result' }]
  },
  0x37: {
    name: 'PEMPrinter_ff',
    params: [{ direction: 'out', type: 'bool', name: 'Result' }]
  },
  0x38: {
    name: 'PEMFree_mem',
    params: [{ direction: 'out', type: 'bool', name: 'Result' }]
  },
  0x3E: {
    name: 'getinputstate',
    params: [{ direction: 'out', type: 'int', name: 'InputState' }]
  },
  0x48: {
    name: 'text',
    params: [
      { direction: 'in', type: 'int', name: 'row' },
      { direction: 'in', type: 'int', name: 'col' },
      { direction: 'in', type: 'string', name: 'text' }
    ]
  },
  0x49: {
    name: 'textout',
    params: [
      { direction: 'in', type: 'string', name: 'text' },
      { direction: 'in', type: 'int', name: 'row' },
      { direction: 'in', type: 'int', name: 'col' }
    ]
  },
  0x51: {
    name: 'blankscreen',
    params: []
  },
  0x52: {
    name: 'messagebox',
    params: [
      { direction: 'in', type: 'string', name: 'Title' },
      { direction: 'in', type: 'string', name: 'Text' }
    ]
  },
  0x53: {
    name: 'infobox',
    params: [
      { direction: 'in', type: 'string', name: 'Title' },
      { direction: 'in', type: 'string', name: 'Text' }
    ]
  },
  0x55: {
    name: 'userboxclose',
    params: [{ direction: 'in', type: 'int', name: 'BoxNum' }]
  },
  0x57: {
    name: 'userboxclear',
    params: [{ direction: 'in', type: 'int', name: 'BoxNum' }]
  },
  0x59: {
    name: 'winhelp',
    params: [{ direction: 'in', type: 'string', name: 'helpfile' }]
  },
  0x5A: {
    name: 'winhelpkey',
    params: [
      { direction: 'in', type: 'string', name: 'helpfile' },
      { direction: 'in', type: 'string', name: 'key' }
    ]
  },
  0x5B: {
    name: 'callwin',
    params: [{ direction: 'in', type: 'string', name: 'cmdline' }]
  },
  0x5C: {
    name: 'viewopen',
    params: [
      { direction: 'in', type: 'string', name: 'FileNameStr' },
      { direction: 'in', type: 'string', name: 'TitleStr' }
    ]
  },
  0x5D: {
    name: 'viewclose',
    params: []
  },
  0x60: {
    name: 'INPAapiInit',
    params: []
  },
  0x61: {
    name: 'INPAapiEnd',
    params: []
  },
  0x65: {
    name: 'INPAapiResultSets',
    params: [{ direction: 'out', type: 'int', name: 'sets' }]
  },
  0x68: {
    name: 'INPAapiResultBinary',
    params: [
      { direction: 'in', type: 'string', name: 'ApiResult' },
      { direction: 'in', type: 'int', name: 'ApiSet' }
    ]
  },
  0x69: {
    name: 'INPAapiCheckJobStatus',
    params: [{ direction: 'in', type: 'string', name: 'RefStr' }]
  },
  0x6A: {
    name: 'INPAapiFsLesen2',
    params: [
      { direction: 'in', type: 'string', name: 'ecu' },
      { direction: 'in', type: 'string', name: 'FileName' }
    ]
  },
  0x6B: {
    name: 'INPAapiFsLesen',
    params: [
      { direction: 'in', type: 'string', name: 'ecu' },
      { direction: 'in', type: 'string', name: 'FileName' }
    ]
  },
  0x6D: {
    name: 'INP1apiInit',
    params: [{ direction: 'out', type: 'bool', name: 'rc' }]
  },
  0x6E: {
    name: 'INP1apiEnd',
    params: []
  },
  0x70: {
    name: 'INP1apiState',
    params: [{ direction: 'out', type: 'int', name: 'ApiState' }]
  },
  0x76: {
    name: 'INP1apiErrorCode',
    params: [{ direction: 'out', type: 'int', name: 'ErrorCode' }]
  },
  0x77: {
    name: 'INP1apiErrorText',
    params: [{ direction: 'out', type: 'string', name: 'ErrorText' }]
  },
  0x78: {
    name: 'GetBinaryDataString',
    params: [
      { direction: 'out', type: 'string', name: 'DataString' },
      { direction: 'out', type: 'int', name: 'DataStringLen' }
    ]
  },
  0x79: {
    name: 'fileopen',
    params: [
      { direction: 'in', type: 'string', name: 'FileName' },
      { direction: 'in', type: 'string', name: 'OpenMode' }
    ]
  },
  0x7A: {
    name: 'fileclose',
    params: []
  },
  0x7B: {
    name: 'filewrite',
    params: [{ direction: 'in', type: 'string', name: 'str' }]
  },
  0x7C: {
    name: 'fileread',
    params: [
      { direction: 'out', type: 'string', name: 'str' },
      { direction: 'out', type: 'bool', name: 'EOF' }
    ]
  },
  0x8C: {
    name: 'StrArrayCreate',
    params: [
      { direction: 'out', type: 'bool', name: 'rc' },
      { direction: 'out', type: 'int', name: 'hStrArray' }
    ]
  },
  0x8D: {
    name: 'StrArrayDestroy',
    params: [{ direction: 'in', type: 'int', name: 'hStrArray' }]
  },
  0x8E: {
    name: 'StrArrayWrite',
    params: [
      { direction: 'in', type: 'int', name: 'hStrArray' },
      { direction: 'in', type: 'int', name: 'index' },
      { direction: 'in', type: 'string', name: 'str' }
    ]
  },
  0x91: {
    name: 'StrArrayDelete',
    params: [{ direction: 'in', type: 'int', name: 'hStrArray' }]
  },
  0x9B: {
    name: 'SetStructureMode',
    params: [{ direction: 'in', type: 'int', name: 'ReadWrite' }]
  },
};
