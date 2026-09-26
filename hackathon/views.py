import json
import re
from django.shortcuts import render, redirect, get_object_or_404
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.db.models import Q
from .models import Event, Team, Member, AdminAccount

PRIMARY_ADMIN_USERID = 'yashu'
PRIMARY_ADMIN_PASSWORD = 'Yashu@2005'

def normalize(s):
    return re.sub(r'\s+', ' ', str(s or '').strip().lower())

def is_authenticated(request):
    return request.session.get('is_admin_authenticated', False)

def get_auth_user(request):
    return request.session.get('admin_user', None)

def format_team_id(num):
    return f"HACK-{str(num).zfill(3)}"

def next_team_id():
    teams = Team.objects.all()
    max_num = 0
    for t in teams:
        m = re.match(r'^HACK-(\d+)', t.id, re.IGNORECASE)
        if m:
            n = int(m.group(1))
            if n > max_num:
                max_num = n
    return format_team_id(max_num + 1)

def sync_members_for_team(team):
    # Remove existing auto-generated members for this team and recreate from team fields
    Member.objects.filter(team=team).delete()
    m_idx = 1
    members = []

    # Lead
    m1 = Member.objects.create(
        id=f"{team.id}-M{m_idx}",
        team=team,
        role="Team Lead",
        name=team.lead_name or "",
        usn=team.usn or "",
        email=team.email or "",
        phone=team.phone or "",
        registered_at=team.registered_at or ""
    )
    members.append(m1)
    m_idx += 1

    if team.member2 and team.member2.strip():
        m2 = Member.objects.create(
            id=f"{team.id}-M{m_idx}",
            team=team,
            role="Member 2",
            name=team.member2.strip(),
            usn=team.usn2 or "",
            email="",
            phone="",
            registered_at=team.registered_at or ""
        )
        members.append(m2)
        m_idx += 1

    if team.member3 and team.member3.strip():
        m3 = Member.objects.create(
            id=f"{team.id}-M{m_idx}",
            team=team,
            role="Member 3",
            name=team.member3.strip(),
            usn=team.usn3 or "",
            email="",
            phone="",
            registered_at=team.registered_at or ""
        )
        members.append(m3)
        m_idx += 1

    if team.member4 and team.member4.strip():
        m4 = Member.objects.create(
            id=f"{team.id}-M{m_idx}",
            team=team,
            role="Member 4",
            name=team.member4.strip(),
            usn=team.usn4 or "",
            email="",
            phone="",
            registered_at=team.registered_at or ""
        )
        members.append(m4)
        m_idx += 1

    return members

def get_or_create_default_event():
    ev = Event.objects.first()
    if not ev:
        ev = Event.objects.create(
            name="CalmStacks 24-Hour Hackathon 2026",
            event_type="Hackathon",
            edition="Season 1, 2026",
            start_date="2026-09-25",
            end_date="2026-09-26",
            venue="Malnad College of Engineering, Hassan",
            organizer="Dept. of CSE, MCE Hassan // In collaboration with CalmStacks",
            description="Official 24-Hour Hackathon organized by Dept. of Computer Science & Engineering, Malnad College of Engineering, Hassan."
        )
    return ev


# ── Page Views ───────────────────────────────────────────────────────
def index_view(request):
    return render(request, 'index.html')

def login_view(request):
    redirect_url = request.GET.get('redirect')
    if redirect_url and (redirect_url.startswith('/m/') or redirect_url.startswith('/p/') or redirect_url.startswith('/participants/')):
        return redirect(redirect_url)
    if is_authenticated(request):
        return redirect('/admin-panel/')
    return render(request, 'login.html')

def admin_view(request):
    if not is_authenticated(request):
        return redirect('/login/?redirect=/admin-panel/')
    return render(request, 'admin.html')

def participant_page_view(request, participant_id):
    pid = participant_id.strip()
    if '-M' in pid.upper() or Member.objects.filter(id__iexact=pid).exists():
        return render(request, 'member.html')
    return render(request, 'profile.html')

def member_page_view(request, member_id):
    return render(request, 'member.html')

def team_page_view(request, team_id):
    return render(request, 'profile.html')


