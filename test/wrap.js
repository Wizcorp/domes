var test = require('tape');
var dome = require('..');

test('Wrap', function (t) {
	var d = dome({ child: { subchild: {} }});
	var c = d.wrap('child');
	var c2 = c.wrap('subchild');

	t.equal(d.wrap('child'), c, 'Wrapping the same path returns the same child dome');

	var expChanged = { d: true, c: true, c2: true, dpath: true, cpath: true, c2path: true, count: 6 };
	var changed = { d: false, c: false, c2: false, dpath: false, cpath: false, c2path: false, count: 0 };
	var expDiffs = { d: true, c: true, c2: true, count: 3 };
	var diffs = { d: false, c: false, c2: false, count: 0 };

	// change events:

	d.on('change', function (path, newValue, oldValue, opData) {
		t.equal(path, 'child.subchild.foo', 'Parent: emitted path is child.subchild.foo');
		t.equal(newValue, 'hello', 'Parent: emitted value is "hello"');
		t.equal(oldValue, undefined, 'Parent: emitted old value is undefined');
		t.deepEqual(opData, { op: 'set', result: 'hello' }, 'Parent: operation is correct');
		changed.d = true;
		changed.count += 1;
	});

	c.on('change', function (path, newValue, oldValue, opData) {
		t.equal(path, 'subchild.foo', 'Child: emitted path is subchild.foo');
		t.equal(newValue, 'hello', 'Child: emitted value is "hello"');
		t.equal(oldValue, undefined, 'Child: emitted old value is undefined');
		t.deepEqual(opData, { op: 'set', result: 'hello' }, 'Child: operation is correct');
		changed.c = true;
		changed.count += 1;
	});

	c2.on('change', function (path, newValue, oldValue, opData) {
		t.equal(path, 'foo', 'Subchild: emitted path is foo');
		t.equal(newValue, 'hello', 'Subchild: emitted value is "hello"');
		t.equal(oldValue, undefined, 'Subchild: emitted old value is undefined');
		t.deepEqual(opData, { op: 'set', result: 'hello' }, 'Subchild: operation is correct');
		changed.c2 = true;
		changed.count += 1;
	});

	d.on('change:child.subchild.foo', function (newValue, oldValue, opData) {
		t.equal(newValue, 'hello', 'Parent: emitted value is "hello"');
		t.equal(oldValue, undefined, 'Parent: emitted old value is undefined');
		t.deepEqual(opData, { op: 'set', result: 'hello' }, 'Parent: operation is correct');
		changed.dpath = true;
		changed.count += 1;
	});

	c.on('change:subchild.foo', function (newValue, oldValue, opData) {
		t.equal(newValue, 'hello', 'Child: emitted value is "hello"');
		t.equal(oldValue, undefined, 'Child: emitted old value is undefined');
		t.deepEqual(opData, { op: 'set', result: 'hello' }, 'Child: operation is correct');
		changed.cpath = true;
		changed.count += 1;
	});

	c2.on('change:foo', function (newValue, oldValue, opData) {
		t.equal(newValue, 'hello', 'Subchild: emitted value is "hello"');
		t.equal(oldValue, undefined, 'Subchild: emitted old value is undefined');
		t.deepEqual(opData, { op: 'set', result: 'hello' }, 'Subchild: operation is correct');
		changed.c2path = true;
		changed.count += 1;
	});

	// diff events:

	d.on('diff', function (opName, path, args) {
		t.equal(opName, 'set', 'Parent: diff operation is "set"');
		t.deepEqual(path, ['child', 'subchild', 'foo'], 'Parent: path is ["child", "subchild", "foo"]');
		t.equal(args.length, 1, 'Parent: 1 argument was passed to "set"');
		t.equal(args[0], 'hello', 'Parent: Argument passed is "hello"');
		diffs.d = true;
		diffs.count += 1;
	});

	c.on('diff', function (opName, path, args) {
		t.equal(opName, 'set', 'Child: diff operation is "set"');
		t.deepEqual(path, ['subchild', 'foo'], 'Child: path is ["subchild", "foo"]');
		t.equal(args.length, 1, 'Child: 1 argument was passed to "set"');
		t.equal(args[0], 'hello', 'Child: Argument passed is "hello"');
		diffs.c = true;
		diffs.count += 1;
	});

	c2.on('diff', function (opName, path, args) {
		t.equal(opName, 'set', 'Subchild: diff operation is "set"');
		t.deepEqual(path, ['foo'], 'Subchild: path is ["foo"]');
		t.equal(args.length, 1, 'Subchild: 1 argument was passed to "set"');
		t.equal(args[0], 'hello', 'Subchild: Argument passed is "hello"');
		diffs.c2 = true;
		diffs.count += 1;
	});

	c2.write('foo').set('hello');

	t.deepEqual(changed, expChanged, 'All expected change-events fired');
	t.deepEqual(diffs, expDiffs, 'All expected diff-events fired');

	t.throws(function () {
		d.wrap('does.not.exist');
	}, null, 'Cannot wrap non-existing paths');

	t.end();
});
