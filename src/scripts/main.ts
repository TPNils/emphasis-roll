import { EmphasisModifier } from "./emphasis-modifier.js";

Hooks.on('init', () => {
  EmphasisModifier.register();
  if ((game as Game).system.id === 'dnd5e') {
    // @ts-ignore
    import('./dnd5e.js').then(exp => exp.Dnd5e.register());
  }
});