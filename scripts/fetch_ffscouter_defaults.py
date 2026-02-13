#!/usr/bin/env python3
"""
Fetch FFScouter battlestat estimates for all members of a Torn faction.

Produces a JSON file mapping player id -> battlestat human string, e.g.
{
  "12345": "1,234,567",
  "23456": "2,345,678"
}

Environment variables (or a .env file):
- TORN_API_KEY       Torn API key
- FFSCOUTER_API_KEY  FFScouter API key
- FACTION_ID         Faction id to fetch

Usage:
  python scripts/fetch_ffscouter_defaults.py --out ff_defaults.json

If `requests` is missing: `pip install requests`
"""
import os
import sys
import json
import argparse
import time
from urllib.parse import urlencode


def load_dotenv(path):
    if not os.path.exists(path):
        return
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            if '=' not in line:
                continue
            k, v = line.split('=', 1)
            k = k.strip()
            v = v.strip().strip('"').strip("'")
            if k and v:
                os.environ.setdefault(k, v)


def ensure_requests():
    try:
        import requests  # noqa: F401
    except Exception as e:
        print("The 'requests' package is required. Install it with: pip install requests")
        raise


def fetch_torn_faction_members(faction_id, torn_key, timeout=15):
    import requests
    base = 'https://api.torn.com/v2'
    url = f"{base}/faction/{faction_id}?selections=basic,members"
    headers = { 'Accept': 'application/json' }
    if torn_key:
        headers['Authorization'] = f"ApiKey {torn_key}"

    # retries/backoff
    retries = 3
    for attempt in range(1, retries + 1):
        try:
            resp = requests.get(url, headers=headers, timeout=timeout)
            data = resp.json()
            if not data:
                raise RuntimeError('Empty response from Torn API')
            break
        except Exception:
            # fallback to query param key on first failure
            try:
                params = {'key': torn_key}
                resp = requests.get(url, params=params, headers={'Accept':'application/json'}, timeout=timeout)
                data = resp.json()
                if not data:
                    raise RuntimeError('Empty response from Torn API')
                break
            except Exception as e:
                if attempt == retries:
                    raise RuntimeError(f"Failed to query Torn API after {retries} attempts: {e}")
                sleep_for = 1.0 * attempt
                time.sleep(sleep_for)

    # try several shapes
    faction = data.get('faction') if isinstance(data, dict) else None
    if not faction:
        faction = data

    members_raw = []
    if isinstance(faction, dict):
        if isinstance(faction.get('members'), list):
            members_raw = faction.get('members')
        elif isinstance(faction.get('members'), dict) and isinstance(faction.get('members').get('members'), list):
            members_raw = faction.get('members').get('members')
        elif isinstance(data.get('members'), list):
            members_raw = data.get('members')

    # Resolve a friendly faction name from several possible shapes
    resolved_name = None
    try:
        if isinstance(faction, dict):
            resolved_name = faction.get('name') or (faction.get('basic') or {}).get('name')
        if not resolved_name and isinstance(data, dict):
            resolved_name = data.get('name') or (data.get('basic') or {}).get('name')
    except Exception:
        resolved_name = None

    if not resolved_name:
        resolved_name = f"Faction {faction_id}"

    return members_raw, resolved_name


def extract_player_ids(members_raw):
    ids = []
    for m in members_raw:
        if not isinstance(m, dict):
            continue
        pid = m.get('player_id') or m.get('id') or m.get('user_id')
        try:
            if pid is not None:
                ids.append(int(pid))
        except Exception:
            continue
    # unique preserve order
    seen = set()
    out = []
    for i in ids:
        if i not in seen:
            seen.add(i)
            out.append(i)
    return out


def fetch_ffscouter_stats_batch(ff_key, ids_batch, timeout=15):
    import requests
    base = 'https://ffscouter.com/api/v1'
    targets = ",".join(str(i) for i in ids_batch)
    url = f"{base}/get-stats?key={ff_key}&targets={targets}"
    headers = { 'Accept': 'application/json' }

    # Simple retry/backoff for transient failures or rate limiting
    retries = 3
    for attempt in range(1, retries + 1):
        try:
            resp = requests.get(url, headers=headers, timeout=timeout)
            if resp.status_code >= 500 or resp.status_code == 429:
                raise RuntimeError(f"FFScouter returned status {resp.status_code}")
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            if attempt == retries:
                raise RuntimeError(f"FFScouter request failed after {retries} attempts: {e}")
            sleep_for = 1.0 * attempt
            time.sleep(sleep_for)
    # unreachable
    raise RuntimeError('FFScouter request failed')


