**Chess** and/or **Chess960** board structure with useful methods. Somewhat derived from [Nibbler](https://github.com/rooklift/nibbler), but also somewhat new and improved. Everything useful is in `board.js`, other files are just for testing.

Surely fast enough for GUI use, though you likely don't want to build an engine around it.

## Usage notes:

* Get a board with `load_fen()`
* Get new boards with `board.move()` - this has no legality checks!
* So, check moves for illegality first with `board.illegal()`
* Moves are expected to be in UCI format, e.g. `e2e4` and `e7e8q` etc, *except:*
* Castling moves are always king-to-rook e.g. `e1h1` (which is Chess960 format)
* Given a move which might be the wrong format, pass it through `board.c960_castling_converter()` first
* All legal moves for a board can be found with `board.movegen()`
* Various other useful methods exist, for PGN parsing, end of game detection, etc

## Example:

```javascript

const {new_board_from_fen} = require("./board");

let foo = load_fen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");

// Obtain a move from some source, e.g. engine / user input.

let move = "e2e4";
move = foo.c960_castling_converter(move);    // Always OK and wise to do this.

if (!foo.illegal(move)) {                    // Note: returns a string (reason for illegality or "")
    foo = foo.move(move);
}

console.log(foo.graphic());
```
