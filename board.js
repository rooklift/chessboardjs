"use strict";

function replace_all(s, search, replace) {
	if (!s.includes(search)) return s;								// Seems to improve speed overall
	return s.split(search).join(replace);
}

exports.all_squares = [												// Convenient iterable when strings are needed
	"a8", "b8", "c8", "d8", "e8", "f8", "g8", "h8",
	"a7", "b7", "c7", "d7", "e7", "f7", "g7", "h7",
	"a6", "b6", "c6", "d6", "e6", "f6", "g6", "h6",
	"a5", "b5", "c5", "d5", "e5", "f5", "g5", "h5",
	"a4", "b4", "c4", "d4", "e4", "f4", "g4", "h4",
	"a3", "b3", "c3", "d3", "e3", "f3", "g3", "h3",
	"a2", "b2", "c2", "d2", "e2", "f2", "g2", "h2",
	"a1", "b1", "c1", "d1", "e1", "f1", "g1", "h1",
];

exports.new_board = function(state = null, active = "w", castling = "", enpassant = null, halfmove = 0, fullmove = 1) {

	let ret = Object.create(board_prototype);

	if (state) {
		ret.state = Array.from(state);
	} else {
		ret.state = [
			"*", "*", "*", "*", "*", "*", "*", "*", "*", "*",
			"*", "*", "*", "*", "*", "*", "*", "*", "*", "*",		// www.chessprogramming.org/10x12_Board
			"*",  "",  "",  "",  "",  "",  "",  "",  "", "*",
			"*",  "",  "",  "",  "",  "",  "",  "",  "", "*",		// * is a sentinel value indicating off-board
			"*",  "",  "",  "",  "",  "",  "",  "",  "", "*",
			"*",  "",  "",  "",  "",  "",  "",  "",  "", "*",
			"*",  "",  "",  "",  "",  "",  "",  "",  "", "*",
			"*",  "",  "",  "",  "",  "",  "",  "",  "", "*",
			"*",  "",  "",  "",  "",  "",  "",  "",  "", "*",
			"*",  "",  "",  "",  "",  "",  "",  "",  "", "*",
			"*", "*", "*", "*", "*", "*", "*", "*", "*", "*",
			"*", "*", "*", "*", "*", "*", "*", "*", "*", "*",
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
			index = (10 - (arg1.charCodeAt(1) - 48)) * 10 + arg1.charCodeAt(0) - 96;
		} else {
			index = (arg2 * 10) + arg1 + 21;
		}
		return this.state[index];
	},

	set: function(arg1, arg2, arg3) {								// set(2, 3, "R") or set("c6", "R") are equivalent
		if (typeof(arg1) === "string") {
			let index = (10 - (arg1.charCodeAt(1) - 48)) * 10 + arg1.charCodeAt(0) - 96;
			this.state[index] = arg2;
		} else {
			let index = (arg2 * 10) + arg1 + 21;
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

};
