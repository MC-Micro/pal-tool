(() => {
  const data = window.PALWORLD_PASSIVES_DATA;
  if (!data || !Array.isArray(data.passives)) return;

  data.meta.project_version = 'v1.0.0';
  data.meta.baseline_version = 'Palworld v1.0.0';
  data.meta.data_date = '2026-07-11';
  data.meta.scope = '102 Pal-Passives · stabile PWA-Basis für Breeding und Buildplanung';
  data.meta.layout = 'v1.0.0: stabile PWA-Basis; Filter startet geschlossen; aktive Filterchips sind scrollbar und direkt entfernbar.';

  const byName = new Map(data.passives.map(passive => [passive.de, passive]));
  const patch = (name, changes) => {
    const passive = byName.get(name);
    if (!passive) throw new Error(`Passive nicht gefunden: ${name}`);
    Object.assign(passive, changes);
  };

  patch('Motivationscoach', {
    explain: 'Erhöht dein Arbeitstempo als Spieler um 25 %. Der Pal selbst arbeitet dadurch nicht schneller. Besonders nützlich, wenn du häufig selbst baust, herstellst oder Arbeiten in der Basis unterstützt.',
    notes: 'Betrifft den Spieler, nicht das Arbeitstempo des Pals.',
    quality: 'ok'
  });

  patch('Ausdauerprofi', {
    explain: 'Reduziert den Ausdauerverbrauch des Spielers um 5 %. Dadurch kannst du länger sprinten, klettern, gleiten und andere ausdauerabhängige Aktionen ausführen. Die Reitausdauer eines Mounts wird dadurch nicht erhöht.',
    notes: 'Betrifft die Ausdauer des Spielers, nicht die Mount-Ausdauer.',
    quality: 'ok'
  });

  patch('Teichfürst', {
    explain: 'Erhöht Wasser- und Eisangriffsschaden jeweils um 20 % und zusätzlich die Verteidigung um 20 %. Besonders stark für passende Wasser-/Eis-Kampf-Pals, die gleichzeitig mehr Schaden verursachen und robuster werden sollen.',
    notes: 'Kombiniert zwei Elementboni mit einem Verteidigungsbonus.',
    quality: 'ok'
  });

  patch('Unerforschte Zellen', {
    effect_de: 'Angriff +10 %; eingehender Feuerschaden -15 %; eingehender Blitzschaden -15 %.',
    explain: 'Erhöht den Angriff und reduziert gleichzeitig eingehenden Feuer- und Blitzschaden. Die blauen Minuswerte stehen hier für Schadensreduktion und sind kein negativer Tradeoff.',
    notes: 'Positiver offensiv-defensiver Mischbuff.',
    quality: 'ok'
  });

  patch('Vampir', {
    effect_de: 'Absorbiert einen Teil des ausgeteilten Schadens und wandelt ihn in LP um; schläft nachts nicht und arbeitet weiter.',
    explain: 'Der Pal erhält Lebensraub: Ein nicht genauer bezifferter Teil des verursachten Schadens wird in eigene LP umgewandelt. Zusätzlich schläft er nachts nicht und kann in der Basis weiterarbeiten.',
    notes: 'Der Tooltip nennt keinen konkreten Prozentsatz für die LP-Wiederherstellung.',
    quality: 'ok'
  });

  patch('Selbstlos', {
    notes: 'Erhöht die eigene Beutemenge um 100 %; der Grundeffekt gilt als ausreichend geklärt.',
    quality: 'ok'
  });

  patch('Spendabel', {
    notes: 'Erhöht die eigene Beutemenge um 50 %; der Grundeffekt gilt als ausreichend geklärt.',
    quality: 'ok'
  });

  patch('Nachteule', {
    notes: 'Bleibt nachts wach und holt Schlaf tagsüber nach; für Nachtbetrieb situativ sinnvoll.',
    quality: 'ok'
  });
})();