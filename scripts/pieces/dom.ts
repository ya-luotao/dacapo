// A DOM for the scripts: our parser takes a `Document`, which Node does not have.

import { JSDOM } from 'jsdom';

const { window } = new JSDOM('');

export function parseXml(text: string): Document {
  return new window.DOMParser().parseFromString(text, 'application/xml');
}

export function serializeXml(node: Node): string {
  return new window.XMLSerializer().serializeToString(node);
}
