export class ModuleSettings {

  public static registerSettings(): void {
    game.settings.register<string, string, string>('emphasis-roll', 'variant-rule-tiebreakers', {
      name: 'emphasis-roll.setting-variant-rule-tiebreakers-name',
      hint: `emphasis-roll.setting-variant-rule-tiebreakers-hint`,
      scope: 'world',
      config: true,
      type: String,
      choices: {
        reroll: game.i18n.localize(`emphasis-roll.reroll`),
        takeHigher: game.i18n.localize(`emphasis-roll.take-higher`),
      },
      default: 'reroll',
    });
  }

  public static getTiebreakerRule(): 'reroll' | 'takeHigher' {
    return game.settings.get('emphasis-roll', 'variant-rule-tiebreakers') as any;
  }

}