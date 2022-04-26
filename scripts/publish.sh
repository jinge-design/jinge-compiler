#!/bin/bash

if ! pnpm -v &> /dev/null
then
  npm install pnpm -g --registry=https://registry.npm.taobao.org
fi

if [ -n "$(git status --porcelain)" ]
then 
  echo "Git status must be clean.";
  exit -1
fi

if [ $(git rev-parse --abbrev-ref HEAD) == "master" ]
then
  export NPM_TAG="latest"
else
  export NPM_TAG="beta"
fi

pnpm install --registry=https://registry.npm.taobao.org
pnpm build
node ./scripts/prepublish.js
npm publish --tag=$NPM_TAG --registry=https://registry.npmjs.org
git checkout . # reset to clean