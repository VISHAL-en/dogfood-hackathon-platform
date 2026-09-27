#!/usr/bin/env python3
"""
DOGFOOD 2026 Official Acceptance Checker
Executes the seven official DOGFOOD platform acceptance checks
against a running local instance configured via .dogfood.toml.
"""

import sys
import os
import json
import tomllib
import urllib.request
import urllib.error

def make_request(url: str, method: str = 'GET', headers: dict = None, body: dict = None):
    headers = headers or {}
    data = None
    if body is not None:
        data = json.dumps(body).encode('utf-8')
        if 'Content-Type' not in headers:
            headers['Content-Type'] = 'application/json'

    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            status = resp.status
            content = resp.read().decode('utf-8', errors='replace')
            resp_headers = dict(resp.getheaders())
            return status, content, resp_headers
    except urllib.error.HTTPError as e:
        status = e.code
        content = e.read().decode('utf-8', errors='replace')
        resp_headers = dict(e.headers)
        return status, content, resp_headers
    except Exception as e:
        return 0, str(e), {}

def main():
    config_path = sys.argv[1] if len(sys.argv) > 1 else '.dogfood.toml'
    if not os.path.exists(config_path):
        print(f"ERROR: Configuration file '{config_path}' not found.", file=sys.stderr)
        sys.exit(1)

    with open(config_path, 'rb') as f:
        config = tomllib.load(f)

    base_url = config.get('server', {}).get('base_url', 'http://localhost:3000').rstrip('/')

    print("=" * 64)
    print("DOGFOOD 2026 OFFICIAL ACCEPTANCE REPORT")
    print("=" * 64)
    print(f"Target Server:  {base_url}")
    print(f"Configuration:  {config_path}")
    print("-" * 64)

    checks_passed = 0
    total_checks = 7

    # -------------------------------------------------------------------------
    # CHECK 1: Public gallery endpoint returns HTTP 200
    # -------------------------------------------------------------------------
    c1 = config.get('check_1', {})
    url1 = f"{base_url}{c1.get('endpoint', '/gallery')}"
    status1, content1, _ = make_request(url1, method=c1.get('method', 'GET'))

    print("\n[CHECK 1] Public Gallery Availability")
    print(f"  Target:   GET {c1.get('endpoint', '/gallery')}")
    print(f"  Status:   HTTP {status1}")
    if status1 == c1.get('expected_status', 200):
        print("  Result:   PASS")
        checks_passed += 1
    else:
        print(f"  Result:   FAIL (Expected HTTP {c1.get('expected_status', 200)})")

    # -------------------------------------------------------------------------
    # CHECK 2: Configured fixture project title appears in public gallery
    # -------------------------------------------------------------------------
    c2 = config.get('check_2', {})
    expected_title = c2.get('expected_project_title', 'Fixture Project Alpha')

    print("\n[CHECK 2] Fixture Project Ingestion")
    print(f"  Target:   GET {c2.get('endpoint', '/gallery')}")
    print(f"  Looking:  \"{expected_title}\"")
    if expected_title in content1:
        print(f"  Result:   PASS (Found \"{expected_title}\" in public gallery response)")
        checks_passed += 1
    else:
        print(f"  Result:   FAIL (Project \"{expected_title}\" not present in gallery)")

    # -------------------------------------------------------------------------
    # CHECK 3: Participant attempting to POST submission to closed event receives 4xx
    # -------------------------------------------------------------------------
    c3 = config.get('check_3', {})
    url3 = f"{base_url}{c3.get('endpoint', '/submissions')}"
    headers3 = c3.get('headers', {})
    body3 = c3.get('body', {})
    status3, content3, _ = make_request(url3, method=c3.get('method', 'POST'), headers=headers3, body=body3)

    print("\n[CHECK 3] Closed-Event Submission Deadline Enforcement")
    print(f"  Target:   POST {c3.get('endpoint', '/submissions')}")
    print(f"  Event:    {body3.get('eventId', 'event_closed_fixture')}")
    print(f"  Status:   HTTP {status3}")
    if 400 <= status3 <= 499:
        print(f"  Result:   PASS (HTTP {status3} client error correctly returned)")
        checks_passed += 1
    else:
        print(f"  Result:   FAIL (Expected 4xx response, received {status3})")

    # -------------------------------------------------------------------------
    # CHECK 4: Judge A can access configured judge-scores route and receives HTTP 200
    # -------------------------------------------------------------------------
    c4 = config.get('check_4', {})
    url4 = f"{base_url}{c4.get('endpoint', '/judge/scores')}"
    headers4 = c4.get('headers', {})
    status4, content4, _ = make_request(url4, method=c4.get('method', 'GET'), headers=headers4)

    print("\n[CHECK 4] Judge A Own Scores Access")
    print(f"  Target:   GET {c4.get('endpoint', '/judge/scores')}")
    print("  Identity: Judge Alice (dogfood_token_judge_a)")
    print(f"  Status:   HTTP {status4}")
    if status4 == c4.get('expected_status', 200):
        print("  Result:   PASS (HTTP 200 OK received for authorized judge)")
        checks_passed += 1
    else:
        print(f"  Result:   FAIL (Expected HTTP {c4.get('expected_status', 200)}, received {status4})")

    # -------------------------------------------------------------------------
    # CHECK 5: Judge B attempting to access Judge A's peer scores receives HTTP 401 or 403
    # -------------------------------------------------------------------------
    c5 = config.get('check_5', {})
    url5 = f"{base_url}{c5.get('endpoint', '/judge/scores/peer')}"
    headers5 = c5.get('headers', {})
    status5, content5, _ = make_request(url5, method=c5.get('method', 'GET'), headers=headers5)

    print("\n[CHECK 5] Judge B Peer Score Isolation")
    print(f"  Target:   GET {c5.get('endpoint', '/judge/scores/peer')}")
    print("  Identity: Judge Bob (dogfood_token_judge_b)")
    print(f"  Status:   HTTP {status5}")
    if status5 in c5.get('expected_statuses', [401, 403]):
        print(f"  Result:   PASS (HTTP {status5} access denied strictly enforced)")
        checks_passed += 1
    else:
        print(f"  Result:   FAIL (Expected HTTP 401 or 403, received {status5})")

    # -------------------------------------------------------------------------
    # CHECK 6: Participant attempting to access judge scores receives HTTP 401 or 403
    # -------------------------------------------------------------------------
    c6 = config.get('check_6', {})
    url6 = f"{base_url}{c6.get('endpoint', '/judge/scores')}"
    headers6 = c6.get('headers', {})
    status6, content6, _ = make_request(url6, method=c6.get('method', 'GET'), headers=headers6)

    print("\n[CHECK 6] Participant Score Isolation")
    print(f"  Target:   GET {c6.get('endpoint', '/judge/scores')}")
    print("  Identity: Pat Participant (dogfood_token_participant)")
    print(f"  Status:   HTTP {status6}")
    if status6 in c6.get('expected_statuses', [401, 403]):
        print(f"  Result:   PASS (HTTP {status6} forbidden correctly enforced)")
        checks_passed += 1
    else:
        print(f"  Result:   FAIL (Expected HTTP 401 or 403, received {status6})")

    # -------------------------------------------------------------------------
    # CHECK 7: Organizer can access CSV export and receives HTTP 200 with comma in line 1
    # -------------------------------------------------------------------------
    c7 = config.get('check_7', {})
    url7 = f"{base_url}{c7.get('endpoint', '/exports/scores.csv')}"
    headers7 = c7.get('headers', {})
    status7, content7, _ = make_request(url7, method=c7.get('method', 'GET'), headers=headers7)

    first_line = content7.splitlines()[0] if content7 else ""
    has_comma = ',' in first_line

    print("\n[CHECK 7] Organizer Judging CSV Export")
    print(f"  Target:   GET {c7.get('endpoint', '/exports/scores.csv')}")
    print("  Identity: Lead Organizer (dogfood_token_organizer)")
    print(f"  Status:   HTTP {status7}")
    print(f"  Header:   \"{first_line[:40]}...\" (has comma: {has_comma})")
    if status7 == c7.get('expected_status', 200) and has_comma:
        print("  Result:   PASS (HTTP 200 with valid CSV comma header)")
        checks_passed += 1
    else:
        print(f"  Result:   FAIL (Expected HTTP 200 and comma header, got {status7})")

    # -------------------------------------------------------------------------
    # FINAL SUMMARY
    # -------------------------------------------------------------------------
    print("\n" + "=" * 64)
    print(f"TOTAL SCORE: {checks_passed}/{total_checks} CHECKS PASSED")
    if checks_passed == total_checks:
        print("FINAL VERDICT: ACCEPTED")
        print("=" * 64)
        sys.exit(0)
    else:
        print("FINAL VERDICT: REJECTED")
        print("=" * 64)
        sys.exit(1)

if __name__ == '__main__':
    main()
