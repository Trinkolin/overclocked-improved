# Overclocked – the improved version

This branch continues the game after the Devoxx Robot Games contest. **The contest version is unchanged**: it is still the `main` branch and the live site <https://trinkolin.github.io/overclocked/>. Everything below only exists here, and online at <https://trinkolin.github.io/overclocked-improved/>.

Where this file and the [README](README.md) disagree, this file describes the improved version; the README describes the game as submitted.

## 1. The real building

The Kinepolis Antwerp was rebuilt from real sources: the official Kinepolis and Devoxx floor plans (laid over the game in yellow to check every wall), the Devoxx drone video, the sponsors' booth photos, the Kinepolis virtual tour, and Jessica's memory of the venue.

**First floor**
- Rooms 3 to 10 at the plan's size, with the doors and stairs where the plan has them. Seat counts stay those of the Devoxx plan.
- Rooms 3 to 10 are counted seat by seat (Jessica, from the Kinepolis virtual tour), with a projection room the whole width of the back wall.
- Each room looks like the virtual tour: anthracite walls, a plain dark carpet (aisles included), and its own aisles, with a low wall along each side of them.
  - Room 5: 7 + 18 + 7 seats per row, 12 rows up to the cross aisle and 8 behind it; on the door side, right behind the cross aisle, 5 rows of only 4 seats.
  - Room 7: 17 rows of 4 + 18 + 4, the cross aisle after the 5th row as in room 6; on the door side, 4 seats only in the first 3 and the last 5 rows.
  - Room 8: 7 + 18 + 7 seats per row, 12 rows in front of the cross aisle and 12 behind it; on the door side, right behind the cross aisle, 5 rows of only 4 seats.
  - Room 6: 4 + 18 + 4 seats, 5 rows in front of the cross aisle and 12 behind it; on the door side, 4 seats only in the first 4 and the last 6 rows.
  - Room 9: 4 + 19 + 4 seats, 6 rows in front of the cross aisle and 11 behind it; on the door side, 4 seats only in the first 4 and the last 5 rows.
  - Room 4: 17 rows of 3 + 17 + 3, the cross aisle after the 6th row; on the door side, 3 seats only in the first 4 and the last 5 rows, the way in between. Red LEDs on the steps only.
  - Room 3: 16 rows of 19, the cross aisle after the 5th, 3 more seats by the door aisle in the first and last 4 rows, the way in along a railing.
  - Room 10: 13 rows of 16, a single aisle behind a low wall with 3 more seats beyond it in the last 5 rows, and two wheelchair places where the front row is 4 seats short.
- Railings where the way in from the door meets the seats: across it where the back rows' side seats start (rooms 3, 4, 6, 7, 9 and 10), and along the 4 seats in rooms 5 and 8.
- The standing tables in the corridor are longer and stand against the walls, between the doors of rooms 6 and 5 and of rooms 7 and 8.
- Corridor pillars from the plan, plain black, without the fabric-sail discs.
- Room numbers are drawn above the crowd, so they stay readable during talks.

**Ground floor**
- Drawn at the plan's real scale (it used to be squeezed to fit the screen). On a big screen it is shown a little bigger than the whole floor: the bottom of the BOF rooms and the toilets may go out of sight. Smaller screens scroll.
- Reception: wide stairs, desk, toilets and charging corner placed from the plan; the wall along the stairs is longer.
- Exhibition hall like the drone video:
  - dark carpet, plain white pillars on the plan's grid
  - 29 booths side by side, styled like the sponsors' photos (roll-up banners and a pop-up counter); you can walk onto a booth's carpet, only its banners and counter are in the way. No names on them.
  - no booths in front of the stairs; the coffee station sits between the two flights
  - a bike corner, away from the wheelchair ramp, and the "exchange · share · celebrate" words
- Hall stairs walled all round, with doors above and below the landing.
- Hall toilets entered through a door in the top wall, with a passage to the block.
- Wheelchair ramp and polo pickup where the Devoxx plan has them.
- BOF rooms: two separate rooms, their double doors in the middle of the front wall, with more rows of tables, a centre aisle and chairs.

## 2. Gameplay and balance

- **The doors open at 8:30.** A fifth of the attendees are already in; the others come in by the main entrance until 9:00. The days are a few seconds longer for it, so from 9:00 on they keep their pace.
- **About 3,000 attendees**, as at Devoxx: each person sitting in a talk stands for about 60 real ones, so the rooms look as full as they would be.
- **Talks in their real rooms.** Every session has its title and room from the Devoxx schedule (refreshed on 4 October). The closing keynote is in Room 5, so that's where everyone heads on Thursday evening. And on Thursday at 12:55, Room 10 shows "The Devoxx Robot Games".
- **The exhibition opens on Tuesday**, as in the Devoxx FAQ (the booths used to open on Monday at 14:00).
- **Biggy is sturdier in crowds.** Its own fans take one photo fewer, and a crowd carried away around it calms down twice as fast. Calming a group costs Biggy no more than calming one fan.
- **Crowd fatigue fits each job.** Voxxy, the light technician, tires fastest in a crowd (×1.2). Droid, the guide, is the reference (×1). Biggy, built for crowds, tires slowest (×0.8). Several fans at once still hurt, but each extra fan counts half.
- **Voxxy reminder.** While you steer Voxxy, a breakdown left waiting for 12 seconds brings a reminder: go to the ⚠, or switch robots and let the AI fix it.
- **AI robots give way to each other.** They steer round one another and keep right; in tests they touch each other 14 times less often.
- **Spills come from someone.** Coffee, soda or popcorn lands at the feet of an attendee, never in an empty spot.
- **Kinder fans.** The fans who follow a robot are friendly about it: no more "Boring!" when it doesn't stop for them.

## 3. Interface

- **Quit button** in the top-right corner. It asks before ending the game and going back to the title screen.
- **Speech bubbles** for robots and attendees: a little pop, then the words with a light shimmer, without the typing dots. Robots speak in their own colour (Voxxy orange, Droid gold, Biggy blue); people speak in white bubbles. The messages above the robot cards take the colour of the robot they are about.
- **Messages about a booth** just say "a booth in the hall": the ⚠ shows which one.
- Shorter messages: the floating "hold E" label and the "(hold E)" reminders are gone. E still works as before.
- A clearer welcome: the robots work on their own, and your job is to look after them.

## 4. Bug fixes

- The downstairs charging base was unreachable for the AI: its target pointed to the old position.
- The two BOF rooms had no wall between them.
- The cleaning robot could start inside a booth.
- Grey edges around pillars, tables and booths: every solid is now aligned to the navigation grid.
- A stray wall above the main entrance: the hall toilets reached past the right edge of the map, and the navigation grid wrapped that part round to its left edge. Shapes are now clipped to the map.

## Tests

`npm test` runs the 65 scripted checks, and they all pass. The hallway test uses seed 3: the 8:30 start changed the random draw.

## How it was built

Same as the game: designed by Jessica Colin, built with Claude (see [GENAI.md](GENAI.md)). Jessica didn't write any code. She played, said what was wrong, and decided. Two things made the difference for the building:

- **The plans laid over the game.** The official plans had been there from the start, but they only paid off once Claude drew them in yellow on top of the game: every wall in the wrong place showed at a glance.
- **Counting instead of pictures.** From photos of the rooms alone, Claude kept getting the seating wrong. It worked once Jessica counted the seats herself, room by room and row by row, and wrote the numbers down. The booths were done the same way, from memory, so they are close rather than exact.
