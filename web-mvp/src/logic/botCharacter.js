// Dice Rush — Bot Character System
// Two characters from the same back-room social club world.
// Teddy Ash  — Easy  — enthusiastic newcomer
// Constance Hale — Hard — dry wit, long-standing fixture

var CHARACTERS = {
  easy: {
    name:     'Teddy Ash',
    monogram: 'TA',
    title:    'The New Regular',
    lines: {
      'game-start':      ["Let's go!", "Finally, my turn!", "I've been warming up for this."],
      'rolling':         ["Come on, come on!", "Yes! Keep going!", "Ooh, not bad!"],
      'banking':         ["I'll take it!", "Safe and sound!", "Locked in!"],
      'busting':         ["Aw, no way!", "Every time!", "That one hurt."],
      'hot-dice':        ["Wait — ALL of them?!", "This is my moment!", "Oh we are ROLLING!"],
      'five-of-a-kind':  ["Are you kidding me?!", "That's never happened before!", "FIVE?!"],
      'player-banks':    ["Smart move.", "Good call.", "Wish I did that."],
      'player-busts':    ["Oh ouch.", "Better you than me!", "That's the game."],
      'player-hot-dice': ["No no no no no.", "How does that keep happening?", "Okay that's just unfair."],
      'winning':         ["I actually won!", "Did everyone see that?!", "Teddy Ash, baby!"],
      'losing':          ["One more round?", "I was so close.", "Constance would've won that."],
    },
  },
  hard: {
    name:     'Constance Hale',
    monogram: 'CH',
    title:    'The House',
    lines: {
      'game-start':      ["Shall we.", "Again.", "Don't take too long."],
      'rolling':         ["Acceptable.", "Mm.", "As expected."],
      'banking':         ["Enough.", "That'll do.", "I know when to stop."],
      'busting':         ["Unfortunate.", "First time this week.", "The dice have opinions."],
      'hot-dice':        ["How tidy.", "Well then.", "The room is watching."],
      'five-of-a-kind':  ["That happens.", "Once in a while.", "Don't get used to it."],
      'player-banks':    ["Wise.", "Playing it safe, I see.", "Noted."],
      'player-busts':    ["Mm.", "Patience is free.", "The house always remembers."],
      'player-hot-dice': ["Enjoy it.", "Even clocks are right twice.", "Interesting."],
      'winning':         ["As expected.", "Thank you for the game.", "Next time, perhaps sooner."],
      'losing':          ["Hm.", "You earned that.", "Don't make a habit of it."],
    },
  },
};

// Returns the character object for the given difficulty ('easy' | 'hard')
export function getBotCharacter(difficulty) {
  return CHARACTERS[difficulty] || CHARACTERS.easy;
}

// Returns a random dialogue line for the given trigger event.
// Returns null if no lines exist for the trigger.
export function getBotLine(character, trigger) {
  var lines = character.lines[trigger];
  if (!lines || !lines.length) return null;
  return lines[Math.floor(Math.random() * lines.length)];
}
