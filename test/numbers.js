var test = require('tape');
var dome = require('..');

test('Number operations', function (t) {
	var m = dome({ n: 10 }).mutate('n');

	t.equal(m.inc(), 11, 'Default inc() by 1');
	t.equal(m.inc(9), 20, 'inc() by a fixed number');
	t.equal(m.dec(), 19, 'Default dec() by 1');
	t.equal(m.dec(9), 10, 'dec() by a fixed number');

	t.end();
});
