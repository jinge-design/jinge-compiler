import { Node } from 'acorn';
import { prependTab, SYMBOL_POSTFIX } from '../../util';
import { TemplateVisitor } from './visitor';
import { Position } from './common';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const AcornWalk = require('acorn-walk');

export function logParseError(_visitor: TemplateVisitor, tokenPosition: Position, msg: string, type = 'Error') {
  let idx = -1;
  for (let i = 0; i < tokenPosition.line - 1; i++) {
    idx = _visitor._source.indexOf('\n', idx + 1);
  }
  idx = idx + 1;
  const eidx = _visitor._source.indexOf('\n', idx);
  _visitor._emitErrorFn(
    new Error(`${type} occur at line ${tokenPosition.line}, column ${tokenPosition.column}:
> ${_visitor._source.substring(idx, eidx > idx ? eidx : _visitor._source.length)}
> ${_visitor._resourcePath}
> ${msg}`),
  );
}

export function replaceTpl(str: string, ctx?: Record<string, string>) {
  return replaceTplStr(str, {
    ...ctx,
    POSTFIX: SYMBOL_POSTFIX,
  });
}

export function prependTab2Space(str: string, replaceStartEndEmpty = false) {
  return prependTab(str, replaceStartEndEmpty, 2);
}

export function replaceTplStr(tpl: string, ctx: Record<string, string>) {
  if (!tpl) debugger;
  for (const k in ctx) {
    tpl = tpl.replace(new RegExp('\\$' + k + '\\$', 'g'), ctx[k].replace(/\$/g, '$$$$'));
  }
  return tpl;
}

export function walkAcorn(node: Node, visitors: Record<string, (...args: unknown[]) => void | boolean>) {
  const baseVisitor = AcornWalk.base;
  (function c(node, st?: unknown, override?: string) {
    const found = visitors[node.type] || (override ? visitors[override] : null);
    let stopVisit = false;
    if (found) {
      if (found(node, st) === false) stopVisit = true;
    }
    if (!stopVisit) {
      baseVisitor[override || node.type](node, st, c);
    }
  })(node);
}
