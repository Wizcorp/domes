var test = require('tape');
var dome = require('..');

test('Number operations', function (t) {
	var d = dome({ n: 10 });

	t.equal(d.inc('n'), 11, 'Default inc() by 1');
	t.equal(d.inc('n', 9), 20, 'inc() by a fixed number');
	t.equal(d.dec('n'), 19, 'Default dec() by 1');
	t.equal(d.dec('n', 9), 10, 'dec() by a fixed number');

	t.end();
});
