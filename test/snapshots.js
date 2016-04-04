var test = require('tape');
var dome = require('..');

test('Snapshots', function (t) {
	var d = dome({ foo: { hello: true, world: true } });

	d.snapshot();

	d.mutate('foo.hello', function (m) {
		m.set(false);
		t.deepEqual(d.target, { foo: { hello: false, world: true } }, 'Set successful');
		t.equal(d.diff.length, 1, '1 diff entry');
	});

	d.snapshot();
	d.snapshot();
	d.snapshot();
	d.rollback();

	d.mutate('foo.world', function (m) {
		m.set([]);
		t.deepEqual(d.target, { foo: { hello: false, world: [] } }, 'Set successful');
		t.equal(d.diff.length, 2, '2 diff entries');
	});

	d.rollback();
	d.rollback();

	t.deepEqual(d.target, { foo: { hello: false, world: true } }, 'Rollback successful');
	t.equal(d.diff.length, 1, '1 diff entry');

	d.rollback();
	t.deepEqual(d.target, { foo: { hello: true, world: true } }, 'Rollback successful');
	t.equal(d.diff.length, 0, 'No diffs');

	t.throws(function () {
		d.rollback();
	}, null, 'Cannot rollback into the past');

	var child = d.wrap('foo.hello');
	t.throws(function () {
		child.snapshot();
	}, null, 'Cannot snapshot wrapped domes');

	t.end();
});
