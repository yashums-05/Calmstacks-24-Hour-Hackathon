from django.urls import path
from . import views

urlpatterns = [
    # Pages
    path('', views.index_view, name='index'),
    path('login/', views.login_view, name='login'),
    path('login', views.login_view),
    path('admin-panel/', views.admin_view, name='admin_panel'),
    path('admin-panel', views.admin_view),
    path('admin/', views.admin_view),
    path('admin', views.admin_view),
    path('participants/', views.index_view),
    path('participants', views.index_view),
    path('participants/<str:participant_id>/', views.participant_page_view, name='participant_page'),
    path('participants/<str:participant_id>', views.participant_page_view),
    path('m/<str:member_id>/', views.member_page_view, name='member_page'),
    path('m/<str:member_id>', views.member_page_view),
    path('p/<str:team_id>/', views.team_page_view, name='team_page'),
    path('p/<str:team_id>', views.team_page_view),

    # APIs
    path('api/login/', views.api_login, name='api_login'),
    path('api/login', views.api_login),
    path('api/logout/', views.api_logout, name='api_logout'),
    path('api/logout', views.api_logout),
    path('api/auth/me/', views.api_me, name='api_me'),
    path('api/auth/me', views.api_me),

    path('api/admins/', views.api_admins, name='api_admins'),
    path('api/admins', views.api_admins),
    path('api/admins/<str:userid>/', views.api_admins),
    path('api/admins/<str:userid>', views.api_admins),

    path('api/event/', views.api_event, name='api_event'),
    path('api/event', views.api_event),

    path('api/participants/', views.api_participants, name='api_participants'),
    path('api/participants', views.api_participants),
    path('api/participants/<str:team_id>/', views.api_participant_detail),
    path('api/participants/<str:team_id>', views.api_participant_detail),
    path('api/participants/<str:team_id>/unlock/', views.api_participant_unlock),
    path('api/participants/<str:team_id>/unlock', views.api_participant_unlock),

    path('api/members/', views.api_members, name='api_members'),
    path('api/members', views.api_members),
    path('api/members/<str:member_id>/', views.api_member_detail),
    path('api/members/<str:member_id>', views.api_member_detail),
    path('api/members/<str:member_id>/unlock/', views.api_member_unlock),
    path('api/members/<str:member_id>/unlock', views.api_member_unlock),

    path('api/export/', views.api_export, name='api_export'),
    path('api/export', views.api_export),
    path('api/import/', views.api_import, name='api_import'),
    path('api/import', views.api_import),
]
