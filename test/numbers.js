var test = require('tape');
var dome = require('..');

test('Number operations', function (t) {
	var w = dome({ n: 10 }).write('n');

	t.equal(w.inc(), 11, 'Default inc() by 1');
	t.equal(w.inc(9), 20, 'inc() by a fixed number');
	t.equal(w.dec(), 19, 'Default dec() by 1');
	t.equal(w.dec(9), 10, 'dec() by a fixed number');

	t.end();
});
