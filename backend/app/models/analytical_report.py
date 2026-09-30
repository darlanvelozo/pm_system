import uuid
from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.session import Base
from app.models.entities import User, now


class AnalyticalReport(Base):
    __tablename__ = 'analytical_reports'
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey('users.id'), index=True)
    creator: Mapped[User] = relationship(foreign_keys=[created_by], lazy='selectin')
    report_number: Mapped[str | None] = mapped_column(String(100), unique=True)
    emission_key: Mapped[uuid.UUID | None] = mapped_column(Uuid, unique=True)
    status: Mapped[str] = mapped_column(String(20), default='DRAFT')
    data: Mapped[dict] = mapped_column(JSON)
    version: Mapped[int] = mapped_column(Integer, default=1)
    current_revision: Mapped[int] = mapped_column(Integer, default=0)
    registered_by_name_snapshot: Mapped[str | None] = mapped_column(String(150))
    registered_by_username_snapshot: Mapped[str | None] = mapped_column(String(254))
    recipient_email: Mapped[str] = mapped_column(String(254), default='')
    recipient_email_status: Mapped[str] = mapped_column(String(20), default='NOT_SENT')
    battalion_email_status: Mapped[str] = mapped_column(String(20), default='NOT_SENT')
    recipient_email_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    battalion_email_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    pdf_storage_key: Mapped[str | None] = mapped_column(String(100))
    pdf_generated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancelled_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey('users.id'))
    cancellation_reason: Mapped[str | None] = mapped_column(String(500))
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    deleted_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey('users.id'))
    deletion_reason: Mapped[str | None] = mapped_column(String(500))
    edited_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    edited_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey('users.id'))
    edit_reason: Mapped[str | None] = mapped_column(String(500))
    lifecycle: Mapped[dict] = mapped_column(JSON, default=dict)
    __mapper_args__ = {'version_id_col': version}


class AnalyticalReportRevision(Base):
    __tablename__ = 'analytical_report_revisions'
    __table_args__ = (UniqueConstraint('report_id', 'version'),)
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    report_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('analytical_reports.id'), index=True)
    version: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey('users.id'))
    actor_name_snapshot: Mapped[str] = mapped_column(String(150))
    actor_username_snapshot: Mapped[str] = mapped_column(String(254))
    reason: Mapped[str] = mapped_column(String(500))
    pdf_storage_key: Mapped[str] = mapped_column(String(100))
    pdf_sha256: Mapped[str] = mapped_column(String(64))
    pdf_layout_version: Mapped[str] = mapped_column(String(30))
    data: Mapped[dict] = mapped_column(JSON)


class AnalyticalReportSequence(Base):
    __tablename__ = 'analytical_report_sequences'
    year: Mapped[int] = mapped_column(Integer, primary_key=True)
    last_number: Mapped[int] = mapped_column(Integer)
