#!/bin/sh

set -eu

homebrew_ca_bundle="/opt/homebrew/etc/ca-certificates/cert.pem"

if [ -z "${NODE_EXTRA_CA_CERTS:-}" ] && [ -f "$homebrew_ca_bundle" ]; then
  export NODE_EXTRA_CA_CERTS="$homebrew_ca_bundle"
fi

exec next "$@"
