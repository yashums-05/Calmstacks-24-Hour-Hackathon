import os
import django
import json

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'hackathon_core.settings')
django.setup()

from hackathon.models import Event, Team, Member, AdminAccount

def seed():
    print("[*] Seeding SQLite database from data/store.json...")
    
    # 1. Primary Super Admin
    AdminAccount.objects.get_or_create(
        userid='yashu',
        defaults={
            'password': 'Yashu@2005',
            'name': 'Yashwanth M S',
            'role': 'Super Admin',
            'created_at': 'Primary Admin'
        }
    )
    print("  [+] Super Admin 'yashu' ready.")

    store_file = os.path.join(os.path.dirname(__file__), 'data', 'store.json')
    if not os.path.exists(store_file):
        print("  ⚠ data/store.json not found.")
        return

    with open(store_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # 2. Event
    ev_data = data.get('event') or {}
    ev, created = Event.objects.get_or_create(
        id=1,
        defaults={
            'name': ev_data.get('name', 'CalmStacks 24-Hour Hackathon 2026'),
            'event_type': ev_data.get('type', 'Hackathon'),
            'edition': ev_data.get('edition', 'Season 1, 2026'),
            'start_date': ev_data.get('start_date', '2026-09-25'),
            'end_date': ev_data.get('end_date', '2026-09-26'),
            'venue': ev_data.get('venue', 'Malnad College of Engineering, Hassan'),
            'organizer': ev_data.get('organizer', 'Dept. of CSE, MCE Hassan // In collaboration with CalmStacks'),
            'description': ev_data.get('description', 'Official 24-Hour Hackathon organized by Dept. of CSE, MCE Hassan.')
        }
    )
    if not created and ev_data:
        ev.name = ev_data.get('name', ev.name)
        ev.event_type = ev_data.get('type', ev.event_type)
        ev.edition = ev_data.get('edition', ev.edition)
        ev.start_date = ev_data.get('start_date', ev.start_date)
        ev.end_date = ev_data.get('end_date', ev.end_date)
        ev.venue = ev_data.get('venue', ev.venue)
        ev.organizer = ev_data.get('organizer', ev.organizer)
        ev.description = ev_data.get('description', ev.description)
        ev.save()
    print("  [+] Event settings populated.")

    # 3. Admins
    admins = data.get('admins', [])
    for a in admins:
        uid = a.get('userid')
        if uid and uid != 'yashu':
            AdminAccount.objects.update_or_create(
                userid=uid,
                defaults={
                    'password': a.get('password', 'Admin@123'),
                    'name': a.get('name', uid),
                    'role': a.get('role', 'Admin'),
                    'created_at': a.get('created_at', 'Active')
                }
            )

    # 4. Teams & Members
    teams = data.get('teams') or data.get('participants') or []
    team_count = 0
    member_count = 0

    for t in teams:
        tid = t.get('id')
        if not tid:
            continue
        team_obj, _ = Team.objects.update_or_create(
            id=tid,
            defaults={
                'registered_at': t.get('registered_at', ''),
                'team_name': t.get('team_name', ''),
                'team_size': t.get('team_size', ''),
                'lead_name': t.get('lead_name', ''),
                'usn': t.get('usn', ''),
                'email': t.get('email', ''),
                'phone': t.get('phone', ''),
                'year': t.get('year', ''),
                'member2': t.get('member2', ''),
                'usn2': t.get('usn2', ''),
                'member3': t.get('member3', ''),
                'usn3': t.get('usn3', ''),
                'member4': t.get('member4', ''),
                'usn4': t.get('usn4', ''),
                'payment_status': t.get('payment_status', 'PENDING'),
                'amount': t.get('amount', ''),
                'utr': t.get('utr', ''),
            }
        )
        team_count += 1

    members = data.get('members', [])
    if members:
        for m in members:
            mid = m.get('id')
            team_id = m.get('team_id')
            team = Team.objects.filter(id__iexact=team_id).first()
            if mid and team:
                Member.objects.update_or_create(
                    id=mid,
                    defaults={
                        'team': team,
                        'role': m.get('role', 'Member'),
                        'name': m.get('name', ''),
                        'usn': m.get('usn', ''),
                        'email': m.get('email', ''),
                        'phone': m.get('phone', ''),
                        'registered_at': m.get('registered_at', '')
                    }
                )
                member_count += 1
    else:
        # Generate members from teams
        for team in Team.objects.all():
            m_idx = 1
            # Lead
            Member.objects.update_or_create(
                id=f"{team.id}-M{m_idx}",
                defaults={
                    'team': team, 'role': 'Team Lead', 'name': team.lead_name or '',
                    'usn': team.usn or '', 'email': team.email or '', 'phone': team.phone or '',
                    'registered_at': team.registered_at or ''
                }
            )
            member_count += 1
            m_idx += 1
            if team.member2 and team.member2.strip():
                Member.objects.update_or_create(
                    id=f"{team.id}-M{m_idx}",
                    defaults={
                        'team': team, 'role': 'Member 2', 'name': team.member2.strip(),
                        'usn': team.usn2 or '', 'email': '', 'phone': '',
                        'registered_at': team.registered_at or ''
                    }
                )
                member_count += 1
                m_idx += 1
            if team.member3 and team.member3.strip():
                Member.objects.update_or_create(
                    id=f"{team.id}-M{m_idx}",
                    defaults={
                        'team': team, 'role': 'Member 3', 'name': team.member3.strip(),
                        'usn': team.usn3 or '', 'email': '', 'phone': '',
                        'registered_at': team.registered_at or ''
                    }
                )
                member_count += 1
                m_idx += 1
            if team.member4 and team.member4.strip():
                Member.objects.update_or_create(
                    id=f"{team.id}-M{m_idx}",
                    defaults={
                        'team': team, 'role': 'Member 4', 'name': team.member4.strip(),
                        'usn': team.usn4 or '', 'email': '', 'phone': '',
                        'registered_at': team.registered_at or ''
                    }
                )
                member_count += 1
                m_idx += 1

    print(f"[+] Seeding complete: {team_count} teams, {member_count} members loaded into db.sqlite3 successfully!")

if __name__ == '__main__':
    seed()
