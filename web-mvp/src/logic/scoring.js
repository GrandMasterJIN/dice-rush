// Dice Rush - Scoring Engine

const COMBO_POINTS = {
  1: { 3: 100, 4: 200,  5: 1000 },
  2: { 3:  20, 4:  40,  5:  200 },
  3: { 3:  30, 4:  60,  5:  300 },
  4: { 3:  40, 4:  80,  5:  400 },
  5: { 3:  50, 4: 100,  5:  500 },
  6: { 3:  60, 4: 120,  5:  600 },
};

const STRAIGHT_SMALL = 125;
const STRAIGHT_LARGE = 250;

export function scoreDice(dice) {
  var combinations = [];
  var counts = {};

  for (var i = 0; i < dice.length; i++) {
    var d = dice[i];
    counts[d] = (counts[d] || 0) + 1;
  }

  var sorted = dice.slice().sort(function(a, b) { return a - b; }).join('');
  if (sorted === '12345') {
    return {
      total: STRAIGHT_SMALL,
      combinations: [{ label: 'Small Straight', points: STRAIGHT_SMALL, dice: dice.slice() }]
    };
  }
  if (sorted === '23456') {
    return {
      total: STRAIGHT_LARGE,
      combinations: [{ label: 'Large Straight', points: STRAIGHT_LARGE, dice: dice.slice() }]
    };
  }

  var total = 0;
  var faces = Object.keys(counts);

  for (var j = 0; j < faces.length; j++) {
    var face = Number(faces[j]);
    var count = counts[face];

    if (count >= 3) {
      var comboSize = Math.min(count, 5);
      var pts = COMBO_POINTS[face][comboSize];
      combinations.push({ label: comboSize + 'x ' + face + 's', points: pts });
      total += pts;

      var remaining = count - comboSize;
      if (remaining > 0) {
        if (face === 1) {
          total += 10 * remaining;
          combinations.push({ label: remaining + 'x single 1', points: 10 * remaining });
        } else if (face === 5) {
          total += 5 * remaining;
          combinations.push({ label: remaining + 'x single 5', points: 5 * remaining });
        }
      }
    } else {
      if (face === 1) {
        total += 10 * count;
        combinations.push({ label: count + 'x single 1', points: 10 * count });
      } else if (face === 5) {
        total += 5 * count;
        combinations.push({ label: count + 'x single 5', points: 5 * count });
      }
    }
  }

  return { total: total, combinations: combinations };
}

export function isZeroRoll(dice) {
  return scoreDice(dice).total === 0;
}