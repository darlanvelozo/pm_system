import uuid
from datetime import datetime, timezone
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, LargeBinary, String, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.session import Base


def now():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = 'users'
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    username: Mapped[str | None] = mapped_column(String(254), unique=True)
    email: Mapped[str | None] = mapped_column(String(254), unique=True)
    name: Mapped[str] = mapped_column(String(150))
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), default='OPERADOR')
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class Bulletin(Base):
    __tablename__ = 'bulletins'
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey('users.id'), index=True)
    creator: Mapped['User'] = relationship(foreign_keys=[created_by], lazy='selectin')
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancelled_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey('users.id'))
    cancellation_reason: Mapped[str | None] = mapped_column(String(500))
    registered_by_name_snapshot: Mapped[str | None] = mapped_column(String(150))
    registered_by_username_snapshot: Mapped[str | None] = mapped_column(String(254))
    lifecycle: Mapped[dict] = mapped_column(JSON, default=dict)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    deleted_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey('users.id'))
    deletion_reason: Mapped[str | None] = mapped_column(String(500))
    edited_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    edited_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey('users.id'))
    edit_reason: Mapped[str | None] = mapped_column(String(500))
    current_revision: Mapped[int] = mapped_column(Integer, default=0)
    bo_number: Mapped[str | None] = mapped_column(String(100), unique=True)
    emission_key: Mapped[uuid.UUID | None] = mapped_column(Uuid, unique=True)
    bulletin_type: Mapped[str] = mapped_column(String(20))
    recipient_email: Mapped[str] = mapped_column(String(254))
    status: Mapped[str] = mapped_column(String(20), default='DRAFT')
    data: Mapped[dict] = mapped_column(JSON)
    version: Mapped[int] = mapped_column(Integer, default=1)
    pdf_storage_key: Mapped[str | None] = mapped_column(String(100))
    pdf_generated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    recipient_email_status: Mapped[str] = mapped_column(String(20), default='PENDING')
    battalion_email_status: Mapped[str] = mapped_column(String(20), default='PENDING')
    recipient_email_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    battalion_email_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)
    people: Mapped[list['PersonInvolved']] = relationship(cascade='all, delete-orphan', order_by='PersonInvolved.position')
    team: Mapped[list['PoliceTeam']] = relationship(cascade='all, delete-orphan', order_by='PoliceTeam.position')
    __mapper_args__ = {'version_id_col': version}


class PersonInvolved(Base):
    __tablename__ = 'people_involved'
    __table_args__ = (UniqueConstraint('bulletin_id', 'position'),)
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    bulletin_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('bulletins.id'), index=True)
    position: Mapped[int] = mapped_column(Integer)
    data: Mapped[dict] = mapped_column(JSON)


class PoliceTeam(Base):
    __tablename__ = 'police_teams'
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    bulletin_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('bulletins.id'), index=True)
    position: Mapped[int] = mapped_column(Integer)
    data: Mapped[dict] = mapped_column(JSON)


class PdfFile(Base):
    __tablename__ = 'pdf_files'
    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    content: Mapped[bytes] = mapped_column(LargeBinary)


class BulletinRevision(Base):
    __tablename__ = 'bulletin_revisions'
    __table_args__ = (UniqueConstraint('bulletin_id', 'version'),)
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    bulletin_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('bulletins.id'), index=True)
    version: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey('users.id'))
    actor_name_snapshot: Mapped[str] = mapped_column(String(150))
    actor_username_snapshot: Mapped[str] = mapped_column(String(254))
    reason: Mapped[str] = mapped_column(String(500))
    pdf_storage_key: Mapped[str] = mapped_column(String(100))
    pdf_layout_version: Mapped[str] = mapped_column(String(30))
    pdf_sha256: Mapped[str | None] = mapped_column(String(64))
    involved_count: Mapped[int] = mapped_column(Integer)
    data: Mapped[dict] = mapped_column(JSON)


class BulletinSequence(Base):
    __tablename__ = 'bulletin_sequences'
    date_key: Mapped[str] = mapped_column(String(8), primary_key=True)
    last_number: Mapped[int] = mapped_column(Integer, nullable=False)


class AuditLog(Base):
    __tablename__ = 'audit_logs'
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey('users.id'))
    actor_name_snapshot: Mapped[str | None] = mapped_column(String(150))
    actor_username_snapshot: Mapped[str | None] = mapped_column(String(254))
    bulletin_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey('bulletins.id'))
    report_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey('analytical_reports.id'))
    action: Mapped[str] = mapped_column(String(80))
    result: Mapped[str] = mapped_column(String(30), default='SUCCESS')
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, index=True)
