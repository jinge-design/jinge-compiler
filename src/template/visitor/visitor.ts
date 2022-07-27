import HTMLTags from 'html-tags';
import SVGTags from 'svg-tags';
import { decode } from 'html-entities';
import { ImportDeclaration, Program } from 'estree';
import { Parser } from 'acorn';
import { INode, ITag, IText, SyntaxKind } from '@jingeweb/html5parser';
import { aliasManager } from '../alias';
import { IMPORT_POSTFIX, SYMBOL_POSTFIX } from '../../util';
import * as TPL from './tpl';
import { logParseError, prependTab2Space, replaceTpl } from './helper';
import { Parent, ParsedElement, Position, VM } from './common';
import { parseComponentElement } from './parseComponentElement';
import { parseHtmlElement } from './parseHtmlElement';
import { parseExpr } from './parseExpr';

export interface TemplateVisitorOptions {
  source: string;
  resourcePath: string;
  addDebugName: boolean;
  emitErrorFn: (err: unknown) => void;
}
export class TemplateVisitor {
  _source: string;
  _stack: {
    vms: VM[];
    parent: Parent;
  }[];
  _underMode_T: boolean;
  _vms: VM[];
  _resourcePath: string;
  _emitErrorFn: (err: unknown) => void;
  _addDebugName: boolean;
  _needHandleComment: boolean;
  _parent: Parent;
  _imports: Set<string>;
  _aliasImports: Record<string, string[]>;
  _importOutputCodes: unknown[];

