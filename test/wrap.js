var test = require('tape');
var dome = require('..');

test('Wrap', function (t) {
	var d = dome({ child: { subchild: {} }});
	var c = d.wrap('child');
	var c2 = c.wrap('subchild');

	t.equal(d.wrap('child'), c, 'Wrapping the same path returns the same child dome');

	var expChanged = { d: 1, c: 1, c2: 1, dpath: [1, 1, 1], cpath: [1, 1], c2path: [1] };
	var changed = { d: 0, c: 0, c2: 0, dpath: [0, 0, 0], cpath: [0, 0], c2path: [0] };
	var expDiffs = { d: 1, c: 1, c2: 1 };
	var diffs = { d: 0, c: 0, c2: 0 };

	// change events:

	d.on('change', function (path, newValue, oldValue, opData) {
		t.equal(path, 'child.subchild.foo', 'Parent: emitted path is child.subchild.foo');
		t.equal(newValue, 'hello', 'Parent: emitted value is "hello"');
		t.equal(oldValue, undefined, 'Parent: emitted old value is undefined');
		t.deepEqual(opData, { op: 'set', result: 'hello' }, 'Parent: operation is correct');
		changed.d += 1;
	});

	c.on('change', function (path, newValue, oldValue, opData) {
		t.equal(path, 'subchild.foo', 'Child: emitted path is subchild.foo');
		t.equal(newValue, 'hello', 'Child: emitted value is "hello"');
		t.equal(oldValue, undefined, 'Child: emitted old value is undefined');
		t.deepEqual(opData, { op: 'set', result: 'hello' }, 'Child: operation is correct');
		changed.c += 1;
	});

	c2.on('change', function (path, newValue, oldValue, opData) {
		t.equal(path, 'foo', 'Subchild: emitted path is foo');
		t.equal(newValue, 'hello', 'Subchild: emitted value is "hello"');
		t.equal(oldValue, undefined, 'Subchild: emitted old value is undefined');
		t.deepEqual(opData, { op: 'set', result: 'hello' }, 'Subchild: operation is correct');
		changed.c2 += 1;
	});

	d.on('change:child.subchild.foo', function (remainingPath, newValue, oldValue, opData) {
		t.equal(remainingPath, '', 'Parent: remaining path is ""');
		t.equal(newValue, 'hello', 'Parent: emitted value is "hello"');
		t.equal(oldValue, undefined, 'Parent: emitted old value is undefined');
		t.deepEqual(opData, { op: 'set', result: 'hello' }, 'Parent: operation is correct');
		changed.dpath[2] += 1;
	});

	d.on('change:child.subchild', function (remainingPath, newValue, oldValue, opData) {
		t.equal(remainingPath, 'foo', 'Parent: remaining path is "foo"');
		t.equal(newValue, 'hello', 'Parent: emitted value is "hello"');
		t.equal(oldValue, undefined, 'Parent: emitted old value is undefined');
		t.deepEqual(opData, { op: 'set', result: 'hello' }, 'Parent: operation is correct');
		changed.dpath[1] += 1;
	});

	d.on('change:child', function (remainingPath, newValue, oldValue, opData) {
		t.equal(remainingPath, 'subchild.foo', 'Parent: remaining path is "subchild.foo"');
		t.equal(newValue, 'hello', 'Parent: emitted value is "hello"');
		t.equal(oldValue, undefined, 'Parent: emitted old value is undefined');
		t.deepEqual(opData, { op: 'set', result: 'hello' }, 'Parent: operation is correct');
		changed.dpath[0] += 1;
	});

	c.on('change:subchild.foo', function (remainingPath, newValue, oldValue, opData) {
		t.equal(remainingPath, '', 'Child: remaining path is ""');
		t.equal(newValue, 'hello', 'Child: emitted value is "hello"');
		t.equal(oldValue, undefined, 'Child: emitted old value is undefined');
		t.deepEqual(opData, { op: 'set', result: 'hello' }, 'Child: operation is correct');
		changed.cpath[1] += 1;
	});

	c.on('change:subchild', function (remainingPath, newValue, oldValue, opData) {
		t.equal(remainingPath, 'foo', 'Child: remaining path is "foo"');
		t.equal(newValue, 'hello', 'Child: emitted value is "hello"');
		t.equal(oldValue, undefined, 'Child: emitted old value is undefined');
		t.deepEqual(opData, { op: 'set', result: 'hello' }, 'Child: operation is correct');
		changed.cpath[0] += 1;
	});

	c2.on('change:foo', function (remainingPath, newValue, oldValue, opData) {
		t.equal(remainingPath, '', 'Subchild: remaining path is ""');
		t.equal(newValue, 'hello', 'Subchild: emitted value is "hello"');
		t.equal(oldValue, undefined, 'Subchild: emitted old value is undefined');
		t.deepEqual(opData, { op: 'set', result: 'hello' }, 'Subchild: operation is correct');
		changed.c2path[0] += 1;
	});

	// diff events:

	d.on('diff', function (opName, path, args) {
		t.equal(opName, 'set', 'Parent: diff operation is "set"');
		t.deepEqual(path, ['child', 'subchild', 'foo'], 'Parent: path is ["child", "subchild", "foo"]');
		t.equal(args.length, 1, 'Parent: 1 argument was passed to "set"');
		t.equal(args[0], 'hello', 'Parent: Argument passed is "hello"');
		diffs.d += 1;
	});

	c.on('diff', function (opName, path, args) {
		t.equal(opName, 'set', 'Child: diff operation is "set"');
		t.deepEqual(path, ['subchild', 'foo'], 'Child: path is ["subchild", "foo"]');
		t.equal(args.length, 1, 'Child: 1 argument was passed to "set"');
		t.equal(args[0], 'hello', 'Child: Argument passed is "hello"');
		diffs.c += 1;
	});

	c2.on('diff', function (opName, path, args) {
		t.equal(opName, 'set', 'Subchild: diff operation is "set"');
		t.deepEqual(path, ['foo'], 'Subchild: path is ["foo"]');
		t.equal(args.length, 1, 'Subchild: 1 argument was passed to "set"');
		t.equal(args[0], 'hello', 'Subchild: Argument passed is "hello"');
		diffs.c2 += 1;
	});

	c2.write('foo').set('hello');

	t.deepEqual(changed, expChanged, 'All expected change-events fired');
	t.deepEqual(diffs, expDiffs, 'All expected diff-events fired');

	t.throws(function () {
		d.wrap('does.not.exist');
	}, null, 'Cannot wrap non-existing paths');

	t.end();
});
