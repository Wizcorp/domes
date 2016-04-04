var test = require('tape');
var dome = require('..');

test('Array operations', function (t) {
	var d = dome({ list: [] });

	d.mutate('list', function (m) {
		t.equal(m.push('hello', 'world'), 2, 'Pushed "hello" and "world"');
		t.deepEqual(m.get(), ['hello', 'world'], 'Array matches');
		t.equal(m.pop(), 'world', '"world" popped');
		t.deepEqual(m.append('world'), ['hello', 'world'], 'Appended "world"');

		t.equal(m.shift(), 'hello', 'Shifted "hello" off');
		t.equal(m.length, 1, 'Array length is 1');
		t.deepEqual(m.get(), ['world'], 'Array matches');
		t.equal(m.unshift('hello'), 2, 'Unshifted "hello"');
		t.deepEqual(m.get(), ['hello', 'world'], 'Array matches');

		t.deepEqual(m.clear(), [], 'Array cleared');
		t.deepEqual(m.append('hello', 'world'), ['hello', 'world'], 'Appended "hello" and "world"');

		t.deepEqual(m.fill(true), [true, true], 'Filled with boolean true');
		t.deepEqual(m.clear(), [], 'Array cleared');

		m.set(['hello', 'removeme']);
		t.deepEqual(m.splice(1, 1, 'world'), ['removeme'], 'Removed "removeme" and added "world"');
		t.deepEqual(m.reverse(), ['world', 'hello'], 'Reversed the array');
		t.deepEqual(m.sort(), ['hello', 'world'], 'Sorted the array');
	});

	t.end();
});
