function emphasis(this: Die, modifier: `e${string}`): false | void {
  const middle = Math.round(this.faces / 2);
  let furthestResult: DiceTerm.Result;
  
  for (const result of this.results) {
    if (!result.active) {
      continue;
    }
    if (furthestResult == null) {
      furthestResult = result;
      continue;
    }

    const rollDistance = Math.abs(middle - result.result);
    const furthestResultDistance = Math.abs(middle - furthestResult.result);
    if (furthestResultDistance < rollDistance) {
      furthestResult = result;
      continue;
    } else if (furthestResultDistance > rollDistance) {
      continue;
    } 

    // Equal distance = take the higher total toll
    if (result.result >= furthestResult.result) {
      furthestResult = result;
    }
  }

  for (const result of this.results) {
    if (result !== furthestResult && result.active) {
      result.active = false;
      result.discarded = true;
    }
  }
}

export class EmphasisModifier {

  public static register(): void {
    // @ts-ignore
    Die.MODIFIERS.e = emphasis.name;
    Die.prototype[emphasis.name] = emphasis;
  }
}