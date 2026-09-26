from django.db import models

class Event(models.Model):
    name = models.CharField(max_length=255, default='CalmStacks 24-Hour Hackathon 2026')
    event_type = models.CharField(max_length=100, default='Hackathon', blank=True)
    edition = models.CharField(max_length=100, default='Season 1, 2026', blank=True)
    start_date = models.CharField(max_length=50, default='2026-09-25', blank=True)
    end_date = models.CharField(max_length=50, default='2026-09-26', blank=True)
    venue = models.CharField(max_length=255, default='Malnad College of Engineering, Hassan', blank=True)
    organizer = models.CharField(max_length=255, default='Dept. of CSE, MCE Hassan // In collaboration with CalmStacks', blank=True)
    description = models.TextField(blank=True, default='Official 24-Hour Hackathon organized by Dept. of Computer Science & Engineering, Malnad College of Engineering, Hassan.')
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

    def to_dict(self):
        return {
            'name': self.name,
            'type': self.event_type,
            'edition': self.edition,
            'start_date': self.start_date,
            'end_date': self.end_date,
            'venue': self.venue,
            'organizer': self.organizer,
            'description': self.description,
            'updated_at': self.updated_at.isoformat() if self.updated_at else ''
        }


class Team(models.Model):
    id = models.CharField(max_length=50, primary_key=True)  # e.g. HACK-001
    registered_at = models.CharField(max_length=100, blank=True)
    team_name = models.CharField(max_length=255)
    team_size = models.CharField(max_length=100, blank=True)
    lead_name = models.CharField(max_length=255)
    usn = models.CharField(max_length=100, blank=True)
    email = models.CharField(max_length=255, blank=True)
    phone = models.CharField(max_length=100, blank=True)
    year = models.CharField(max_length=100, blank=True)
    member2 = models.CharField(max_length=255, blank=True)
    usn2 = models.CharField(max_length=100, blank=True)
    member3 = models.CharField(max_length=255, blank=True)
    usn3 = models.CharField(max_length=100, blank=True)
    member4 = models.CharField(max_length=255, blank=True)
    usn4 = models.CharField(max_length=100, blank=True)
    payment_status = models.CharField(max_length=50, default='PENDING', blank=True)
    amount = models.CharField(max_length=100, blank=True)
    utr = models.CharField(max_length=150, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at', 'id']

    def __str__(self):
        return f"{self.id} - {self.team_name} ({self.lead_name})"

    def to_dict(self):
        return {
            'id': self.id,
            'registered_at': self.registered_at,
            'team_name': self.team_name,
            'team_size': self.team_size,
            'lead_name': self.lead_name,
            'usn': self.usn,
            'email': self.email,
            'phone': self.phone,
            'year': self.year,
            'member2': self.member2,
            'usn2': self.usn2,
            'member3': self.member3,
            'usn3': self.usn3,
            'member4': self.member4,
            'usn4': self.usn4,
            'payment_status': self.payment_status,
            'amount': self.amount,
            'utr': self.utr,
        }


class Member(models.Model):
    id = models.CharField(max_length=50, primary_key=True)  # e.g. HACK-001-M1
    team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name='team_members')
    role = models.CharField(max_length=100, default='Member')
    name = models.CharField(max_length=255)
    usn = models.CharField(max_length=100, blank=True)
    email = models.CharField(max_length=255, blank=True)
    phone = models.CharField(max_length=100, blank=True)
    registered_at = models.CharField(max_length=100, blank=True)

    class Meta:
        ordering = ['id']

    def __str__(self):
        return f"{self.id} - {self.name} ({self.role})"

    def to_dict(self):
        return {
            'id': self.id,
            'team_id': self.team_id,
            'role': self.role,
            'name': self.name,
            'usn': self.usn,
            'email': self.email,
            'phone': self.phone,
            'registered_at': self.registered_at,
        }


class AdminAccount(models.Model):
    userid = models.CharField(max_length=100, unique=True)
    password = models.CharField(max_length=255)
    name = models.CharField(max_length=255)
    role = models.CharField(max_length=100, default='Admin')
    created_at = models.CharField(max_length=100, blank=True)

    def __str__(self):
        return f"{self.userid} ({self.role})"

    def to_dict(self):
        return {
            'userid': self.userid,
            'name': self.name,
            'role': self.role,
            'created_at': self.created_at or 'Active'
        }
