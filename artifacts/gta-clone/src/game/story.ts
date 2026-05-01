// Blood & Chrome — Full Story Campaign (21 missions, ~3 hours)
// Five acts: Fresh Meat → Moving Up → Betrayal → War → The Reckoning

export interface DialogueLine {
  speaker: string;     // Character name
  role: string;        // Short role label
  color: string;       // Name highlight color
  text: string;        // Spoken line
  side: "left" | "right";
}

export interface StoryMissionDef {
  id: string;
  act: number;
  name: string;
  description: string;
  type: "reach" | "collect" | "eliminate" | "destroy" | "escape";
  markerColor: string;
  icon: string;
  reward: number;
  scoreReward: number;
  timeLimit?: number;
  giveWeapon?: import("./types").WeaponKind;
  giveAmmo?: number;
  giveMoney?: number;
  wantedOnStart?: number;
  // World pixel coords for marker (snapped to road grid)
  markerX: number;
  markerY: number;
  intro: DialogueLine[];
  outro: DialogueLine[];
}

const MARCUS  = (text: string, side: "left" | "right" = "left"): DialogueLine =>
  ({ speaker: "Marcus Cole", role: "YOU", color: "#4cffb0", text, side });
const JIMMY   = (text: string): DialogueLine =>
  ({ speaker: "Jimmy Vega", role: "DELUCA CREW", color: "#ffa040", text, side: "right" });
const VINNIE  = (text: string): DialogueLine =>
  ({ speaker: 'Vinnie "Shark" Deluca', role: "MOB BOSS", color: "#e8b820", text, side: "right" });
const TANYA   = (text: string): DialogueLine =>
  ({ speaker: "Tanya Reyes", role: "ARMS DEALER", color: "#ff60c0", text, side: "right" });
const RODRIGUEZ = (text: string): DialogueLine =>
  ({ speaker: "Capt. Rodriguez", role: "CORRUPT COP", color: "#4a90ff", text, side: "right" });
const BRIGGS  = (text: string): DialogueLine =>
  ({ speaker: 'Dwayne "King" Briggs', role: "RAZORS LEADER", color: "#ff4040", text, side: "right" });
const BROKER  = (text: string): DialogueLine =>
  ({ speaker: "The Broker", role: "UNKNOWN", color: "#c060ff", text, side: "right" });
const VOICE   = (text: string): DialogueLine =>
  ({ speaker: "Marcus [V.O.]", role: "NARRATION", color: "#aaaaaa", text, side: "left" });

