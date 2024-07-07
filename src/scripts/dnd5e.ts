export class Dnd5e {

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

      Dnd5e.#injectEmphasisButton(app, 'normal');
    });
  }

  static #injectEmphasisButton(app: Dialog, invokeButton: string): void {
    app.data.buttons.emphasis = {
      label: 'Emphasis',
      callback: html => {
        const onDialogSubmit: Function = (CONFIG.Dice as any).D20Roll.prototype._onDialogSubmit;
        (CONFIG.Dice as any).D20Roll.prototype._onDialogSubmit = function(this: Roll & {readonly validD20Roll: boolean}, ...args: [HTMLElement | JQuery, number]) {
          (CONFIG.Dice as any).D20Roll._onDialogSubmit = onDialogSubmit;
          if (this.validD20Roll) {
            const d20 = (this.terms[0] as Die);
            delete d20.modifiers;
            let modifiers: string[] = ['e'];
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
            delete d20.number;
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

