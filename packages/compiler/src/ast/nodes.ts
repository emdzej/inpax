/**
 * AST node types for the IPS language.
 *
 * Mirrors the surface syntax described in docs/inpa-language-reference.md
 * and the official Softing INPA V2.2 documentation. Block-flavoured
 * constructs (SCREEN/LINE/CONTROL, MENU/INIT/ITEM, STATEMACHINE/state,
 * LOGTABLE) are first-class because they map directly to distinct IPO
 * block types in the binary.
 */

export type ValueTypeName =
  | 'bool'
  | 'byte'
  | 'int'
  | 'long'
  | 'real'
  | 'string'
  | 'structure';

export type ParamDirection = 'in' | 'out' | 'inout' | 'returns';

export interface Pos {
  readonly line: number;
  readonly column: number;
}

export interface Program {
  readonly kind: 'Program';
  readonly pragmas: string[];
  readonly globals: GlobalDecl[];
  readonly imports: ImportDecl[];
  readonly functions: FunctionDecl[];
  readonly screens: ScreenDecl[];
  readonly menus: MenuDecl[];
  readonly stateMachines: StateMachineDecl[];
  readonly logicTables: LogicTableDecl[];
}

export interface TypeRef extends Pos {
  readonly name: ValueTypeName;
  readonly arraySize?: number;
}

export interface GlobalDecl extends Pos {
  readonly kind: 'GlobalDecl';
  readonly name: string;
  readonly type: TypeRef;
  readonly initializer?: Expression;
}

export interface ParameterDecl extends Pos {
  readonly kind: 'ParameterDecl';
  readonly name: string;
  readonly type: TypeRef;
  readonly direction: ParamDirection;
}

export interface LocalDecl extends Pos {
  readonly kind: 'LocalDecl';
  readonly name: string;
  readonly type: TypeRef;
  readonly initializer?: Expression;
}

export interface FunctionDecl extends Pos {
  readonly kind: 'FunctionDecl';
  readonly name: string;
  readonly params: ParameterDecl[];
  readonly body: Statement[];
}

export interface ImportDecl extends Pos {
  readonly kind: 'ImportDecl';
  readonly is32: boolean;
  readonly convention: string;
  readonly dll: string;
  readonly symbol: string;
  readonly alias: string;
  readonly params: ParameterDecl[];
}

export interface ScreenDecl extends Pos {
  readonly kind: 'ScreenDecl';
  readonly name: string;
  readonly body: Statement[];
  readonly lines: LineDecl[];
}

export interface LineDecl extends Pos {
  readonly kind: 'LineDecl';
  readonly label: string;
  readonly tag: string;
  readonly body: Statement[];
  readonly control?: ControlDecl;
}

export interface ControlDecl extends Pos {
  readonly kind: 'ControlDecl';
  readonly body: Statement[];
}

export interface MenuDecl extends Pos {
  readonly kind: 'MenuDecl';
  readonly name: string;
  readonly init: Statement[];
  readonly items: MenuItemDecl[];
}

export interface MenuItemDecl extends Pos {
  readonly kind: 'MenuItemDecl';
  readonly key: number;
  readonly label: string;
  readonly body: Statement[];
}

export interface StateMachineDecl extends Pos {
  readonly kind: 'StateMachineDecl';
  readonly name: string;
  readonly init: Statement[];
  readonly states: StateDecl[];
}

export interface StateDecl extends Pos {
  readonly kind: 'StateDecl';
  readonly name: string;
  readonly body: Statement[];
}

export interface LogicTableDecl extends Pos {
  readonly kind: 'LogicTableDecl';
  readonly name: string;
  readonly outputs: ParameterDecl[];
  readonly inputs: ParameterDecl[];
  readonly entries: LogicTableEntry[];
}

export interface LogicTableEntry extends Pos {
  readonly kind: 'LogicTableEntry';
  /** Input bit pattern. */
  readonly inputValue: number;
  /** Mask: 0xFFFF..FF for exact match, 0 for OTHER. */
  readonly inputMask: number;
  /** Output bit pattern. */
  readonly outputValue: number;
}

// ============ Statements ============

export type Statement =
  | BlockStmt
  | ExprStmt
  | IfStmt
  | WhileStmt
  | ForStmt
  | ReturnStmt
  | BreakStmt
  | ContinueStmt
  | LocalDecl;

export interface BlockStmt extends Pos {
  readonly kind: 'BlockStmt';
  readonly statements: Statement[];
}

export interface ExprStmt extends Pos {
  readonly kind: 'ExprStmt';
  readonly expression: Expression;
}

export interface IfStmt extends Pos {
  readonly kind: 'IfStmt';
  readonly condition: Expression;
  readonly then: Statement;
  readonly else?: Statement;
}

export interface WhileStmt extends Pos {
  readonly kind: 'WhileStmt';
  readonly condition: Expression;
  readonly body: Statement;
}

export interface ForStmt extends Pos {
  readonly kind: 'ForStmt';
  readonly init?: Expression | LocalDecl;
  readonly condition?: Expression;
  readonly update?: Expression;
  readonly body: Statement;
}

export interface ReturnStmt extends Pos {
  readonly kind: 'ReturnStmt';
  readonly value?: Expression;
}

export interface BreakStmt extends Pos {
  readonly kind: 'BreakStmt';
}

export interface ContinueStmt extends Pos {
  readonly kind: 'ContinueStmt';
}

// ============ Expressions ============

export type Expression =
  | BoolLiteral
  | IntLiteral
  | RealLiteral
  | StringLiteral
  | IdentExpr
  | UnaryExpr
  | BinaryExpr
  | AssignExpr
  | CallExpr
  | IndexExpr;

export interface BoolLiteral extends Pos {
  readonly kind: 'BoolLiteral';
  readonly value: boolean;
}

export interface IntLiteral extends Pos {
  readonly kind: 'IntLiteral';
  readonly value: number;
  /** Allows the semantic pass to widen literals when the context needs `long`. */
  readonly wide: boolean;
}

export interface RealLiteral extends Pos {
  readonly kind: 'RealLiteral';
  readonly value: number;
}

export interface StringLiteral extends Pos {
  readonly kind: 'StringLiteral';
  readonly value: string;
}

export interface IdentExpr extends Pos {
  readonly kind: 'IdentExpr';
  readonly name: string;
}

export type UnaryOperator = '-' | '!' | '++pre' | '--pre' | '++post' | '--post';

export interface UnaryExpr extends Pos {
  readonly kind: 'UnaryExpr';
  readonly operator: UnaryOperator;
  readonly operand: Expression;
}

export type BinaryOperator =
  | '+' | '-' | '*' | '/' | '%'
  | '==' | '!=' | '<' | '<=' | '>' | '>='
  | '&&' | '||' | '^^'
  | '&' | '|' | '^';

export interface BinaryExpr extends Pos {
  readonly kind: 'BinaryExpr';
  readonly operator: BinaryOperator;
  readonly left: Expression;
  readonly right: Expression;
}

export interface AssignExpr extends Pos {
  readonly kind: 'AssignExpr';
  readonly target: Expression;
  readonly value: Expression;
}

export interface CallExpr extends Pos {
  readonly kind: 'CallExpr';
  readonly callee: string;
  readonly args: Expression[];
}

export interface IndexExpr extends Pos {
  readonly kind: 'IndexExpr';
  readonly array: Expression;
  readonly index: Expression;
}
