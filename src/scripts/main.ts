import { EmphasisModifier } from "./emphasis-modifier.js";
import { ModuleSettings } from "./module-settings.js";

Hooks.on('init', () => {
  ModuleSettings.registerSettings();
  EmphasisModifier.register();
  if ((game as Game).system.id === 'dnd5e') {
    // @ts-ignore
    import('./dnd5e.js').then(exp => exp.Dnd5e.register());
  }
});