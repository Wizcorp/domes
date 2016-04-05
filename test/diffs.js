var test = require('tape');
var dome = require('..');

test('Diffs', function (t) {
	var o = { foo: { hello: false, world: [] } };
	var d = dome({});
	var d2 = dome({});

	d.write('foo.hello').set(false);
	d.write('foo.world').set([]);

	t.equal(d.diff.length, 2, '2 diff entries');
	t.deepEqual(d.value, o);

	var peekedDiff = d.peekDiff();
	var diff = d.extractDiff();

	t.equal(diff, peekedDiff, 'Can peek into the diff');
	t.equal(d.hasDiff(), false, 'No more diff entries');

	d2.applyDiff(diff);

	t.deepEqual(d2.value, o);

	var d3 = dome({}, { addDiff: false });
	d3.write('foo.bar', function (w) {
		w.set([1, 2, 3]);
		w.append(4);
	});

	t.equal(d3.peekDiff().length, 0);
	t.equal(d3.extractDiff().length, 0);

	t.end();
});
