var test = require('tape');
var dome = require('..');

test('String operations', function (t) {
	var d = dome({ str: 'hello' });

	t.equal(d.append('str', ' ', 'world'), 'hello world', 'Can append multiple strings');

	t.end();
});
