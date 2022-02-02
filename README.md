Chess960 board structure with useful methods. Somewhat derived from [Nibbler](https://github.com/rooklift/nibbler).

Usage notes:

* Get a board with `new_board_from_fen()`
* Get new boards with `board.move()` - this has no legality checks!
* So, check moves for illegality first with `board.illegal()`
* Moves are expected to be in UCI format, e.g. `e2e4` and `e7e8q` etc, *except:*
* Castling moves are always king-to-rook e.g. `e1h1` (which is Chess960 format)
* Given a move which might be the wrong format, pass it through `board.c960_castling_converter()` first

