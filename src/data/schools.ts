// schools.ts
// The world. Eight regions, twelve programs each, ninety six in all.
//
// Fictional, per the locked decision in 01-roadmap.md, and frozen once written:
// a dynasty save refers to these schools by abbreviation, so this is data, not
// something to regenerate.
//
// ---------------------------------------------------------------------------
// Why sixty four and not a hundred and ninety two
// ---------------------------------------------------------------------------
//
// The old world had sixteen conferences of twelve, and nobody could recognise a
// single program in it. That is not a failure of the names, it is arithmetic. A
// 33 game season against a twelve team league meant eight series out of eleven
// possible opponents, so you never even played three of your own conference in a
// given year, and the other 180 schools were rows in a table you scrolled past.
//
// Eight conferences of eight fixes both ends of that:
//
//   11 conference opponents x 3 game series = 33
//   + 12 non-conference midweek games       = 45
//
// A **full round robin**. You play every team in your region every single
// season. After one year you know all eleven. After three you have a history.
//
// Twelve rather than eight so that making the conference tournament means
// something: six of twelve get in, so half the league goes home in May. At eight
// the cut was two teams and finishing seventh cost you nothing you could feel.
//
// ---------------------------------------------------------------------------
// Region is the conference
// ---------------------------------------------------------------------------
//
// The old data had sixteen conference names sitting inside six regions, which
// meant memorising two layers: that the Highland League is in the West, that the
// Piedmont Athletic is in the South. So the layers are collapsed. The conference
// *is* the region. The Gulf is a place and a league and a chip on a screen, and
// you never have to look up which is which.
//
// Power follows climate, the way it really does in this sport. The best programs
// sit in the warm south and west, where teams practise outdoors in January. The
// Gulf, the Atlantic and the Pacific are the power leagues; the Great Lakes, the
// Mountains and the Northeast play in the cold and produce fewer contenders.
// That gives the map a meaning you can read at a glance, and it gives a career a
// direction: climbing usually means moving south.
//
// ---------------------------------------------------------------------------
// Two numbers, not one
// ---------------------------------------------------------------------------
//
// `prestige` is what the school **is**: decades of history, facilities, what the
// name means to a recruit. It moves slowly and it survives you.
//
// `quality` is what this year's roster can **do**. It moves every year.
//
// They are deliberately not the same number. When they were, every program was
// exactly as good as its reputation, which quietly made the interesting job
// impossible: no sleeping giants, no overachievers, nothing to discover. Now
// every conference carries the same cast in different costumes.
//
//   the blueblood       high prestige, high roster. The job everyone wants.
//   the sleeping giant  proud school, gutted roster. Huge expectations, no
//                       talent. Also the one way an unknown coach gets a big
//                       name job, because nobody established will touch it.
//   the contender       good, and knows it.
//   the upstart         modest name, loaded roster. A window that closes.
//   the fading power    living off a decade ago.
//   the doormat         where careers start.

export type Region =
  | 'Gulf' | 'Atlantic' | 'Pacific' | 'Heartland'
  | 'Desert' | 'Great Lakes' | 'Mountain' | 'Northeast';

/**
 * Every state a program or a recruit can be from, grouped by region.
 *
 * Recruiting reads this two ways: a shared state is a pipeline and a real edge,
 * a shared region is a weaker version of the same pull. Regions do not hold the
 * same number of states, and that is the point — talent is not spread evenly,
 * and a filter that says "from Louisiana" means something a filter that says
 * "from one of eight slices of the country" never can.
 */
export const STATES_BY_REGION: Record<Region, readonly string[]> = {
  Gulf: ['LA', 'MS', 'AL', 'TX'],
  Atlantic: ['NC', 'SC', 'GA', 'FL', 'VA'],
  Pacific: ['CA', 'OR', 'WA'],
  Heartland: ['IA', 'NE', 'KS', 'MO', 'OK'],
  Desert: ['AZ', 'NM', 'NV', 'UT'],
  'Great Lakes': ['OH', 'MI', 'IL', 'IN', 'WI'],
  Mountain: ['CO', 'ID', 'MT', 'WY'],
  Northeast: ['NY', 'PA', 'MA', 'CT', 'NJ'],
};

