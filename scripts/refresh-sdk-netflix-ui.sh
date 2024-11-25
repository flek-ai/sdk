#!/bin/sh

rm -rf ./dist
npm run build
rm -rf ../netflix-ui/node_modules/@flek-ai/flektest-sdk/dist
cp -r ./dist ../netflix-ui/node_modules/@flek-ai/flektest-sdk