# ── Auth Endpoints ───────────────────────────────────────────────────
@csrf_exempt
def api_login(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'POST required'}, status=405)
    try:
        data = json.loads(request.body.decode('utf-8'))
    except Exception:
        data = request.POST

    userid = (data.get('userid') or data.get('username') or '').strip()
    password = str(data.get('password') or '')

    # Check Primary Super Admin
    if userid == PRIMARY_ADMIN_USERID and password == PRIMARY_ADMIN_PASSWORD:
        request.session['is_admin_authenticated'] = True
        request.session['admin_user'] = userid
        request.session['admin_role'] = 'Super Admin'
        return JsonResponse({'success': True, 'user': userid, 'name': 'Yashwanth M S', 'role': 'Super Admin'})

    # Check Database Admins
    admin = AdminAccount.objects.filter(userid__iexact=userid, password=password).first()
    if admin:
        request.session['is_admin_authenticated'] = True
        request.session['admin_user'] = admin.userid
        request.session['admin_role'] = admin.role
        return JsonResponse({'success': True, 'user': admin.userid, 'name': admin.name, 'role': admin.role})

    return JsonResponse({'error': 'Invalid user ID or password'}, status=401)

@csrf_exempt
def api_logout(request):
    request.session.flush()
    return JsonResponse({'success': True})

def api_me(request):
    if is_authenticated(request):
        return JsonResponse({'authenticated': True, 'user': get_auth_user(request) or 'admin'})
    return JsonResponse({'authenticated': False})


# ── Admin Account APIs ──────────────────────────────────────────────
@csrf_exempt
def api_admins(request, userid=None):
    if not is_authenticated(request):
        return JsonResponse({'error': 'Admin authorization required'}, status=401)

    if request.method == 'GET':
        admins_list = [
            {'userid': PRIMARY_ADMIN_USERID, 'name': 'Yashwanth M S', 'role': 'Super Admin', 'created_at': 'Primary Admin'}
        ]
        db_admins = AdminAccount.objects.exclude(userid__iexact=PRIMARY_ADMIN_USERID)
        for a in db_admins:
            admins_list.append(a.to_dict())
        return JsonResponse({'admins': admins_list})

    elif request.method == 'POST':
        try:
            data = json.loads(request.body.decode('utf-8'))
        except Exception:
            data = request.POST
        uid = (data.get('userid') or '').strip()
        pwd = str(data.get('password') or '')
        name = (data.get('name') or uid).strip()
        role = data.get('role') or 'Admin'

        if not uid or not pwd:
            return JsonResponse({'error': 'User ID and password are required'}, status=400)
        if uid.lower() == PRIMARY_ADMIN_USERID.lower() or AdminAccount.objects.filter(userid__iexact=uid).exists():
            return JsonResponse({'error': 'Admin with this User ID already exists'}, status=400)

        import datetime
        acc = AdminAccount.objects.create(
            userid=uid,
            password=pwd,
            name=name,
            role=role,
            created_at=datetime.date.today().strftime('%d/%m/%Y')
        )
        return JsonResponse({'success': True, 'admin': acc.to_dict()}, status=201)

    elif request.method == 'DELETE':
        if not userid:
            return JsonResponse({'error': 'User ID required'}, status=400)
        if userid.lower() == PRIMARY_ADMIN_USERID.lower():
            return JsonResponse({'error': 'Cannot remove primary super admin'}, status=400)
        deleted, _ = AdminAccount.objects.filter(userid__iexact=userid).delete()
        if deleted:
            return JsonResponse({'success': True})
        return JsonResponse({'error': 'Admin not found'}, status=404)

    return JsonResponse({'error': 'Method not allowed'}, status=405)


# ── Event APIs ───────────────────────────────────────────────────────
@csrf_exempt
def api_event(request):
    ev = get_or_create_default_event()
    if request.method == 'GET':
        return JsonResponse(ev.to_dict())
    elif request.method == 'POST':
        if not is_authenticated(request):
            return JsonResponse({'error': 'Admin authorization required'}, status=401)
        try:
            data = json.loads(request.body.decode('utf-8'))
        except Exception:
            data = request.POST
        if not data.get('name'):
            return JsonResponse({'error': 'Event name required'}, status=400)

        ev.name = data.get('name', ev.name)
        ev.event_type = data.get('type', ev.event_type)
        ev.edition = data.get('edition', ev.edition)
        ev.start_date = data.get('start_date', ev.start_date)
        ev.end_date = data.get('end_date', ev.end_date)
        ev.venue = data.get('venue', ev.venue)
        ev.organizer = data.get('organizer', ev.organizer)
        ev.description = data.get('description', ev.description)
        ev.save()
        return JsonResponse(ev.to_dict())

    return JsonResponse({'error': 'Method not allowed'}, status=405)


