#!/bin/sh

# This script reads all files of a given glob and environment substitutes
# all occurences of ${SOME_VAR}. If a variable isn't defined, the script
# will print to stderr the variable that wasn't replaced, and exit with a
# failure code.

# TODO: handle glob recursively, and with customizable options
for file in ./*.yaml
do
    tmp="You shouldnt see this text"

    # Use regex to find all instances of ${VAR_FOO}
    tmp=$(perl -pe 's/\$\{([_A-Z]+)\}/defined $ENV{$1} ? $ENV{$1} : "\${$1}"/eg' < $file > "$file.tmp")
    tmp=$(cat $file.tmp)
    rm "$file.tmp"

    # Use grep to check for any leftover ${less-strict%%vals}
    err=$(echo "$tmp" | grep -E '\${[^}]*}')

    # If something wasn't substitited, we throw that as an error
    if [ ${#err} -ge 1 ]; then
        >&2 echo "$tmp" | grep --color -E '\${[^}]*}'
        exit 1;
    fi

    # All substitutions happened successfully -- patch the file.
    echo "$tmp" > $file
done
