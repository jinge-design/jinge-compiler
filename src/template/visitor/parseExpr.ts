import { Node } from 'acorn';
import { Expression, ExpressionStatement } from 'estree';
import { Position } from './common';
import { parseExprNode } from './parseExprNode';
import { TemplateVisitor } from './visitor';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const acorn = require('acorn');

export function parseExpr(_visitor: TemplateVisitor, txt: string, position: Position) {
  // console.log(txt);
  txt = txt.trim();
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
    _visitor._throwParseError(position, 'expression grammar error.');
  }
  if (expr.body.length > 1 || expr.body[0].type !== 'ExpressionStatement') {
    _visitor._throwParseError(position, 'expression only support single ExpressionStatement. see https://[todo].');
  }
  expr = expr.body[0].expression;
  if (mayBeObject && expr.type !== 'ObjectExpression') {
    _visitor._throwParseError(position, 'expression startsWith "{" must be ObjectExpression. see https://[todo].');
  }
  if (mayBeArray && expr.type !== 'ArrayExpression') {
    _visitor._throwParseError(position, 'expression startsWith "[" must be ArrayExpression. see https://[todo].');
  }
  const info = {
    startLine: position.line,
    vars: [] as string[],
    source: txt,
  };
  return parseExprNode(_visitor, info, expr as Expression & Node, ['$ROOT_INDEX$']);
}
