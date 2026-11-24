import { describe, it, expect, vi } from 'vitest';
vi.mock('../api/_lib/admin.js', () => ({ adminDb: {} }));
import { parseFeed, clean } from '../api/_lib/veille';

const feed = { media: 'Test', zone: 'monde' as const, url: 'https://x.test/rss' };

describe('veille des médias', () => {
  it('lit un flux RSS 2.0', () => {
    const xml = `<rss><channel><item><title><![CDATA[Un titre &amp; un autre]]></title><link>https://x.test/a</link><pubDate>Mon, 23 Nov 2026 10:00:00 GMT</pubDate><description>&lt;p&gt;Un chapô&lt;/p&gt;</description></item></channel></rss>`;
    const [i] = parseFeed(xml, feed);
    expect(i.title).toBe('Un titre & un autre');
    expect(i.link).toBe('https://x.test/a');
    expect(i.date).toBe('2026-11-23T10:00:00.000Z');
    expect(i.desc).toBe('Un chapô');
  });
  it('lit un flux Atom', () => {
    const xml = `<feed><entry><title>Atome</title><link href="https://x.test/b"/><updated>2026-11-23T08:00:00Z</updated><summary>Résumé</summary></entry></feed>`;
    expect(parseFeed(xml, feed)[0]).toMatchObject({ title: 'Atome', link: 'https://x.test/b' });
  });
  it('ignore les liens non https', () => {
    expect(parseFeed('<rss><item><title>T</title><link>http://x.test</link></item></rss>', feed)).toEqual([]);
  });
  it('nettoie les entités', () => expect(clean('l&rsquo;&eacute;t&#233; &laquo;a&raquo;')).toBe('l’été «a»'));
});
