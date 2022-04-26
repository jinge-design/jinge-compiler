/* eslint-disable @typescript-eslint/no-empty-function */
import antlr, { Token } from 'antlr4-build';
import ImportParser from './parser/ImportParser';
import ImportLexer from './parser/ImportLexer';

export class ExtractImportLocalParser extends ImportParser {
  static parse(content: string) {
    const locals: string[] = [];
    const imports: string[] = [];
    // debugger;
    // console.log(content);
    const lexer = new ImportLexer(new antlr.InputStream(content));
    const tokens = new antlr.CommonTokenStream(lexer);
    // const ts = lexer.getAllTokens();
    // debugger;
    const parser = new ExtractImportLocalParser(tokens);
    let meetErr = false;
    // parser._errHandler = new BailErrorStrategy();
    parser.removeErrorListeners();
    parser.addErrorListener({
      syntaxError() {
        // console.log(args.length);
        meetErr = true;
      },
      reportContextSensitivity() {},
      reportAttemptingFullContext() {},
      reportAmbiguity() {},
    });
    parser.buildParseTrees = false;
    parser.stmts();
    // console.log(parser._locals, parser._imports);
    if (!meetErr) {
      locals.push(...parser.__jingeLocals.map((token) => token.text));
      imports.push(...parser.__jingeImports);
    }
    return {
      locals,
      imports,
    };
  }

  __jingeLocals: Token[];
  __jingeImports: string[];

  constructor(input: unknown) {
    super(input);
    this.__jingeLocals = [];
    this.__jingeImports = [];
  }
}