  constructor(opts: TemplateVisitorOptions) {
    this._source = opts.source;
    this._stack = [];
    this._underMode_T = false;
    this._vms = [];
    this._resourcePath = opts.resourcePath;
    this._emitErrorFn = opts.emitErrorFn;
    this._addDebugName = opts.addDebugName;
    this._imports = new Set();
    this._importOutputCodes = [];
    this._aliasImports = {};
    this._needHandleComment = true;
    this._parent = {
      type: 'component',
      sub: 'root',
    };
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
          throw logParseError(
            this,
            tokenPosition,
            `children of <${Component}> must satisfy the requirement that all of them contain slot-pass: attribute or none of them contain slot-pass: attribute`,
          );
        }
        if (el.argPass in args) {
          throw logParseError(
            this,
            tokenPosition,
            `slot-pass: attribute name must be unique under <${Component}>, but found duplicate: ${el.argPass}`,
          );
        }
        args[el.argPass] = true;
        found = 1;
      } else {
        if (found > 0) {
          throw logParseError(
            this,
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

  visitHtml(inodes: INode[]) {
    const elements = inodes.map((inode) => this.visitHtmlNode(inode)).filter((el) => !!el);
    return {
      renderFn: this._gen_render(elements, 0),
      // i18nDeps: this._i18nRenderDeps.codes.join('\n'),
      aliasImports: aliasManager.getCode(this._aliasImports),
      imports: this._importOutputCodes.join('\n').trim(),
    };
  }

  visitHtmlNode(inode: INode): ParsedElement | null {
    if (inode.type === SyntaxKind.Text) {
      return this.visitHtmlTextContent(inode);
    } else if (inode.name === '!--') {
      this.visitHtmlComment(inode.body[0] as IText);
      return null;
    } else {
      return this.visitHtmlElement(inode);
    }
  }

  visitChildNodes(inodes: INode[], vms: VM[], parent: Parent) {
    if (!inodes?.length) return [];
    this._enter(vms, parent);
    const elements = inodes.map((n) => this.visitHtmlNode(n)).filter((el) => !!el);
    this._exit();
    return elements;
  }

  visitHtmlTextContent(inode: IText): ParsedElement {
    let txt = this._parent.isPreOrCodeTag ? inode.value : inode.value.trim();
    if (!txt) return null;
    try {
      txt = decode(txt);
    } catch (ex) {
      logParseError(this, inode.loc.start, ex.message);
    }
    txt = '`' + txt + '`'; // 将文本转成 es6 字符串表达式
    const { isConst, codes } = parseExpr(this, txt, inode.loc.start);
    if (isConst) {
      return {
        type: 'text',
        value: this._parent.type === 'html' ? codes[0] : replaceTpl(TPL.TEXT_CONST, { VAL: codes[0] }),
      };
    }
    const result = replaceTpl(codes.join('\n'), {
      REL_COM: `component[$$${SYMBOL_POSTFIX}]`,
      ROOT_INDEX: '0',
      RENDER_START: 'setText$POSTFIX$(el, ',
      RENDER_END: ');',
    });
    const code = replaceTpl(TPL.TEXT_EXPR, {
      PUSH_ELE: this._parent.type === 'component' ? replaceTpl(TPL.PUSH_ROOT_ELE) : '',
      CODE: prependTab2Space(result),
    });
    if (this._needHandleComment) {
      this._needHandleComment = false; // we only handle comment on topest
    }
    return {
      type: 'text',
      value: code,
    };
  }

  visitHtmlElement(inode: ITag) {
    if (this._needHandleComment) {
      this._needHandleComment = false; // we only handle comment on topest
    }
    const etag = inode.rawName;
    if (etag.startsWith('_') /* && etag !== '_t' */ && etag !== '_slot') {
      throw logParseError(
        this,
        inode.loc.start,
        'html tag starts with "_" is compiler preserved tag name. Current version only support: "<_slot>". see https://todo"',
      );
    }
    if (etag === '_slot') {
      return parseComponentElement(this, etag, etag, inode);
    }
    // 优先看一个 tag 是否是注册的组件别名
    const componentTag = aliasManager.getComponentOfAlias(etag, this._aliasImports);
    if (componentTag) {
      return parseComponentElement(this, etag, componentTag, inode);
    }
    // 其次看 tag 是否是在顶部 import 的组件变量。
    if (this._imports.has(etag)) {
      return parseComponentElement(this, etag, etag + IMPORT_POSTFIX, inode);
    }
    // 最后看是否是合法的 html/svg 标签
    if (this._parent.isSVG && SVGTags.indexOf(etag) < 0) {
      throw logParseError(this, inode.loc.start, `${etag} is not known svg tag.`);
    }
    if (!this._parent.isSVG && (HTMLTags as string[]).indexOf(etag) < 0) {
      throw logParseError(
        this,
        inode.loc.start,
        `'${etag}' is not known html tag, do you forgot to config component alias or import it on the top?`,
      );
    }
    return parseHtmlElement(this, etag, inode);
  }

  visitHtmlComment(inode: IText) {
    if (!this._needHandleComment) return; // we only handle comment on topest
    const code = inode.value;
    // import keyword not found.
    if (!/(^|[\s;])import($|\s)/.test(code)) return;
    let tree;
    try {
      tree = Parser.parse(code, {
        locations: true,
        sourceType: 'module',
        ecmaVersion: 'latest',
      }) as unknown as Program;
    } catch (ex) {
      throw logParseError(
        this,
        inode.loc.start,
        'keyword "import" is found in comment, but got error when tring to parse it as js code.',
      );
      return;
    }
    const imports: string[] = [];
    tree.body.forEach((node: ImportDeclaration) => {
      if (node.type !== 'ImportDeclaration' || !node.specifiers.length) {
        return;
      }
      const src = node.source.value.toString();
      let importCode = `import { `;
      node.specifiers.forEach((spec, i) => {
        if (spec.type === 'ImportNamespaceSpecifier') {
          throw new Error('unsupport import type'); // 暂不支持 import * as X from 的写法。
        }
        const local = spec.local.name;
        this._imports.add(local);
        importCode += `${spec.type === 'ImportDefaultSpecifier' ? 'default' : spec.imported.name} as ${
          local + IMPORT_POSTFIX
        }${i === node.specifiers.length - 1 ? '' : ', '}`;
      });
      importCode += ` } from '${src}';`;
      imports.push(importCode);
    });
    this._importOutputCodes.push(imports.join('\n'));
  }
}
