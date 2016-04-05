var test = require('tape');
var dome = require('..');

test('Snapshots', function (t) {
	var d = dome({ foo: { hello: true, world: true } });

	d.snapshot();

	d.write('foo.hello', function (w) {
		w.set(false);
		t.deepEqual(d.value, { foo: { hello: false, world: true } }, 'Set successful');
		t.equal(d.diff.length, 1, '1 diff entry');
	});

	d.snapshot();
	d.snapshot();
	d.snapshot();
	d.rollback();

	d.write('foo.world', function (w) {
		w.set([]);
		t.deepEqual(d.value, { foo: { hello: false, world: [] } }, 'Set successful');
		t.equal(d.diff.length, 2, '2 diff entries');
	});

	d.rollback();
	d.rollback();

	t.deepEqual(d.value, { foo: { hello: false, world: true } }, 'Rollback successful');
	t.equal(d.diff.length, 1, '1 diff entry');

	d.rollback();
	t.deepEqual(d.value, { foo: { hello: true, world: true } }, 'Rollback successful');
	t.equal(d.diff.length, 0, 'No diffs');

	t.throws(function () {
		d.rollback();
	}, null, 'Cannot rollback into the past');

	t.end();
});
