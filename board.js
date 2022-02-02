"use strict";

function index_from_args(arg1, arg2) {

	// A few things can be called with a variety of arg types...

	let type1 = typeof(arg1);
	let type2 = typeof(arg2);

	if (type1 === "string") {
		let a = arg1.charCodeAt(0);
		let b = arg1.charCodeAt(1);
		return (a - 97) + ((56 - b) * 8);
	} else if (type1 === "number" && type2 === "number") {
		return arg1 + (arg2 * 8);
	} else if (type1 === "number" && type2 === "undefined") {
		return arg1;
	} else {
		throw new Error(`index_from_args(${arg1}, ${arg2}): bad args`);
	}
}

const mailbox = [
	-1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
	-1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
	-1,  0,  1,  2,  3,  4,  5,  6,  7, -1,
	-1,  8,  9, 10, 11, 12, 13, 14, 15, -1,
	-1, 16, 17, 18, 19, 20, 21, 22, 23, -1,
	-1, 24, 25, 26, 27, 28, 29, 30, 31, -1,
	-1, 32, 33, 34, 35, 36, 37, 38, 39, -1,
	-1, 40, 41, 42, 43, 44, 45, 46, 47, -1,
	-1, 48, 49, 50, 51, 52, 53, 54, 55, -1,
	-1, 56, 57, 58, 59, 60, 61, 62, 63, -1,
	-1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
	-1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
];

const mailbox64 = [
	21, 22, 23, 24, 25, 26, 27, 28,
	31, 32, 33, 34, 35, 36, 37, 38,
	41, 42, 43, 44, 45, 46, 47, 48,
	51, 52, 53, 54, 55, 56, 57, 58,
	61, 62, 63, 64, 65, 66, 67, 68,
	71, 72, 73, 74, 75, 76, 77, 78,
	81, 82, 83, 84, 85, 86, 87, 88,
	91, 92, 93, 94, 95, 96, 97, 98,
];

const knight_attacks = [-21, -19, -8, 12, 21, 19, 8, -12];
const rook_attacks = [-10, 1, 10, -1];
const bishop_attacks = [-11, -9, 11, 9];
const queen_attacks = rook_attacks.concat(bishop_attacks);
const king_attacks = rook_attacks.concat(bishop_attacks);

const white_p_push = -10;
const black_p_push = 10;

const white_p_caps = [-11, -9];
const black_p_caps = [11, 9];

// ------------------------------------------------------------------------------------------------

function new_board(state = null, active = "w", castling = "", enpassant = null, halfmove = 0, fullmove = 1, normalchess = false, wk = null, bk = null) {

	// Dangers:
	//
	// - Some functions -- new_board_from_fen() and move() -- are allowed to mutate things
	//   while updating, which means they have a board which is invalid for some time.
	//
	// - wk and bk need to be kept in sync with state. Currently this is managed by only
	//   ever adjusting state via set() which does that automatically.

	let ret = Object.create(board_prototype);

	if (state) {
		ret.state = Array.from(state);
	} else {
		ret.state = [
			"", "", "", "", "", "", "", "",
			"", "", "", "", "", "", "", "",
			"", "", "", "", "", "", "", "",
			"", "", "", "", "", "", "", "",
			"", "", "", "", "", "", "", "",
			"", "", "", "", "", "", "", "",
			"", "", "", "", "", "", "", "",
			"", "", "", "", "", "", "", "",
		];
	}

	ret.active = active;
	ret.castling = castling;
	ret.enpassant = enpassant;			// index (16-23 or 40-47) or null
	ret.halfmove = halfmove;
	ret.fullmove = fullmove;
	ret.normalchess = normalchess;

	// We store the white and black king locations.
	// We rely on the fact that state is only ever mutated by this.set() which adjusts these as required.

	ret.wk = wk;						// index (0-63) of K
	ret.bk = bk;						// index (0-63) of k

	return ret;
}

