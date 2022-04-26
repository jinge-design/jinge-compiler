export class I18nManager {
  written: boolean;
  defaultLocale: { name: string };
  assertPluginInstalled() {}
  registerToDict(text: string, resourcePath: string) {
    return '';
  }
  registerRenderDep(d: string) {
    return 0;
  }
  registerToRender(
    text: string,
    _resourcePath: string,
    cb1: (locale: string, text: string) => void,
    cb2: (code) => void,
  ) {
    return;
  }
  registerToAttr(
    text: string,
    _resourcePath: string,
    cb1: (locale: string, text: string) => void,
    cb2: (code) => void,
  ) {
    return;
  }
}

export const i18nManager = new I18nManager();
