/**
 * AST Node types for INPA IPS
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
  globals: VariableDecl[];
  constants: ConstantDecl[];
  functions: FunctionDecl[];
  screens: ScreenDecl[];
  menus: MenuDecl[];
  stateMachines: StateMachineDecl[];
}

// ============ Declarations ============

export interface VariableDecl extends ASTNode {
  kind: 'VariableDecl';
  name: string;
  type: ValueType;
  isGlobal: boolean;
}

export interface ConstantDecl extends ASTNode {
  kind: 'ConstantDecl';
  name: string;
  type: ValueType;
  value: Expression;
}

export interface FunctionDecl extends ASTNode {
  kind: 'FunctionDecl';
  name: string;
  params: ParameterDecl[];
  returnType?: ValueType;
  locals: VariableDecl[];
  body: Statement[];
}

export interface ParameterDecl extends ASTNode {
  kind: 'ParameterDecl';
  name: string;
  type: ValueType;
  direction: 'in' | 'out' | 'inout';
}

// ============ UI Declarations ============

export interface ScreenDecl extends ASTNode {
  kind: 'ScreenDecl';
  name: string;
  initFunc?: FunctionDecl;
  lines: LineDecl[];
}

export interface LineDecl extends ASTNode {
  kind: 'LineDecl';
  name: string;
  func?: FunctionDecl;
  controls: ControlDecl[];
}

export interface ControlDecl extends ASTNode {
  kind: 'ControlDecl';
  name: string;
  func?: FunctionDecl;
}

export interface MenuDecl extends ASTNode {
  kind: 'MenuDecl';
  name: string;
  title: string;
  items: MenuItemDecl[];
}

export interface MenuItemDecl extends ASTNode {
  kind: 'MenuItemDecl';
  name: string;
  label: string;
  key?: string;
  func?: FunctionDecl;
}

export interface StateMachineDecl extends ASTNode {
  kind: 'StateMachineDecl';
  name: string;
  states: StateDecl[];
}

export interface StateDecl extends ASTNode {
  kind: 'StateDecl';
  name: string;
  func?: FunctionDecl;
}

// ============ Statements ============

export type Statement =
  | AssignmentStmt
  | CallStmt
  | IfStmt
  | WhileStmt
  | ForStmt
  | RepeatStmt
  | SelectStmt
  | ReturnStmt
  | ExitStmt;

export interface AssignmentStmt extends ASTNode {
  kind: 'AssignmentStmt';
  target: Expression;
  value: Expression;
}

export interface CallStmt extends ASTNode {
  kind: 'CallStmt';
  name: string;
  args: Expression[];
}

export interface IfStmt extends ASTNode {
  kind: 'IfStmt';
  condition: Expression;
  thenBranch: Statement[];
  elseIfBranches: { condition: Expression; body: Statement[] }[];
  elseBranch?: Statement[];
}

export interface WhileStmt extends ASTNode {
  kind: 'WhileStmt';
  condition: Expression;
  body: Statement[];
}

export interface ForStmt extends ASTNode {
  kind: 'ForStmt';
  variable: string;
  start: Expression;
  end: Expression;
  step?: Expression;
  body: Statement[];
}

export interface RepeatStmt extends ASTNode {
  kind: 'RepeatStmt';
  body: Statement[];
  condition: Expression;
}

export interface SelectStmt extends ASTNode {
  kind: 'SelectStmt';
  value: Expression;
  cases: { values: Expression[]; body: Statement[] }[];
  defaultCase?: Statement[];
}

export interface ReturnStmt extends ASTNode {
  kind: 'ReturnStmt';
  value?: Expression;
}

export interface ExitStmt extends ASTNode {
  kind: 'ExitStmt';
}

// ============ Expressions ============

export type Expression =
  | LiteralExpr
  | IdentifierExpr
  | BinaryExpr
  | UnaryExpr
  | CallExpr
  | IndexExpr;

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
