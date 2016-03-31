var test = require('tape');
var dome = require('..');

test('Array operations', function (t) {
	var d = dome({ list: [] });

	t.equal(d.push('list', 'hello', 'world'), 2, 'Pushed "hello" and "world"');
	t.deepEqual(d.get('list'), ['hello', 'world'], 'Array matches');
	t.equal(d.pop('list'), 'world', '"world" popped');
	t.deepEqual(d.append('list', 'world'), ['hello', 'world'], 'Appended "world"');

	t.equal(d.shift('list'), 'hello', 'Shifted "hello" off');
	t.deepEqual(d.get('list'), ['world'], 'Array matches');
	t.equal(d.unshift('list', 'hello'), 2, 'Unshifted "hello"');
	t.deepEqual(d.get('list'), ['hello', 'world'], 'Array matches');

	t.deepEqual(d.clear('list'), [], 'Array cleared');
	t.deepEqual(d.append('list', 'hello', 'world'), ['hello', 'world'], 'Appended "hello" and "world"');

	t.deepEqual(d.fill('list', true), [true, true], 'Filled with boolean true');
	t.deepEqual(d.clear('list'), [], 'Array cleared');

	d.set('list', ['hello', 'removeme']);
	t.deepEqual(d.splice('list', 1, 1, 'world'), ['removeme'], 'Removed "removeme" and added "world"');
	t.deepEqual(d.reverse('list'), ['world', 'hello'], 'Reversed the array');
	t.deepEqual(d.sort('list'), ['hello', 'world'], 'Sorted the array');

	t.end();
});
