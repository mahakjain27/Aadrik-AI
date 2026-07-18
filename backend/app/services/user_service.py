from fastapi import HTTPException, status

from app.core.security import hash_password, verify_password
from app.database import queries
from app.services.activity_log import log_activity


def _count_active_admins(exclude_user_id: int | None = None) -> int:
    return sum(
        1
        for u in queries.list_users()
        if u["role"] == "admin"
        and u["is_active"]
        and u["id"] != exclude_user_id
    )


def list_users():
    return [dict(row) for row in queries.list_users()]


def create_user(name: str, email: str, password: str, role: str, current_user):
    if queries.get_user_by_email(email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email already exists.",
        )

    queries.create_user(
        name=name,
        email=email,
        password_hash=hash_password(password),
        role=role,
    )

    created = dict(queries.get_user_by_email(email))

    log_activity(
        actor_id=current_user["id"],
        action="user.created",
        entity_type="user",
        entity_id=created["id"],
        message=f"{current_user['name']} created user {name} ({role}).",
    )

    return created


def update_user(user_id: int, name: str, role: str, current_user):
    user = queries.get_user_by_id(user_id)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    if (
        user["role"] == "admin"
        and role != "admin"
        and _count_active_admins(exclude_user_id=user_id) == 0
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove the last remaining admin.",
        )

    queries.update_user(user_id, name=name, role=role)

    if user["role"] != role:
        log_activity(
            actor_id=current_user["id"],
            action="user.role_changed",
            entity_type="user",
            entity_id=user_id,
            message=f"{current_user['name']} changed {user['name']}'s role from {user['role']} to {role}.",
        )
    else:
        log_activity(
            actor_id=current_user["id"],
            action="user.updated",
            entity_type="user",
            entity_id=user_id,
            message=f"{current_user['name']} updated user {name}.",
        )

    return dict(queries.get_user_by_id(user_id))


def set_user_status(user_id: int, is_active: bool, current_user):
    user = queries.get_user_by_id(user_id)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    if not is_active:
        if user_id == current_user["id"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot disable your own account.",
            )

        if (
            user["role"] == "admin"
            and _count_active_admins(exclude_user_id=user_id) == 0
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot disable the last remaining admin.",
            )

    queries.update_user_status(user_id, is_active)

    log_activity(
        actor_id=current_user["id"],
        action="user.enabled" if is_active else "user.disabled",
        entity_type="user",
        entity_id=user_id,
        message=f"{current_user['name']} {'enabled' if is_active else 'disabled'} {user['name']}.",
    )

    return dict(queries.get_user_by_id(user_id))


def reset_password(user_id: int, new_password: str, current_user):
    user = queries.get_user_by_id(user_id)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    if len(new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters.",
        )

    queries.change_password(user_id, hash_password(new_password))

    log_activity(
        actor_id=current_user["id"],
        action="user.password_reset",
        entity_type="user",
        entity_id=user_id,
        message=f"{current_user['name']} reset the password for {user['name']}.",
    )

    return {"success": True, "message": "Password reset successfully."}


def update_own_profile(user_id: int, name: str, email: str):
    existing = queries.get_user_by_email(email)

    if existing is not None and existing["id"] != user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email already exists.",
        )

    queries.update_profile(user_id, name=name, email=email)

    updated = dict(queries.get_user_by_id(user_id))

    log_activity(
        actor_id=user_id,
        action="user.profile_updated",
        entity_type="user",
        entity_id=user_id,
        message=f"{name} updated their own profile.",
    )

    return updated


def change_own_password(user_id: int, current_password: str, new_password: str):
    user = queries.get_user_by_id(user_id)

    if not verify_password(current_password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect.",
        )

    if len(new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters.",
        )

    queries.change_password(user_id, hash_password(new_password))

    log_activity(
        actor_id=user_id,
        action="user.password_changed",
        entity_type="user",
        entity_id=user_id,
        message=f"{user['name']} changed their own password.",
    )

    return {"success": True, "message": "Password updated successfully."}