/** Flat list of every state, for the recruiting filter. */
export const ALL_STATES: readonly string[] =
  [...new Set(Object.values(STATES_BY_REGION).flat())].sort();

/** Which region a state belongs to. */
export const REGION_OF_STATE: Record<string, Region> = Object.fromEntries(
  (Object.entries(STATES_BY_REGION) as [Region, readonly string[]][])
    .flatMap(([region, states]) => states.map((st) => [st, region] as const)),
);

export interface SchoolDef {
  /** Unique across the world. Used in standings, box scores, and saves. */
  readonly abbr: string;
  readonly school: string;
  readonly nickname: string;
  /** What this year's roster can do. 0 to 100, the player rating scale. */
  readonly quality: number;
  /** What the school is, built over decades. Moves slowly. */
  readonly prestige: number;
  /** Primary colour, for standings and the scoreboard. */
  readonly color: string;
  /** The game circled on the calendar. Always inside the conference. */
  readonly rival: string;
  /**
   * Where the program is.
   *
   * Recruiting needs somewhere finer than a region: "close to home" reads as a
   * real advantage when it means the next town over and as noise when it means
   * one of eight slices of the country. A shared state is the pipeline; a shared
   * region is a weaker version of the same thing.
   */
  readonly state: string;
}

export interface ConferenceDef {
  readonly id: string;
  readonly name: string;
  readonly region: Region;
  /** 1 is a power conference, 3 is the bottom of the world. */
  readonly tier: 1 | 2 | 3;
  /** One line that tells a newcomer what this league is. */
  readonly blurb: string;
  readonly schools: readonly SchoolDef[];
}