# ── Participants (Teams) APIs ────────────────────────────────────────
@csrf_exempt
def api_participants(request):
    if not is_authenticated(request):
        return JsonResponse({'error': 'Admin authorization required'}, status=401)

    if request.method == 'GET':
        search = request.GET.get('search', '').strip()
        qs = Team.objects.all()
        if search:
            qs = qs.filter(
                Q(id__icontains=search) |
                Q(team_name__icontains=search) |
                Q(lead_name__icontains=search) |
                Q(usn__icontains=search) |
                Q(email__icontains=search) |
                Q(phone__icontains=search) |
                Q(member2__icontains=search) |
                Q(usn2__icontains=search) |
                Q(member3__icontains=search) |
                Q(usn3__icontains=search) |
                Q(member4__icontains=search) |
                Q(usn4__icontains=search) |
                Q(payment_status__icontains=search) |
                Q(utr__icontains=search)
            )
        teams = [t.to_dict() for t in qs]
        return JsonResponse({'participants': teams, 'total': len(teams)})

    elif request.method == 'POST':
        try:
            data = json.loads(request.body.decode('utf-8'))
        except Exception:
            data = request.POST

        lead_name = (data.get('lead_name') or '').strip()
        email = (data.get('email') or '').strip()
        team_name = (data.get('team_name') or '').strip()

        if not lead_name or not email or not team_name:
            return JsonResponse({'error': 'team_name, lead_name and email are required'}, status=400)

        import datetime
        hack_id = next_team_id()
        team = Team.objects.create(
            id=hack_id,
            registered_at=data.get('registered_at') or datetime.datetime.now().strftime('%d/%m/%Y, %H:%M:%S'),
            team_name=team_name,
            team_size=data.get('team_size', ''),
            lead_name=lead_name,
            usn=data.get('usn', '').strip(),
            email=email,
            phone=data.get('phone', '').strip(),
            year=data.get('year', ''),
            member2=data.get('member2', '').strip(),
            usn2=data.get('usn2', '').strip(),
            member3=data.get('member3', '').strip(),
            usn3=data.get('usn3', '').strip(),
            member4=data.get('member4', '').strip(),
            usn4=data.get('usn4', '').strip(),
            payment_status=data.get('payment_status', 'PENDING'),
            amount=data.get('amount', '').strip(),
            utr=data.get('utr', '').strip(),
        )
        members = sync_members_for_team(team)
        host_url = request.build_absolute_uri('/')[:-1]

        res_data = team.to_dict()
        res_data['profile_url'] = f"{host_url}/participants/{team.id}"
        res_data['members'] = [
            {**m.to_dict(), 'profile_url': f"{host_url}/participants/{m.id}"}
            for m in members
        ]
        return JsonResponse(res_data, status=201)

    return JsonResponse({'error': 'Method not allowed'}, status=405)


@csrf_exempt
def api_participant_detail(request, team_id):
    team = Team.objects.filter(id__iexact=team_id).first()
    if not team:
        return JsonResponse({'error': 'Team not found'}, status=404)

    host_url = request.build_absolute_uri('/')[:-1]

    if request.method == 'GET':
        if is_authenticated(request):
            members = Member.objects.filter(team=team)
            return JsonResponse({
                'participant': {**team.to_dict(), 'profile_url': f"{host_url}/participants/{team.id}"},
                'members': [{**m.to_dict(), 'profile_url': f"{host_url}/participants/{m.id}"} for m in members],
                'event': get_or_create_default_event().to_dict()
            })
        return JsonResponse({'locked': True, 'id': team.id})

    elif request.method == 'PUT':
        if not is_authenticated(request):
            return JsonResponse({'error': 'Admin authorization required'}, status=401)
        try:
            data = json.loads(request.body.decode('utf-8'))
        except Exception:
            data = request.POST

        for field in ['team_name', 'team_size', 'lead_name', 'usn', 'email', 'phone', 'year',
                      'member2', 'usn2', 'member3', 'usn3', 'member4', 'usn4', 'payment_status', 'amount', 'utr']:
            if field in data:
                setattr(team, field, data[field])
        team.save()
        sync_members_for_team(team)
        return JsonResponse({**team.to_dict(), 'profile_url': f"{host_url}/participants/{team.id}"})

    elif request.method == 'DELETE':
        if not is_authenticated(request):
            return JsonResponse({'error': 'Admin authorization required'}, status=401)
        team.delete()
        return JsonResponse({'success': True})

    return JsonResponse({'error': 'Method not allowed'}, status=405)


