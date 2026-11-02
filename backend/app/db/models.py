from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Mapping base for existing Drizzle-managed tables."""
