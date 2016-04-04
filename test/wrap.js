var test = require('tape');
var dome = require('..');

test('Wrap', function (t) {
	var d = dome({ child: {} });
	var c = d.wrap('child');

	var changes = 0;
	var diffs = 0;

	function changed(newValue, oldValue, opData) {
		if (newValue === 'hello' && oldValue === undefined && opData.op === 'set' && opData.result === 'hello') {
			changes += 1;
		}
	}

	function diffed(opName, args) {
		if (opName === 'set' && args.length === 1 && args[0] === 'hello') {
			diffs += 1;
		}
	}

	// change events:

	d.on('change', function (path, newValue, oldValue, opData) {
		if (path === 'child.foo') {
			changed(newValue, oldValue, opData);
		}
	});

	c.on('change', function (path, newValue, oldValue, opData) {
		if (path === 'foo') {
			changed(newValue, oldValue, opData);
		}
	});

	d.on('change:child.foo', changed);
	c.on('change:foo', changed);

	// diff events:

	d.on('diff', function (opName, path, args) {
		if (path === 'child.foo') {
			diffed(opName, args);
		}
	});

	c.on('diff', function (opName, path, args) {
		if (path === 'foo') {
			diffed(opName, args);
		}
	});

	c.mutate('foo').set('hello');

	t.equal(changes, 4, '4 perfect change events fired');
	t.equal(diffs, 2, '2 perfect diff events fired');

	t.end();
});