def build_map_from_resp(resp):
    # resp could be array or object with results/data
    entries = []
    if resp is None:
        return {}
    if isinstance(resp, list):
        entries = resp
    elif isinstance(resp, dict):
        if isinstance(resp.get('results'), list):
            entries = resp.get('results')
        elif isinstance(resp.get('data'), list):
            entries = resp.get('data')
        else:
            # sometimes API returns an object keyed by id
            # try to gather numeric keys
            entries = []
            for v in resp.values():
                if isinstance(v, dict):
                    entries.append(v)

    out = {}
    for e in entries:
        if not isinstance(e, dict):
            continue
        pid = e.get('player_id') or e.get('playerId') or e.get('id') or e.get('user_id') or e.get('userId')
        bs = e.get('bs_estimate_human') or e.get('bs_estimate') or e.get('bs')
        if pid is None or bs is None:
            continue
        try:
            out[str(int(pid))] = str(bs)
        except Exception:
            out[str(pid)] = str(bs)
    return out


def main():
    parser = argparse.ArgumentParser(description='Fetch FFScouter battlestats for all members of a Torn faction')
    parser.add_argument('--env', '-e', help='Path to .env file to load (optional)')
    parser.add_argument('--out', '-o', default='ffscouter_defaults.json', help='Output JSON file')
    parser.add_argument('--batch', '-b', type=int, default=100, help='Batch size for FFScouter requests')
    args = parser.parse_args()

    # load .env if provided or fallback to ./ .env in repo root
    if args.env:
        load_dotenv(args.env)
    else:
        # search common locations
        cwd_env = os.path.join(os.getcwd(), '.env')
        if os.path.exists(cwd_env):
            load_dotenv(cwd_env)
        else:
            # try parent (repo root)
            parent = os.path.abspath(os.path.join(os.getcwd(), '..'))
            p_env = os.path.join(parent, '.env')
            if os.path.exists(p_env):
                load_dotenv(p_env)

    torn_key = os.environ.get('TORN_API_KEY') or os.environ.get('API_KEY') or os.environ.get('apikey')
    ff_key = os.environ.get('FFSCOUTER_API_KEY') or os.environ.get('FF_API_KEY') or os.environ.get('ffapikey')
    faction_id = os.environ.get('FACTION_ID')

    if not faction_id:
        print('FACTION_ID not set in environment or .env. Aborting.')
        sys.exit(2)

    if not torn_key:
        print('TORN_API_KEY not set in environment or .env. Aborting.')
        sys.exit(2)

    if not ff_key:
        print('FFSCOUTER_API_KEY not set in environment or .env. Aborting.')
        sys.exit(2)

    try:
        ensure_requests()
    except Exception:
        sys.exit(1)

    print(f'Fetching faction members for faction {faction_id}...')
    try:
        members_raw, faction_name = fetch_torn_faction_members(faction_id, torn_key)
    except Exception as e:
        print('Failed to fetch faction members:', e)
        sys.exit(1)

    ids = extract_player_ids(members_raw)
    if not ids:
        print('No members found for faction', faction_id)
        sys.exit(1)

    print(f'Found {len(ids)} unique member ids. Querying FFScouter in batches of {args.batch}...')

    all_map = {}
    for i in range(0, len(ids), args.batch):
        batch = ids[i:i+args.batch]
        try:
            resp = fetch_ffscouter_stats_batch(ff_key, batch)
            m = build_map_from_resp(resp)
            all_map.update(m)
            print(f'  Batch {i//args.batch + 1}: got {len(m)} stats')
        except Exception as e:
            print(f'  Batch {i//args.batch + 1} failed:', e)

    # Write output with metadata
    out_path = args.out
    out_obj = {
        'faction_id': int(faction_id) if str(faction_id).isdigit() else faction_id,
        'faction_name': faction_name,
        'generated_at': int(time.time()),
        'data': all_map
    }
    try:
        if out_path.endswith('.js'):
            js_content = (
                '// ffscouter_defaults.js - generated by fetch_ffscouter_defaults.py\n'
                'window.FFSCOUTER_DEFAULTS = ' + json.dumps(out_obj, indent=2, ensure_ascii=False) + ';\n'
            )
            with open(out_path, 'w', encoding='utf-8') as f:
                f.write(js_content)
            print(f'Wrote {len(all_map)} entries to {out_path} (faction: {faction_name}, JS format)')
        else:
            with open(out_path, 'w', encoding='utf-8') as f:
                json.dump(out_obj, f, indent=2, ensure_ascii=False)
            print(f'Wrote {len(all_map)} entries to {out_path} (faction: {faction_name}, JSON format)')
    except Exception as e:
        print('Failed to write output file:', e)
        sys.exit(1)


if __name__ == '__main__':
    main()