@csrf_exempt
def api_participant_unlock(request, team_id):
    if request.method != 'POST':
        return JsonResponse({'error': 'POST required'}, status=405)
    team = Team.objects.filter(id__iexact=team_id).first()
    if not team:
        return JsonResponse({'error': 'Team not found'}, status=404)

    try:
        data = json.loads(request.body.decode('utf-8'))
    except Exception:
        data = request.POST

    input_pass = normalize(data.get('name') or data.get('password'))
    members = Member.objects.filter(team=team)

    allowed = [
        normalize(team.lead_name),
        normalize(team.member2),
        normalize(team.member3),
        normalize(team.member4),
    ] + [normalize(m.name) for m in members]
    allowed = [x for x in allowed if x]

    host_url = request.build_absolute_uri('/')[:-1]

    if is_authenticated(request) or (input_pass and input_pass in allowed):
        return JsonResponse({
            'success': True,
            'participant': {**team.to_dict(), 'profile_url': f"{host_url}/participants/{team.id}"},
            'members': [{**m.to_dict(), 'profile_url': f"{host_url}/participants/{m.id}"} for m in members],
            'event': get_or_create_default_event().to_dict()
        })

    return JsonResponse({'error': 'Incorrect password. Please enter the team lead or member name.'}, status=401)


# ── Members APIs ─────────────────────────────────────────────────────
@csrf_exempt
def api_members(request):
    if not is_authenticated(request):
        return JsonResponse({'error': 'Admin authorization required'}, status=401)

    if request.method == 'GET':
        search = request.GET.get('search', '').strip()
        qs = Member.objects.all()
        if search:
            qs = qs.filter(
                Q(id__icontains=search) |
                Q(name__icontains=search) |
                Q(usn__icontains=search) |
                Q(email__icontains=search) |
                Q(role__icontains=search) |
                Q(team__id__icontains=search)
            )
        members = [m.to_dict() for m in qs]
        return JsonResponse({'members': members, 'total': len(members)})

    elif request.method == 'POST':
        try:
            data = json.loads(request.body.decode('utf-8'))
        except Exception:
            data = request.POST

        team_id = (data.get('team_id') or '').strip()
        name = (data.get('name') or '').strip()
        if not team_id or not name:
            return JsonResponse({'error': 'team_id and name are required'}, status=400)

        team = Team.objects.filter(id__iexact=team_id).first()
        if not team:
            return JsonResponse({'error': 'Team not found'}, status=404)

        team_members_count = Member.objects.filter(team=team).count()
        next_num = team_members_count + 1
        import datetime
        m = Member.objects.create(
            id=f"{team.id}-M{next_num}",
            team=team,
            role=data.get('role') or f"Member {next_num}",
            name=name,
            usn=data.get('usn', '').strip(),
            email=data.get('email', '').strip(),
            phone=data.get('phone', '').strip(),
            registered_at=data.get('registered_at') or datetime.datetime.now().strftime('%d/%m/%Y, %H:%M:%S')
        )
        host_url = request.build_absolute_uri('/')[:-1]
        return JsonResponse({**m.to_dict(), 'profile_url': f"{host_url}/participants/{m.id}"}, status=201)

    return JsonResponse({'error': 'Method not allowed'}, status=405)


@csrf_exempt
def api_member_detail(request, member_id):
    member = Member.objects.filter(id__iexact=member_id).first()
    if not member:
        return JsonResponse({'error': 'Member not found'}, status=404)

    host_url = request.build_absolute_uri('/')[:-1]

    if request.method == 'GET':
        if is_authenticated(request):
            team = member.team
            teammates = Member.objects.filter(team=team)
            return JsonResponse({
                'member': {**member.to_dict(), 'profile_url': f"{host_url}/participants/{member.id}"},
                'team': team.to_dict(),
                'teammates': [{**m.to_dict(), 'profile_url': f"{host_url}/participants/{m.id}"} for m in teammates],
                'event': get_or_create_default_event().to_dict()
            })
        return JsonResponse({'locked': True, 'id': member.id})

    elif request.method == 'PUT':
        if not is_authenticated(request):
            return JsonResponse({'error': 'Admin authorization required'}, status=401)
        try:
            data = json.loads(request.body.decode('utf-8'))
        except Exception:
            data = request.POST

        for field in ['name', 'usn', 'email', 'phone', 'role']:
            if field in data:
                setattr(member, field, data[field])
        member.save()
        return JsonResponse({**member.to_dict(), 'profile_url': f"{host_url}/participants/{member.id}"})

    return JsonResponse({'error': 'Method not allowed'}, status=405)


