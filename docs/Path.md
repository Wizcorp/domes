# Path specification

A path is made up of strings that point to object properties and integers that point to array elements.

The format:

```bnf
path = [ property | index, { delimited property | index } ]

property = { unicode character - "." }
delimited property = ".", property
index = "[", integer, "]"

integer = { digit }
digit = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"
```

Examples of acceptable paths (ignore bounding quotation marks):

1. `"foo.list[3].hello.world"`
2. `""` (empty string)
3. `"[0][1][2]"`
4. `"[0][1][2].foo.bar[0]"`
5. `"0.1.2[2]"`

Examples of bad paths:

1. `".foo.list"`
2. `"foo[0"`
3. `"foo[0]bar"`
4. `"foo."`
