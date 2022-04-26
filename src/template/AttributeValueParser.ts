import antlr from 'antlr4-build';
import AttrParser from './parser/AttrParser';
import AttrLexer from './parser/AttrLexer';

export class AttributeValueParser extends AttrParser {
  static parse(content: string) {
    const lexer = new AttrLexer(new antlr.InputStream(content));
    const tokens = new antlr.CommonTokenStream(lexer);
    // console.log(lexer.getAllTokens().map(t => t.text));
    const parser = new AttributeValueParser(tokens);
    parser.buildParseTrees = false;
    parser.value();

    return parser._results.map((r) => {
      const t = r[1];
      return {
        type: r[0] === 0 ? 'TEXT' : 'VAR',
        value: r[0] === 0 ? t : t.substring(2, t.length - 1).trim(),
      };
    });
  }

  _results: [number, string][];

  constructor(input: unknown) {
    super(input);
    this._results = [];
  }
}
