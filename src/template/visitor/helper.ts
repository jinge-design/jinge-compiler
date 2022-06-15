import path from 'path';
import { Node } from 'acorn';
import { base as AcornWalkBase } from 'acorn-walk';
import { prependTab, SYMBOL_POSTFIX } from '../../util';
import { TemplateVisitor } from './visitor';
import { Position } from './common';

export function logParseError(_visitor: TemplateVisitor, tokenPosition: Position, msg: string) {
  let idx = -1;
  for (let i = 0; i < tokenPosition.line - 1; i++) {
    idx = _visitor._source.indexOf('\n', idx + 1);
  }
  idx = idx + 1;
  const eidx = _visitor._source.indexOf('\n', idx);
  const srcline = _visitor._source.substring(idx, eidx > idx ? eidx : _visitor._source.length);
  const trimSrcline = srcline.trimStart();
  const spc = tokenPosition.column - 1 - (srcline.length - trimSrcline.length);
  _visitor._emitErrorFn(
    new Error(`${msg}
  > ${path.relative(process.cwd(), _visitor._resourcePath)}, Ln ${tokenPosition.line}, Col ${tokenPosition.column}
  > ${trimSrcline}
    ${new Array(spc).fill(' ').join('')}^^^`),
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
  (function c(node, st?: unknown, override?: string) {
    const found = visitors[node.type] || (override ? visitors[override] : null);
    let stopVisit = false;
    if (found) {
      if (found(node, st) === false) stopVisit = true;
    }
    if (!stopVisit) {
      AcornWalkBase[override || node.type](node, st, c);
    }
  })(node);
}
