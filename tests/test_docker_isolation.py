"""Opt-in runtime smoke test; this is not a validation of an egress proxy."""
import os
import subprocess

import pytest


@pytest.mark.skipif(os.environ.get('TEST_DOCKER_ISOLATION') != '1',
                    reason='set TEST_DOCKER_ISOLATION=1 to run Docker smoke test')
def test_network_none_and_unprivileged_container():
    script = '''
import os, socket
assert os.getuid() == 65534
status = open('/proc/self/status').read().splitlines()
assert next(x for x in status if x.startswith('CapEff:')).split()[1] == '0000000000000000'
for address in [('1.1.1.1', 443), ('169.254.169.254', 80), ('172.17.0.1', 80)]:
    s = socket.socket()
    s.settimeout(2)
    try:
        s.connect(address)
    except OSError:
        pass
    else:
        raise AssertionError('unexpected network access: %r' % (address,))
    finally:
        s.close()
try:
    socket.getaddrinfo('youtube.com', 443)
except OSError:
    pass
else:
    raise AssertionError('DNS unexpectedly available')
try:
    open('/isolation-write-test', 'w')
except OSError:
    pass
else:
    raise AssertionError('root filesystem writable')
print('isolation smoke test passed')
'''
    result = subprocess.run([
        'docker', 'run', '--rm', '--network', 'none', '--user', '65534:65534',
        '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--read-only',
        '--pids-limit', '32', '--memory', '64m', 'python:3.11-slim-bookworm',
        'python', '-c', script,
    ], capture_output=True, text=True, timeout=60)
    assert result.returncode == 0, result.stdout + result.stderr
    assert 'isolation smoke test passed' in result.stdout