const board_prototype = {

	copy: function() {
		return new_board(this.state, this.active, this.castling, this.enpassant, this.halfmove, this.fullmove, this.normalchess, this.wk, this.bk);
	},

	get: function(arg1, arg2) {										// Can call with "h1" or (7, 7) or (63)
		let index = index_from_args(arg1, arg2);
		return this.state[index];
	},

	set: function(c, arg1, arg2) {
		let index = index_from_args(arg1, arg2);
		this.state[index] = c;
		if (c === "K") this.wk = index;
		if (c === "k") this.bk = index;
	},

	colour: function(arg1, arg2) {
		let piece = this.get(arg1, arg2);
		if (piece === "") {
			return "";
		} else if (piece === "K" || piece === "Q" || piece === "R" || piece === "B" || piece === "N" || piece === "P") {
			return "w";
		} else {
			return "b";
		}
	},

	inactive: function() {
		return this.active === "w" ? "b" : "w";
	},

	active_king_index() {
		return this.active === "w" ? this.wk : this.bk;
	},

	inactive_king_index() {
		return this.active === "w" ? this.bk : this.wk;
	},

	graphic: function() {
		let units = [];
		for (let y = 0; y < 8; y++) {
			units.push("\n");
			for (let x = 0; x < 8; x++) {
				units.push(this.get(x, y) === "" ? "." : this.get(x, y));
				if (x < 7) {
					units.push(" ");
				}
			}
			if (y === 7) {
				units.push("  ");
				units.push(this.fen());
			}
		}
		units.push("\n");
		return units.join("");
	},

	find: function(piece, startx, starty, endx, endy) {

		// Find all pieces of the specified type (colour-specific).
		// Search range is INCLUSIVE. Result returned as a list of indices.
		// You can call this function with just a piece to search the whole board.

		if (startx === undefined) startx = 0;
		if (starty === undefined) starty = 0;
		if (endx === undefined) endx = 7;
		if (endy === undefined) endy = 7;

		// Calling with out of bounds args should also work...

		if (startx < 0) startx = 0;
		if (startx > 7) startx = 7;
		if (starty < 0) starty = 0;
		if (starty > 7) starty = 7;
		if (endx < 0) endx = 0;
		if (endx > 7) endx = 7;
		if (endy < 0) endy = 0;
		if (endy > 7) endy = 7;

		let ret = [];

		for (let x = startx; x <= endx; x++) {
			for (let y = starty; y <= endy; y++) {
				let index = x + (y * 8);
				if (this.state[index] === piece) {
					ret.push(index);
				}
			}
		}

		return ret;
	},

	attacked: function(defender_colour, arg1, arg2) {

		let index = index_from_args(arg1, arg2);
		let initial_mail = mailbox64[index];

		for (let attack of rook_attacks) {
			let mail = initial_mail;
			let dist = 0;
			while (true) {
				mail += attack;
				dist++;
				let sq_index = mailbox[mail];
				if (sq_index === -1) {
					break;
				}
				let sq_piece = this.state[sq_index];
				if (sq_piece === "") {
					continue;
				}
				// At this point we've hit a piece so we're either returning true or breaking this attack loop.
				if (defender_colour === "w") {
					if (sq_piece === "q" || sq_piece === "r" || (sq_piece === "k" && dist === 1)) {
						return true;
					}
				} else {
					if (sq_piece === "Q" || sq_piece === "R" || (sq_piece === "K" && dist === 1)) {
						return true;
					}
				}
				break;
			}
		}

		for (let attack of bishop_attacks) {
			let mail = initial_mail;
			let dist = 0;
			while (true) {
				mail += attack;
				dist++;
				let sq_index = mailbox[mail];
				if (sq_index === -1) {
					break;
				}
				let sq_piece = this.state[sq_index];
				if (sq_piece === "") {
					continue;
				}
				// At this point we've hit a piece so we're either returning true or breaking this attack loop.
				if (defender_colour === "w") {
					if (sq_piece === "q" || sq_piece === "b") {
						return true;
					} else if (dist === 1) {
						if (sq_piece === "k") {
							return true;
						} else if (sq_piece === "p" && attack < 0) {		// i.e. it's -9 or -11, we're looking NE or NW along the line
							return true;
						}
					}
				} else {
					if (sq_piece === "Q" || sq_piece === "B") {
						return true;
					} else if (dist === 1) {
						if (sq_piece === "K") {
							return true;
						} else if (sq_piece === "P" && attack > 0) {		// i.e. it's 9 or 11, we're looking SW or SE along the line
							return true;
						}
					}
				}
				break;
			}
		}

		for (let attack of knight_attacks) {		// Rather different logic, careful...
			let mail = initial_mail + attack;
			let sq_index = mailbox[mail];
			if (sq_index === -1) {
				continue;
			}
			let sq_piece = this.state[sq_index];
			if (sq_piece === "n" && defender_colour === "w") {
				return true;
			}
			if (sq_piece === "N" && defender_colour === "b") {
				return true;
			}
		}

		return false;
	},

	fen: function(friendly_flag = false) {

		let s = "";
		let blanks = 0;

		for (let i = 0; i < 64; i++) {
			if (this.state[i] === "") {
				blanks++;
			} else {
				if (blanks > 0) {
					s += blanks.toString();
					blanks = 0;
				}
				s += this.state[i];
			}
			if (i % 8 === 7) {
				if (blanks > 0) {
					s += blanks.toString();
					blanks = 0;
				}
				if (i !== 63) {
					s += "/";
				}
			}
		}

		// FIXME: possibly implement book mode.

		let ep_string = this.enpassant ? i_to_s(this.enpassant) : "-";
		let castling_string = this.castling !== "" ? this.castling : "-";

		// While interally (and when sending to the engine) we always use Chess960 format,
		// we can return a more friendly FEN if asked (and if the position is normal Chess).
		// Relies on our normalchess flag being accurate... (potential for bugs there).

		if (friendly_flag && this.normalchess && castling_string !== "-") {
			let new_castling_string = "";
			if (castling_string.includes("H")) new_castling_string += "K";
			if (castling_string.includes("A")) new_castling_string += "Q";
			if (castling_string.includes("h")) new_castling_string += "k";
			if (castling_string.includes("a")) new_castling_string += "q";
			castling_string = new_castling_string;
		}

		return s + ` ${this.active} ${castling_string} ${ep_string} ${this.halfmove} ${this.fullmove}`;
	},

	compare: function(other) {
		if (this.active !== other.active) return false;
		if (this.castling !== other.castling) return false;
		if (this.enpassant !== other.enpassant) return false;
		for (let i = 0; i < 64; i++) {
			if (this.state[i] !== other.state[i]) {
				return false;
			}
		}
		return true;
	},

	move: function(s) {

		// s is some valid UCI move like "d1f3" or "e7e8q". For the most part, this function
		// assumes the move is legal - all sorts of weird things can happen if this isn't so.

		// Note castling must be given as king-to-rook e.g. e1h1

		let source = s.slice(0, 2);											// e.g. "e1"
		let target = s.slice(2, 4);
		let [x1, y1] = s_to_xy(source);										// e.g. [4, 7]
		let [x2, y2] = s_to_xy(target);
		let source_piece = this.get(x1, y1);
		let target_piece = this.get(x2, y2);

		let ret = this.copy();

		let pawn_flag = source_piece === "P" || source_piece === "p";
		let castle_flag = (source_piece === "K" && target_piece === "R") || (source_piece === "k" && target_piece === "r");
		let capture_flag = !castle_flag && target_piece !== "";

		if (pawn_flag && x1 !== x2) {										// The above test for captures doesn't catch e.p captures, so...
			capture_flag = true;
		}

		// Update castling...

		if (source_piece === "K" && y1 === 7) {
			ret.__delete_white_castling();
		}

		if (source_piece === "k" && y1 === 0) {
			ret.__delete_black_castling();
		}

		if (source_piece === "R" && y1 === 7) {
			ret.__delete_castling_char(source[0].toUpperCase())
		}

		if (source_piece === "r" && y1 === 0) {
			ret.__delete_castling_char(source[0]);
		}

		if (target_piece === "R" && y2 === 7) {
			ret.__delete_castling_char(target[0].toUpperCase())
		}

		if (target_piece === "r" && y2 === 0) {
			ret.__delete_castling_char(target[0])
		}

		// Update move counters...

		if (this.active === "b") {
			ret.fullmove++;
		}

		if (pawn_flag || capture_flag) {
			ret.halfmove = 0;
		} else {
			ret.halfmove++;
		}

		// Handle the moves of castling...

		if (castle_flag) {
			ret.set("", x1, y1);
			ret.set("", x2, y2);
			if (x2 > x1) {
				ret.set(source_piece, 6, y1);
				ret.set(target_piece, 5, y1);
			} else {
				ret.set(source_piece, 2, y1);
				ret.set(target_piece, 3, y1);
			}
		}

		// Delete e.p. captured pawn...

		if (pawn_flag && capture_flag && target_piece === "") {
			ret.set("", x2, y1);
		}

		// Set the enpassant square... only if potential capturing pawns are present.

		ret.enpassant = null;

		if (pawn_flag && y1 === 6 && y2 === 4) {		// White pawn advanced 2
			if ((x1 > 0 && ret.get(x1 - 1, 4) === "p") || (x1 < 7 && ret.get(x1 + 1, 4) === "p")) {
				ret.enpassant = xy_to_i(x1, 5);
			}
		}

		if (pawn_flag && y1 === 1 && y2 === 3) {		// Black pawn advanced 2
			if ((x1 > 0 && ret.get(x1 - 1, 3) === "P") || (x1 < 7 && ret.get(x1 + 1, 3) === "P")) {
				ret.enpassant = xy_to_i(x1, 2);
			}
		}

		// Actually make the move (except we already did castling)...

		if (!castle_flag) {
			ret.set(ret.get(x1, y1), x2, y2);
			ret.set("", x1, y1);
		}

		// Handle promotions...

		if (y2 === 0 && pawn_flag) {
			ret.set(s[4].toUpperCase(), x2, y2);		// Will throw if s.length === 4, that's fine.
		}

		if (y2 === 7 && pawn_flag) {
			ret.set(s[4].toLowerCase(), x2, y2);
		}

		// Swap active...

		ret.active = this.inactive();
		return ret;
	},

	__delete_castling_char: function(delete_char) {
		let new_rights = "";
		for (let ch of this.castling) {
			if (ch !== delete_char) {
				new_rights += ch;
			}
		}
		this.castling = new_rights;
	},

	__delete_white_castling: function() {
		let new_rights = "";
		for (let ch of this.castling) {
			if ("a" <= ch && ch <= "h") {		// i.e. black survives
				new_rights += ch;
			}
		}
		this.castling = new_rights;
	},

	__delete_black_castling: function() {
		let new_rights = "";
		for (let ch of this.castling) {
			if ("A" <= ch && ch <= "H") {		// i.e. white survives
				new_rights += ch;
			}
		}
		this.castling = new_rights;
	},

	no_moves: function() {

		for (let i = 0; i < 64; i++) {
			if (this.state[i]) {
				for (let move of this.pseudolegals(i)) {
					let board = this.move(move);
					if (!board.__can_capture_king()) {
						return false;
					}
				}
			}
		}

		return true;
	},

	movegen: function() {

		let ret = [];

		for (let i = 0; i < 64; i++) {
			if (this.state[i]) {
				for (let move of this.pseudolegals(i)) {
					let board = this.move(move);
					if (!board.__can_capture_king()) {
						ret.push(move);
					}
				}
			}
		}

		return ret;
	},

	pseudolegals: function(i) {

		// Don't assume anything about what's on i.

		if (this.colour(i) !== this.active) {
			return [];
		}

		let piece = this.get(i);

		if (piece === "P" || piece === "p") {
			return this.__pseudolegal_pawn_moves(i);
		} else {
			let ret = this.__pseudolegal_piece_moves(i);
			if (piece === "K" || piece === "k") {
				ret = ret.concat(this.__pseudolegal_castling(i));
			}
			return ret;
		}
	},

	__pseudolegal_pawn_moves: function(i) {

		// Can assume there really is a pawn of active colour on i.

		let ret = [];
		let piece = this.state[i];
		let initial_mail = mailbox64[i];

		let push         = (piece === "P") ? white_p_push : black_p_push;
		let attack_array = (piece === "P") ? white_p_caps : black_p_caps;

		let will_promote    = (piece === "P" && i <= 15) || (piece === "p" && i >= 48);
		let can_double_push = (piece === "P" && i >= 48) || (piece === "p" && i <= 15);

		// Pushes...

		let mail = initial_mail + push;
		let sq_index = mailbox[mail];				// We don't really need mailbox shennanigans, but use it for consistency.
		let sq_piece = this.state[sq_index];
		if (sq_piece === "") {
			if (will_promote) {
				ret.push(i_to_s(i) + i_to_s(sq_index) + "q");
				ret.push(i_to_s(i) + i_to_s(sq_index) + "r");
				ret.push(i_to_s(i) + i_to_s(sq_index) + "b");
				ret.push(i_to_s(i) + i_to_s(sq_index) + "n");
			} else {
				ret.push(i_to_s(i) + i_to_s(sq_index));
				if (can_double_push) {
					mail += push;
					sq_index = mailbox[mail];
					sq_piece = this.state[sq_index];
					if (sq_piece === "") {
						ret.push(i_to_s(i) + i_to_s(sq_index));
					}
				}
			}
		}

		// Captures...

		for (let attack of attack_array) {

			let mail = initial_mail + attack;

			let sq_index = mailbox[mail];
			if (sq_index === -1) {
				continue;
			}

			if (sq_index === this.enpassant) {							// This is a valid e.p. capture.
				ret.push(i_to_s(i) + i_to_s(sq_index));
			} else if (this.colour(sq_index) === this.inactive()) {		// Can't just test !== this.active, because the colour can be ""
				sq_piece = this.state[sq_index];
				if (will_promote) {
					ret.push(i_to_s(i) + i_to_s(sq_index) + "q");
					ret.push(i_to_s(i) + i_to_s(sq_index) + "r");
					ret.push(i_to_s(i) + i_to_s(sq_index) + "b");
					ret.push(i_to_s(i) + i_to_s(sq_index) + "n");
				} else {
					ret.push(i_to_s(i) + i_to_s(sq_index));
				}
			}
		}

		return ret;
	},

	__pseudolegal_piece_moves: function(i) {

		// Can assume there really is a piece of active colour on i.

		let ret = [];

		let piece = this.state[i];
		let initial_mail = mailbox64[i];

		let attack_array;
		let fast_break;

		switch (piece) {
			case "K": case "k":  attack_array =   king_attacks;  fast_break =  true;  break;
			case "Q": case "q":  attack_array =  queen_attacks;  fast_break = false;  break;
			case "R": case "r":  attack_array =   rook_attacks;  fast_break = false;  break;
			case "B": case "b":  attack_array = bishop_attacks;  fast_break = false;  break;
			case "N": case "n":  attack_array = knight_attacks;  fast_break =  true;  break;
		}

		for (let attack of attack_array) {
			let mail = initial_mail;
			while (true) {
				mail += attack;
				let sq_index = mailbox[mail];
				if (sq_index === -1) {
					break;
				}
				let sq_colour = this.colour(sq_index);
				if (sq_colour === "") {										// Moving to empty
					ret.push(i_to_s(i) + i_to_s(sq_index));
					if (fast_break) {
						break;
					}
				} else if (sq_colour === this.active) {						// Blocked by friendly
					break;
				} else {													// Capture
					ret.push(i_to_s(i) + i_to_s(sq_index));
					break;
				}
			}
		}

		return ret;
	},

	__pseudolegal_castling: function(i) {

		// Can assume there really is a king of active colour on i.

		let piece = this.state[i];

		if (piece === "K") {
			if (i < 56) return [];
		} else {
			if (i > 7) return [];
		}

		// So it's on the back rank...

		let possible_rook_x = [];

		if (this.active === "w") {
			for (let ch of this.castling) {
				if ("A" <= ch && ch <= "H") {
					possible_rook_x.push(ch.charCodeAt(0) - 65);
				}
			}
		} else {
			for (let ch of this.castling) {
				if ("a" <= ch && ch <= "h") {
					possible_rook_x.push(ch.charCodeAt(0) - 97);
				}
			}
		}

		if (possible_rook_x.length === 0) {
			return [];
		}

		let x1;									// king start x
		let y1;									// king start y

		if (this.active === "w") {
			[x1, y1] = i_to_xy(this.wk);
		} else {
			[x1, y1] = i_to_xy(this.bk);
		}

		let ret = [];

		for (let x2 of possible_rook_x) {		// rook start x

			let king_target_x;
			let rook_target_x;

			if (x1 < x2) {						// Castling kingside
				king_target_x = 6;
				rook_target_x = 5;
			} else {							// Castling queenside
				king_target_x = 2;
				rook_target_x = 3;
			}

			let king_path = numbers_between(x1, king_target_x);
			let rook_path = numbers_between(x2, rook_target_x);

			let ok = true;

			for (let x of king_path) {
				if (this.attacked(this.active, x, y1)) {
					ok = false;
					break;
				}
				if (x === x1 || x === x2) {		// Ignore "blockers" that are the king or rook themselves
					continue;					// (after checking for checks)
				}
				if (this.get(x, y1)) {
					ok = false;
					break;
				}
			}

			if (!ok) {
				continue;
			}

			for (let x of rook_path) {
				if (x === x1 || x === x2) {		// Ignore "blockers" that are the king or rook themselves
					continue;
				}
				if (this.get(x, y1)) {
					ok = false;
					break;
				}
			}

			if (ok) {
				ret.push(xy_to_s(x1, y1) + xy_to_s(x2, y1));
			}
		}

		return ret;
	},

	__can_capture_king: function() {
		return this.attacked(this.inactive(), this.inactive_king_index());
	},

	in_check: function() {
		return this.attacked(this.active, this.active_king_index());
	},

	c960_castling_converter: function(s) {
		// Given some move s, convert it to the new Chess 960 castling format if needed.
		if (s === "e1g1" && this.get(4, 7) === "K" && this.castling.includes("G") === false) return "e1h1";
		if (s === "e1c1" && this.get(4, 7) === "K" && this.castling.includes("C") === false) return "e1a1";
		if (s === "e8g8" && this.get(4, 0) === "k" && this.castling.includes("g") === false) return "e8h8";
		if (s === "e8c8" && this.get(4, 0) === "k" && this.castling.includes("c") === false) return "e8a8";
		return s;
	},

	illegal: function(s) {

		if (typeof s !== "string") {
			return "Not a string";
		}

		if (s.length < 4 || s.length > 5) {
			return `${s} had wrong string length`;
		}

		if (!valid_coord(s.slice(0, 2))) {
			return `${s} had invalid starting coordinate`;
		}

		let i = s_to_i(s.slice(0, 2));
		let pseudolegals = this.pseudolegals(i);
		if (!pseudolegals.includes(s)) {
			return `${s} not even pseudolegal`;
		}

		let test = this.move(s);
		if (test.__can_capture_king()) {
			return `${s} leaves king in check`;
		}

		return "";
	},

	nice_string: function(s) {

		// Given some raw (but valid) UCI move string, return a nice human-readable string
		// for display in the browser window. This string should never be examined by the
		// caller, merely displayed.
		//
		// Reminder: castling moves are expected to be king-onto-rook (Chess960 format).

		if (typeof(s) !== "string" || s.length < 4) {
			return "??";
		}

		let source = s.slice(0, 2);
		let target = s.slice(2, 4);

		if (!valid_coord(source) || !valid_coord(target)) {
			return "??";
		}

		let piece = this.get(source);
		let tar_piece = this.get(target);

		if (piece === "") {
			return "??";
		}

		let [x1, y1] = s_to_xy(source);
		let [x2, y2] = s_to_xy(target);

		let check = "";
		let next_board = this.move(s);

		if (next_board.in_check()) {
			if (next_board.no_moves()) {
				check = "#";
			} else {
				check = "+";
			}
		}

		if (["K", "k", "Q", "q", "R", "r", "B", "b", "N", "n"].includes(piece)) {

			if ((piece === "K" && tar_piece === "R") || (piece === "k" && tar_piece === "r")) {
				if (x1 < x2) {
					return `O-O${check}`;
				} else {
					return `O-O-O${check}`;
				}
			}

			// Would the move be ambiguous?
			// IMPORTANT: note that the actual move will not necessarily be valid_moves[0].

			let possible_sources = this.find(piece);
			let possible_moves = [];
			let valid_moves = [];

			for (let foo of possible_sources) {
				possible_moves.push(i_to_s(foo) + target);		// e.g. "g1f3"
			}

			for (let move of possible_moves) {
				if (this.illegal(move) === "") {
					valid_moves.push(move);
				}
			}

			if (valid_moves.length > 2) {

				// Full disambiguation.

				if (tar_piece === "") {
					return piece.toUpperCase() + source + target + check;
				} else {
					return piece.toUpperCase() + source + "x" + target + check;
				}
			}

			if (valid_moves.length === 2) {

				// Partial disambiguation.

				let source1 = valid_moves[0].slice(0, 2);
				let source2 = valid_moves[1].slice(0, 2);

				let disambiguator;

				if (source1[0] === source2[0]) {		// Comparing columns
					disambiguator = source[1];			// Note source (the true source), not source1
				} else {
					disambiguator = source[0];			// Note source (the true source), not source1
				}

				if (tar_piece === "") {
					return piece.toUpperCase() + disambiguator + target + check;
				} else {
					return piece.toUpperCase() + disambiguator + "x" + target + check;
				}
			}

			// No disambiguation.

			if (tar_piece === "") {
				return piece.toUpperCase() + target + check;
			} else {
				return piece.toUpperCase() + "x" + target + check;
			}
		}

		// So it's a pawn. Pawn moves are never ambiguous.

		let ret;

		if (source[0] === target[0]) {
			ret = target;
		} else {
			ret = source[0] + "x" + target;
		}

		if (s.length > 4) {
			ret += "=";
			ret += s[4].toUpperCase();
		}

		ret += check;

		return ret;
	},

};

