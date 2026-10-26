import { createHash } from 'node:crypto';
const email = /[A-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const obfuscatedEmail = /[A-Z0-9._%+-]+\s*(?:\[at\]|\(at\))\s*[A-Z0-9.-]+\s*(?:\[dot\]|\(dot\))\s*[A-Z]{2,}/gi;
const phone = /(?:\+82[-.\s]?0?|0)(?:1[016789]|2|[3-6][1-5]|70)[-.\s)]*\d{3,4}[-.\s]*\d{4}\b/g;
const contactKey = /(?:e[-_]?mail|phone|telephone|mobile|fax|contact|tel(?:ephone)?|연락처|전화|이메일)/i;
export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export function sanitize(input: unknown) {
  const exclusions: string[] = [];
  const visit = (value: unknown, path: string): unknown => {
    if (Array.isArray(value)) return value.map((item, i) => visit(item, `${path}[${i}]`));
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).flatMap(([key, value]) => {
      if (contactKey.test(key)) { exclusions.push(path + '.' + key); return []; }
      return [[key, visit(value, path + '.' + key)]];
    }));
    if (typeof value === 'string') {
      const clean = value.replace(email, '[contact removed]').replace(obfuscatedEmail, '[contact removed]').replace(phone, '[contact removed]').replace(/(?:mailto|tel):[^\s"'<>]+/gi, '[contact removed]');
      if (clean !== value) exclusions.push(path);
      return clean;
    }
    return value;
  };
  return { payload: visit(input, '$'), exclusions };
}
