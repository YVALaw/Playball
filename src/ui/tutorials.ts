// tutorials.ts
// Everything the game teaches on a first visit, in one place.
//
// One entry per screen id. Adding a tutorial is adding an entry here and a
// `<FirstVisit id="…" />` to the screen. The copy rules: one to three short
// pages, each page one idea, written like a bench coach who likes you, and
// nothing here that the screen cannot live without. Labels, state and
// validation stay on the screen itself. House style: no dashes, keep it wry,
// keep it baseball.

export interface TutorialPage {
  title: string;
  body: string;
}

export const TUTORIALS: Record<string, readonly TutorialPage[]> = {
  today: [
    {
      title: 'Your desk',
      body: 'Welcome to the office, skipper. Tonight will not play itself, '
        + 'unless you ask it to.',
    },
    {
      title: 'Scout the other guys',
      body: 'Tap tonight’s opponent and read up. Nobody ever lost a game by '
        + 'knowing too much.',
    },
  ],
  wire: [
    {
      title: 'The morning paper',
      body: 'Ninety-six programs play every night; this is where the rest of '
        + 'the country brags. Every word in here actually happened, which is '
        + 'more than most papers can say.',
    },
  ],
  roster: [
    {
      title: 'Your twenty-three',
      body: 'OVR is what a man is, POT is what he might become if the baseball '
        + 'gods are kind. Seniors walk in June; juniors walk if the draft '
        + 'calls.',
    },
  ],
  lineup: [
    {
      title: 'The lineup card',
      body: 'This card counts; the engine reads it straight tonight. Tap two men to move them; hold any player to open his stats without leaving the decision.',
    },
    {
      title: 'The staff',
      body: 'Friday is the ace’s ball. Keep the pen rested and it will keep '
        + 'you employed.',
    },
  ],
  stats: [
    {
      title: 'The numbers',
      body: 'One tip on the glove work: fewest errors just means nobody hits '
        + 'it to you. Plays above average is the honest number.',
    },
  ],
  season: [
    {
      title: 'The long haul',
      body: 'Forty-five games. Finish top eight of your twelve and you play '
        + 'June baseball; finish ninth and you get very good at golf.',
    },
  ],
  program: [
    {
      title: 'The front office',
      body: 'The board’s wish list, with live check marks. Clear it and they '
        + 'extend you; miss it and the seat gets warm.',
    },
  ],
  coach: [
    {
      title: 'Your card',
      body: 'Coach Prestige is your name around the country. It decides which '
        + 'phones ring, and it travels with you wherever the road goes.',
    },
  ],
  manage: [
    {
      title: 'You make the calls',
      body: 'Your calls sit under the log, and the greyed ones say why they '
        + 'are off the table. The round button holds the bench, the pen and '
        + 'the mound.',
    },
  ],
  postseason: [
    {
      title: 'How June works',
      body: 'Three championships, stacked. The conference tournament is '
        + 'double elimination: one bad night drops you to the losers bracket, '
        + 'not the bus home.',
    },
    {
      title: 'Regionals and the big dance',
      body: 'Finish top four and you go regional, a best of three against the '
        + 'conference next door. Win that and you are one of twenty playing '
        + 'for it all.',
    },
    {
      title: 'The safety net',
      body: 'Finish top four in the country over the regular season and your '
        + 'national bid is protected, whatever June does.',
    },
  ],
  awards: [
    {
      title: 'Hardware night',
      body: 'The country hands out its trophies, including one for the coach '
        + 'who squeezed the most out of the least. Tap a winner to read the '
        + 'season behind it.',
    },
  ],
  review: [
    {
      title: 'The board meeting',
      body: 'The year, graded. Every number on this page is a door, so tap '
        + 'around before you move on.',
    },
  ],
  coachpoints: [
    {
      title: 'Winter school',
      body: 'Points from the season just played. Once you leave this step '
        + 'the ink dries.',
    },
  ],
  draftphase: [
    {
      title: 'Draft day',
      body: 'The pros came shopping. Making a pitch costs real recruiting '
        + 'points whether he stays or not; sweet-talking is never free.',
    },
  ],
  recruiting: [
    {
      title: 'Three weeks in November',
      body: 'Interest builds over the three weeks, and unspent points vanish '
        + 'at the bell. The clock only moves when you end the week, so shop '
        + 'around first.',
    },
  ],
  signing: [
    {
      title: 'Signing day',
      body: 'The letters are in, so now you find out what you actually '
        + 'bought. Walk-ons fill whatever the class did not, for a year, and '
        + 'then they vanish.',
    },
  ],
};
