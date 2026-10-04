// What attendees say. Written with generative AI (Claude) and reviewed by hand: several
// variants per situation so the same line doesn't keep coming back. {room} is filled in.
export const LINES = {
  // an unhappy attendee, complaining to the robot in charge
  complain_projector: [
    'The screen in {place} is still dead!',
    '{place} has been dark for ages!',
    'We\'re watching a black screen in {place}!',
    'The speaker in {place} is miming slides!',
    'Is {place} doing an audio-only talk now?',
    'Hello? {place}? The projector?',
    'I came for slides, {place} has none!',
    '{place}: 400 people, zero pixels.',
    'Did someone unplug {place}?',
    'My talk in {place} has no screen!',
  ],
  complain_wifi: [
    'The Wi-Fi in {place} is dead again!',
    'No Wi-Fi in {place}, the live demo just died!',
    'How do I tweet about {place} with no Wi-Fi?',
    '{place}: zero bars. ZERO.',
    'The speaker in {place} can\'t reach GitHub!',
    'Wi-Fi in {place}, please, my build is waiting!',
  ],
  complain_mic: [
    'We can\'t hear a thing in {place}!',
    'The mic in {place} is dead!',
    '{place} is a mime show now!',
    'Louder! Oh wait, the mic in {place} is off.',
    'The back rows of {place} hear nothing!',
  ],
  complain_popcorn: [
    'The popcorn machine is stuck!',
    'No popcorn? What is a cinema without popcorn?',
    'I can smell it, but nothing comes out!',
  ],
  complain_exit: ['Excuse me, can we get past?', 'Could you let us through, please?', 'People are sitting right on the stairs…', 'That\'s the emergency exit, you know.'],
  exit_move: ['Oh, sorry! We\'ll move.', 'Right, the stairs. Sorry!', 'Oops, we were in the way.', 'Sure, we\'ll find a seat.', 'Our bad, big guy!'],
  complain_bag: [
    'There is a bag nobody is watching!',
    'Whose bag is that? Security?',
    'Someone should check that bag.',
  ],
  complain_coffee: [
    'THE COFFEE MACHINE IS EMPTY!',
    'No coffee? At a developer conference?!',
    'I can\'t debug without coffee!',
    'Refill the coffee, please, I\'m begging you!',
    'Who emptied the coffee machine?!',
    'Coffee. Now. Please.',
  ],
  complain_booth: [
    'Our booth has no power!',
    'The demo at our booth just died!',
    'No power at the booth, the swag printer stopped!',
    'Can someone fix the power at our booth?',
  ],
  complain_toilets: [
    'The toilets are blocked! Again!',
    'Out of order. Of course. Right before the next talk.',
    'Someone needs to fix {place}. Urgently.',
    'Where do I go now? The toilets are closed!',
  ],
  complain_badges: [
    'I can\'t get my badge, the printer is jammed!',
    'No badge, no talks! Fix the printer!',
    'The queue at reception isn\'t moving!',
    'Paper jam. At a tech conference.',
  ],
  lost_waiting: [
    "I'm going to miss the start of the talk…",
    'Room {room}… anyone? Where is it?',
    'I have been walking in circles for ages.',
    'Is there a map somewhere?',
  ],
  bag_owner: ['Oh, my bag! Thanks, big guy.', 'Sorry! I went for a coffee.', 'My laptop! Thank you!', 'Oops, that\'s mine. Sorry!'],
  // a fan moving on when Biggy walks by: they're kind, they just see the robot is busy
  gives_selfie: [
    'Wow, Biggy! Selfie later, then!',
    'It looks busy. I\'ll come back!',
    'Maybe after lunch…',
    'I\'ll get my selfie later!',
  ],
  gives_poker: [
    'Oh, it\'s working. Later!',
    'I was just curious…',
    'OK, I\'ll let it work!',
    'Just one button? Later, then.',
  ],
  // a pest that got what it came for, and leaves the robot alone
  done_selfie: ['Perfect shot! 😍', 'Got it! Thanks, {name}!', 'Posting this right now!', 'One for the team chat!', 'My kids will love this!'],
  done_poker: ['Cool, it beeped!', 'Ha, that one lights up!', 'OK, I pressed them all.', 'So that\'s what it does!'],
  // (only you look after the robots: the fans just lose interest, they don't tell it to rest)
  bored: [
    'It\'s plugged in. Boring!',
    'No selfie with a cable. Later!',
    'OK, I\'ll find another robot.',
    'Fine, I\'ll go and see a talk.',
  ],
  // a fan who gets carried away ("just one more!"), calming down when Biggy stands by, or running out of steam
  carried_selfie: ['Just one more! And one with my team!', 'Everyone, come see! A selfie with {name}!', 'One more from this side! And this side!'],
  carried_poker: ['What does THIS one do? Guys, come see!', 'Just one more button! And that one!', 'It beeps! Everyone, come!'],
  gives_carried: ['Sorry, we got carried away!', 'OK, one each. Got it!', 'Right, it\'s working. Thanks, Biggy!', 'We\'ll let it breathe. Sorry!'],
  carried_done: ['OK, that\'s enough photos for today!', 'Best. Robot. Ever. Bye!', 'Right, the next talk!'],
  // a robot that doesn't know when to stop (under 30 energy, still working)
  overwork_voxxy: ['Just one more fix…', 'Break? After this one.', 'I\'m fine! Totally fine.'],
  overwork_droid: ['One more guest, then a rest. Maybe.', 'The lounge? I know the way. Later.'],
  overwork_biggy: ['Still on duty. Probably.', 'Security never sleeps. Ugh.'],
  // a robot someone stays with: it hadn't noticed how tired it was
  comforted: ['oh… I needed that.', 'Thanks. I didn\'t notice I was that tired.', 'Better. Much better.'],
  // a toilet break, when you send a robot there (it would never think of it on its own)
  toilet_voxxy: ['Pit stop: draining the coolant!', 'Oil change. Don\'t ask.', 'Two minutes, then I fix everything again.'],
  toilet_droid: ['Occupied! Even a guide needs a minute.', 'I know every toilet in the building. Finally, one for me.', 'Emptying the scrap tray…'],
  toilet_biggy: ['Occupied. Security is… busy.', 'Nobody comes in. Security orders.', 'Emptying the scrap tray. A big job.'],
  // pests doing their thing
  // lost attendees and the guide
  follow: [
    'Room {room}? I\'ll follow you!',
    'Oh, you know the way to Room {room}?',
    'Lead the way to Room {room}!',
    'Room {room}, please! Right behind you.',
  ],
  found: [
    'Found Room {room}, thanks!',
    'Room {room}, finally!',
    'Just in time for the talk!',
    'Thanks, robot! Room {room} at last.',
  ],
  // everyday Devoxx
  spill_coffee: ['oops, my coffee!', 'noooo, my coffee!', 'who put a floor there?', 'my latte!'],
  spill_popcorn: ['oops, my popcorn!', 'popcorn everywhere…', 'my snack!', 'free popcorn, anyone?'],
  spill_soda: ['oops, my cola!', 'sticky floor, sorry!', 'my soda!', 'it was a full can…'],
  slip: ['whoa!', 'slippery!', 'careful!', 'woops!'],
  bumped: ['ouch!', 'hey!', 'watch it, big guy!', 'oof!'],
  // a friendly word that fits the robot it's said to
  nice_voxxy: ['Zoom zoom, little one!', 'Love the orange one!', 'You fixed our projector earlier!', 'So fast! Always on the move!'],
  nice_droid: ['Thanks for showing everyone the way!', 'You got me to my room earlier. Thanks!', 'Tall, patient and always right. Respect.'],
  nice_biggy: ['Thanks for keeping the stairs clear, big guy!', 'Gentle giant!', 'I feel safer with you around.'],
  nice: [
    'Thanks for keeping Devoxx running!',
    'Stephan says thanks for keeping Devoxx running!',
    'Got my Devoxx polo! Thanks, robots!',
    'You robots are doing great!',
    'Great conference so far!',
    'Nice work today, robots!',
    'Coffee? Oh right, you take espresso!',
  ],
};

const lastSaid = {}; // never the same line twice in a row for the same situation
export function say(kind, vars = {}) {
  const pool = LINES[kind];
  let line = pool[(Math.random() * pool.length) | 0];
  if (line === lastSaid[kind] && pool.length > 1) line = pool[(pool.indexOf(line) + 1 + ((Math.random() * (pool.length - 1)) | 0)) % pool.length];
  lastSaid[kind] = line;
  return line.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}
