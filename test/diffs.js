var test = require('tape');
var dome = require('..');

test('Diffs', function (t) {
	var o = { foo: { hello: false, world: [] } };
	var d = dome({});
	var d2 = dome({});

	d.mutate('foo.hello').set(false);
	d.mutate('foo.world').set([]);

	t.equal(d.diff.length, 2, '2 diff entries');
	t.deepEqual(d.target, o);

	var peekedDiff = d.peekDiff();
	var diff = d.extractDiff();

	t.equal(diff, peekedDiff, 'Can peek into the diff');
	t.equal(d.hasDiff(), false, 'No more diff entries');

	d2.applyDiff(diff);

	t.deepEqual(d2.target, o);

	var d3 = dome({}, { noDiff: true });
	d3.mutate('foo.bar', function (m) {
		m.set([1, 2, 3]);
		m.append(4);
	});

	t.equal(d3.peekDiff().length, 0);
	t.equal(d3.extractDiff().length, 0);

	t.end();
});
