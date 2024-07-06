import { EmphasisModifier } from "./emphasis-modifier.js";

Hooks.on('init', () => {
  EmphasisModifier.register();
});