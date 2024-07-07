export class Dnd5e {

  static #abilityDialogTitleParts: string[];
  static #isAbilityDialogTitle(title: string): boolean {
    if (Dnd5e.#abilityDialogTitleParts == null) {
      Dnd5e.#abilityDialogTitleParts = [];
      for (const ability of Object.values((CONFIG as any).DND5E.abilities) as Array<{label?: string}>) {
        Dnd5e.#abilityDialogTitleParts.push(game.i18n.format("DND5E.AbilityPromptTitle", {ability: ability.label ?? ''}));
        Dnd5e.#abilityDialogTitleParts.push(game.i18n.format("DND5E.SavePromptTitle", {ability: ability.label ?? ''}));
      }
      for (const skill of Object.values((CONFIG as any).DND5E.skills) as Array<{label?: string}>) {
        Dnd5e.#abilityDialogTitleParts.push(game.i18n.format("DND5E.SkillPromptTitle", {skill: skill.label ?? ''}));
      }
      for (const toolId of Object.keys((CONFIG as any).DND5E.toolIds) as Array<string>) {
        Dnd5e.#abilityDialogTitleParts.push(game.i18n.format("DND5E.ToolPromptTitle", {
          tool: (game as any).dnd5e.documents.Trait.keyLabel(toolId, {trait: 'tool'}) ?? ''
        }));
      }
      Dnd5e.#abilityDialogTitleParts.push(game.i18n.localize("DND5E.DeathSavingThrow"));
      Dnd5e.#abilityDialogTitleParts.push(game.i18n.localize("DND5E.Initiative"));
    }

    for (const part of Dnd5e.#abilityDialogTitleParts) {
      if (title.startsWith(part)) {
        return true;
      }
    }

    return false;
  }

  public static register(): void {
    Dnd5e.#injectAbilityDialogs();
  }

  static #injectAbilityDialogs(): void {
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
            const d20 = (this.terms[0] as Die);
            let modifiers: string[] = ['e'];
            d20.modifiers = modifiers;
            Object.defineProperty(d20, 'modifiers', {
              configurable: true,
              get: () => modifiers,
              set: value => {
                if (Array.isArray(value) && !value.includes('e')) {
                  value.push('e');
                }
                modifiers = value;
              },
            });
            d20.number = 2;
            Object.defineProperty(d20, 'number', {
              configurable: true,
              get: () => 2,
              set: value => {/*ignore*/},
            });
          }
          return onDialogSubmit.apply(this, args);;
        }
        return app.data.buttons[invokeButton].callback(html);
      },
    }
    setTimeout(() => app.render(true));
  }

}