// Road grid intersections (world pixels). Roads at tile 4,14,24,34,...
// Center of 4-tile road band = (startTile+2)*64
// Player spawns near (1664, 8064)
export const STORY_MISSIONS: StoryMissionDef[] = [

  // ═══════════════════════════════════════════════════════════════════
  // ACT 1 — FRESH MEAT
  // ═══════════════════════════════════════════════════════════════════

  {
    id: "act1_m1",
    act: 1,
    name: "FIRST DOLLAR",
    description: "Drive the package to the depot on the east side",
    type: "reach",
    markerColor: "#4cffb0",
    icon: "▲",
    reward: 500,
    scoreReward: 600,
    markerX: 1664, markerY: 8064,
    intro: [
      JIMMY("You Marcus? Victor said you'd show."),
      JIMMY("We've got a package that needs riding across town to the depot. Straightforward. Just drive — don't get stopped."),
      MARCUS("What's in the package?"),
      JIMMY("Advice? Don't ask questions on your first day."),
    ],
    outro: [
      JIMMY("Clean. No drama. That's what we like."),
      JIMMY("Vinnie runs this city's blood supply — money, product, protection. You keep it clean, you stay breathing and paid."),
      MARCUS("I can work with that."),
    ],
  },

  {
    id: "act1_m2",
    act: 1,
    name: "DEAD MEN TELL TALES",
    description: "Eliminate Paco before he reaches the DA",
    type: "eliminate",
    markerColor: "#ff5050",
    icon: "☠",
    reward: 800,
    scoreReward: 1000,
    giveAmmo: 60,
    markerX: 2304, markerY: 8064,
    intro: [
      JIMMY("We've got a problem named Paco Ruiz."),
      JIMMY("He used to drive for us. Now he's running to the District Attorney with everything he saw."),
      TANYA("He made his choice. Now he faces the consequences."),
      MARCUS("Where is he?"),
      JIMMY("Moving through the harbor lots. GPS marker's live. Don't miss him."),
    ],
    outro: [
      JIMMY("Good work. No loose ends. Vinnie will hear about this."),
      TANYA("You did what you had to do. Welcome to the life, Marcus."),
      MARCUS("...Yeah."),
    ],
  },

  {
    id: "act1_m3",
    act: 1,
    name: "REPO MEN",
    description: "Retrieve the stolen cargo truck and deliver it to the warehouse",
    type: "collect",
    markerColor: "#3acfff",
    icon: "■",
    reward: 1200,
    scoreReward: 1400,
    markerX: 2944, markerY: 8064,
    intro: [
      JIMMY("The Eastside Razors jacked our cargo truck out of the harbor yard. Big mistake."),
      JIMMY("It's sitting somewhere in the east docks. Find it, drive it to the warehouse — and don't scratch the paint."),
      MARCUS("What if the Razors come looking?"),
      JIMMY("Then you deal with it. That's what we're paying you for."),
    ],
    outro: [
      JIMMY("Perfect. You handle problems like a professional."),
      JIMMY("Vinnie's been asking about you. He wants a face-to-face. That's... significant."),
      MARCUS("Lead the way."),
    ],
  },

  {
    id: "act1_m4",
    act: 1,
    name: "THE TEST",
    description: "Survive the police pursuit — prove yourself to Vinnie",
    type: "escape",
    markerColor: "#e8b820",
    icon: "★",
    reward: 1500,
    scoreReward: 2000,
    giveWeapon: "smg",
    giveAmmo: 120,
    timeLimit: 75,
    wantedOnStart: 3,
    markerX: 1664, markerY: 8704,
    intro: [
      VINNIE("Mr. Cole. I've heard good things."),
      VINNIE("Every man who rides with me gets tested. Captain Rodriguez is going to put some heat on you right now."),
      RODRIGUEZ("Run, boy. Let's see how fast."),
      MARCUS("You're serious."),
      VINNIE("Deadly. Survive and you're family. Don't... well."),
    ],
    outro: [
      VINNIE("Ha! Rodriguez says you're something else. Three stars and you walked away clean."),
      VINNIE("Welcome to the family, Marcus. There's real money in your future — and real consequences if you disappoint me."),
      MARCUS("Understood, Vinnie."),
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // ACT 2 — MOVING UP
  // ═══════════════════════════════════════════════════════════════════

  {
    id: "act2_m1",
    act: 2,
    name: "COLLECTION DAY",
    description: "Collect the monthly tribute from the Harbor Bar",
    type: "reach",
    markerColor: "#ffa040",
    icon: "▲",
    reward: 900,
    scoreReward: 1100,
    markerX: 1664, markerY: 9344,
    intro: [
      VINNIE("Three establishments in the harbor district are behind on their tributes."),
      VINNIE("The Harbor Bar is the main one. Go visit the owner. Remind him who keeps order in this city."),
      MARCUS("And if he refuses?"),
      VINNIE("He won't. But if he does — remind him differently."),
    ],
    outro: [
      JIMMY("$6,200 from the harbor boys. Nice."),
      VINNIE("You've got a talent for persuasion, Marcus. I'm moving you up. Bigger jobs, bigger pay."),
      TANYA("Careful what you wish for."),
    ],
  },

  {
    id: "act2_m2",
    act: 2,
    name: "PROTECTION RACKET",
    description: "Guard Tanya during the arms deal — eliminate any threats",
    type: "eliminate",
    markerColor: "#ff60c0",
    icon: "☠",
    reward: 1400,
    scoreReward: 1800,
    markerX: 3584, markerY: 8064,
    intro: [
      TANYA("I've got a deal going down at the old warehouse by the docks."),
      TANYA("The Eastside Razors have been poking around. I need someone watching the perimeter."),
      MARCUS("How many are we expecting?"),
      TANYA("Could be nothing. Could be six. Either way — handle it."),
    ],
    outro: [
      TANYA("Clean work out there. Cleaner than I expected, honestly."),
      MARCUS("You doubted me?"),
      TANYA("I doubt everyone. It's kept me alive."),
      TANYA("Listen — watch yourself with Vinnie. He cycles through people. You're not special to him."),
      MARCUS("Noted."),
    ],
  },

  {
    id: "act2_m3",
    act: 2,
    name: "SMOKE & FIRE",
    description: "Destroy the Razors' stash operation vehicle at the docklands",
    type: "destroy",
    markerColor: "#ff5c30",
    icon: "✖",
    reward: 1600,
    scoreReward: 2000,
    giveAmmo: 80,
    markerX: 2304, markerY: 7424,
    intro: [
      VINNIE("The Razors have been using a truck in the docklands to run product through our territory."),
      VINNIE("I want that truck destroyed. I want them to see the smoke from their side of town."),
      JIMMY("Sends a message. These guys respect nothing but fire."),
      MARCUS("I'll light it up."),
    ],
    outro: [
      JIMMY("Beautiful! Heard it go from three blocks away!"),
      VINNIE("The Razors will think twice before crossing that line again. Good soldier, Marcus."),
      MARCUS("What's next?"),
      VINNIE("Now we protect what we have."),
    ],
  },

  {
    id: "act2_m4",
    act: 2,
    name: "NO WITNESS",
    description: "Intercept the journalist before she delivers the files",
    type: "collect",
    markerColor: "#3acfff",
    icon: "■",
    reward: 1200,
    scoreReward: 1500,
    markerX: 4224, markerY: 8064,
    intro: [
      JIMMY("A journalist named Elena Cross has photographs from the warehouse meeting — Vinnie and Rodriguez together."),
      JIMMY("She's driving to her paper right now. Get to her car before she arrives. Get those files."),
      RODRIGUEZ("I need this handled, Deluca. If those pictures surface—"),
      VINNIE("They won't. Marcus — move."),
    ],
    outro: [
      JIMMY("Files secured. Rodriguez is breathing again."),
      RODRIGUEZ("He's useful. I'll remember that."),
      TANYA("[over phone] Marcus. I need to talk to you. Somewhere private."),
    ],
  },

  {
    id: "act2_m5",
    act: 2,
    name: "HOT ZONE",
    description: "Get to the safe location — something's wrong",
    type: "reach",
    markerColor: "#ff60c0",
    icon: "▲",
    reward: 1000,
    scoreReward: 1200,
    markerX: 1024, markerY: 7424,
    intro: [
      TANYA("[urgent] Marcus. Don't talk, just listen."),
      TANYA("Vinnie's been tipping Rodriguez about runners he wants removed. People who know too much."),
      TANYA("You're on that list. I don't know when — but you're on it."),
      MARCUS("Why are you telling me this?"),
      TANYA("Because I'm on it too. Get to my location. Now."),
    ],
    outro: [
      TANYA("We're both loose ends now. Vinnie keeps people around until they're inconvenient."),
      MARCUS("What do we do?"),
      TANYA("We find leverage. Something that protects us both."),
      TANYA("Vinnie keeps files — financial records, Rodriguez's payments, everything. If we can get those..."),
      MARCUS("We go get them."),
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // ACT 3 — BETRAYAL
  // ═══════════════════════════════════════════════════════════════════

  {
    id: "act3_m1",
    act: 3,
    name: "THE SETUP",
    description: "It's a trap — escape the police ambush!",
    type: "escape",
    markerColor: "#ff3868",
    icon: "★",
    reward: 0,
    scoreReward: 500,
    timeLimit: 90,
    wantedOnStart: 4,
    markerX: 2944, markerY: 7424,
    intro: [
      VINNIE("[smooth] Simple errand. Pick up a briefcase from the old warehouse on Harbor Street."),
      VINNIE("My man will be waiting. In and out."),
      MARCUS("That's it?"),
      VINNIE("That's it. Easy money."),
      RODRIGUEZ("[on radio] South Island PD. You're surrounded. Step out of the vehicle."),
      MARCUS("Vinnie... you set me up."),
    ],
    outro: [
      VOICE("It was a setup. Vinnie needed me gone — I knew too much and cost too much to keep."),
      VOICE("Rodriguez had a warrant. Vinnie had leverage. And I had nothing... except a head start."),
      VOICE("But that was enough."),
    ],
  },

  {
    id: "act3_m2",
    act: 3,
    name: "BURNED",
    description: "Reach Tanya's apartment — you need allies",
    type: "reach",
    markerColor: "#ff60c0",
    icon: "▲",
    reward: 500,
    scoreReward: 600,
    markerX: 1024, markerY: 6784,
    intro: [
      MARCUS("[phone] Tanya. It's Marcus. Vinnie sold me to Rodriguez."),
      TANYA("I know. I heard. Get to my apartment — don't use the main roads."),
      MARCUS("And then what?"),
      TANYA("Then we take everything from him."),
    ],
    outro: [
      TANYA("You look terrible."),
      MARCUS("Vinnie lit me up. Four stars. I barely made it."),
      TANYA("Vinnie keeps his real files on a server in the warehouse on Crest Road. Account numbers, wire transfers, Rodriguez's cut — everything."),
      TANYA("Get me those files and neither of them can touch either of us."),
      MARCUS("Let's go."),
    ],
  },

  {
    id: "act3_m3",
    act: 3,
    name: "THE VAULT",
    description: "Neutralize Vinnie's security and steal the server files",
    type: "eliminate",
    markerColor: "#c060ff",
    icon: "☠",
    reward: 2000,
    scoreReward: 2500,
    giveWeapon: "rifle",
    giveAmmo: 100,
    markerX: 3584, markerY: 7424,
    intro: [
      TANYA("The warehouse has four guards on rotating shifts. Take them out, get to the back office."),
      TANYA("The server's in a black case marked 'inventory.' Grab it and go."),
      MARCUS("What if Vinnie's there?"),
      TANYA("Then this becomes a different kind of job. Stay focused."),
    ],
    outro: [
      MARCUS("Got the server. Rodriguez's accounts, Vinnie's operations — the whole machine."),
      TANYA("That's our insurance policy. No one can touch us while we hold this."),
      MARCUS("But we can't hide forever. We go on offense."),
      TANYA("There's a name in these files I've never seen before. Someone called 'The Broker.' They funded Vinnie — and have direct access to Rodriguez."),
      MARCUS("Who is this person?"),
    ],
  },

  {
    id: "act3_m4",
    act: 3,
    name: "FOLLOW THE MONEY",
    description: "Find and eliminate Vinnie's accountant — he knows who The Broker is",
    type: "eliminate",
    markerColor: "#c060ff",
    icon: "☠",
    reward: 1800,
    scoreReward: 2200,
    markerX: 4224, markerY: 6784,
    intro: [
      TANYA("Vinnie's accountant, Felix Mora, manages The Broker's payments. He knows the real name."),
      TANYA("He's paranoid — always moving. But tonight he's at the casino on Eastside."),
      MARCUS("He's just an accountant."),
      TANYA("He's the reason we're in this mess. Find him."),
    ],
    outro: [
      VOICE("The accountant talked before the end. 'The Broker operates from the North Tower... he plays everyone... you're already in his game...'"),
      MARCUS("Not anymore."),
      TANYA("Are you okay?"),
      MARCUS("No. But I'm moving forward."),
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // ACT 4 — WAR
  // ═══════════════════════════════════════════════════════════════════

  {
    id: "act4_m1",
    act: 4,
    name: "RESPECT",
    description: "Meet King Briggs and prove your worth — eliminate Vinnie's moles in the Razors",
    type: "eliminate",
    markerColor: "#ff4040",
    icon: "☠",
    reward: 2200,
    scoreReward: 2800,
    giveAmmo: 100,
    markerX: 6784, markerY: 6784,
    intro: [
      MARCUS("King Briggs. I want a sit-down."),
      BRIGGS("You've got nerve, Cole. Deluca's got a price on your head."),
      MARCUS("Deluca burned me. I've got his files. We want the same thing."),
      BRIGGS("We don't want anything the same. But — prove yourself. Three of my boys have been taking Vinnie's money. I want them gone."),
      MARCUS("Done."),
    ],
    outro: [
      BRIGGS("You move clean. I respect that."),
      BRIGGS("The Razors are in. What's your play?"),
      MARCUS("We dismantle Vinnie's money, then we take down Rodriguez, then we find The Broker."),
      BRIGGS("One step at a time. Let's bleed Vinnie's cash flow first."),
    ],
  },

  {
    id: "act4_m2",
    act: 4,
    name: "SCORCHED EARTH",
    description: "Destroy Vinnie's import laundering vehicle — cut off his cash",
    type: "destroy",
    markerColor: "#ff5c30",
    icon: "✖",
    reward: 2500,
    scoreReward: 3000,
    markerX: 5504, markerY: 7424,
    intro: [
      MARCUS("Three of Vinnie's front businesses are his main cash pipeline."),
      BRIGGS("The import truck running through the mid-city docks is his biggest earner. Wreck it."),
      MARCUS("And the rest?"),
      BRIGGS("We burn the whole operation down. One move at a time."),
    ],
    outro: [
      BRIGGS("That's it. Vinnie's bleeding. His crew's starting to fracture."),
      MARCUS("Now we go after the badge that protects him."),
      BRIGGS("Rodriguez. Yeah. But we need evidence first — something we can use or release."),
    ],
  },

  {
    id: "act4_m3",
    act: 4,
    name: "DIRTY BADGE",
    description: "Steal the evidence files from the police impound before Rodriguez destroys them",
    type: "collect",
    markerColor: "#4a90ff",
    icon: "■",
    reward: 2800,
    scoreReward: 3400,
    markerX: 2304, markerY: 6784,
    intro: [
      BRIGGS("Rodriguez keeps physical evidence in impound — recordings of Vinnie's deals, the DA tip-offs. He's about to purge everything."),
      MARCUS("I'll go in alone. Less noise."),
      TANYA("The security cycles every eight minutes. You have a window."),
      MARCUS("That's enough."),
    ],
    outro: [
      MARCUS("Got everything. Wire transfers, call logs, Rodriguez's offshore accounts."),
      TANYA("This is enough to put him away for thirty years."),
      MARCUS("Or use as leverage. There's something else — a codename, 'N-Tower.' Rodriguez is afraid of whoever's behind that."),
      BRIGGS("Then Rodriguez is our way to The Broker."),
    ],
  },

  {
    id: "act4_m4",
    act: 4,
    name: "THE CAPTAIN'S END",
    description: "Take down Captain Rodriguez and his corrupt unit",
    type: "eliminate",
    markerColor: "#4a90ff",
    icon: "☠",
    reward: 3000,
    scoreReward: 4000,
    markerX: 3584, markerY: 6144,
    intro: [
      MARCUS("Rodriguez. I know everything. The accounts, the deals, Vinnie's setup — all of it."),
      RODRIGUEZ("You think you scare me, Cole?"),
      MARCUS("No. But I think you should run."),
      RODRIGUEZ("Kill him! Kill him and this whole thing goes away!"),
    ],
    outro: [
      VOICE("Rodriguez was a symptom, not the disease. He was a man who chose money over everything — and paid for it."),
      VOICE("But the real rot went deeper. Someone had engineered all of this. The Broker. Whoever they were, they needed South Island City exactly like this: broken, divided, for sale."),
      MARCUS("Not anymore."),
    ],
  },

  {
    id: "act4_m5",
    act: 4,
    name: "SHARK HUNT",
    description: "Hunt down Vinnie Deluca — destroy his escape vehicle",
    type: "destroy",
    markerColor: "#e8b820",
    icon: "✖",
    reward: 3500,
    scoreReward: 4500,
    markerX: 4864, markerY: 7424,
    intro: [
      MARCUS("Vinnie. It's over."),
      VINNIE("[panicking] Marcus — listen to me. I can make this right. I can pay you—"),
      MARCUS("Get in your car and drive. I'll find you."),
      VINNIE("You're insane! Rodriguez is dead! You'll never—"),
      MARCUS("Drive, Vinnie."),
    ],
    outro: [
      VOICE("Vinnie Deluca ran out of road."),
      MARCUS("[over wreckage] You should have picked better enemies."),
      TANYA("[phone] Marcus. The Broker knows you're coming. He's been watching this whole time."),
      TANYA("And Marcus? He's been here. In South Island City. The whole time."),
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // ACT 5 — THE RECKONING
  // ═══════════════════════════════════════════════════════════════════

  {
    id: "act5_m1",
    act: 5,
    name: "FOLLOW THE SIGNAL",
    description: "Drive north to The Broker's compound in the forest",
    type: "reach",
    markerColor: "#c060ff",
    icon: "▲",
    reward: 2000,
    scoreReward: 2500,
    markerX: 5504, markerY: 4864,
    intro: [
      TANYA("The Broker operates from a compound north of the city — past the Aethelia forest."),
      TANYA("He's been watching everything from there. Every deal, every betrayal, every move we made."),
      MARCUS("He orchestrated all of it."),
      TANYA("He profits from the city's chaos. Vinnie, Rodriguez — they were just instruments."),
      MARCUS("Not anymore. Tell me how to get there."),
    ],
    outro: [
      BROKER("[radio, distorted] Impressive, Mr. Cole. I've watched your progress with... admiration."),
      MARCUS("You knew I was coming."),
      BROKER("I've known every step you'd take before you took it. You can't stop this. The city feeds me."),
      MARCUS("Then I'll starve you out."),
    ],
  },

  {
    id: "act5_m2",
    act: 5,
    name: "FINAL SCORE",
    description: "Take down The Broker and his private militia",
    type: "eliminate",
    markerColor: "#c060ff",
    icon: "☠",
    reward: 5000,
    scoreReward: 7000,
    giveWeapon: "rpg",
    giveAmmo: 8,
    markerX: 5504, markerY: 3584,
    intro: [
      BROKER("Kill him. Double what Deluca ever paid."),
      MARCUS("You can't buy your way out of this one."),
      BROKER("Everyone has a price, Mr. Cole. Even you. Especially you."),
      MARCUS("Wrong."),
    ],
    outro: [
      BROKER("[fallen] You think... this ends with me? There's always... another broker..."),
      MARCUS("Maybe. But not today. Not this city."),
      TANYA("[phone] Is it done?"),
      MARCUS("It's done."),
      TANYA("Then go. There's one more place you need to be."),
    ],
  },

  {
    id: "act5_m3",
    act: 5,
    name: "YOUR CITY NOW",
    description: "Drive to the city overlook — you've earned this",
    type: "reach",
    markerColor: "#4cffb0",
    icon: "★",
    reward: 10000,
    scoreReward: 15000,
    markerX: 2944, markerY: 1664,
    intro: [
      VOICE("South Island City. I arrived with nothing. No connections, no plan, just need."),
      VOICE("Vinnie gave me a ladder. I climbed it, and when he pulled it out from under me... I built my own."),
      VOICE("Tanya's gone somewhere safe. King Briggs has the streets. The Broker's operation is done."),
      VOICE("As for me... I'm driving north. Maybe I'll keep going."),
    ],
    outro: [
      VOICE("The city's still standing. Scarred, but standing."),
      VOICE("And so am I."),
      MARCUS("That's enough."),
    ],
  },
];

export const ACT_INTROS: Record<number, string> = {
  1: "ACT I — FRESH MEAT",
  2: "ACT II — MOVING UP",
  3: "ACT III — BETRAYAL",
  4: "ACT IV — WAR",
  5: "ACT V — THE RECKONING",
};
