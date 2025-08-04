const showRollForOptions = [
  {name: 'attack', default: false},
  {name: 'ability', default: true},
  {name: 'skill', default: true},
  {name: 'tool', default: true},
  {name: 'save', default: true},
  {name: 'death-save', default: true},
  {name: 'initiative', default: true},
] as const;

type RollType = (typeof showRollForOptions)[number]['name'];

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

export class Dnd5e {

  static #abilityDialogTitleParts: RegExp[];
  static #isAbilityDialogTitle(title: string): boolean {
    if (Dnd5e.#abilityDialogTitleParts == null) {
      Dnd5e.#abilityDialogTitleParts = [];
      if (Dnd5e.shouldShowRoll('attack')) {
        const str = game.i18n.localize("DND5E.AttackRoll");
        Dnd5e.#abilityDialogTitleParts.push(new RegExp(`${escapeRegExp(str)}$`));
      }
      if (Dnd5e.shouldShowRoll('ability')) {
        for (const ability of Object.values((CONFIG as any).DND5E.abilities) as Array<{label?: string}>) {
          const str = game.i18n.format("DND5E.AbilityPromptTitle", {ability: ability.label ?? ''});
          Dnd5e.#abilityDialogTitleParts.push(new RegExp(`^${escapeRegExp(str)}`));
        }
      }
      if (Dnd5e.shouldShowRoll('save')) {
        for (const ability of Object.values((CONFIG as any).DND5E.abilities) as Array<{label?: string}>) {
          const str = game.i18n.format("DND5E.SavePromptTitle", {ability: ability.label ?? ''});
          Dnd5e.#abilityDialogTitleParts.push(new RegExp(`^${escapeRegExp(str)}`));
        }
      }
      if (Dnd5e.shouldShowRoll('skill')) {
        for (const skill of Object.values((CONFIG as any).DND5E.skills) as Array<{label?: string}>) {
          const str = game.i18n.format("DND5E.SkillPromptTitle", {skill: skill.label ?? ''});
          Dnd5e.#abilityDialogTitleParts.push(new RegExp(`^${escapeRegExp(str)}`));
        }
      }
      if (Dnd5e.shouldShowRoll('tool')) {
        for (const toolId of Object.keys((CONFIG as any).DND5E.toolIds) as Array<string>) {
          const str = game.i18n.format("DND5E.ToolPromptTitle", {
            tool: (game as any).dnd5e.documents.Trait.keyLabel(toolId, {trait: 'tool'}) ?? ''
          });
          Dnd5e.#abilityDialogTitleParts.push(new RegExp(`^${escapeRegExp(str)}`));
        }
      }
      if (Dnd5e.shouldShowRoll('death-save')) {
        const str = game.i18n.format("DND5E.DeathSavingThrow");
        Dnd5e.#abilityDialogTitleParts.push(new RegExp(`^${escapeRegExp(str)}`));
      }
      if (Dnd5e.shouldShowRoll('initiative')) {
        const str = game.i18n.format("DND5E.Initiative");
        Dnd5e.#abilityDialogTitleParts.push(new RegExp(`^${escapeRegExp(str)}`));
      }
    }

    for (const part of Dnd5e.#abilityDialogTitleParts) {
      if (part.test(title)) {
        return true;
      }
    }

