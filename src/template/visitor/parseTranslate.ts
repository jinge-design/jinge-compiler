import { ParserRuleContext } from 'antlr4-build';
import { sharedOptions } from '../../options';
import TemplateParser from '../parser/TemplateParser';
import { prependTab } from '../../util';
import { i18nManager } from '../../i18n';
import { aliasManager } from '../../alias';
import { parse } from '../helper';
import { replaceTpl } from './helper';
import { TemplateVisitor } from './visitor';
import * as TPL from './tpl';

export function parseTranslate(
  _visitor: TemplateVisitor,
  ctx: ParserRuleContext & {
    htmlNode: () => (ParserRuleContext & {
      children?: ParserRuleContext[];
    })[];
  },
) {
  if (_visitor._underMode_T) {
    _visitor._throwParseError(ctx.start, '<_t> component cannot have <_t> child');
  }

  const defaultLocaleContentNodes = ctx.htmlNode();
  if (defaultLocaleContentNodes.length === 0) {
    // meet empty <_t></_t>
    return null;
  }

  if (i18nManager.written) {
    /**
     * 如果多语言脚本资源已经处理过了（i18nManager.written === true），说明是在
     *   启用了 watch 的研发模式下，文件发生变化后重新编译，这种情况下，由于多方面的复杂
     *   问题不好解决，暂时先简化为不做多语言的处理。
     */
    const code = defaultLocaleContentNodes
      .map((n) => {
        return _visitor.visitHtmlNode(n);
      })
      .filter((el) => !!el)
      .map((r) => r.value)
      .join(',\n');
    return {
      type: 'component',
      sub: 'normal',
      value: code,
    };
  }

  i18nManager.assertPluginInstalled();
  /*
   * check translate <_t> component type
   *   0: text without any expression, such as <_t>Hello, World</t>
   *   1: text with expression, such as <_t>Hello, ${boy}</t>
   *   2: text with complex children, such as <_t>Hello, <span>${body}</span></_t>
   */
  let type = 0;
  const innerHtml = defaultLocaleContentNodes
    .map((c) => {
      if (c.ruleIndex !== TemplateParser.RULE_htmlNode || c.children.length !== 1) {
        throw new Error('unimpossible!?');
      }
      c = c.children[0];
      if (c.ruleIndex === TemplateParser.RULE_htmlComment) {
        // ignore comment
        return '';
      }
      if (c.ruleIndex === TemplateParser.RULE_htmlElement) {
        // 尽管 antlr 里面已经使用 channel(HIDDEN) 而不是 skip，
        // 仍然无法通过 getText() 返回带空格的完整数据。
        // 因此此处使用 substring 直接截取。
        type = 2;
        return _visitor._source.substring(c.start.start, c.stop.stop + 1);
      }
      if (c.ruleIndex !== TemplateParser.RULE_htmlTextContent) {
        throw new Error('unimpossible?!');
      }
      if (
        c.children.find((cc) => {
          return cc.ruleIndex === TemplateParser.RULE_htmlExpr;
        })
      ) {
        type = 1;
      }
      return c.getText();
    })
    .join('')
    .trim()
    .replace(/\n\s*/g, '');
  if (type === 0) {
    const key = i18nManager.registerToDict(innerHtml, _visitor._resourcePath);
    return {
      type: 'component',
      sub: 'normal',
      value: `i18nRenderFn${sharedOptions.symbolPostfix}(component, ${JSON.stringify(key)}, ${
        _visitor._parent.type === 'component'
      })`,
    };
  }

  const args = ['component', 'vm_0', ..._visitor._vms.map((vm, i) => `vm_${i + 1}`)];
  const registerI18N = (renderOfContentNodes: string) => {
    [
      new RegExp(`[\\w\\d$_]+${sharedOptions.symbolPostfix}`, 'g'),
      new RegExp(`[\\w\\d$_]+${aliasManager.aliasPostfix}`, 'g'),
      new RegExp(`[\\w\\d$_]+${_visitor._importPostfix}`, 'g'),
    ].forEach((reg) => {
      [...renderOfContentNodes.matchAll(reg)].forEach((m) => {
        if (_visitor._i18nRenderDeps.keys.has(m[0])) return;
        _visitor._i18nRenderDeps.keys.set(m[0], true);
        const idx = i18nManager.registerRenderDep(m[0]);
        if (idx >= 0) {
          _visitor._i18nRenderDeps.codes.push(`i18n${sharedOptions.symbolPostfix}.__regDep(${idx}, ${m[0]});`);
        }
      });
    });
  };
  const key = i18nManager.registerToRender(
    innerHtml,
    _visitor._resourcePath,
    (locale, content) => {
      let contentOrNodes: ParserRuleContext[];
      if (!content) {
        contentOrNodes = defaultLocaleContentNodes;
      } else {
        const [err, tree] = parse<{ children: ParserRuleContext[] }>(content);
        if (err) {
          _visitor._webpackLoaderContext.emitError(
            new Error(`i18n parse error locale "${locale}" at ${_visitor._resourcePath}`),
          );
          contentOrNodes = defaultLocaleContentNodes;
        } else {
          contentOrNodes = tree.children;
        }
      }
      _visitor._underMode_T = true;
      // <_t> 会被转成 <I18nComponent>
      _visitor._enter(null, {
        type: 'component',
        sub: 'argument',
      });
      const renderOfContentNodes = contentOrNodes
        .map((n) => {
          return _visitor.visitHtmlNode(n);
        })
        .filter((el) => !!el)
        .map((r) => r.value)
        .join(',\n');
      _visitor._exit();
      _visitor._underMode_T = false;
      registerI18N(renderOfContentNodes);
      const renderFnCode = `function(${args.join(', ')}) { return [
${prependTab(renderOfContentNodes, true, 4)}
]}`;
      return renderFnCode;
    },
    (renderOfContentNodes) => {
      registerI18N(renderOfContentNodes);
    },
  );

  const isParentComponent = _visitor._parent.type === 'component';
  const code = replaceTpl(TPL.I18N, {
    PUSH_ELE: replaceTpl(isParentComponent ? TPL.PUSH_ROOT_ELE : TPL.PUSH_COM_ELE),
    RENDER_KEY: JSON.stringify(key),
    VMS: args.slice(1).join(', '),
  });
  return {
    type: 'component',
    sub: 'normal',
    value: code,
  };
}
