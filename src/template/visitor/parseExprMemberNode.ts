import { Node } from 'acorn';
import { Expression, Identifier, MemberExpression } from 'estree';
import { Position } from './common';
import { logParseError } from './helper';
import { TemplateVisitor } from './visitor';

export type MememberPath =
  | {
      type: 'const' | 'id';
      value: string;
    }
  | {
      type: 'computed';
      value: MemberExpression & Node;
    };
export function parseExprMemberNode(_visitor: TemplateVisitor, memExpr: MemberExpression & Node, startLine: number) {
  const paths: MememberPath[] = [];
  let computed = -1; // -1: no computed, 0: only have Literal computed, 1: member expression computed
  let root: Identifier & Node = null;
  const unsupport = (loc: Position) =>
    logParseError(
      _visitor,
      {
        line: startLine + loc.line - 1,
        column: loc.column,
      },
      'expression not support. see https://[todo]',
    );
  const walk = (node: MemberExpression & Node) => {
    const objectExpr = node.object as Expression & Node;
    const propertyExpr = node.property as Expression & Node;
    if (node.computed) {
      if (propertyExpr.type === 'Literal') {
        paths.unshift({
          type: 'const',
          value: propertyExpr.value as string,
        });
        // optionalChainReplaces.push({ sn: propertyExpr.start, se: propertyExpr.end, code: propertyExpr.name + '?' });
        if (computed < 0) computed = 0;
      } else {
        computed = 1;
        paths.unshift({
          type: 'computed',
          value: node,
        });
      }
    } else {
      if (propertyExpr.type !== 'Identifier') {
        throw unsupport(node.loc.start);
      } else {
        paths.unshift({
          type: 'const',
          value: propertyExpr.name,
        });
      }
    }
    if (objectExpr.type === 'Identifier') {
      root = objectExpr as Identifier & Node;
      paths.unshift({
        type: 'const',
        value: objectExpr.name,
      });
    } else {
      if (objectExpr.type !== 'MemberExpression') {
        throw unsupport(node.loc.start);
      } else {
        walk(objectExpr);
      }
    }
  };

  walk(memExpr);

  return {
    root,
    computed,
    paths,
  };
}
