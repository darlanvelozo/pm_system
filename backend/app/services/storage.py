from typing import Protocol
from app.models.entities import PdfFile


class StorageService(Protocol):
    def put(self, key: str, content: bytes) -> None: ...
    def get(self, key: str) -> bytes: ...


class DatabaseStorage:
    """Durable, transactional storage; survives Render ephemeral filesystem resets."""
    def __init__(self, db):
        self.db = db

    def put(self, key, content):
        self.db.add(PdfFile(key=key, content=content))

    def get(self, key):
        row = self.db.get(PdfFile, key)
        if row is None:
            raise FileNotFoundError('PDF indisponível')
        return row.content
