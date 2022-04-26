import { join } from 'path';
import { Compiler } from 'webpack';
import { sharedOptions, SharedOptions } from './options';
import { i18nManager } from './i18n';

const PLUGIN_NAME = 'JINGE_I18N_PLUGIN';
export class JingeWebpackI18NPlugin {
  #opts: SharedOptions['i18n'];

  constructor(options: SharedOptions['i18n']) {
    if (!options.defaultLocale || !options.targetLocales?.length) {
      throw new Error('JingeWebpackI18NPlugin: options require "defaultLocale" and non-empty "targetLocales".');
    }
    this.#opts = {
      idBaseDir: process.cwd(),
      translateDir: join(process.cwd(), 'translate'),
      extractMode: false,
      ...options,
    };
    sharedOptions.i18n = this.#opts;
  }

  apply(compiler: Compiler) {
    compiler.hooks.compilation.tap(PLUGIN_NAME, (compilation) => {
      if (compilation.compiler.parentCompilation) {
        return;
      }
      i18nManager.webpackCompilationWarnings = compilation.warnings;
      compilation.hooks.additionalAssets.tap(PLUGIN_NAME, () => {
        i18nManager.writeOutput(compilation);
      });
    });
  }
}
