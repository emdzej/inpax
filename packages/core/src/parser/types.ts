export type IpoHeader = {
  readonly version: readonly [number, number];
  readonly magic: string;
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

export type IpoFile = {
  readonly header: IpoHeader;
  readonly sections: Map<string, Section>;
};
