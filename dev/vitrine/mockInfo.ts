export const listInfo = async () => [{ date: new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Douala' }).format(new Date()), items: [
  { scope: 'monde', title: 'Sujet monde inventé pour la vitrine', why: 'à la une de plusieurs médias (exemple)', zones: ['Monde'],
    summary: "Premier paragraphe inventé : ce qui s'est passé, où et quand.\nDeuxième paragraphe inventé : pourquoi ça compte et ce qui va suivre.",
    sources: [{ name: 'Média A', url: 'https://example.com/1' }, { name: 'Média B', url: 'https://example.com/2' }, { name: 'Média C', url: 'https://example.com/3' }] },
  { scope: 'afrique', title: 'Sujet camerounais inventé pour la vitrine', why: 'repris par plusieurs sites camerounais (exemple)', zones: ['Cameroun', 'Éco'],
    summary: "Premier paragraphe inventé.\nDeuxième paragraphe inventé, un peu plus long, pour voir la mise en page.",
    sources: [{ name: 'Média D', url: 'https://example.com/4' }, { name: 'Média E', url: 'https://example.com/5' }, { name: 'Média F', url: 'https://example.com/6' }] },
] }];