    return false;
  }

  static shouldShowRoll(rollType: RollType): boolean {
    console.log(rollType);
    return game.settings.get('emphasis-roll', `dnd5e-show-${rollType}`) === true;
  }

  public static register(): void {
    Dnd5e.#injectAbilityDialogsPreDnd4x1();
    Dnd5e.#injectAbilityDialogsDnd4x1();
    Dnd5e.#registerSettings();
  }

  /** 
   * pre dnd 4.1.0(?)
   * Did not test exact version, based on this issue's milestone
   * https://github.com/foundryvtt/dnd5e/issues/2138
   */
  static #injectAbilityDialogsPreDnd4x1(): void {
    Hooks.on('renderDialog', (app: Dialog, jquery: JQuery, data: Dialog.Data) => {
      const buttonKeys = Object.keys(data.buttons);
      if (buttonKeys.length !== 3) {
        return;
      }
      if (!buttonKeys.includes('advantage') || !buttonKeys.includes('disadvantage') || !buttonKeys.includes('normal')) {
        return;
      }
      if (!Dnd5e.#isAbilityDialogTitle(app.title)) {
        return;
      }

      Dnd5e.#injectEmphasisButton(app, 'normal');
    });
  }

  /** 
   * Starting at dnd 4.1.0(?)
   * Did not test exact version, based on this issue's milestone
   * https://github.com/foundryvtt/dnd5e/issues/2138
   */
  static #injectAbilityDialogsDnd4x1(): void {
    const D20RollConfigurationDialogProto: {_prepareButtonsContext: (...args: any[]) => Promise<any>; _finalizeRolls: (action: string) => any;} = (globalThis.dnd5e as any)?.applications?.dice?.D20RollConfigurationDialog?.prototype;
    if (!D20RollConfigurationDialogProto) {
      return;
    }
    
    if (typeof D20RollConfigurationDialogProto._prepareButtonsContext === 'function') {
      const original = D20RollConfigurationDialogProto._prepareButtonsContext;
      D20RollConfigurationDialogProto._prepareButtonsContext = async function (...args: any[]) {
        const context = await original.apply(this, args);
        context.buttons.emphasis = {
          default: false,
          label: game.i18n.localize(`emphasis-roll.emphasis`),
        }
        return context;
      }
    }
    if (typeof D20RollConfigurationDialogProto._finalizeRolls === 'function') {
      const original = D20RollConfigurationDialogProto._finalizeRolls;
      D20RollConfigurationDialogProto._finalizeRolls = function (...args) {
        const action = args[0];
        if (action === 'emphasis') {
          this.rolls.map(roll => {
            const firstDie = roll.terms[0] as Die
            if (firstDie.faces === 20) {
              Dnd5e.#injectEmphasisModifier(firstDie);
              roll.configureModifiers();
            }
            return roll;
          });
        }
        return original.apply(this, args);
      }
    }
    Hooks.on('renderDialog', (app: Dialog, jquery: JQuery, data: Dialog.Data) => {
      const buttonKeys = Object.keys(data.buttons);
      if (buttonKeys.length !== 3) {
        return;
      }
      if (!buttonKeys.includes('advantage') || !buttonKeys.includes('disadvantage') || !buttonKeys.includes('normal')) {
        return;
      }
      if (!Dnd5e.#isAbilityDialogTitle(app.title)) {
        return;
      }

      Dnd5e.#injectEmphasisButton(app, 'normal');
    });
  }

  static #injectEmphasisButton(app: Dialog, invokeButton: string): void {
    app.data.buttons.emphasis = {
      label: game.i18n.localize(`emphasis-roll.emphasis`),
      callback: html => {
        const onDialogSubmit: Function = (CONFIG.Dice as any).D20Roll.prototype._onDialogSubmit;
        (CONFIG.Dice as any).D20Roll.prototype._onDialogSubmit = function(this: Roll & {readonly validD20Roll: boolean}, ...args: [HTMLElement | JQuery, number]) {
          (CONFIG.Dice as any).D20Roll._onDialogSubmit = onDialogSubmit;
          if (this.validD20Roll) {
            Dnd5e.#injectEmphasisModifier(this.terms[0] as Die)
          }
          return onDialogSubmit.apply(this, args);;
        }
        return app.data.buttons[invokeButton].callback(html);
      },
    }
    setTimeout(() => app.render(true));
  }

  static #injectEmphasisModifier(die: Die): void {
    let modifiers: string[] = ['e'];
    die.modifiers = modifiers;
    Object.defineProperty(die, 'modifiers', {
      configurable: true,
      get: () => modifiers,
      set: value => {
        if (Array.isArray(value) && !value.includes('e')) {
          value.push('e');
        }
        modifiers = value;
      },
    });
    die.number = 2;
    Object.defineProperty(die, 'number', {
      configurable: true,
      get: () => 2,
      set: value => {/*ignore*/},
    });
  }

  static #registerSettings(): void {
    for (const setting of showRollForOptions) {
      const settingName = `dnd5e-show-${setting.name}`;
      game.settings.register<string, string, boolean>('emphasis-roll', settingName, {
        name: `emphasis-roll.${settingName}-name`,
        hint: `emphasis-roll.${settingName}-hint`,
        scope: 'world',
        type: Boolean,
        config: true,
        default: setting.default,
        // Re-detect titles
        onChange: () => Dnd5e.#abilityDialogTitleParts = null,
      });
    }
    
  }

}