@csrf_exempt
def api_member_unlock(request, member_id):
    if request.method != 'POST':
        return JsonResponse({'error': 'POST required'}, status=405)
    member = Member.objects.filter(id__iexact=member_id).first()
    if not member:
        return JsonResponse({'error': 'Participant not found'}, status=404)

    try:
        data = json.loads(request.body.decode('utf-8'))
    except Exception:
        data = request.POST

    input_pass = normalize(data.get('name') or data.get('password'))
    expected = normalize(member.name)
    host_url = request.build_absolute_uri('/')[:-1]

    if is_authenticated(request) or (input_pass and input_pass == expected):
        team = member.team
        teammates = Member.objects.filter(team=team)
        return JsonResponse({
            'success': True,
            'member': {**member.to_dict(), 'profile_url': f"{host_url}/participants/{member.id}"},
            'team': team.to_dict(),
            'teammates': [{**m.to_dict(), 'profile_url': f"{host_url}/participants/{m.id}"} for m in teammates],
            'event': get_or_create_default_event().to_dict()
        })

    return JsonResponse({'error': 'Incorrect password. Please enter the full name as registered.'}, status=401)


# ── JSON Export / Import ─────────────────────────────────────────────
def api_export(request):
    if not is_authenticated(request):
        return JsonResponse({'error': 'Admin authorization required'}, status=401)

    teams = [t.to_dict() for t in Team.objects.all()]
    members = [m.to_dict() for m in Member.objects.all()]
    admins = [
        {'userid': PRIMARY_ADMIN_USERID, 'name': 'Yashwanth M S', 'role': 'Super Admin', 'created_at': 'Primary Admin'}
    ] + [a.to_dict() for a in AdminAccount.objects.exclude(userid__iexact=PRIMARY_ADMIN_USERID)]

    ev = get_or_create_default_event().to_dict()
    import datetime
    payload = {
        'event': ev,
        'teams': teams,
        'participants': teams,
        'members': members,
        'admins': admins,
        'exported_at': datetime.datetime.now().isoformat()
    }

    res = HttpResponse(json.dumps(payload, indent=2), content_type='application/json')
    res['Content-Disposition'] = f'attachment; filename="hackathon-sqlite-{int(datetime.datetime.now().timestamp())}.json"'
    return res


@csrf_exempt
def api_import(request):
    if not is_authenticated(request):
        return JsonResponse({'error': 'Admin authorization required'}, status=401)

    try:
        data = json.loads(request.body.decode('utf-8'))
    except Exception as e:
        return JsonResponse({'error': f'Invalid JSON: {str(e)}'}, status=400)

    teams_data = data.get('teams') or data.get('participants') or []
    members_data = data.get('members') or []
    event_data = data.get('event')
    admins_data = data.get('admins') or []

    # Import Event
    if event_data:
        ev = get_or_create_default_event()
        ev.name = event_data.get('name', ev.name)
        ev.event_type = event_data.get('type', ev.event_type)
        ev.edition = event_data.get('edition', ev.edition)
        ev.start_date = event_data.get('start_date', ev.start_date)
        ev.end_date = event_data.get('end_date', ev.end_date)
        ev.venue = event_data.get('venue', ev.venue)
        ev.organizer = event_data.get('organizer', ev.organizer)
        ev.description = event_data.get('description', ev.description)
        ev.save()

    # Import Admins
    for a in admins_data:
        uid = a.get('userid')
        if uid and uid.lower() != PRIMARY_ADMIN_USERID.lower():
            AdminAccount.objects.update_or_create(
                userid=uid,
                defaults={
                    'password': a.get('password') or 'Admin@123',
                    'name': a.get('name') or uid,
                    'role': a.get('role') or 'Admin',
                    'created_at': a.get('created_at') or 'Imported'
                }
            )

    # Import Teams & Members
    for t in teams_data:
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

    if members_data:
        for m in members_data:
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
    else:
        # Re-sync members for all teams
        for team in Team.objects.all():
            sync_members_for_team(team)

    return JsonResponse({'success': True, 'count': Team.objects.count()})
