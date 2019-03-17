#!/bin/sh

NAME=$(jq -r .name < package.json)
VERSION=$(jq -r .version < package.json)

docker build -t cornon/$NAME:$VERSION -t cornon/$NAME:latest . \
    && docker push cornon/$NAME
