# Diff specification

A diff is an array made up of diff-items that are to be processed in sequence.

```bnf
diff = "[", diff item, "]"
diff item = '["', operation name, '",', path, ",", args, "]"

operation name = "set" | "del" | "inc" | "dec" | "clear" | "append" | "fill" |
                 "push" | "pop" | "shift" | "unshift" | "splice" | "reverse" |
                 "sort" | "invoke"

path = "[", [ path chunk { ",", path chunk } ], "]"

args = array

path chunk = { string - "." }

value = null | undefined | boolean | number | string | array | object

null = "null"
undefined = "undefined"
boolean = "true" | "false"
number = { digit }, [ ".", { digit } ]
string = '"', { unicode character - '"' | '\"' }, '"'
array = "[", [ value, { ",", value } ], "]"
object = "{", [ property assignment, { ",", property assignment } ], "}"

property assignment = string, "=", value

digit = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"
```
