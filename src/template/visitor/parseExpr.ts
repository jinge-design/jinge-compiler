import { ParserRuleContext } from 'antlr4-build';
import { ExpressionStatement } from 'estree';
import { parseExprNode } from './parseExprNode';
import { TemplateVisitor } from './visitor';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const acorn = require('acorn');

export function parseExpr(_visitor: TemplateVisitor, txt: string, ctx: ParserRuleContext) {
  // console.log(txt);
  txt = txt.trim();
  if (txt === 'class' || /\bclass\b/.test(txt)) {
    _visitor._throwParseError(ctx.start, "expression can't contain js keyword class");
  }
  let mayBeObject = false;
  let mayBeArray = false;
  /*
   * if expression startsWith '{', we treat it as ObjectExpression.
   * we wrap it into '()' to treat it as ObjectExpression.
   */
  if (txt[0] === '{') {
    mayBeObject = true;
    txt = '(' + txt + ')';
  } else if (txt[0] === '[') {
    mayBeArray = true;
  }
  let expr;
  try {
    expr = acorn.Parser.parse(txt, {
      locations: true,
      ecmaVersion: 2020,
    }) as unknown as { body: ExpressionStatement[] };
  } catch (ex) {
    _visitor._throwParseError(ctx.start, 'expression grammar error.');
  }
  if (expr.body.length > 1 || expr.body[0].type !== 'ExpressionStatement') {
    _visitor._throwParseError(ctx.start, 'expression only support single ExpressionStatement. see https://[todo].');
  }
  expr = expr.body[0].expression;
  if (mayBeObject && expr.type !== 'ObjectExpression') {
    _visitor._throwParseError(ctx.start, 'expression startsWith "{" must be ObjectExpression. see https://[todo].');
  }
  if (mayBeArray && expr.type !== 'ArrayExpression') {
    _visitor._throwParseError(ctx.start, 'expression startsWith "[" must be ArrayExpression. see https://[todo].');
  }
  const info = {
    startLine: ctx.start.line,
    vars: [] as string[],
  };
  return parseExprNode(_visitor, info, expr, ['$ROOT_INDEX$']);
}
