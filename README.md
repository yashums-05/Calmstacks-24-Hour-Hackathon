# CalmStacks 24-Hour Hackathon 2026 — Django & SQLite ID System

A Django web application with SQLite database for managing hackathon teams, participants, verified digital records, and password-protected profile access.

---

## 🚀 Tech Stack
- **Framework:** Python 3 + Django 5.x / 6.x
- **Database:** SQLite (`db.sqlite3`)
- **Frontend:** Vanilla HTML5, Tailwind CSS, JetBrains Mono
- **Organized by:** Dept. of CSE, Malnad College of Engineering, Hassan

---

## 💻 Quick Start

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Run database migrations (if needed)
python manage.py migrate

# 3. Seed initial database (76 teams + 250 members)
python seed_db.py

# 4. Start the server
python manage.py runserver
```

---

## 🌐 URLs & Access

- **Public Portal:** `http://127.0.0.1:8000/`
- **Admin Dashboard:** `http://127.0.0.1:8000/admin-panel/`
- **Django Admin:** `http://127.0.0.1:8000/django-admin/`
- **Participant Access (e.g.):** `http://127.0.0.1:8000/m/HACK-001-M1`

---

## 🔑 Default Admin Credentials

- **User ID:** `yashu`
- **Password:** `Yashu@2005`

---

## 📁 Project Structure

```
.
├── db.sqlite3               ← SQLite Database
├── manage.py                ← Django CLI
├── requirements.txt         ← Python dependencies
├── seed_db.py               ← Database seeder script
├── hackathon/               ← Core Django App (Models, Views, APIs)
│   ├── models.py
│   ├── views.py
│   ├── urls.py
│   └── admin.py
├── hackathon_core/          ← Django Project Settings
│   ├── settings.py
│   └── urls.py
├── templates/               ← HTML Templates
│   ├── index.html
│   ├── login.html
│   ├── admin.html
│   ├── member.html
│   └── profile.html
└── public/                  ← Static Assets
```
