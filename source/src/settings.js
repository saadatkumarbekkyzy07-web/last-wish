// =====================================================================
//  LAST WISH — GAME SETTINGS
//  This is the easiest file to play with. Change a number, save,
//  refresh the browser, and the game changes. No other code needed.
// =====================================================================

export const SETTINGS = {

  // ---------- EDITION ----------
  // 'laptop'    = keyboard + mouse, normal size (this file)
  // 'bigscreen' = touch buttons on screen, big menus, videos fitted to a video wall
  // (the big-screen file sets this for you)
  edition: 'laptop',

  // ---------- THE MONKEY (player) ----------
  monkey: {
    hp: 100,              // life points at the start of every night
    speed: 2.2,           // walking speed (metres per second)
    turnSpeed: 2.8,       // how fast the ← → arrow keys turn the monkey
    jumpPower: 4.4,       // how high the jump goes (4.4 = high enough for tables and chairs)
    height: 0.60,         // size of the toy in the world (metres)
    ultrasPerNight: 10,   // number of Ultra attacks (R) each night
  },

  // ---------- CONTROLS ----------
  controls: {
    mouseSensitivity: 1.0,   // bigger = mouse turns faster
    invertY: false,          // true = moving the mouse up looks down
    runMultiplier: 1.6,      // Shift makes the monkey this much faster
    touch: 'off',            // 'on' = on-screen buttons always shown (big screen), 'off' = keyboard + mouse only
    side: 'right',           // 1 player on the big screen: which side all the buttons are on ('right' or 'left')
    touchLookSpeed: 1.0,     // how fast dragging turns the view on a touchscreen
    joystickArea: 0.35,      // left part of the screen (0.35 = 35%) where a touch starts the walking joystick
  },

  // ---------- DISPLAY (big screens, video walls) ----------
  display: {
    maxPixels: 8300000,      // most pixels drawn per frame (8.3 million = 4K). The 7680x2160 wall is drawn at ~70%
    minRenderScale: 0.5,     // if the game gets slow it lowers the resolution, but not below this
    maxHorizontalFov: 100,   // widest side-to-side view in degrees, so very wide screens don't look stretched
    uiScale: 1,              // menu size: 1 = normal, 'auto' = grows on tall screens (big screen edition)
  },

  // ---------- ENEMIES ----------
  cockroach: { hp: 2,  speed: 1.0, biteDamage: 1, biteEvery: 1.0, height: 0.15 },  // the new crawling cockroach is low and long
  mega:      { hp: 10, speed: 1.6, biteDamage: 2, biteEvery: 0.9, height: 0.50 },  // still smaller than the monkey

  // ---------- ATTACKS ----------
  // range = how far in front of the monkey it reaches (metres)
  // cooldown = seconds before you can use it again
  attacks: {
    hit:      { key: 'Left click / J',damage: 1, range: 0.60, cooldown: 0.28 },
    kick:     { key: 'Right click / K',damage: 1, range: 0.75, cooldown: 0.42, maxTargets: 2 },
    punch:    { key: 'Q',damage: 0, range: 0.75, cooldown: 0.60, pushDistance: 2.5 },
    legPunch: { key: 'F',damage: 2, range: 0.65, cooldown: 0.80 },
    ultra:    { key: 'R',radius: 2.3 },   // kills every cockroach in this radius
  },

  // ---------- THE THREE NIGHTS ----------
  nights: [
    {
      title: 'Night 1',
      minutes: 6,                         // timer (5–10 suggested)
      goal: { cockroach: 50, mega: 0 },
      maxAliveCockroaches: 10,            // how many can be on screen at once
      maxAliveMegas: 0,
      spawnEvery: 1.1,                    // seconds between new cockroaches
      cockroachesHide: false,
      blackout: null,                     // no darkness on night 1
      image: 'images/night1.jpg',
      fact: 'Cockroaches are attracted to dead skin cells, fingernails, eyelashes, calluses, or leftover food and grease residue on your face, mouth, and hands.',
      instructions: 'With the beginning of the first night you can hear how cockroaches walk outside of the room. You need to kill 50 this night, but be careful — they can bite!',
    },
    {
      title: 'Night 2',
      minutes: 7,
      goal: { cockroach: 50, mega: 0 },
      maxAliveCockroaches: 14,
      maxAliveMegas: 0,
      spawnEvery: 0.9,
      cockroachesHide: true,              // they run and hide when the light is ON
      blackout: { every: 9, duration: 4 },// lights go out for 4 s, every 9 s
      image: 'images/night2.jpg',
      fact: 'Cockroaches are strictly nocturnal. They emerge in the dark — usually a few hours after the lights go out. Activity peaks during spring, summer, and fall (typically June through September in many regions).',
      instructions: 'Cockroaches became smarter: they hide, and come out only when the light is gone. Strike in the dark!',
    },
    {
      title: 'Night 3',
      minutes: 8,
      goal: { cockroach: 50, mega: 0 },
      maxAliveCockroaches: 16,
      maxAliveMegas: 0,
      spawnEvery: 3,                      // seconds between new hiding groups
      cockroachesHide: false,
      roomsOpen: true,                    // E opens doors
      // cockroaches wait in groups inside the rooms and attack only when you come close
      ambush: { groupMin: 3, groupMax: 5, maxWaitingGroups: 7, triggerDistance: 2.2 },
      blackout: null,
      image: 'images/night3.jpg',
      fact: 'Headless Survival: A cockroach can live for one to two weeks without its head because it breathes through small openings in its body segments (spiracles) and has an open circulatory system; it eventually dies of thirst because it cannot drink water.',
      instructions: 'Now cockroaches are more afraid, so they started to hide and attack only in groups. You need to look for them by yourself! Press E to open the doors of the rooms.',
    },
    {
      title: 'Night 4',
      minutes: 9,
      goal: { cockroach: 50, mega: 10 },
      maxAliveCockroaches: 12,
      maxAliveMegas: 3,
      spawnEvery: 1.0,
      megaSpawnEvery: 9,
      cockroachesHide: true,
      roomsOpen: true,                    // E opens doors
      blackout: { every: 11, duration: 6.5 }, // longer darkness than night 2
      image: 'images/night4.jpg',
      fact: 'Out of roughly 4,600 species worldwide, the German, American, Oriental, and Brown-banded cockroaches are the most common household pests, alongside several notable outdoor and exotic varieties.',
      instructions: 'The cockroach kingdom is very angry and sends MEGA cockroaches to defend it. Kill 50 cockroaches and 10 mega cockroaches!',
    },
  ],

  // ---------- STORY STYLE ----------
  // 'video'  = play the videos below
  // 'slides' = the old text + emoji version (you can also switch on the title screen)
  storyStyle: 'video',
  videoVolume: 0.8,        // music volume of the videos (0 to 1)

  // ---------- VIDEOS ----------
  // Put your video files in the "videos" folder with these names.
  // If a video is missing, the game shows the text version instead.
  videos: {
    intro:     'videos/intro.mp4',
    ending:    'videos/ending.mp4',       // the happy ending (all 4 nights won)
    badEnding: 'videos/ending_bad.mp4',   // END 2: the monkey was destroyed
  },

  // ---------- QUIZZES ----------
  // Moon quizzes on the map give lives. If the monkey is defeated with no lives left,
  // the Moon gives one last second-chance quiz; failing it ends the story (End 2).
  quiz: {
    questions: 5,       // how many questions to ask (Moon quizzes and the second chance)
    passScore: 4,       // how many must be correct to pass
  },

  // ---------- ANIMATIONS (made in Blender) ----------
  // clip  = the Blender action name
  // speed = playback speed (2 = twice as fast)
  // All characters share the same skeleton, so any clip works on any character.
  animations: {
    monkey: {
      walk:     { clip: 'human_000046',      speed: 1.0 },  // speed is auto-matched to walking speed
      hit:      { clip: 'human_000004',      speed: 2.4 },  // left click / J
      kick:     { clip: 'human_000018',      speed: 2.1 },  // right click / K (flying kick)
      punch:    { clip: 'human_000076',      speed: 1.9 },  // Q
      legPunch: { clip: 'human_000018',      speed: 1.6 },  // F
      ultra:    { clip: 'human_000018',      speed: 1.3 },  // R
      dance:    { clip: 'human_000014',      speed: 1.0 },  // victory dance
    },
    cockroach: { walk: { clip: 'human_000046',     speed: 1.0 }, bite: { clip: 'human_000004', speed: 3.0 } },
    mega:      { walk: { clip: 'human_000046.002', speed: 1.0 }, bite: { clip: 'human_000076', speed: 2.5 },
                 charge: { clip: 'human_000018', speed: 2.2 }, dance: { clip: 'human_000014', speed: 1.0 } },
    girl:      { walk: { clip: 'human_000089',     speed: 1.0 } },
  },

  // ---------- PROGRESS MAP (1 player) ----------
  // The order of the adventure. 'night' = a night (index in the list above), 'quiz' = a Moon quiz.
  stages: [
    { type: 'night', night: 0 },
    { type: 'night', night: 1 },
    { type: 'quiz',  title: 'Moon Quiz 1' },
    { type: 'night', night: 2 },
    { type: 'night', night: 3 },
    { type: 'quiz',  title: 'Moon Quiz 2' },
  ],

  // ---------- STARS (earned by how fast a night is finished) ----------
  // finished in under 3:00 = 3 stars, under 5:00 = 2 stars, slower = 1 star
  stars: { threeUnder: 180, twoUnder: 300 },

  // ---------- MOON LIVES (earned in the Moon quizzes) ----------
  // A life lets the monkey get up again when it is defeated during a night.
  lives: {
    perQuiz: 1,          // lives for passing a Moon quiz
    perfectBonus: 1,     // extra life for answering every question right
    reviveHp: 100,       // life points after using a life
  },

  // ---------- MARKET: COSTUMES (bought with stars) ----------
  costumes: [
    { id: 'default',    name: 'Classic bow',                  price: 0 },
    { id: 'hoodie',     name: 'Red hoodie',           price: 3 },
    { id: 'suspenders', name: 'Little gentleman', price: 3 },
    { id: 'overalls',   name: 'Overalls',           price: 4 },
    { id: 'argyle',     name: 'Argyle jumper',        price: 4 },
    { id: 'scarf',      name: 'Cosy scarf',            price: 5 },
    { id: 'pajamas',    name: 'Star pyjamas',        price: 6 },
  ],

  // ---------- 2 PLAYERS: MONKEY vs MEGA COCKROACH ----------
  duel: {
    minutes: 3,
    monkeyHp: 100,
    megaHp: 100,
    megaSpeed: 2.0,
    ultras: 3,
    // damage the monkey's attacks do to the mega cockroach
    monkeyDamage: { hit: 4, kick: 5, punch: 2, legPunch: 7, ultra: 15 },
    bite:   { damage: 6,  range: 0.6, cooldown: 0.8 },
    charge: { damage: 12, distance: 2.4, cooldown: 4 },
  },

  // ---------- MODEL FIXES ----------
  // If a character faces the wrong way, change its number:
  // 0 = as exported, 90, 180, 270 = turn it that many degrees.
  modelTurn: { monkey: 0, cockroach: 0, mega: 0, girl: 0 },
};
