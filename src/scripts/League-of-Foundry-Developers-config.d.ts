export {};

declare global {
  interface LenientGlobalVariableTypes {
    // League-of-Foundry-Developers thought it was a good idea to make everything nullable
    // This is their construction to bypass that
    canvas: never;
    game: never;
    socket: never;
  }
}