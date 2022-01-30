"use strict";

function replace_all(s, search, replace) {
	if (!s.includes(search)) return s;								// Seems to improve speed overall
	return s.split(search).join(replace);
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

exports.new_board = function(state = null, active = "w", castling = "", enpassant = null, halfmove = 0, fullmove = 1) {

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
				ret.set(x, y, c);
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
/*
	let opponent_king_char = ret.active === "w" ? "k" : "K";
	let opponent_king_square = ret.find(opponent_king_char)[0];

	if (ret.attacked(opponent_king_square, ret.colour(opponent_king_square))) {
		throw new Error("Invalid FEN - non-mover's king in check");
	}

	// Some hard things. Do these in the right order!

	ret.castling = CastlingRights(ret, tokens[2]);
	ret.enpassant = EnPassantSquare(ret, tokens[3]);	// Requires ret.active to be correct.
	ret.normalchess = IsNormalChessPosition(ret);		// Requires ret.castling to be correct.
*/
	return ret;
}


const board_prototype = {

	copy: function() {
		return new_board(this.state, this.active, this.castling, this.enpassant, this.halfmove, this.fullmove);
	},

	get: function(arg1, arg2) {										// get(2, 3) or get("c6") are equivalent
		let index;
		if (typeof(arg1) === "string") {
			index = (arg1.charCodeAt(0) - 97) + ((8 - (arg1.charCodeAt(1) - 48)) * 8);
		} else {
			index = arg1 + (arg2 * 8);
		}
		return this.state[index];
	},

	set: function(arg1, arg2, arg3) {								// set(2, 3, "R") or set("c6", "R") are equivalent
		if (typeof(arg1) === "string") {
			let index = (arg1.charCodeAt(0) - 97) + ((8 - (arg1.charCodeAt(1) - 48)) * 8);
			this.state[index] = arg2;
		} else {
			let index = arg1 + (arg2 * 8);
			this.state[index] = arg3;
		}
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

	dump: function() {
		for (let y = 0; y < 8; y++) {
			let s = "";
			for (let x = 0; x < 8; x++) {
				let c = this.get(x, y);
				if (c) {
					s += " " + c;
				} else {
					s += " .";
				}
			}
			console.log(s);
		}
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

		for (let x = startx; x <= endx; x++) {
			for (let y = starty; y <= endy; y++) {
				let index = x + (y * 8);
				if (this.state[index] === piece) {
					ret.push([x, y]);
				}
			}
		}
	},

};
