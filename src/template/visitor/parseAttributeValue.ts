import { AttributeValueParser } from '../AttributeValueParser';

export function parseAttributeValue(aval: string) {
  const es: string[] = [];
  let moreThanOne = false;
  AttributeValueParser.parse(aval).forEach((it) => {
    if (it.type === 'TEXT') {
      es.push(JSON.stringify(it.value));
    } else if (it.value) {
      es.push(moreThanOne ? `(${it.value})` : it.value);
    }
    moreThanOne = true;
  });
  return es.length > 0 ? es.join(' + ') : es[0];
}