export const CONFERENCES: readonly ConferenceDef[] = [
  {
    id: 'GULF',
    name: 'Gulf Coast Conference',
    region: 'Gulf',
    tier: 1,
    blurb: 'The best baseball in the country. Hot, loud, and unforgiving.',
    schools: [
      { abbr: 'BAY', school: 'Bayou State', nickname: 'Pelicans', quality: 66, prestige: 78, color: '#7a1f2b', rival: 'DLT', state: 'LA' },
      { abbr: 'MOB', school: 'Mobile Bay', nickname: 'Mariners', quality: 51, prestige: 71, color: '#1c3f6e', rival: 'BIL', state: 'MS' },
      { abbr: 'DLT', school: 'Delta A&M', nickname: 'Riverhawks', quality: 63, prestige: 64, color: '#2f6b4f', rival: 'BAY', state: 'AL' },
      { abbr: 'THB', school: 'Thibodaux State', nickname: 'Herons', quality: 55, prestige: 56, color: '#4a5c8a', rival: 'GLP', state: 'TX' },
      { abbr: 'GLP', school: 'Gulfport', nickname: 'Stormcats', quality: 44, prestige: 52, color: '#5b4a7a', rival: 'THB', state: 'LA' },
      { abbr: 'PSC', school: 'Pascagoula Tech', nickname: 'Ironmen', quality: 61, prestige: 47, color: '#5a5f66', rival: 'LKC', state: 'TX' },
      { abbr: 'LKC', school: 'Lake Charles', nickname: 'Drillers', quality: 46, prestige: 43, color: '#8a5a1f', rival: 'PSC', state: 'MS' },
      { abbr: 'BIL', school: 'Biloxi Coast', nickname: 'Sandpipers', quality: 38, prestige: 36, color: '#2b6f77', rival: 'MOB', state: 'AL' },
      { abbr: 'ATF', school: 'Atchafalaya State', nickname: 'Basin Cats', quality: 40, prestige: 33, color: '#4a6b4a', rival: 'PTA', state: 'LA' },
      { abbr: 'PTA', school: 'Port Arthur', nickname: 'Longshoremen', quality: 35, prestige: 30, color: '#2b5f6b', rival: 'ATF', state: 'TX' },
      { abbr: 'HTB', school: 'Hattiesburg', nickname: 'Timberjacks', quality: 31, prestige: 27, color: '#6b5a3a', rival: 'SEL', state: 'MS' },
      { abbr: 'SEL', school: 'Selma Forge', nickname: 'Anvils', quality: 27, prestige: 23, color: '#4a4a52', rival: 'HTB', state: 'AL' },
    ],
  },
  {
    id: 'ATL',
    name: 'Atlantic Coast League',
    region: 'Atlantic',
    tier: 1,
    blurb: 'Old money, old rivalries, and a fanbase that expects Omaha.',
    schools: [
      { abbr: 'PIE', school: 'Piedmont State', nickname: 'Cardinals', quality: 68, prestige: 78, color: '#8c1c2b', rival: 'NEU', state: 'NC' },
      { abbr: 'CHS', school: 'Charleston Harbor', nickname: 'Admirals', quality: 52, prestige: 70, color: '#1b3a5c', rival: 'SAV', state: 'SC' },
      { abbr: 'TAM', school: 'Tampa Bay Tech', nickname: 'Stingrays', quality: 65, prestige: 63, color: '#237a7a', rival: 'JAX', state: 'GA' },
      { abbr: 'NEU', school: 'Neuse Valley', nickname: 'Millers', quality: 54, prestige: 55, color: '#4a3f6b', rival: 'PIE', state: 'FL' },
      { abbr: 'ASH', school: 'Asheville Ridge', nickname: 'Highlanders', quality: 44, prestige: 51, color: '#3f5c3a', rival: 'OKE', state: 'VA' },
      { abbr: 'SAV', school: 'Savannah River', nickname: 'Marsh Hawks', quality: 60, prestige: 45, color: '#6b5a2b', rival: 'CHS', state: 'FL' },
      { abbr: 'JAX', school: 'Jacksonville Shore', nickname: 'Anchors', quality: 47, prestige: 44, color: '#1f5f8a', rival: 'TAM', state: 'NC' },
      { abbr: 'OKE', school: 'Okefenokee State', nickname: 'Swampfoxes', quality: 37, prestige: 35, color: '#3a4a2f', rival: 'ASH', state: 'GA' },
      { abbr: 'CPF', school: 'Cape Fear', nickname: 'Privateers', quality: 39, prestige: 32, color: '#1f4a6b', rival: 'SNB', state: 'NC' },
      { abbr: 'ALT', school: 'Altamaha State', nickname: 'Cottonmouths', quality: 34, prestige: 29, color: '#3f5a2b', rival: 'OCL', state: 'GA' },
      { abbr: 'SNB', school: 'Sandbridge', nickname: 'Dunerunners', quality: 30, prestige: 26, color: '#7a6b4a', rival: 'CPF', state: 'VA' },
      { abbr: 'OCL', school: 'Ocala Flats', nickname: 'Ospreys', quality: 41, prestige: 24, color: '#5a3f5a', rival: 'ALT', state: 'FL' },
    ],
  },
  {
    id: 'PAC',
    name: 'Pacific Coast Conference',
    region: 'Pacific',
    tier: 1,
    blurb: 'Warm weather, big crowds, and pitching that travels in June.',
    schools: [
      { abbr: 'RID', school: 'Ridgemont State', nickname: 'Kestrels', quality: 67, prestige: 76, color: '#1f4d3f', rival: 'BRK', state: 'CA' },
      { abbr: 'BRK', school: 'Bracken State', nickname: 'Ravens', quality: 53, prestige: 69, color: '#2b2f3a', rival: 'RID', state: 'OR' },
      { abbr: 'MBT', school: 'Marbury Tech', nickname: 'Engineers', quality: 64, prestige: 62, color: '#7a4a1f', rival: 'PIN', state: 'WA' },
      { abbr: 'PIN', school: 'Pinecrest State', nickname: 'Pioneers', quality: 56, prestige: 57, color: '#3f5f2b', rival: 'MBT', state: 'CA' },
      { abbr: 'CAL', school: 'Calloway', nickname: 'Miners', quality: 45, prestige: 52, color: '#6b5b1f', rival: 'OAK', state: 'CA' },
      { abbr: 'OAK', school: 'Oakhurst', nickname: 'Owls', quality: 47, prestige: 45, color: '#5a4a3a', rival: 'CAL', state: 'WA' },
      { abbr: 'VER', school: 'Verdugo', nickname: 'Condors', quality: 59, prestige: 44, color: '#8a2f4a', rival: 'SUT', state: 'OR' },
      { abbr: 'SUT', school: 'Sutter Valley', nickname: 'Vaqueros', quality: 39, prestige: 36, color: '#8a6a2b', rival: 'VER', state: 'CA' },
      { abbr: 'CSC', school: 'Cascadia Tech', nickname: 'Sawyers', quality: 37, prestige: 33, color: '#2f5a4a', rival: 'KLM', state: 'WA' },
      { abbr: 'SLS', school: 'Salinas Coast', nickname: 'Growers', quality: 42, prestige: 30, color: '#6b7a3a', rival: 'MOJ', state: 'CA' },
      { abbr: 'KLM', school: 'Klamath Falls', nickname: 'Trappers', quality: 33, prestige: 27, color: '#5a4a2b', rival: 'CSC', state: 'OR' },
      { abbr: 'MOJ', school: 'Mojave State', nickname: 'Jackrabbits', quality: 29, prestige: 24, color: '#8a7a5a', rival: 'SLS', state: 'CA' },
    ],
  },
  {
    id: 'HRT',
    name: 'Heartland Conference',
    region: 'Heartland',
    tier: 2,
    blurb: 'Wind, dirt, and small towns that take the local nine seriously.',
    schools: [
      { abbr: 'PLT', school: 'Platte Valley', nickname: 'Sodbusters', quality: 60, prestige: 68, color: '#7a3f1f', rival: 'KEA', state: 'IA' },
      { abbr: 'OZK', school: 'Ozark State', nickname: 'Bruins', quality: 46, prestige: 62, color: '#3a2f2b', rival: 'LWR', state: 'NE' },
      { abbr: 'WIC', school: 'Wichita Plains', nickname: 'Cyclones', quality: 58, prestige: 55, color: '#4a5a6b', rival: 'SLN', state: 'KS' },
      { abbr: 'LWR', school: 'Lawrence Tech', nickname: 'Prospectors', quality: 48, prestige: 49, color: '#5f4a2b', rival: 'OZK', state: 'MO' },
      { abbr: 'KEA', school: 'Kearney State', nickname: 'Antelopes', quality: 40, prestige: 46, color: '#6b6b3a', rival: 'PLT', state: 'OK' },
      { abbr: 'CDR', school: 'Cedar Falls', nickname: 'Hawks', quality: 54, prestige: 40, color: '#2b4a6b', rival: 'DUB', state: 'MO' },
      { abbr: 'DUB', school: 'Dubuque River', nickname: 'Riverboats', quality: 42, prestige: 40, color: '#3f6b5f', rival: 'CDR', state: 'KS' },
      { abbr: 'SLN', school: 'Salina', nickname: 'Wheatkings', quality: 35, prestige: 33, color: '#8a7a3a', rival: 'WIC', state: 'IA' },
      { abbr: 'CHK', school: 'Chickasha', nickname: 'Drovers', quality: 36, prestige: 30, color: '#7a5a2b', rival: 'SDL', state: 'OK' },
      { abbr: 'RDO', school: 'Red Oak', nickname: 'Threshers', quality: 32, prestige: 27, color: '#8a5f3a', rival: 'MRL', state: 'IA' },
      { abbr: 'MRL', school: 'Marysville', nickname: 'Grainmen', quality: 28, prestige: 24, color: '#6b6b4a', rival: 'RDO', state: 'KS' },
      { abbr: 'SDL', school: 'Sedalia', nickname: 'Railmen', quality: 39, prestige: 22, color: '#3a4a5a', rival: 'CHK', state: 'MO' },
    ],
  },
  {
    id: 'DES',
    name: 'Desert Conference',
    region: 'Desert',
    tier: 2,
    blurb: 'Dry air, thin pitching, and scores that get out of hand.',
    schools: [
      { abbr: 'SON', school: 'Sonora State', nickname: 'Coyotes', quality: 59, prestige: 67, color: '#8a4a1f', rival: 'TUC', state: 'AZ' },
      { abbr: 'TUC', school: 'Tucson Mesa', nickname: 'Roadrunners', quality: 45, prestige: 61, color: '#7a2f2b', rival: 'SON', state: 'NM' },
      { abbr: 'RGV', school: 'Rio Grande', nickname: 'Rattlers', quality: 57, prestige: 54, color: '#4a6b3a', rival: 'ELP', state: 'NV' },
      { abbr: 'ALB', school: 'Alamosa Tech', nickname: 'Smelters', quality: 47, prestige: 48, color: '#5a5a6b', rival: 'LCR', state: 'UT' },
      { abbr: 'LCR', school: 'Las Cruces', nickname: 'Dust Devils', quality: 39, prestige: 45, color: '#8a6b3a', rival: 'ALB', state: 'AZ' },
      { abbr: 'ELP', school: 'El Paso Ridge', nickname: 'Muleskinners', quality: 41, prestige: 39, color: '#6b4a3a', rival: 'RGV', state: 'NV' },
      { abbr: 'YUM', school: 'Yuma Basin', nickname: 'Sunhawks', quality: 53, prestige: 39, color: '#8a7a1f', rival: 'NGL', state: 'NM' },
      { abbr: 'NGL', school: 'Nogales', nickname: 'Scorpions', quality: 34, prestige: 32, color: '#3a3a4a', rival: 'YUM', state: 'UT' },
      { abbr: 'MOA', school: 'Moab Canyon', nickname: 'Redwalls', quality: 35, prestige: 29, color: '#8a4a3a', rival: 'GAL', state: 'UT' },
      { abbr: 'PAH', school: 'Pahrump Valley', nickname: 'Diggers', quality: 31, prestige: 26, color: '#6b6b5a', rival: 'CSG', state: 'NV' },
      { abbr: 'GAL', school: 'Gallup Mesa', nickname: 'Zephyrs', quality: 38, prestige: 24, color: '#4a5f7a', rival: 'MOA', state: 'NM' },
      { abbr: 'CSG', school: 'Casa Grande', nickname: 'Saguaros', quality: 27, prestige: 22, color: '#7a7a3a', rival: 'PAH', state: 'AZ' },
    ],
  },
  {
    id: 'GLK',
    name: 'Great Lakes Conference',
    region: 'Great Lakes',
    tier: 3,
    blurb: 'Snow in March, doubleheaders in May, nothing handed to anyone.',
    schools: [
      { abbr: 'ERI', school: 'Erie Shore', nickname: 'Freighters', quality: 54, prestige: 60, color: '#1f3f5a', rival: 'ATB', state: 'OH' },
      { abbr: 'SAG', school: 'Saginaw State', nickname: 'Ironsides', quality: 40, prestige: 55, color: '#4a4a4a', rival: 'TOL', state: 'MI' },
      { abbr: 'FVL', school: 'Fox Valley', nickname: 'Foundrymen', quality: 52, prestige: 48, color: '#6b3f2b', rival: 'HUR', state: 'IL' },
      { abbr: 'TOL', school: 'Toledo Works', nickname: 'Glassmen', quality: 42, prestige: 43, color: '#2f6b6b', rival: 'SAG', state: 'IN' },
      { abbr: 'SUP', school: 'Superior State', nickname: 'Icebreakers', quality: 34, prestige: 40, color: '#3a5f7a', rival: 'MRQ', state: 'WI' },
      { abbr: 'MRQ', school: 'Marquette Bay', nickname: 'Voyageurs', quality: 48, prestige: 34, color: '#5a3f6b', rival: 'SUP', state: 'IL' },
      { abbr: 'HUR', school: 'Huron Valley', nickname: 'Longships', quality: 36, prestige: 34, color: '#3f5a4a', rival: 'FVL', state: 'OH' },
      { abbr: 'ATB', school: 'Ashtabula Point', nickname: 'Gales', quality: 30, prestige: 28, color: '#5a5f4a', rival: 'ERI', state: 'MI' },
      { abbr: 'MSK', school: 'Muskegon Sands', nickname: 'Dunehawks', quality: 33, prestige: 26, color: '#3a5a6b', rival: 'SDY', state: 'MI' },
      { abbr: 'KNK', school: 'Kankakee', nickname: 'Rivermen', quality: 37, prestige: 24, color: '#5a3a3a', rival: 'WBS', state: 'IL' },
      { abbr: 'SDY', school: 'Sandusky Bay', nickname: 'Bluepike', quality: 29, prestige: 23, color: '#2b5a5a', rival: 'MSK', state: 'OH' },
      { abbr: 'WBS', school: 'Wabash Works', nickname: 'Forgemen', quality: 26, prestige: 21, color: '#4a4238', rival: 'KNK', state: 'IN' },
    ],
  },
  {
    id: 'MTN',
    name: 'Mountain Conference',
    region: 'Mountain',
    tier: 3,
    blurb: 'Altitude, long bus rides, and the thinnest budgets in the country.',
    schools: [
      { abbr: 'TET', school: 'Teton State', nickname: 'Grizzlies', quality: 53, prestige: 59, color: '#3a2f1f', rival: 'LAR', state: 'CO' },
      { abbr: 'SIL', school: 'Silverton', nickname: 'Hardrocks', quality: 39, prestige: 54, color: '#5a5a5f', rival: 'DUR', state: 'ID' },
      { abbr: 'WAS', school: 'Wasatch Tech', nickname: 'Falcons', quality: 51, prestige: 47, color: '#2b4a6b', rival: 'POC', state: 'MT' },
      { abbr: 'LAR', school: 'Laramie Plains', nickname: 'Pronghorns', quality: 41, prestige: 42, color: '#6b5f2b', rival: 'TET', state: 'WY' },
      { abbr: 'DUR', school: 'Durango Mesa', nickname: 'Rimrockers', quality: 33, prestige: 39, color: '#7a4a2b', rival: 'SIL', state: 'CO' },
      { abbr: 'BIT', school: 'Bitterroot Valley', nickname: 'Wolverines', quality: 47, prestige: 33, color: '#4a3a2f', rival: 'GRJ', state: 'ID' },
      { abbr: 'POC', school: 'Pocatello', nickname: 'Bannocks', quality: 35, prestige: 33, color: '#3f5a5f', rival: 'WAS', state: 'MT' },
      { abbr: 'GRJ', school: 'Grand Junction', nickname: 'Cliffhangers', quality: 29, prestige: 27, color: '#6b4a4a', rival: 'BIT', state: 'CO' },
      { abbr: 'BUT', school: 'Butte Copper', nickname: 'Copperheads', quality: 34, prestige: 26, color: '#7a4a2b', rival: 'CDA', state: 'MT' },
      { abbr: 'CDA', school: 'Coeur Basin', nickname: 'Silvertips', quality: 30, prestige: 23, color: '#5a6b6b', rival: 'BUT', state: 'ID' },
      { abbr: 'RWL', school: 'Rawlins', nickname: 'Sagehens', quality: 26, prestige: 21, color: '#6b6b3f', rival: 'SLD', state: 'WY' },
      { abbr: 'SLD', school: 'Salida Peaks', nickname: 'Summiteers', quality: 36, prestige: 20, color: '#4a3f52', rival: 'RWL', state: 'CO' },
    ],
  },
  {
    id: 'NEC',
    name: 'Northeast Conference',
    region: 'Northeast',
    tier: 3,
    blurb: 'The coldest league in the country. Wins here are earned twice.',
    schools: [
      { abbr: 'HUD', school: 'Hudson Valley', nickname: 'Sentinels', quality: 52, prestige: 58, color: '#2b3f6b', rival: 'ALG', state: 'NY' },
      { abbr: 'NWP', school: 'Newport Bay', nickname: 'Whalers', quality: 38, prestige: 53, color: '#1f4a4a', rival: 'PRT', state: 'PA' },
      { abbr: 'BRS', school: 'Berkshire Tech', nickname: 'Ironworkers', quality: 50, prestige: 46, color: '#4a4a3a', rival: 'SCR', state: 'MA' },
      { abbr: 'ALG', school: 'Allegheny Ridge', nickname: 'Colliers', quality: 40, prestige: 41, color: '#3a3a3a', rival: 'HUD', state: 'CT' },
      { abbr: 'PRT', school: 'Portland Head', nickname: 'Lightkeepers', quality: 32, prestige: 38, color: '#5f6b7a', rival: 'NWP', state: 'NJ' },
      { abbr: 'NSH', school: 'Nashua Mills', nickname: 'Millmen', quality: 46, prestige: 32, color: '#6b3a3a', rival: 'BGR', state: 'NY' },
      { abbr: 'SCR', school: 'Scranton Valley', nickname: 'Breakers', quality: 34, prestige: 32, color: '#4a5f6b', rival: 'BRS', state: 'PA' },
      { abbr: 'BGR', school: 'Bangor North', nickname: 'Loggers', quality: 28, prestige: 26, color: '#3f4a3a', rival: 'NSH', state: 'MA' },
      { abbr: 'UTC', school: 'Utica Falls', nickname: 'Cataracts', quality: 31, prestige: 25, color: '#3a4a6b', rival: 'CHC', state: 'NY' },
      { abbr: 'PTS', school: 'Pittston Coal', nickname: 'Anthracite', quality: 35, prestige: 22, color: '#33383f', rival: 'PSA', state: 'PA' },
      { abbr: 'CHC', school: 'Chicopee Mills', nickname: 'Weavers', quality: 27, prestige: 21, color: '#6b4a5a', rival: 'UTC', state: 'MA' },
      { abbr: 'PSA', school: 'Passaic Falls', nickname: 'Silkmen', quality: 24, prestige: 19, color: '#5f5a6b', rival: 'PTS', state: 'NJ' },
    ],
  },
];

/** Every school in the world, in world index order. */
export const ALL_SCHOOLS: readonly SchoolDef[] = CONFERENCES.flatMap((c) => c.schools);

/** Where a school sits in the world, by abbreviation. */
export const SCHOOL_INDEX: ReadonlyMap<string, number> =
  new Map(ALL_SCHOOLS.map((s, i) => [s.abbr, i]));

export const conferenceOf = (abbr: string): ConferenceDef | undefined =>
  CONFERENCES.find((c) => c.schools.some((s) => s.abbr === abbr));

/**
 * Where a dynasty starts when nobody has chosen yet — the headless sim, a test,
 * a save with no team recorded. The Pacific is the mockup's league, so this is
 * the conference every screenshot in the design docs is showing.
 */
export const HOME_CONFERENCE = 'PAC';

export const CONFERENCE_NAME =
  CONFERENCES.find((c) => c.id === HOME_CONFERENCE)?.name ?? HOME_CONFERENCE;
