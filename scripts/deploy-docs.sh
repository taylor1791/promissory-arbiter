#!/bin/bash

set -o errexit -o nounset

rev=$(git rev-parse --short HEAD)

npm run gen-docs

cd out
git init

git config user.name $GIT_NAME
git config user.email $GIT_EMAIL

git add .
git commit -m "Auto-deploy docs $rev"

git push --force --quiet "https://$GH_TOKEN@${GH_REF}" master:gh-pages

