"""Audio probing is disabled until the parser can run in a sandboxed container.

Do not pipe untrusted media to host-side parsers or return media bytes to the host.
"""
import sys


if __name__ == '__main__':
    print('Audio probe disabled: an isolated, resource-limited parser is required.', file=sys.stderr)
    sys.exit(1)
