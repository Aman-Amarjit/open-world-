// Blood & Chrome — Full Story Campaign
// Five acts: Fresh Meat → Moving Up → Betrayal → War → The Reckoning

export interface DialogueLine {
  speaker: string;
  role: string;
  color: string;
  text: string;
  side: "left" | "right";
  isNarration?: boolean;
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
  markerX: number;
  markerY: number;
  intro: DialogueLine[];
  outro: DialogueLine[];
}

// ── Character voice helpers ──────────────────────────────────────────────────
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
  ({ speaker: 'Dwayne "King" Briggs', role: "RAZOR KINGS", color: "#ff4040", text, side: "right" });
const BROKER  = (text: string): DialogueLine =>
  ({ speaker: "Solomon Voss", role: "THE BROKER", color: "#c060ff", text, side: "right" });
// Narration — Marcus internal monologue, styled differently
const VOICE   = (text: string): DialogueLine =>
  ({ speaker: "Marcus [V.O.]", role: "NARRATION", color: "#9090a0", text, side: "left", isNarration: true });

// ── World coords ─────────────────────────────────────────────────────────────
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
      JIMMY("You Marcus? Victor said you needed work. Didn't say much else about you."),
      MARCUS("That's me."),
      JIMMY("Package in the trunk. East side depot on Cannon Street. Don't speed. Don't stop. Don't open it."),
      MARCUS("What's in it?"),
      JIMMY("Some advice that keeps you alive on your first day — don't ask questions you're not prepared to live with the answer to."),
    ],
    outro: [
      JIMMY("Clean run. No noise. You handle a car well."),
      MARCUS("I've done some driving."),
      JIMMY("Vinnie runs this city's blood — money, product, protection. It's a business like any other."),
      MARCUS("Sure."),
      JIMMY("...You didn't open it."),
      MARCUS("No."),
      JIMMY("Good. Most people can't help themselves. I'll be in touch, Marcus."),
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
      JIMMY("We have a problem. Name's Paco Ruiz. Drove for us three years. Clean work."),
      JIMMY("His brother got picked up last week. DA offered immunity in exchange for testimony. Paco took the deal."),
      TANYA("He's meeting federal investigators tomorrow. Everything — the warehouse, the Rodriguez arrangement. Everything."),
      MARCUS("How old is he?"),
      JIMMY("...Twenty-six."),
      MARCUS("Does he have family?"),
      JIMMY("Marcus. Don't. He made his choice when he talked."),
      MARCUS("Where is he?"),
      JIMMY("Moving through the harbor lots. Marker's live. Don't think too hard about it."),
    ],
    outro: [
      JIMMY("Done. No loose ends."),
      TANYA("That's the first one that counts. Welcome to what this actually is."),
      MARCUS("..."),
      TANYA("It gets easier."),
      MARCUS("I'm not sure that's a good thing."),
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
      JIMMY("The Eastside Razors hit our cargo truck out of the harbor yard last night. Two of our guys are in the hospital."),
      MARCUS("What's in it?"),
      JIMMY("Same advice as before."),
      MARCUS("And if the Razors come back for it?"),
      JIMMY("Then you show them why that side of the city isn't theirs."),
    ],
    outro: [
      JIMMY("Beautiful. You know, most guys I hire — gun in their face, they freeze."),
      MARCUS("I've had guns in my face before."),
      JIMMY("Where was that?"),
      MARCUS("..."),
      JIMMY("Right. Vinnie wants to meet you. He doesn't say that very often."),
      MARCUS("When?"),
      JIMMY("Now."),
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
      VINNIE("Marcus Cole. I've heard about you from three people in forty-eight hours. You know what they all said?"),
      MARCUS("No."),
      VINNIE("Nothing. Not a word about the jobs. That's the highest praise a man in my position can give."),
      MARCUS("I keep things quiet."),
      VINNIE("Captain Rodriguez is about to test that. Think of it as an audition."),
      RODRIGUEZ("Let's see what you're actually made of."),
      MARCUS("What kind of audition?"),
      VINNIE("The kind where failure tells me I was wrong about you. And I don't enjoy being wrong."),
    ],
    outro: [
      VINNIE("Rodriguez says you handled three stars like you'd been doing it for years."),
      MARCUS("I improvised."),
      VINNIE("Improvisation under real pressure — that's the rarest thing. Welcome to the family, Marcus. I mean that word sincerely."),
      MARCUS("I appreciate it."),
      VINNIE("Don't. Not yet. Gratitude comes after you understand what this family does to people who disappoint it."),
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
      VINNIE("Bar on the harbor. Owner's name is Del Camino. Three months behind on his tribute."),
      MARCUS("How do you want it handled?"),
      VINNIE("Go talk to him. Remind him of the arrangement. Remind him who makes sure his bar doesn't burn down."),
      MARCUS("And if he refuses?"),
      VINNIE("Then he has a problem. And the problem has your face."),
      VINNIE("Marcus. Don't hurt him unless you have to. He has a daughter who works the bar. I like to think of myself as a reasonable man."),
    ],
    outro: [
      JIMMY("Six thousand two hundred, cash. Del Camino sends his apologies."),
      MARCUS("He's a frightened old man."),
      JIMMY("Welcome to the revenue model."),
      TANYA("That thing you're feeling right now? That heaviness? It only gets worse, Marcus."),
      MARCUS("I can carry it."),
      TANYA("They all say that."),
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
      TANYA("I have a deal at the Docklands warehouse tonight. Military hardware. No paperwork."),
      MARCUS("The Razors?"),
      TANYA("They've been tracking my routes. I need someone on the perimeter."),
      MARCUS("How many can we expect?"),
      TANYA("Best case — none. Worst case — a van full with orders to kill everyone present."),
      MARCUS("You're very calm about that."),
      TANYA("I've been in this business eleven years. Calm is how you survive to twelve."),
    ],
    outro: [
      TANYA("You held the line out there. I want you to know that meant something."),
      MARCUS("You thought I'd run?"),
      TANYA("I expected you to hesitate. You didn't."),
      TANYA("I need to say something, off the record. Vinnie is dangerous in a specific way — not because he's violent, but because he makes violence feel necessary. The longer you work for him, the more sense it makes. Until the day it doesn't, and you're already in too deep."),
      MARCUS("Speaking from experience?"),
      TANYA("Speaking from watching people I cared about disappear."),
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
      VINNIE("The Razors are running product through our territory. A truck, mid-city docks. Same route, every week."),
      MARCUS("You want me to take the product?"),
      VINNIE("I want you to destroy it. I want them to see the smoke from the other side of the city."),
      JIMMY("Symbolic violence. Vinnie's specialty."),
      VINNIE("Everything is symbolic, Jimmy. Pain is symbolic. Fire is symbolic. The message isn't the destruction — it's the certainty that we could have done worse."),
      MARCUS("I'll light it up."),
      VINNIE("Don't be poetic about it. Just make it burn."),
    ],
    outro: [
      JIMMY("Heard it from three blocks away. Beautiful detonation."),
      VINNIE("The Razors will think twice. Three times. You're developing a reputation."),
      MARCUS("Is that good?"),
      VINNIE("In this city, a reputation is armor. It stops bullets before they're fired. The only question is — what does yours say about you?"),
      MARCUS("What does mine say?"),
      VINNIE("That you don't stop."),
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
      JIMMY("Journalist. Elena Cross. She has photographs from the Crest Road meeting — Vinnie and Rodriguez together."),
      MARCUS("How'd she get them?"),
      JIMMY("Does it matter? She's on her way to her editor right now. Get those files before she arrives."),
      RODRIGUEZ("I need this handled, Deluca. If those pictures go public, my family—"),
      VINNIE("Rodriguez. Quietly. Marcus — go."),
      MARCUS("What happens to her?"),
      VINNIE("Nothing. The files disappear, she has nothing. She goes home and writes another story. I'm a businessman, not a monster."),
    ],
    outro: [
      JIMMY("Files secured. Rodriguez is breathing again."),
      MARCUS("He was crying. On the phone with Vinnie. I heard it through the radio."),
      JIMMY("Yeah. Well."),
      TANYA("[low, over phone] Marcus. Something's wrong. Not over the phone. Not at any of Vinnie's places. Can you find somewhere clean?"),
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
      TANYA("Don't say anything yet. Just listen. Vinnie has a list — people he's planning to remove. People who know too much about the Rodriguez arrangement."),
      MARCUS("How many people?"),
      TANYA("Six. You're on it. So am I."),
      MARCUS("When?"),
      TANYA("I don't know. But I've seen the communications. It's not 'if,' Marcus. It's 'when.'"),
      MARCUS("Why are you on it?"),
      TANYA("Because I know where the money comes from. And because I've been talking to you instead of just following orders."),
      MARCUS("You've been protecting me."),
      TANYA("I've been protecting myself. You're a side effect. Get to my location now."),
    ],
    outro: [
      TANYA("We can't run. He has Rodriguez and half the department."),
      MARCUS("Then we go forward. What does he have that would destroy him?"),
      TANYA("Everything is on a private server — every wire transfer, every payment to Rodriguez, the whole operation. The warehouse on Crest Road."),
      MARCUS("How heavily guarded?"),
      TANYA("Enough. But you've been in worse."),
      MARCUS("You said 'we.' Are you in on this?"),
      TANYA("Marcus. I've been in this city twelve years. I'm tired of running from something I helped build."),
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
      VINNIE("[smooth] Simple errand. Package at the warehouse on Harbor Street. My man will be there with it."),
      MARCUS("What kind of package?"),
      VINNIE("The kind worth five thousand for thirty minutes of your time. You've earned simple, Marcus."),
      MARCUS("Alright."),
      RODRIGUEZ("[radio, sharp] South Island PD. Vehicle on Harbor Street — you are surrounded. Step out with your hands up."),
      MARCUS("Vinnie. You sold me."),
      VINNIE("[distant, line drops]"),
    ],
    outro: [
      VOICE("He waited until I was worth something before he got rid of me. That's the economy of men like Vinnie — they invest in you until the return isn't worth the risk."),
      VOICE("Rodriguez had the warrant. Vinnie made one phone call. I had eighteen seconds between when I heard the sirens and when the exits closed."),
      VOICE("I've been in tighter corners. I told myself that. It helped, a little."),
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
      MARCUS("[phone, raw] Tanya. Tell me you didn't know."),
      TANYA("I didn't know. I swear on everything. Marcus, I found out twenty minutes ago—"),
      MARCUS("He handed me to Rodriguez. Four stars. I barely had a car."),
      TANYA("I know. Get to my apartment. Back streets only. Don't use anything connected to the crew."),
      MARCUS("And then?"),
      TANYA("Then we stop running."),
    ],
    outro: [
      TANYA("Look at you."),
      MARCUS("I'm fine."),
      TANYA("You're bleeding through your jacket."),
      MARCUS("I'm fine."),
      TANYA("[quietly] The server on Crest Road. Every wire transfer. Every payment to Rodriguez. The real ownership of every front business Vinnie's ever run."),
      MARCUS("If we get those files—"),
      TANYA("Neither of them can touch us. We hold the whole machine."),
      MARCUS("Let's go get it."),
      TANYA("[pause] After this... do you have somewhere to go? When it's over?"),
      MARCUS("I'll figure it out."),
      TANYA("Yeah. Me too."),
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
      TANYA("Four guards. Rotating every ninety minutes. The back office has a standard commercial lock — you can bypass it. The server is in a black case."),
      MARCUS("What if Vinnie's there?"),
      TANYA("He's at the casino. But his security chief, Dario, will be inside. Dario made his first killing at sixteen in Caracas."),
      MARCUS("He'll stand down?"),
      TANYA("No."),
      MARCUS("Alright."),
      TANYA("Marcus. This is the only copy. There's no backup if this goes wrong."),
      MARCUS("I never lose things."),
      TANYA("[quietly] I know."),
    ],
    outro: [
      MARCUS("I've got it. Rodriguez's accounts. Vinnie's operations. And something else — communication logs with a name I've never seen. 'The Broker.'"),
      TANYA("I've heard that name once. Vinnie mentioned it drunk, then went quiet like he'd said something he shouldn't."),
      MARCUS("Someone funded Vinnie from the beginning. Before the Deluca operation was anything."),
      TANYA("And someone with direct access to Rodriguez. Marcus — all of this, the setup, the betrayal — it wasn't just Vinnie."),
      MARCUS("It was never just Vinnie."),
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
      TANYA("Felix Mora. Vinnie's accountant for ten years. He manages The Broker's payments through three shell companies."),
      MARCUS("Is he dangerous?"),
      TANYA("He's sixty years old and does math. But the people protecting him aren't."),
      MARCUS("Where?"),
      TANYA("Eastside casino. Private room. Same table every Tuesday. Same drink. Same paranoid routine."),
      MARCUS("You've been watching him."),
      TANYA("I've been watching everyone, Marcus. That's how I'm still alive."),
    ],
    outro: [
      VOICE("He talked in the end. Not because he wanted to. Because the alternative was worse and he knew it."),
      VOICE("The Broker operates from a compound north of the city. Past the forest. A man who sees South Island City as a chessboard — and has never personally touched a piece."),
      MARCUS("Until now."),
      TANYA("[phone] Are you okay?"),
      MARCUS("I will be."),
      TANYA("That's not what I asked."),
      MARCUS("...No. Not really. But I'm not stopping."),
      TANYA("I know. That's what worries me."),
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // ACT 4 — WAR
  // ═══════════════════════════════════════════════════════════════════

  {
    id: "act4_m1",
    act: 4,
    name: "RESPECT",
    description: "Meet King Briggs — eliminate Vinnie's moles in the Razors",
    type: "eliminate",
    markerColor: "#ff4040",
    icon: "☠",
    reward: 2200,
    scoreReward: 2800,
    giveAmmo: 100,
    markerX: 6784, markerY: 6784,
    intro: [
      BRIGGS("Marcus Cole. You've got nerve, walking into Razor territory with a price on your head."),
      MARCUS("I've got Vinnie's files. And a proposition."),
      BRIGGS("Deluca's been trying to buy my people for two years. Why would I deal with anyone connected to him?"),
      MARCUS("I'm not connected to him anymore. I'm the man who's going to take him apart piece by piece. I just need the east side held while I work."),
      BRIGGS("Why would I do that?"),
      MARCUS("Because he's been paying three of your lieutenants to feed him intelligence. I have their names."),
      BRIGGS("[long silence] Give me the names."),
      MARCUS("Deal first."),
      BRIGGS("[slowly] You know — I've been doing this since I was seventeen. You're the first person in a long time who feels like a real human being sitting across from me."),
      MARCUS("Give me the deal and I'll keep being one."),
    ],
    outro: [
      BRIGGS("Clean work. No theatrics."),
      MARCUS("They were traitors. It's not a statement — it's a fact."),
      BRIGGS("Everything is a statement, Marcus. Whether you mean it to be or not."),
      MARCUS("What do you actually want out of this, Briggs?"),
      BRIGGS("I want this city to be what it was before Vinnie and whoever's behind him bought it. Doesn't mean it'll be clean. Just means it'll be honest about what it is."),
      MARCUS("Cut his cash flow first. His import truck at the Docklands — that's the main artery."),
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
      MARCUS("The import truck. Protection?"),
      BRIGGS("Six men rotating. Same route, every Thursday."),
      MARCUS("Today's Thursday."),
      BRIGGS("Funny coincidence. My people can back you up—"),
      MARCUS("I work alone on this. Too many bodies, too much noise."),
      BRIGGS("[pause] I underestimated you again."),
      MARCUS("People do."),
    ],
    outro: [
      BRIGGS("Heard it from the other side of the city."),
      MARCUS("Good."),
      BRIGGS("He's going to panic. Panicking men make mistakes. But we need something that'll hold in a courtroom — or at least in a press room."),
      MARCUS("Rodriguez. He's been keeping evidence as insurance against Vinnie. He's going to destroy it tonight."),
      BRIGGS("Then we go get it first."),
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
      BRIGGS("Rodriguez has kept physical records as protection against Vinnie. Call logs. Wire transfers. Original documents. He's going in to burn all of it tonight."),
      MARCUS("I'll go in alone. Less noise."),
      TANYA("Security rotates every eight minutes. There's a window — but you need to move fast and you need to be precise."),
      MARCUS("That's enough."),
      BRIGGS("Marcus. If this goes sideways—"),
      MARCUS("It won't."),
    ],
    outro: [
      MARCUS("Call logs. Wire transfers. Recordings. Twenty years of corruption in a single folder."),
      TANYA("This puts him away for the rest of his life."),
      MARCUS("Or we use it differently. Let him know we have everything, and make him help us get to whoever's above him."),
      BRIGGS("You want to flip a corrupt captain."),
      MARCUS("I want him to lead us to The Broker. There's a codename in the files — 'N-Tower.' Rodriguez is genuinely afraid of whoever's behind it. That fear is useful."),
      TANYA("Marcus... you've changed."),
      MARCUS("Yes."),
    ],
  },

  {
    id: "act4_m4",
    act: 4,
    name: "THE CAPTAIN'S END",
    description: "Confront and take down Captain Rodriguez",
    type: "eliminate",
    markerColor: "#4a90ff",
    icon: "☠",
    reward: 3000,
    scoreReward: 4000,
    markerX: 3584, markerY: 6144,
    intro: [
      MARCUS("Rodriguez. I have everything. Every payment, every favor, the warrant you issued for me, the Elena Cross cover-up. I have the N-Tower communications."),
      RODRIGUEZ("[shaking] How did you—"),
      MARCUS("I have twelve journalists who receive the full file simultaneously if anything happens to me or anyone I care about. I want the Broker. Real name. Location."),
      RODRIGUEZ("If I give you that, I'm a dead man."),
      MARCUS("You're already a dead man, Captain. The only question is whether justice or the Broker gets you first."),
      RODRIGUEZ("You think you're different from me, Cole? You think you're doing the right thing?"),
      MARCUS("No. I just made different choices."),
      RODRIGUEZ("[screaming] Kill him! Kill him and this whole thing goes away!"),
    ],
    outro: [
      VOICE("Rodriguez was a man who had told himself the story of his necessity so many times he believed it. That the city needed him dirty. That his corruption was the price of order."),
      VOICE("He was wrong. Corruption doesn't create order. It creates the appearance of order while everything underneath rots."),
      VOICE("I've done things in this city I won't forget. I'm not the hero of this story. I'm just the man still standing."),
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
      MARCUS("[phone] Vinnie. Rodriguez is in federal custody. Your files are with three news organizations."),
      VINNIE("[voice cracking] Marcus — wait. Please. The setup — Rodriguez forced my hand. I had no choice—"),
      MARCUS("You had a choice."),
      VINNIE("I can pay you. Whatever number you name. I have accounts in six countries, I can make you untouchable—"),
      MARCUS("Get in your car."),
      VINNIE("What?"),
      MARCUS("Drive. I want to see you try."),
      VINNIE("Marcus — I made you. I gave you everything. You were nothing when you walked into this city—"),
      MARCUS("Drive, Vinnie."),
    ],
    outro: [
      VOICE("Vinnie's last words were asking me to think about what I was doing. He was right. I had thought about it — for months."),
      MARCUS("[over the wreckage, quietly] You should have left the city. I would have let you go."),
      TANYA("[phone, urgent] Marcus. The Broker knows you're coming. He's been watching everything from the beginning. I found his real name."),
      TANYA("Solomon Voss. And Marcus — he's not running. He never thought we'd get this far."),
      MARCUS("Then he was wrong about that."),
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // ACT 5 — THE RECKONING
  // ═══════════════════════════════════════════════════════════════════

  {
    id: "act5_m1",
    act: 5,
    name: "FOLLOW THE SIGNAL",
    description: "Drive north to Voss's compound in the Aethelia forest",
    type: "reach",
    markerColor: "#c060ff",
    icon: "▲",
    reward: 2000,
    scoreReward: 2500,
    markerX: 5504, markerY: 4864,
    intro: [
      TANYA("Solomon Voss. He's been in this city nineteen years. He built Vinnie from nothing — the seed money, the Rodriguez introduction, all of it."),
      MARCUS("Why?"),
      TANYA("A city in controlled chaos is worth more than a stable one. He invests in conflict. Real estate devalued by crime, bought cheap, then gentrified once the 'problem' is solved. The problem he manufactured."),
      MARCUS("He burns the city down to buy the ashes."),
      TANYA("It's worked five times, in five cities. South Island City was number six."),
      MARCUS("Where is he?"),
      TANYA("North. Past the Aethelia forest. He has a private security firm — all former military. Marcus, this isn't Vinnie. Voss doesn't panic. He doesn't make mistakes."),
      MARCUS("Everyone panics eventually. They just need the right reason."),
    ],
    outro: [
      BROKER("[calm, over radio] Marcus Cole. I've been watching your progress with genuine admiration. You weren't what I expected when Deluca brought you in."),
      MARCUS("What did you expect?"),
      BROKER("A tool. Another instrument that would break when the pressure increased. But instruments don't come after the craftsman."),
      MARCUS("What are you, Solomon Voss?"),
      BROKER("Honest. The city is a machine. I simply keep it running — profitably."),
      MARCUS("You burned people's lives down for real estate."),
      BROKER("I create conditions. What people do within those conditions is their own choice. You of all people should understand that."),
      MARCUS("I'm coming."),
      BROKER("I know. I have seventeen armed men between you and me. And I'm still not concerned."),
      MARCUS("Start being concerned."),
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
      BROKER("[into radio] Kill him. Triple the standard rate. I want this to be thorough."),
      MARCUS("You built Vinnie Deluca from nothing. You engineered the corruption of this entire city from behind a desk. How many people have you never met whose lives you ended?"),
      BROKER("What an extraordinarily human question."),
      MARCUS("Answer it."),
      BROKER("I don't keep count. That's the fundamental difference between us, Mr. Cole. You give weight to individual lives. It slows you down. I see systems. You are a variable in a system."),
      MARCUS("Systems end."),
      BROKER("[to his guards] What are you waiting for? Kill him!"),
    ],
    outro: [
      BROKER("[fallen, barely audible] You think this is finished... You stopped one iteration. There are others... there are always others..."),
      MARCUS("[after a long silence] Maybe. But this city's done feeding you."),
      BROKER("You're going to carry all of this... it doesn't wash off, Marcus... none of it washes off..."),
      MARCUS("I know."),
      TANYA("[phone, soft] Marcus. Is it done?"),
      MARCUS("It's done."),
      TANYA("Come back. Please just come back."),
      MARCUS("...Yeah."),
    ],
  },

  {
    id: "act5_m3",
    act: 5,
    name: "YOUR CITY NOW",
    description: "Drive to the city overlook",
    type: "reach",
    markerColor: "#4cffb0",
    icon: "★",
    reward: 10000,
    scoreReward: 15000,
    markerX: 2944, markerY: 1664,
    intro: [
      VOICE("South Island City. I came here three years ago with forty dollars, a duffel bag, and something I was trying to outrun."),
      VOICE("I don't think you can outrun the things that made you. I think you carry them. The question is what you do while you're carrying them."),
      VOICE("Tanya's alive. Somewhere safe — she wouldn't tell me where, and I didn't ask. Briggs has the east side. Not clean, but honest about what it is."),
      VOICE("Rodriguez will spend the rest of his life in a federal cell. And Solomon Voss... the papers called it a 'private security incident.' Some things end quietly."),
      VOICE("The city's still broken. Cities are always broken. That's not the point."),
      VOICE("The point is who's breaking them."),
    ],
    outro: [
      VOICE("I drove north that morning. Past the harbor lots where I found Paco Ruiz."),
      VOICE("Past the warehouse on Crest Road where everything changed."),
      VOICE("Past the stretch of Harbor Street where Vinnie sold me out."),
      VOICE("All the way to the overlook north of the forest. Where you can see the whole city laid out below you — the water, the towers, the grid of streets where everything happened."),
      VOICE("I sat there for a long time."),
      MARCUS("...Alright. Enough."),
      VOICE("Yeah. Enough."),
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
