"use strict";

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

const cardinal_attacks = [-10, 1, 10, -1];
const diagonal_attacks = [-11, -9, 11, 9];
const knight_attacks = [-21, -19, -8, 12, 21, 19, 8, -12];

exports.new_board = function(state = null, active = "w", castling = "", enpassant = null, halfmove = 0, fullmove = 1, normalchess = false) {

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
	ret.enpassant = enpassant;
	ret.halfmove = halfmove;
	ret.fullmove = fullmove;
	ret.normalchess = normalchess;

	return ret;
}

exports.new_board_from_fen = function(fen) {

	if (fen.length > 200) {
		throw new Error("Invalid FEN - size");
	}

	let ret = exports.new_board();

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

	let opponent_king_char = ret.active === "w" ? "k" : "K";
	let [opponent_king_x, opponent_king_y] = ret.find(opponent_king_char)[0];

	if (ret.attacked(ret.active === "w" ? "b" : "w", opponent_king_x, opponent_king_y)) {
		throw new Error("Invalid FEN - non-mover's king in check");
	}

	// Some hard things. Do these in the right order!

	ret.castling = castling_rights(ret, tokens[2]);
	ret.enpassant = fen_passant_square(ret, tokens[3]);				// Requires ret.active to be correct. (FIXME / TODO, see below).
	ret.normalchess = is_normal_chess(ret);							// Requires ret.castling to be correct.

	return ret;
}


const board_prototype = {

	copy: function() {
		return new_board(this.state, this.active, this.castling, this.enpassant, this.halfmove, this.fullmove, this.normalchess);
	},

	get: function(arg1, arg2) {										// get(2, 3) or get("c6") are equivalent
		let index = index_from_args(arg1, arg2);
		return this.state[index];
	},

	set: function(c, arg1, arg2) {									// set("R", 2, 3) or set("R", "c6") are equivalent
		let index = index_from_args(arg1, arg2);
		this.state[index] = c;
	},

	colour: function(arg1, arg2) {
		let piece = this.get(arg1, arg2);
		if (piece === "") {
			return "";
		}
		if (piece === "K" || piece === "Q" || piece === "R" || piece === "B" || piece === "N" || piece === "P") {
			return "w";
		}
		if (piece === "k" || piece === "q" || piece === "r" || piece === "b" || piece === "n" || piece === "p") {
			return "b";
		}
		throw new Error("Bad piece");
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
		// Search range is INCLUSIVE. Result returned as a list of points.
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
					ret.push([x, y]);
				}
			}
		}

		return ret;
	},

	attacked: function(defender_colour, arg1, arg2) {

		if (defender_colour !== "w" && defender_colour !== "b") {
			throw new Error("attacked(): bad call");
		}

		let index = index_from_args(arg1, arg2);
		let initial_mail = mailbox64[index];

		for (let attack of cardinal_attacks) {
			let mail = initial_mail;
			while (true) {
				mail += attack;
				let sq_index = mailbox[mail];
				if (sq_index === -1) {
					break;
				}
				let sq_piece = this.state[sq_index];
				if (sq_piece === "") {
					continue;
				}
				if (defender_colour === "w") {
					if (sq_piece === "k" || sq_piece === "q" || sq_piece === "r") {
						return true;
					}
				} else {
					if (sq_piece === "K" || sq_piece === "Q" || sq_piece === "R") {
						return true;
					}
				}
				break;
			}
		}

		for (let attack of diagonal_attacks) {
			let mail = initial_mail;
			while (true) {
				mail += attack;
				let sq_index = mailbox[mail];
				if (sq_index === -1) {
					break;
				}
				let sq_piece = this.state[sq_index];
				if (sq_piece === "") {
					continue;
				}
				if (defender_colour === "w") {
					if (sq_piece === "k" || sq_piece === "q" || sq_piece === "b") {
						return true;
					}
					if (sq_piece === "p") {
						if (mail - initial_mail === -9 || mail - initial_mail === -11) {
							return true;
						}
					}
				} else {
					if (sq_piece === "K" || sq_piece === "Q" || sq_piece === "B") {
						return true;
					}
					if (sq_piece === "P") {
						if (mail - initial_mail === 9 || mail - initial_mail === 11) {
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

		// FIXME: possibly implement friendly and book modes.

		let ep_string = this.enpassant ? this.enpassant.s : "-";
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
		if (this.enpassant !== other.enpassant) return false;		// FIXME? Issues around fake e.p. squares.
		for (let i = 0; i < 64; i++) {
			if (this.state[i] !== other.state[i]) {
				return false;
			}
		}
		return true;
	},

};

function replace_all(s, search, replace) {
	if (!s.includes(search)) return s;								// Seems to improve speed overall
	return s.split(search).join(replace);
}

function index_from_args(arg1, arg2) {								// For the normal len-64 arrays
	if (typeof(arg1) === "string") {
		return (arg1.charCodeAt(0) - 97) + ((8 - (arg1.charCodeAt(1) - 48)) * 8);
	} else {
		return arg1 + (arg2 * 8);
	}
}

function castling_rights(board, s) {					// s is the castling string from a FEN

	let dict = Object.create(null);						// Will contain keys like "A" to "H" and "a" to "h"

	// WHITE

	let wk_location = board.find("K", 0, 7, 7, 7)[0];	// Will be undefined if not on back rank.

	if (wk_location) {

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

	let bk_location = board.find("k", 0, 0, 7, 0)[0];

	if (bk_location) {

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

function fen_passant_square(board, s) {				// FIXME / TODO
	if (["a3", "b3", "c3", "d3", "e3", "f3", "g3", "h3", "a6", "b6", "c6", "d6", "e6", "f6", "g6", "h6"].includes(s)) {
		return s;
	} else {
		return null;
	}
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

	// So it can be considered a normal Chess position.

	return true;
}
