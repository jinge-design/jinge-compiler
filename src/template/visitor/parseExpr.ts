import { randomBytes } from 'crypto';
import { Parser, Node } from 'acorn';
import { Expression, ExpressionStatement } from 'estree';
import { Position } from './common';
import { throwParseError } from './helper';
import { parseExprNode } from './parseExprNode';
import { TemplateVisitor } from './visitor';

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
  /**
   * class 在 js 中是关键字，不允许做为变量名使用。但在 html 中是允许使用的，因为 html 中的 class 会被转成 vm.class。
   * 这里先将 class 转成一个几乎不可能冲突的合法变量名，使用 acorn 转换成 vm.class_xxx 后，再将所有 class_xxx 替换回 class
   */
  const classSymbol = 'class_' + randomBytes(10).toString('hex');
  const source = txt.replace(/\bclass\b/g, classSymbol);
  let expr;
  try {
    expr = Parser.parse(source, {
      locations: true,
      ecmaVersion: 'latest',
    }) as unknown as { body: ExpressionStatement[] };
  } catch (ex) {
    throwParseError(_visitor, position, 'expression grammar error.');
  }
  if (expr.body.length > 1 || expr.body[0].type !== 'ExpressionStatement') {
    throwParseError(_visitor, position, 'expression only support single ExpressionStatement. see https://[todo].');
  }
  expr = expr.body[0].expression;
  if (mayBeObject && expr.type !== 'ObjectExpression') {
    throwParseError(_visitor, position, 'expression startsWith "{" must be ObjectExpression. see https://[todo].');
  }
  if (mayBeArray && expr.type !== 'ArrayExpression') {
    throwParseError(_visitor, position, 'expression startsWith "[" must be ArrayExpression. see https://[todo].');
  }
  const info = {
    startLine: position.line,
    vars: [] as string[],
    source,
  };
  const res = parseExprNode(_visitor, info, expr as Expression & Node, ['$ROOT_INDEX$']);
  if (source !== txt) {
    // source !== txt 说明有 class 被替换，需要替换回来。
    res.codes = res.codes.map((c) => c.replaceAll(classSymbol, 'class'));
  }
  return res;
}
