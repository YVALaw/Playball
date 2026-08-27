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
      body: 'Welcome to the office, skipper. PLAY BALL puts you in the dugout '
        + 'tonight. SIM GAME lets the boys handle one without you, and SIM '
        + 'WEEK burns through the whole week while you sip your coffee.',
    },
    {
      title: 'Scout the other guys',
      body: 'That card up top is tonight’s opponent: their record, their '
        + 'ranking, and which arm they’re running out there. Tap it and read '
        + 'up. Nobody ever lost a game by knowing too much.',
    },
  ],
  wire: [
    {
      title: 'The morning paper',
      body: 'Ninety-six programs play every night and you can only be at one '
        + 'ballpark. This is where the rest of the country brags. Every word '
        + 'in here actually happened, which is more than most papers can say.',
    },
  ],
  roster: [
    {
      title: 'Your twenty-three',
      body: 'OVR is what a man is, POT is what he might become if the baseball '
        + 'gods are kind. Seniors walk in June no matter what, and juniors '
        + 'walk if the draft comes calling. Tap a row to meet the man.',
    },
  ],
  lineup: [
    {
      title: 'The lineup card',
      body: 'Tap two spots and they trade places. Or hit AUTO and let the '
        + 'bench coach pencil in a sensible card, best bat third, big fella '
        + 'cleanup. The engine reads this card straight, so it counts tonight.',
    },
    {
      title: 'The staff',
      body: 'Your Friday arm is the ace. He opens every weekend series, and '
        + 'the MID man eats all the midweek innings. The arrows shuffle the '
        + 'pecking order. Keep the pen rested and it will keep you employed.',
    },
  ],
  stats: [
    {
      title: 'The numbers',
      body: 'Leaders from around the country or just your clubhouse, plus the '
        + 'glove work under FIELDING. One tip: fewest errors just means '
        + 'nobody hits it to you. Plays above average is the honest number.',
    },
  ],
  season: [
    {
      title: 'The long haul',
      body: 'Forty-five games: eleven weekend series in the conference and '
        + 'twelve midweek dates. Finish top six of your twelve and you play '
        + 'June baseball. Finish seventh and you get very good at golf.',
    },
  ],
  program: [
    {
      title: 'The front office',
      body: 'The board’s wish list, with live check marks as you deliver. '
        + 'Clear it and they extend you. Miss it and the seat gets warm. '
        + 'HISTORY keeps this school’s whole story, every coach included.',
    },
  ],
  coach: [
    {
      title: 'Your card',
      body: 'Coach Prestige is your name around the country. It decides which '
        + 'phones ring when jobs open up. The record, the skills and the '
        + 'hardware all travel with you, wherever the road goes.',
    },
  ],
  manage: [
    {
      title: 'You make the calls',
      body: 'Your calls sit on the right, and the grey ones tell you why '
        + 'they’re off the table. SWING AWAY never hurt anybody. BULLPEN and '
        + 'PINCH HIT spend a man for the night, so spend him like you mean it.',
    },
    {
      title: 'Watch the field',
      body: 'The park plays the at-bat out for you: the ball goes where it '
        + 'went and the defense chases it. SIM THE REST hands the clipboard '
        + 'to the bench coach for good, so save it for the blowouts.',
    },
  ],
  postseason: [
    {
      title: 'How June works',
      body: 'Three championships, stacked. Eight of your twelve make the '
        + 'conference tournament, double elimination, so one bad night drops '
        + 'you to the losers bracket instead of the bus home. Finish top four '
        + 'and you move on.',
    },
    {
      title: 'Regionals and the big dance',
      body: 'Top four finishers play a best of three against the conference '
        + 'next door. Sixteen regional champions plus four protected bids '
        + 'make the twenty team national field: seeds 13 to 20 play in, the '
        + 'sixteen split into two brackets, and the last two play for it all.',
    },
    {
      title: 'The toggle is your friend',
      body: 'WINNERS shows who is alive the easy way, LOSERS shows who is '
        + 'alive the hard way. Finish in the top four of the regular season '
        + 'nationally and your national bid is protected whatever June does.',
    },
  ],
  awards: [
    {
      title: 'Hardware night',
      body: 'The country hands out its trophies: the best bat, the best arm, '
        + 'the best freshman, and the coach who squeezed the most out of the '
        + 'least. Tap a winner to see the season that earned it.',
    },
  ],
  review: [
    {
      title: 'The board meeting',
      body: 'The year, graded. The board checks its list, moves your prestige '
        + 'and decides how they feel about you. Every number on this page is '
        + 'a door, so tap around before you move on.',
    },
  ],
  coachpoints: [
    {
      title: 'Winter school',
      body: 'Points from the season just played. Spend them on your four '
        + 'skills, and take one back if you fat-finger it. Once you leave '
        + 'this step the ink dries.',
    },
  ],
  draftphase: [
    {
      title: 'Draft day',
      body: 'The pros came shopping. KEEP shows your men with one foot out '
        + 'the door. Tap one to make your pitch, and it costs real recruiting '
        + 'money whether he stays or not. Sweet-talking isn’t free.',
    },
  ],
  recruiting: [
    {
      title: 'Three weeks in November',
      body: 'Fifty points a week, spread across the kids you want. Points '
        + 'carry over and the biggest pile usually signs him. The clock only '
        + 'moves when you end the week, so shop around first.',
    },
    {
      title: 'Reading the reports',
      body: 'Those numbers are your scout’s guess, not gospel. The band '
        + 'tightens as your RECRUITING skill grows. Kids from your home '
        + 'state pick up the phone a rung earlier. Use that.',
    },
  ],
  signing: [
    {
      title: 'Signing day',
      body: 'The letters are in and the physicals are real, so now you find '
        + 'out what you actually bought. Walk-ons fill whatever the class '
        + 'didn’t. They play one year and vanish like a September call-up.',
    },
  ],
};
