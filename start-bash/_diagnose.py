#!/usr/bin/env python3
"""
Diagnostic script for Dify environment validation
"""
import sys
import os
import argparse
from pathlib import Path


def check_env():
    """Check .env file configuration"""
    print("\n=== Checking .env configuration ===")
    env_path = Path("api/.env") if Path("api/.env").exists() else Path(".env")

    if not env_path.exists():
        print(f"ERROR: {env_path} not found")
        return False

    required_keys = ["SECRET_KEY", "DB_USERNAME", "DB_PASSWORD", "DB_HOST", "REDIS_HOST"]
    with open(env_path, encoding='utf-8') as f:
        content = f.read()

    missing = []
    for key in required_keys:
        if f"{key}=" not in content:
            missing.append(key)

    if missing:
        print(f"ERROR: Missing keys: {', '.join(missing)}")
        return False

    print("✓ .env file OK")
    return True


def check_connectivity():
    """Check database and redis connectivity"""
    print("\n=== Checking connectivity ===")
    try:
        import psycopg2
        import redis

        # Check Redis
        try:
            db_port = int(os.getenv('DIFY_DB_PORT', '5432'))
            redis_port = int(os.getenv('DIFY_REDIS_PORT', '6379'))

            r = redis.Redis(host='localhost', port=redis_port, socket_connect_timeout=2)
            r.ping()
            print(f"✓ Redis OK (localhost:{redis_port})")
        except Exception as e:
            print(f"✗ Redis connection failed: {e}")
            return False

        # Check PostgreSQL
        try:
            conn = psycopg2.connect(
                host='localhost',
                port=db_port,
                user='postgres',
                password='difyai123456',
                database='dify',
                connect_timeout=3
            )
            conn.close()
            print(f"✓ PostgreSQL OK (localhost:{db_port})")
        except Exception as e:
            print(f"✗ PostgreSQL connection failed: {e}")
            return False

        return True
    except ImportError as e:
        print(f"ERROR: Cannot import required modules: {e}")
        return False


def check_imports():
    """Check if key packages can be imported"""
    print("\n=== Checking package imports ===")
    packages = [
        'flask', 'flask_restx', 'celery', 'redis', 'psycopg2',
        'sqlalchemy', 'chromadb', 'pyarrow', 'dotenv'
    ]

    failed = []
    for pkg in packages:
        try:
            __import__(pkg)
            print(f"✓ {pkg}")
        except Exception as e:
            print(f"✗ {pkg}: {e}")
            failed.append(pkg)

    return len(failed) == 0


def scan_source():
    """Scan all Python source files for syntax errors"""
    print("\n=== Scanning source files ===")
    api_dir = Path("api") if Path("api").exists() else Path(".")

    py_files = list(api_dir.rglob("*.py"))
    print(f"Found {len(py_files)} Python files")

    errors = []
    for py_file in py_files:
        try:
            with open(py_file, 'rb') as f:
                compile(f.read(), str(py_file), 'exec')
        except SyntaxError as e:
            errors.append((py_file, e))

    if errors:
        print(f"\nERROR: {len(errors)} files with syntax errors")
        for path, err in errors[:5]:
            print(f"  {path}: {err}")
        return False

    print("✓ All source files OK")
    return True


def main():
    parser = argparse.ArgumentParser(description='Dify environment diagnostics')
    parser.add_argument('--env', action='store_true', help='Check .env configuration')
    parser.add_argument('--conn', action='store_true', help='Check connectivity')
    parser.add_argument('--import', dest='imports', action='store_true', help='Check package imports')
    parser.add_argument('--scan', action='store_true', help='Scan source files')

    args = parser.parse_args()

    # If no args, run all checks
    if not any([args.env, args.conn, args.imports, args.scan]):
        args.env = args.conn = args.imports = True

    results = []

    if args.env:
        results.append(check_env())

    if args.conn:
        results.append(check_connectivity())

    if args.imports:
        results.append(check_imports())

    if args.scan:
        results.append(scan_source())

    print("\n" + "=" * 50)
    if all(results):
        print("✓ All checks passed")
        sys.exit(0)
    else:
        print("✗ Some checks failed")
        sys.exit(1)


if __name__ == '__main__':
    main()