// ------------------------------------------------------------------------------------------------

function s_to_xy(s) {
	let x = s.charCodeAt(0) - 97;
	let y = 56 - s.charCodeAt(1);
	return [x, y];
}

function s_to_i(s) {
	let x = s.charCodeAt(0) - 97;
	let y = 56 - s.charCodeAt(1);
	return x + y * 8;
}

function xy_to_s(x, y) {
	let xs = String.fromCharCode(x + 97);
	let ys = String.fromCharCode(56 - y);
	return xs + ys;
}

function xy_to_i(x, y) {
	return x + y * 8;
}

function i_to_s(i) {
	let x = i % 8;
	let y = (i - x) / 8;
	let xs = String.fromCharCode(x + 97);
	let ys = String.fromCharCode(56 - y);
	return xs + ys;
}

function i_to_xy(i) {
	let x = i % 8;
	let y = (i - x) / 8;
	return [x, y];
}

// ------------------------------------------------------------------------------------------------

function numbers_between(a, b) {					// Inclusive
	let add = a < b ? 1 : -1;
	let ret = [];
	for (let x = a; x !== b; x += add) {
		ret.push(x);
	}
	ret.push(b);
	return ret;
}

function replace_all(s, search, replace) {
	if (!s.includes(search)) return s;				// Seems to improve speed overall
	return s.split(search).join(replace);
}

