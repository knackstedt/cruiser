
surreal="surreal start --user=root --pass=root memory"
node="ts-node -O '{\"target\": \"esnext\", \"module\": \"commonjs\"}' database/install.ts"

eval "${surreal}" &
eval "${node}" &

wait $PID2
if (($? != 0)); then
    echo "ERROR: node exited with non-zero exitcode" >&2
    kill -9 $PID1
    exitcode=$((exitcode+1))
fi

wait $PID1
if (($? != 0)); then
    echo "ERROR: surrealdb exited with non-zero exitcode" >&2
    exitcode=$((exitcode+1))
fi
