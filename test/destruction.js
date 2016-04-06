var test = require('tape');
var dome = require('..');

test('Destruction', function (t) {
	var o = { foo: 'bar' };
	var d = dome(o);
	d.on('change', function () {});

	d.destroy();

	t.equal(d.value, undefined, '.value is undefined');
	t.equal(d.snapshots, undefined, '.snapshots is undefined');
	t.equal(d.diff, undefined, '.diff is undefined');
	t.deepEqual(d.listeners('change'), [], 'Event listeners are gone');

	t.end();
});
