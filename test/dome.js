var test = require('tape');
var dome = require('..');

test('Dome manipulation', function (t) {
	var d = dome([], { emitChange: false, addDiff: false });

	var changes = 0;

	d.on('change', function () {
		changes += 1;
	});

	t.equal(d.length, 0, 'Dome is empty array');
	d.push('Hello');
	t.deepEqual(d.get(), ['Hello'], 'Dome is ["hello"]');
	d.set(5);
	t.equal(d.get(), 5, 'Dome changed type to number');
	d.inc(1);
	t.equal(d.get(), 6, 'Dome incremented from 5 to 6');

	t.equal(d.hasDiff(), false, 'Dome has no diff (turned off through options)');
	t.equal(changes, 0, 'Change events not emitted (turned off through options)');
	d.destroy();

	changes = 0;
	d = dome([], { emitChange: true, addDiff: true });
	d.on('change', function () {
		changes += 1;
	});

	d.push('Hello');
	t.equal(d.hasDiff(), true, 'Dome has a diff (turned on through options)');
	t.equal(changes, 1, 'Change events emitted (turned on through options)');

	t.end();
});
