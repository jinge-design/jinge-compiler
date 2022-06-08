export interface ParsedElement {
  type: 'html' | 'component' | 'text';
  sub?: 'argument' | 'normal' | 'parameter';
  argPass?: 'default' | string;
  value: string;
}
export interface Position {
  line: number;
  column: number;
}

export interface VM {
  name: string;
  level: number;
  reflect: string;
}

export interface Parent {
  type: 'component' | 'html';
  sub?: 'root' | 'argument' | 'parameter' | 'normal';
  vms?: VM[];
  isSVG?: boolean;
}
