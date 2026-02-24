#!/usr/bin/env python3
"""
Fetch FFScouter battlestat estimates for all members of a Torn faction.

Produces a JSON file with metadata and raw FFScouter entries, e.g.
{
  "faction_id": 123,
  "faction_name": "Example",
  "generated_at": 1700000000,
  "data": [
    {
      "player_id": 111,
      "fair_fight": 5.39,
      "bs_estimate": 2989885521,
      "bs_estimate_human": "2.99b",
      "last_updated": 1747333361
    }
  ]
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
    except Exception:
        print("The 'requests' package is required. Install it with: pip install requests")
        raise


def fetch_torn_faction_members(faction_id, torn_key, timeout=15):
    import requests
    base = 'https://api.torn.com/v2'
    url = f"{base}/faction/{faction_id}?selections=basic,members"
    headers = {'Accept': 'application/json'}
    if torn_key:
        headers['Authorization'] = f"ApiKey {torn_key}"

    retries = 3
    for attempt in range(1, retries + 1):
        try:
            resp = requests.get(url, headers=headers, timeout=timeout)
            data = resp.json()
            if not data:
                raise RuntimeError('Empty response from Torn API')
            break
        except Exception:
            try:
                params = {'key': torn_key}
                resp = requests.get(url, params=params, headers={'Accept': 'application/json'}, timeout=timeout)
                data = resp.json()
                if not data:
                    raise RuntimeError('Empty response from Torn API')
                break
            except Exception as e:
                if attempt == retries:
                    raise RuntimeError(f"Failed to query Torn API after {retries} attempts: {e}")
                time.sleep(1.0 * attempt)

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
    headers = {'Accept': 'application/json'}

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
            time.sleep(1.0 * attempt)
    raise RuntimeError('FFScouter request failed')


def build_entries_from_resp(resp):
    """Normalize FFScouter responses into a flat list of entry dicts."""
    if resp is None:
        return []
    if isinstance(resp, list):
        return [e for e in resp if isinstance(e, dict)]
    if isinstance(resp, dict):
        if isinstance(resp.get('results'), list):
            return [e for e in resp.get('results') if isinstance(e, dict)]
        if isinstance(resp.get('data'), list):
            return [e for e in resp.get('data') if isinstance(e, dict)]

        entries = []
        for v in resp.values():
            if isinstance(v, dict):
                entries.append(v)
        return entries
    return []


def main():
    parser = argparse.ArgumentParser(description='Fetch FFScouter battlestats for all members of a Torn faction')
    parser.add_argument('--env', '-e', help='Path to .env file to load (optional)')
    parser.add_argument('--out', '-o', default='ffscouter_defaults.json', help='Output JSON file')
    parser.add_argument('--batch', '-b', type=int, default=100, help='Batch size for FFScouter requests')
    args = parser.parse_args()

    if args.env:
        load_dotenv(args.env)
    else:
        cwd_env = os.path.join(os.getcwd(), '.env')
        if os.path.exists(cwd_env):
            load_dotenv(cwd_env)
        else:
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

    all_entries = []
    for i in range(0, len(ids), args.batch):
        batch = ids[i:i + args.batch]
        try:
            resp = fetch_ffscouter_stats_batch(ff_key, batch)
            entries = build_entries_from_resp(resp)
            all_entries.extend(entries)
            print(f'  Batch {i // args.batch + 1}: got {len(entries)} stats')
        except Exception as e:
            print(f'  Batch {i // args.batch + 1} failed:', e)

    out_obj = {
        'faction_id': int(faction_id) if str(faction_id).isdigit() else faction_id,
        'faction_name': faction_name,
        'generated_at': int(time.time()),
        'data': all_entries
    }
    try:
        with open(args.out, 'w', encoding='utf-8') as f:
            json.dump(out_obj, f, indent=2, ensure_ascii=False)
        print(f'Wrote {len(all_entries)} entries to {args.out} (faction: {faction_name})')
    except Exception as e:
        print('Failed to write output file:', e)
        sys.exit(1)


if __name__ == '__main__':
    main()
