"use strict";

let boardjs = require("./board");

let perft_known_values = {
	"8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1":                              [0, 14,  191,  2812,   43238,    674624],
	"1nr1nk1r/1b5B/p1p1qp2/b2pp1pP/3P2P1/P3P2N/1Pp2P2/BNR2KQR w CHch g6 0 1": [0, 28,  964, 27838,  992438,  30218648],
	"Qr3knr/P1bp1p1p/2pn1q2/4p3/2PP2pB/1p1N1bP1/BP2PP1P/1R3KNR w BHbh - 0 1": [0, 31, 1122, 34613, 1253934,  40393041],
	"r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1":   [0, 48, 2039, 97862, 4085603, 193690690],
	"r3k2r/1P1pp1P1/8/2P2P2/2p2p2/8/1p1PP1p1/R3K2R w KQkq - 0 1":             [0, 43, 1286, 39109, 1134150,  33406158],
};

exports.perft = function(fen, depth) {
	if (!fen || !depth) throw "Need FEN and depth";
	let starttime = new Date();
	let board = boardjs.new_board_from_fen(fen);
	let val = perft_recurse(board, depth, true);
	console.log(`Total.......... ${val} (${((new Date() - starttime) / 1000).toFixed(1)} seconds)`);
	if (perft_known_values[fen] && perft_known_values[fen][depth]) {
		if (perft_known_values[fen][depth] === val) {
			console.log("Known good result");
		} else {
			console.log(`Known BAD result -- expected ${perft_known_values[fen][depth]}`);
		}
	}
	return val;
};

function perft_recurse(pos, depth, print_moves) {
	let moves = pos.movegen();
	if (depth === 1) {
		if (print_moves) {
			for (let mv of moves) {
				perft_print_move(pos, mv, 1);
			}
		}
		return moves.length;
	} else {
		let count = 0;
		for (let mv of moves) {
			let val = perft_recurse(pos.move(mv), depth - 1, false);
			if (print_moves) {
				perft_print_move(pos, mv, val);
			}
			count += val;
		}
		return count;
	}
}

function perft_print_move(pos, mv, val) {
	let nice = pos.nice_string(mv);
	console.log(`${mv + (mv.length === 4 ? " " : "")}   ${nice + " ".repeat(7 - nice.length)}`, val);
}

// ------------------------------------------------------------------------------------------------

exports.filetest = function() {

	let fs = require("fs");

	let infile = fs.readFileSync("perft-marcel.epd", "utf8");

	let bad_results = [];

	for (let line of infile.split("\n")) {

		line = line.trim();

		if (line === "") {
			continue;
		}

		let parts = line.split(";");

		let fen = parts[0];
		let d3 = parseFloat(parts[3].trim().split(" ")[1]);

		let board = boardjs.new_board_from_fen(fen);
		let val = perft_recurse(board, 3, false);

		if (val === d3) {
			console.log(" OK ", fen);
		} else {
			console.log(" -------- BAD! -------- ", fen);
			bad_results.push(fen);
		}
	}

	if (bad_results.length > 0) {
		console.log("\nBAD RESULTS:");
		for (let item of bad_results) {
			console.log(item);
		}
	} else {
		console.log("\nALL OK");
	}
};

exports.startpos = function() {
	return boardjs.new_board_from_fen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
};

exports.random = function(ply = 100) {
	let board = boardjs.new_board_from_fen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
	let history = [];
	for (let i = 0; i < ply; i++) {
		let moves = board.movegen();
		if (moves.length === 0) {
			break;
		}
		let mv = moves[Math.floor(moves.length * Math.random())];
		if (board.active === "w") {
			history.push(board.next_number_string() + " " + board.nice_string(mv));
		} else {
			history.push(board.nice_string(mv));
		}
		board = board.move(mv);
	}
	log_history(history);
	console.log(board.graphic());
};

function log_history(history) {
	let len = 0;
	let acc = "";
	for (let item of history) {
		if (acc) {
			acc += " ";
		}
		acc += item;
		if (acc.length > 72) {
			console.log(acc);
			acc = "";
		}
	}
	if (acc) {
		console.log(acc);
	}
}

exports.s20 = function() {		// So called because this takes about 20 secs on my machine.
	exports.perft("r3k2r/1P1pp1P1/8/2P2P2/2p2p2/8/1p1PP1p1/R3K2R w KQkq - 0 1", 5);
};
