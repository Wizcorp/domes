var test = require('tape');
var dome = require('..');

test('String operations', function (t) {
	var w = dome({ str: 'hello' }).write('str');

	t.equal(w.append(' ', 'world'), 'hello world', 'Can append multiple strings');

	t.end();
});
