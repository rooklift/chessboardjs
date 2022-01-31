"use strict";

let boardjs = require("./board");

function perft(pos, depth, print_moves) {
	let moves = pos.movegen();
	if (depth === 1) {
		return moves.length;
	} else {
		let count = 0;
		for (let mv of moves) {
			let val = perft(pos.move(mv), depth - 1, false);
			if (print_moves) {
				perft_print_move(pos, mv, val);
			}
			count += val;
		}
		return count;
	}
}

function perft_print_move(pos, mv, val) {
	// let nice = pos.nice_string(mv);
	let nice = mv;
	console.log(`${mv + (mv.length === 4 ? " " : "")}   ${nice + " ".repeat(7 - nice.length)}`, val);
}

// -------------------------------------------------------------------------------------------------------------------

let perft_known_values = {
	"8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1":                              [0, 14,  191,  2812,   43238,    674624],
	"1nr1nk1r/1b5B/p1p1qp2/b2pp1pP/3P2P1/P3P2N/1Pp2P2/BNR2KQR w CHch g6 0 1": [0, 28,  964, 27838,  992438,  30218648],
	"Qr3knr/P1bp1p1p/2pn1q2/4p3/2PP2pB/1p1N1bP1/BP2PP1P/1R3KNR w BHbh - 0 1": [0, 31, 1122, 34613, 1253934,  40393041],
	"r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1":   [0, 48, 2039, 97862, 4085603, 193690690],
};

exports.Perft = function(fen, depth) {
	if (!fen || !depth) throw "Need FEN and depth";
	// let starttime = performance.now();
	let board = boardjs.new_board_from_fen(fen);
	let val = perft(board, depth, true);
	// console.log(`Total.......... ${val} (${((performance.now() - starttime) / 1000).toFixed(1)} seconds)`);
	console.log(`Total.......... ${val}`);
	if (perft_known_values[fen] && perft_known_values[fen][depth]) {
		if (perft_known_values[fen][depth] === val) {
			console.log("Known good result");
		} else {
			console.log(`Known BAD result -- expected ${perft_known_values[fen][depth]}`);
		}
	}
	return val;
}