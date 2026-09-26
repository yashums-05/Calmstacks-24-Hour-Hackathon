from django.contrib import admin
from .models import Event, Team, Member, AdminAccount

@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ('name', 'event_type', 'edition', 'start_date', 'venue')

@admin.register(Team)
class TeamAdmin(admin.ModelAdmin):
    list_display = ('id', 'team_name', 'lead_name', 'usn', 'payment_status', 'amount')
    search_fields = ('id', 'team_name', 'lead_name', 'usn', 'email', 'phone')
    list_filter = ('payment_status', 'year')

@admin.register(Member)
class MemberAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'usn', 'role', 'team')
    search_fields = ('id', 'name', 'usn', 'email')
    list_filter = ('role',)

@admin.register(AdminAccount)
class AdminAccountAdmin(admin.ModelAdmin):
    list_display = ('userid', 'name', 'role', 'created_at')
