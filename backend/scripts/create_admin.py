from getpass import getpass

from app.core.security import hash_password
from app.database import queries


def main():
    print("\n=== Create User ===\n")

    name = input("Name: ").strip()
    email = input("Email: ").strip().lower()

    existing = queries.get_user_by_email(email)

    if existing:
        print("\n❌ A user with this email already exists.")
        return

    role = input("Role (admin/sales/manager/viewer) [admin]: ").strip().lower() or "admin"

    if role not in ("admin", "sales", "manager", "viewer"):
        print("\n❌ Role must be one of: admin, sales, manager, viewer.")
        return

    password = getpass("Password: ")
    confirm = getpass("Confirm Password: ")

    if password != confirm:
        print("\n❌ Passwords do not match.")
        return

    password_hash = hash_password(password)

    queries.create_user(
        name=name,
        email=email,
        password_hash=password_hash,
        role=role,
    )

    print(f"\n✅ {role.capitalize()} user created successfully!")


if __name__ == "__main__":
    main()