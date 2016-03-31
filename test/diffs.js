var test = require('tape');
var dome = require('..');

test('Diffs', function (t) {
	var o = { foo: { hello: false, world: [] } };
	var d = dome({});
	var d2 = dome({});

	d.set('foo.hello', false);
	d.set('foo.world', []);

	t.equal(d.diff.length, 2, '2 diff entries');
	t.deepEqual(d.target, o);

	var peekedDiff = d.peekDiff();
	var diff = d.extractDiff();

	t.equal(diff, peekedDiff, 'Can peek into the diff');
	t.equal(d.hasDiff(), false, 'No more diff entries');

	d2.applyDiff(diff);

	t.deepEqual(d2.target, o);

	t.end();
});
