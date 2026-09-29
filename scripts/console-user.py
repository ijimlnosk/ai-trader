#!/usr/bin/env python3
"""Prompt locally; send credentials only on SSH stdin, never command arguments/history."""
import argparse
import getpass
import json
import subprocess
import sys

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('action', choices=['create', 'reset-password', 'disable', 'enable', 'bind', 'unbind'])
parser.add_argument('--host', default='jinsol@sol-server')
parser.add_argument('--bind-configured-account', action='store_true')
args = parser.parse_args()
if args.host.startswith('-') or (args.bind_configured_account and args.action != 'create'):
    parser.error('Invalid host or binding option')
email = input('Login email: ').strip()
data = {'action': args.action, 'email': email}
if args.action in ('create', 'reset-password'):
    password = getpass.getpass('Password (15–128 characters): ')
    if not 15 <= len(password) <= 128 or password != getpass.getpass('Repeat password: '):
        sys.exit('Password length/confirmation mismatch')
    data['password'] = password
if args.action == 'create':
    data['bindConfiguredAccount'] = args.bind_configured_account
command = 'cd ai-trader-app && docker compose -p ai-trader-app exec -T server node dist/app/consoleUser.js'
result = subprocess.run(['ssh', args.host, command], input=json.dumps(data), text=True, check=False)
sys.exit(result.returncode)
