/**
 * Simulation Input Provider
 * For testing without actual vehicle connection
 */

export interface ISimulationProvider {
  /**
   * Simulate numeric input
   */
  simNum(
    title: string,
    text: string,
    min: number,
    max: number
  ): Promise<number>;

  /**
   * Simulate digital (boolean) input
   */
  simDigital(
    title: string,
    text: string,
    falseStr: string,
    trueStr: string
  ): Promise<boolean>;
}
