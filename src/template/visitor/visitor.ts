import path from 'path';
import crypto from 'crypto';
import escodegen from 'escodegen';
import HTMLTags from 'html-tags';
import SVGTags from 'svg-tags';
import { decode } from 'html-entities';
import { ParserRuleContext } from 'antlr4-build';
import { ImportDeclaration, Program } from 'estree';
import { aliasManager } from '../alias';
import TemplateParserVisitor from '../parser/TemplateParserVisitor';
import TemplateParser from '../parser/TemplateParser';
import { SYMBOL_POSTFIX } from '../../util';
import * as TPL from './tpl';
import { logParseError, prependTab2Space, replaceTpl } from './helper';
import { Parent, ParsedElement, Position, VM } from './common';
import { parseComponentElement } from './parseComponentElement';
import { parseHtmlElement } from './parseHtmlElement';
import { parseExpr } from './parseExpr';
import { Parser } from 'acorn';

const IMPORT_POSTFIX = '792732ac12612c8319900801';

export type VisitChildNodesCtx = ParserRuleContext & {
  htmlNode: () => ParserRuleContext[];
};

export interface TemplateVisitorOptions {
  source: string;
  resourcePath: string;
  addDebugName: boolean;
  emitErrorFn: (err: unknown) => void;
}
export class TemplateVisitor extends TemplateParserVisitor {
  _stack: {
    vms: VM[];
    parent: Parent;
  }[];
  _underMode_T: boolean;
  _vms: VM[];
  _resourcePath: string;
  _emitErrorFn: (err: unknown) => void;
  _source: string;
  _addDebugName: boolean;
  _needHandleComment: boolean;
  _parent: Parent;
  _imports: {
    components: Set<string>;
    styles: Set<string>;
  };
  _aliasImports: Record<string, string[]>;
  _importOutputCodes: unknown[];

  constructor(opts: TemplateVisitorOptions) {
    super();
    this._stack = [];
    this._underMode_T = false;
    this._vms = [];
    this._source = opts.source;
    this._resourcePath = opts.resourcePath;
    this._emitErrorFn = opts.emitErrorFn;
    this._addDebugName = opts.addDebugName;
    this._imports = {
      components: new Set(),
      styles: new Set(),
    };
    this._importOutputCodes = [];
    // this._i18nRenderDeps = {
    //   codes: [],
    //   keys: new Map(),
    // };
    this._aliasImports = {};
    this._needHandleComment = true;
    this._parent = {
      type: 'component',
      sub: 'root',
    };
  }

  _throwParseError(tokenPosition: Position, msg: string) {
    logParseError(this, tokenPosition, msg);
    throw new Error('parsing aborted as error occur.');
  }

  _enter(vms: VM[], info: Parent) {
    this._stack.push({
      vms: this._vms.slice(),
      parent: this._parent,
    });
    this._parent = info;
    this._vms = this._vms.concat(vms || []);
  }

  _exit() {
    const r = this._stack.pop();
    this._vms = r.vms;
    this._parent = r.parent;
  }

  _assert_arg_pass(tokenPosition: Position, elements: ParsedElement[], Component: string) {
    let found = 0;
    const args: Record<string, boolean> = {};
    elements.forEach((el) => {
      if (el.type === 'component' && el.sub === 'argument') {
        if (found < 0) {
          this._throwParseError(
            tokenPosition,
            `children of <${Component}> must satisfy the requirement that all of them contain slot-pass: attribute or none of them contain slot-pass: attribute`,
          );
        }
        if (el.argPass in args) {
          this._throwParseError(
            tokenPosition,
            `slot-pass: attribute name must be unique under <${Component}>, but found duplicate: ${el.argPass}`,
          );
        }
        args[el.argPass] = true;
        found = 1;
      } else {
        if (found > 0) {
          this._throwParseError(
            tokenPosition,
            `children of <${Component}> must satisfy the requirement that all of them contain slot-pass: attribute or none of them contain slot-pass: attribute`,
          );
        }
        found = -1;
      }
    });
    return found > 0;
  }

  _join_elements(elements: ParsedElement[]) {
    return elements.map((el) => el.value).join(',\n');
  }

  _gen_render(elements: ParsedElement[], vmLevel = -1) {
    const body = prependTab2Space(`${vmLevel >= 0 ? `const vm_${vmLevel} = component;` : ''}
return [
${this._join_elements(elements)}
];`);
    return `function(component) {
${body}
}`;
  }

  visitChildNodes(ctx: VisitChildNodesCtx, vms: VM[], parent: Parent) {
    const cnodes = ctx.htmlNode();
    if (cnodes.length === 0) return [];
    this._enter(vms, parent);
    const elements = cnodes.map((n) => this.visitHtmlNode(n)).filter((el) => !!el);
    this._exit();
    return elements;
  }

  visitHtml(ctx: ParserRuleContext) {
    const elements = (super.visitHtml(ctx) as ParsedElement[]).filter((el) => !!el);
    return {
      renderFn: this._gen_render(elements, 0),
      // i18nDeps: this._i18nRenderDeps.codes.join('\n'),
      aliasImports: aliasManager.getCode(this._aliasImports),
      imports: this._importOutputCodes.join('\n').trim(),
    };
  }

  visitHtmlNode(ctx: ParserRuleContext) {
    const elements = (super.visitHtmlNode(ctx) as ParsedElement[]).filter((el) => !!el);
    if (elements.length === 0) return null;
    else if (elements.length === 1) return elements[0];
    else {
      throw new Error('unexpected?!');
    }
  }

