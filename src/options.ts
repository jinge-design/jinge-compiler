import { WebpackOptionsNormalized } from 'webpack';
import { isObject, isUndefined } from './util';

export interface SharedOptions {
  compress?: boolean;
  publicPath?: string;
  /** 用于解决潜在冲突的变量名后缀。通常不需要指定该参数，由编译器自动处理。 */
  symbolPostfix?: string;
  /** 国际化配置，启用该参数项后可支持多语言 */
  i18n?: {
    /** 代码里使用的默认源语言 */
    defaultLocale: string;
    /** 需要翻译支持的目标语言，至少指定一种。 */
    targetLocales: { 0: string } & string[];
    /** 存放源语言文案和翻译文案的文件目录，默认为项目根目录下的 translate 目录 */
    translateDir?: string;
    /** 是否开启抽取文案模式。需要抽取文案后，才能进行翻译和构建。 */
    extractMode?: boolean;
    /** 翻译文案的位置路径的 base dir，默认为项目根目录，通常不需要修改 */
    idBaseDir?: string;
  };
}

export const sharedOptions: SharedOptions = {};

export function checkCompressOption(webpackOptions: WebpackOptionsNormalized) {
  const optimization = webpackOptions.optimization;
  let needComporess = webpackOptions.mode === 'production';
  if (isObject(optimization) && !isUndefined(optimization.minimize)) {
    needComporess = !!optimization.minimize;
  }
  return needComporess;
}
