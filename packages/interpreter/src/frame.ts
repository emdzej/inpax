import { Constant, Variable } from "@inpax/core";

export class Frame {
    private readonly _variables: Variable[] = [];
    private readonly _constants: Constant[] = [];

    get variables(): Variable[] {
        return this._variables;
    }

    get constants(): Constant[] {
        return this._constants;
    }
}
