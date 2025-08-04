import { ModuleSettings } from "./module-settings.js";

// @ts-ignore
const DieCls: typeof Die = foundry?.dice?.terms?.Die ?? Die;

function getTiebreakerRule(modifier: `e${string}`): ReturnType<(typeof ModuleSettings)['getTiebreakerRule']> {
  switch (modifier[1]?.toLowerCase()) {
    case 'r': {
      return 'reroll';
    }
    case 'h': {
      return 'takeHigher';
    }
    default: {
      return ModuleSettings.getTiebreakerRule();
    }
  }
}

// @ts-ignore
function emphasis(this: DieCls, modifier: `e${string}`): false | void {
  const tiebreakerRule = getTiebreakerRule(modifier);
  const middle = Math.round(this.faces / 2);
  
  // Prevent infinite loop
  let rerolls = 0;
  rerollLoop: while (rerolls < 100) {
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
  
      // Equal distance & equal value
      if (result.result === furthestResult.result) {
        continue;
      }
  
      // Equal distance but different value
      switch (tiebreakerRule) {
        case 'reroll': {
          const originalLength = this.results.length;
          this.reroll(`r${result.result}`);
          const afterFirstRerollLength = this.results.length;

          // Prevent the new rolls from being rerolled
          result.active = true;
          delete result.rerolled;
          for (let i = originalLength; i < afterFirstRerollLength; i++) {
            this.results[i].active = false;
          }

          this.reroll(`r${furthestResult.result}`);
          
          // Reapply the first rerolls
          result.active = false;
          result.rerolled = true;
          for (let i = originalLength; i < afterFirstRerollLength; i++) {
            this.results[i].active = true;
          }
          rerolls++;
          continue rerollLoop;
        }
        case 'takeHigher': {
          if (result.result >= furthestResult.result) {
            furthestResult = result;
          }
          break;
        }
      }
    }
  
    for (const result of this.results) {
      if (result !== furthestResult && result.active) {
        result.active = false;
        result.discarded = true;
      }
    }
    return;
  }
}

export class EmphasisModifier {

  public static register(): void {
    // @ts-ignore
    DieCls.MODIFIERS.e = emphasis.name;
    // @ts-ignore
    DieCls.MODIFIERS.er = emphasis.name;
    // @ts-ignore
    DieCls.MODIFIERS.eh = emphasis.name;
    
    DieCls.prototype[emphasis.name] = emphasis;
  }
}