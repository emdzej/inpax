import { describe, it } from 'node:test';
import assert from 'node:assert';
import { parse, stringify, get, getFirst, getAll, hasSection, hasKey, sections, keys } from './ini-parser.js';
import { parseInpaConfig, parseGroupConfig, findRootSection, getValidEntries } from './inpa-config.js';

describe('INI Parser', () => {
  it('parses basic INI content', () => {
    const content = `
[SECTION1]
key1=value1
key2 = value2
`;
    const result = parse(content);
    assert.deepEqual(result, {
      SECTION1: {
        key1: 'value1',
        key2: 'value2',
      },
    });
  });

  it('handles // comments', () => {
    const content = `
// This is a comment
[SECTION]
key=value // inline comment
// Another comment
key2=value2
`;
    const result = parse(content);
    assert.equal(result['SECTION']['key'], 'value');
    assert.equal(result['SECTION']['key2'], 'value2');
  });

  it('handles duplicate keys as arrays', () => {
    const content = `
[LIST]
ENTRY=first
ENTRY=second
ENTRY=third
`;
    const result = parse(content);
    assert.deepEqual(result['LIST']['ENTRY'], ['first', 'second', 'third']);
  });

  it('stringifies INI back', () => {
    const data = {
      SECTION: {
        key1: 'value1',
        key2: 'value2',
      },
    };
    const output = stringify(data);
    assert.ok(output.includes('[SECTION]'));
    assert.ok(output.includes('key1=value1'));
  });
});

describe('Helper functions', () => {
  const ini = parse(`
[INFO]
VERSION=1.0
[LIST]
ENTRY=one
ENTRY=two
`);

  it('get returns value', () => {
    assert.equal(get(ini, 'INFO', 'VERSION'), '1.0');
  });

  it('get returns default for missing', () => {
    assert.equal(get(ini, 'INFO', 'MISSING', 'default'), 'default');
  });

  it('getFirst returns first from array', () => {
    assert.equal(getFirst(ini, 'LIST', 'ENTRY'), 'one');
  });

  it('getAll returns array', () => {
    assert.deepEqual(getAll(ini, 'LIST', 'ENTRY'), ['one', 'two']);
    assert.deepEqual(getAll(ini, 'INFO', 'VERSION'), ['1.0']);
  });

  it('hasSection/hasKey work', () => {
    assert.equal(hasSection(ini, 'INFO'), true);
    assert.equal(hasSection(ini, 'MISSING'), false);
    assert.equal(hasKey(ini, 'INFO', 'VERSION'), true);
    assert.equal(hasKey(ini, 'INFO', 'MISSING'), false);
  });

  it('sections/keys list', () => {
    assert.deepEqual(sections(ini), ['INFO', 'LIST']);
    assert.deepEqual(keys(ini, 'INFO'), ['VERSION']);
  });
});

describe('INPA Config', () => {
  it('parses INPA.INI format', () => {
    const content = `
[INFO]
VERSION = 5.06 TEST
DATUM = 24.01.2020
VARIANTE = ENGLISH

[ENVIRON]
DRUCKER = WIN
PEM = JA
LANGUAGE = ENGLISH

[SCRIPT]
EDITOR = WIN
SCRIPTSELECT = LIST
DEFINI =

[CONFIG]
TITEL = BMW INPA Test
F1 = script1
F1_Text = Option 1
F2 = script2
F2_TEXT = Option 2
F2_ARCHIV = ARCHIVE2
`;
    const config = parseInpaConfig(content);
    
    assert.equal(config.info.version, '5.06 TEST');
    assert.equal(config.environ.pem, true);
    assert.equal(config.config.title, 'BMW INPA Test');
    assert.equal(config.config.fKeys.length, 2);
    assert.equal(config.config.fKeys[0].script, 'script1');
    assert.equal(config.config.fKeys[1].archive, 'ARCHIVE2');
  });
});

describe('Group Config', () => {
  it('parses E46.ENG format', () => {
    const content = `
[ROOT]
DESCRIPTION=Select E46
ENTRY=   E46,E46 TEST,
                               
[ROOT_MOTOR]
DESCRIPTION=Engine
ENTRY=   DDE22,DDE 2.2 for M51,
ENTRY=   DDE30,DDE 3.0 for M47,
ENTRY=,,
ENTRY=   BMS46,BMS 46 for M43,
`;
    const config = parseGroupConfig(content);
    
    assert.equal(config.sections.length, 2);
    
    const root = findRootSection(config);
    assert.ok(root);
    assert.equal(root.description, 'Select E46');
    
    const motor = config.sections[1];
    assert.equal(motor.name, 'ROOT_MOTOR');
    assert.equal(motor.description, 'Engine');
    
    const validEntries = getValidEntries(motor);
    assert.equal(validEntries.length, 3); // excluding empty ,, entry
    assert.equal(validEntries[0].code, 'DDE22');
    assert.equal(validEntries[0].description, 'DDE 2.2 for M51');
  });
});
