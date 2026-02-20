/**
 * AST Node types for INPA IPS (C-like syntax)
 */

export type ValueType = 'bool' | 'byte' | 'int' | 'long' | 'real' | 'string';

// ============ Base ============

export interface ASTNode {
  kind: string;
  line: number;
  column: number;
}

// ============ Program ============

export interface Program extends ASTNode {
  kind: 'Program';
  includes: string[];
  pragmas: PragmaDecl[];
  globals: GlobalDecl[];
  functions: FunctionDecl[];
  screens: ScreenDecl[];
  menus: MenuDecl[];
}

export interface PragmaDecl extends ASTNode {
  kind: 'PragmaDecl';
  name: string;
  value?: string;
}

// ============ Declarations ============

export interface GlobalDecl extends ASTNode {
  kind: 'GlobalDecl';
  name: string;
  type: ValueType;
  arraySize?: number;  // string[80] -> 80
  initializer?: Expression;
}

export interface FunctionDecl extends ASTNode {
  kind: 'FunctionDecl';
  name: string;
  params: ParameterDecl[];
  locals: LocalDecl[];
  body: Statement[];
}

export interface ParameterDecl extends ASTNode {
  kind: 'ParameterDecl';
  name: string;
  type: ValueType;
  arraySize?: number;
}

export interface LocalDecl extends ASTNode {
  kind: 'LocalDecl';
  name: string;
  type: ValueType;
  arraySize?: number;
  initializer?: Expression;
}

// ============ UI Declarations ============

export interface ScreenDecl extends ASTNode {
  kind: 'ScreenDecl';
  name: string;
  body: Statement[];
  lines: LineDecl[];
}

export interface LineDecl extends ASTNode {
  kind: 'LineDecl';
  label: string;
  tag: string;
  body: Statement[];
}

export interface MenuDecl extends ASTNode {
  kind: 'MenuDecl';
  name: string;
  init?: Statement[];
  items: MenuItemDecl[];
}

export interface MenuItemDecl extends ASTNode {
  kind: 'MenuItemDecl';
  key: number;
  label: string;
  body: Statement[];
}

// ============ Statements ============

export type Statement =
  | BlockStmt
  | ExpressionStmt
  | IfStmt
  | WhileStmt
  | ForStmt
  | ReturnStmt
  | BreakStmt
  | ContinueStmt
  | LocalDecl;

export interface BlockStmt extends ASTNode {
  kind: 'BlockStmt';
  statements: Statement[];
}

export interface ExpressionStmt extends ASTNode {
  kind: 'ExpressionStmt';
  expression: Expression;
}

export interface IfStmt extends ASTNode {
  kind: 'IfStmt';
  condition: Expression;
  thenBranch: Statement;
  elseBranch?: Statement;
}

export interface WhileStmt extends ASTNode {
  kind: 'WhileStmt';
  condition: Expression;
  body: Statement;
}

export interface ForStmt extends ASTNode {
  kind: 'ForStmt';
  init?: Expression | LocalDecl;
  condition?: Expression;
  update?: Expression;
  body: Statement;
}

export interface ReturnStmt extends ASTNode {
  kind: 'ReturnStmt';
  value?: Expression;
}

export interface BreakStmt extends ASTNode {
  kind: 'BreakStmt';
}

export interface ContinueStmt extends ASTNode {
  kind: 'ContinueStmt';
}

// ============ Expressions ============

export type Expression =
  | LiteralExpr
  | IdentifierExpr
  | BinaryExpr
  | UnaryExpr
  | CallExpr
  | IndexExpr
  | AssignExpr;

export interface LiteralExpr extends ASTNode {
  kind: 'LiteralExpr';
  type: 'bool' | 'int' | 'real' | 'string';
  value: boolean | number | string;
}

export interface IdentifierExpr extends ASTNode {
  kind: 'IdentifierExpr';
  name: string;
}

export interface BinaryExpr extends ASTNode {
  kind: 'BinaryExpr';
  operator: string;
  left: Expression;
  right: Expression;
}

export interface UnaryExpr extends ASTNode {
  kind: 'UnaryExpr';
  operator: string;
  operand: Expression;
  prefix: boolean;
}

export interface CallExpr extends ASTNode {
  kind: 'CallExpr';
  name: string;
  args: Expression[];
}

export interface IndexExpr extends ASTNode {
  kind: 'IndexExpr';
  array: Expression;
  index: Expression;
}

export interface AssignExpr extends ASTNode {
  kind: 'AssignExpr';
  target: Expression;
  value: Expression;
}
