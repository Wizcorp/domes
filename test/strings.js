var test = require('tape');
var dome = require('..');

test('String operations', function (t) {
	var m = dome({ str: 'hello' }).mutate('str');

	t.equal(m.append(' ', 'world'), 'hello world', 'Can append multiple strings');

	t.end();
});
