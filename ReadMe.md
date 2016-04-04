# Domes

## What's a dome?

A dome is an object that wraps another object, and proxies reads and mutations to it. Those mutations are kept in a
diff-log that can be extracted, so that it can be synchronized to other domes. This way two domes can remain identical.
Imagine for example that you want to read a JSON object from your database and keep it synchronized in a browser.
You can instantiate domes both in Node and the browser, and exchange diff-logs to keep them synchronized.

You can also listen for events on changes on values, so you can update UI or do other operations based on particular
data being mutated.


## Benefits over other solutions

* Domes do not inject hidden meta data into your objects.
* Designed for crazy performance and zero side-effects.
* No more object-chaining errors (`Cannot read property 'foo' of undefined`).
* Simple API and simple design, easy to maintain.
* Ability to snapshot and rollback the data to a previous state.


## Installation

```sh
npm install domes --save
```


## Example usage

```js
var dome = require('domes');
var myObject = { hello: 'world' };

var d = dome(myObject);
d.mutate('hello.world.foo.bar').set({ a: { whole: { new: 'world' } } });
d.read('hello.world.foo.bar.a.whole.new').get(); // returns 'world'
d.mutate('list', function (m) {
	m.set([]);
	m.push('item1', 'item2');
	console.log('Item count:', m.length);
});
```


## API reference


### Glossary

* dome: wraps your value
* target: the value being wrapped
* path: a string that describes the path to a value (eg: `'foo.bar[2].foobar'`)
* empty path: a path that is an empty string which points to the root value that is wrapped
* reader: API to read the value at a path
* mutator: API to manipulate the value at a path
* diff: a list of changes that have been applied to the target
* child: a dome that wraps a sub-value of an already wrapped target

### Properties

**dome.target**

This is the object or array you wrapped in the dome.


### Reader

**Reader dome.read([string path[, Function runner(Reader)]])**

Returns a reader for the given path, which may be empty when you want to refer directly to the dome's target. It also
passes the reader to your optional callback if you provide it and runs this callback instantly. This can be a clean way
to use a reader for a very specific scope of tasks without leaking it. It has the following API.

**bool reader.exists()**

Returns `true` if the property at the reader's path exists (by means of `hasOwnProperty`), `false` otherwise.

**mixed reader.get([mixed fallback])**

Returns the value at the reader's path, or if it doesn't exist the given fallback value. If no value is found and no
fallback value is passed, `undefined` will be returned.

**mixed reader.copy()**

Returns a deep copy of the value at the reader's path. If no value is found `undefined` will be returned.


### Mutator

**Mutator dome.mutate([string path[, Function runner(Mutator)]])**

Returns a mutator for the given path, which may be empty when you want to refer directly to the dome's target. It also
passes the mutator to your optional callback if you provide it and runs this callback instantly. This can be a clean way
to use a mutator for a very specific scope of tasks without leaking it. It has the following API.


#### All types

**mixed mutator.set(mixed value)**

Sets the property at the mutator's path to the given value, and returns this new value.

**mixed mutator.del()**

Deletes the property at the mutator's path, and returns the previous value.

#### Numbers

**number mutator.inc([number amount])**

Increments the number property at the mutator's path by the given amount or by 1 if no amount is passed, then returns
the new value.

**number mutator.dec([number amount])**

Decrements the number property at the given path by the given amount or by 1 if no amount is passed, then returns the
new value.

#### Objects and Arrays

**array|object mutator.clear()**

Empties all properties or elements from the object or array at the mutator's path, then returns the object or array
reference.

#### Strings and Arrays

**array|string mutator.append([mixed arg1[, mixed arg2[, ...]]])**

Appends the given arguments to the array or string at the mutator's path, then returns the new value.

#### Arrays

**array mutator.fill(mixed value[, number start[, number end]])**

Fills the array at the mutator's path with the given value. You may provide start and end positions for fill to take
place. The full array is returned. Note that you do not need browser support for this to work, as the API is emulated.
More information [at MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/fill).

**number mutator.push([mixed arg1[, mixed arg2[, ...]]])**

Pushes all given values to the end of the array at the mutator's path, then returns the new array length.
More information [at MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/push).

**mixed mutator.pop()**

Pops a value from the end of the array at the mutator's path, then returns it.
More information [at MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/pop).

**mixed mutator.shift()**

Removes a value from the beginning of the array at the mutator's path, then returns it.
More information [at MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/shift).

**mixed mutator.unshift([mixed arg1[, mixed arg2[, ...]]])**

Adds all given values to the beginning of the array at the mutator's path, then returns the new length of the array.
More information [at MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/unshift).

**array mutator.splice(number start, number deleteCount, [, mixed arg1[, mixed arg2[, ...]]])**

Removes `deleteCount` items from the array at the mutator's path, starting at index `start`. It then inserts all given
values at that position. An array containing all deleted elements is returned (which will be empty if `deleteCount` was
`0`).
More information [at MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/splice).

**array mutator.reverse()**

Reverses the array at the mutator's path in place, then returns the array.
More information [at MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reverse).

**array mutator.sort()**

Sorts the array at the mutator's path in place, then returns the array. At this time, a custom compare function cannot
be provided.
More information [at MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort).


### Synchronization

**array dome.extractDiff()**

Returns the current diff, and resets the dome's internal diff.

**array dome.peekDiff()**

Returns the current diff, but does not remove it from the dome. This can be useful when debugging, but should generally
not be needed.

**bool dome.hasDiff()**

Returns true if changes have been made to the target since instantiation or last `dome.extractDiff()`.

**dome.applyDiff(array diff[, bool silent])**

Applies a diff structure to the dome, making all the changes and emitting all events that go with it. If `silent` is
`true`, change-events will not be emitted.


### Snapshots

**dome.snapshot()**

Makes a snapshot of the current target and diff. If you ever want to undo changes made, you will be able to roll back to
this point in time. You can make as many snapshots as you like, you are not limited to 1.

**dome.rollback()**

Rolls back to the last snapshot. You can call this method as often as you have called `snapshot()`.


### Events

**"change": string path, mixed newValue, mixed oldValue, object operationData**

The value at the given path has changed, and its value has changed from `oldValue` to `newValue`. The `operationData`
object has the properties `string op` (the operation name, eg: `"set"`) and `mixed result` (the return value of the
operation).

**"change:path": mixed newValue, mixed oldValue, object operationData**

Here, `path` in `"change:path"` is the actual path that changed. This allows you to listen for changes at very specific
locations. The arguments you receive are the same as with the `change` event.

**"diff": string opName, string path, array args**

A diff entry was added because of a mutation. The operation is described by `opName`, the path on which it happened by
`path` and the arguments passed to the operation are in the `args` array.


### Client domes

**Dome dome.wrap(string path)**

This creates a dome from a path on an existing dome. They will remain connected, so any changes that you make on the
child dome will automatically be added to the diff in the parent dome. The child will also keep its own diff state.
Changes made on the child dome will also be emitted as change events on the parent.


### Other

**dome.destroy()**

Removes all data and diff references from the dome, as well as all event listeners. If thie dome is a child dome of
another dome, this will have no impact on the parent and its data.

**object|array dome.toJSON()**

Returns the target object or array so that serializing the dome to JSON is the same as serializing its target to JSON.
