export const KNOWN_ATTR_TYPES = [
  /* bellow is parameter related attribute types */
  /* s is just alias of str */
  'expr',
  'e',
  'str',
  's',
  /* bellow is message/event related attribute type */
  'on',
  /* bellow is compiler related attribute types */
  'vm',
  'vm-pass',
  'vm-use',
  'slot-pass',
  'slot-use',
  'ref',
  /* translate attribute */
  '_t',
];

export const HTML_BOOL_IDL_ATTRS = {
  autocomplete: {
    tags: ['form', 'input'],
  },
  autofocus: {
    tags: ['button', 'input', 'select', 'textarea'],
  },
  autoplay: {
    tags: ['audio', 'video'],
  },
  controls: {
    tags: ['audio', 'video'],
  },
  disabled: {
    tags: ['a', 'button', 'fieldset', 'input', 'optgroup', 'option', 'select', 'textarea'],
  },
  readonly: {
    tags: ['input', 'textarea'],
    reflect: 'readOnly',
  },
  required: {
    tags: ['input', 'textarea', 'select'],
  },
  checked: {
    tags: ['input'],
  },
  selected: {
    tags: ['option'],
  },
  multiple: {
    tags: ['input', 'select'],
  },
  muted: {
    tags: ['video', 'audio'],
  },
  draggable: {
    tags: '*',
  },
};

/**
 * common idl attrs(but no all)
 */
export const HTML_COMMON_IDL_ATTRS = {
  value: {
    tags: ['button', 'input', 'option', 'progress', 'select'],
  },
};