function valid_coord(s) {
	if (s.length !== 2) {
		return false;
	}
	let a = s.charCodeAt(0);
	if (a < 97 || a > 104) {						// a-h
		return false;
	}
	let b = s.charCodeAt(1);
	if (b < 49 || b > 56) {							// 1-8
		return false;
	}
	return true;
}

// ------------------------------------------------------------------------------------------------

exports.new_board_from_fen = function(fen) {

	if (fen.length > 200) {
		throw new Error("Invalid FEN - size");
	}

	let ret = new_board();

	fen = replace_all(fen, "\t", " ");
	fen = replace_all(fen, "\n", " ");
	fen = replace_all(fen, "\r", " ");

	let tokens = fen.split(" ").filter(z => z !== "");

	if (tokens.length === 1) tokens.push("w");
	if (tokens.length === 2) tokens.push("-");
	if (tokens.length === 3) tokens.push("-");
	if (tokens.length === 4) tokens.push("0");
	if (tokens.length === 5) tokens.push("1");

	if (tokens.length !== 6) {
		throw new Error("Invalid FEN - token count");
	}

	if (tokens[0].endsWith("/")) {									// Some FEN writer does this
		tokens[0] = tokens[0].slice(0, -1);
	}

	let rows = tokens[0].split("/");

	if (rows.length > 8) {
		throw new Error("Invalid FEN - board row count");
	}

	let white_kings = 0;
	let black_kings = 0;

	for (let y = 0; y < rows.length; y++) {

		let x = 0;

		for (let c of rows[y]) {

			if (x > 7) {
				throw new Error("Invalid FEN - row length");
			}

			if (["1", "2", "3", "4", "5", "6", "7", "8"].includes(c)) {
				x += parseInt(c, 10);
				continue;
			}

			if ((c === "P" || c === "p") && (y === 0 || y === 7)) {
				throw new Error("Invalid FEN - pawn position");
			}

			if (["K", "k", "Q", "q", "R", "r", "B", "b", "N", "n", "P", "p"].includes(c)) {
				ret.set(c, x, y);
				x++;
				if (c === "K") white_kings++;
				if (c === "k") black_kings++;
				continue;
			}

			throw new Error("Invalid FEN - unknown piece");
		}
	}

	tokens[1] = tokens[1].toLowerCase();
	if (tokens[1] !== "w" && tokens[1] !== "b") {
		throw new Error("Invalid FEN - active player");
	}
	ret.active = tokens[1];

	ret.halfmove = parseInt(tokens[4], 10);
	if (Number.isNaN(ret.halfmove)) {
		throw new Error("Invalid FEN - halfmoves");
	}

	ret.fullmove = parseInt(tokens[5], 10);
	if (Number.isNaN(ret.fullmove)) {
		throw new Error("Invalid FEN - fullmoves");
	}

	if (white_kings !== 1 || black_kings !== 1) {
		throw "Invalid FEN - number of kings";
	}

	if (ret.attacked(ret.inactive(), ret.inactive_king_index())) {
		throw new Error("Invalid FEN - non-mover's king in check");
	}

	// Some hard things. Do these in the right order!

	ret.castling = castling_rights(ret, tokens[2]);
	ret.enpassant = fen_passant_square(ret, tokens[3]);				// Requires ret.active to be correct.
	ret.normalchess = is_normal_chess(ret);							// Requires ret.castling to be correct.

	return ret;
}

