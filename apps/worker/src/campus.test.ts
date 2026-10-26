import { expect,it } from 'vitest';
import { osmMetadata,contains } from './campus';
it('keeps geometry and useful map tags while excluding editing user identities and contacts before raw storage',()=>{
 const xml='<osm><node id="1" lat="37.45" lon="126.95" user="person" uid="42"/><node id="2" lat="37.451" lon="126.95"/><way id="3" user="person"><nd ref="1"/><nd ref="2"/><tag k="highway" v="footway"/><tag k="contact:email" v="private@example.org"/></way></osm>';
 const raw=osmMetadata(xml);expect(raw.features).toHaveLength(1);expect(raw.features[0].points).toHaveLength(2);expect(JSON.stringify(raw)).not.toMatch(/person|private|uid|email/);
});
it('uses point containment rather than nearest-building guesses',()=>{
 const ring:[number,number][]=[[0,0],[1,0],[1,1],[0,1],[0,0]];
 expect(contains([.5,.5],ring)).toBe(true);expect(contains([1.1,.5],ring)).toBe(false);
});
