#!/usr/bin/env python3
"""Check tracked content or every local Git object; never print matched values."""
import argparse
import io
import json
import re
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATTERNS = {
    'provider-api-key': rb'(?<![A-Za-z0-9_-])(?:gsk_[A-Za-z0-9]{20,}|sk-(?:proj-|ant-)?[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{30,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{30,}|AKIA[A-Z0-9]{16})',
    'supabase-api-key': rb'\bsb_(?:secret|publishable)_[A-Za-z0-9_-]{16,}',
    'telegram-token': rb'\b\d{6,12}:[A-Za-z0-9_-]{30,}\b',
    'jwt': rb'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}',
    'hardcoded-db-credentials': rb"(?:user|password)\s*:\s*['\"]postgres['\"]",
    'private-key': rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',
    'database-credentials': rb'(?:postgres(?:ql)?|mysql|redis)://[^\s\x22\x27<>]+:[^\s\x22\x27<>@]+@[^\s\x22\x27<>]+',
    'supabase-project-url': rb'https?://[a-z]{20}\.supabase\.(?:co|com)\b',
    'vercel-deployment-url': rb'https?://[A-Za-z0-9.-]+\.vercel\.app\b',
    'deployment-id': rb'\b(?:dpl|prj|team|org)_[A-Za-z0-9]{10,}',
    'telegram-channel-id': rb'(?<!\d)-100\d{8,}(?!\d)',
}
# Deliberate synthetic examples in transport checks and setup documentation.
EXAMPLES = {
    b'https://example.vercel.app', b'-1001234567890', b'-1000000000000',
}
SENSITIVE_NAME = re.compile(r'KEY|TOKEN|SECRET|PASSWORD|ALLOWED_IDS|CHANNEL_ID|APP_URL|SUPABASE_URL|BOT_USERNAME')


def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT)


def local_values():
    """Compare current configuration without logging or modifying it."""
    values = set()
    for path in ROOT.glob('.env*'):
        if path.name == '.env.example' or not path.is_file():
            continue
        for line in path.read_text(errors='replace').splitlines():
            match = re.match(r'(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=\s*(.*)', line)
            if not match or not SENSITIVE_NAME.search(match[1]):
                continue
            value = match[2].strip().strip('\x22\x27')
            if len(value) < 8 or value.startswith(('<', 'http://localhost', 'http://127.0.0.1')):
                continue
            values.add(value.encode())
            if match[1] == 'NEXT_PUBLIC_SUPABASE_URL':
                ref = re.search(r'https://([a-z]{20})\.', value)
                if ref:
                    values.add(ref[1].encode())
    return values


def texts(data):
    if data.startswith(b'PK'):
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as archive:
                for name in archive.namelist():
                    if name.endswith(('.xml', '.rels', '.txt', '.json')):
                        yield name, archive.read(name)
        except zipfile.BadZipFile:
            pass
    yield '', data


def inspect(data, values):
    hits = set()
    for member, content in texts(data):
        for kind, pattern in PATTERNS.items():
            for match in re.finditer(pattern, content):
                if match[0] in EXAMPLES:
                    continue
                # Credential-like URI examples use explicit placeholder brackets.
                hits.add((kind, member))
        if any(value in content for value in values):
            hits.add(('local-configuration-value', member))
    return sorted(hits)


def forbidden_path(path):
    p = Path(path)
    return ((p.name.startswith('.env') and p.name != '.env.example')
            or any(part in {'.vercel', '.aws', '.ssh'} for part in p.parts)
            or path.startswith('supabase/.temp/')
            or p.name in {'id_rsa', 'id_ed25519', 'credentials.json'})


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--history', action='store_true', help='Scan all local blobs, commits and tags, including unreachable objects')
    args = parser.parse_args()
    values = local_values()
    findings = []
    scanned = 0
    paths = [p.decode() for p in git('ls-files', '--cached', '--others', '--exclude-standard', '-z').split(b'\0') if p]
    for path in paths:
        if forbidden_path(path):
            findings.append({'location': path, 'kind': 'private-configuration-file'})
        if not args.history and (ROOT / path).is_file():
            scanned += 1
            for kind, member in inspect((ROOT / path).read_bytes(), values):
                findings.append({'location': path, 'kind': kind, 'archive_member': member})
    if args.history:
        # Check historical filenames too; deleted config must not escape the check.
        for commit in git('rev-list', '--all', '--reflog').splitlines():
            for raw in git('ls-tree', '-rz', '--name-only', commit.decode()).split(b'\0'):
                path = raw.decode(errors='replace')
                if path and forbidden_path(path):
                    findings.append({'location': commit.decode()[:12] + ':' + path, 'kind': 'historical-private-file'})
        proc = subprocess.Popen(['git', 'cat-file', '--batch-all-objects', '--batch'], cwd=ROOT, stdout=subprocess.PIPE)
        while header := proc.stdout.readline():
            oid, kind, size = header.split()
            data = proc.stdout.read(int(size))
            proc.stdout.read(1)
            if kind not in (b'blob', b'commit', b'tag'):
                continue
            scanned += 1
            for hit, member in inspect(data, values):
                findings.append({'location': 'git-object:' + oid.decode()[:12], 'kind': hit, 'archive_member': member})
        if proc.wait():
            raise RuntimeError('Git object scan failed')
    print(json.dumps({'mode': 'all-local-git-objects' if args.history else 'tracked-and-untracked-working-files',
                      'scanned': scanned, 'findings': findings}, ensure_ascii=False, indent=2))
    return bool(findings)


if __name__ == '__main__':
    sys.exit(main())
