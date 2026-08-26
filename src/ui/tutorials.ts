// tutorials.ts
// Everything the game teaches on a first visit, in one place.
//
// One entry per screen id. Adding a tutorial is adding an entry here and a
// `<FirstVisit id="…" />` to the screen — nothing else. The copy rules: one to
// three short pages, each page one idea, written in the game's own voice, and
// nothing here that the screen cannot live without — labels, state and
// validation stay on the screen itself.

export interface TutorialPage {
  title: string;
  body: string;
}

export const TUTORIALS: Record<string, readonly TutorialPage[]> = {
  today: [
    {
      title: 'Your desk',
      body: 'Everything runs through here. PLAY BALL takes the dugout for '
        + 'tonight’s game, SIM GAME plays the day without you, and SIM WEEK '
        + 'runs the whole week — the midweek game and the weekend series.',
    },
    {
      title: 'The card above the buttons',
      body: 'That is tonight’s opponent: their record, the ranking, the '
        + 'probable arms. Tap it to read their whole program before you decide '
        + 'how much tonight deserves you.',
    },
  ],
  wire: [
    {
      title: 'The paper',
      body: 'Ninety-six programs play every night and this is how you hear '
        + 'about the other ninety-five. Everything printed here actually '
        + 'happened — upsets, streaks, sweeps, and whoever is hitting.',
    },
  ],
  roster: [
    {
      title: 'Your twenty-three',
      body: 'OVR is where a man is now, POT a letter for where he could end '
        + 'up. Seniors leave in June whatever happens; juniors leave if the '
        + 'draft wants them. Tap any row for the whole player.',
    },
  ],
  lineup: [
    {
      title: 'The lineup card',
      body: 'Tap two spots to swap them, or let AUTO deal a sound order in one '
        + 'press — you can still adjust by hand after. The engine reads this '
        + 'card directly: a change here changes tonight.',
    },
    {
      title: 'The rotation',
      body: 'Your Friday arm starts the opener of every conference series, '
        + 'and the MID slot takes all twelve non-conference games. The arrows '
        + 'reorder who takes the ball.',
    },
  ],
  stats: [
    {
      title: 'The numbers',
      body: 'Leaders across the country or just your team — and the glove '
        + 'work lives here too. Fielding is ranked on plays made above an '
        + 'average glove, not on errors: fewest errors just means nobody hits '
        + 'it to you.',
    },
  ],
  season: [
    {
      title: 'The season',
      body: 'Forty-five games: eleven weekend conference series and twelve '
        + 'midweek games. The top six of your twelve-team conference make the '
        + 'tournament in June — the CONFERENCE and NATIONAL tabs show where '
        + 'you stand.',
    },
  ],
  program: [
    {
      title: 'The program',
      body: 'The board’s mandate, with live ticks as you meet it. Miss it '
        + 'and your seat gets warm; clear it and they extend. HISTORY holds '
        + 'this school’s own past — every season it has played, whoever '
        + 'was coaching it.',
    },
  ],
  coach: [
    {
      title: 'You',
      body: 'Coach Prestige is what the country thinks of you — it decides '
        + 'whose call you get when jobs open. Your career, your skills and '
        + 'your trophy case all live here, and they follow you between jobs.',
    },
  ],
  manage: [
    {
      title: 'You call, they play',
      body: 'Your calls are on the right — greyed ones tell you why they '
        + 'are off. SWING AWAY is never wrong. BULLPEN and PINCH HIT spend '
        + 'men for the night; SIM THE REST hands the game to the bench coach '
        + 'for good.',
    },
  ],
};