function castling_rights(board, s) {					// s is the castling string from a FEN

	let dict = Object.create(null);						// Will contain keys like "A" to "H" and "a" to "h"

	// WHITE

	let [wkx, wky] = i_to_xy(board.wk);

	if (wky === 7) {

		for (let ch of s) {
			if (["A", "B", "C", "D", "E", "F", "G", "H"].includes(ch)) {
				if (board.get(ch.toLowerCase() + "1") === "R") {
					dict[ch] = true;
				}
			}
			if (ch === "Q") {
				if (board.get("a1") === "R") {			// Compatibility with regular Chess FEN.
					dict.A = true;
				} else {
					for (let col of ["a", "b", "c", "d", "e", "f", "g", "h"]) {
						let piece = board.get(col + "1");
						if (piece === "K") {
							break;
						}
						if (piece === "R") {
							dict[col.toUpperCase()] = true;
						}
					}	
				}
			}
			if (ch === "K") {
				if (board.get("h1") === "R") {			// Compatibility with regular Chess FEN.
					dict.H = true;
				} else {
					for (let col of ["h", "g", "f", "e", "d", "c", "b", "a"]) {
						let piece = board.get(col + "1");
						if (piece === "K") {
							break;
						}
						if (piece === "R") {
							dict[col.toUpperCase()] = true;
						}
					}	
				}
			}
		}
	}

	// BLACK

	let [bkx, bky] = i_to_xy(board.bk);

	if (bky === 0) {

		for (let ch of s) {
			if (["a", "b", "c", "d", "e", "f", "g", "h"].includes(ch)) {
				if (board.get(ch + "8") === "r") {
					dict[ch] = true;
				}
			}
			if (ch === "q") {
				if (board.get("a8") === "r") {			// Compatibility with regular Chess FEN.
					dict.a = true;
				} else {
					for (let col of ["a", "b", "c", "d", "e", "f", "g", "h"]) {
						let piece = board.get(col + "8");
						if (piece === "k") {
							break;
						}
						if (piece === "r") {
							dict[col] = true;
						}
					}	
				}
			}
			if (ch === "k") {
				if (board.get("h8") === "r") {			// Compatibility with regular Chess FEN.
					dict.h = true;
				} else {
					for (let col of ["h", "g", "f", "e", "d", "c", "b", "a"]) {
						let piece = board.get(col + "8");
						if (piece === "k") {
							break;
						}
						if (piece === "r") {
							dict[col] = true;
						}
					}	
				}
			}
		}
	}

	let ret = "";

	for (let ch of "ABCDEFGHabcdefgh") {
		if (dict[ch]) {
			ret += ch;
		}
	}

	return ret;

	// FIXME: check at most 1 castling possibility on left and right of each king?
	// At the moment we support more arbitrary castling rights, maybe that's OK.
}

