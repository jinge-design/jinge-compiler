declare module 'escodegen' {
  export function generate(ast: unknown, options?: { indent: string }): string;
}
