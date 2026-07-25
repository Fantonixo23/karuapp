import os

os.environ['DB_ENGINE'] = 'django.db.backends.sqlite3'
os.environ['DB_NAME'] = 'test_pipperfood'
os.environ['DB_USER'] = ''
os.environ['DB_PASSWORD'] = ''
os.environ['DB_HOST'] = ''
os.environ['DB_PORT'] = ''
os.environ['DEBUG'] = 'False'
os.environ['SECRET_KEY'] = 'test-secret-key-not-for-production'