function fen_passant_square(board, s) {
	if (board.active === "w" && ["a6", "b6", "c6", "d6", "e6", "f6", "g6", "h6"].includes(s)) {
		let col = s.charCodeAt(0) - 97;
		if (board.get(col, 3) !== "p") return null;								// Check capturable pawn exists.
		if (col > 0 && board.get(col - 1, 3) === "P") return s_to_i(s);			// Then check 2 ways a capturing
		if (col < 7 && board.get(col + 1, 3) === "P") return s_to_i(s);			// pawn could exist.
	}
	if (board.active === "b" && ["a3", "b3", "c3", "d3", "e3", "f3", "g3", "h3"].includes(s)) {
		let col = s.charCodeAt(0) - 97;
		if (board.get(col, 4) !== "P") return null;
		if (col > 0 && board.get(col - 1, 4) === "p") return s_to_i(s);
		if (col < 7 && board.get(col + 1, 4) === "p") return s_to_i(s);
	}
	return null;
}

function is_normal_chess(board) {
	for (let ch of "bcdefgBCDEFG") {
		if (board.castling.includes(ch)) {
			return false;
		}
	}
	if (board.castling.includes("A") || board.castling.includes("H")) {
		if (board.get("e1") !== "K") {
			return false;
		}
	}
	if (board.castling.includes("a") || board.castling.includes("h")) {
		if (board.get("e8") !== "k") {
			return false;
		}
	}
	return true;
}

// ------------------------------------------------------------------------------------------------

exports.wild = function(ply) {
	let board = exports.new_board_from_fen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
	for (let i = 0; i < ply; i++) {
		let moves = board.movegen();
		if (moves.length === 0) {
			break;
		}
		let mv = moves[Math.floor(moves.length * Math.random())];
		board = board.move(mv);
	}
	return board;
};