  visitHtmlTextContent(ctx: ParserRuleContext & { children: ParserRuleContext[] }) {
    const eles: string[] = [];
    // const last = ctx.children.length - 1;
    ctx.children.forEach((cn) => {
      let txt = cn.getText();
      if (cn.ruleIndex === TemplateParser.RULE_htmlText) {
        if (!txt.trim()) return;
        try {
          txt = decode(txt);
        } catch (ex) {
          this._throwParseError(ctx.start, ex.message);
        }
        txt = JSON.stringify(txt);
        eles.push(
          this._parent.type === 'html'
            ? txt
            : replaceTpl(TPL.TEXT_CONST, {
                VAL: txt,
              }),
        );
      } else {
        txt = txt.substring(2, txt.length - 1).trim(); // extract from '${}'
        if (!txt) return;
        const result = replaceTpl(parseExpr(this, txt, cn).join('\n'), {
          REL_COM: `component[$$${SYMBOL_POSTFIX}]`,
          ROOT_INDEX: '0',
          RENDER_START: 'setText$POSTFIX$(el, ',
          RENDER_END: ');',
        });
        eles.push(
          replaceTpl(TPL.TEXT_EXPR, {
            PUSH_ELE: this._parent.type === 'component' ? replaceTpl(TPL.PUSH_ROOT_ELE) : '',
            CODE: prependTab2Space(result),
          }),
        );
      }
      // return txt;
    });
    if (eles.length > 0) {
      if (this._needHandleComment) {
        this._needHandleComment = false; // we only handle comment on topest
      }
      return {
        type: 'text',
        value: eles.join(',\n'),
      };
    } else {
      return null;
    }
  }

  visitHtmlElement(
    ctx: ParserRuleContext & {
      htmlStartTag: () => ParserRuleContext;
      htmlEndTag: () => ParserRuleContext;
    },
  ) {
    if (this._needHandleComment) {
      this._needHandleComment = false; // we only handle comment on topest
    }
    const etag = ctx.htmlStartTag().getText();
    const endT = ctx.htmlEndTag();
    if (endT && endT.getText() !== etag) {
      this._throwParseError(endT.start, `close tag <${endT.getText()}> does not match open <${etag}>`);
    }
    if (etag.startsWith('_') /* && etag !== '_t' */ && etag !== '_slot') {
      this._throwParseError(
        ctx.start,
        'html tag starts with "_" is compiler preserved tag name. Current version only support: "<_slot>". see https://todo"',
      );
    }

    // if (etag === '_t') {
    //   return parseTranslate(this, ctx);
    // } else
    if (etag === '_slot') {
      return parseComponentElement(this, etag, etag, ctx);
    } else if (/^[a-z\d_-]+$/.test(etag)) {
      const componentTag = aliasManager.getComponentOfAlias(etag, this._aliasImports);
      if (componentTag) {
        return parseComponentElement(this, etag, componentTag, ctx);
      }
      if (etag !== 'svg' && this._parent.isSVG && SVGTags.indexOf(etag) < 0) {
        logParseError(this, ctx.start, `${etag} is not known svg tag.`);
      }
      if (etag !== 'svg' && !this._parent.isSVG && (HTMLTags as string[]).indexOf(etag) < 0) {
        logParseError(
          this,
          ctx.start,
          `'${etag}' is not known html tag, do you forgot to config component alias?`,
          'Warning',
        );
      }
      return parseHtmlElement(this, etag, ctx);
    }
    if (this._imports.components.has(etag)) {
      this._throwParseError(ctx.start, `Component '${etag}' not found. Forgot to import it on the top?`);
    }
    return parseComponentElement(this, etag, etag + IMPORT_POSTFIX , ctx);
  }

  visitHtmlComment(ctx: ParserRuleContext) {
    if (!this._needHandleComment) return; // we only handle comment on topest
    const comment = ctx.getText();
    // extract code from comment: <!-- -->
    const code = comment.substring(4, comment.length - 3);
    // import keyword not found.
    if (!/(^|[\s;])import($|\s)/.test(code)) return;
    let tree;
    try {
      tree = Parser.parse(code, {
        locations: true,
        sourceType: 'module',
        ecmaVersion: 2020,
      }) as unknown as Program;
    } catch (ex) {
      this._emitErrorFn(
        new Error(`Warning: keyword "import" is found in comment, but got error when tring to parse it as js code. see https://[todo]
 > ${ex.message}
 > ${this._resourcePath}`),
      );
      return;
    }
    tree.body = tree.body.filter((node: ImportDeclaration) => {
      if (node.type !== 'ImportDeclaration') return false;
      const specifiers = [];
      for (let i = 0; i < node.specifiers.length; i++) {
        const spec = node.specifiers[i];
        const local = spec.local.name;
        const isStyle = /\.(css|less|sass|scss)$/.test(local);
        if (!/^[A-Z][a-zA-Z\d]*$/.test(local) && !isStyle) {
          this._throwParseError(
            {
              line: ctx.start.line + spec.loc.start.line - 1,
              column: spec.loc.start.column,
            },
            'Imported component name must match /^[A-Z][a-zA-Z\\d]+$/. see https://[todo]',
          );
        }
        if (this._imports.components.has(local) || this._imports.styles.has(local)) {
          this._throwParseError(
            {
              line: ctx.start.line + spec.loc.start.line - 1,
              column: spec.loc.start.column,
            },
            'Dulplicate imported : ' + local,
          );
        }
        const imps = isStyle ? this._imports.styles : this._imports.components;
        imps.add(local);
        spec.local = {
          type: 'Identifier',
          name: local + IMPORT_POSTFIX,
        };
        specifiers.push(spec);
      }
      if (specifiers.length > 0) {
        node.specifiers = specifiers;
        return true;
      } else {
        return false;
      }
    });
    if (tree.body.length === 0) return;
    const output = escodegen.generate(tree, {
      indent: '',
    });
    // console.log(output);
    this._importOutputCodes.push(output);
  }
}
