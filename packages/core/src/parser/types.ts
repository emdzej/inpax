export type IpoHeader = {
  readonly version: readonly [number, number];
  readonly magic: string;
};

export type VariableType = "bool" | "byte" | "int" | "real" | "string";

export type GlobalData = {
  readonly count: number;
  readonly variables: readonly VariableType[];
};

export type Constant =
  | { readonly type: "string"; readonly value: string }
  | { readonly type: "int"; readonly value: number }
  | { readonly type: "real"; readonly value: number }
  | { readonly type: "bool"; readonly value: boolean };

export type ConstantData = {
  readonly constants: readonly Constant[];
};

export type SectionType =
  | "global"
  | "constant"
  | "function"
  | "screen"
  | "menu"
  | "statemachine";

export type Section = {
  readonly name: string;
  readonly offset: number;
  readonly size: number;
  readonly type: SectionType;
};

export type Opcode =
  | "PUSH_VAR_ADDR"
  | "PUSH_VAR_VAL"
  | "PUSH_CONST"
  | "STORE"
  | "ALU_OP"
  | "JMP_FALSE"
  | "JMP"
  | "CALL_USER"
  | "CALL_API"
  | "PUSH_HANDLE"
  | "SCREEN_START"
  | "LINE"
  | "ITEM"
  | "STATE"
  | "UNKNOWN";

export type Instruction = {
  readonly offset: number;
  readonly opcode: Opcode;
  readonly operands: readonly number[];
  readonly raw: Uint8Array;
  readonly size: number;
};

export type IpoFile = {
  readonly header: IpoHeader;
  readonly sections: Map<string, Section>;
  readonly globalData: GlobalData;
  readonly constantData: ConstantData;
};
