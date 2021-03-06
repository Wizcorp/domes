var test = require('tape');
var dome = require('..');

test('Array operations', function (t) {
	var d = dome({ list: [] });

	function reverseCompare(a, b) {
		return String(b).localeCompare(String(a));
	}

	d.write('list', function (w) {
		t.equal(w.push('hello', 'world'), 2, 'Pushed "hello" and "world"');
		t.deepEqual(w.get(), ['hello', 'world'], 'Array matches');
		t.equal(w.pop(), 'world', '"world" popped');
		t.deepEqual(w.append('world'), ['hello', 'world'], 'Appended "world"');

		t.equal(w.shift(), 'hello', 'Shifted "hello" off');
		t.equal(w.length, 1, 'Array length is 1');
		t.deepEqual(w.get(), ['world'], 'Array matches');
		t.equal(w.unshift('hello'), 2, 'Unshifted "hello"');
		t.deepEqual(w.get(), ['hello', 'world'], 'Array matches');

		t.deepEqual(w.clear(), [], 'Array cleared');
		t.deepEqual(w.append('hello', 'world'), ['hello', 'world'], 'Appended "hello" and "world"');

		t.deepEqual(w.fill(true), [true, true], 'Filled with boolean true');
		t.deepEqual(w.clear(), [], 'Array cleared');

		w.set(['hello', 'removeme']);
		t.deepEqual(w.splice(1, 1, 'world'), ['removeme'], 'Removed "removeme" and added "world"');
		t.deepEqual(w.reverse(), ['world', 'hello'], 'Reversed the array');
		d.extractDiff();

		t.deepEqual(w.sort(), ['hello', 'world'], 'Sorted the array');
		t.deepEqual(w.sort(reverseCompare), ['world', 'hello'], 'Sorted the array in reverse');
		t.deepEqual(w.reposition([1, 0]), ['hello', 'world'], 'Repositioned the array elements');
	});

	var diff = d.extractDiff();
	t.deepEqual(diff[0], ['reposition', ['list'], [[1, 0]]], 'Sort diff is correct');
	t.deepEqual(diff[1], ['reposition', ['list'], [[1, 0]]], 'Reverse sort diff is correct');
	t.deepEqual(diff[2], ['reposition', ['list'], [[1, 0]]], 'Reposition diff is correct');

	t.end();
});
