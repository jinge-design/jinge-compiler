/* eslint-disable @typescript-eslint/no-empty-function */
import antlr, { ParserRuleContext } from 'antlr4-build';
import TemplateParser from './parser/TemplateParser';
import TemplateLexer from './parser/TemplateLexer';

export interface ParseErr {
  line: number;
  column: number;
}
export function parse<T = ParserRuleContext>(source: string): [ParseErr | undefined, T] {
  const lexer = new TemplateLexer(new antlr.InputStream(source));
  const tokens = new antlr.CommonTokenStream(lexer);
  // console.log(lexer.getAllTokens().map(t => {
  //   console.log(t.text);
  //   return  t.text;
  // }));
  // debugger;
  const parser = new TemplateParser(tokens);
  let meetErr: ParseErr;
  parser.removeErrorListeners();
  parser.addErrorListener({
    syntaxError(recognizer, offendingSymbol, line, column, ...args) {
      // eslint-disable-next-line no-console
      console.error(...args);
      if (!meetErr) {
        meetErr = {
          line,
          column,
        };
      }
    },
    reportContextSensitivity() {},
    reportAttemptingFullContext() {},
    reportAmbiguity() {},
  });
  const tree = parser.html();
  return [meetErr, tree as unknown as T];
}
