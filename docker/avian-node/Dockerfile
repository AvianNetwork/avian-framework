# syntax=docker/dockerfile:1
# Avian Core daemon — uses official pre-built binaries from GitHub releases.
# No official Docker image exists; this downloads and verifies the release tarball.
FROM debian:bookworm-slim

ARG AVIAN_VERSION=5.0.0-rc3

# Runtime deps for the Avian daemon binary
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    libboost-filesystem1.81.0 \
    libboost-thread1.81.0 \
    libssl3 \
    libevent-2.1-7 \
    libminiupnpc17 \
    gosu \
    && rm -rf /var/lib/apt/lists/*

# Download the official release binary (multi-arch aware)
RUN set -ex; \
    TARGETARCH="$(dpkg --print-architecture)"; \
    case "${TARGETARCH}" in \
      amd64)  ARCH="x86_64"  ;; \
      arm64)  ARCH="aarch64" ;; \
      armhf)  ARCH="arm32v7" ;; \
      *) echo "Unsupported arch: ${TARGETARCH}" && exit 1 ;; \
    esac; \
    TARBALL="avian-${AVIAN_VERSION}-${ARCH}-linux-gnu.tar.gz"; \
    URL="https://github.com/AvianNetwork/Avian/releases/download/v${AVIAN_VERSION}/${TARBALL}"; \
    curl -fSL "$URL" -o avian.tar.gz; \
    tar -xzf avian.tar.gz; \
    install -m 755 avian-${AVIAN_VERSION}/bin/aviand     /usr/local/bin/aviand; \
    install -m 755 avian-${AVIAN_VERSION}/bin/avian-cli  /usr/local/bin/avian-cli; \
    rm -rf avian.tar.gz avian-${AVIAN_VERSION}

RUN useradd -r -m -d /avian -s /bin/bash avian

VOLUME ["/avian/.avian"]

# P2P port, RPC port
EXPOSE 8814 7896

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
