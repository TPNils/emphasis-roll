export class ModuleSettings {

  public static registerSettings(): void {
    game.settings.register<string, string, string>('emphasis-roll', 'variant-rule-tiebreakers', {
      name: 'Variant rule: Tiebreakers',
      hint: `How to handle when you roll 2 numbers equidistant from the middle. Example: the middle of a d20 is considered a 10 and you rolled a 7 and 13`,
      scope: 'world',
      config: true,
      type: String,
      choices: {
        reroll: 'Reroll',
        takeHigher: 'Take higher',
      },
      default: 'reroll',
    });
  }

  public static getTiebreakerRule(): 'reroll' | 'takeHigher' {
    return game.settings.get('emphasis-roll', 'variant-rule-tiebreakers') as any;
  }

}