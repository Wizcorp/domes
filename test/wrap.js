var test = require('tape');
var dome = require('..');

test('Wrap', function (t) {
	var d = dome({ child: {} });
	var c = d.wrap('child');

	t.equal(d.wrap('child'), c, 'Wrapping the same path returns the same child dome');

	var expChanged = { d: true, c: true, dpath: true, cpath: true, count: 4 };
	var changed = { d: false, c: false, dpath: false, cpath: false, count: 0 };
	var expDiffs = { d: true, c: true, count: 2 };
	var diffs = { d: false, c: false, count: 0 };

	// change events:

	d.on('change', function (path, newValue, oldValue, opData) {
		t.equal(path, 'child.foo', 'Parent: emitted path is child.foo');
		t.equal(newValue, 'hello', 'Parent: emitted value is "hello"');
		t.equal(oldValue, undefined, 'Parent: emitted old value is undefined');
		t.deepEqual(opData, { op: 'set', result: 'hello' }, 'Parent: operation is correct');
		changed.d = true;
		changed.count += 1;
	});

	c.on('change', function (path, newValue, oldValue, opData) {
		t.equal(path, 'foo', 'Child: emitted path is child.foo');
		t.equal(newValue, 'hello', 'Child: emitted value is "hello"');
		t.equal(oldValue, undefined, 'Child: emitted old value is undefined');
		t.deepEqual(opData, { op: 'set', result: 'hello' }, 'Child: operation is correct');
		changed.c = true;
		changed.count += 1;
	});

	d.on('change:child.foo', function (newValue, oldValue, opData) {
		t.equal(newValue, 'hello', 'Parent: emitted value is "hello"');
		t.equal(oldValue, undefined, 'Parent: emitted old value is undefined');
		t.deepEqual(opData, { op: 'set', result: 'hello' }, 'Parent: operation is correct');
		changed.dpath = true;
		changed.count += 1;
	});

	c.on('change:foo', function (newValue, oldValue, opData) {
		t.equal(newValue, 'hello', 'Child: emitted value is "hello"');
		t.equal(oldValue, undefined, 'Child: emitted old value is undefined');
		t.deepEqual(opData, { op: 'set', result: 'hello' }, 'Child: operation is correct');
		changed.cpath = true;
		changed.count += 1;
	});

	// diff events:

	d.on('diff', function (opName, path, args) {
		t.equal(opName, 'set', 'Parent: diff operation is "set"');
		t.deepEqual(path, ['child', 'foo'], 'Parent: path is ["child", "foo"]');
		t.equal(args.length, 1, 'Parent: 1 argument was passed to "set"');
		t.equal(args[0], 'hello', 'Parent: Argument passed is "hello"');

		diffs.d = true;
		diffs.count += 1;
	});

	c.on('diff', function (opName, path, args) {
		t.equal(opName, 'set', 'Child: diff operation is "set"');
		t.deepEqual(path, ['foo'], 'Parent: path is ["foo"]');
		t.equal(args.length, 1, 'Child: 1 argument was passed to "set"');
		t.equal(args[0], 'hello', 'Child: Argument passed is "hello"');

		diffs.c = true;
		diffs.count += 1;
	});

	c.write('foo').set('hello');

	t.deepEqual(changed, expChanged, 'All expected change-events fired');
	t.deepEqual(diffs, expDiffs, 'All expected diff-events fired');

	t.throws(function () {
		d.wrap('does.not.exist');
	}, null, 'Cannot wrap non-existing paths');

	t.end();
});
