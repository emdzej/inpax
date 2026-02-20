export type Import32ParameterDirection = "in" | "out";
export type Import32ParameterType = "string" | "int" | "long" | "unknown";

export type Import32Parameter = {
  readonly type: Import32ParameterType;
  readonly direction: Import32ParameterDirection;
  readonly raw: string;
};

export type Import32ReturnType = "int" | "void" | "unknown";

export type Import32Call = {
  readonly dll: string;
  readonly functionName: string;
  readonly convention: string;
  readonly parameters: readonly Import32Parameter[];
  readonly returnType: Import32ReturnType;
  readonly rawSignature: string;
};

const parseParameter = (char: string): Import32Parameter => {
  switch (char) {
    case "s":
      return { type: "string", direction: "in", raw: char };
    case "S":
      return { type: "string", direction: "out", raw: char };
    case "i":
      return { type: "int", direction: "in", raw: char };
    case "l":
      return { type: "long", direction: "in", raw: char };
    default:
      return { type: "unknown", direction: "in", raw: char };
  }
};

export const parseImport32 = (signature: string): Import32Call => {
  const doubleColonIndex = signature.indexOf("::");
  if (doubleColonIndex === -1) {
    throw new Error(`Invalid import32 signature: missing :: in "${signature}"`);
  }

  const dll = signature.slice(0, doubleColonIndex);
  const afterDoubleColon = signature.slice(doubleColonIndex + 2);
  const colonIndex = afterDoubleColon.indexOf(":");

  if (colonIndex === -1) {
    throw new Error(`Invalid import32 signature: missing : in "${signature}"`);
  }

  const functionName = afterDoubleColon.slice(0, colonIndex);
  const signaturePart = afterDoubleColon.slice(colonIndex + 1);
  const dotIndex = signaturePart.indexOf(".");

  if (dotIndex === -1) {
    throw new Error(`Invalid import32 signature: missing . in "${signature}"`);
  }

  const convention = signaturePart.slice(0, dotIndex);
  const paramSignature = signaturePart.slice(dotIndex + 1);

  const parameters: Import32Parameter[] = [];
  let returnType: Import32ReturnType = "void";

  for (let index = 0; index < paramSignature.length; index += 1) {
    const char = paramSignature[index];

    if (char === "%" && paramSignature[index + 1] === "I") {
      returnType = "int";
      index += 1;
      continue;
    }

    parameters.push(parseParameter(char));
  }

  return {
    dll,
    functionName,
    convention,
    parameters,
    returnType,
    rawSignature: signature
  };
};
